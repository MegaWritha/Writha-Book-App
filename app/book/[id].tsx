import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/contexts/ThemeContext";
import { getBook, Book, formatNumber, formatCurrency } from "@/lib/storage";
import * as Haptics from "expo-haptics";

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [book, setBook] = useState<Book | null>(null);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    (async () => {
      if (id) {
        const bookData = await getBook(id);
        setBook(bookData);
      }
    })();
  }, [id]);

  const webTopPadding = Platform.OS === "web" ? 67 : 0;

  if (!book) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.loading, { paddingTop: insets.top + webTopPadding }]}>
          <Ionicons name="book-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading book...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <LinearGradient
            colors={isDark ? ["#2D1B15", "#0D0D0D"] : ["#E8A090", "#FDF8F3"]}
            style={[styles.heroGradient, { paddingTop: insets.top + webTopPadding }]}
          >
            <View style={styles.headerNav}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.back();
                }}
                style={[styles.navBtn, { backgroundColor: "rgba(255,255,255,0.2)" }]}
              >
                <Ionicons name="arrow-back" size={22} color={isDark ? "#FFF" : "#1A1A1A"} />
              </Pressable>
              <View style={styles.headerActions}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[styles.navBtn, { backgroundColor: "rgba(255,255,255,0.2)" }]}
                >
                  <Ionicons name="share-outline" size={22} color={isDark ? "#FFF" : "#1A1A1A"} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setLiked(!liked);
                  }}
                  style={[styles.navBtn, { backgroundColor: "rgba(255,255,255,0.2)" }]}
                >
                  <Ionicons
                    name={liked ? "heart" : "heart-outline"}
                    size={22}
                    color={liked ? colors.error : isDark ? "#FFF" : "#1A1A1A"}
                  />
                </Pressable>
              </View>
            </View>

            <View style={styles.coverSection}>
              <View style={styles.coverContainer}>
                <Image
                  source={{ uri: book.cover }}
                  style={styles.cover}
                  contentFit="cover"
                  transition={200}
                />
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>{book.title}</Text>
          <Pressable style={styles.authorRow}>
            <LinearGradient
              colors={[colors.primary, colors.primaryLight]}
              style={styles.authorAvatar}
            >
              <Text style={styles.authorAvatarText}>
                {book.author.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </Text>
            </LinearGradient>
            <View>
              <Text style={[styles.authorName, { color: colors.text }]}>{book.author}</Text>
              <Text style={[styles.authorLabel, { color: colors.textSecondary }]}>Author</Text>
            </View>
          </Pressable>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="eye" size={18} color={colors.textSecondary} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatNumber(book.reads)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Reads</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Ionicons name="heart" size={18} color={colors.error} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatNumber(book.likes)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Likes</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Ionicons name="star" size={18} color={colors.gold} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {book.rating > 0 ? book.rating.toFixed(1) : "N/A"}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Rating</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Ionicons name="book" size={18} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {book.chapters.length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Chapters</Text>
            </View>
          </View>

          <View style={[styles.genreRow, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="pricetag" size={16} color={colors.primary} />
            <Text style={[styles.genreText, { color: colors.text }]}>{book.genre}</Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {book.description}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Chapters</Text>
            {book.chapters.length > 0 ? (
              book.chapters.map((chapter, index) => (
                <Pressable
                  key={chapter.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/read/${book.id}?chapter=${index}`);
                  }}
                  style={({ pressed }) => [
                    styles.chapterItem,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <View style={[styles.chapterNumber, { backgroundColor: colors.surfaceSecondary }]}>
                    <Text style={[styles.chapterNumberText, { color: colors.text }]}>{index + 1}</Text>
                  </View>
                  <View style={styles.chapterInfo}>
                    <Text style={[styles.chapterTitle, { color: colors.text }]}>{chapter.title}</Text>
                    <Text style={[styles.chapterMeta, { color: colors.textMuted }]}>
                      {chapter.wordCount} words
                    </Text>
                  </View>
                  {chapter.isPaid && (
                    <View style={[styles.paidBadge, { backgroundColor: colors.gold }]}>
                      <Text style={styles.paidBadgeText}>{formatCurrency(chapter.price)}</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyChapters}>
                <Ionicons name="document-outline" size={32} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No chapters available yet
                </Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Tags</Text>
            <View style={styles.tagsRow}>
              {book.tags.map((tag, index) => (
                <View key={index} style={[styles.tag, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={[styles.tagText, { color: colors.textSecondary }]}>#{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0),
          },
        ]}
      >
        {book.isPaid && (
          <View style={styles.priceContainer}>
            <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Price</Text>
            <Text style={[styles.priceValue, { color: colors.text }]}>{formatCurrency(book.price)}</Text>
          </View>
        )}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push(`/read/${book.id}?chapter=0`);
          }}
          style={[
            styles.readBtn,
            { backgroundColor: colors.primary, flex: book.isPaid ? 1 : undefined },
          ]}
        >
          <Ionicons name="book" size={20} color="#FFF" />
          <Text style={styles.readBtnText}>
            {book.isPaid ? "Purchase & Read" : "Start Reading"}
          </Text>
        </Pressable>
      </View>
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
  heroSection: {},
  heroGradient: {
    paddingBottom: 40,
  },
  headerNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
  },
  coverSection: {
    alignItems: "center",
    marginTop: 20,
  },
  coverContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  cover: {
    width: 180,
    height: 270,
    borderRadius: 12,
  },
  content: {
    paddingHorizontal: 20,
    marginTop: -20,
  },
  title: {
    fontSize: 26,
    fontFamily: "Lora_700Bold",
    textAlign: "center",
    marginBottom: 16,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 24,
  },
  authorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  authorAvatarText: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  authorName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  authorLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: 16,
  },
  statValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  genreRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 24,
  },
  genreText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 24,
  },
  chapterItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  chapterNumber: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  chapterNumberText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  chapterInfo: {
    flex: 1,
    marginRight: 8,
  },
  chapterTitle: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    marginBottom: 2,
  },
  chapterMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  paidBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  paidBadgeText: {
    color: "#FFF",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  emptyChapters: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 16,
  },
  priceContainer: {},
  priceLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  priceValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  readBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  readBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
