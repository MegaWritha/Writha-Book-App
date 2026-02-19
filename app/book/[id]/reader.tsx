import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, StatusBar, ActivityIndicator, Animated, 
  Pressable, Platform, Image, Share, Easing, Alert
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from "@expo/vector-icons";
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import * as Speech from 'expo-speech';

const { width, height } = Dimensions.get("window");

interface ReaderTheme {
  name: string; bg: string; text: string; accent: string; ui: string; isDark: boolean;
}

export default function ReaderScreen() {
  const { id, mode } = useLocalSearchParams();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  
  const bookId = useMemo(() => {
    const rawId = Array.isArray(id) ? id[0] : id;
    return rawId as string;
  }, [id]);
  
  const isOfflineMode = mode === 'offline';

  // --- CORE STATE ---
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(true); // Control state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoScrollActive, setAutoScrollActive] = useState(false);
  const [readingMode, setReadingMode] = useState<'scroll' | 'swipe'>('scroll');
  const [readingGoal, setReadingGoal] = useState({ current: 0, target: 10 });
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.7);
  const [alignment, setAlignment] = useState<'left' | 'center' | 'justify'>('left');
  const [theme, setTheme] = useState<ReaderTheme>({ 
    name: 'void', bg: "#0F071A", text: "#E2E8F0", accent: "#FFD700", ui: "#1E1135", isDark: true 
  });
  const [progress, setProgress] = useState(0);
  const [scrollPos, setScrollPos] = useState(0);

  // --- ANIMATION REFS ---
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // MANUAL TOGGLE ONLY
  const toggleControls = () => {
    const nextState = !showControls;
    const toValue = nextState ? 1 : 0;
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue,
        duration: 400,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue,
        duration: 400,
        useNativeDriver: true,
      })
    ]).start();
    
    setShowControls(nextState);
  };

  const gearRotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg']
  });

  // --- PERSISTENT GOAL LOADING ---
  useEffect(() => {
    const loadGoal = async () => {
      if (!bookId) return;
      try {
        const savedGoal = await AsyncStorage.getItem(`readingGoal_${bookId}`);
        if (savedGoal) {
          const parsed = JSON.parse(savedGoal);
          setReadingGoal(prev => (prev.current !== parsed.current ? parsed : prev));
        }
      } catch (e) { console.log("Goal load error", e); }
    };
    loadGoal();
  }, [bookId]);

  // --- DATA LOADING ---
  useEffect(() => {
    if (!bookId) return;
    let unsub: any = () => {};
    const loadData = async () => {
      if (isOfflineMode) {
        try {
          const baseDir = (FileSystem as any)['documentDirectory'] || (FileSystem as any)['cacheDirectory'];
          if (!baseDir) return;
          const mDir = `${baseDir}manuscripts/`;
          const fileUri = `${mDir}${bookId}.json`;
          const fileContent = await FileSystem.readAsStringAsync(fileUri);
          processBookData(JSON.parse(fileContent));
        } catch (error) {
          Alert.alert("Archive Error", "Could not locate manuscript.");
          router.back();
        }
      } else {
        unsub = onSnapshot(doc(db, "books", bookId), (snap) => {
          if (snap.exists()) processBookData({ id: snap.id, ...snap.data() });
        });
      }
    };
    const processBookData = (data: any) => {
      let extractedContent = data.content || data.text || "";
      if (!extractedContent && Array.isArray(data.chapters)) {
         extractedContent = data.chapters.map((ch: any) => ch.content || "").join("\n\n");
      }
      setBook({ 
        ...data, content: extractedContent,
        displayAuthor: data.authorName || data.author || "Unknown Author",
        displayCover: data.coverUrl || data.cover || null
      });
      setLoading(false);
    };
    loadData();
    return () => { unsub(); Speech.stop(); };
  }, [bookId, isOfflineMode]);

  // --- VOICE & SCROLL ---
  const toggleSpeech = async () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      setAutoScrollActive(false);
    } else {
      setIsSpeaking(true);
      setAutoScrollActive(true);
      const chunk = book?.content?.substring(0, 4000) || "";
      Speech.speak(chunk, {
        onDone: () => { setIsSpeaking(false); setAutoScrollActive(false); },
        onError: () => { setIsSpeaking(false); setAutoScrollActive(false); },
        rate: 0.85
      });
    }
  };

  useEffect(() => {
    let interval: any;
    if (autoScrollActive && isSpeaking && readingMode === 'scroll') {
      interval = setInterval(() => {
        scrollRef.current?.scrollTo({ y: scrollPos + 1, animated: false });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [autoScrollActive, isSpeaking, scrollPos, readingMode]);

  const handleScroll = (event: any) => {
    const isHorizontal = readingMode === 'swipe';
    const offset = isHorizontal ? event.nativeEvent.contentOffset.x : event.nativeEvent.contentOffset.y;
    setScrollPos(offset);
    const contentSize = isHorizontal ? event.nativeEvent.contentSize.width : event.nativeEvent.contentSize.height;
    const layoutSize = isHorizontal ? event.nativeEvent.layoutMeasurement.width : event.nativeEvent.layoutMeasurement.height;
    const rawProgress = (offset / (contentSize - layoutSize)) * 100;
    setProgress(Math.max(0, Math.min(100, rawProgress)));

    const pagesRead = Math.floor(rawProgress / 10);
    if (pagesRead > readingGoal.current) {
      const newGoal = { ...readingGoal, current: pagesRead };
      setReadingGoal(newGoal);
      AsyncStorage.setItem(`readingGoal_${bookId}`, JSON.stringify(newGoal));
    }
  };

  const renderLine = (line: string, key: string) => {
    const isChapterHeader = /^(chapter|prologue|epilogue|part|section|manuscript)\s+[\w\d]+/i.test(line.trim());
    if (isChapterHeader) {
      return (
        <View key={key} style={[styles.chapterFrame, { borderColor: theme.accent }]}>
           <View style={[styles.goldCorner, { top: -8, left: -8, borderTopWidth: 4, borderLeftWidth: 4, borderColor: theme.accent }]} />
           <View style={[styles.goldCorner, { top: -8, right: -8, borderTopWidth: 4, borderRightWidth: 4, borderColor: theme.accent }]} />
           <Text style={[styles.chapterHeading, { color: theme.accent }]}>{line.toUpperCase()}</Text>
           <View style={[styles.ornamentLine, { backgroundColor: theme.accent }]} />
           <Text style={[styles.chapterSub, { color: theme.text }]}>THE WRITHA ARCHIVES</Text>
        </View>
      );
    }
    if (line.trim() === "") return <View key={key} style={{ height: 25 }} />;
    return (
      <Text key={key} style={[styles.bodyParagraph, { color: theme.text, fontSize, textAlign: alignment, lineHeight: fontSize * lineHeight }]}>
        {line}
      </Text>
    );
  };

  const renderText = (text: string) => {
    if (!text) return <Text style={[styles.errorText, { color: theme.text }]}>The scroll is empty.</Text>;
    const paragraphs = text.split('\n');
    if (readingMode === 'swipe') {
        const pages: string[][] = [];
        let currentPage: string[] = [];
        for (let i = 0; i < paragraphs.length; i++) {
            currentPage.push(paragraphs[i]);
            if (currentPage.length >= 10 || i === paragraphs.length - 1) {
                pages.push([...currentPage]);
                currentPage = [];
            }
        }
        return pages.map((page: string[], pageIdx: number) => (
            <View key={`page-${pageIdx}`} style={{ width: width, paddingHorizontal: 32 }}>
                {page.map((line: string, i: number) => renderLine(line, `p-${pageIdx}-${i}`))}
            </View>
        ));
    }
    return paragraphs.map((line: string, i: number) => renderLine(line, `line-${i}`));
  };

  if (loading) return (
    <View style={[styles.loadingScreen, { backgroundColor: theme.bg }]}>
      <ActivityIndicator size="large" color="#FFD700" />
      <Text style={styles.loadingText}>TRANSCRIBING MANUSCRIPT...</Text>
    </View>
  );

  return (
    <View style={[styles.mainContainer, { backgroundColor: theme.bg }]}>
      <StatusBar hidden={!showControls} barStyle={theme.isDark ? "light-content" : "dark-content"} />

      {/* MANUAL TOGGLE BUTTON */}
      <TouchableOpacity 
        style={[styles.floatingToggle, { backgroundColor: theme.ui, borderColor: theme.accent }]} 
        onPress={toggleControls}
      >
        <Animated.View style={{ transform: [{ rotate: gearRotate }] }}>
            <Ionicons name={showControls ? "close" : "settings-sharp"} size={24} color={theme.accent} />
        </Animated.View>
      </TouchableOpacity>

      {/* TOP NAV */}
      <Animated.View style={[styles.topPanel, { backgroundColor: theme.ui, opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [-150, 0] }) }] }]} pointerEvents={showControls ? 'auto' : 'none'}>
        <View style={styles.topActionRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBox}><Ionicons name="chevron-back" size={28} color={theme.accent} /></TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={[styles.bookTitleHeader, { color: theme.text }]} numberOfLines={1}>{book?.title}</Text>
          </View>
          <TouchableOpacity style={styles.iconBox} onPress={() => router.push(`/book/${bookId}/dictionary`)}>
            <MaterialCommunityIcons name="book-alphabet" size={26} color={theme.accent} />
          </TouchableOpacity>
        </View>
        <View style={styles.goalBanner}><Text style={[styles.goalText, { color: theme.accent }]}>DAILY GOAL: {readingGoal.current}/{readingGoal.target} PAGES</Text></View>
        <View style={styles.progressContainer}><View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: theme.accent }]} /></View>
      </Animated.View>

      <ScrollView ref={scrollRef} onScroll={handleScroll} scrollEventThrottle={16} horizontal={readingMode === 'swipe'} pagingEnabled={readingMode === 'swipe'} showsVerticalScrollIndicator={false}>
        <View style={[styles.manuscriptHeader, readingMode === 'swipe' && { width: width }]}>
          {book?.displayCover ? <Image source={{ uri: book.displayCover }} style={styles.heroCover} /> : <View style={[styles.placeholderCover, { backgroundColor: theme.ui }]}><MaterialCommunityIcons name="book-open-page-variant" size={80} color={theme.accent} /></View>}
          <Text style={[styles.brandTag, { color: theme.accent }]}>WRITHA {isOfflineMode ? 'ARCHIVE' : 'SPECIAL'} EDITION</Text>
          <Text style={[styles.heroTitle, { color: theme.text }]}>{book?.title}</Text>
          <Text style={[styles.heroAuthor, { color: theme.text }]}>BY {book?.displayAuthor.toUpperCase()}</Text>
        </View>
        <View style={[styles.readerBody, readingMode === 'swipe' && { flexDirection: 'row', paddingHorizontal: 0 }]}>
          {renderText(book?.content)}
        </View>
        <View style={{ height: 450 }} />
      </ScrollView>

      {/* BOTTOM PANEL */}
      <Animated.View style={[styles.bottomPanel, { backgroundColor: theme.ui, opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) }] }]} pointerEvents={showControls ? 'auto' : 'none'}>
        <View style={styles.navTabs}>
          <TouchableOpacity style={styles.tabItem} onPress={() => router.push(`/book/${bookId}/findings`)}><Feather name="search" size={24} color={theme.accent} /><Text style={[styles.tabLabel, { color: theme.text }]}>FINDINGS</Text></TouchableOpacity>
          <TouchableOpacity style={styles.tabItem} onPress={() => setReadingMode(readingMode === 'scroll' ? 'swipe' : 'scroll')}><MaterialCommunityIcons name={readingMode === 'scroll' ? "unfold-more-horizontal" : "unfold-more-vertical"} size={24} color={theme.accent} /><Text style={[styles.tabLabel, { color: theme.text }]}>{readingMode.toUpperCase()}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.tabItem} onPress={() => router.push({ pathname: "/book/[id]/chapters", params: { id: bookId } })}><MaterialCommunityIcons name="format-list-bulleted" size={24} color={theme.accent} /><Text style={[styles.tabLabel, { color: theme.text }]}>CHAPTERS</Text></TouchableOpacity>
          <TouchableOpacity style={styles.tabItem} onPress={toggleSpeech}><FontAwesome5 name={isSpeaking ? "stop-circle" : "headphones-alt"} size={22} color={isSpeaking ? "#FF4444" : theme.accent} /><Text style={[styles.tabLabel, { color: isSpeaking ? "#FF4444" : theme.text }]}>VOICE</Text></TouchableOpacity>
        </View>
        <View style={styles.controlSection}>
          <TouchableOpacity style={styles.sizeBtn} onPress={() => setFontSize(s => Math.max(12, s-1))}><Text style={{ color: theme.text, fontSize: 16 }}>A-</Text></TouchableOpacity>
          <View style={[styles.alignmentRow, { borderColor: theme.accent + '40' }]}>
            <TouchableOpacity onPress={() => setAlignment('left')}><MaterialCommunityIcons name="format-align-left" size={22} color={alignment === 'left' ? theme.accent : theme.text} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setAlignment('center')}><MaterialCommunityIcons name="format-align-center" size={22} color={alignment === 'center' ? theme.accent : theme.text} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setAlignment('justify')}><MaterialCommunityIcons name="format-align-justify" size={22} color={alignment === 'justify' ? theme.accent : theme.text} /></TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.sizeBtn} onPress={() => setFontSize(s => Math.min(40, s+1))}><Text style={{ color: theme.text, fontSize: 20 }}>A+</Text></TouchableOpacity>
        </View>
        <View style={styles.footerActions}>
          <View style={styles.themePalette}>
            {['void', 'sepia', 'slate', 'paper'].map((t: string) => (
              <TouchableOpacity key={t} onPress={() => {
                if (t === 'void') setTheme({ name: 'void', bg: "#0F071A", text: "#E2E8F0", accent: "#FFD700", ui: "#1E1135", isDark: true });
                if (t === 'sepia') setTheme({ name: 'sepia', bg: "#F4ECD8", text: "#433422", accent: "#8B4513", ui: "#EFE6D0", isDark: false });
                if (t === 'slate') setTheme({ name: 'slate', bg: "#2D3748", text: "#EDF2F7", accent: "#A0AEC0", ui: "#1A202C", isDark: true });
                if (t === 'paper') setTheme({ name: 'paper', bg: "#FFFFFF", text: "#1A202C", accent: "#7C3AED", ui: "#F7FAFC", isDark: false });
              }} style={[styles.themeDot, { backgroundColor: t === 'void' ? '#0F071A' : t === 'sepia' ? '#F4ECD8' : t === 'slate' ? '#2D3748' : '#FFF', borderWidth: theme.name === t ? 3 : 0, borderColor: theme.accent }]} />
            ))}
          </View>
          <TouchableOpacity style={[styles.weaveButton, { backgroundColor: theme.accent }]} onPress={() => router.push({ pathname: "/weave/create", params: { bookId } })}>
            <MaterialCommunityIcons name="fountain-pen-tip" size={22} color="#000" /><Text style={styles.weaveText}>WEAVE</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#FFD700', marginTop: 25, fontWeight: '900', letterSpacing: 4, fontSize: 10 },
  floatingToggle: { position: 'absolute', right: 20, bottom: 120, width: 56, height: 56, borderRadius: 28, borderWidth: 2, justifyContent: 'center', alignItems: 'center', zIndex: 999, elevation: 5 },
  topPanel: { position: 'absolute', top: 0, width: '100%', height: 140, zIndex: 100, paddingTop: 55 },
  topActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 25, marginBottom: 5 },
  goalBanner: { alignItems: 'center', marginBottom: 10 },
  goalText: { fontSize: 9, fontWeight: '900', letterSpacing: 2 },
  titleContainer: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  iconBox: { width: 45, height: 45, alignItems: 'center', justifyContent: 'center' },
  bookTitleHeader: { textAlign: 'center', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2.5, maxWidth: '80%' },
  progressContainer: { width: '100%', height: 6, position: 'absolute', bottom: 0, backgroundColor: 'rgba(0,0,0,0.1)' },
  progressFill: { height: '100%', position: 'absolute', top: 0, left: 0 },
  manuscriptHeader: { alignItems: 'center', paddingVertical: 120, paddingHorizontal: 40 },
  heroCover: { width: 180, height: 280, borderRadius: 18, marginBottom: 35, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
  placeholderCover: { width: 180, height: 280, borderRadius: 18, marginBottom: 35, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: 'rgba(255,215,0,0.2)' },
  brandTag: { fontSize: 10, fontWeight: '900', letterSpacing: 10, marginBottom: 20 },
  heroTitle: { fontSize: 42, fontWeight: '900', textAlign: 'center', marginBottom: 15, lineHeight: 50 },
  heroAuthor: { fontSize: 13, opacity: 0.5, letterSpacing: 5, marginBottom: 25 },
  readerBody: { paddingHorizontal: 0 },
  bodyParagraph: { marginBottom: 30, paddingHorizontal: 32 },
  chapterFrame: { marginVertical: 80, padding: 45, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, marginHorizontal: 20 },
  goldCorner: { position: 'absolute', width: 25, height: 25 },
  chapterHeading: { fontSize: 28, fontWeight: '900', letterSpacing: 15, textAlign: 'center' },
  ornamentLine: { width: 100, height: 1, marginVertical: 15 },
  chapterSub: { fontSize: 9, fontWeight: 'bold', opacity: 0.4, letterSpacing: 3 },
  errorText: { textAlign: 'center', padding: 60, fontSize: 16, opacity: 0.5 },
  bottomPanel: { position: 'absolute', bottom: 0, width: '100%', paddingBottom: 60, borderTopLeftRadius: 45, borderTopRightRadius: 45, paddingHorizontal: 35, paddingTop: 30 },
  navTabs: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 35 },
  tabItem: { alignItems: 'center', flex: 1 },
  tabLabel: { fontSize: 9, fontWeight: '900', marginTop: 10, letterSpacing: 1.5 },
  controlSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 35 },
  sizeBtn: { padding: 10, width: 50, alignItems: 'center' },
  alignmentRow: { flexDirection: 'row', width: 180, justifyContent: 'space-around', borderWidth: 1, padding: 12, borderRadius: 25 },
  footerActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  themePalette: { flexDirection: 'row', width: 180, justifyContent: 'space-between' },
  themeDot: { width: 34, height: 34, borderRadius: 17 },
  weaveButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 30, paddingVertical: 18, borderRadius: 35 },
  weaveText: { color: '#000', fontWeight: '900', marginLeft: 15, fontSize: 15, letterSpacing: 2 }
});