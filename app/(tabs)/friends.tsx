import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  orderBy,
  limit,
  serverTimestamp,
  deleteDoc
} from "firebase/firestore";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#0F071A",
  ui: "#1E1135",
  accent: "#FFD700",
  text: "#E2E8F0",
  textMuted: "#94A3B8",
  online: "#4ADE80",
};

export default function SocialScreen() {
  const router = useRouter();
  const userId = auth.currentUser?.uid;

  const [activeTab, setActiveTab] = useState<"Chats" | "Friends">("Chats");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [chats, setChats] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followerIds, setFollowerIds] = useState<string[]>([]);

  const tabScrollValue = useRef(new Animated.Value(0)).current;

  // ---------------- FEATURE: CHAT LIST & TYPING ----------------
  useEffect(() => {
    if (!userId) return;
    const qChats = query(
      collection(db, "chats"), 
      where("participants", "array-contains", userId), 
      orderBy("lastMessageAt", "desc")
    );
    const unsubChats = onSnapshot(qChats, (snap) => {
      setChats(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubChats();
  }, [userId]);

  // ---------------- FEATURE: RELATIONSHIPS (FOLLOWING/FOLLOWERS) ----------------
  useEffect(() => {
    if (!userId) return;
    const unsubFollowing = onSnapshot(collection(db, "users", userId, "following"), (snap) => setFollowingIds(snap.docs.map(d => d.id)));
    const unsubFollowers = onSnapshot(collection(db, "users", userId, "followers"), (snap) => setFollowerIds(snap.docs.map(d => d.id)));
    return () => { unsubFollowing(); unsubFollowers(); };
  }, [userId]);

  // ---------------- FEATURE: MUTUAL FRIENDS CALCULATION ----------------
  useEffect(() => {
    if (!userId || followingIds.length === 0) { setFriends([]); return; }
    const mutualIds = followingIds.filter(id => followerIds.includes(id));
    const unsubs = mutualIds.map(targetId => onSnapshot(doc(db, "users", targetId), (snap) => {
      if (snap.exists()) {
        setFriends(prev => {
          const others = prev.filter(p => p.id !== targetId);
          return [...others, { id: targetId, ...snap.data() }];
        });
      }
    }));
    return () => unsubs.forEach(u => u());
  }, [followingIds, followerIds]);

  // ---------------- FEATURE: PATIENT USERNAME SEARCH ----------------
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery.trim().length >= 1) {
        performSearch();
      } else {
        setSearchResults([]);
        setHasSearched(false);
      }
    }, 800); // 800ms Wait to be sure typing is finished
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const performSearch = () => {
    setIsSearching(true);
    const q = query(
      collection(db, "users"),
      where("username", ">=", searchQuery),
      where("username", "<=", searchQuery + "\uf8ff"),
      limit(20)
    );

    onSnapshot(q, (snap) => {
      const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSearchResults(results);
      setIsSearching(false);
      setHasSearched(true);
      
      // AUTO-CLEAR: If absolutely nothing is found, clear the bar after 4 seconds
      if (results.length === 0) {
        setTimeout(() => setSearchQuery(""), 4000);
      }
    });
  };

  const toggleFollow = async (targetId: string) => {
    if (!userId) return;
    const isFollowing = followingIds.includes(targetId);
    try {
      if (isFollowing) {
        await deleteDoc(doc(db, "users", userId, "following", targetId));
        await deleteDoc(doc(db, "users", targetId, "followers", userId));
      } else {
        await setDoc(doc(db, "users", userId, "following", targetId), { timestamp: serverTimestamp() });
        await setDoc(doc(db, "users", targetId, "followers", userId), { timestamp: serverTimestamp() });
      }
    } catch (e) { Alert.alert("Error", "Check Database Rules."); }
  };

  const startChat = async (targetUser: any) => {
    if (!userId) return;
    setSearchQuery(""); // Clear search bar on chat start
    const chatId = userId < targetUser.id ? `${userId}_${targetUser.id}` : `${targetUser.id}_${userId}`;
    await setDoc(doc(db, "chats", chatId), {
      participants: [userId, targetUser.id],
      participantData: {
        [userId]: { name: auth.currentUser?.displayName || "User", photo: auth.currentUser?.photoURL || "" },
        [targetUser.id]: { name: targetUser.username || "User", photo: targetUser.photoURL || "" }
      },
      lastMessage: "Connecting...",
      lastMessageAt: serverTimestamp(),
      typingStatus: { [userId]: false, [targetUser.id]: false }
    }, { merge: true });
    router.push({ pathname: "/chat/[id]", params: { id: targetUser.id } } as any);
  };

  const switchTab = (tab: "Chats" | "Friends", index: number) => {
    setSearchQuery(""); // Reset search on tab switch
    setActiveTab(tab);
    Animated.spring(tabScrollValue, { toValue: index * ((width - 40) / 2), useNativeDriver: Platform.OS !== 'web', friction: 8 }).start();
  };

  // ---------------- COMPONENT: DYNAMIC LIST ITEM ----------------
  const UserItem = ({ item, isChatView }: { item: any, isChatView: boolean }) => {
    const isFollowing = followingIds.includes(item.id);
    const isFollower = followerIds.includes(item.id);
    const isMutual = isFollowing && isFollower;

    const otherId = isChatView ? item.participants?.find((p: string) => p !== userId) : item.id;
    const userData = isChatView ? item.participantData?.[otherId] : item;
    const isTyping = isChatView && item.typingStatus?.[otherId];

    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.cardMain} onPress={() => router.push({ pathname: "/profile/[id]", params: { id: otherId } } as any)}>
          <View style={styles.avatarWrap}>
            {(userData?.photoURL || userData?.photo) && <Image source={{ uri: userData.photoURL || userData.photo }} style={styles.avatarImg} />}
            {(item.isOnline || isChatView) && <View style={styles.onlineDot} />}
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{userData?.username || userData?.name || "Member"}</Text>
            {isChatView ? (
              <Text style={[styles.status, isTyping && { color: THEME.accent }]} numberOfLines={1}>
                {isTyping ? "typing..." : item.lastMessage}
              </Text>
            ) : (
              <Text style={styles.status}>{item.isOnline ? "🟢 Active" : isMutual ? "✨ Mutual" : "📖 Scholar"}</Text>
            )}
          </View>
        </TouchableOpacity>
        
        <View style={styles.actions}>
          {!isChatView && (
            <TouchableOpacity style={[styles.btn, isFollowing && styles.btnFollowed]} onPress={() => toggleFollow(item.id)}>
              <Ionicons name={isFollowing ? "person-remove" : "person-add"} size={20} color={isFollowing ? THEME.text : THEME.bg} />
            </TouchableOpacity>
          )}
          {(isMutual || isChatView) && (
            <TouchableOpacity style={styles.btn} onPress={() => isChatView ? router.push({ pathname: "/chat/[id]", params: { id: otherId } } as any) : startChat(item)}>
              <Ionicons name="chatbubble-ellipses" size={20} color={THEME.bg} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.brandTitle}>WRITHA SOCIAL</Text>
        <View style={styles.searchContainer}>
          <Feather name="search" size={20} color={THEME.textMuted} />
          <TextInput 
            placeholder="Search for usernames..." 
            placeholderTextColor="#4B3E63" 
            style={styles.searchInput} 
            value={searchQuery} 
            onChangeText={setSearchQuery} 
            autoCapitalize="none"
          />
          {isSearching && <ActivityIndicator size="small" color={THEME.accent} />}
        </View>
      </View>

      <View style={styles.tabs}>
        <Animated.View style={[styles.tabIndicator, { transform: [{ translateX: tabScrollValue }] }]} />
        <TouchableOpacity style={styles.tab} onPress={() => switchTab("Chats", 0)}><Text style={[styles.tabText, activeTab === "Chats" && { color: THEME.bg }]}>CHATS</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => switchTab("Friends", 1)}><Text style={[styles.tabText, activeTab === "Friends" && { color: THEME.bg }]}>FRIENDS</Text></TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={THEME.accent} size="large" style={{ marginTop: 100 }} />
      ) : (
        <FlatList
          data={searchQuery.length > 0 ? searchResults : activeTab === "Chats" ? chats : friends}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => <UserItem item={item} isChatView={activeTab === "Chats" && searchQuery.length === 0} />}
          ListEmptyComponent={
            <View style={styles.emptyView}>
              <Text style={styles.emptyText}>
                {searchQuery.length > 0 && hasSearched 
                  ? `No user found with username: "${searchQuery}"` 
                  : activeTab === "Chats" ? "Your chat list is empty." : "Follow friends to see them here!"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: { paddingTop: 60, paddingHorizontal: 25, marginBottom: 15 },
  brandTitle: { color: THEME.text, fontSize: 26, fontWeight: "900", letterSpacing: 4, marginBottom: 15 },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, borderRadius: 18, paddingHorizontal: 15, height: 55, borderWidth: 1, borderColor: "#2D1B4D" },
  searchInput: { flex: 1, marginLeft: 12, color: THEME.text, fontWeight: "700", fontSize: 16 },
  tabs: { flexDirection: "row", marginHorizontal: 25, backgroundColor: THEME.ui, borderRadius: 15, height: 50, marginBottom: 10 },
  tab: { flex: 1, justifyContent: 'center', alignItems: "center", zIndex: 1 },
  tabText: { color: THEME.text, fontWeight: "900", fontSize: 14, letterSpacing: 1 },
  tabIndicator: { position: "absolute", width: "50%", height: "100%", backgroundColor: THEME.accent, borderRadius: 15 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, padding: 18, borderRadius: 25, marginBottom: 15 },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatarWrap: { width: 60, height: 60, borderRadius: 20, backgroundColor: "#2D1B4D" },
  avatarImg: { width: '100%', height: '100%', borderRadius: 20 },
  onlineDot: { position: 'absolute', right: -3, bottom: -3, width: 16, height: 16, borderRadius: 8, backgroundColor: THEME.online, borderWidth: 3, borderColor: THEME.ui },
  info: { marginLeft: 18, flex: 1 },
  name: { color: THEME.text, fontWeight: "900", fontSize: 18 },
  status: { color: THEME.accent, fontSize: 13, marginTop: 5, fontWeight: "700" },
  actions: { flexDirection: 'row' },
  btn: { backgroundColor: THEME.accent, padding: 12, borderRadius: 15, marginLeft: 10 },
  btnFollowed: { backgroundColor: 'transparent', borderWidth: 1, borderColor: THEME.textMuted },
  emptyView: { marginTop: 120, alignItems: 'center', paddingHorizontal: 50 },
  emptyText: { color: THEME.textMuted, textAlign: 'center', fontSize: 16, fontWeight: "700", lineHeight: 24 }
});