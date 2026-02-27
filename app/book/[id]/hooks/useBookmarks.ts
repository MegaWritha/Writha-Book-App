import { useState, useEffect, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Bookmark, Paragraph, bookmarkKey } from "../types";

// Bookmark accent colours to choose from
export const BOOKMARK_COLORS = [
  "#FFD700", // gold
  "#EF4444", // red
  "#22C55E", // green
  "#38BDF8", // blue
  "#A78BFA", // purple
  "#F97316", // orange
  "#EC4899", // pink
];

export interface UseBookmarksReturn {
  bookmarks:               Bookmark[];
  isCurrentPageBookmarked: boolean;
  currentBookmarkColor:    string | null;
  toggleBookmark:          (color?: string) => void;
  deleteBookmark:          (page: number) => void;
  clearAllBookmarks:       () => void;
  updateBookmarkColor:     (page: number, color: string) => void;
  getBookmarkForPage:      (page: number) => Bookmark | undefined;
  sortedBookmarks:         Bookmark[];
}

export function useBookmarks(
  bookId:      string,
  currentPage: number,
  pages:       Paragraph[][],
): UseBookmarksReturn {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  // ── LOAD BOOKMARKS ───────────────────────────────────────────────
  useEffect(() => {
    if (!bookId) return;
    AsyncStorage.getItem(bookmarkKey(bookId))
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          // Migrate old bookmarks that don't have color field
          const migrated = parsed.map((b: any) => ({
            ...b,
            color: b.color || BOOKMARK_COLORS[0],
          }));
          setBookmarks(migrated);
        }
      })
      .catch(() => {});
  }, [bookId]);

  // ── PERSIST ──────────────────────────────────────────────────────
  const persist = useCallback((bms: Bookmark[]) => {
    setBookmarks(bms);
    AsyncStorage.setItem(bookmarkKey(bookId), JSON.stringify(bms)).catch(() => {});
  }, [bookId]);

  // ── GENERATE LABEL FROM PAGE CONTENT ────────────────────────────
  const generateLabel = useCallback((page: number): string => {
    const pageParagraphs = pages[page] || [];
    // Find first meaningful line
    const first = pageParagraphs.find(
      (p) => (p.type === "body" || p.type === "dialogue" || p.type === "chapter") && p.text.trim()
    );
    if (!first) return `Page ${page + 1}`;
    // Truncate to 60 chars
    const label = first.text.trim();
    return label.length > 60 ? label.slice(0, 57) + "..." : label;
  }, [pages]);

  // ── TOGGLE BOOKMARK ──────────────────────────────────────────────
  const toggleBookmark = useCallback((color?: string) => {
    const exists = bookmarks.find((b) => b.page === currentPage);
    if (exists) {
      // Remove bookmark
      persist(bookmarks.filter((b) => b.page !== currentPage));
    } else {
      // Add bookmark
      const newBookmark: Bookmark = {
        page:      currentPage,
        label:     generateLabel(currentPage),
        timestamp: Date.now(),
        color:     color || BOOKMARK_COLORS[0],
      };
      persist([...bookmarks, newBookmark]);
    }
  }, [bookmarks, currentPage, generateLabel, persist]);

  // ── DELETE BOOKMARK ──────────────────────────────────────────────
  const deleteBookmark = useCallback((page: number) => {
    persist(bookmarks.filter((b) => b.page !== page));
  }, [bookmarks, persist]);

  // ── CLEAR ALL ────────────────────────────────────────────────────
  const clearAllBookmarks = useCallback(() => {
    persist([]);
  }, [persist]);

  // ── UPDATE BOOKMARK COLOR ────────────────────────────────────────
  const updateBookmarkColor = useCallback((page: number, color: string) => {
    persist(bookmarks.map((b) => b.page === page ? { ...b, color } : b));
  }, [bookmarks, persist]);

  // ── GET BOOKMARK FOR PAGE ────────────────────────────────────────
  const getBookmarkForPage = useCallback((page: number): Bookmark | undefined => {
    return bookmarks.find((b) => b.page === page);
  }, [bookmarks]);

  // ── DERIVED VALUES ───────────────────────────────────────────────
  const isCurrentPageBookmarked = useMemo(
    () => bookmarks.some((b) => b.page === currentPage),
    [bookmarks, currentPage],
  );

  const currentBookmarkColor = useMemo(() => {
    const bm = bookmarks.find((b) => b.page === currentPage);
    return bm?.color || null;
  }, [bookmarks, currentPage]);

  const sortedBookmarks = useMemo(
    () => [...bookmarks].sort((a, b) => a.page - b.page),
    [bookmarks],
  );

  return {
    bookmarks,
    isCurrentPageBookmarked,
    currentBookmarkColor,
    toggleBookmark,
    deleteBookmark,
    clearAllBookmarks,
    updateBookmarkColor,
    getBookmarkForPage,
    sortedBookmarks,
  };
}