import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, StatusBar, ScrollView,
  Pressable, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot,
  updateDoc, doc, serverTimestamp,
} from "firebase/firestore";

const THEME = {
  bg: "#0F071A", ui: "#1E1135", ui2: "#2D1B4D",
  accent: "#FFD700", text: "#E2E8F0", textMuted: "#94A3B8",
  green: "#22C55E", red: "#EF4444", blue: "#38BDF8",
  purple: "#A78BFA",
};

// ── CROSS PLATFORM ALERT ─────────────────────────────────────────────────
const showAlert = (
  title: string,
  message: string,
  buttons: { text: string; style?: string; onPress?: () => void }[]
) => {
  if (Platform.OS === "web") {
    const confirmBtn = buttons.find((b) => b.style !== "cancel");
    const cancelBtn  = buttons.find((b) => b.style === "cancel");
    if (buttons.length === 1) {
      window.alert(`${title}\n\n${message}`);
      buttons[0].onPress?.();
    } else {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) confirmBtn?.onPress?.();
      else cancelBtn?.onPress?.();
    }
  } else {
    const { Alert } = require("react-native");
    Alert.alert(title, message, buttons);
  }
};

type ContentType   = "books" | "articles" | "research";
type StatusFilter  = "submitted" | "published" | "rejected";

const CONTENT_TABS: { key: ContentType; label: string; icon: string }[] = [
  { key: "books",    label: "Books",    icon: "book"      },
  { key: "articles", label: "Articles", icon: "newspaper" },
  { key: "research", label: "Research", icon: "flask"     },
];

const STATUS_TABS: { key: StatusFilter; label: string; color: string }[] = [
  { key: "submitted", label: "Pending",   color: THEME.accent },
  { key: "published", label: "Published", color: THEME.green  },
  { key: "rejected",  label: "Rejected",  color: THEME.red    },
];

