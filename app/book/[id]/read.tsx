import React, { useRef, useMemo, useCallback, useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, StatusBar, ActivityIndicator, Animated,
  Platform, Image, Easing, FlatList, Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from "@expo/vector-icons";
import { GestureDetector, Gesture, GestureHandlerRootView } from "react-native-gesture-handler";

import { THEMES, Paragraph } from "./types";
import { useReaderSettings }  from "./hooks/useReaderSettings";
import { useReaderBook }      from "./hooks/useReaderBook";
import { useReaderProgress }  from "./hooks/useReaderProgress";
import { useReaderSpeech }    from "./hooks/useReaderSpeech";
import { useBookmarks }       from "./hooks/useBookmarks";
import ParagraphRenderer      from "./components/ParagraphRenderer";
import FontPanel              from "./components/FontPanel";
import VoicePanel             from "./components/VoicePanel";
import BookmarksPanel         from "./components/BookmarksPanel";

const { width } = Dimensions.get("window");

// ─────────────────────────────────────────────────────────────────────────────
// ERROR BOUNDARY — catches crashes and shows a recovery screen
// instead of a blank white crash
// ─────────────────────────────────────────────────────────────────────────────
interface ErrorBoundaryState { hasError: boolean; }
class ReaderErrorBoundary extends React.Component<
  { children: React.ReactNode; onBack: () => void },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={eb.screen}>
          <MaterialCommunityIcons name="book-off-outline" size={52} color="#FFD700" />
          <Text style={eb.title}>Something went wrong</Text>
          <Text style={eb.sub}>The reader ran into an unexpected error.</Text>
          <TouchableOpacity style={eb.btn} onPress={this.props.onBack}>
            <Text style={eb.btnTxt}>GO BACK</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0F071A", justifyContent: "center", alignItems: "center", padding: 32 },
  title:  { color: "#FFD700", fontSize: 18, fontWeight: "900", marginTop: 20, letterSpacing: 2 },
  sub:    { color: "#A78BFA", fontSize: 13, textAlign: "center", marginTop: 10, lineHeight: 20 },
  btn:    { marginTop: 32, backgroundColor: "#FFD700", paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  btnTxt: { color: "#000", fontWeight: "900", fontSize: 13, letterSpacing: 2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT — wraps the inner screen in the error boundary
// ─────────────────────────────────────────────────────────────────────────────
export default function ReaderScreen() {
  const router = useRouter();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ReaderErrorBoundary onBack={() => router.back()}>
        <ReaderInner />
      </ReaderErrorBoundary>
    </GestureHandlerRootView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INNER SCREEN — all logic lives here, wrapped by the boundary above
// ─────────────────────────────────────────────────────────────────────────────
function ReaderInner() {
  const { id, mode } = useLocalSearchParams();
  const router       = useRouter();
  const flatListRef  = useRef<FlatList>(null);

  const bookId        = useMemo(() => (Array.isArray(id) ? id[0] : id) as string, [id]);
  const isOfflineMode = mode === "offline";

  const settings = useReaderSettings();
  const { book, paragraphs, pages, loading } = useReaderBook(bookId, isOfflineMode);
  const prog     = useReaderProgress(bookId, pages.length);
  const speech   = useReaderSpeech(pages, prog.currentPage);
  const bm       = useBookmarks(bookId, prog.currentPage, pages);

  const [readingMode,    setReadingMode]    = useState<"scroll" | "swipe">("scroll");
  const [showControls,   setShowControls]   = useState(true);
  const [showFontPanel,  setShowFontPanel]  = useState(false);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [showBookmarks,  setShowBookmarks]  = useState(false);
  const [bottomH,        setBottomH]        = useState(200);

  const fadeAnim        = useRef(new Animated.Value(1)).current;
  const controlsVisible = useRef(true);

  // ── Controls toggle ───────────────────────────────────────────────────────
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

  // ── FIX: proper tap detection using Gesture API ───────────────────────────
  // replaces the fragile onTouchEnd approach that misfired on Android scrolls
  const tapGesture = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => toggleControls());

  // ── Stop speech when switching pages (FIX: overlap bug) ──────────────────
  const handlePageChangeSafe = useCallback((index: number) => {
    speech.stopSpeech();
    prog.handlePageChange(index);
  }, [speech, prog]);

  // ── Restore saved position in swipe mode ─────────────────────────────────
  useEffect(() => {
    if (prog.savedPage === null || pages.length === 0) return;
    const target = Math.min(prog.savedPage, pages.length - 1);
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: target,
        animated: false,
      });
    }, 300);
  }, [prog.savedPage, pages.length]);

  // ── Safe bookmark navigation with onScrollToIndexFailed guard ─────────────
  const navigateToBookmark = useCallback((page: number) => {
    if (readingMode !== "swipe") return;
    const target = Math.min(page, pages.length - 1);
    try {
      flatListRef.current?.scrollToIndex({ index: target, animated: true });
    } catch {
      // fallback: scroll to offset directly if index fails
      flatListRef.current?.scrollToOffset({ offset: target * width, animated: true });
    }
    prog.handlePageChange(target);
  }, [readingMode, pages.length, prog]);

  // ── Render paragraph ──────────────────────────────────────────────────────
  const renderParagraph = useCallback((p: Paragraph, key: string) => (
    <ParagraphRenderer
          key={key}
          paragraph={p}
          uniqueKey={key}
          theme={settings.theme}
          fontSize={settings.fontSize}
          lineSpacing={settings.lineSpacing}
          alignment={settings.alignment}
          fontFamily={settings.currentFont.family} paragraphGap={0}    />
  ), [settings.theme, settings.fontSize, settings.lineSpacing, settings.alignment, settings.currentFont]);

  // ── Swipe page renderer ───────────────────────────────────────────────────
  const renderSwipePage = useCallback(({ item, index }: { item: Paragraph[]; index: number }) => (
    <Pressable
      style={[
        s.swipePage,
        {
          backgroundColor: settings.theme.bg,
          paddingBottom: bottomH + 20,
          width,
        },
      ]}
      onPress={toggleControls}
    >
      {item[0]?.type === "chapter" && (
        <View style={[s.pageChapterTag, { borderColor: settings.theme.accent + "40" }]}>
          <Text style={[s.pageChapterTagTxt, { color: settings.theme.accent }]}>
            NEW CHAPTER
          </Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
        {item.map((p, i) => renderParagraph(p, `pg${index}-p${i}`))}
      </View>

      <View style={[s.pageNumRow, { borderTopColor: settings.theme.accent + "20" }]}>
        <View style={[s.pageNumLine, { backgroundColor: settings.theme.accent + "30" }]} />
        <Text style={[s.pageNumTxt, { color: settings.theme.accent }]}>
          {index + 1} / {pages.length}
        </Text>
        <View style={[s.pageNumLine, { backgroundColor: settings.theme.accent + "30" }]} />
      </View>
    </Pressable>
  ), [settings.theme, pages.length, renderParagraph, toggleControls, bottomH]);

  // ── Loading screen ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[s.loadingScreen, { backgroundColor: settings.theme.bg }]}>
        <ActivityIndicator size="large" color={settings.theme.accent} />
        <Text style={[s.loadingText, { color: settings.theme.accent }]}>
          LOADING MANUSCRIPT...
        </Text>
      </View>
    );
  }

  const T = settings.theme;

  return (
    <View style={[s.container, { backgroundColor: T.bg }]}>
      <StatusBar
        hidden={!showControls}
        barStyle={T.isDark ? "light-content" : "dark-content"}
      />

      {/* ── TOP BAR ── */}
      {/* FIX: pointerEvents moved inside style — deprecated as a prop */}
      <Animated.View
        style={[
          s.topBar,
          { backgroundColor: T.ui, opacity: fadeAnim },
          { pointerEvents: showControls ? "auto" : "none" },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={T.accent} />
        </TouchableOpacity>

        <Text style={[s.bookTitle, { color: T.text }]} numberOfLines={1}>
          {book?.title}
        </Text>

        <View style={s.topRight}>
          <TouchableOpacity style={s.iconBtn} onPress={() => bm.toggleBookmark()}>
            <Ionicons
              name={bm.isCurrentPageBookmarked ? "bookmark" : "bookmark-outline"}
              size={22}
              color={bm.isCurrentPageBookmarked ? T.accent : T.uiText}
            />
          </TouchableOpacity>
          {bm.bookmarks.length > 0 && (
            <TouchableOpacity style={s.iconBtn} onPress={() => setShowBookmarks(true)}>
              <Ionicons name="bookmarks-outline" size={20} color={T.uiText} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => router.push(`/book/${bookId}/dictionary`)}
          >
            <MaterialCommunityIcons name="book-alphabet" size={22} color={T.accent} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── PROGRESS BAR ── */}
      <View style={[s.progressTrack, { top: showControls ? 95 : 0 }]}>
        <View
          style={[
            s.progressFill,
            // FIX: guard against NaN when progress is 0 or pages is 1
            { width: `${Math.max(0, Math.min(100, prog.progress))}%`, backgroundColor: T.accent },
          ]}
        />
      </View>

      {/* ── CONTENT ── */}
      {readingMode === "scroll" ? (
        // FIX: GestureDetector replaces fragile onTouchEnd for tap detection
        <GestureDetector gesture={tapGesture}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              s.scrollContent,
              { paddingTop: 110, paddingBottom: bottomH + 60 },
            ]}
            onScroll={prog.handleScrollProgress}
            scrollEventThrottle={32}
            showsVerticalScrollIndicator={false}
          >
            {/* Book header */}
            <View style={s.bookHeader}>
              {book?.displayCover ? (
                <Image source={{ uri: book.displayCover }} style={s.heroCover} />
              ) : (
                <View style={[s.placeholderCover, { backgroundColor: T.ui }]}>
                  <MaterialCommunityIcons
                    name="book-open-page-variant" size={60} color={T.accent}
                  />
                </View>
              )}
              <Text style={[s.heroTitle, { color: T.text }]}>{book?.title}</Text>
              <Text style={[s.heroAuthor, { color: T.text + "70" }]}>
                by {book?.displayAuthor}
              </Text>
              <View style={[s.openingLine, { backgroundColor: T.accent + "40" }]} />
            </View>

            {paragraphs.map((p, i) => renderParagraph(p, `line-${i}`))}
          </ScrollView>
        </GestureDetector>
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
            // FIX: stop speech before changing page to prevent overlap
            handlePageChangeSafe(index);
          }}
          getItemLayout={(_, index) => ({
            length: width, offset: width * index, index,
          })}
          style={{ flex: 1, marginTop: 50 }}
          decelerationRate="fast"
          snapToInterval={width}
          snapToAlignment="start"
          // FIX: graceful fallback if index isn't rendered yet
          onScrollToIndexFailed={(info) => {
            const offset = info.index * width;
            flatListRef.current?.scrollToOffset({ offset, animated: false });
          }}
        />
      )}

      {/* ── BOTTOM PANEL ── */}
      {/* FIX: pointerEvents moved inside style */}
      <Animated.View
        style={[
          s.bottomPanel,
          { backgroundColor: T.ui, opacity: fadeAnim },
          { pointerEvents: showControls ? "auto" : "none" },
        ]}
        onLayout={(e) => setBottomH(e.nativeEvent.layout.height)}
      >
        {/* Nav tabs */}
        <View style={s.navTabs}>
          <TouchableOpacity
            style={s.tabItem}
            onPress={() => router.push(`/book/${bookId}/findings`)}
          >
            <Feather name="search" size={20} color={T.accent} />
            <Text style={[s.tabLabel, { color: T.uiText }]}>FINDINGS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.tabItem}
            onPress={() => setReadingMode(readingMode === "scroll" ? "swipe" : "scroll")}
          >
            <MaterialCommunityIcons
              name={readingMode === "scroll" ? "book-open-page-variant" : "format-align-left"}
              size={20}
              color={T.accent}
            />
            <Text style={[s.tabLabel, { color: T.uiText }]}>
              {readingMode === "scroll" ? "PAGES" : "SCROLL"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.tabItem}
            onPress={() =>
              router.push({ pathname: "/book/[id]/chapters", params: { id: bookId } })
            }
          >
            <MaterialCommunityIcons name="format-list-bulleted" size={20} color={T.accent} />
            <Text style={[s.tabLabel, { color: T.uiText }]}>CHAPTERS</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.tabItem} onPress={() => setShowVoicePanel(true)}>
            <FontAwesome5
              name={speech.isSpeaking ? "stop-circle" : "headphones-alt"}
              size={18}
              color={speech.isSpeaking ? "#EF4444" : T.accent}
            />
            <Text style={[s.tabLabel, { color: speech.isSpeaking ? "#EF4444" : T.uiText }]}>
              {speech.isSpeaking ? "STOP" : "VOICE"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.tabItem} onPress={() => setShowFontPanel(true)}>
            <MaterialCommunityIcons name="format-font" size={20} color={T.accent} />
            <Text style={[s.tabLabel, { color: T.uiText }]}>FONT</Text>
          </TouchableOpacity>
        </View>

        {/* Font size + spacing + alignment quick controls */}
        <View style={s.controlRow}>
          <TouchableOpacity
            style={[s.sizeBtn, { backgroundColor: T.bg }]}
            onPress={() => settings.setFontSize(Math.max(12, settings.fontSize - 1))}
          >
            <Text style={{ color: T.text, fontSize: 14, fontWeight: "900" }}>A−</Text>
          </TouchableOpacity>

          <View style={[s.alignRow, { borderColor: T.accent + "30", backgroundColor: T.bg }]}>
            {(["left", "center", "justify"] as const).map((a) => (
              <TouchableOpacity
                key={a}
                onPress={() => settings.setAlignment(a)}
                style={s.alignBtn}
              >
                <MaterialCommunityIcons
                  name={`format-align-${a}` as any}
                  size={18}
                  color={settings.alignment === a ? T.accent : T.text + "40"}
                />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[s.sizeBtn, { backgroundColor: T.bg }]}
            onPress={() =>
              settings.setLineSpacing(
                settings.lineSpacing >= 2.5
                  ? 1.5
                  : parseFloat((settings.lineSpacing + 0.25).toFixed(2))
              )
            }
          >
            <MaterialCommunityIcons name="format-line-spacing" size={18} color={T.accent} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.sizeBtn, { backgroundColor: T.bg }]}
            onPress={() => settings.setFontSize(Math.min(36, settings.fontSize + 1))}
          >
            <Text style={{ color: T.text, fontSize: 18, fontWeight: "900" }}>A+</Text>
          </TouchableOpacity>
        </View>

        {/* Themes + Weave */}
        <View style={s.footerRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            <View style={s.themeRow}>
              {Object.values(THEMES).map((t) => (
                <TouchableOpacity
                  key={t.name}
                  onPress={() => settings.setTheme(t)}
                  style={[
                    s.themeDot,
                    {
                      backgroundColor: t.bg,
                      borderWidth: T.name === t.name ? 3 : 1,
                      borderColor: T.name === t.name ? T.accent : "#444",
                    },
                  ]}
                />
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[s.weaveBtn, { backgroundColor: T.accent }]}
            onPress={() =>
              router.push({ pathname: "/weave/create", params: { bookId } })
            }
          >
            <MaterialCommunityIcons name="fountain-pen-tip" size={18} color="#000" />
            <Text style={s.weaveBtnTxt}>WEAVE</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── MODALS ── */}
      <FontPanel
              visible={showFontPanel}
              onClose={() => setShowFontPanel(false)}
              theme={T}
              fontSize={settings.fontSize}
              lineSpacing={settings.lineSpacing}
              alignment={settings.alignment}
              fontKey={settings.fontKey}
              currentFont={settings.currentFont}
              setFontSize={settings.setFontSize}
              setLineSpacing={settings.setLineSpacing}
              setAlignment={settings.setAlignment}
              setFontKey={settings.setFontKey} margins={0} paragraphGap={0} setMargins={function (n: number): void {
                  throw new Error("Function not implemented.");
              } } setParagraphGap={function (n: number): void {
                  throw new Error("Function not implemented.");
              } } resetToDefaults={function (): void {
                  throw new Error("Function not implemented.");
              } } increaseFontSize={function (): void {
                  throw new Error("Function not implemented.");
              } } decreaseFontSize={function (): void {
                  throw new Error("Function not implemented.");
              } }      />

      <VoicePanel
              visible={showVoicePanel}
              onClose={() => setShowVoicePanel(false)}
              theme={T}
              isSpeaking={speech.isSpeaking}
              speakingPage={speech.speakingPage}
              speechRate={speech.speechRate}
              selectedVoice={speech.selectedVoice}
              availableVoices={speech.availableVoices}
              totalPages={pages.length}
              toggleSpeech={speech.toggleSpeech}
              setSpeechRate={speech.setSpeechRate}
              setSelectedVoice={speech.setSelectedVoice}
              previewVoice={speech.previewVoice} speechPitch={0} currentPage={0} stopSpeech={function (): void {
                  throw new Error("Function not implemented.");
              } } setSpeechPitch={function (p: number): void {
                  throw new Error("Function not implemented.");
              } }      />

      <BookmarksPanel
              visible={showBookmarks}
              onClose={() => setShowBookmarks(false)}
              theme={T}
              bookmarks={bm.bookmarks}
              currentPage={prog.currentPage}
              onNavigate={navigateToBookmark}
              onDelete={bm.deleteBookmark} totalPages={0} onClearAll={function (): void {
                  throw new Error("Function not implemented.");
              } } onColorChange={function (page: number, color: string): void {
                  throw new Error("Function not implemented.");
              } }      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// FIX: all `gap` replaced with explicit margins to support older RN versions
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:        { flex: 1 },
  loadingScreen:    { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText:      { marginTop: 20, fontWeight: "900", letterSpacing: 3, fontSize: 10 },

  topBar: {
    position: "absolute", top: 0, left: 0, right: 0, height: 95,
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12, zIndex: 100,
  },
  iconBtn:   { width: 38, height: 38, justifyContent: "center", alignItems: "center" },
  topRight:  { flexDirection: "row", alignItems: "center" },
  bookTitle: {
    flex: 1, textAlign: "center", fontSize: 11,
    fontWeight: "900", textTransform: "uppercase", letterSpacing: 2,
  },

  progressTrack: {
    position: "absolute", left: 0, right: 0, height: 2,
    backgroundColor: "rgba(255,255,255,0.05)", zIndex: 100,
  },
  progressFill: { height: "100%" },

  scrollContent:    { paddingHorizontal: 26 },
  bookHeader:       { alignItems: "center", paddingTop: 28, paddingBottom: 20 },
  heroCover: {
    width: 148, height: 216, borderRadius: 14, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(255,215,0,0.25)",
  },
  placeholderCover: {
    width: 148, height: 216, borderRadius: 14,
    marginBottom: 16, justifyContent: "center", alignItems: "center",
  },
  heroTitle:  { fontSize: 23, fontWeight: "900", textAlign: "center", marginBottom: 6 },
  heroAuthor: { fontSize: 12, letterSpacing: 3, textAlign: "center" },
  openingLine:{ width: 48, height: 1, marginTop: 18, borderRadius: 1 },

  swipePage: { flex: 1, paddingHorizontal: 26, paddingTop: 60, flexDirection: "column" },
  pageChapterTag: {
    alignSelf: "center", marginBottom: 16,
    paddingHorizontal: 14, paddingVertical: 5,
    borderWidth: 1, borderRadius: 20,
  },
  pageChapterTagTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 3 },
  pageNumRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, borderTopWidth: 1,
  },
  // FIX: gap replaced with marginHorizontal on children
  pageNumLine: { flex: 1, height: 1, marginHorizontal: 5 },
  pageNumTxt:  { fontSize: 9, fontWeight: "900", letterSpacing: 2 },

  bottomPanel: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 24, paddingTop: 18, zIndex: 100,
  },
  navTabs: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  tabItem: { alignItems: "center", flex: 1 },
  tabLabel:{ fontSize: 7, fontWeight: "900", marginTop: 4, letterSpacing: 0.5 },

  controlRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 14,
  },
  sizeBtn: {
    width: 40, height: 40, justifyContent: "center",
    alignItems: "center", borderRadius: 10,
    // FIX: gap replaced — siblings use marginHorizontal in controlRow
    marginHorizontal: 2,
  },
  alignRow: {
    flexDirection: "row", borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: 14, flex: 1, justifyContent: "space-around",
    marginHorizontal: 6,
  },
  alignBtn: { padding: 4 },

  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  // FIX: gap replaced — themeDot uses marginRight instead
  themeRow:  { flexDirection: "row", alignItems: "center" },
  themeDot:  { width: 26, height: 26, borderRadius: 13, marginRight: 8 },
  weaveBtn: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16,
    marginLeft: 10,
  },
  weaveBtnTxt: { color: "#000", fontWeight: "900", fontSize: 10, letterSpacing: 1.5, marginLeft: 6 },
});