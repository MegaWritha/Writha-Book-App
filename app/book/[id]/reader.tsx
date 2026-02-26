import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, StatusBar, ActivityIndicator, Animated,
  Platform, Image, Easing, Alert, FlatList, Modal, Pressable
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, increment } from "firebase/firestore";
import * as Speech from "expo-speech";

const { width, height } = Dimensions.get("window");

// ── THEMES ──────────────────────────────────────────────────────────────
interface ReaderTheme {
  name: string; bg: string; text: string; accent: string;
  ui: string; uiText: string; isDark: boolean;
}
const THEMES: Record<string, ReaderTheme> = {
  void:  { name: "void",  bg: "#0F071A", text: "#E2E8F0", accent: "#FFD700", ui: "#1E1135", uiText: "#A78BFA", isDark: true },
  sepia: { name: "sepia", bg: "#F4ECD8", text: "#3B2A1A", accent: "#8B4513", ui: "#E8D8B8", uiText: "#6B4423", isDark: false },
  slate: { name: "slate", bg: "#1E2433", text: "#CBD5E0", accent: "#90CDF4", ui: "#2D3748", uiText: "#A0AEC0", isDark: true },
  paper: { name: "paper", bg: "#FAFAF8", text: "#1A1A1A", accent: "#7C3AED", ui: "#F0EFF0", uiText: "#4A5568", isDark: false },
  forest:{ name: "forest",bg: "#1A2B1A", text: "#D4E6D4", accent: "#68D391", ui: "#2D3B2D", uiText: "#9AE6B4", isDark: true },
};

// ── FONTS ───────────────────────────────────────────────────────────────
const FONTS = [
  { key: "default",    label: "Default",    family: undefined },
  { key: "serif",      label: "Georgia",    family: Platform.OS === "ios" ? "Georgia" : "serif" },
  { key: "mono",       label: "Typewriter", family: Platform.OS === "ios" ? "Courier New" : "monospace" },
  { key: "rounded",    label: "Rounded",    family: Platform.OS === "ios" ? "Avenir" : "sans-serif" },
];

// ── PARAGRAPH CLASSIFIER ─────────────────────────────────────────────────
type ParagraphType = "chapter" | "section_break" | "sub_heading" | "body" | "blank";

interface Paragraph {
  type: ParagraphType;
  text: string;
  index: number;
}

function classifyParagraphs(raw: string): Paragraph[] {
  const lines = raw.split(/\n/);
  const result: Paragraph[] = [];
  let index = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed === "") {
      result.push({ type: "blank", text: "", index: index++ });
      continue;
    }

    if (/^[\*\-_~=#]{3,}$/.test(trimmed) || trimmed === "***" || trimmed === "---") {
      result.push({ type: "section_break", text: trimmed, index: index++ });
      continue;
    }

    if (/^(chapter|prologue|epilogue|part|act|scene|book)\s+[\w\d]+/i.test(trimmed)) {
      result.push({ type: "chapter", text: trimmed, index: index++ });
      continue;
    }

    if (
      trimmed === trimmed.toUpperCase() &&
      trimmed.length <= 60 &&
      trimmed.length >= 2 &&
      /[A-Z]/.test(trimmed)
    ) {
      result.push({ type: "chapter", text: trimmed, index: index++ });
      continue;
    }

    const words = trimmed.split(" ");
    const isTitleCase = words.every((w) => !w[0] || w[0] === w[0].toUpperCase());
    if (
      isTitleCase && trimmed.length < 50 && !trimmed.endsWith(".") &&
      !trimmed.endsWith(",") && words.length <= 8 && words.length >= 1
    ) {
      const prevBlank = i === 0 || lines[i - 1].trim() === "";
      const nextBlank = i === lines.length - 1 || lines[i + 1].trim() === "";
      if (prevBlank && nextBlank) {
        result.push({ type: "sub_heading", text: trimmed, index: index++ });
        continue;
      }
    }

    result.push({ type: "body", text: trimmed, index: index++ });
  }

  return result;
}

