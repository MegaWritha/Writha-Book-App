import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Dimensions,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot,
  orderBy, limit, getDocs,
} from "firebase/firestore";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#0F071A", ui: "#1E1135", ui2: "#2D1B4D",
  accent: "#FFD700", purple: "#6D28D9", purpleLight: "#A78BFA",
  text: "#E2E8F0", textMuted: "#94A3B8",
  green: "#22C55E", red: "#EF4444", blue: "#38BDF8",
};

export default function AnalyticsScreen() {
  const router = useRouter();

  const [loading,     setLoading]     = useState(true);
  const [topBooks,    setTopBooks]    = useState<any[]>([]);
  const [topAuthors,  setTopAuthors]  = useState<any[]>([]);
  const [stats,       setStats]       = useState({
    totalUsers:     0,
    totalBooks:     0,
    publishedBooks: 0,
    draftBooks:     0,
    freeBooks:      0,
    paidBooks:      0,
    totalFeedPosts: 0,
    totalWeaves:    0,
    totalComments:  0,
  });

  // ── LOAD ALL STATS ───────────────────────────────────────────────
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    // Users
    unsubs.push(onSnapshot(collection(db, "users"), (snap) =>
      setStats((s) => ({ ...s, totalUsers: snap.size }))
    ));

    // All books
    unsubs.push(onSnapshot(collection(db, "books"), (snap) => {
      const books   = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const pub     = books.filter((b) => b.status === "published").length;
      const draft   = books.filter((b) => b.status === "draft").length;
      const free    = books.filter((b) => b.isFree || b.price === 0).length;
      const paid    = books.filter((b) => !b.isFree && b.price > 0).length;

      // Top books by views
      const sorted  = [...books]
        .filter((b) => b.status === "published")
        .sort((a, b) => (b.viewsCount || b.views || 0) - (a.viewsCount || a.views || 0))
        .slice(0, 5);

      // Top authors by book count
      const authorMap: Record<string, { name: string; count: number; views: number }> = {};
      books
        .filter((b) => b.status === "published")
        .forEach((b) => {
          const id   = b.authorId || "unknown";
          const name = b.authorName || "Unknown";
          if (!authorMap[id]) authorMap[id] = { name, count: 0, views: 0 };
          authorMap[id].count++;
          authorMap[id].views += b.viewsCount || b.views || 0;
        });

      const authors = Object.entries(authorMap)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 5);

      setTopBooks(sorted);
      setTopAuthors(authors);
      setStats((s) => ({
        ...s,
        totalBooks:     books.length,
        publishedBooks: pub,
        draftBooks:     draft,
        freeBooks:      free,
        paidBooks:      paid,
      }));
    }));

    // Feed posts
    unsubs.push(onSnapshot(collection(db, "feed"), (snap) =>
      setStats((s) => ({ ...s, totalFeedPosts: snap.size }))
    ));

    // Weaves
    unsubs.push(onSnapshot(collection(db, "weaves"), (snap) =>
      setStats((s) => ({ ...s, totalWeaves: snap.size }))
    ));

    setLoading(false);
    return () => unsubs.forEach((u) => u());
  }, []);

  if (loading) return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={THEME.accent} />
    </View>
  );

  const bookBreakdown = [
    { label: "Published", value: stats.publishedBooks, color: THEME.green  },
    { label: "Drafts",    value: stats.draftBooks,     color: THEME.accent },
    { label: "Free",      value: stats.freeBooks,      color: THEME.blue   },
    { label: "Paid",      value: stats.paidBooks,      color: THEME.purple },
  ];

  const contentStats = [
    { label: "Feed Posts", value: stats.totalFeedPosts, icon: "newspaper",      color: THEME.blue   },
    { label: "Weaves",     value: stats.totalWeaves,    icon: "pencil",         color: THEME.purple },
    { label: "Users",      value: stats.totalUsers,     icon: "people",         color: THEME.green  },
    { label: "Books",      value: stats.totalBooks,     icon: "library-outline", color: THEME.accent },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={THEME.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ANALYTICS</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* CONTENT STATS */}
        <Text style={styles.sectionLabel}>PLATFORM OVERVIEW</Text>
        <View style={styles.statGrid}>
          {contentStats.map((s) => (
            <View key={s.label} style={[styles.statCard, { borderColor: s.color + "30" }]}>
              <Ionicons name={s.icon as any} size={24} color={s.color} />
              <Text style={[styles.statValue, { color: s.color }]}>{s.value.toLocaleString()}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* BOOK BREAKDOWN */}
        <Text style={styles.sectionLabel}>BOOK BREAKDOWN</Text>
        <View style={styles.breakdownCard}>
          {bookBreakdown.map((item) => {
            const pct = stats.totalBooks > 0
              ? Math.round((item.value / stats.totalBooks) * 100)
              : 0;
            return (
              <View key={item.label} style={styles.breakdownRow}>
                <View style={[styles.breakdownDot, { backgroundColor: item.color }]} />
                <Text style={styles.breakdownLabel}>{item.label}</Text>
                <View style={styles.breakdownBarWrap}>
                  <View style={[styles.breakdownBar, {
                    width: `${pct}%`,
                    backgroundColor: item.color,
                  }]} />
                </View>
                <Text style={[styles.breakdownPct, { color: item.color }]}>{item.value}</Text>
              </View>
            );
          })}
        </View>

        {/* TOP BOOKS */}
        <Text style={styles.sectionLabel}>TOP BOOKS BY VIEWS</Text>
        <View style={styles.listCard}>
          {topBooks.length === 0 ? (
            <Text style={styles.emptyTxt}>No published books yet</Text>
          ) : topBooks.map((book, i) => (
            <View key={book.id} style={[
              styles.listRow,
              i < topBooks.length - 1 && styles.listRowBorder,
            ]}>
              <Text style={[styles.rankNum, { color: i === 0 ? THEME.accent : THEME.textMuted }]}>
                #{i + 1}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle} numberOfLines={1}>{book.title}</Text>
                <Text style={styles.listSub}>{book.authorName || "Unknown"}</Text>
              </View>
              <View style={styles.viewsBadge}>
                <Ionicons name="eye-outline" size={12} color={THEME.blue} />
                <Text style={[styles.viewsNum, { color: THEME.blue }]}>
                  {(book.viewsCount || book.views || 0).toLocaleString()}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* TOP AUTHORS */}
        <Text style={styles.sectionLabel}>TOP AUTHORS BY REACH</Text>
        <View style={styles.listCard}>
          {topAuthors.length === 0 ? (
            <Text style={styles.emptyTxt}>No authors yet</Text>
          ) : topAuthors.map((author, i) => (
            <View key={author.id} style={[
              styles.listRow,
              i < topAuthors.length - 1 && styles.listRowBorder,
            ]}>
              <Text style={[styles.rankNum, { color: i === 0 ? THEME.accent : THEME.textMuted }]}>
                #{i + 1}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle} numberOfLines={1}>{author.name}</Text>
                <Text style={styles.listSub}>{author.count} book{author.count > 1 ? "s" : ""}</Text>
              </View>
              <View style={styles.viewsBadge}>
                <Ionicons name="eye-outline" size={12} color={THEME.purple} />
                <Text style={[styles.viewsNum, { color: THEME.purple }]}>
                  {author.views.toLocaleString()} views
                </Text>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: THEME.bg },
  loader:         { flex: 1, backgroundColor: THEME.bg, justifyContent: "center", alignItems: "center" },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  backBtn:        { width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  headerTitle:    { color: THEME.accent, fontSize: 14, fontWeight: "900", letterSpacing: 3 },
  sectionLabel:   { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginLeft: 20, marginBottom: 12, marginTop: 20 },
  statGrid:       { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 20, gap: 12 },
  statCard:       { width: (width - 52) / 2, backgroundColor: THEME.ui, borderRadius: 18, padding: 18, alignItems: "center", borderWidth: 1, gap: 8 },
  statValue:      { fontSize: 28, fontWeight: "900" },
  statLabel:      { color: THEME.textMuted, fontSize: 11, textAlign: "center" },
  breakdownCard:  { marginHorizontal: 20, backgroundColor: THEME.ui, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: THEME.ui2, gap: 14 },
  breakdownRow:   { flexDirection: "row", alignItems: "center", gap: 10 },
  breakdownDot:   { width: 10, height: 10, borderRadius: 5 },
  breakdownLabel: { color: THEME.text, fontSize: 12, fontWeight: "700", width: 70 },
  breakdownBarWrap: { flex: 1, height: 6, backgroundColor: THEME.ui2, borderRadius: 3, overflow: "hidden" },
  breakdownBar:   { height: "100%", borderRadius: 3 },
  breakdownPct:   { fontSize: 12, fontWeight: "900", width: 35, textAlign: "right" },
  listCard:       { marginHorizontal: 20, backgroundColor: THEME.ui, borderRadius: 18, borderWidth: 1, borderColor: THEME.ui2, overflow: "hidden" },
  listRow:        { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  listRowBorder:  { borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  rankNum:        { fontSize: 14, fontWeight: "900", width: 28 },
  listTitle:      { color: THEME.text, fontSize: 13, fontWeight: "800" },
  listSub:        { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  viewsBadge:     { flexDirection: "row", alignItems: "center", gap: 4 },
  viewsNum:       { fontSize: 11, fontWeight: "700" },
  emptyTxt:       { color: THEME.textMuted, fontSize: 13, textAlign: "center", padding: 20 },
});