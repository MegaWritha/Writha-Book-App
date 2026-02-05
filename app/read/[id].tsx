import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { useTheme } from "@/contexts/ThemeContext";
import { getBook, Book, saveReadingProgress, getReadingProgress, ReadingProgress } from "@/lib/storage";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ReadScreen() {
  const { id, chapter } = useLocalSearchParams<{ id: string; chapter: string }>();
  const { colors, isDark, settings, updateSettings, toggleNightMode } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [currentChapter, setCurrentChapter] = useState(parseInt(chapter || "0", 10));
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  const controlsOpacity = useSharedValue(1);

  useEffect(() => {
    (async () => {
      if (id) {
        const bookData = await getBook(id);
        setBook(bookData);

        const progress = await getReadingProgress();
        const bookProgress = progress.find((p) => p.bookId === id);
        if (bookProgress) {
          setCurrentChapter(bookProgress.chapterIndex);
        }
      }
    })();
  }, [id]);

  useEffect(() => {
    if (book) {
      saveProgress();
    }
  }, [currentChapter, book]);

  const saveProgress = async () => {
    if (!book) return;
    const progress = await getReadingProgress();
    const existingIndex = progress.findIndex((p) => p.bookId === book.id);
    const newProgress: ReadingProgress = {
      bookId: book.id,
      chapterIndex: currentChapter,
      scrollPosition: 0,
      lastRead: new Date().toISOString(),
    };
    if (existingIndex >= 0) {
      progress[existingIndex] = newProgress;
    } else {
      progress.push(newProgress);
    }
    await saveReadingProgress(progress);
  };

  const toggleControls = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowControls(!showControls);
    controlsOpacity.value = withTiming(showControls ? 0 : 1, { duration: 200 });
  };

  const goToChapter = (index: number) => {
    if (!book) return;
    if (index >= 0 && index < book.chapters.length) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCurrentChapter(index);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  };

  const headerStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
    transform: [
      {
        translateY: interpolate(controlsOpacity.value, [0, 1], [-50, 0]),
      },
    ],
  }));

  const footerStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
    transform: [
      {
        translateY: interpolate(controlsOpacity.value, [0, 1], [50, 0]),
      },
    ],
  }));

  const webTopPadding = Platform.OS === "web" ? 67 : 0;

  if (!book || book.chapters.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? "#0D0D0D" : "#FDF8F3" }]}>
        <View style={[styles.loading, { paddingTop: insets.top + webTopPadding }]}>
          <Ionicons name="book-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading chapter...
          </Text>
        </View>
      </View>
    );
  }

  const currentChapterData = book.chapters[currentChapter];
  const progress = ((currentChapter + 1) / book.chapters.length) * 100;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#0D0D0D" : "#FDF8F3" }]}>
      <Pressable onPress={toggleControls} style={styles.contentArea}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + webTopPadding + 80,
              paddingBottom: 120,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.chapterTitle, { color: colors.text }]}>
            {currentChapterData.title}
          </Text>
          <Text
            style={[
              styles.chapterContent,
              {
                color: colors.text,
                fontSize: settings.fontSize,
                fontFamily: settings.fontFamily === "serif" ? "Lora_400Regular" : "Inter_400Regular",
                lineHeight: settings.fontSize * 1.8,
              },
            ]}
          >
            {currentChapterData.content}
          </Text>

          <View style={styles.chapterEnd}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.endText, { color: colors.textMuted }]}>
              End of Chapter {currentChapter + 1}
            </Text>
            {currentChapter < book.chapters.length - 1 && (
              <Pressable
                onPress={() => goToChapter(currentChapter + 1)}
                style={[styles.nextChapterBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.nextChapterBtnText}>Next Chapter</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </Pressable>
            )}
          </View>
        </ScrollView>
      </Pressable>

      <Animated.View
        style={[
          styles.header,
          headerStyle,
          {
            paddingTop: insets.top + webTopPadding,
            backgroundColor: isDark ? "rgba(13,13,13,0.95)" : "rgba(253,248,243,0.95)",
          },
        ]}
        pointerEvents={showControls ? "auto" : "none"}
      >
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {book.title}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Chapter {currentChapter + 1} of {book.chapters.length}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setBookmarked(!bookmarked);
            }}
            style={styles.headerBtn}
          >
            <Ionicons
              name={bookmarked ? "bookmark" : "bookmark-outline"}
              size={24}
              color={bookmarked ? colors.primary : colors.text}
            />
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowSettings(!showSettings);
            }}
            style={styles.headerBtn}
          >
            <Ionicons name="settings-outline" size={24} color={colors.text} />
          </Pressable>
        </View>
      </Animated.View>

      {showSettings && showControls && (
        <View
          style={[
            styles.settingsPanel,
            {
              top: insets.top + webTopPadding + 60,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Font Size</Text>
            <View style={styles.fontSizeControl}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateSettings({ fontSize: Math.max(14, settings.fontSize - 2) });
                }}
                style={[styles.fontBtn, { backgroundColor: colors.surfaceSecondary }]}
              >
                <Text style={[styles.fontBtnText, { color: colors.text }]}>A-</Text>
              </Pressable>
              <Text style={[styles.fontSizeValue, { color: colors.text }]}>{settings.fontSize}</Text>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateSettings({ fontSize: Math.min(28, settings.fontSize + 2) });
                }}
                style={[styles.fontBtn, { backgroundColor: colors.surfaceSecondary }]}
              >
                <Text style={[styles.fontBtnText, { color: colors.text }]}>A+</Text>
              </Pressable>
            </View>
          </View>
          <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />
          <Pressable onPress={toggleNightMode} style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Night Mode</Text>
            <View
              style={[
                styles.toggle,
                { backgroundColor: settings.nightMode ? colors.primary : colors.surfaceSecondary },
              ]}
            >
              <View
                style={[styles.toggleThumb, { transform: [{ translateX: settings.nightMode ? 18 : 2 }] }]}
              />
            </View>
          </Pressable>
          <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Font</Text>
            <View style={styles.fontPicker}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateSettings({ fontFamily: "serif" });
                }}
                style={[
                  styles.fontOption,
                  {
                    backgroundColor: settings.fontFamily === "serif" ? colors.primary : colors.surfaceSecondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.fontOptionText,
                    {
                      fontFamily: "Lora_400Regular",
                      color: settings.fontFamily === "serif" ? "#FFF" : colors.text,
                    },
                  ]}
                >
                  Serif
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateSettings({ fontFamily: "sans" });
                }}
                style={[
                  styles.fontOption,
                  {
                    backgroundColor: settings.fontFamily === "sans" ? colors.primary : colors.surfaceSecondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.fontOptionText,
                    {
                      fontFamily: "Inter_400Regular",
                      color: settings.fontFamily === "sans" ? "#FFF" : colors.text,
                    },
                  ]}
                >
                  Sans
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      <Animated.View
        style={[
          styles.footer,
          footerStyle,
          {
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 16,
            backgroundColor: isDark ? "rgba(13,13,13,0.95)" : "rgba(253,248,243,0.95)",
          },
        ]}
        pointerEvents={showControls ? "auto" : "none"}
      >
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progress}%` }]} />
          </View>
          <Text style={[styles.progressText, { color: colors.textMuted }]}>{Math.round(progress)}%</Text>
        </View>
        <View style={styles.chapterNav}>
          <Pressable
            onPress={() => goToChapter(currentChapter - 1)}
            disabled={currentChapter === 0}
            style={[
              styles.chapterNavBtn,
              { backgroundColor: colors.surfaceSecondary, opacity: currentChapter === 0 ? 0.4 : 1 },
            ]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
            <Text style={[styles.chapterNavText, { color: colors.text }]}>Previous</Text>
          </Pressable>
          <Pressable
            onPress={() => goToChapter(currentChapter + 1)}
            disabled={currentChapter === book.chapters.length - 1}
            style={[
              styles.chapterNavBtn,
              {
                backgroundColor: colors.surfaceSecondary,
                opacity: currentChapter === book.chapters.length - 1 ? 0.4 : 1,
              },
            ]}
          >
            <Text style={[styles.chapterNavText, { color: colors.text }]}>Next</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  contentArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  chapterTitle: {
    fontSize: 28,
    fontFamily: "Lora_700Bold",
    marginBottom: 32,
    textAlign: "center",
  },
  chapterContent: {
    textAlign: "justify",
  },
  chapterEnd: {
    alignItems: "center",
    marginTop: 48,
  },
  divider: {
    width: 60,
    height: 2,
    borderRadius: 1,
    marginBottom: 16,
  },
  endText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 24,
  },
  nextChapterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  nextChapterBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
  },
  settingsPanel: {
    position: "absolute",
    right: 16,
    width: SCREEN_WIDTH - 32,
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  settingLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  settingDivider: {
    height: 1,
    marginVertical: 8,
  },
  fontSizeControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fontBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  fontBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  fontSizeValue: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    minWidth: 28,
    textAlign: "center",
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFF",
  },
  fontPicker: {
    flexDirection: "row",
    gap: 8,
  },
  fontOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  fontOptionText: {
    fontSize: 13,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    minWidth: 36,
  },
  chapterNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  chapterNavBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  chapterNavText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
