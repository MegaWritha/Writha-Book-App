import { useState, useEffect, useRef, useCallback } from "react";
import { Alert, AppState, AppStateStatus } from "react-native";
import * as FileSystem from "expo-file-system";
import { useRouter } from "expo-router";
import { db, auth } from "@/lib/firebase";
import {
  doc, onSnapshot, updateDoc,
  increment, arrayUnion, serverTimestamp,
} from "firebase/firestore";
import * as Speech from "expo-speech";
import {
  classifyParagraphs, stripLeadingBlanks,
  buildPages, extractContent, buildChapterMap,
  ChapterEntry,
} from "../parser";
import { Paragraph, estimateReadingTime } from "../types";

export interface BookData {
  id:            string;
  title:         string;
  displayAuthor: string;
  displayCover:  string | null;
  content:       string;
  genre:         string;
  price:         number;
  description:   string;
  tags:          string[];
  [key: string]: any;
}

export interface UseReaderBookReturn {
  book:             BookData | null;
  paragraphs:       Paragraph[];
  pages:            Paragraph[][];
  chapterMap:       ChapterEntry[];
  loading:          boolean;
  error:            string | null;
  estimatedMinutes: number;
  recordView:       () => void;
}

export function useReaderBook(
  bookId:        string,
  isOfflineMode: boolean,
  fontSize:      number = 18,
  margins:       number = 26,
): UseReaderBookReturn {
  const router = useRouter();
  const user   = auth.currentUser;

  const [book,       setBook]       = useState<BookData | null>(null);
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [pages,      setPages]      = useState<Paragraph[][]>([]);
  const [chapterMap, setChapterMap] = useState<ChapterEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [estimatedMinutes, setEstimatedMinutes] = useState(0);

  const hasRecordedView = useRef(false);

  // ── PROCESS RAW BOOK DATA ─────────────────────────────────────────
  const processBookData = useCallback((data: any) => {
    try {
      const content    = extractContent(data);

      if (!content.trim()) {
        setError("This book has no readable content yet.");
        setLoading(false);
        return;
      }

      const classified = classifyParagraphs(content);
      const stripped   = stripLeadingBlanks(classified);
      const builtPages = buildPages(stripped, fontSize, margins);
      const chapters   = buildChapterMap(builtPages);
      const minutes    = estimateReadingTime(stripped);

      setParagraphs(stripped);
      setPages(builtPages);
      setChapterMap(chapters);
      setEstimatedMinutes(minutes);
      setError(null);

      setBook({
        id:            data.id || bookId,
        title:         data.title         || "Untitled",
        displayAuthor: data.authorName    || data.author    || "Unknown Author",
        displayCover:  data.coverUrl      || data.cover     || null,
        content,
        genre:         data.genre         || "",
        price:         data.price         || 0,
        description:   data.description   || "",
        tags:          data.tags          || [],
        ...data,
      });

      setLoading(false);
    } catch (e: any) {
      setError("Failed to process book content.");
      setLoading(false);
    }
  }, [bookId, fontSize, margins]);

  // ── LOAD BOOK ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!bookId) return;
    setLoading(true);
    setError(null);
    let unsub: () => void = () => {};

    if (isOfflineMode) {
      (async () => {
        try {
          const base = (FileSystem as any).documentDirectory
            || (FileSystem as any).cacheDirectory;
          const uri  = `${base}manuscripts/${bookId}.json`;
          const info = await FileSystem.getInfoAsync(uri);

          if (!info.exists) {
            Alert.alert(
              "Not Downloaded",
              "This book isn't saved offline. Please download it first.",
              [{ text: "Go Back", onPress: () => router.back() }]
            );
            return;
          }

          const raw  = await FileSystem.readAsStringAsync(uri);
          processBookData({ ...JSON.parse(raw), id: bookId });
        } catch (e) {
          Alert.alert("Archive Error", "Could not load offline manuscript.", [
            { text: "Go Back", onPress: () => router.back() },
          ]);
        }
      })();
    } else {
      unsub = onSnapshot(
        doc(db, "books", bookId),
        (snap) => {
          if (snap.exists()) {
            processBookData({ id: snap.id, ...snap.data() });
          } else {
            setError("This book could not be found.");
            setLoading(false);
          }
        },
        (err) => {
          setError("Failed to load book. Check your connection.");
          setLoading(false);
        }
      );
    }

    return () => { unsub(); Speech.stop(); };
  }, [bookId, isOfflineMode, processBookData]);

  // ── RECORD VIEW (once per session) ───────────────────────────────
  const recordView = useCallback(async () => {
    if (hasRecordedView.current || !user || !bookId || isOfflineMode) return;
    hasRecordedView.current = true;
    try {
      await updateDoc(doc(db, "books", bookId), {
        viewsCount:   increment(1),
        recentReaders: arrayUnion(user.uid),
        lastViewedAt:  serverTimestamp(),
      });
    } catch {}
  }, [user, bookId, isOfflineMode]);

  // ── REBUILD PAGES IF FONT SIZE CHANGES ───────────────────────────
  useEffect(() => {
    if (paragraphs.length === 0) return;
    const rebuilt   = buildPages(paragraphs, fontSize, margins);
    const chapters  = buildChapterMap(rebuilt);
    setPages(rebuilt);
    setChapterMap(chapters);
  }, [fontSize, margins]);

  return {
    book, paragraphs, pages, chapterMap,
    loading, error, estimatedMinutes, recordView,
  };
}