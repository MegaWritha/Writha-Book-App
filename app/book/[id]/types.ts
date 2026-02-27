import { Platform } from "react-native";

// ── STORAGE KEYS ────────────────────────────────────────────────────────
export const SETTINGS_KEY  = "writha_reader_prefs_v3";
export const positionKey   = (id: string) => `writha_pos_v2_${id}`;
export const bookmarkKey   = (id: string) => `writha_bm_v2_${id}`;
export const highlightKey  = (id: string) => `writha_hl_v2_${id}`;
export const noteKey       = (id: string) => `writha_note_v2_${id}`;

// ── THEME ────────────────────────────────────────────────────────────────
export interface ReaderTheme {
  name:    string;
  bg:      string;
  text:    string;
  accent:  string;
  ui:      string;
  ui2:     string;
  uiText:  string;
  isDark:  boolean;
  statusBar: "light-content" | "dark-content";
}

export const THEMES: Record<string, ReaderTheme> = {
  void: {
    name: "void", bg: "#0D0618", text: "#E8E0F5",
    accent: "#FFD700", ui: "#1A0F2E", ui2: "#2D1B4D",
    uiText: "#A78BFA", isDark: true, statusBar: "light-content",
  },
  sepia: {
    name: "sepia", bg: "#F5ECD7", text: "#2C1810",
    accent: "#8B4513", ui: "#EAD9BC", ui2: "#D4B896",
    uiText: "#6B4423", isDark: false, statusBar: "dark-content",
  },
  slate: {
    name: "slate", bg: "#1A1F2E", text: "#CDD6F4",
    accent: "#89B4FA", ui: "#24283B", ui2: "#313244",
    uiText: "#A6ADC8", isDark: true, statusBar: "light-content",
  },
  paper: {
    name: "paper", bg: "#FFFFF8", text: "#1A1A1A",
    accent: "#6D28D9", ui: "#F0EEF8", ui2: "#DDD9F0",
    uiText: "#4A4580", isDark: false, statusBar: "dark-content",
  },
  forest: {
    name: "forest", bg: "#0D1F0D", text: "#D4E6D4",
    accent: "#4ADE80", ui: "#142114", ui2: "#1E321E",
    uiText: "#86EFAC", isDark: true, statusBar: "light-content",
  },
  midnight: {
    name: "midnight", bg: "#050510", text: "#C0CAF5",
    accent: "#BB9AF7", ui: "#0A0A1F", ui2: "#16213E",
    uiText: "#7AA2F7", isDark: true, statusBar: "light-content",
  },
  rose: {
    name: "rose", bg: "#FFF1F2", text: "#1C0A0D",
    accent: "#E11D48", ui: "#FFE4E6", ui2: "#FECDD3",
    uiText: "#9F1239", isDark: false, statusBar: "dark-content",
  },
};

// ── FONTS ────────────────────────────────────────────────────────────────
export interface FontOption {
  key:    string;
  label:  string;
  family: string | undefined;
}

export const FONTS: FontOption[] = [
  { key: "default",    label: "System",     family: undefined },
  { key: "georgia",    label: "Georgia",    family: Platform.OS === "ios" ? "Georgia"          : "serif"       },
  { key: "courier",    label: "Typewriter", family: Platform.OS === "ios" ? "Courier New"      : "monospace"   },
  { key: "avenir",     label: "Avenir",     family: Platform.OS === "ios" ? "Avenir Next"      : "sans-serif"  },
  { key: "palatino",   label: "Palatino",   family: Platform.OS === "ios" ? "Palatino-Roman"   : "serif"       },
  { key: "baskerville",label: "Baskerville",family: Platform.OS === "ios" ? "Baskerville"      : "serif"       },
];

// ── PARAGRAPH ────────────────────────────────────────────────────────────
export type ParagraphType =
  | "chapter"
  | "section_break"
  | "sub_heading"
  | "body"
  | "dialogue"
  | "blank";

export interface Paragraph {
  type:  ParagraphType;
  text:  string;
  index: number;
}

// ── BOOKMARK ─────────────────────────────────────────────────────────────
export interface Bookmark {
  page:      number;
  label:     string;
  timestamp: number;
  color:     string;
}

// ── HIGHLIGHT ────────────────────────────────────────────────────────────
export interface Highlight {
  id:         string;
  pageIndex:  number;
  paraIndex:  number;
  text:       string;
  color:      string;
  note:       string;
  timestamp:  number;
}

// ── READER SETTINGS ──────────────────────────────────────────────────────
export interface ReaderSettings {
  fontSize:    number;
  lineSpacing: number;
  alignment:   "left" | "center" | "justify";
  themeName:   string;
  fontKey:     string;
  margins:     number;
  paragraphGap: number;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize:     18,
  lineSpacing:  1.8,
  alignment:    "justify",
  themeName:    "void",
  fontKey:      "default",
  margins:      26,
  paragraphGap: 20,
};

// ── READING STATS ────────────────────────────────────────────────────────
export interface ReadingStats {
  totalPagesRead:  number;
  totalTimeRead:   number; // seconds
  sessionsCount:   number;
  lastReadAt:      number; // timestamp
  avgReadingSpeed: number; // pages per minute
}

// ── UTILS ────────────────────────────────────────────────────────────────
export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function formatReadingTime(seconds: number): string {
  if (seconds < 60)   return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function estimateReadingTime(paragraphs: Paragraph[]): number {
  const words = paragraphs
    .filter((p) => p.type === "body" || p.type === "dialogue")
    .reduce((acc, p) => acc + p.text.split(/\s+/).length, 0);
  // Average reading speed: 250 words per minute
  return Math.ceil(words / 250);
}