// ── SPLIT INTO PAGES ─────────────────────────────────────────────────────
function buildPages(paragraphs: Paragraph[], linesPerPage = 18): Paragraph[][] {
  const pages: Paragraph[][] = [];
  let current: Paragraph[] = [];
  let lineCount = 0;

  for (const p of paragraphs) {
    if (p.type === "blank") continue;
    const weight = p.type === "chapter" ? 6 : p.type === "sub_heading" ? 3 : 2;

    if (p.type === "chapter" && current.length > 0) {
      pages.push(current);
      current = [];
      lineCount = 0;
    }

    current.push(p);
    lineCount += weight;

    if (lineCount >= linesPerPage && p.type === "body") {
      pages.push(current);
      current = [];
      lineCount = 0;
    }
  }

  if (current.length > 0) pages.push(current);
  return pages;
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────
export default function ReaderScreen() {
  const { id, mode } = useLocalSearchParams();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const user = auth.currentUser;

  const bookId = useMemo(() => (Array.isArray(id) ? id[0] : id) as string, [id]);
  const isOfflineMode = mode === "offline";

  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [readingMode, setReadingMode] = useState<"scroll" | "swipe">("scroll");
  const [fontSize, setFontSize] = useState(18);
  const [lineSpacing, setLineSpacing] = useState(1.75);
  const [alignment, setAlignment] = useState<"left" | "center" | "justify">("justify");
  const [theme, setTheme] = useState<ReaderTheme>(THEMES.void);
  const [fontKey, setFontKey] = useState("default");
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<Paragraph[][]>([]);
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [hasMarkedRead, setHasMarkedRead] = useState(false);
  const [showFontPanel, setShowFontPanel] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<Speech.Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string | undefined>(undefined);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [speechRate, setSpeechRate] = useState(0.9);
  // ✅ FIX: Track scroll page number for scroll mode
  const [scrollPageNum, setScrollPageNum] = useState(1);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const controlsVisible = useRef(true);

  const currentFont = FONTS.find((f) => f.key === fontKey) || FONTS[0];
  // ✅ FIX: Calculate total pages for scroll mode based on content
  const totalScrollPages = useMemo(() => Math.max(1, pages.length), [pages]);

  // ── LOAD VOICES ────────────────────────────────────────────────────
  useEffect(() => {
    Speech.getAvailableVoicesAsync().then((voices) => {
      const english = voices.filter((v) => v.language?.startsWith("en") || !v.language);
      setAvailableVoices(english);
      if (english.length > 0 && !selectedVoice) setSelectedVoice(english[0].identifier);
    }).catch(() => {});
  }, []);

  // ── LOAD BOOK ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!bookId) return;
    let unsub: any = () => {};

    const processBookData = (data: any) => {
      let extractedContent = data.content || data.text || "";
      if (!extractedContent && Array.isArray(data.chapters)) {
        extractedContent = data.chapters
          .map((ch: any) => {
            const title = ch.title ? `${ch.title}\n\n` : "";
            return title + (ch.content || "");
          })
          .join("\n\n\n");
      }

      const classified = classifyParagraphs(extractedContent);
      setParagraphs(classified);
      setPages(buildPages(classified));

      setBook({
        ...data,
        content: extractedContent,
        displayAuthor: data.authorName || data.author || "Unknown Author",
        displayCover: data.coverUrl || data.cover || null,
      });
      setLoading(false);
    };

    if (isOfflineMode) {
      (async () => {
        try {
          const base = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory;
          const uri = `${base}manuscripts/${bookId}.json`;
          const content = await FileSystem.readAsStringAsync(uri);
          processBookData(JSON.parse(content));
        } catch {
          Alert.alert("Archive Error", "Could not locate manuscript.");
          router.back();
        }
      })();
    } else {
      unsub = onSnapshot(doc(db, "books", bookId), (snap) => {
        if (snap.exists()) processBookData({ id: snap.id, ...snap.data() });
      });
    }

    return () => { unsub(); Speech.stop(); };
  }, [bookId, isOfflineMode]);

  // ── CONTROLS TOGGLE ────────────────────────────────────────────────
  const toggleControls = useCallback(() => {
    const next = !controlsVisible.current;
    controlsVisible.current = next;
    Animated.timing(fadeAnim, {
      toValue: next ? 1 : 0,
      duration: 250,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();
    setShowControls(next);
  }, [fadeAnim]);

  // ── MARK READ ──────────────────────────────────────────────────────
  const markBookRead = useCallback(async () => {
    if (hasMarkedRead || !user || !bookId) return;
    setHasMarkedRead(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { booksRead: increment(1) });
    } catch {}
  }, [hasMarkedRead, user, bookId]);

  // ── SCROLL PROGRESS ────────────────────────────────────────────────
  const handleScrollProgress = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const raw = (contentOffset.y / (contentSize.height - layoutMeasurement.height)) * 100;
    const p = Math.max(0, Math.min(100, raw));
    setProgress(p);
    // ✅ FIX: Calculate current page number from scroll position
    const estimatedPage = Math.max(1, Math.ceil((p / 100) * totalScrollPages));
    setScrollPageNum(estimatedPage);
    if (p >= 90) markBookRead();
  }, [markBookRead, totalScrollPages]);

  // ── PAGE CHANGE ────────────────────────────────────────────────────
  const handlePageChange = useCallback((index: number) => {
    setCurrentPage(index);
    const p = pages.length > 1 ? (index / (pages.length - 1)) * 100 : 0;
    setProgress(p);
    if (p >= 90) markBookRead();
  }, [pages.length, markBookRead]);

  // ── SPEECH ─────────────────────────────────────────────────────────
  const toggleSpeech = useCallback(async () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      let text = "";
      if (readingMode === "swipe" && pages[currentPage]) {
        text = pages[currentPage].map((p) => p.text).join(" ");
      } else {
        text = book?.content?.substring(0, 3000) || "";
      }
      Speech.speak(text, {
        voice: selectedVoice,
        rate: speechRate,
        pitch: 1.0,
        onDone: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    }
  }, [isSpeaking, readingMode, pages, currentPage, book, selectedVoice, speechRate]);

  // ── RENDER PARAGRAPH ───────────────────────────────────────────────
  const renderParagraph = useCallback((p: Paragraph, key: string) => {
    const fontFamily = currentFont.family as any;

    if (p.type === "chapter") {
      return (
        <View key={key} style={styles.chapterBreakWrapper}>
          <View style={[styles.chapterLineTop, { backgroundColor: theme.accent + "60" }]} />
          <View style={styles.chapterInner}>
            <Text style={[styles.chapterOrnament, { color: theme.accent }]}>✦</Text>
            <Text style={[styles.chapterHeading, {
              color: theme.accent, fontFamily,
              letterSpacing: p.text.length < 20 ? 6 : 2,
            }]}>
              {p.text.toUpperCase()}
            </Text>
            <View style={[styles.chapterDivider, { backgroundColor: theme.accent }]} />
          </View>
          <View style={{ height: 32 }} />
        </View>
      );
    }

    if (p.type === "sub_heading") {
      return (
        <Text key={key} style={[styles.subHeading, {
          color: theme.accent, fontFamily, fontSize: fontSize + 2,
        }]}>
          {p.text}
        </Text>
      );
    }

    if (p.type === "section_break") {
      return (
        <View key={key} style={styles.sectionBreak}>
          <Text style={[styles.sectionBreakText, { color: theme.text + "50" }]}>✦ ✦ ✦</Text>
        </View>
      );
    }

    return (
      <Text key={key} style={[styles.bodyParagraph, {
        color: theme.text, fontSize,
        textAlign: alignment,
        lineHeight: fontSize * lineSpacing,
        fontFamily,
      }]}>
        {"      "}{p.text}
      </Text>
    );
  }, [theme, fontSize, alignment, lineSpacing, currentFont]);

  // ── SWIPE PAGE RENDER ──────────────────────────────────────────────
  const renderSwipePage = useCallback(({ item, index }: { item: Paragraph[]; index: number }) => (
    <Pressable
      style={[styles.swipePage, { backgroundColor: theme.bg }]}
      onPress={toggleControls}
    >
      {item[0]?.type === "chapter" && (
        <View style={[styles.pageChapterTag, { borderColor: theme.accent + "40" }]}>
          <Text style={[styles.pageChapterTagTxt, { color: theme.accent }]}>NEW CHAPTER</Text>
        </View>
      )}

      {/* ✅ FIX: Content area with proper bottom padding so last line is visible */}
      <View style={styles.swipeContent}>
        {item.map((p, i) => renderParagraph(p, `pg${index}-p${i}`))}
      </View>

      {/* ✅ FIX: Page number pinned at bottom, always visible */}
      <View style={[styles.pageNumRow, { borderTopColor: theme.accent + "20" }]}>
        <View style={[styles.pageNumLine, { backgroundColor: theme.accent + "30" }]} />
        <Text style={[styles.pageNumTxt, { color: theme.accent }]}>
          {index + 1} / {pages.length}
        </Text>
        <View style={[styles.pageNumLine, { backgroundColor: theme.accent + "30" }]} />
      </View>
    </Pressable>
  ), [theme, pages.length, renderParagraph, toggleControls]);

  // ── LOADING ────────────────────────────────────────────────────────
  if (loading) return (
    <View style={[styles.loadingScreen, { backgroundColor: theme.bg }]}>
      <ActivityIndicator size="large" color="#FFD700" />
      <Text style={styles.loadingText}>LOADING MANUSCRIPT...</Text>
    </View>
  );

  // ── RENDER ─────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar hidden={!showControls} barStyle={theme.isDark ? "light-content" : "dark-content"} />

      {/* ── TOP BAR ── */}
      <Animated.View
        style={[styles.topBar, { backgroundColor: theme.ui, opacity: fadeAnim }]}
        pointerEvents={showControls ? "auto" : "none"}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={theme.accent} />
        </TouchableOpacity>
        <Text style={[styles.bookTitleHeader, { color: theme.text }]} numberOfLines={1}>
          {book?.title}
        </Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.push(`/book/${bookId}/dictionary`)}
        >
          <MaterialCommunityIcons name="book-alphabet" size={24} color={theme.accent} />
        </TouchableOpacity>
      </Animated.View>

      {/* ── PROGRESS BAR ── */}
      <View style={[styles.progressTrack, { top: showControls ? 95 : 0 }]}>
        <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: theme.accent }]} />
      </View>

      {/* ── READING CONTENT ── */}
      {readingMode === "scroll" ? (
        <ScrollView
          style={{ flex: 1 }}
          // ✅ FIX: paddingBottom increased so last line never hides behind bottom panel
          contentContainerStyle={[styles.scrollContent, { paddingTop: 110 }]}
          onScroll={handleScrollProgress}
          scrollEventThrottle={32}
          showsVerticalScrollIndicator={false}
          onTouchEnd={toggleControls}
        >
          {/* Book header */}
          <View style={styles.bookHeader}>
            {book?.displayCover ? (
              <Image source={{ uri: book.displayCover }} style={styles.heroCover} />
            ) : (
              <View style={[styles.placeholderCover, { backgroundColor: theme.ui }]}>
                <MaterialCommunityIcons name="book-open-page-variant" size={60} color={theme.accent} />
              </View>
            )}
            <Text style={[styles.heroTitle, { color: theme.text }]}>{book?.title}</Text>
            <Text style={[styles.heroAuthor, { color: theme.text + "70" }]}>
              by {book?.displayAuthor}
            </Text>
            <View style={[styles.openingOrnament, { backgroundColor: theme.accent + "40" }]} />
          </View>

          {paragraphs.map((p, i) => renderParagraph(p, `line-${i}`))}

          {/* ✅ FIX: Page number shown at bottom of scroll mode too */}
          <View style={[styles.scrollPageNumRow, { borderTopColor: theme.accent + "20" }]}>
            <View style={[styles.pageNumLine, { backgroundColor: theme.accent + "30" }]} />
            <Text style={[styles.pageNumTxt, { color: theme.accent }]}>
              Page {scrollPageNum} of {totalScrollPages}
            </Text>
            <View style={[styles.pageNumLine, { backgroundColor: theme.accent + "30" }]} />
          </View>

          {/* ✅ FIX: Extra space at bottom so last line clears the bottom panel */}
          <View style={{ height: 220 }} />
        </ScrollView>
      ) : (
        <FlatList
          ref={flatListRef}
          data={pages}
          renderItem={renderSwipePage}
          keyExtractor={(_, i) => `page-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / width);
            handlePageChange(index);
          }}
          getItemLayout={(_, index) => ({
            length: width, offset: width * index, index,
          })}
          style={{ flex: 1, marginTop: 50 }}
          decelerationRate="fast"
          snapToInterval={width}
          snapToAlignment="start"
          scrollEnabled
        />
      )}

      {/* ── BOTTOM PANEL ── */}
      <Animated.View
        style={[styles.bottomPanel, { backgroundColor: theme.ui, opacity: fadeAnim }]}
        pointerEvents={showControls ? "auto" : "none"}
      >
        {/* NAV TABS */}
        <View style={styles.navTabs}>
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => router.push(`/book/${bookId}/findings`)}
          >
            <Feather name="search" size={20} color={theme.accent} />
            <Text style={[styles.tabLabel, { color: theme.uiText }]}>FINDINGS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => setReadingMode(readingMode === "scroll" ? "swipe" : "scroll")}
          >
            <MaterialCommunityIcons
              name={readingMode === "scroll" ? "book-open-page-variant" : "format-align-left"}
              size={20} color={theme.accent}
            />
            <Text style={[styles.tabLabel, { color: theme.uiText }]}>
              {readingMode === "scroll" ? "PAGES" : "SCROLL"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => router.push({ pathname: "/book/[id]/chapters", params: { id: bookId } })}
          >
            <MaterialCommunityIcons name="format-list-bulleted" size={20} color={theme.accent} />
            <Text style={[styles.tabLabel, { color: theme.uiText }]}>CHAPTERS</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabItem} onPress={() => setShowVoicePanel(true)}>
            <FontAwesome5
              name={isSpeaking ? "stop-circle" : "headphones-alt"}
              size={18}
              color={isSpeaking ? "#FF4444" : theme.accent}
            />
            <Text style={[styles.tabLabel, { color: isSpeaking ? "#FF4444" : theme.uiText }]}>
              {isSpeaking ? "STOP" : "VOICE"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabItem} onPress={() => setShowFontPanel(true)}>
            <MaterialCommunityIcons name="format-font" size={20} color={theme.accent} />
            <Text style={[styles.tabLabel, { color: theme.uiText }]}>FONT</Text>
          </TouchableOpacity>
        </View>

        {/* FONT SIZE + SPACING + ALIGNMENT */}
        <View style={styles.controlRow}>
          <TouchableOpacity
            style={[styles.sizeBtn, { backgroundColor: theme.bg }]}
            onPress={() => setFontSize((s) => Math.max(12, s - 1))}
          >
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: "900" }}>A−</Text>
          </TouchableOpacity>

          <View style={[styles.alignRow, { borderColor: theme.accent + "30", backgroundColor: theme.bg }]}>
            {(["left", "center", "justify"] as const).map((a) => (
              <TouchableOpacity key={a} onPress={() => setAlignment(a)} style={styles.alignBtn}>
                <MaterialCommunityIcons
                  name={`format-align-${a}` as any}
                  size={18}
                  color={alignment === a ? theme.accent : theme.text + "40"}
                />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.sizeBtn, { backgroundColor: theme.bg }]}
            onPress={() => setLineSpacing((s) => s >= 2.5 ? 1.5 : s + 0.25)}
          >
            <MaterialCommunityIcons name="format-line-spacing" size={18} color={theme.accent} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sizeBtn, { backgroundColor: theme.bg }]}
            onPress={() => setFontSize((s) => Math.min(36, s + 1))}
          >
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: "900" }}>A+</Text>
          </TouchableOpacity>
        </View>

        {/* THEMES + WEAVE */}
        <View style={styles.footerRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.themePaletteScroll}>
            {Object.values(THEMES).map((t) => (
              <TouchableOpacity
                key={t.name}
                onPress={() => setTheme(t)}
                style={[styles.themeDot, {
                  backgroundColor: t.bg,
                  borderWidth: theme.name === t.name ? 3 : 1,
                  borderColor: theme.name === t.name ? theme.accent : "#444",
                }]}
              />
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.weaveBtn, { backgroundColor: theme.accent }]}
            onPress={() => router.push({ pathname: "/weave/create", params: { bookId } })}
          >
            <MaterialCommunityIcons name="fountain-pen-tip" size={18} color="#000" />
            <Text style={styles.weaveBtnText}>WEAVE</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── FONT PANEL MODAL ── */}
      <Modal visible={showFontPanel} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowFontPanel(false)}>
          <View style={[styles.modalSheet, { backgroundColor: theme.ui }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: theme.accent }]}>FONT & STYLE</Text>

            <Text style={[styles.modalSection, { color: theme.uiText }]}>TYPEFACE</Text>
            <View style={styles.fontGrid}>
              {FONTS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.fontPill, {
                    backgroundColor: fontKey === f.key ? theme.accent : theme.bg,
                    borderColor: fontKey === f.key ? theme.accent : theme.accent + "30",
                  }]}
                  onPress={() => setFontKey(f.key)}
                >
                  <Text style={[styles.fontPillTxt, {
                    color: fontKey === f.key ? "#000" : theme.text,
                    fontFamily: f.family as any,
                  }]}>
                    {f.label}
                  </Text>
                  <Text style={[styles.fontPillPreview, {
                    color: fontKey === f.key ? "#00000080" : theme.text + "60",
                    fontFamily: f.family as any,
                  }]}>
                    Aa Bb
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalSection, { color: theme.uiText }]}>SIZE — {fontSize}pt</Text>
            <View style={styles.sizeRow}>
              {[12, 14, 16, 18, 20, 22, 24, 26, 28].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sizePill, {
                    backgroundColor: fontSize === s ? theme.accent : theme.bg,
                    borderColor: fontSize === s ? theme.accent : theme.accent + "20",
                  }]}
                  onPress={() => setFontSize(s)}
                >
                  <Text style={[styles.sizePillTxt, { color: fontSize === s ? "#000" : theme.text }]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalSection, { color: theme.uiText }]}>LINE SPACING</Text>
            <View style={styles.sizeRow}>
              {[1.5, 1.75, 2.0, 2.25, 2.5].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sizePill, {
                    backgroundColor: lineSpacing === s ? theme.accent : theme.bg,
                    borderColor: lineSpacing === s ? theme.accent : theme.accent + "20",
                    minWidth: 52,
                  }]}
                  onPress={() => setLineSpacing(s)}
                >
                  <Text style={[styles.sizePillTxt, { color: lineSpacing === s ? "#000" : theme.text }]}>
                    {s}×
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.fontPreviewBox, { backgroundColor: theme.bg }]}>
              <Text style={[styles.fontPreviewTxt, {
                color: theme.text, fontSize,
                lineHeight: fontSize * lineSpacing,
                fontFamily: currentFont.family as any,
                textAlign: alignment,
              }]}>
                {"      "}The light fell in long golden bars through the tall windows,
                and the dust motes danced as if they had nowhere else to be.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: theme.accent }]}
              onPress={() => setShowFontPanel(false)}
            >
              <Text style={styles.doneBtnTxt}>DONE</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── VOICE PANEL MODAL ── */}
      <Modal visible={showVoicePanel} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowVoicePanel(false)}>
          <View style={[styles.modalSheet, { backgroundColor: theme.ui }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: theme.accent }]}>VOICE READER</Text>

            <TouchableOpacity
              style={[styles.voicePlayBtn, { backgroundColor: isSpeaking ? "#FF4444" : theme.accent }]}
              onPress={() => { toggleSpeech(); }}
            >
              <FontAwesome5 name={isSpeaking ? "stop-circle" : "play-circle"} size={22} color="#000" />
              <Text style={styles.voicePlayBtnTxt}>
                {isSpeaking ? "STOP READING" : "START READING"}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.modalSection, { color: theme.uiText }]}>READING SPEED</Text>
            <View style={styles.sizeRow}>
              {[
                { label: "Slow", val: 0.6 },
                { label: "Normal", val: 0.9 },
                { label: "Fast", val: 1.2 },
                { label: "Very Fast", val: 1.5 },
              ].map((s) => (
                <TouchableOpacity
                  key={s.val}
                  style={[styles.sizePill, {
                    backgroundColor: speechRate === s.val ? theme.accent : theme.bg,
                    borderColor: speechRate === s.val ? theme.accent : theme.accent + "20",
                    minWidth: 64,
                  }]}
                  onPress={() => setSpeechRate(s.val)}
                >
                  <Text style={[styles.sizePillTxt, { color: speechRate === s.val ? "#000" : theme.text }]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {availableVoices.length > 1 && (
              <>
                <Text style={[styles.modalSection, { color: theme.uiText }]}>
                  VOICE ({availableVoices.length} available)
                </Text>
                <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                  {availableVoices.slice(0, 20).map((v) => (
                    <TouchableOpacity
                      key={v.identifier}
                      style={[styles.voiceRow, {
                        backgroundColor: selectedVoice === v.identifier ? theme.accent + "20" : "transparent",
                        borderColor: selectedVoice === v.identifier ? theme.accent : theme.accent + "15",
                      }]}
                      onPress={() => setSelectedVoice(v.identifier)}
                    >
                      <View style={[styles.voiceCheck, {
                        backgroundColor: selectedVoice === v.identifier ? theme.accent : "transparent",
                        borderColor: theme.accent,
                      }]}>
                        {selectedVoice === v.identifier && (
                          <Ionicons name="checkmark" size={10} color="#000" />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.voiceName, { color: theme.text }]}>
                          {v.name || v.identifier}
                        </Text>
                        <Text style={[styles.voiceLang, { color: theme.uiText }]}>
                          {v.language || "English"}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          Speech.stop();
                          Speech.speak("Hello, I will be reading this book for you.", {
                            voice: v.identifier, rate: speechRate,
                          });
                        }}
                      >
                        <Text style={[styles.voicePreviewBtn, { color: theme.accent }]}>Preview</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: theme.accent }]}
              onPress={() => setShowVoicePanel(false)}
            >
              <Text style={styles.doneBtnTxt}>DONE</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingScreen: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#FFD700", marginTop: 20, fontWeight: "900", letterSpacing: 3, fontSize: 10 },

  topBar: {
    position: "absolute", top: 0, left: 0, right: 0, height: 95,
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12, zIndex: 100,
  },
  iconBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  bookTitleHeader: {
    flex: 1, textAlign: "center", fontSize: 11, fontWeight: "900",
    textTransform: "uppercase", letterSpacing: 2,
  },

  progressTrack: {
    position: "absolute", left: 0, right: 0, height: 2,
    backgroundColor: "rgba(255,255,255,0.05)", zIndex: 100,
  },
  progressFill: { height: "100%" },

  // ✅ FIX: paddingBottom is now 240 to clear the bottom panel fully
  scrollContent: { paddingHorizontal: 26, paddingBottom: 240 },

  bookHeader: { alignItems: "center", paddingVertical: 60, paddingBottom: 50 },
  heroCover: {
    width: 160, height: 240, borderRadius: 14, marginBottom: 24,
    borderWidth: 1, borderColor: "rgba(255,215,0,0.3)",
  },
  placeholderCover: {
    width: 160, height: 240, borderRadius: 14,
    marginBottom: 24, justifyContent: "center", alignItems: "center",
  },
  heroTitle: { fontSize: 26, fontWeight: "900", textAlign: "center", marginBottom: 8 },
  heroAuthor: { fontSize: 12, letterSpacing: 3, textAlign: "center" },
  openingOrnament: { width: 60, height: 1, marginTop: 32, borderRadius: 1 },

  bodyParagraph: { marginBottom: 20 },

  chapterBreakWrapper: { marginTop: 20, marginBottom: 10, alignItems: "center" },
  chapterLineTop: { width: "40%", height: 1, marginBottom: 28 },
  chapterInner: { alignItems: "center", gap: 12 },
  chapterOrnament: { fontSize: 18, opacity: 0.8 },
  chapterHeading: {
    fontSize: 18, fontWeight: "900", textAlign: "center",
    letterSpacing: 4, textTransform: "uppercase",
  },
  chapterDivider: { width: 50, height: 2, borderRadius: 1, marginTop: 4 },

  subHeading: {
    fontWeight: "800", marginVertical: 24,
    textAlign: "center", letterSpacing: 1,
  },

  sectionBreak: { alignItems: "center", marginVertical: 36 },
  sectionBreakText: { fontSize: 16, letterSpacing: 8 },

  // ✅ FIX: swipePage uses flex layout so page number stays at bottom
  swipePage: {
    width,
    height: height,
    paddingHorizontal: 26,
    paddingTop: 70,
    paddingBottom: 180,
  },
  // ✅ FIX: content area grows to fill space, pushes page number down
  swipeContent: {
    flexGrow: 1,
  },
  pageChapterTag: {
    alignSelf: "center", marginBottom: 24, paddingHorizontal: 16,
    paddingVertical: 6, borderWidth: 1, borderRadius: 20,
  },
  pageChapterTagTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 3 },

  // ✅ FIX: page number row properly visible with border and padding
  pageNumRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 14, paddingHorizontal: 4,
    borderTopWidth: 1, borderTopColor: "rgba(255,215,0,0.2)",
    position: "absolute", bottom: 190, left: 26, right: 26,
  },
  // ✅ FIX: scroll mode page number at bottom of content
  scrollPageNumRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 20, paddingHorizontal: 4,
    borderTopWidth: 1, marginTop: 20,
  },
  pageNumLine: { flex: 1, height: 1 },
  pageNumTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 2 },

  bottomPanel: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 20, zIndex: 100,
  },
  navTabs: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  tabItem: { alignItems: "center", flex: 1 },
  tabLabel: { fontSize: 7, fontWeight: "900", marginTop: 5, letterSpacing: 0.5 },

  controlRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 16, gap: 8,
  },
  sizeBtn: {
    width: 42, height: 42, justifyContent: "center",
    alignItems: "center", borderRadius: 12,
  },
  alignRow: {
    flexDirection: "row", gap: 4, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, flex: 1,
    justifyContent: "space-around",
  },
  alignBtn: { padding: 4 },

  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  themePaletteScroll: { flex: 1 },
  themeDot: { width: 28, height: 28, borderRadius: 14, marginRight: 8 },
  weaveBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18,
  },
  weaveBtnText: { color: "#000", fontWeight: "900", fontSize: 10, letterSpacing: 1.5 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 20 },
  modalTitle: { fontSize: 14, fontWeight: "900", letterSpacing: 3, marginBottom: 20 },
  modalSection: { fontSize: 9, fontWeight: "900", letterSpacing: 2, marginBottom: 10, marginTop: 16 },

  fontGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  fontPill: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, minWidth: (width - 80) / 2 - 5, alignItems: "center" },
  fontPillTxt: { fontSize: 14, fontWeight: "700" },
  fontPillPreview: { fontSize: 11, marginTop: 4 },

  sizeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sizePill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  sizePillTxt: { fontSize: 11, fontWeight: "700" },

  fontPreviewBox: { borderRadius: 14, padding: 18, marginTop: 20, marginBottom: 20, minHeight: 80 },
  fontPreviewTxt: { lineHeight: 26 },

  doneBtn: { borderRadius: 16, padding: 16, alignItems: "center" },
  doneBtnTxt: { color: "#000", fontWeight: "900", fontSize: 13, letterSpacing: 2 },

  voicePlayBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, borderRadius: 16, marginBottom: 4 },
  voicePlayBtnTxt: { color: "#000", fontWeight: "900", fontSize: 14 },
  voiceRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, marginBottom: 6, borderWidth: 1 },
  voiceCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, justifyContent: "center", alignItems: "center" },
  voiceName: { fontSize: 13, fontWeight: "700" },
  voiceLang: { fontSize: 10, marginTop: 2 },
  voicePreviewBtn: { fontSize: 11, fontWeight: "700" },
});