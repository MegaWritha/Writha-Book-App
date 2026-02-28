import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  FlatList, Dimensions, Animated, Platform, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

// ── THEMES ───────────────────────────────────────────────────────────────
const DARK_THEME = {
  mode:        "dark"  as const,
  bg:          "#0D0D0D",
  ui:          "#1A1A1A",
  ui2:         "#2A2A2A",
  accent:      "#FFD700",
  accentDim:   "rgba(255,215,0,0.08)",
  purple:      "#6D28D9",
  purpleLight: "#A78BFA",
  text:        "#E8E4DC",
  textMuted:   "#6B6B6B",
  green:       "#22C55E",
  red:         "#EF4444",
  blue:        "#38BDF8",
  statusBar:   "light-content" as const,
};

const LIGHT_THEME = {
  mode:        "light" as const,
  bg:          "#F5F0E8",
  ui:          "#EDE8DC",
  ui2:         "#DDD8CC",
  accent:      "#6D28D9",
  accentDim:   "rgba(109,40,217,0.08)",
  purple:      "#6D28D9",
  purpleLight: "#A78BFA",
  text:        "#1A1A1A",
  textMuted:   "#6B6B6B",
  green:       "#16A34A",
  red:         "#DC2626",
  blue:        "#0284C7",
  statusBar:   "dark-content" as const,
};

// ── PARAGRAPH TYPES ──────────────────────────────────────────────────────
type ParaType = "chapter" | "subheading" | "body" | "dialogue" | "section_break" | "blank";

interface Paragraph {
  text:    string;
  type:    ParaType;
  index:   number;
}

interface Page {
  paragraphs: Paragraph[];
  pageNumber: number;
}

// ── CLASSIFY PARAGRAPH ───────────────────────────────────────────────────
const classifyParagraph = (text: string, index: number): Paragraph => {
  const trimmed = text.trim();

  if (!trimmed) return { text: "", type: "blank", index };

  // Section break
  if (/^[✦◆•\-*=_]{3,}$/.test(trimmed)) {
    return { text: trimmed, type: "section_break", index };
  }

  // Chapter heading
  if (
    /^chapter\s+\d+/i.test(trimmed) ||
    /^chapter\s+[ivxlcdm]+/i.test(trimmed) ||
    (trimmed.length < 60 && trimmed === trimmed.toUpperCase() && /[A-Z]{3,}/.test(trimmed))
  ) {
    return { text: trimmed, type: "chapter", index };
  }

  // Subheading
  const words = trimmed.split(" ");
  const capWords = words.filter(w => w.length > 0 && w[0] === w[0].toUpperCase()).length;
  if (trimmed.length < 80 && words.length >= 2 && capWords / words.length > 0.7 && !trimmed.endsWith(".")) {
    return { text: trimmed, type: "subheading", index };
  }

  // Dialogue
  if (
    (trimmed.startsWith('"') || trimmed.startsWith("\u201C") || trimmed.startsWith("—") || trimmed.startsWith("-")) &&
    trimmed.length < 300
  ) {
    return { text: trimmed, type: "dialogue", index };
  }

  return { text: trimmed, type: "body", index };
};

// ── BUILD PAGES ──────────────────────────────────────────────────────────
const buildPages = (content: string, fontSize: number): Page[] => {
  const lines      = content.split("\n");
  const paragraphs = lines
    .map((line, i) => classifyParagraph(line, i))
    .filter(p => p.type !== "blank" || true);

  const pages: Page[]    = [];
  let   currentPage: Paragraph[] = [];
  let   visualWeight             = 0;
  const linesPerPage             = Math.round(28 - (fontSize - 16) * 0.8);

  const weightMap: Record<ParaType, number> = {
    chapter:       8,
    subheading:    4,
    body:          2,
    dialogue:      1.5,
    section_break: 2,
    blank:         1,
  };

  paragraphs.forEach((para) => {
    const weight = weightMap[para.type] || 2;

    // Chapters always start a new page
    if (para.type === "chapter" && currentPage.length > 0) {
      pages.push({ paragraphs: currentPage, pageNumber: pages.length + 1 });
      currentPage  = [];
      visualWeight = 0;
    }

    if (visualWeight + weight > linesPerPage && currentPage.length > 0) {
      pages.push({ paragraphs: currentPage, pageNumber: pages.length + 1 });
      currentPage  = [];
      visualWeight = 0;
    }

    currentPage.push(para);
    visualWeight += weight;
  });

  if (currentPage.length > 0) {
    pages.push({ paragraphs: currentPage, pageNumber: pages.length + 1 });
  }

  return pages.length > 0 ? pages : [{ paragraphs: [], pageNumber: 1 }];
};

