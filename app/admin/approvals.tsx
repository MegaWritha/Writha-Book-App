import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Alert, ActivityIndicator, StatusBar,
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
};

export default function ApprovalsScreen() {
  const router = useRouter();
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");

  useEffect(() => {
    const q = query(collection(db, "books"), where("status", "==", filter));
    const unsub = onSnapshot(q, (snap) => {
      setBooks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [filter]);

  const handleApprove = (bookId: string, title: string) => {
    Alert.alert("Approve Book", `Approve "${title}" and publish it?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve", onPress: async () => {
          await updateDoc(doc(db, "books", bookId), {
            status: "published",
            approvedAt: serverTimestamp(),
          });
        }
      }
    ]);
  };

  const handleReject = (bookId: string, title: string) => {
    Alert.alert("Reject Book", `Reject "${title}"? The author will be notified.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject", style: "destructive", onPress: async () => {
          await updateDoc(doc(db, "books", bookId), {
            status: "rejected",
            rejectedAt: serverTimestamp(),
          });
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={THEME.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>BOOK APPROVALS</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* FILTER TABS */}
      <View style={styles.filterRow}>
        {(["pending", "approved", "rejected"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterPill, filter === f && styles.filterPillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTxt, filter === f && styles.filterTxtActive]}>
              {f.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={THEME.accent} style={{ marginTop: 40 }} />
      ) : books.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 40 }}>📚</Text>
          <Text style={styles.emptyTxt}>No {filter} books</Text>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 16 }}
          renderItem={({ item }) => (
            <View style={styles.bookCard}>
              <View style={styles.bookRow}>
                <Image
                  source={{ uri: item.coverUrl || item.cover || "https://picsum.photos/80/120" }}
                  style={styles.bookCover}
                />
                <View style={styles.bookInfo}>
                  <Text style={styles.bookTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.bookAuthor}>{item.authorName || "Unknown Author"}</Text>
                  <Text style={styles.bookGenre}>{item.genre || "No genre"}</Text>
                  <View style={styles.bookMeta}>
                    <Text style={styles.bookPrice}>
                      {item.price > 0 ? `₦${item.price}` : "FREE"}
                    </Text>
                    <Text style={styles.bookDate}>
                      {item.createdAt?.toDate?.()?.toLocaleDateString("en-NG", {
                        day: "numeric", month: "short", year: "numeric"
                      }) || ""}
                    </Text>
                  </View>
                </View>
              </View>

              {/* DESCRIPTION PREVIEW */}
              {item.description && (
                <Text style={styles.bookDesc} numberOfLines={3}>{item.description}</Text>
              )}

              {/* ACTIONS — only for pending */}
              {filter === "pending" && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => handleReject(item.id, item.title)}
                  >
                    <Ionicons name="close-circle" size={18} color={THEME.red} />
                    <Text style={styles.rejectTxt}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleApprove(item.id, item.title)}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#000" />
                    <Text style={styles.approveTxt}>Approve & Publish</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* STATUS BADGE for approved/rejected */}
              {filter !== "pending" && (
                <View style={[styles.statusBadge, {
                  backgroundColor: filter === "approved" ? THEME.green + "20" : THEME.red + "20",
                }]}>
                  <Ionicons
                    name={filter === "approved" ? "checkmark-circle" : "close-circle"}
                    size={14}
                    color={filter === "approved" ? THEME.green : THEME.red}
                  />
                  <Text style={[styles.statusTxt, {
                    color: filter === "approved" ? THEME.green : THEME.red,
                  }]}>
                    {filter === "approved" ? "Published" : "Rejected"}
                  </Text>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: THEME.accent, fontSize: 14, fontWeight: "900", letterSpacing: 3 },
  filterRow: { flexDirection: "row", gap: 10, padding: 16 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2 },
  filterPillActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  filterTxt: { color: THEME.textMuted, fontSize: 11, fontWeight: "800" },
  filterTxtActive: { color: "#000" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyTxt: { color: THEME.textMuted, fontSize: 14 },
  bookCard: { backgroundColor: THEME.ui, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: THEME.ui2 },
  bookRow: { flexDirection: "row", gap: 14 },
  bookCover: { width: 70, height: 100, borderRadius: 10, borderWidth: 1, borderColor: THEME.accent + "30" },
  bookInfo: { flex: 1, gap: 4 },
  bookTitle: { color: THEME.text, fontSize: 14, fontWeight: "900" },
  bookAuthor: { color: THEME.textMuted, fontSize: 12 },
  bookGenre: { color: THEME.accent + "80", fontSize: 11 },
  bookMeta: { flexDirection: "row", gap: 12, marginTop: 4 },
  bookPrice: { color: THEME.accent, fontSize: 11, fontWeight: "800" },
  bookDate: { color: THEME.textMuted, fontSize: 10 },
  bookDesc: { color: THEME.textMuted, fontSize: 12, lineHeight: 18, marginTop: 12, borderTopWidth: 1, borderTopColor: THEME.ui2, paddingTop: 12 },
  actionRow: { flexDirection: "row", gap: 12, marginTop: 14 },
  rejectBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: THEME.red + "50" },
  rejectTxt: { color: THEME.red, fontWeight: "800", fontSize: 13 },
  approveBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: THEME.accent },
  approveTxt: { color: "#000", fontWeight: "900", fontSize: 13 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, padding: 8, borderRadius: 10, alignSelf: "flex-start" },
  statusTxt: { fontSize: 12, fontWeight: "800" },
});