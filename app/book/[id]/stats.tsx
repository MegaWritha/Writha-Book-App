import React, { useEffect, useState } from "react";
import {
  View, Text, FlatList, StyleSheet, Image, TouchableOpacity,
  ActivityIndicator, Dimensions, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot, doc, getDoc, orderBy, limit,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

const THEME = {
  bg:           "#0F071A",
  ui:           "#1E1135",
  ui2:          "#2D1B4D",
  accent:       "#FFD700",
  accentDim:    "rgba(255,215,0,0.08)",
  purple:       "#6D28D9",
  purpleLight:  "#A78BFA",
  text:         "#EDE8F5",
  textMuted:    "#7A6E8A",
  green:        "#22C55E",
  red:          "#EF4444",
  blue:         "#38BDF8",
};

type StatType = "overview" | "likes" | "comments" | "weaves";

const TABS: { key: StatType; label: string; icon: string }[] = [
  { key: "overview",  label: "Overview",  icon: "bar-chart-outline"    },
  { key: "likes",     label: "Likes",     icon: "heart-outline"        },
  { key: "comments",  label: "Comments",  icon: "chatbubble-outline"   },
  { key: "weaves",    label: "Weaves",    icon: "git-network-outline"  },
];

const formatTime = (ts: any): string => {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// ── EMPTY STATE ───────────────────────────────────────────────────────────
const EmptyState = ({ icon, label }: { icon: string; label: string }) => (
  <View style={styles.emptyState}>
    <Ionicons name={icon as any} size={52} color={THEME.ui2} />
    <Text style={styles.emptyTitle}>{label}</Text>
    <Text style={styles.emptySub}>Be the first to interact with this book!</Text>
  </View>
);

// ── STAT BAR ──────────────────────────────────────────────────────────────
const StatBar = ({
  label, val, max, color,
}: {
  label: string; val: number; max: number; color: string;
}) => (
  <View style={styles.statBarRow}>
    <Text style={styles.statBarLabel}>{label}</Text>
    <View style={styles.statBarTrack}>
      <View
        style={[
          styles.statBarFill,
          {
            width: `${Math.min(100, max > 0 ? (val / max) * 100 : 0)}%`,
            backgroundColor: color,
          },
        ]}
      />
    </View>
    <Text style={[styles.statBarVal, { color }]}>{val?.toLocaleString() || 0}</Text>
  </View>
);

// ── MAIN SCREEN ───────────────────────────────────────────────────────────
export default function BookStatsList() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const bookId = Array.isArray(id) ? id[0] : (id as string);

  const [activeTab, setActiveTab]   = useState<StatType>("overview");
  const [loading, setLoading]       = useState(true);
  const [book, setBook]             = useState<any>(null);
  const [likers, setLikers]         = useState<any[]>([]);
  const [comments, setComments]     = useState<any[]>([]);
  const [weaves, setWeaves]         = useState<any[]>([]);

  // ── BOOK INFO ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!bookId) return;
    getDoc(doc(db, "books", bookId)).then((snap) => {
      if (snap.exists()) setBook({ id: snap.id, ...snap.data() });
      setLoading(false);
    });
  }, [bookId]);

  // ── LIKERS ────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== "likes" || !bookId) return;
    const q = query(
      collection(db, "books", bookId, "likers"),
      orderBy("timestamp", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      setLikers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [activeTab, bookId]);

  // ── COMMENTS ──────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== "comments" || !bookId) return;
    const q = query(
      collection(db, "books", bookId, "comments"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [activeTab, bookId]);

  // ── WEAVES ────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== "weaves" || !bookId) return;
    const q = query(
      collection(db, "weaves"),
      where("bookId", "==", bookId),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      setWeaves(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [activeTab, bookId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={THEME.accent} size="large" />
        <Text style={{ color: THEME.textMuted, marginTop: 12 }}>Loading analytics...</Text>
      </View>
    );
  }

  const maxStat = Math.max(
    book?.views        || 0,
    book?.likesCount   || 0,
    book?.commentsCount|| 0,
    book?.weavesCount  || 0,
    1
  );

  // ── RENDER ────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>

      {/* HEADER */}
      <LinearGradient colors={["#1A0B2E", THEME.bg]} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={THEME.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Book Analytics</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{book?.title}</Text>
        </View>
      </LinearGradient>

      {/* TABS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabContent}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={14}
              color={activeTab === tab.key ? "#000" : THEME.textMuted}
            />
            <Text style={[styles.tabTxt, activeTab === tab.key && styles.tabTxtActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <ScrollView contentContainerStyle={styles.overviewContent} showsVerticalScrollIndicator={false}>

          {/* Headline grid */}
          <View style={styles.headlineGrid}>
            {[
              { label: "READS",    val: book?.views         || 0, color: THEME.blue,        icon: "eye-outline"         },
              { label: "LIKES",    val: book?.likesCount    || 0, color: THEME.red,         icon: "heart-outline"       },
              { label: "COMMENTS", val: book?.commentsCount || 0, color: THEME.purpleLight, icon: "chatbubble-outline"  },
              { label: "WEAVES",   val: book?.weavesCount   || 0, color: THEME.accent,      icon: "git-network-outline" },
            ].map((stat) => (
              <View key={stat.label} style={styles.headlineTile}>
                <View style={[styles.headlineIcon, { backgroundColor: stat.color + "20" }]}>
                  <Ionicons name={stat.icon as any} size={18} color={stat.color} />
                </View>
                <Text style={[styles.headlineVal, { color: stat.color }]}>
                  {stat.val.toLocaleString()}
                </Text>
                <Text style={styles.headlineLbl}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Engagement bar chart */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>ENGAGEMENT BREAKDOWN</Text>
            <StatBar label="Views"    val={book?.views         || 0} max={maxStat} color={THEME.blue}        />
            <StatBar label="Likes"    val={book?.likesCount    || 0} max={maxStat} color={THEME.red}         />
            <StatBar label="Comments" val={book?.commentsCount || 0} max={maxStat} color={THEME.purpleLight} />
            <StatBar label="Weaves"   val={book?.weavesCount   || 0} max={maxStat} color={THEME.accent}      />
          </View>

          {/* Book details */}
          <View style={styles.bookInfoCard}>
            <Text style={styles.chartTitle}>BOOK DETAILS</Text>
            {[
              { label: "Genre",     val: book?.genre || "—"                                    },
              { label: "Words",     val: book?.wordCount?.toLocaleString() || "—"              },
              { label: "Price",     val: book?.isFree ? "Free" : `₦${book?.price || 0}`        },
              { label: "Status",    val: (book?.status || "—").toUpperCase()                   },
              {
                label: "Published",
                val: book?.createdAt
                  ? book.createdAt.toDate().toLocaleDateString("en-NG", {
                      month: "short", day: "numeric", year: "numeric",
                    })
                  : "—",
              },
            ].map((row) => (
              <View key={row.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoVal}>{row.val}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {/* ── LIKES TAB ── */}
      {activeTab === "likes" && (
        <FlatList
          data={likers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.listCard}
              onPress={() => router.push(`/profile/${item.userId || item.id}` as any)}
            >
              <Image
                source={{
                  uri:
                    item.photo ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || "U")}&background=2D1B4D&color=FFD700`,
                }}
                style={styles.listAvatar}
              />
              <View style={styles.listInfo}>
                <Text style={styles.listName}>{item.name || "Reader"}</Text>
                <Text style={styles.listMeta}>{formatTime(item.timestamp)}</Text>
              </View>
              <Ionicons name="heart" size={16} color={THEME.red} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={<EmptyState icon="heart-dislike-outline" label="No likes yet" />}
        />
      )}

      {/* ── COMMENTS TAB ── */}
      {activeTab === "comments" && (
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.listCard}
              onPress={() => router.push(`/profile/${item.userId}` as any)}
            >
              <Image
                source={{
                  uri:
                    item.userImg ||
                    item.userPhoto ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(item.userName || "U")}&background=2D1B4D&color=FFD700`,
                }}
                style={styles.listAvatar}
              />
              <View style={styles.listInfo}>
                <Text style={styles.listName}>{item.userName || "Reader"}</Text>
                <Text style={styles.listComment} numberOfLines={2}>
                  {item.text || item.content}
                </Text>
                <Text style={styles.listMeta}>{formatTime(item.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<EmptyState icon="chatbubble-outline" label="No comments yet" />}
        />
      )}

      {/* ── WEAVES TAB ── */}
      {activeTab === "weaves" && (
        <FlatList
          data={weaves}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.weaveCard}
              onPress={() => router.push(`/weave/${item.id}` as any)}
            >
              {/* Weave author row */}
              <View style={styles.weaveCardHeader}>
                <Image
                  source={{
                    uri:
                      item.creatorPhoto ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(item.creatorName || "U")}&background=2D1B4D&color=FFD700`,
                  }}
                  style={styles.weaveAvatar}
                />
                <View style={styles.listInfo}>
                  <Text style={styles.listName}>{item.creatorName || "Scholar"}</Text>
                  <Text style={styles.listMeta}>{formatTime(item.createdAt)}</Text>
                </View>
                {item.category && (
                  <View style={styles.weaveCatBadge}>
                    <Text style={styles.weaveCatTxt}>{item.category.toUpperCase()}</Text>
                  </View>
                )}
              </View>

              {/* Quoted passage */}
              {item.claim ? (
                <View style={styles.weaveQuote}>
                  <View style={styles.weaveQuoteBar} />
                  <Text style={styles.weaveQuoteTxt} numberOfLines={2}>
                    "{item.claim}"
                  </Text>
                </View>
              ) : null}

              {/* Commentary */}
              <Text style={styles.weaveCommentary} numberOfLines={3}>
                {item.commentary}
              </Text>

              {/* Footer stats */}
              <View style={styles.weaveFooter}>
                <View style={styles.weaveFooterStat}>
                  <Ionicons name="heart-outline" size={12} color={THEME.textMuted} />
                  <Text style={styles.weaveFooterTxt}>{item.likesCount || 0}</Text>
                </View>
                <View style={styles.weaveFooterStat}>
                  <Ionicons name="chatbubble-outline" size={12} color={THEME.textMuted} />
                  <Text style={styles.weaveFooterTxt}>{item.commentsCount || 0}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={THEME.ui2} />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<EmptyState icon="git-network-outline" label="No weaves yet" />}
        />
      )}

    </SafeAreaView>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: THEME.bg },
  center:       { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: THEME.bg },

  // Header
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 },
  backBtn:      { width: 40, height: 40, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.05)", justifyContent: "center", alignItems: "center" },
  headerTitle:  { color: THEME.text, fontSize: 20, fontWeight: "900" },
  headerSub:    { color: THEME.textMuted, fontSize: 12, marginTop: 2 },

  // Tabs
  tabScroll:    { maxHeight: 54, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  tabContent:   { paddingHorizontal: 16, gap: 8, alignItems: "center", paddingVertical: 8 },
  tab:          { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2 },
  tabActive:    { backgroundColor: THEME.accent, borderColor: THEME.accent },
  tabTxt:       { color: THEME.textMuted, fontWeight: "800", fontSize: 12 },
  tabTxtActive: { color: "#000" },

  // Overview
  overviewContent: { padding: 16 },
  headlineGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  headlineTile: { width: (width - 52) / 2, backgroundColor: THEME.ui, borderRadius: 18, padding: 16, alignItems: "center", borderWidth: 1, borderColor: THEME.ui2 },
  headlineIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  headlineVal:  { fontSize: 26, fontWeight: "900" },
  headlineLbl:  { color: THEME.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 2 },

  // Chart
  chartCard:    { backgroundColor: THEME.ui, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: THEME.ui2, marginBottom: 12 },
  chartTitle:   { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 16 },
  statBarRow:   { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  statBarLabel: { color: THEME.textMuted, fontSize: 11, width: 64 },
  statBarTrack: { flex: 1, height: 6, backgroundColor: THEME.ui2, borderRadius: 3, overflow: "hidden" },
  statBarFill:  { height: "100%", borderRadius: 3 },
  statBarVal:   { fontSize: 12, fontWeight: "900", width: 44, textAlign: "right" },

  // Book info
  bookInfoCard: { backgroundColor: THEME.ui, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: THEME.ui2 },
  infoRow:      { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  infoLabel:    { color: THEME.textMuted, fontSize: 13 },
  infoVal:      { color: THEME.text, fontWeight: "700", fontSize: 13 },

  // Shared list styles
  listContent:  { padding: 16, paddingBottom: 100 },
  listCard:     { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: THEME.ui2, gap: 12 },
  listAvatar:   { width: 46, height: 46, borderRadius: 14, borderWidth: 2, borderColor: THEME.accent + "50" },
  listInfo:     { flex: 1 },
  listName:     { color: THEME.text, fontWeight: "800", fontSize: 14 },
  listComment:  { color: THEME.textMuted, fontSize: 12, marginTop: 3, lineHeight: 17 },
  listMeta:     { color: THEME.textMuted, fontSize: 10, marginTop: 3 },

  // Weave cards
  weaveCard:        { backgroundColor: THEME.ui, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: THEME.ui2 },
  weaveCardHeader:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  weaveAvatar:      { width: 38, height: 38, borderRadius: 12, borderWidth: 1.5, borderColor: THEME.accent + "60" },
  weaveCatBadge:    { backgroundColor: THEME.accentDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: THEME.accent + "30" },
  weaveCatTxt:      { color: THEME.accent, fontSize: 9, fontWeight: "900" },
  weaveQuote:       { flexDirection: "row", gap: 8, marginBottom: 10 },
  weaveQuoteBar:    { width: 3, backgroundColor: THEME.accent, borderRadius: 2 },
  weaveQuoteTxt:    { flex: 1, color: THEME.textMuted, fontSize: 12, fontStyle: "italic", lineHeight: 18 },
  weaveCommentary:  { color: THEME.text, fontSize: 13, lineHeight: 20, marginBottom: 12 },
  weaveFooter:      { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: THEME.ui2 },
  weaveFooterStat:  { flexDirection: "row", alignItems: "center", gap: 4 },
  weaveFooterTxt:   { color: THEME.textMuted, fontSize: 11 },

  // Empty state
  emptyState: { alignItems: "center", marginTop: 80, gap: 10 },
  emptyTitle: { color: THEME.text, fontSize: 16, fontWeight: "800" },
  emptySub:   { color: THEME.textMuted, fontSize: 13, textAlign: "center" },
});