import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, Image, StatusBar, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, arrayRemove, getDoc } from "firebase/firestore";

const T = {
  bg: "#0F071A", ui: "#1E1135", ui2: "#2D1B4D",
  accent: "#FFD700", purple: "#6D28D9",
  text: "#E2E8F0", muted: "#94A3B8", red: "#EF4444",
};

export default function BlockedUsersScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), async (snap) => {
      if (snap.exists()) {
        const ids: string[] = snap.data().blockedUsers || [];
        setBlockedIds(ids);

        // Fetch each blocked user's profile
        const profiles = await Promise.all(
          ids.map(async (uid) => {
            try {
              const d = await getDoc(doc(db, "users", uid));
              return d.exists() ? { id: uid, ...d.data() } : { id: uid, displayName: "Unknown User" };
            } catch {
              return { id: uid, displayName: "Unknown User" };
            }
          })
        );
        setBlockedUsers(profiles);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const handleUnblock = (uid: string, name: string) => {
    Alert.alert(
      "Unblock User",
      `Unblock ${name}? They will be able to see your profile and content again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: async () => {
            setUnblocking(uid);
            try {
              await updateDoc(doc(db, "users", user!.uid), {
                blockedUsers: arrayRemove(uid),
              });
            } catch {
              Alert.alert("Error", "Could not unblock user. Try again.");
            } finally {
              setUnblocking(null);
            }
          },
        },
      ]
    );
  };

  if (loading) return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={T.accent} />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={T.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked Users</Text>
        <View style={{ width: 40 }} />
      </View>

      {blockedUsers.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="person-remove-outline" size={36} color={T.muted} />
          </View>
          <Text style={styles.emptyTitle}>No Blocked Users</Text>
          <Text style={styles.emptySub}>
            Users you block won't be able to see your content or interact with you.
          </Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            <Text style={styles.countTxt}>
              {blockedUsers.length} blocked {blockedUsers.length === 1 ? "user" : "users"}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.userRow}>
              {item.photoURL ? (
                <Image source={{ uri: item.photoURL }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>
                    {(item.firstName || item.displayName || "?")[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>
                  {item.firstName
                    ? `${item.firstName} ${item.lastName || ""}`.trim()
                    : item.displayName || "Unknown User"}
                </Text>
                <Text style={styles.userHandle}>@{item.username || "user"}</Text>
              </View>
              <TouchableOpacity
                style={[styles.unblockBtn, unblocking === item.id && { opacity: 0.6 }]}
                onPress={() => handleUnblock(item.id, item.firstName || item.displayName || "this user")}
                disabled={unblocking === item.id}
              >
                {unblocking === item.id
                  ? <ActivityIndicator size="small" color={T.red} />
                  : <Text style={styles.unblockTxt}>Unblock</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  loader: { flex: 1, backgroundColor: T.bg, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 20,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: T.ui, justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: T.text },
  list: { padding: 20, paddingBottom: 60 },
  countTxt: { color: T.muted, fontSize: 12, fontWeight: "700", marginBottom: 16 },
  separator: { height: 1, backgroundColor: T.ui2 },
  userRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: T.ui, paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 16, marginBottom: 2,
  },
  avatar: { width: 46, height: 46, borderRadius: 14 },
  avatarFallback: {
    width: 46, height: 46, borderRadius: 14, backgroundColor: T.purple,
    justifyContent: "center", alignItems: "center",
  },
  avatarInitial: { color: T.accent, fontWeight: "900", fontSize: 18 },
  userName: { color: T.text, fontSize: 14, fontWeight: "700" },
  userHandle: { color: T.muted, fontSize: 12, marginTop: 2 },
  unblockBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: T.red,
  },
  unblockTxt: { color: T.red, fontSize: 12, fontWeight: "800" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 22, backgroundColor: T.ui,
    justifyContent: "center", alignItems: "center", marginBottom: 20,
  },
  emptyTitle: { color: T.text, fontSize: 18, fontWeight: "900", marginBottom: 10 },
  emptySub: { color: T.muted, fontSize: 13, textAlign: "center", lineHeight: 20 },
});