import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, StatusBar, ActivityIndicator, Animated,
  Platform, Image, Easing, Alert, FlatList
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from "@expo/vector-icons";
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, increment } from "firebase/firestore";
import * as Speech from 'expo-speech';

const { width, height } = Dimensions.get("window");
const LINES_PER_PAGE = 12;

interface ReaderTheme {
  name: string; bg: string; text: string; accent: string; ui: string; isDark: boolean;
}

const THEMES: Record<string, ReaderTheme> = {
  void:  { name: 'void',  bg: "#0F071A", text: "#E2E8F0", accent: "#FFD700", ui: "#1E1135", isDark: true },
  sepia: { name: 'sepia', bg: "#F4ECD8", text: "#433422", accent: "#8B4513", ui: "#EFE6D0", isDark: false },
  slate: { name: 'slate', bg: "#2D3748", text: "#EDF2F7", accent: "#A0AEC0", ui: "#1A202C", isDark: true },
  paper: { name: 'paper', bg: "#FFFFFF", text: "#1A202C", accent: "#7C3AED", ui: "#F7FAFC", isDark: false },
};

export default function ReaderScreen() {
  const { id, mode } = useLocalSearchParams();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const user = auth.currentUser;

  const bookId = useMemo(() => {
    const rawId = Array.isArray(id) ? id[0] : id;
    return rawId as string;
  }, [id]);

  const isOfflineMode = mode === 'offline';

  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [readingMode, setReadingMode] = useState<'scroll' | 'swipe'>('scroll');
  const [fontSize, setFontSize] = useState(18);
  const [alignment, setAlignment] = useState<'left' | 'center' | 'justify'>('left');
  const [theme, setTheme] = useState<ReaderTheme>(THEMES.void);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<string[][]>([]);
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [hasMarkedRead, setHasMarkedRead] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const controlsVisible = useRef(true);

  // SMOOTH TOGGLE — tap anywhere on screen
  const toggleControls = () => {
    const next = !controlsVisible.current;
    controlsVisible.current = next;
    Animated.timing(fadeAnim, {
      toValue: next ? 1 : 0,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();
    setShowControls(next);
  };

  // MARK BOOK AS READ when 90% progress reached
  const markBookRead = async () => {
    if (hasMarkedRead || !user || !bookId) return;
    setHasMarkedRead(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        booksRead: increment(1)
      });
    } catch (e) {
      console.log("Could not mark book as read", e);
    }
  };

  useEffect(() => {
    if (!bookId) return;
    let unsub: any = () => {};

    const processBookData = (data: any) => {
      let extractedContent = data.content || data.text || "";
      if (!extractedContent && Array.isArray(data.chapters)) {
        extractedContent = data.chapters.map((ch: any) => ch.content || "").join("\n\n");
      }
      const lines = extractedContent.split('\n').filter((l: string) => l.trim() !== '');
      setParagraphs(lines);

      // Build pages for swipe mode
      const built: string[][] = [];
      for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
        built.push(lines.slice(i, i + LINES_PER_PAGE));
      }
      setPages(built);

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
          const baseDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory;
          if (!baseDir) return;
          const fileUri = `${baseDir}manuscripts/${bookId}.json`;
          const fileContent = await FileSystem.readAsStringAsync(fileUri);
          processBookData(JSON.parse(fileContent));
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

  const handleScrollProgress = (event: any) => {
    const offset = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;
    const raw = (offset / (contentHeight - layoutHeight)) * 100;
    const p = Math.max(0, Math.min(100, raw));
    setProgress(p);
    if (p >= 90) markBookRead();
  };

  const handlePageChange = (index: number) => {
    setCurrentPage(index);
    const p = pages.length > 1 ? (index / (pages.length - 1)) * 100 : 0;
    setProgress(p);
    if (p >= 90) markBookRead();
  };

  const toggleSpeech = async () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      const chunk = book?.content?.substring(0, 4000) || "";
      Speech.speak(chunk, {
        onDone: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
        rate: 0.85,
      });
    }
  };

  const renderParagraph = (line: string, key: string) => {
    const isChapter = /^(chapter|prologue|epilogue|part|section)\s+[\w\d]+/i.test(line.trim());
    if (isChapter) {
      return (
        <View key={key} style={[styles.chapterFrame, { borderColor: theme.accent }]}>
          <Text style={[styles.chapterHeading, { color: theme.accent }]}>{line.toUpperCase()}</Text>
          <View style={[styles.ornamentLine, { backgroundColor: theme.accent }]} />
        </View>
      );
    }
    return (
      <Text key={key} style={[styles.bodyParagraph, {
        color: theme.text, fontSize, textAlign: alignment, lineHeight: fontSize * 1.7
      }]}>
        {line}
      </Text>
    );
  };

  // SWIPE MODE — uses FlatList for proper smooth paging
  const renderSwipePage = ({ item, index }: { item: string[], index: number }) => (
    <View style={styles.swipePage}>
      <Text style={[styles.pageNumber, { color: theme.accent }]}>
        {index + 1} / {pages.length}
      </Text>
      {item.map((line, i) => renderParagraph(line, `p${index}-${i}`))}
    </View>
  );

  if (loading) return (
    <View style={[styles.loadingScreen, { backgroundColor: theme.bg }]}>
      <ActivityIndicator size="large" color="#FFD700" />
      <Text style={styles.loadingText}>LOADING MANUSCRIPT...</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar hidden={!showControls} barStyle={theme.isDark ? "light-content" : "dark-content"} />

      {/* TAP ZONE — full screen tap to toggle controls */}
      <TouchableOpacity
        style={styles.tapZone}
        onPress={toggleControls}
        activeOpacity={1}
      />

      {/* TOP BAR */}
      <Animated.View style={[styles.topBar, { backgroundColor: theme.ui, opacity: fadeAnim }]}
        pointerEvents={showControls ? 'auto' : 'none'}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={theme.accent} />
        </TouchableOpacity>
        <Text style={[styles.bookTitleHeader, { color: theme.text }]} numberOfLines={1}>
          {book?.title}
        </Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push(`/book/${bookId}/dictionary`)}>
          <MaterialCommunityIcons name="book-alphabet" size={24} color={theme.accent} />
        </TouchableOpacity>
      </Animated.View>

      {/* PROGRESS BAR */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: theme.accent }]} />
      </View>

      {/* READING CONTENT */}
      {readingMode === 'scroll' ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContent, { paddingTop: 100 }]}
          onScroll={handleScrollProgress}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {/* BOOK HEADER */}
          <View style={styles.bookHeader}>
            {book?.displayCover
              ? <Image source={{ uri: book.displayCover }} style={styles.heroCover} />
              : <View style={[styles.placeholderCover, { backgroundColor: theme.ui }]}>
                  <MaterialCommunityIcons name="book-open-page-variant" size={60} color={theme.accent} />
                </View>
            }
            <Text style={[styles.heroTitle, { color: theme.text }]}>{book?.title}</Text>
            <Text style={[styles.heroAuthor, { color: theme.text }]}>
              by {book?.displayAuthor}
            </Text>
          </View>

          {paragraphs.map((line, i) => renderParagraph(line, `line-${i}`))}
          <View style={{ height: 300 }} />
        </ScrollView>
      ) : (
        // SWIPE MODE — FlatList with proper horizontal paging
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
            length: width,
            offset: width * index,
            index,
          })}
          style={{ flex: 1, marginTop: 50 }}
          decelerationRate="fast"
          snapToInterval={width}
          snapToAlignment="start"
        />
      )}

      {/* BOTTOM PANEL */}
      <Animated.View
        style={[styles.bottomPanel, { backgroundColor: theme.ui, opacity: fadeAnim }]}
        pointerEvents={showControls ? 'auto' : 'none'}
      >
        {/* NAV TABS */}
        <View style={styles.navTabs}>
          <TouchableOpacity style={styles.tabItem}
            onPress={() => router.push(`/book/${bookId}/findings`)}>
            <Feather name="search" size={22} color={theme.accent} />
            <Text style={[styles.tabLabel, { color: theme.text }]}>FINDINGS</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabItem}
            onPress={() => setReadingMode(readingMode === 'scroll' ? 'swipe' : 'scroll')}>
            <MaterialCommunityIcons
              name={readingMode === 'scroll' ? "book-open-page-variant" : "format-align-left"}
              size={22} color={theme.accent} />
            <Text style={[styles.tabLabel, { color: theme.text }]}>
              {readingMode === 'scroll' ? 'PAGES' : 'SCROLL'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabItem}
            onPress={() => router.push({ pathname: "/book/[id]/chapters", params: { id: bookId } })}>
            <MaterialCommunityIcons name="format-list-bulleted" size={22} color={theme.accent} />
            <Text style={[styles.tabLabel, { color: theme.text }]}>CHAPTERS</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabItem} onPress={toggleSpeech}>
            <FontAwesome5
              name={isSpeaking ? "stop-circle" : "headphones-alt"}
              size={20}
              color={isSpeaking ? "#FF4444" : theme.accent}
            />
            <Text style={[styles.tabLabel, { color: isSpeaking ? "#FF4444" : theme.text }]}>
              VOICE
            </Text>
          </TouchableOpacity>
        </View>

        {/* FONT CONTROLS */}
        <View style={styles.controlRow}>
          <TouchableOpacity style={styles.sizeBtn} onPress={() => setFontSize(s => Math.max(12, s - 1))}>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800' }}>A-</Text>
          </TouchableOpacity>

          <View style={[styles.alignRow, { borderColor: theme.accent + '50' }]}>
            {(['left', 'center', 'justify'] as const).map(a => (
              <TouchableOpacity key={a} onPress={() => setAlignment(a)}>
                <MaterialCommunityIcons
                  name={`format-align-${a}` as any}
                  size={20}
                  color={alignment === a ? theme.accent : theme.text + '60'}
                />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.sizeBtn} onPress={() => setFontSize(s => Math.min(36, s + 1))}>
            <Text style={{ color: theme.text, fontSize: 19, fontWeight: '800' }}>A+</Text>
          </TouchableOpacity>
        </View>

        {/* THEMES + WEAVE BUTTON */}
        <View style={styles.footerRow}>
          <View style={styles.themePalette}>
            {Object.values(THEMES).map(t => (
              <TouchableOpacity
                key={t.name}
                onPress={() => setTheme(t)}
                style={[styles.themeDot, {
                  backgroundColor: t.bg,
                  borderWidth: theme.name === t.name ? 3 : 1,
                  borderColor: theme.name === t.name ? theme.accent : '#333'
                }]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.weaveBtn, { backgroundColor: theme.accent }]}
            onPress={() => router.push({ pathname: "/weave/create", params: { bookId } })}
          >
            <MaterialCommunityIcons name="fountain-pen-tip" size={20} color="#000" />
            <Text style={styles.weaveBtnText}>WEAVE</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#FFD700', marginTop: 20, fontWeight: '900', letterSpacing: 3, fontSize: 10 },
  tapZone: { position: 'absolute', top: 100, left: 0, right: 0, bottom: 200, zIndex: 10 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 95, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, zIndex: 100 },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  bookTitleHeader: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2 },
  progressTrack: { position: 'absolute', top: 95, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.05)', zIndex: 100 },
  progressFill: { height: '100%' },
  scrollContent: { paddingHorizontal: 28, paddingBottom: 100 },
  bookHeader: { alignItems: 'center', paddingVertical: 60, paddingBottom: 40 },
  heroCover: { width: 160, height: 240, borderRadius: 14, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
  placeholderCover: { width: 160, height: 240, borderRadius: 14, marginBottom: 24, justifyContent: 'center', alignItems: 'center' },
  heroTitle: { fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  heroAuthor: { fontSize: 13, opacity: 0.5, letterSpacing: 3 },
  bodyParagraph: { marginBottom: 24, paddingHorizontal: 4 },
  chapterFrame: { marginVertical: 50, padding: 30, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderRadius: 12, marginHorizontal: 10 },
  chapterHeading: { fontSize: 22, fontWeight: '900', letterSpacing: 8, textAlign: 'center' },
  ornamentLine: { width: 80, height: 1, marginTop: 12 },
  swipePage: { width, flex: 1, paddingHorizontal: 28, paddingTop: 20, paddingBottom: 160 },
  pageNumber: { fontSize: 10, fontWeight: '900', letterSpacing: 2, textAlign: 'center', marginBottom: 20, opacity: 0.6 },
  bottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: Platform.OS === 'ios' ? 34 : 20, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 28, paddingTop: 22, zIndex: 100 },
  navTabs: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22 },
  tabItem: { alignItems: 'center', flex: 1 },
  tabLabel: { fontSize: 8, fontWeight: '900', marginTop: 6, letterSpacing: 1 },
  controlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sizeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  alignRow: { flexDirection: 'row', gap: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  themePalette: { flexDirection: 'row', gap: 10 },
  themeDot: { width: 30, height: 30, borderRadius: 15 },
  weaveBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  weaveBtnText: { color: '#000', fontWeight: '900', fontSize: 11, letterSpacing: 2 },
});