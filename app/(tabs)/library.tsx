import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { BookCard } from "@/components/BookCard";
import { getBooks, getUser, Book, User } from "@/lib/storage";
import * as Haptics from "expo-haptics";

type TabType = "published" | "drafts" | "reading";

export default function LibraryScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [books, setBooks] = useState<Book[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("reading");
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const [booksData, userData] = await Promise.all([getBooks(), getUser()]);
    setBooks(booksData);
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

  const myBooks = books.filter((b) => b.authorId === user?.id && b.status === "published");
  const myDrafts = books.filter((b) => b.authorId === user?.id && b.status === "draft");
  const readingList = books.filter((b) => b.authorId !== user?.id);

  const getCurrentBooks = () => {
    switch (activeTab) {
      case "published":
        return myBooks;
      case "drafts":
        return myDrafts;
      case "reading":
        return readingList;
      default:
        return [];
    }
  };

  const webTopPadding = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopPadding + 16 }]}>
        <Text style={[styles.title, { color: colors.text }]}>My Library</Text>
        {user?.isWriter && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/write");
            }}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="add" size={22} color="#FFF" />
          </Pressable>
        )}
      </View>

      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(["reading", "published", "drafts"] as TabType[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab(tab);
            }}
            style={[
              styles.tab,
              activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? colors.primary : colors.textSecondary },
              ]}
            >
              {tab === "reading" ? "Reading" : tab === "published" ? "Published" : "Drafts"}
            </Text>
            <View
              style={[
                styles.badge,
                { backgroundColor: activeTab === tab ? colors.primary : colors.surfaceSecondary },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: activeTab === tab ? "#FFF" : colors.textSecondary },
                ]}
              >
                {tab === "reading"
                  ? readingList.length
                  : tab === "published"
                  ? myBooks.length
                  : myDrafts.length}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {getCurrentBooks().length > 0 ? (
          <View style={styles.booksGrid}>
            {getCurrentBooks().map((book) => (
              <View key={book.id} style={styles.bookWrapper}>
                <BookCard book={book} size="medium" showAuthor={activeTab === "reading"} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons
              name={
                activeTab === "reading"
                  ? "book-outline"
                  : activeTab === "published"
                  ? "library-outline"
                  : "document-outline"
              }
              size={48}
              color={colors.textMuted}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {activeTab === "reading"
                ? "No books in your reading list"
                : activeTab === "published"
                ? "No published works yet"
                : "No drafts yet"}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {activeTab === "reading"
                ? "Browse the home page to discover new stories"
                : "Start writing your first story today"}
            </Text>
            {activeTab !== "reading" && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push("/write");
                }}
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="create-outline" size={18} color="#FFF" />
                <Text style={styles.emptyBtnText}>Start Writing</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: 20,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    marginRight: 24,
    gap: 8,
  },
  tabText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  content: {
    padding: 20,
  },
  booksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -8,
  },
  bookWrapper: {
    width: "50%",
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 24,
  },
  emptyBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
