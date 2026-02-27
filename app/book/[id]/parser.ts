import { Paragraph, ParagraphType } from "./types";

// ── DIALOGUE DETECTION ───────────────────────────────────────────────────
// Detects lines that are primarily spoken dialogue
function isDialogue(text: string): boolean {
  const t = text.trim();
  // Starts with opening quote (straight or curly)
  if (/^[""\u201C]/.test(t)) return true;
  // African/Nigerian dialogue style — starts with dash
  if (/^[\u2014\u2013—–]/.test(t)) return true;
  return false;
}

// ── CHAPTER DETECTION ────────────────────────────────────────────────────
function isChapterHeading(trimmed: string, words: string[]): boolean {
  // Explicit chapter keywords
  if (/^(chapter|prologue|epilogue|part|act|scene|book|volume|section)\s+[\w\d\-]+/i.test(trimmed)) {
    return true;
  }

  // ALL CAPS heading (min 2 words to avoid false positives like "I")
  if (
    trimmed === trimmed.toUpperCase() &&
    trimmed.length >= 4 &&
    trimmed.length <= 80 &&
    /[A-Z]/.test(trimmed) &&
    words.length >= 2
  ) {
    return true;
  }

  // Roman numeral chapters: I, II, III, IV etc (standalone)
  if (/^(I{1,3}|IV|VI{0,3}|IX|X{0,3}|XL|L|XC|C)\b\.?$/.test(trimmed)) {
    return true;
  }

  // Numbered chapters: "1.", "Chapter 1", "1 —", "01."
  if (/^(\d{1,3}\.?\s*[—–]?\s*)$/.test(trimmed)) {
    return true;
  }

  return false;
}

// ── SUBHEADING DETECTION ─────────────────────────────────────────────────
function isSubHeading(trimmed: string, words: string[], prevBlank: boolean, nextBlank: boolean): boolean {
  if (!prevBlank || !nextBlank) return false;
  if (trimmed.endsWith(".") || trimmed.endsWith(",") || trimmed.endsWith("?") || trimmed.endsWith("!")) return false;
  if (words.length < 2 || words.length > 9) return false;
  if (trimmed.length >= 60) return false;

  // Title Case check — majority of words capitalised
  const capitalisedCount = words.filter((w) => w.length > 0 && w[0] === w[0].toUpperCase()).length;
  return capitalisedCount / words.length >= 0.7;
}

