import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { BookCard } from "@/components/BookCard";
import { GenreChip } from "@/components/GenreChip";
import { getBooks, getUser, Book, User } from "@/lib/storage";
import * as Haptics from "expo-haptics";

const GENRES = [
  "All",
  "African Mythology",
  "Romance",
  "Education",
  "Science Fiction",
  "Poetry",
  "Historical",
];

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [books, setBooks] = useState<Book[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [selectedGenre, setSelectedGenre] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const [booksData, userData] = await Promise.all([getBooks(), getUser()]);
    setBooks(booksData.filter((b) => b.status === "published"));
    setUser(userData);
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filteredBooks = books.filter((book) => {
    const matchesGenre = selectedGenre === "All" || book.genre === selectedGenre;
    const matchesSearch =
      searchQuery === "" ||
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesGenre && matchesSearch;
  });

  const trendingBooks = [...filteredBooks].sort((a, b) => b.reads - a.reads);
  const topRatedBooks = [...filteredBooks].sort((a, b) => b.rating - a.rating);

  const webTopPadding = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + webTopPadding + 16, paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              Welcome back,
            </Text>
            <Text style={[styles.userName, { color: colors.text }]}>
              {user?.name?.split(" ")[0] || "Reader"}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/profile");
            }}
            style={[styles.notificationBtn, { backgroundColor: colors.surfaceSecondary }]}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={[styles.searchContainer, { backgroundColor: colors.surfaceSecondary }]}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search books, authors..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        <LinearGradient
          colors={isDark ? ["#2D1B15", "#1A1A1A"] : ["#E8A090", "#FDF8F3"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.featuredBanner}
        >
          <View style={styles.featuredContent}>
            <Text style={[styles.featuredLabel, { color: isDark ? colors.secondary : colors.primary }]}>
              Featured Story
            </Text>
            <Text style={[styles.featuredTitle, { color: isDark ? "#FFF" : "#1A1A1A" }]}>
              Whispers of the{"\n"}Ancestors
            </Text>
            <Text style={[styles.featuredAuthor, { color: isDark ? colors.textSecondary : "#4A4A4A" }]}>
              by Amara Okonkwo
            </Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/book/book_1");
              }}
              style={[styles.featuredBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.featuredBtnText}>Start Reading</Text>
            </Pressable>
          </View>
          <View style={styles.featuredDecor}>
            <Ionicons name="book" size={120} color={isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"} />
          </View>
        </LinearGradient>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.genresContainer}
        >
          {GENRES.map((genre) => (
            <GenreChip
              key={genre}
              label={genre}
              selected={selectedGenre === genre}
              onPress={() => setSelectedGenre(genre)}
            />
          ))}
        </ScrollView>

        {trendingBooks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Trending Now
              </Text>
              <Pressable>
                <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.booksRow}
            >
              {trendingBooks.slice(0, 5).map((book) => (
                <BookCard key={book.id} book={book} size="medium" />
              ))}
            </ScrollView>
          </View>
        )}

        {topRatedBooks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Top Rated
              </Text>
              <Pressable>
                <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.booksRow}
            >
              {topRatedBooks.slice(0, 5).map((book) => (
                <BookCard key={book.id} book={book} size="medium" />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Continue Reading
            </Text>
          </View>
          {books.length > 0 ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/book/book_1");
              }}
              style={[styles.continueCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.continueProgress}>
                <View style={[styles.progressBar, { backgroundColor: colors.surfaceSecondary }]}>
                  <View style={[styles.progressFill, { backgroundColor: colors.primary, width: "35%" }]} />
                </View>
                <Text style={[styles.progressText, { color: colors.textMuted }]}>35% completed</Text>
              </View>
              <View style={styles.continueContent}>
                <View style={styles.continueInfo}>
                  <Text style={[styles.continueTitle, { color: colors.text }]} numberOfLines={1}>
                    Whispers of the Ancestors
                  </Text>
                  <Text style={[styles.continueChapter, { color: colors.textSecondary }]}>
                    Chapter 2: The Forest Speaks
                  </Text>
                </View>
                <Ionicons name="play-circle" size={40} color={colors.primary} />
              </View>
            </Pressable>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: colors.surfaceSecondary }]}>
              <Ionicons name="book-outline" size={40} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Start reading to track your progress
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  greeting: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  userName: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  featuredBanner: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    overflow: "hidden",
    position: "relative",
  },
  featuredContent: {
    flex: 1,
    zIndex: 1,
  },
  featuredLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  featuredTitle: {
    fontSize: 26,
    fontFamily: "Lora_700Bold",
    lineHeight: 32,
    marginBottom: 6,
  },
  featuredAuthor: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 16,
  },
  featuredBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  featuredBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  featuredDecor: {
    position: "absolute",
    right: -20,
    bottom: -20,
    opacity: 0.5,
  },
  genresContainer: {
    paddingBottom: 20,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  seeAll: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  booksRow: {
    paddingRight: 20,
  },
  continueCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  continueProgress: {
    marginBottom: 12,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
  },
  continueContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  continueInfo: {
    flex: 1,
    marginRight: 12,
  },
  continueTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  continueChapter: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  emptyState: {
    padding: 32,
    borderRadius: 16,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
