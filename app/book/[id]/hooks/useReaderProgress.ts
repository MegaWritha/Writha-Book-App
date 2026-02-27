import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db, auth } from "@/lib/firebase";
import { doc, updateDoc, increment, arrayUnion, serverTimestamp } from "firebase/firestore";
import { positionKey, debounce, ReadingStats } from "../types";

export interface UseReaderProgressReturn {
  progress:             number;
  currentPage:          number;
  savedPage:            number | null;
  hasMarkedRead:        boolean;
  readingStats:         ReadingStats | null;
  handleScrollProgress: (event: any) => void;
  handlePageChange:     (index: number) => void;
  jumpToPage:           (index: number) => void;
}

const STATS_KEY = (bookId: string) => `writha_stats_${bookId}`;

export function useReaderProgress(
  bookId:     string,
  totalPages: number,
): UseReaderProgressReturn {
  const user = auth.currentUser;

  const [progress,      setProgress]      = useState(0);
  const [currentPage,   setCurrentPage]   = useState(0);
  const [savedPage,     setSavedPage]     = useState<number | null>(null);
  const [hasMarkedRead, setHasMarkedRead] = useState(false);
  const [readingStats,  setReadingStats]  = useState<ReadingStats | null>(null);

  const sessionStartRef    = useRef<number>(Date.now());
  const sessionPagesRef    = useRef<number>(0);
  const lastPageRef        = useRef<number>(0);

  // ── LOAD SAVED POSITION ──────────────────────────────────────────
  useEffect(() => {
    if (!bookId || totalPages === 0) return;
    AsyncStorage.getItem(positionKey(bookId))
      .then((raw) => {
        if (!raw) return;
        const n = parseInt(raw, 10);
        if (!isNaN(n) && n > 0 && n < totalPages) {
          setSavedPage(n);
        }
      })
      .catch(() => {});
  }, [bookId, totalPages]);

  // ── LOAD READING STATS ───────────────────────────────────────────
  useEffect(() => {
    if (!bookId) return;
    AsyncStorage.getItem(STATS_KEY(bookId))
      .then((raw) => {
        if (raw) setReadingStats(JSON.parse(raw));
      })
      .catch(() => {});
  }, [bookId]);

  // ── SAVE STATS ON APP BACKGROUND / UNMOUNT ───────────────────────
  useEffect(() => {
    return () => {
      const sessionSeconds = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      if (sessionSeconds < 5) return; // ignore very short sessions

      const pagesRead = sessionPagesRef.current;
      const speed     = pagesRead > 0 && sessionSeconds > 0
        ? (pagesRead / sessionSeconds) * 60 // pages per minute
        : 0;

      AsyncStorage.getItem(STATS_KEY(bookId))
        .then((raw) => {
          const existing: ReadingStats = raw
            ? JSON.parse(raw)
            : {
                totalPagesRead:  0,
                totalTimeRead:   0,
                sessionsCount:   0,
                lastReadAt:      0,
                avgReadingSpeed: 0,
              };

          const updated: ReadingStats = {
            totalPagesRead:  existing.totalPagesRead  + pagesRead,
            totalTimeRead:   existing.totalTimeRead   + sessionSeconds,
            sessionsCount:   existing.sessionsCount   + 1,
            lastReadAt:      Date.now(),
            avgReadingSpeed: speed > 0
              ? (existing.avgReadingSpeed + speed) / 2
              : existing.avgReadingSpeed,
          };

          AsyncStorage.setItem(STATS_KEY(bookId), JSON.stringify(updated)).catch(() => {});
          setReadingStats(updated);
        })
        .catch(() => {});
    };
  }, [bookId]);

  // ── DEBOUNCED SAVE POSITION ──────────────────────────────────────
  const debouncedSave = useMemo(
    () => debounce((page: number) => {
      AsyncStorage.setItem(positionKey(bookId), String(page)).catch(() => {});
    }, 800),
    [bookId],
  );

  // ── MARK BOOK READ ───────────────────────────────────────────────
  const markBookRead = useCallback(async () => {
    if (hasMarkedRead || !user || !bookId) return;
    setHasMarkedRead(true);
    try {
      // Update user's books read count
      await updateDoc(doc(db, "users", user.uid), {
        booksRead: increment(1),
      });
      // Record completion on the book itself
      await updateDoc(doc(db, "books", bookId), {
        completionsCount: increment(1),
      });
    } catch {}
  }, [hasMarkedRead, user, bookId]);

  // ── UPDATE PROGRESS ──────────────────────────────────────────────
  const updateProgress = useCallback((page: number) => {
    const p = totalPages > 1 ? (page / (totalPages - 1)) * 100 : 0;
    setProgress(Math.min(100, Math.max(0, p)));
    setCurrentPage(page);
    debouncedSave(page);

    // Track pages read this session
    if (page > lastPageRef.current) {
      sessionPagesRef.current += page - lastPageRef.current;
      lastPageRef.current      = page;
    }

    if (p >= 90) markBookRead();
  }, [totalPages, debouncedSave, markBookRead]);

  // ── SCROLL HANDLER ───────────────────────────────────────────────
  const handleScrollProgress = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const denominator = contentSize.height - layoutMeasurement.height;
    if (denominator <= 0) return;

    const raw  = (contentOffset.y / denominator) * 100;
    const p    = Math.max(0, Math.min(100, raw));
    const page = Math.round((p / 100) * Math.max(0, totalPages - 1));

    setProgress(p);
    setCurrentPage(page);
    debouncedSave(page);

    if (page > lastPageRef.current) {
      sessionPagesRef.current += page - lastPageRef.current;
      lastPageRef.current      = page;
    }

    if (p >= 90) markBookRead();
  }, [totalPages, debouncedSave, markBookRead]);

  // ── PAGE CHANGE HANDLER (swipe mode) ────────────────────────────
  const handlePageChange = useCallback((index: number) => {
    updateProgress(index);
  }, [updateProgress]);

  // ── JUMP TO PAGE ─────────────────────────────────────────────────
  const jumpToPage = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(totalPages - 1, index));
    updateProgress(clamped);
  }, [totalPages, updateProgress]);

  return {
    progress, currentPage, savedPage,
    hasMarkedRead, readingStats,
    handleScrollProgress, handlePageChange, jumpToPage,
  };
}