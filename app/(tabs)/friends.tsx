import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  Animated, Dimensions, StatusBar, TextInput, Platform
} from "react-native";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { db, auth } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot, doc, setDoc, orderBy, limit
} from "firebase/firestore";

const { width } = Dimensions.get("window");

// FALLBACKS FOR EMPTY DATA FIELDS
const PLACEHOLDERS = {
  avatar: "https://ui-avatars.com/api/?background=1E1135&color=FFD700&bold=true&name=W",
  name: "Writha Member",
  bio: "A mysterious scholar of the ink.",
  lastMsg: "No words shared yet..."
};

const THEME = {
  bg: "#0F071A",
  ui: "#1E1135",
  accent: "#FFD700",
  text: "#E2E8F0",
  textMuted: "#94A3B8",
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

  const tabScrollValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!userId) return;

    const qChats = query(
      collection(db, "chats"),
      where("participants", "array-contains", userId),
      orderBy("lastMessageAt", "desc")
    );

    const unsubChats = onSnapshot(qChats, (snap) => {
      const chatList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChats(chatList);
      setLoading(false);
    });

    const unsubFriends = onSnapshot(collection(db, "users", userId, "following"), (snap) => {
      setFriends(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubChats(); unsubFriends(); };
  }, [userId]);

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

  const switchTab = (tab: TabType, index: number) => {
    setActiveTab(tab);
    Animated.spring(tabScrollValue, {
      toValue: index * ((width - 50) / 2), 
      useNativeDriver: true,
      friction: 8
    }).start();
  };

  const startChat = async (targetUser: any) => {
    if (!userId) return;
    const chatId = userId < targetUser.id ? `${userId}_${targetUser.id}` : `${targetUser.id}_${userId}`;
    
    await setDoc(doc(db, "chats", chatId), {
      participants: [userId, targetUser.id],
      participantData: {
        [userId]: { name: auth.currentUser?.displayName || PLACEHOLDERS.name, photo: auth.currentUser?.photoURL || PLACEHOLDERS.avatar },
        [targetUser.id]: { name: targetUser.displayName || PLACEHOLDERS.name, photo: targetUser.photoURL || PLACEHOLDERS.avatar }
      },
      lastMessage: "Start of a new chat...",
      lastMessageAt: new Date()
    }, { merge: true });

    router.push(`/chat/${chatId}` as any);
  };

  // --- THE EMPTY STATE MESSAGE COMPONENT ---
  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.goldCircle}>
        <MaterialCommunityIcons 
          name={activeTab === 'Chats' ? "message-text-outline" : "account-group-outline"} 
          size={40} color={THEME.accent} 
        />
      </View>
      <Text style={styles.emptyTitle}>THE ROOM IS QUIET</Text>
      <Text style={styles.emptySub}>
        {activeTab === 'Chats' 
          ? "start messaging friends to get started" 
          : "no friends yet"}
      </Text>
    </View>
  );

  const ChatItem = ({ item }: any) => {
    const otherId = item.participants.find((p: string) => p !== userId);
    const otherUser = item.participantData?.[otherId];

    return (
      <TouchableOpacity style={styles.cardFrame} onPress={() => router.push(`/chat/${item.id}` as any)}>
        <View style={styles.cardInner}>
          <Image source={{ uri: otherUser?.photo || PLACEHOLDERS.avatar }} style={styles.avatar} />
          <View style={styles.chatInfo}>
            <View style={styles.rowBetween}>
              <Text style={styles.nameText}>{otherUser?.name || PLACEHOLDERS.name}</Text>
              <Text style={styles.timeText}>Just now</Text>
            </View>
            <Text style={styles.msgPreview} numberOfLines={1}>{item.lastMessage || PLACEHOLDERS.lastMsg}</Text>
          </View>
          <View style={styles.goldIndicator} />
        </View>
      </TouchableOpacity>
    );
  };

  const UserItem = ({ item }: any) => (
    <View style={[styles.cardFrame, { borderColor: THEME.ui }]}>
      <View style={styles.cardInner}>
        <Image source={{ uri: item.photoURL || PLACEHOLDERS.avatar }} style={styles.avatar} />
        <View style={styles.chatInfo}>
          <Text style={styles.nameText}>{item.displayName || PLACEHOLDERS.name}</Text>
          <Text style={styles.msgPreview} numberOfLines={1}>{item.bio || PLACEHOLDERS.bio}</Text>
        </View>
        <TouchableOpacity style={styles.actionBtn} onPress={() => startChat(item)}>
          <Ionicons name="chatbubble-ellipses" size={20} color={THEME.bg} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const displayData = searchQuery.length > 0 ? searchResults : (activeTab === "Chats" ? chats : friends);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.brandTitle}>WRITHA SOCIAL</Text>
          <TouchableOpacity style={styles.settingsIcon} onPress={() => router.push('/settings/social' as any)}>
            <Ionicons name="options-outline" size={24} color={THEME.accent} />
          </TouchableOpacity>
        </View>
        <View style={styles.searchWrapper}>
          <View style={styles.searchBar}>
            <Feather name="search" size={18} color={THEME.accent} />
            <TextInput
              placeholder="Search authors & friends..."
              placeholderTextColor={THEME.textMuted}
              style={styles.input}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <Animated.View style={[styles.tabIndicator, { transform: [{ translateX: tabScrollValue }] }]} />
        <TouchableOpacity style={styles.tabItem} onPress={() => switchTab("Chats", 0)}>
          <Text style={[styles.tabLabel, activeTab === "Chats" && { color: THEME.bg }]}>CHATS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => switchTab("Friends", 1)}>
          <Text style={[styles.tabLabel, activeTab === "Friends" && { color: THEME.bg }]}>FRIENDS</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        // This ensures the message shows up when the list is empty
        ListEmptyComponent={<EmptyState />}
        renderItem={({ item }) => (
          activeTab === "Friends" || searchQuery.length > 0
            ? <UserItem item={item} /> 
            : <ChatItem item={item} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: { paddingTop: 60, paddingHorizontal: 25, paddingBottom: 15 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  brandTitle: { color: THEME.text, fontSize: 18, fontWeight: '900', letterSpacing: 4 },
  settingsIcon: { width: 45, height: 45, borderRadius: 15, backgroundColor: THEME.ui, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: THEME.accent + '30' },
  searchWrapper: { marginBottom: 5 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.ui, borderRadius: 15, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: THEME.accent + '20' },
  input: { flex: 1, marginLeft: 10, color: THEME.text, fontSize: 14 },
  tabContainer: { flexDirection: 'row', height: 45, marginHorizontal: 25, backgroundColor: THEME.ui, borderRadius: 25, marginBottom: 20, position: 'relative', overflow: 'hidden' },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  tabLabel: { fontSize: 11, fontWeight: '900', color: THEME.textMuted, letterSpacing: 2 },
  tabIndicator: { position: 'absolute', width: '50%', height: '100%', backgroundColor: THEME.accent, borderRadius: 25 },
  listContainer: { paddingHorizontal: 25, paddingBottom: 120, flexGrow: 1 },
  cardFrame: { marginBottom: 15, borderWidth: 1, borderColor: THEME.accent + '40', borderRadius: 20, backgroundColor: THEME.ui, padding: 2 },
  cardInner: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 18, backgroundColor: THEME.ui },
  avatar: { width: 55, height: 55, borderRadius: 18, backgroundColor: '#333' },
  chatInfo: { flex: 1, marginLeft: 15 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nameText: { color: THEME.text, fontWeight: 'bold', fontSize: 15 },
  timeText: { color: THEME.textMuted, fontSize: 10 },
  msgPreview: { color: THEME.textMuted, fontSize: 12, marginTop: 4 },
  goldIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.accent, marginLeft: 10 },
  actionBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.accent, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  goldCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: THEME.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 25, backgroundColor: THEME.accent + '10' },
  emptyTitle: { color: THEME.text, fontWeight: '900', letterSpacing: 3, fontSize: 14, marginBottom: 10 },
  emptySub: { color: THEME.textMuted, textAlign: 'center', fontSize: 12, lineHeight: 20, textTransform: 'lowercase' }
});