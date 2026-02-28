import React, { useRef, useMemo, useCallback, useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, StatusBar, ActivityIndicator, Animated,
  Platform, Image, Easing, FlatList, Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Ionicons, MaterialCommunityIcons,
  FontAwesome5, Feather,
} from "@expo/vector-icons";

import { THEMES, Paragraph, formatReadingTime, estimateReadingTime } from "./types";
import { useReaderSettings }  from "./hooks/useReaderSettings";
import { useReaderBook }      from "./hooks/useReaderBook";
import { useReaderProgress }  from "./hooks/useReaderProgress";
import { useReaderSpeech }    from "./hooks/useReaderSpeech";
import { useBookmarks }       from "./hooks/useBookmarks";
import ParagraphRenderer      from "./components/ParagraphRenderer";
import FontPanel              from "./components/FontPanel";
import VoicePanel             from "./components/VoicePanel";
import BookmarksPanel         from "./components/BookmarksPanel";

const { width, height } = Dimensions.get("window");

export default function ReaderScreen() {
  const { id, mode }  = useLocalSearchParams();
  const router        = useRouter();
  const flatListRef   = useRef<FlatList>(null);
  const scrollRef     = useRef<ScrollView>(null);

  const bookId        = useMemo(() => (Array.isArray(id) ? id[0] : id) as string, [id]);
  const isOfflineMode = mode === "offline";

  // ── HOOKS ─────────────────────────────────────────────────────────
  const settings = useReaderSettings();

  const { book, paragraphs, pages, chapterMap, loading, error, estimatedMinutes, recordView } =
    useReaderBook(bookId, isOfflineMode, settings.fontSize, settings.margins);

  const prog  = useReaderProgress(bookId, pages.length);
  const speech = useReaderSpeech(pages, prog.currentPage);
  const bm    = useBookmarks(bookId, prog.currentPage, pages);

  // ── LOCAL STATE ───────────────────────────────────────────────────
  const [readingMode,    setReadingMode]    = useState<"scroll" | "swipe">("scroll");
  const [showControls,   setShowControls]   = useState(true);
  const [showFontPanel,  setShowFontPanel]  = useState(false);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [showBookmarks,  setShowBookmarks]  = useState(false);
  const [showChapters,   setShowChapters]   = useState(false);
  const [bottomH,        setBottomH]        = useState(180);
  const [showResumeBar,  setShowResumeBar]  = useState(false);

  const fadeAnim        = useRef(new Animated.Value(1)).current;
  const controlsVisible = useRef(true);
  const scrollMovedRef  = useRef(false);
  const lastTapRef      = useRef(0);
  const hasRecordedView = useRef(false);

  const T = settings.theme;

  // ── RECORD VIEW ONCE LOADED ───────────────────────────────────────
  useEffect(() => {
    if (book && !hasRecordedView.current) {
      hasRecordedView.current = true;
      recordView();
    }
  }, [book, recordView]);

  // ── SHOW RESUME BAR IF SAVED POSITION EXISTS ─────────────────────
  useEffect(() => {
    if (prog.savedPage !== null && prog.savedPage > 0) {
      setShowResumeBar(true);
      // Auto hide after 6 seconds
      const timer = setTimeout(() => setShowResumeBar(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [prog.savedPage]);

  // ── RESTORE SAVED POSITION IN SWIPE MODE ─────────────────────────
  useEffect(() => {
    if (prog.savedPage === null || pages.length === 0 || readingMode !== "swipe") return;
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index:    Math.min(prog.savedPage!, pages.length - 1),
        animated: false,
      });
    }, 300);
  }, [prog.savedPage, pages.length, readingMode]);

  // ── TOGGLE CONTROLS ───────────────────────────────────────────────
  const toggleControls = useCallback(() => {
    const next = !controlsVisible.current;
    controlsVisible.current = next;
    Animated.timing(fadeAnim, {
      toValue:  next ? 1 : 0,
      duration: 220,
      easing:   Easing.ease,
      useNativeDriver: true,
    }).start();
    setShowControls(next);
  }, [fadeAnim]);

  // ── NAVIGATE TO BOOKMARK ──────────────────────────────────────────
  const navigateToBookmark = useCallback((page: number) => {
    if (readingMode === "swipe") {
      flatListRef.current?.scrollToIndex({
        index:    Math.min(page, pages.length - 1),
        animated: true,
      });
      prog.handlePageChange(page);
    }
  }, [readingMode, pages.length, prog]);

  // ── NAVIGATE TO CHAPTER ───────────────────────────────────────────
  const navigateToChapter = useCallback((pageIndex: number) => {
    if (readingMode === "swipe") {
      flatListRef.current?.scrollToIndex({
        index:    Math.min(pageIndex, pages.length - 1),
        animated: true,
      });
      prog.handlePageChange(pageIndex);
    }
    setShowChapters(false);
  }, [readingMode, pages.length, prog]);

  // ── RENDER PARAGRAPH ──────────────────────────────────────────────
  const renderParagraph = useCallback((p: Paragraph, key: string, pageIndex?: number) => {
    const isSpeakingThis =
      speech.isSpeaking &&
      speech.speakingPage === (pageIndex ?? prog.currentPage);

    return (
      <ParagraphRenderer
        key={key}
        paragraph={p}
        uniqueKey={key}
        theme={T}
        fontSize={settings.fontSize}
        lineSpacing={settings.lineSpacing}
        alignment={settings.alignment}
        fontFamily={settings.currentFont.family}
        paragraphGap={settings.paragraphGap}
        isSpeaking={isSpeakingThis}
      />
    );
  }, [
    T, settings.fontSize, settings.lineSpacing,
    settings.alignment, settings.currentFont,
    settings.paragraphGap, speech.isSpeaking,
    speech.speakingPage, prog.currentPage,
  ]);

  // ── RENDER SWIPE PAGE ─────────────────────────────────────────────
  const renderSwipePage = useCallback(({ item, index }: { item: Paragraph[]; index: number }) => {
    const isBookmarked   = bm.getBookmarkForPage(index);
    const bmColor        = isBookmarked?.color;

    return (
      <Pressable
        style={[s.swipePage, {
          backgroundColor: T.bg,
          paddingHorizontal: settings.margins,
          paddingBottom: bottomH + 24,
          width,
        }]}
        onPress={toggleControls}
      >
        {/* Chapter tag */}
        {item[0]?.type === "chapter" && (
          <View style={[s.pageChapterTag, { borderColor: T.accent + "40" }]}>
            <Text style={[s.pageChapterTagTxt, { color: T.accent }]}>
              NEW CHAPTER
            </Text>
          </View>
        )}

        {/* Bookmark indicator strip */}
        {isBookmarked && (
          <View style={[s.bookmarkStrip, { backgroundColor: bmColor || T.accent }]} />
        )}

        {/* Content */}
        <View style={{ flex: 1 }}>
          {item.map((p, i) => renderParagraph(p, `pg${index}-p${i}`, index))}
        </View>

        {/* Page number row */}
        <View style={[s.pageNumRow, { borderTopColor: T.accent + "15" }]}>
          <View style={[s.pageNumLine, { backgroundColor: T.accent + "20" }]} />
          <TouchableOpacity onPress={() => bm.toggleBookmark()}>
            <Ionicons
              name={isBookmarked ? "bookmark" : "bookmark-outline"}
              size={14}
              color={isBookmarked ? (bmColor || T.accent) : T.accent + "60"}
            />
          </TouchableOpacity>
          <Text style={[s.pageNumTxt, { color: T.accent + "90" }]}>
            {index + 1} / {pages.length}
          </Text>
          <View style={[s.pageNumLine, { backgroundColor: T.accent + "20" }]} />
        </View>
      </Pressable>
    );
  }, [
    T, settings.margins, pages.length, bottomH,
    renderParagraph, toggleControls, bm,
  ]);

  // ── LOADING STATE ─────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[s.loadingScreen, { backgroundColor: T.bg }]}>
        <ActivityIndicator size="large" color={T.accent} />
        <Text style={[s.loadingText, { color: T.accent }]}>
          LOADING MANUSCRIPT...
        </Text>
      </View>
    );
  }

  // ── ERROR STATE ───────────────────────────────────────────────────
  if (error || !book) {
    return (
      <View style={[s.loadingScreen, { backgroundColor: T.bg }]}>
        <MaterialCommunityIcons
          name="book-remove-outline"
          size={48}
          color={T.uiText}
        />
        <Text style={[s.errorText, { color: T.text }]}>
          {error || "Book not found"}
        </Text>
        <TouchableOpacity
          style={[s.errorBtn, { backgroundColor: T.accent }]}
          onPress={() => router.back()}
        >
          <Text style={s.errorBtnTxt}>GO BACK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── MAIN RENDER ───────────────────────────────────────────────────
  return (
    <View style={[s.container, { backgroundColor: T.bg }]}>
      <StatusBar
        hidden={!showControls}
        barStyle={T.statusBar}
        backgroundColor={T.ui}
      />

      {/* ── TOP BAR ── */}
      <Animated.View
        style={[s.topBar, { backgroundColor: T.ui, opacity: fadeAnim }]}
        pointerEvents={showControls ? "auto" : "none"}
      >
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={T.accent} />
        </TouchableOpacity>

        <View style={s.topCenter}>
          <Text style={[s.bookTitle, { color: T.text }]} numberOfLines={1}>
            {book.title}
          </Text>
          {estimatedMinutes > 0 && (
            <Text style={[s.bookSubtitle, { color: T.uiText }]}>
              ~{estimatedMinutes} min read
            </Text>
          )}
        </View>

        <View style={s.topRight}>
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => bm.toggleBookmark()}
          >
            <Ionicons
              name={bm.isCurrentPageBookmarked ? "bookmark" : "bookmark-outline"}
              size={22}
              color={bm.isCurrentPageBookmarked
                ? (bm.currentBookmarkColor || T.accent)
                : T.uiText}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => router.push(`/book/${bookId}/dictionary`)}
          >
            <MaterialCommunityIcons
              name="book-alphabet"
              size={22}
              color={T.accent}
            />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── PROGRESS BAR ── */}
      <View style={[s.progressTrack, { top: showControls ? 95 : 0 }]}>
        <Animated.View style={[s.progressFill, {
          width: `${prog.progress}%`,
          backgroundColor: T.accent,
        }]} />
      </View>

      {/* ── RESUME BAR ── */}
      {showResumeBar && prog.savedPage !== null && (
        <Animated.View
          style={[s.resumeBar, {
            backgroundColor: T.ui2,
            top: showControls ? 100 : 6,
          }]}
        >
          <Ionicons name="time-outline" size={14} color={T.accent} />
          <Text style={[s.resumeBarTxt, { color: T.text }]}>
            Continue from page {prog.savedPage + 1}?
          </Text>
          <TouchableOpacity
            style={[s.resumeBtn, { backgroundColor: T.accent }]}
            onPress={() => {
              navigateToBookmark(prog.savedPage!);
              setShowResumeBar(false);
            }}
          >
            <Text style={s.resumeBtnTxt}>RESUME</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowResumeBar(false)}>
            <Ionicons name="close" size={16} color={T.uiText} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── CONTENT ── */}
      {readingMode === "scroll" ? (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[s.scrollContent, {
            paddingTop:        110,
            paddingBottom:     bottomH + 80,
            paddingHorizontal: settings.margins,
          }]}
          onScroll={prog.handleScrollProgress}
          scrollEventThrottle={32}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => { scrollMovedRef.current = true; }}
          onScrollEndDrag={() => {
            setTimeout(() => { scrollMovedRef.current = false; }, 150);
          }}
          onTouchEnd={() => {
            if (scrollMovedRef.current) return;
            const now = Date.now();
            if (now - lastTapRef.current < 300) return;
            lastTapRef.current = now;
            toggleControls();
          }}
        >
          {/* Book header */}
          <View style={s.bookHeader}>
            {book.displayCover ? (
              <Image
                source={{ uri: book.displayCover }}
                style={s.heroCover}
                resizeMode="cover"
              />
            ) : (
              <View style={[s.placeholderCover, { backgroundColor: T.ui }]}>
                <MaterialCommunityIcons
                  name="book-open-page-variant"
                  size={60}
                  color={T.accent}
                />
              </View>
            )}
            <Text style={[s.heroTitle, { color: T.text }]}>{book.title}</Text>
            <Text style={[s.heroAuthor, { color: T.uiText }]}>
              by {book.displayAuthor}
            </Text>
            {book.genre ? (
              <View style={[s.genreTag, { backgroundColor: T.accent + "20", borderColor: T.accent + "40" }]}>
                <Text style={[s.genreTagTxt, { color: T.accent }]}>
                  {book.genre.toUpperCase()}
                </Text>
              </View>
            ) : null}
            {estimatedMinutes > 0 && (
              <Text style={[s.estimateText, { color: T.uiText }]}>
                ~{estimatedMinutes} min read
              </Text>
            )}
            <View style={[s.openingLine, { backgroundColor: T.accent + "40" }]} />
          </View>

          {/* Paragraphs */}
          {paragraphs.map((p, i) => renderParagraph(p, `line-${i}`))}
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
            prog.handlePageChange(index);
          }}
          getItemLayout={(_, index) => ({
            length: width, offset: width * index, index,
          })}
          style={{ flex: 1, marginTop: 50 }}
          decelerationRate="fast"
          snapToInterval={width}
          snapToAlignment="start"
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({
                index:    Math.min(info.index, pages.length - 1),
                animated: false,
              });
            }, 500);
          }}
          windowSize={5}
          maxToRenderPerBatch={3}
          initialNumToRender={2}
        />
      )}

      {/* ── BOTTOM PANEL ── */}
      <Animated.View
        style={[s.bottomPanel, { backgroundColor: T.ui, opacity: fadeAnim }]}
        pointerEvents={showControls ? "auto" : "none"}
        onLayout={(e) => setBottomH(e.nativeEvent.layout.height)}
      >
        {/* Progress info row */}
        <View style={s.progressInfoRow}>
          <Text style={[s.progressTxt, { color: T.uiText }]}>
            {Math.round(prog.progress)}% complete
          </Text>
          {readingMode === "swipe" && (
            <Text style={[s.progressTxt, { color: T.uiText }]}>
              Page {prog.currentPage + 1} of {pages.length}
            </Text>
          )}
          {prog.readingStats && (
            <Text style={[s.progressTxt, { color: T.uiText }]}>
              {formatReadingTime(prog.readingStats.totalTimeRead)} read
            </Text>
          )}
        </View>

        {/* Nav tabs */}
        <View style={s.navTabs}>
          <TouchableOpacity
            style={s.tabItem}
            onPress={() => router.push(`/book/${bookId}/findings`)}
          >
            <Feather name="search" size={20} color={T.accent} />
            <Text style={[s.tabLabel, { color: T.uiText }]}>FIND</Text>
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
            onPress={() => setShowChapters(true)}
          >
            <MaterialCommunityIcons
              name="format-list-bulleted"
              size={20}
              color={T.accent}
            />
            <Text style={[s.tabLabel, { color: T.uiText }]}>CHAPTERS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.tabItem}
            onPress={() => {
              speech.setShowVoicePanel(true);
              setShowVoicePanel(true);
            }}
          >
            <FontAwesome5
              name={speech.isSpeaking ? "stop-circle" : "headphones-alt"}
              size={18}
              color={speech.isSpeaking ? "#EF4444" : T.accent}
            />
            <Text style={[s.tabLabel, {
              color: speech.isSpeaking ? "#EF4444" : T.uiText,
            }]}>
              {speech.isSpeaking ? "STOP" : "VOICE"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.tabItem}
            onPress={() => setShowBookmarks(true)}
          >
            <Ionicons
              name="bookmarks-outline"
              size={20}
              color={T.accent}
            />
            {bm.bookmarks.length > 0 && (
              <View style={[s.tabBadge, { backgroundColor: T.accent }]}>
                <Text style={s.tabBadgeTxt}>{bm.bookmarks.length}</Text>
              </View>
            )}
            <Text style={[s.tabLabel, { color: T.uiText }]}>SAVED</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.tabItem}
            onPress={() => setShowFontPanel(true)}
          >
            <MaterialCommunityIcons
              name="format-font"
              size={20}
              color={T.accent}
            />
            <Text style={[s.tabLabel, { color: T.uiText }]}>STYLE</Text>
          </TouchableOpacity>
        </View>

        {/* Controls row */}
        <View style={s.controlRow}>
          <TouchableOpacity
            style={[s.sizeBtn, { backgroundColor: T.bg }]}
            onPress={settings.decreaseFontSize}
          >
            <Text style={{ color: T.text, fontSize: 14, fontWeight: "900" }}>A−</Text>
          </TouchableOpacity>

          <View style={[s.alignRow, {
            borderColor:     T.accent + "25",
            backgroundColor: T.bg,
          }]}>
            {(["left", "center", "justify"] as const).map((a) => (
              <TouchableOpacity
                key={a}
                onPress={() => settings.setAlignment(a)}
                style={s.alignBtn}
              >
                <MaterialCommunityIcons
                  name={`format-align-${a}` as any}
                  size={18}
                  color={settings.alignment === a ? T.accent : T.text + "35"}
                />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[s.sizeBtn, { backgroundColor: T.bg }]}
            onPress={settings.cycleLineSpacing}
          >
            <MaterialCommunityIcons
              name="format-line-spacing"
              size={18}
              color={T.accent}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.sizeBtn, { backgroundColor: T.bg }]}
            onPress={settings.increaseFontSize}
          >
            <Text style={{ color: T.text, fontSize: 18, fontWeight: "900" }}>A+</Text>
          </TouchableOpacity>
        </View>

        {/* Theme + Weave row */}
        <View style={s.footerRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
          >
            {Object.values(THEMES).map((t) => (
              <TouchableOpacity
                key={t.name}
                onPress={() => settings.setTheme(t)}
                style={[s.themeDot, {
                  backgroundColor: t.bg,
                  borderWidth:     T.name === t.name ? 3 : 1,
                  borderColor:     T.name === t.name ? T.accent : "#55555580",
                }]}
              />
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[s.weaveBtn, { backgroundColor: T.accent }]}
            onPress={() => router.push({
              pathname: "/weave/create",
              params:   { bookId, bookTitle: book.title || book.title || "", authorName: book.authorName || book.author || "" },
            })}
          >
            <MaterialCommunityIcons
              name="fountain-pen-tip"
              size={16}
              color="#000"
            />
            <Text style={s.weaveBtnTxt}>WEAVE</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── CHAPTERS PANEL ── */}
      {showChapters && (
        <Pressable
          style={s.chaptersOverlay}
          onPress={() => setShowChapters(false)}
        >
          <Pressable style={[s.chaptersSheet, { backgroundColor: T.ui }]}>
            <View style={s.handle} />
            <View style={s.chaptersHeader}>
              <Text style={[s.chaptersTitle, { color: T.accent }]}>CHAPTERS</Text>
              <Text style={[s.chaptersCount, { color: T.uiText }]}>
                {chapterMap.length} chapters
              </Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {chapterMap.length === 0 ? (
                <View style={s.chaptersEmpty}>
                  <Text style={[s.chaptersEmptyTxt, { color: T.uiText }]}>
                    No chapters detected in this book.
                  </Text>
                </View>
              ) : (
                chapterMap.map((ch, i) => {
                  const isCurrent = prog.currentPage >= ch.pageIndex &&
                    (i === chapterMap.length - 1 || prog.currentPage < chapterMap[i + 1].pageIndex);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[s.chapterRow, {
                        backgroundColor: isCurrent ? T.accent + "15" : "transparent",
                        borderColor:     isCurrent ? T.accent + "40" : T.accent + "10",
                      }]}
                      onPress={() => navigateToChapter(ch.pageIndex)}
                    >
                      <View style={[s.chapterNum, {
                        backgroundColor: isCurrent ? T.accent : T.bg,
                      }]}>
                        <Text style={[s.chapterNumTxt, {
                          color: isCurrent ? "#000" : T.uiText,
                        }]}>
                          {i + 1}
                        </Text>
                      </View>
                      <Text
                        style={[s.chapterRowTxt, {
                          color:      isCurrent ? T.accent : T.text,
                          fontWeight: isCurrent ? "900" : "600",
                        }]}
                        numberOfLines={2}
                      >
                        {ch.title}
                      </Text>
                      <Text style={[s.chapterPage, { color: T.uiText }]}>
                        p.{ch.pageIndex + 1}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      )}

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
        margins={settings.margins}
        paragraphGap={settings.paragraphGap}
        setFontSize={settings.setFontSize}
        setLineSpacing={settings.setLineSpacing}
        setAlignment={settings.setAlignment}
        setFontKey={settings.setFontKey}
        setMargins={settings.setMargins}
        setParagraphGap={settings.setParagraphGap}
        resetToDefaults={settings.resetToDefaults}
        increaseFontSize={settings.increaseFontSize}
        decreaseFontSize={settings.decreaseFontSize}
      />

      <VoicePanel
        visible={showVoicePanel}
        onClose={() => setShowVoicePanel(false)}
        theme={T}
        isSpeaking={speech.isSpeaking}
        speakingPage={speech.speakingPage}
        speechRate={speech.speechRate}
        speechPitch={speech.speechPitch}
        selectedVoice={speech.selectedVoice}
        availableVoices={speech.availableVoices}
        totalPages={pages.length}
        currentPage={prog.currentPage}
        toggleSpeech={speech.toggleSpeech}
        stopSpeech={speech.stopSpeech}
        setSpeechRate={speech.setSpeechRate}
        setSpeechPitch={speech.setSpeechPitch}
        setSelectedVoice={speech.setSelectedVoice}
        previewVoice={speech.previewVoice}
      />

      <BookmarksPanel
        visible={showBookmarks}
        onClose={() => setShowBookmarks(false)}
        theme={T}
        bookmarks={bm.bookmarks}
        currentPage={prog.currentPage}
        totalPages={pages.length}
        onNavigate={navigateToBookmark}
        onDelete={bm.deleteBookmark}
        onClearAll={bm.clearAllBookmarks}
        onColorChange={bm.updateBookmarkColor}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:        { flex: 1 },
  loadingScreen:    { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  loadingText:      { fontWeight: "900", letterSpacing: 3, fontSize: 10 },
  errorText:        { fontSize: 16, fontWeight: "700", textAlign: "center", marginTop: 16, paddingHorizontal: 32 },
  errorBtn:         { marginTop: 20, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14 },
  errorBtnTxt:      { color: "#000", fontWeight: "900", fontSize: 13, letterSpacing: 2 },

  // Top bar
  topBar:           { position: "absolute", top: 0, left: 0, right: 0, height: 95, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, zIndex: 100 },
  iconBtn:          { width: 38, height: 38, justifyContent: "center", alignItems: "center" },
  topCenter:        { flex: 1, alignItems: "center" },
  topRight:         { flexDirection: "row", alignItems: "center" },
  bookTitle:        { fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2, textAlign: "center" },
  bookSubtitle:     { fontSize: 9, marginTop: 2, letterSpacing: 1 },

  // Progress
  progressTrack:    { position: "absolute", left: 0, right: 0, height: 2, backgroundColor: "rgba(255,255,255,0.04)", zIndex: 99 },
  progressFill:     { height: "100%" },

  // Resume bar
  resumeBar:        { position: "absolute", left: 16, right: 16, flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 14, zIndex: 200 },
  resumeBarTxt:     { flex: 1, fontSize: 12, fontWeight: "600" },
  resumeBtn:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  resumeBtnTxt:     { color: "#000", fontWeight: "900", fontSize: 10, letterSpacing: 1 },

  // Scroll content
  scrollContent:    {},
  bookHeader:       { alignItems: "center", paddingTop: 20, paddingBottom: 32 },
  heroCover:        { width: 150, height: 220, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: "rgba(255,215,0,0.2)" },
  placeholderCover: { width: 150, height: 220, borderRadius: 16, marginBottom: 20, justifyContent: "center", alignItems: "center" },
  heroTitle:        { fontSize: 24, fontWeight: "900", textAlign: "center", marginBottom: 6 },
  heroAuthor:       { fontSize: 12, letterSpacing: 3, textAlign: "center", marginBottom: 10 },
  genreTag:         { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1, marginBottom: 8 },
  genreTagTxt:      { fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  estimateText:     { fontSize: 11, marginTop: 4, marginBottom: 16 },
  openingLine:      { width: 50, height: 1, marginTop: 8, borderRadius: 1 },

  // Swipe page
  swipePage:        { flexDirection: "column", paddingTop: 65 },
  pageChapterTag:   { alignSelf: "center", marginBottom: 16, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1, borderRadius: 20 },
  pageChapterTagTxt:{ fontSize: 9, fontWeight: "900", letterSpacing: 3 },
  bookmarkStrip:    { position: "absolute", top: 0, right: 30, width: 4, height: 36, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  pageNumRow:       { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: 1, marginTop: 8 },
  pageNumLine:      { flex: 1, height: 1 },
  pageNumTxt:       { fontSize: 10, fontWeight: "700", letterSpacing: 1 },

  // Bottom panel
  bottomPanel:      { position: "absolute", bottom: 0, left: 0, right: 0, paddingBottom: Platform.OS === "ios" ? 34 : 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 14, zIndex: 100 },
  progressInfoRow:  { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  progressTxt:      { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  navTabs:          { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  tabItem:          { alignItems: "center", flex: 1, position: "relative" },
  tabLabel:         { fontSize: 7, fontWeight: "900", marginTop: 4, letterSpacing: 0.5 },
  tabBadge:         { position: "absolute", top: -4, right: 4, width: 14, height: 14, borderRadius: 7, justifyContent: "center", alignItems: "center" },
  tabBadgeTxt:      { color: "#000", fontSize: 7, fontWeight: "900" },
  controlRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 },
  sizeBtn:          { width: 40, height: 40, justifyContent: "center", alignItems: "center", borderRadius: 10 },
  alignRow:         { flexDirection: "row", gap: 4, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 14, flex: 1, justifyContent: "space-around" },
  alignBtn:         { padding: 4 },
  footerRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  themeDot:         { width: 26, height: 26, borderRadius: 13, marginRight: 8 },
  weaveBtn:         { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16 },
  weaveBtnTxt:      { color: "#000", fontWeight: "900", fontSize: 10, letterSpacing: 1.5 },

  // Chapters panel
  chaptersOverlay:  { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 200, justifyContent: "flex-end" },
  chaptersSheet:    { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === "ios" ? 44 : 28, maxHeight: height * 0.75 },
  chaptersHeader:   { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 },
  chaptersTitle:    { fontSize: 13, fontWeight: "900", letterSpacing: 3 },
  chaptersCount:    { fontSize: 11, fontWeight: "600" },
  chaptersEmpty:    { paddingVertical: 32, alignItems: "center" },
  chaptersEmptyTxt: { fontSize: 13 },
  chapterRow:       { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, marginBottom: 8, borderWidth: 1 },
  chapterNum:       { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  chapterNumTxt:    { fontSize: 12, fontWeight: "900" },
  chapterRowTxt:    { flex: 1, fontSize: 14, lineHeight: 20 },
  chapterPage:      { fontSize: 10 },
  handle:           { width: 44, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 20 },
});