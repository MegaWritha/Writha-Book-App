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
  Alert,
  Modal
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
  deleteDoc,
  updateDoc
} from "firebase/firestore";

const { width, height } = Dimensions.get("window");

// --- THIS INTERFACE FIXES THE ERROR IN YOUR SCREENSHOT ---
interface ScholarNotification {
  id: string;
  read: boolean;
  type: string;
  fromId: string;
  fromUsername: string;
  fromImage: string;
  message: string;
  timestamp: any;
}

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

  // --- NOTIFICATION STATES (FIXED TYPE) ---
  const [notifications, setNotifications] = useState<ScholarNotification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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

  // ---------------- FEATURE: GLOBAL NOTIFICATIONS ----------------
  useEffect(() => {
    if (!userId) return;
    const qNotifs = query(
      collection(db, "users", userId, "notifications"),
      orderBy("timestamp", "desc"),
      limit(30)
    );
    const unsubNotifs = onSnapshot(qNotifs, (snap) => {
      // Mapping the data to our Fixed Interface
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ScholarNotification));
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    });
    return () => unsubNotifs();
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
    if (!userId || (followingIds.length === 0 && followerIds.length === 0)) { setFriends([]); return; }
    const mutualIds = followingIds.filter(id => followerIds.includes(id));
    if (mutualIds.length === 0) { setFriends([]); return; }
    
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
    }, 800);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const performSearch = () => {
    setIsSearching(true);
    const q = query(
      collection(db, "users"),
      where("username", ">=", searchQuery.toLowerCase()),
      where("username", "<=", searchQuery.toLowerCase() + "\uf8ff"),
      limit(20)
    );

    onSnapshot(q, (snap) => {
      const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSearchResults(results);
      setIsSearching(false);
      setHasSearched(true);
      if (results.length === 0) {
        setTimeout(() => setSearchQuery(""), 4000);
      }
    });
  };

  const markNotifsRead = async () => {
    setShowNotifs(true);
    notifications.forEach(async (n) => {
      if (!n.read) {
        await updateDoc(doc(db, "users", userId!, "notifications", n.id), { read: true });
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
    setSearchQuery("");
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
    setSearchQuery("");
    setActiveTab(tab);
    Animated.spring(tabScrollValue, { toValue: index * ((width - 40) / 2), useNativeDriver: Platform.OS !== 'web', friction: 8 }).start();
  };

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
            {(userData?.photoURL || userData?.photo || userData?.profilePic) && <Image source={{ uri: userData.photoURL || userData.photo || userData.profilePic }} style={styles.avatarImg} />}
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
        <View style={styles.headerTop}>
          <Text style={styles.brandTitle}>WRITHA SOCIAL</Text>
          <TouchableOpacity style={styles.notifBell} onPress={markNotifsRead}>
            <Ionicons name="notifications-outline" size={28} color={THEME.accent} />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.searchContainer}>
          <Feather name="search" size={20} color={THEME.textMuted} />
          <TextInput placeholder="Search for usernames..." placeholderTextColor="#4B3E63" style={styles.searchInput} value={searchQuery} onChangeText={setSearchQuery} autoCapitalize="none" />
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

      {/* GLOBAL NOTIFICATION MODAL (SLIDES FROM RIGHT) */}
      <Modal visible={showNotifs} animationType="slide" transparent={true} onRequestClose={() => setShowNotifs(false)}>
        <View style={styles.notifOverlay}>
          <TouchableOpacity style={styles.dismissArea} onPress={() => setShowNotifs(false)} />
          <View style={styles.notifPanel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>NOTIFICATIONS</Text>
              <TouchableOpacity onPress={() => setShowNotifs(false)}>
                <Ionicons name="close-outline" size={30} color={THEME.accent} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 50 }}
              ListEmptyComponent={<Text style={styles.emptyNotif}>You have no Notifications.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.notifItem} onPress={() => { setShowNotifs(false); router.push(`/profile/${item.fromId}`); }}>
                  <Image source={{ uri: item.fromImage || "https://ui-avatars.com/api/?name=S" }} style={styles.notifAvatar} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.notifDesc}>
                      <Text style={{ color: '#FFF', fontWeight: '900' }}>@{item.fromUsername}</Text> {item.message}
                    </Text>
                    <Text style={styles.notifTime}>{item.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                  <View style={[styles.notifTypeIndicator, { backgroundColor: item.type === 'follow' ? '#A78BFA' : item.type === 'like' ? '#F43F5E' : THEME.accent }]} />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: { paddingTop: 60, paddingHorizontal: 25, marginBottom: 15 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  brandTitle: { color: THEME.text, fontSize: 26, fontWeight: "900", letterSpacing: 4 },
  notifBell: { padding: 5, position: 'relative' },
  notifBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: '#FF4444', minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: THEME.bg },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
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
  emptyText: { color: THEME.textMuted, textAlign: 'center', fontSize: 16, fontWeight: "700", lineHeight: 24 },
  notifOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', flexDirection: 'row' },
  dismissArea: { flex: 1 },
  notifPanel: { width: width * 0.85, backgroundColor: THEME.ui, height: '100%', borderTopLeftRadius: 35, borderBottomLeftRadius: 35, padding: 25, paddingTop: 60, borderLeftWidth: 1, borderLeftColor: THEME.accent },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  panelTitle: { color: THEME.text, fontSize: 20, fontWeight: "900", letterSpacing: 2 },
  notifItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.bg, padding: 15, borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: '#2D1B4D' },
  notifAvatar: { width: 45, height: 45, borderRadius: 15 },
  notifDesc: { color: THEME.textMuted, fontSize: 14, lineHeight: 20 },
  notifTime: { color: THEME.accent, fontSize: 10, fontWeight: '700', marginTop: 4 },
  notifTypeIndicator: { width: 4, height: 30, borderRadius: 2, marginLeft: 10 },
  emptyNotif: { color: THEME.textMuted, textAlign: 'center', marginTop: 100, fontWeight: '700' }
});