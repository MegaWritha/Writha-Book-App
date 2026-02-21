import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  serverTimestamp,
  limit,
} from "firebase/firestore";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#0F071A",
  ui: "#1E1135",
  accent: "#FFD700",
  text: "#E2E8F0",
  textMuted: "#94A3B8",
};

export default function UserList() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const currentUserId = auth.currentUser?.uid;

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const q = query(
        collection(db, "users"),
        where("username", ">=", text.toLowerCase()),
        where("username", "<=", text.toLowerCase() + "\uf8ff"),
        limit(10)
      );
      const snap = await getDocs(q);
      setResults(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.id !== currentUserId));
    } catch (e) {
      console.error("Search Error: ", e);
    } finally {
      setLoading(false);
    }
  };

  // --- THE FOLLOW LOGIC THAT CREATES A NOTIFICATION ---
  const followScholar = async (targetUser: any) => {
    if (!currentUserId) return;

    try {
      // 1. Add to your 'following'
      await setDoc(doc(db, "users", currentUserId, "following", targetUser.id), {
        timestamp: serverTimestamp(),
        username: targetUser.username
      });

      // 2. Add to their 'followers'
      await setDoc(doc(db, "users", targetUser.id, "followers", currentUserId), {
        timestamp: serverTimestamp(),
        username: auth.currentUser?.displayName || "A Scholar"
      });

      // 3. CREATE THE NOTIFICATION (This is what they will see in their Friends tab)
      const notificationId = `${currentUserId}_follow_${Date.now()}`;
      await setDoc(doc(db, "users", targetUser.id, "notifications", notificationId), {
        type: "follow",
        fromId: currentUserId,
        fromUsername: auth.currentUser?.displayName || "A Scholar",
        fromImage: auth.currentUser?.photoURL || "",
        message: "started following your research.",
        read: false,
        timestamp: serverTimestamp(),
      });

      alert(`You are now following @${targetUser.username}`);
    } catch (e) {
      console.error("Follow error:", e);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.brandTitle}>WRITHA USERS</Text>
      
      <View style={styles.searchBar}>
        <Feather name="search" size={18} color={THEME.textMuted} />
        <TextInput
          placeholder="Search by username..."
          placeholderTextColor="#4B3E63"
          style={styles.input}
          value={searchQuery}
          onChangeText={handleSearch}
          autoCapitalize="none"
        />
      </View>

      {loading ? (
        <ActivityIndicator color={THEME.accent} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={styles.userCard}>
              <View style={styles.userInfo}>
                {/* CLICKING CIRCULAR PROFILE - NAVIGATES TO [id].tsx */}
                <TouchableOpacity 
                  onPress={() => router.push(`/profile/${item.id}`)}
                  style={styles.avatarContainer}
                >
                  {item.profilePic ? (
                    <Image source={{ uri: item.profilePic }} style={styles.circularAvatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                       <Text style={styles.initials}>{item.username?.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.textContainer}>
                    <Text style={styles.userName}>@{item.username}</Text>
                    <Text style={styles.userBio} numberOfLines={1}>
                        {item.bio || "User at Writha."}
                    </Text>
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.followBtn} 
                onPress={() => followScholar(item)}
              >
                <Ionicons name="person-add" size={16} color={THEME.bg} />
                <Text style={styles.followText}>FOLLOW</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            searchQuery.length > 1 && !loading ? (
                <Text style={styles.emptyText}>No users found.</Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg, paddingHorizontal: 20, paddingTop: 60 },
  brandTitle: { color: THEME.text, fontSize: 24, fontWeight: "900", letterSpacing: 3, marginBottom: 25 },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, borderRadius: 20, paddingHorizontal: 20, height: 60, marginBottom: 25, borderWidth: 1, borderColor: '#2D1B4D' },
  input: { flex: 1, marginLeft: 15, color: THEME.text, fontWeight: "700", fontSize: 16 },
  userCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: THEME.ui, padding: 15, borderRadius: 25, marginBottom: 12, borderWidth: 1, borderColor: '#2D1B4D' },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarContainer: { position: 'relative' },
  circularAvatar: { width: 55, height: 55, borderRadius: 27.5, borderWidth: 2, borderColor: THEME.accent },
  avatarPlaceholder: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: '#2D1B4D', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: THEME.accent },
  initials: { color: THEME.accent, fontWeight: '900', fontSize: 18 },
  textContainer: { marginLeft: 15, flex: 1 },
  userName: { color: THEME.text, fontWeight: '900', fontSize: 17 },
  userBio: { color: THEME.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  followBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.accent, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 12 },
  followText: { color: THEME.bg, fontWeight: '900', fontSize: 11, marginLeft: 5 },
  emptyText: { color: '#4B3E63', textAlign: 'center', marginTop: 30, fontWeight: '700' }
});