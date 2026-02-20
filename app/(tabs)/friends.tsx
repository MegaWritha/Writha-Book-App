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
  Alert,
  Platform
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
  getDoc,
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

type TabType = "Chats" | "Friends";

export default function SocialScreen() {
  const router = useRouter();
  const userId = auth.currentUser?.uid;

  const [activeTab, setActiveTab] = useState<TabType>("Chats");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [chats, setChats] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followerIds, setFollowerIds] = useState<string[]>([]);

  const tabScrollValue = useRef(new Animated.Value(0)).current;

  // ---------------- LOAD CHATS ----------------
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
    }, (err) => {
      console.error("Chat Query Error:", err);
      // If you see an alert about an INDEX, click the link in your console!
      setLoading(false); 
    });
    return () => unsubChats();
  }, [userId]);

  // ---------------- LOAD RELATIONSHIPS ----------------
  useEffect(() => {
    if (!userId) return;
    const unsubFollowing = onSnapshot(collection(db, "users", userId, "following"), 
      (snap) => setFollowingIds(snap.docs.map(d => d.id)),
      (err) => console.log("Following Permission Error:", err)
    );
    const unsubFollowers = onSnapshot(collection(db, "users", userId, "followers"), 
      (snap) => setFollowerIds(snap.docs.map(d => d.id)),
      (err) => console.log("Followers Permission Error:", err)
    );
    return () => { unsubFollowing(); unsubFollowers(); };
  }, [userId]);

  // ---------------- SYNC FRIENDS WITH ONLINE STATUS ----------------
  useEffect(() => {
    if (!userId || followingIds.length === 0) return;
    const mutualIds = followingIds.filter(id => followerIds.includes(id));
    const unsubs = mutualIds.map(targetId => 
      onSnapshot(doc(db, "users", targetId), (snap) => {
        if (snap.exists()) {
          setFriends(prev => {
            const others = prev.filter(p => p.id !== targetId);
            return [...others, { id: targetId, ...snap.data() }];
          });
        }
      })
    );
    return () => unsubs.forEach(unsub => unsub());
  }, [followingIds, followerIds]);

  // ---------------- SEARCH USERS ----------------
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const q = query(
      collection(db, "users"),
      where("displayName", ">=", searchQuery),
      where("displayName", "<=", searchQuery + "\uf8ff"),
      limit(10)
    );
    const unsubSearch = onSnapshot(q, (snap) => {
      setSearchResults(snap.docs.filter(d => d.id !== userId).map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubSearch();
  }, [searchQuery, userId]);

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
    } catch (e) { Alert.alert("Permissions Error", "Check your Firestore rules for sub-collections."); }
  };

  const startChat = async (targetUser: any) => {
    if (!userId) return;
    const chatId = userId < targetUser.id ? `${userId}_${targetUser.id}` : `${targetUser.id}_${userId}`;
    await setDoc(doc(db, "chats", chatId), {
      participants: [userId, targetUser.id],
      participantData: {
        [userId]: { name: auth.currentUser?.displayName || "User", photo: auth.currentUser?.photoURL || "" },
        [targetUser.id]: { name: targetUser.displayName || "User", photo: targetUser.photoURL || "" }
      },
      lastMessage: "Start of a new conversation...",
      lastMessageAt: serverTimestamp(),
      typingStatus: { [userId]: false, [targetUser.id]: false }
    }, { merge: true });
    router.push({ pathname: "/chat/[id]", params: { id: targetUser.id } } as any);
  };

  const switchTab = (tab: TabType, index: number) => {
    setActiveTab(tab);
    Animated.spring(tabScrollValue, { 
      toValue: index * ((width - 40) / 2), 
      useNativeDriver: Platform.OS !== 'web', // FIX FOR IMAGE #4
      friction: 8 
    }).start();
  };

  const ChatItem = ({ item }: any) => {
    const otherId = item.participants?.find((p: string) => p !== userId);
    const otherUser = item.participantData?.[otherId];
    const isTyping = item.typingStatus?.[otherId] === true;

    return (
      <TouchableOpacity style={styles.card} onPress={() => router.push({ pathname: "/chat/[id]", params: { id: otherId } } as any)}>
        <View style={styles.avatar}>{otherUser?.photo && <Image source={{ uri: otherUser.photo }} style={styles.avatarImage} />}</View>
        <View style={styles.info}>
          <Text style={styles.name}>{otherUser?.name || "Writha Member"}</Text>
          {isTyping ? <Text style={[styles.preview, { color: THEME.accent }]}>typing...</Text> : <Text style={styles.preview} numberOfLines={1}>{item.lastMessage}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const UserItem = ({ item }: any) => {
    const isFollowing = followingIds.includes(item.id);
    const isFollower = followerIds.includes(item.id);
    const isMutual = isFollowing && isFollower;
    return (
      <View style={styles.card}>
        <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={() => router.push({ pathname: "/profile/[id]", params: { id: item.id } } as any)}>
          <View style={styles.avatar}>
            {item.photoURL && <Image source={{ uri: item.photoURL }} style={styles.avatarImage} />}
            {item.isOnline && <View style={styles.onlineDot} />}
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{item.displayName}</Text>
            <Text style={styles.statusBadge}>{item.isOnline ? "🟢 Active Now" : isMutual ? "✨ Mutual" : "📖 Scholar"}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.followBtn, isFollowing && styles.followingBtn]} onPress={() => toggleFollow(item.id)}>
          <Ionicons name={isFollowing ? "person-remove" : "person-add"} size={18} color={isFollowing ? THEME.text : THEME.bg} />
        </TouchableOpacity>
        {isMutual && <TouchableOpacity style={styles.chatBtn} onPress={() => startChat(item)}><Ionicons name="chatbubble-ellipses" size={18} color={THEME.bg} /></TouchableOpacity>}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>WRITHA SOCIAL</Text>
        <View style={styles.search}>
          <Feather name="search" size={16} color={THEME.textMuted} />
          <TextInput placeholder="Search library members..." placeholderTextColor={THEME.textMuted} style={styles.input} value={searchQuery} onChangeText={setSearchQuery} />
        </View>
      </View>

      <View style={styles.tabs}>
        <Animated.View style={[styles.indicator, { transform: [{ translateX: tabScrollValue }] }]} />
        <TouchableOpacity style={styles.tab} onPress={() => switchTab("Chats", 0)}><Text style={[styles.tabText, activeTab === "Chats" && { color: THEME.bg }]}>Chats</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => switchTab("Friends", 1)}><Text style={[styles.tabText, activeTab === "Friends" && { color: THEME.bg }]}>Friends</Text></TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={THEME.accent} size="large" /></View>
      ) : (
        <FlatList
          data={searchQuery.length > 0 ? searchResults : activeTab === "Chats" ? chats : friends}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => (activeTab === "Chats" && searchQuery.length === 0 ? <ChatItem item={item} /> : <UserItem item={item} />)}
          ListEmptyComponent={<Text style={styles.emptyText}>Nothing found. Follow friends and start a chat to begin!</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: { paddingTop: 60, paddingHorizontal: 20, marginBottom: 15 },
  title: { color: THEME.text, fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  search: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, borderRadius: 10, paddingHorizontal: 10, height: 40 },
  input: { flex: 1, marginLeft: 8, color: THEME.text },
  tabs: { flexDirection: "row", marginHorizontal: 20, backgroundColor: THEME.ui, borderRadius: 25, height: 45, position: 'relative' },
  tab: { flex: 1, justifyContent: 'center', alignItems: "center", zIndex: 1 },
  tabText: { color: THEME.text, fontWeight: "600" },
  indicator: { position: "absolute", width: "50%", height: "100%", backgroundColor: THEME.accent, borderRadius: 25 },
  card: { flexDirection: "row", alignItems: "center", marginBottom: 12, backgroundColor: THEME.ui, padding: 12, borderRadius: 15 },
  avatar: { width: 52, height: 52, borderRadius: 18, backgroundColor: "#2D1B4D", position: 'relative' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 18 },
  onlineDot: { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: THEME.online, borderWidth: 2, borderColor: THEME.ui },
  info: { flex: 1, marginLeft: 12 },
  name: { color: THEME.text, fontWeight: "bold", fontSize: 15 },
  preview: { color: THEME.textMuted, fontSize: 12, marginTop: 2 },
  statusBadge: { color: THEME.accent, fontSize: 10, marginTop: 2, fontWeight: '600' },
  followBtn: { backgroundColor: THEME.accent, padding: 10, borderRadius: 12, marginLeft: 8 },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: THEME.textMuted },
  chatBtn: { backgroundColor: THEME.accent, padding: 10, borderRadius: 12, marginLeft: 8 },
  emptyText: { color: THEME.textMuted, textAlign: 'center', marginTop: 50 }
});