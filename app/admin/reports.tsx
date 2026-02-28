import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, ActivityIndicator, Platform, Alert, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { db } from "@/lib/firebase";
import {
  collection, query, onSnapshot, where,
  updateDoc, deleteDoc, doc, serverTimestamp,
} from "firebase/firestore";

const THEME = {
  bg: "#0F071A", ui: "#1E1135", ui2: "#2D1B4D",
  accent: "#FFD700", purple: "#6D28D9", purpleLight: "#A78BFA",
  text: "#E2E8F0", textMuted: "#94A3B8",
  green: "#22C55E", red: "#EF4444", blue: "#38BDF8",
};

const showAlert = (
  title: string,
  message: string,
  buttons: { text: string; style?: string; onPress?: () => void }[]
) => {
  if (Platform.OS === "web") {
    if (buttons.length === 1) {
      window.alert(`${title}\n\n${message}`);
      buttons[0].onPress?.();
    } else {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) buttons.find((b) => b.style !== "cancel")?.onPress?.();
    }
  } else {
    Alert.alert(title, message, buttons as any);
  }
};

type ReportStatus = "pending" | "resolved" | "dismissed";
type ReportType   = "all" | "book" | "comment" | "user" | "post";

const STATUS_TABS: { key: ReportStatus; label: string; color: string }[] = [
  { key: "pending",   label: "Pending",   color: THEME.accent },
  { key: "resolved",  label: "Resolved",  color: THEME.green  },
  { key: "dismissed", label: "Dismissed", color: THEME.textMuted },
];

const TYPE_FILTERS: { key: ReportType; label: string; icon: string }[] = [
  { key: "all",     label: "All",      icon: "list"              },
  { key: "book",    label: "Books",    icon: "book-outline"      },
  { key: "comment", label: "Comments", icon: "chatbubble-outline" },
  { key: "user",    label: "Users",    icon: "person-outline"    },
  { key: "post",    label: "Posts",    icon: "newspaper-outline" },
];

