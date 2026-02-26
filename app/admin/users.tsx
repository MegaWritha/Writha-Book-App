import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Alert, ActivityIndicator, StatusBar, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { db } from "@/lib/firebase";
import {
  collection, onSnapshot, updateDoc, doc, orderBy, query,
} from "firebase/firestore";

const THEME = {
  bg: "#0F071A", ui: "#1E1135", ui2: "#2D1B4D",
  accent: "#FFD700", text: "#E2E8F0", textMuted: "#94A3B8",
  green: "#22C55E", red: "#EF4444", purple: "#6D28D9",
  purpleLight: "#A78BFA",
};

export default function UsersScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "users"), orderBy("createdAt", "desc")),
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsers(data);
        setFiltered(data);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered(users); return; }
    const q = search.toLowerCase();
    setFiltered(users.filter((u) =>
      u.displayName?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    ));
  }, [search, users]);

  const handleBan = (userId: string, name: string, isBanned: boolean) => {
    Alert.alert(
      isBanned ? "Unban User" : "Ban User",
      isBanned ? `Restore access for ${name}?` : `Ban ${name}? They won't be able to log in.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isBanned ? "Unban" : "Ban",
          style: isBanned ? "default" : "destructive",
          onPress: async () => {
            await updateDoc(doc(db, "users", userId), { isBanned: !isBanned });
          }
        }
      ]
    );
  };

  const handleMakeAdmin = (userId: string, name: string, isAdmin: boolean) => {
    Alert.alert(
      isAdmin ? "Remove Admin" : "Make Admin",
      isAdmin ? `Remove admin rights from ${name}?` : `Give ${name} admin access?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm", onPress: async () => {
            await updateDoc(doc(db, "users", userId), { isAdmin: !isAdmin });
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={THEME.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>USER MANAGEMENT</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* SEARCH */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={THEME.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          placeholderTextColor={THEME.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <Text style={styles.countTxt}>{filtered.length} users</Text>

      {loading ? (
        <ActivityIndicator color={THEME.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <View style={[styles.userCard, item.isBanned && styles.userCardBanned]}>
              <View style={styles.userRow}>
                {item.photoURL ? (
                  <Image source={{ uri: item.photoURL }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarLetter}>
                      {(item.displayName || item.username || "U")[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.userInfo}>
                  <View style={styles.userNameRow}>
                    <Text style={styles.userName}>{item.displayName || item.username || "Unknown"}</Text>
                    {item.isAdmin && (
                      <View style={styles.adminTag}>
                        <Text style={styles.adminTagTxt}>ADMIN</Text>
                      </View>
                    )}
                    {item.isBanned && (
                      <View style={styles.bannedTag}>
                        <Text style={styles.bannedTagTxt}>BANNED</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.userEmail}>{item.email}</Text>
                  <Text style={styles.userMeta}>
                    @{item.username || "—"} · {item.booksRead || 0} books read
                  </Text>
                </View>
              </View>

              <View style={styles.userActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: item.isBanned ? THEME.green + "50" : THEME.red + "50" }]}
                  onPress={() => handleBan(item.id, item.displayName || "User", item.isBanned)}
                >
                  <Ionicons
                    name={item.isBanned ? "lock-open-outline" : "ban-outline" as any}
                    size={14}
                    color={item.isBanned ? THEME.green : THEME.red}
                  />
                  <Text style={[styles.actionTxt, { color: item.isBanned ? THEME.green : THEME.red }]}>
                    {item.isBanned ? "Unban" : "Ban"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: THEME.accent + "50" }]}
                  onPress={() => handleMakeAdmin(item.id, item.displayName || "User", item.isAdmin)}
                >
                  <Ionicons name="shield-checkmark-outline" size={14} color={THEME.accent} />
                  <Text style={[styles.actionTxt, { color: THEME.accent }]}>
                    {item.isAdmin ? "Remove Admin" : "Make Admin"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: THEME.purpleLight + "50" }]}
                  onPress={() => router.push(`/profile/${item.id}` as any)}
                >
                  <Ionicons name="eye-outline" size={14} color={THEME.purpleLight} />
                  <Text style={[styles.actionTxt, { color: THEME.purpleLight }]}>View</Text>
                </TouchableOpacity>
              </View>
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
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, margin: 16, backgroundColor: THEME.ui, borderRadius: 14, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: THEME.ui2 },
  searchInput: { flex: 1, color: THEME.text, fontSize: 14 },
  countTxt: { color: THEME.textMuted, fontSize: 11, marginLeft: 20, marginBottom: 4 },
  userCard: { backgroundColor: THEME.ui, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: THEME.ui2 },
  userCardBanned: { borderColor: THEME.red + "40", backgroundColor: "#1A0808" },
  userRow: { flexDirection: "row", gap: 14, marginBottom: 14 },
  avatar: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, borderColor: THEME.accent + "30" },
  avatarFallback: { backgroundColor: THEME.purple, justifyContent: "center", alignItems: "center" },
  avatarLetter: { color: THEME.accent, fontSize: 18, fontWeight: "900" },
  userInfo: { flex: 1, gap: 3 },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  userName: { color: THEME.text, fontSize: 14, fontWeight: "900" },
  adminTag: { backgroundColor: THEME.accent + "20", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  adminTagTxt: { color: THEME.accent, fontSize: 8, fontWeight: "900" },
  bannedTag: { backgroundColor: THEME.red + "20", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  bannedTagTxt: { color: THEME.red, fontSize: 8, fontWeight: "900" },
  userEmail: { color: THEME.textMuted, fontSize: 12 },
  userMeta: { color: THEME.textMuted, fontSize: 11 },
  userActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  actionTxt: { fontSize: 11, fontWeight: "700" },
});