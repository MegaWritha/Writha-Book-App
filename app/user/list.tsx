import React, { useEffect, useState } from "react";
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  TextInput, 
  ActivityIndicator 
} from "react-native";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, onSnapshot } from "firebase/firestore";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

const THEME = {
  bg: "#0F071A",
  ui: "#1E1135",
  accent: "#FFD700",
  text: "#E2E8F0",
  textMuted: "#94A3B8",
};

export default function FriendsList() {
  const [allUsers, setAllUsers] = useState<any[]>([]); // Full list
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]); // Search results
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  // 1. LOAD DATA (Mutual Follow Logic)
  useEffect(() => {
    if (!uid) return;

    const loadData = async () => {
      try {
        const followingSnap = await getDocs(collection(db, "users", uid, "followbutton", "list"));
        const followersSnap = await getDocs(collection(db, "users", uid, "followers", "list"));

        const followingIds = followingSnap.docs.map(d => d.id);
        const followerIds = followersSnap.docs.map(d => d.id);

        const combined = await Promise.all(
          followingIds.map(async (id) => {
            const userDoc = await getDoc(doc(db, "users", id));
            return {
              id,
              displayName: userDoc.data()?.displayName || "Unknown Author",
              photoURL: userDoc.data()?.photoURL,
              isMutual: followerIds.includes(id)
            };
          })
        );

        setAllUsers(combined);
        setFilteredUsers(combined);
      } catch (error) {
        console.error("Search list error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [uid]);

  // 2. SEARCH FILTER LOGIC
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredUsers(allUsers);
    } else {
      const filtered = allUsers.filter(user => 
        user.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, allUsers]);

  if (loading) return <ActivityIndicator color={THEME.accent} style={{ marginTop: 20 }} />;

  return (
    <View style={styles.container}>
      {/* SEARCH BAR */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color={THEME.textMuted} />
        <TextInput
          placeholder="Search friends or following..."
          placeholderTextColor={THEME.textMuted}
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Feather name="x" size={18} color={THEME.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* LIST */}
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push({ 
              pathname: "/chat/[id]", 
              params: { id: item.id } 
            } as any)}
            style={styles.card}
          >
            <View style={styles.userInfo}>
              <Text style={styles.name}>{item.displayName}</Text>
              <View style={styles.badgeRow}>
                <View style={[styles.dot, { backgroundColor: item.isMutual ? THEME.accent : THEME.textMuted }]} />
                <Text style={[styles.status, { color: item.isMutual ? THEME.accent : THEME.textMuted }]}>
                  {item.isMutual ? "Mutual Friend" : "Following"}
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={THEME.textMuted} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No users found.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.ui,
    margin: 15,
    paddingHorizontal: 15,
    borderRadius: 12,
    height: 50,
  },
  searchInput: {
    flex: 1,
    color: THEME.text,
    marginLeft: 10,
    fontSize: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.ui,
    marginHorizontal: 15,
    marginBottom: 10,
    padding: 15,
    borderRadius: 15,
  },
  userInfo: { flex: 1 },
  name: { color: THEME.text, fontWeight: "bold", fontSize: 16 },
  badgeRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  status: { fontSize: 12, fontWeight: "600" },
  emptyText: { color: THEME.textMuted, textAlign: "center", marginTop: 50 },
  chatHint: { color: THEME.accent, fontWeight: "bold" }
});