export default function ReportsScreen() {
  const router = useRouter();

  const [loading,      setLoading]      = useState(true);
  const [reports,      setReports]      = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReportStatus>("pending");
  const [typeFilter,   setTypeFilter]   = useState<ReportType>("all");
  const [counts,       setCounts]       = useState({ pending: 0, resolved: 0, dismissed: 0 });

  // ── LOAD REPORTS ─────────────────────────────────────────────────
  useEffect(() => {
    // Load counts for all statuses
    const unsubCounts: (() => void)[] = [];
    (["pending", "resolved", "dismissed"] as ReportStatus[]).forEach((status) => {
      unsubCounts.push(onSnapshot(
        query(collection(db, "reports"), where("status", "==", status)),
        (snap) => setCounts((c) => ({ ...c, [status]: snap.size }))
      ));
    });

    return () => unsubCounts.forEach((u) => u());
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "reports"),
      where("status", "==", statusFilter)
    );

    const unsub = onSnapshot(q, (snap) => {
      let docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      // Filter by type client-side
      if (typeFilter !== "all") {
        docs = docs.filter((r) => r.contentType === typeFilter);
      }
      // Sort by newest first
      docs.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
        const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      setReports(docs);
      setLoading(false);
    });

    return () => unsub();
  }, [statusFilter, typeFilter]);

  // ── RESOLVE REPORT ───────────────────────────────────────────────
  const handleResolve = (report: any) => {
    showAlert(
      "Resolve Report",
      `Mark this report as resolved? The reported content will be removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Resolve & Remove",
          onPress: async () => {
            try {
              // Mark report resolved
              await updateDoc(doc(db, "reports", report.id), {
                status:     "resolved",
                resolvedAt: serverTimestamp(),
              });
              // Delete the reported content
              if (report.contentType && report.contentId) {
                const colMap: Record<string, string> = {
                  book:    "books",
                  comment: "comments",
                  post:    "feed",
                  user:    "users",
                };
                const col = colMap[report.contentType];
                if (col) {
                  await deleteDoc(doc(db, col, report.contentId)).catch(() => {});
                }
              }
              showAlert("Resolved ✅", "Report resolved and content removed.", [{ text: "OK" }]);
            } catch (e: any) {
              showAlert("Error", e.message, [{ text: "OK" }]);
            }
          },
        },
      ]
    );
  };

  // ── DISMISS REPORT ───────────────────────────────────────────────
  const handleDismiss = (report: any) => {
    showAlert(
      "Dismiss Report",
      "Dismiss this report? The content will remain live.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Dismiss",
          style: "destructive",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "reports", report.id), {
                status:      "dismissed",
                dismissedAt: serverTimestamp(),
              });
            } catch (e: any) {
              showAlert("Error", e.message, [{ text: "OK" }]);
            }
          },
        },
      ]
    );
  };

  // ── RENDER REPORT CARD ───────────────────────────────────────────
  const renderReport = ({ item }: { item: any }) => {
    const typeColor = item.contentType === "book"
      ? THEME.accent
      : item.contentType === "user"
      ? THEME.red
      : item.contentType === "comment"
      ? THEME.blue
      : THEME.purple;

    const timeAgo = (ts: any): string => {
      if (!ts?.toDate) return "";
      const diff  = Date.now() - ts.toDate().getTime();
      const mins  = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days  = Math.floor(diff / 86400000);
      if (mins < 1)  return "Just now";
      if (mins < 60) return `${mins}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return `${days}d ago`;
    };

    return (
      <View style={styles.card}>
        {/* Card header */}
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: typeColor + "20", borderColor: typeColor + "40" }]}>
            <Text style={[styles.typeTxt, { color: typeColor }]}>
              {item.contentType?.toUpperCase() || "UNKNOWN"}
            </Text>
          </View>
          <Text style={styles.timeAgo}>{timeAgo(item.createdAt)}</Text>
          {item.reportCount > 1 && (
            <View style={[styles.countBadge, { backgroundColor: THEME.red + "20" }]}>
              <Ionicons name="flag" size={10} color={THEME.red} />
              <Text style={[styles.countTxt, { color: THEME.red }]}>
                {item.reportCount}x reported
              </Text>
            </View>
          )}
        </View>

        {/* Reason */}
        <Text style={styles.reason}>
          "{item.reason || item.message || "No reason provided"}"
        </Text>

        {/* Content preview */}
        {item.contentPreview ? (
          <View style={styles.contentPreview}>
            <Text style={styles.contentPreviewTxt} numberOfLines={2}>
              {item.contentPreview}
            </Text>
          </View>
        ) : null}

        {/* Reporter info */}
        <View style={styles.reporterRow}>
          <Ionicons name="person-outline" size={12} color={THEME.textMuted} />
          <Text style={styles.reporterTxt}>
            Reported by: {item.reporterName || item.reporterId || "Anonymous"}
          </Text>
        </View>

        {/* Actions */}
        {statusFilter === "pending" && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={() => handleDismiss(item)}
            >
              <Ionicons name="close-circle-outline" size={16} color={THEME.textMuted} />
              <Text style={styles.dismissTxt}>Dismiss</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.resolveBtn}
              onPress={() => handleResolve(item)}
            >
              <Ionicons name="shield-checkmark" size={16} color="#000" />
              <Text style={styles.resolveTxt}>Resolve & Remove</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Resolved/dismissed badge */}
        {statusFilter !== "pending" && (
          <View style={[styles.resolvedBadge, {
            backgroundColor: statusFilter === "resolved" ? THEME.green + "15" : THEME.ui2,
          }]}>
            <Ionicons
              name={statusFilter === "resolved" ? "checkmark-circle" : "remove-circle"}
              size={14}
              color={statusFilter === "resolved" ? THEME.green : THEME.textMuted}
            />
            <Text style={[styles.resolvedTxt, {
              color: statusFilter === "resolved" ? THEME.green : THEME.textMuted,
            }]}>
              {statusFilter === "resolved" ? "Resolved — content removed" : "Dismissed — content kept"}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={THEME.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>REPORTS</Text>
        {counts.pending > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeTxt}>{counts.pending}</Text>
          </View>
        )}
      </View>

      {/* STATUS TABS */}
      <View style={styles.statusTabRow}>
        {STATUS_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.statusTab, statusFilter === tab.key && {
              backgroundColor: tab.color,
              borderColor:     tab.color,
            }]}
            onPress={() => setStatusFilter(tab.key)}
          >
            <Text style={[styles.statusTabTxt, statusFilter === tab.key && { color: "#000" }]}>
              {tab.label}
              {tab.key === "pending" && counts.pending > 0 ? ` (${counts.pending})` : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* TYPE FILTERS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.typeFilterRow}
      >
        {TYPE_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.typePill, typeFilter === f.key && styles.typePillActive]}
            onPress={() => setTypeFilter(f.key)}
          >
            <Ionicons
              name={f.icon as any}
              size={12}
              color={typeFilter === f.key ? "#000" : THEME.textMuted}
            />
            <Text style={[styles.typePillTxt, typeFilter === f.key && { color: "#000" }]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* LIST */}
      {loading ? (
        <ActivityIndicator color={THEME.accent} style={{ marginTop: 40 }} />
      ) : reports.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 48 }}>🛡️</Text>
          <Text style={styles.emptyTitle}>No {statusFilter} reports</Text>
          <Text style={styles.emptyDesc}>
            {statusFilter === "pending"
              ? "The platform is clean — no reports need attention."
              : `No ${statusFilter} reports to show.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={renderReport}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: THEME.bg },
  header:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: THEME.ui2, gap: 12 },
  backBtn:         { width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  headerTitle:     { flex: 1, color: THEME.accent, fontSize: 14, fontWeight: "900", letterSpacing: 3 },
  headerBadge:     { backgroundColor: THEME.red, borderRadius: 10, minWidth: 24, height: 24, justifyContent: "center", alignItems: "center", paddingHorizontal: 6 },
  headerBadgeTxt:  { color: "#fff", fontSize: 11, fontWeight: "900" },
  statusTabRow:    { flexDirection: "row", margin: 16, gap: 8 },
  statusTab:       { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2 },
  statusTabTxt:    { color: THEME.textMuted, fontSize: 11, fontWeight: "800" },
  typeFilterRow:   { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  typePill:        { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2 },
  typePillActive:  { backgroundColor: THEME.accent, borderColor: THEME.accent },
  typePillTxt:     { color: THEME.textMuted, fontSize: 11, fontWeight: "700" },
  card:            { backgroundColor: THEME.ui, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: THEME.ui2 },
  cardHeader:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  typeBadge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  typeTxt:         { fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  timeAgo:         { flex: 1, color: THEME.textMuted, fontSize: 10 },
  countBadge:      { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  countTxt:        { fontSize: 9, fontWeight: "900" },
  reason:          { color: THEME.text, fontSize: 13, fontStyle: "italic", lineHeight: 20, marginBottom: 10 },
  contentPreview:  { backgroundColor: THEME.bg, borderRadius: 10, padding: 10, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: THEME.ui2 },
  contentPreviewTxt: { color: THEME.textMuted, fontSize: 12, lineHeight: 18 },
  reporterRow:     { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  reporterTxt:     { color: THEME.textMuted, fontSize: 11 },
  actionRow:       { flexDirection: "row", gap: 10 },
  dismissBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: THEME.ui2 },
  dismissTxt:      { color: THEME.textMuted, fontWeight: "800", fontSize: 12 },
  resolveBtn:      { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: THEME.red },
  resolveTxt:      { color: "#000", fontWeight: "900", fontSize: 12 },
  resolvedBadge:   { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 10 },
  resolvedTxt:     { fontSize: 12, fontWeight: "700" },
  empty:           { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, marginTop: 80 },
  emptyTitle:      { color: THEME.text, fontSize: 16, fontWeight: "900" },
  emptyDesc:       { color: THEME.textMuted, fontSize: 13, textAlign: "center", paddingHorizontal: 32 },
});