// ── SECTION BREAK DETECTION ──────────────────────────────────────────────
function isSectionBreak(trimmed: string): boolean {
  return (
    /^[\*\-_~=#✦•◆▪]{3,}$/.test(trimmed) ||
    trimmed === "***" ||
    trimmed === "---" ||
    trimmed === "* * *" ||
    trimmed === "• • •" ||
    trimmed === "✦ ✦ ✦"
  );
}

// ── MAIN CLASSIFIER ──────────────────────────────────────────────────────
export function classifyParagraphs(raw: string): Paragraph[] {
  // Normalise line endings
  const normalised = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Collapse 3+ consecutive blank lines into 2
    .replace(/\n{3,}/g, "\n\n");

  const lines  = normalised.split("\n");
  const result: Paragraph[] = [];
  let   idx    = 0;

  for (let i = 0; i < lines.length; i++) {
    const line    = lines[i];
    const trimmed = line.trim();

    // ── BLANK ──────────────────────────────────────────────────────────
    if (!trimmed) {
      // Only add blank if previous wasn't already blank (deduplicate)
      if (result.length === 0 || result[result.length - 1].type !== "blank") {
        result.push({ type: "blank", text: "", index: idx++ });
      }
      continue;
    }

    // ── SECTION BREAK ──────────────────────────────────────────────────
    if (isSectionBreak(trimmed)) {
      result.push({ type: "section_break", text: "✦ ✦ ✦", index: idx++ });
      continue;
    }

    const words     = trimmed.split(/\s+/);
    const prevBlank = i === 0 || lines[i - 1].trim() === "";
    const nextBlank = i === lines.length - 1 || lines[i + 1].trim() === "";

    // ── CHAPTER ────────────────────────────────────────────────────────
    if (isChapterHeading(trimmed, words)) {
      result.push({ type: "chapter", text: trimmed, index: idx++ });
      continue;
    }

    // ── SUB HEADING ────────────────────────────────────────────────────
    if (isSubHeading(trimmed, words, prevBlank, nextBlank)) {
      result.push({ type: "sub_heading", text: trimmed, index: idx++ });
      continue;
    }

    // ── DIALOGUE ───────────────────────────────────────────────────────
    if (isDialogue(trimmed)) {
      result.push({ type: "dialogue", text: trimmed, index: idx++ });
      continue;
    }

    // ── BODY ───────────────────────────────────────────────────────────
    result.push({ type: "body", text: trimmed, index: idx++ });
  }

  return result;
}

// ── STRIP LEADING BLANKS ─────────────────────────────────────────────────
export function stripLeadingBlanks(paragraphs: Paragraph[]): Paragraph[] {
  let start = 0;
  while (start < paragraphs.length && paragraphs[start].type === "blank") {
    start++;
  }
  return start > 0 ? paragraphs.slice(start) : paragraphs;
}

// ── BUILD PAGES ──────────────────────────────────────────────────────────
// Splits paragraphs into pages based on estimated visual weight.
// Weight is calculated per paragraph type so chapter headings and
// dialogue take up the right amount of visual space.
export function buildPages(
  paragraphs: Paragraph[],
  fontSize:   number    = 18,
  margins:    number    = 26,
): Paragraph[][] {
  const pages:   Paragraph[][] = [];
  let   current: Paragraph[]   = [];
  let   lineCount               = 0;

  // Adjust lines per page based on font size
  // Bigger font = fewer lines fit on screen
  const linesPerPage = Math.max(
    8,
    Math.round(28 - (fontSize - 16) * 0.8)
  );

  for (const p of paragraphs) {
    if (p.type === "blank") continue;

    // Visual weight per paragraph type
    const weight =
      p.type === "chapter"       ? 7  :
      p.type === "sub_heading"   ? 3  :
      p.type === "section_break" ? 2  :
      p.type === "dialogue"      ? 1.5 : 2;

    // Chapter always starts a fresh page (if we have content)
    if (p.type === "chapter" && current.length > 0) {
      pages.push(current);
      current   = [];
      lineCount = 0;
    }

    current.push(p);
    lineCount += weight;

    // Only break at body or dialogue — never mid-chapter or mid-heading
    if (
      lineCount >= linesPerPage &&
      (p.type === "body" || p.type === "dialogue")
    ) {
      pages.push(current);
      current   = [];
      lineCount = 0;
    }
  }

  if (current.length > 0) pages.push(current);
  return pages;
}

// ── EXTRACT CONTENT ──────────────────────────────────────────────────────
export function extractContent(data: any): string {
  if (typeof data.content === "string" && data.content.trim()) return data.content;
  if (typeof data.text    === "string" && data.text.trim())    return data.text;
  if (typeof data.body    === "string" && data.body.trim())    return data.body;

  if (Array.isArray(data.chapters) && data.chapters.length > 0) {
    return data.chapters
      .map((ch: any) => {
        const title   = ch.title   ? `${ch.title}\n\n`   : "";
        const content = ch.content || ch.text || ch.body || "";
        return title + content;
      })
      .join("\n\n\n");
  }

  return "";
}

// ── SEARCH IN BOOK ───────────────────────────────────────────────────────
export interface SearchResult {
  pageIndex:  number;
  paraIndex:  number;
  paragraph:  Paragraph;
  matchStart: number;
  matchEnd:   number;
  snippet:    string;
}

export function searchInPages(
  pages:  Paragraph[][],
  query:  string,
): SearchResult[] {
  if (!query.trim()) return [];
  const results: SearchResult[] = [];
  const q = query.toLowerCase().trim();

  pages.forEach((page, pageIndex) => {
    page.forEach((para, paraIndex) => {
      const lower = para.text.toLowerCase();
      let idx = lower.indexOf(q);
      while (idx !== -1) {
        const snippetStart = Math.max(0, idx - 40);
        const snippetEnd   = Math.min(para.text.length, idx + q.length + 40);
        results.push({
          pageIndex,
          paraIndex,
          paragraph:  para,
          matchStart: idx,
          matchEnd:   idx + q.length,
          snippet:    (snippetStart > 0 ? "..." : "") +
                      para.text.slice(snippetStart, snippetEnd) +
                      (snippetEnd < para.text.length ? "..." : ""),
        });
        idx = lower.indexOf(q, idx + 1);
      }
    });
  });

  return results;
}

// ── CHAPTER MAP ──────────────────────────────────────────────────────────
export interface ChapterEntry {
  title:     string;
  pageIndex: number;
}

export function buildChapterMap(pages: Paragraph[][]): ChapterEntry[] {
  const chapters: ChapterEntry[] = [];
  pages.forEach((page, pageIndex) => {
    const first = page.find((p) => p.type === "chapter");
    if (first) {
      chapters.push({ title: first.text, pageIndex });
    }
  });
  return chapters;
}