export default function PreviewScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const params  = useLocalSearchParams();

  // ── THEME ────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(true);
  const T = isDark ? DARK_THEME : LIGHT_THEME;
  const s = makeStyles(T);

  // ── DATA ─────────────────────────────────────────────────────────
  const title      = String(params.title      || "Untitled");
  const authorName = String(params.authorName || "Unknown Author");
  const genre      = String(params.genre      || "");
  const content    = (global as any).__manuscriptContent || "";

  // ── READER STATE ─────────────────────────────────────────────────
  const [fontSize,     setFontSize]     = useState(16);
  const [currentPage,  setCurrentPage]  = useState(0);
  const [pages,        setPages]        = useState<Page[]>([]);
  const [showControls, setShowControls] = useState(true);
  const [mode,         setMode]         = useState<"swipe" | "scroll">("swipe");

  const flatListRef   = useRef<FlatList>(null);
  const controlsAnim  = useRef(new Animated.Value(1)).current;
  const headerAnim    = useRef(new Animated.Value(0)).current;

  // ── BUILD PAGES ON FONT CHANGE ───────────────────────────────────
  useEffect(() => {
    if (!content) return;
    const built = buildPages(content, fontSize);
    setPages(built);
    setCurrentPage(0);
  }, [content, fontSize]);

  // ── ANIMATE HEADER IN ────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1, duration: 500, useNativeDriver: true,
    }).start();
  }, []);

  // ── TOGGLE CONTROLS ──────────────────────────────────────────────
  const toggleControls = () => {
    Animated.timing(controlsAnim, {
      toValue:  showControls ? 0 : 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
    setShowControls(!showControls);
  };

  // ── RENDER PARAGRAPH ─────────────────────────────────────────────
  const renderParagraph = (para: Paragraph, pageIdx: number) => {
    if (para.type === "blank") return <View key={para.index} style={{ height: 8 }} />;

    if (para.type === "section_break") {
      return (
        <View key={para.index} style={s.sectionBreak}>
          <Text style={[s.sectionBreakTxt, { color: T.textMuted }]}>◆ ✦ ◆</Text>
        </View>
      );
    }

    if (para.type === "chapter") {
      return (
        <View key={para.index} style={s.chapterWrap}>
          <View style={[s.chapterLine, { backgroundColor: T.accent }]} />
          <Text style={[s.chapterTxt, { color: T.accent, fontSize: fontSize + 4 }]}>
            {para.text}
          </Text>
          <View style={[s.chapterLine, { backgroundColor: T.accent }]} />
        </View>
      );
    }

    if (para.type === "subheading") {
      return (
        <Text key={para.index} style={[s.subheadingTxt, {
          color:    T.text,
          fontSize: fontSize + 1,
        }]}>
          {para.text}
        </Text>
      );
    }

    if (para.type === "dialogue") {
      return (
        <View key={para.index} style={[s.dialogueWrap, { borderLeftColor: T.accent + "40" }]}>
          <Text style={[s.dialogueTxt, {
            color:    T.text,
            fontSize: fontSize,
          }]}>
            {para.text}
          </Text>
        </View>
      );
    }

    // Body
    return (
      <Text key={para.index} style={[s.bodyTxt, {
        color:      T.text,
        fontSize:   fontSize,
        lineHeight: fontSize * 1.8,
      }]}>
        {"    "}{para.text}
      </Text>
    );
  };

  // ── RENDER PAGE (SWIPE MODE) ─────────────────────────────────────
  const renderPage = ({ item, index }: { item: Page; index: number }) => (
    <TouchableOpacity
      activeOpacity={1}
      onPress={toggleControls}
      style={[s.page, { backgroundColor: T.bg }]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.pageContent}
      >
        {item.paragraphs.map((para) => renderParagraph(para, index))}
      </ScrollView>

      {/* Page number */}
      <Text style={[s.pageNumber, { color: T.textMuted }]}>
        {item.pageNumber} / {pages.length}
      </Text>
    </TouchableOpacity>
  );

  const progress = pages.length > 0 ? ((currentPage + 1) / pages.length) * 100 : 0;

  return (
    <View style={[s.container, { backgroundColor: T.bg }]}>
      <StatusBar barStyle={T.statusBar} />

      {/* TOP BAR */}
      <Animated.View style={[
        s.topBar,
        {
          paddingTop: insets.top + 10,
          opacity:    controlsAnim,
          transform:  [{ translateY: controlsAnim.interpolate({
            inputRange:  [0, 1],
            outputRange: [-60, 0],
          }) }],
        },
      ]}>
        <LinearGradient
          colors={T.mode === "dark"
            ? ["rgba(13,13,13,0.98)", "transparent"]
            : ["rgba(245,240,232,0.98)", "transparent"]}
          style={s.topBarGradient}
        >
          <View style={s.topBarInner}>
            <TouchableOpacity style={s.topBarBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={20} color={T.accent} />
            </TouchableOpacity>

            <View style={s.topBarCenter}>
              <Text style={[s.topBarTitle, { color: T.text }]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={[s.topBarSub, { color: T.textMuted }]}>
                Preview Mode
              </Text>
            </View>

            <TouchableOpacity style={s.topBarBtn} onPress={() => setIsDark(!isDark)}>
              <Ionicons
                name={isDark ? "sunny-outline" : "moon-outline"}
                size={18}
                color={T.accent}
              />
            </TouchableOpacity>
          </View>

          {/* Progress bar */}
          <View style={[s.progressTrack, { backgroundColor: T.ui2 }]}>
            <View style={[s.progressFill, {
              width:           `${progress}%`,
              backgroundColor: T.accent,
            }]} />
          </View>
        </LinearGradient>
      </Animated.View>

      {/* CONTENT */}
      {content ? (
        mode === "swipe" ? (
          <FlatList
            ref={flatListRef}
            data={pages}
            keyExtractor={(_, i) => i.toString()}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            renderItem={renderPage}
            onMomentumScrollEnd={(e) => {
              const page = Math.round(e.nativeEvent.contentOffset.x / width);
              setCurrentPage(page);
            }}
          />
        ) : (
          <TouchableOpacity
            activeOpacity={1}
            onPress={toggleControls}
            style={{ flex: 1 }}
          >
            <FlatList
              data={pages}
              keyExtractor={(_, i) => i.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingTop: 80, paddingBottom: 100 }}
              renderItem={({ item, index }) => (
                <View style={[s.scrollPage, { backgroundColor: T.bg }]}>
                  {item.paragraphs.map((para) => renderParagraph(para, index))}
                  <View style={[s.pageDivider, { borderTopColor: T.ui2 }]} />
                </View>
              )}
            />
          </TouchableOpacity>
        )
      ) : (
        // No content fallback
        <View style={s.noContent}>
          <Ionicons name="document-outline" size={48} color={T.textMuted} />
          <Text style={[s.noContentTxt, { color: T.textMuted }]}>
            No content to preview.{"\n"}Go back and upload your manuscript.
          </Text>
        </View>
      )}

      {/* BOTTOM BAR */}
      <Animated.View style={[
        s.bottomBar,
        {
          paddingBottom: insets.bottom + 10,
          opacity:       controlsAnim,
          transform:     [{ translateY: controlsAnim.interpolate({
            inputRange:  [0, 1],
            outputRange: [80, 0],
          }) }],
        },
      ]}>
        <LinearGradient
          colors={T.mode === "dark"
            ? ["transparent", "rgba(13,13,13,0.98)"]
            : ["transparent", "rgba(245,240,232,0.98)"]}
          style={s.bottomBarGradient}
        >
          <View style={s.bottomBarInner}>

            {/* Font size controls */}
            <View style={s.fontControls}>
              <TouchableOpacity
                style={[s.fontBtn, { backgroundColor: T.ui }]}
                onPress={() => setFontSize(Math.max(12, fontSize - 2))}
              >
                <Text style={[s.fontBtnTxt, { color: T.text }]}>A−</Text>
              </TouchableOpacity>
              <Text style={[s.fontSizeTxt, { color: T.textMuted }]}>{fontSize}px</Text>
              <TouchableOpacity
                style={[s.fontBtn, { backgroundColor: T.ui }]}
                onPress={() => setFontSize(Math.min(28, fontSize + 2))}
              >
                <Text style={[s.fontBtnTxt, { color: T.text }]}>A+</Text>
              </TouchableOpacity>
            </View>

            {/* Mode toggle */}
            <TouchableOpacity
              style={[s.modeBtn, { backgroundColor: T.ui }]}
              onPress={() => setMode(mode === "swipe" ? "scroll" : "swipe")}
            >
              <Ionicons
                name={mode === "swipe" ? "swap-horizontal" : "reorder-four"}
                size={16}
                color={T.accent}
              />
              <Text style={[s.modeBtnTxt, { color: T.accent }]}>
                {mode === "swipe" ? "Swipe" : "Scroll"}
              </Text>
            </TouchableOpacity>

            {/* Theme toggle */}
            <TouchableOpacity
              style={[s.modeBtn, { backgroundColor: T.ui }]}
              onPress={() => setIsDark(!isDark)}
            >
              <Ionicons
                name={isDark ? "sunny-outline" : "moon-outline"}
                size={16}
                color={T.accent}
              />
              <Text style={[s.modeBtnTxt, { color: T.accent }]}>
                {isDark ? "Light" : "Dark"}
              </Text>
            </TouchableOpacity>

            {/* Done button */}
            <TouchableOpacity
              style={[s.doneBtn, { backgroundColor: T.accent }]}
              onPress={() => router.back()}
            >
              <Ionicons name="checkmark" size={16} color="#000" />
              <Text style={s.doneBtnTxt}>LOOKS GOOD</Text>
            </TouchableOpacity>

          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const makeStyles = (T: typeof DARK_THEME | typeof LIGHT_THEME) => StyleSheet.create({
  container:          { flex: 1 },
  topBar:             { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  topBarGradient:     { paddingBottom: 20 },
  topBarInner:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10, gap: 12 },
  topBarBtn:          { width: 36, height: 36, borderRadius: 10, backgroundColor: T.ui + "CC", justifyContent: "center", alignItems: "center" },
  topBarCenter:       { flex: 1, alignItems: "center" },
  topBarTitle:        { fontSize: 14, fontWeight: "900" },
  topBarSub:          { fontSize: 10, marginTop: 1 },
  progressTrack:      { height: 2, marginHorizontal: 16, borderRadius: 1, overflow: "hidden" },
  progressFill:       { height: "100%", borderRadius: 1 },
  page:               { width, flex: 1 },
  pageContent:        { paddingHorizontal: 24, paddingTop: 100, paddingBottom: 100, gap: 4 },
  pageNumber:         { position: "absolute", bottom: 60, alignSelf: "center", fontSize: 11 },
  scrollPage:         { paddingHorizontal: 24, paddingVertical: 16 },
  pageDivider:        { borderTopWidth: 1, marginTop: 20, marginHorizontal: 40 },
  chapterWrap:        { alignItems: "center", gap: 10, marginVertical: 24 },
  chapterLine:        { width: 40, height: 2, borderRadius: 1 },
  chapterTxt:         { fontWeight: "900", textAlign: "center", letterSpacing: 2 },
  subheadingTxt:      { fontWeight: "800", marginVertical: 8 },
  dialogueWrap:       { borderLeftWidth: 3, paddingLeft: 14, marginVertical: 4 },
  dialogueTxt:        { fontStyle: "italic" },
  bodyTxt:            { marginVertical: 4 },
  sectionBreak:       { alignItems: "center", marginVertical: 20 },
  sectionBreakTxt:    { fontSize: 16, letterSpacing: 8 },
  bottomBar:          { position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10 },
  bottomBarGradient:  { paddingTop: 30 },
  bottomBarInner:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  fontControls:       { flexDirection: "row", alignItems: "center", gap: 6 },
  fontBtn:            { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  fontBtnTxt:         { fontWeight: "900", fontSize: 12 },
  fontSizeTxt:        { fontSize: 10, width: 28, textAlign: "center" },
  modeBtn:            { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  modeBtnTxt:         { fontSize: 11, fontWeight: "800" },
  doneBtn:            { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12 },
  doneBtnTxt:         { color: "#000", fontWeight: "900", fontSize: 12 },
  noContent:          { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 40 },
  noContentTxt:       { fontSize: 14, textAlign: "center", lineHeight: 22 },
});