export default function ApprovalsScreen() {
  const router = useRouter();
  const [contentType,  setContentType]  = useState<ContentType>("books");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("submitted");
  const [items,        setItems]        = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [counts,       setCounts]       = useState<Record<ContentType, number>>({
    books: 0, articles: 0, research: 0,
  });

  // ── PENDING COUNTS ───────────────────────────────────────────────
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(onSnapshot(
      query(collection(db, "books"), where("status", "==", "submitted")),
      (snap) => setCounts((c) => ({ ...c, books: snap.size }))
    ));
    unsubs.push(onSnapshot(
      query(collection(db, "feed"), where("type", "==", "article"), where("status", "==", "submitted")),
      (snap) => setCounts((c) => ({ ...c, articles: snap.size }))
    ));
    unsubs.push(onSnapshot(
      query(collection(db, "feed"), where("type", "==", "research"), where("status", "==", "submitted")),
      (snap) => setCounts((c) => ({ ...c, research: snap.size }))
    ));

    return () => unsubs.forEach((u) => u());
  }, []);

  // ── LOAD ITEMS ───────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setItems([]);

    const q = contentType === "books"
      ? query(collection(db, "books"), where("status", "==", statusFilter))
      : query(
          collection(db, "feed"),
          where("type",   "==", contentType === "articles" ? "article" : "research"),
          where("status", "==", statusFilter)
        );

    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => unsub();
  }, [contentType, statusFilter]);

  // ── APPROVE ──────────────────────────────────────────────────────
  const handleApprove = (itemId: string, title: string) => {
    const col = contentType === "books" ? "books" : "feed";
    showAlert(
      "Approve & Publish",
      `Publish "${title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Publish",
          onPress: async () => {
            try {
              await updateDoc(doc(db, col, itemId), {
                status:      "published",
                approvedAt:  serverTimestamp(),
                isPublished: true,
              });
              showAlert("Published ✅", `"${title}" is now live.`, [{ text: "OK" }]);
            } catch (e: any) {
              showAlert("Error", "Could not approve:\n" + e.message, [{ text: "OK" }]);
            }
          },
        },
      ]
    );
  };

  // ── REJECT ───────────────────────────────────────────────────────
  const handleReject = (itemId: string, title: string) => {
    const col = contentType === "books" ? "books" : "feed";
    showAlert(
      "Reject Submission",
      `Reject "${title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              await updateDoc(doc(db, col, itemId), {
                status:      "rejected",
                rejectedAt:  serverTimestamp(),
                isPublished: false,
              });
              showAlert("Rejected", `"${title}" has been rejected.`, [{ text: "OK" }]);
            } catch (e: any) {
              showAlert("Error", "Could not reject:\n" + e.message, [{ text: "OK" }]);
            }
          },
        },
      ]
    );
  };

  // ── RENDER ACTIONS ───────────────────────────────────────────────
  const renderActions = (item: any) => {
    if (statusFilter !== "submitted") {
      return (
        <View style={[styles.statusBadge, {
          backgroundColor: statusFilter === "published" ? THEME.green + "20" : THEME.red + "20",
        }]}>
          <Ionicons
            name={statusFilter === "published" ? "checkmark-circle" : "close-circle"}
            size={14}
            color={statusFilter === "published" ? THEME.green : THEME.red}
          />
          <Text style={[styles.statusTxt, {
            color: statusFilter === "published" ? THEME.green : THEME.red,
          }]}>
            {statusFilter === "published" ? "Published" : "Rejected"}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [styles.rejectBtn, pressed && { opacity: 0.7 }]}
          onPress={() => handleReject(item.id, item.title || "this item")}
        >
          <Ionicons name="close-circle" size={18} color={THEME.red} />
          <Text style={styles.rejectTxt}>Reject</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.approveBtn, pressed && { opacity: 0.7 }]}
          onPress={() => handleApprove(item.id, item.title || "this item")}
        >
          <Ionicons name="checkmark-circle" size={18} color="#000" />
          <Text style={styles.approveTxt}>Approve & Publish</Text>
        </Pressable>
      </View>
    );
  };

  // ── RENDER BOOK CARD ─────────────────────────────────────────────
  const renderBookCard = (item: any) => (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Image
          source={{ uri: item.coverUrl || item.cover || "https://picsum.photos/80/120" }}
          style={styles.bookCover}
        />
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.cardSub}>{item.authorName || "Unknown Author"}</Text>
          <Text style={styles.cardMeta}>{item.genre || "No genre"}</Text>
          <View style={styles.cardMetaRow}>
            <Text style={styles.cardPrice}>
              {item.price > 0 ? `₦${item.price}` : "FREE"}
            </Text>
            <Text style={styles.cardDate}>
              {item.createdAt?.toDate?.()?.toLocaleDateString("en-NG", {
                day: "numeric", month: "short", year: "numeric",
              }) || ""}
            </Text>
          </View>
        </View>
      </View>
      {item.description ? (
        <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>
      ) : null}
      {renderActions(item)}
    </View>
  );

  // ── RENDER FEED CARD ─────────────────────────────────────────────
  const renderFeedCard = (item: any) => (
    <View style={styles.card}>
      <View style={styles.feedTypeTag}>
        <Ionicons
          name={contentType === "articles" ? "newspaper-outline" : "flask-outline"}
          size={12}
          color={contentType === "articles" ? THEME.blue : THEME.purple}
        />
        <Text style={[styles.feedTypeTxt, {
          color: contentType === "articles" ? THEME.blue : THEME.purple,
        }]}>
          {contentType === "articles" ? "ARTICLE" : "RESEARCH"}
        </Text>
      </View>
      <Text style={styles.cardTitle}>
        {item.title || item.content?.substring(0, 60) + "..."}
      </Text>
      <Text style={styles.cardSub}>
        {item.authorName || item.username || "Unknown Author"}
      </Text>
      {item.content ? (
        <Text style={styles.cardDesc} numberOfLines={4}>{item.content}</Text>
      ) : null}
      <Text style={styles.cardDate}>
        {item.createdAt?.toDate?.()?.toLocaleDateString("en-NG", {
          day: "numeric", month: "short", year: "numeric",
        }) || ""}
      </Text>
      {renderActions(item)}
    </View>
  );

  // ── RENDER ───────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={THEME.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>APPROVALS</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* CONTENT TYPE TABS */}
      <View style={styles.contentTabRow}>
        {CONTENT_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.contentTab, contentType === tab.key && styles.contentTabActive]}
            onPress={() => { setContentType(tab.key); setStatusFilter("submitted"); }}
          >
            <Ionicons
              name={tab.icon as any}
              size={16}
              color={contentType === tab.key ? "#000" : THEME.textMuted}
            />
            <Text style={[styles.contentTabTxt, contentType === tab.key && styles.contentTabTxtActive]}>
              {tab.label}
            </Text>
            {counts[tab.key] > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeTxt}>{counts[tab.key]}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* STATUS TABS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statusTabRow}
      >
        {STATUS_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.statusPill, statusFilter === tab.key && { backgroundColor: tab.color, borderColor: tab.color }]}
            onPress={() => setStatusFilter(tab.key)}
          >
            <Text style={[styles.statusPillTxt, statusFilter === tab.key && { color: "#000" }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* LIST */}
      {loading ? (
        <ActivityIndicator color={THEME.accent} style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 40 }}>
            {contentType === "books" ? "📚" : contentType === "articles" ? "📰" : "🔬"}
          </Text>
          <Text style={styles.emptyTxt}>No {statusFilter} {contentType}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 16 }}
          renderItem={({ item }) =>
            contentType === "books" ? renderBookCard(item) : renderFeedCard(item)
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: THEME.bg },
  header:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  backBtn:          { width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  headerTitle:      { color: THEME.accent, fontSize: 14, fontWeight: "900", letterSpacing: 3 },
  contentTabRow:    { flexDirection: "row", padding: 16, gap: 10 },
  contentTab:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2, position: "relative" },
  contentTabActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  contentTabTxt:    { color: THEME.textMuted, fontSize: 12, fontWeight: "800" },
  contentTabTxtActive: { color: "#000" },
  tabBadge:         { position: "absolute", top: -6, right: -6, backgroundColor: THEME.red, borderRadius: 10, minWidth: 18, height: 18, justifyContent: "center", alignItems: "center", paddingHorizontal: 3 },
  tabBadgeTxt:      { color: "#fff", fontSize: 8, fontWeight: "900" },
  statusTabRow:     { paddingHorizontal: 16, gap: 10, paddingBottom: 16 },
  statusPill:       { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2 },
  statusPillTxt:    { color: THEME.textMuted, fontSize: 12, fontWeight: "800" },
  card:             { backgroundColor: THEME.ui, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: THEME.ui2 },
  cardRow:          { flexDirection: "row", gap: 14 },
  bookCover:        { width: 70, height: 100, borderRadius: 10, borderWidth: 1, borderColor: THEME.accent + "30" },
  cardInfo:         { flex: 1, gap: 4 },
  cardTitle:        { color: THEME.text, fontSize: 15, fontWeight: "900" },
  cardSub:          { color: THEME.textMuted, fontSize: 12 },
  cardMeta:         { color: THEME.accent + "80", fontSize: 11 },
  cardMetaRow:      { flexDirection: "row", gap: 12, marginTop: 4 },
  cardPrice:        { color: THEME.accent, fontSize: 11, fontWeight: "800" },
  cardDate:         { color: THEME.textMuted, fontSize: 10, marginTop: 4 },
  cardDesc:         { color: THEME.textMuted, fontSize: 12, lineHeight: 18, marginTop: 12, borderTopWidth: 1, borderTopColor: THEME.ui2, paddingTop: 12 },
  feedTypeTag:      { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10, backgroundColor: THEME.bg, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  feedTypeTxt:      { fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  actionRow:        { flexDirection: "row", gap: 12, marginTop: 14 },
  rejectBtn:        { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: THEME.red + "50" },
  rejectTxt:        { color: THEME.red, fontWeight: "800", fontSize: 13 },
  approveBtn:       { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: THEME.accent },
  approveTxt:       { color: "#000", fontWeight: "900", fontSize: 13 },
  statusBadge:      { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, padding: 8, borderRadius: 10, alignSelf: "flex-start" },
  statusTxt:        { fontSize: 12, fontWeight: "800" },
  empty:            { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, marginTop: 80 },
  emptyTxt:         { color: THEME.textMuted, fontSize: 14 },
});