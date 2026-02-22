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
  Modal,
  ScrollView,
  KeyboardAvoidingView
} from "react-native";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  orderBy,
  limit,
  serverTimestamp,
  deleteDoc,
  updateDoc,
  addDoc
} from "firebase/firestore";

const { width, height } = Dimensions.get("window");

// --- TYPES ---
type GroupType = "reading" | "research" | "discussion" | "study";

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
  surface: "#111111",
  accent: "#D4AF37", // Writha Gold
  purple: "#8E2DE2",
  text: "#E2E8F0",
  textMuted: "#94A3B8",
  online: "#4ADE80",
};

export default function SocialScreen() {
  const router = useRouter();
  const userId = auth.currentUser?.uid;

  const [activeTab, setActiveTab] = useState<"Chats" | "Friends" | "Groups">("Chats");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // DATA STATES
  const [chats, setChats] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  // RELATIONSHIP & NOTIF STATES
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<ScholarNotification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // GROUP CREATION STATES (FROM HUB/WEAVES)
  const [modalVisible, setModalVisible] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupType, setGroupType] = useState<GroupType>("reading");
  const [isPrivate, setIsPrivate] = useState(true);

  const tabScrollValue = useRef(new Animated.Value(0)).current;

  // ---------------- LISTENERS ----------------

  useEffect(() => {
    if (!userId) return;
    // Chats
    const qChats = query(collection(db, "chats"), where("participants", "array-contains", userId), orderBy("lastMessageAt", "desc"));
    const unsubChats = onSnapshot(qChats, (snap) => {
      setChats(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    // Groups (Your Weaves Logic)
    const qGroups = query(collection(db, "groups"), where("members", "array-contains", userId));
    const unsubGroups = onSnapshot(qGroups, (snap) => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    // Relationships
    const unsubFollowing = onSnapshot(collection(db, "users", userId, "following"), (snap) => setFollowingIds(snap.docs.map(d => d.id)));
    const unsubFollowers = onSnapshot(collection(db, "users", userId, "followers"), (snap) => setFollowerIds(snap.docs.map(d => d.id)));
    // Notifications
    const qNotifs = query(collection(db, "users", userId, "notifications"), orderBy("timestamp", "desc"), limit(30));
    const unsubNotifs = onSnapshot(qNotifs, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ScholarNotification));
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    });

    return () => { unsubChats(); unsubGroups(); unsubFollowing(); unsubFollowers(); unsubNotifs(); };
  }, [userId]);

  // Mutual Friends logic
  useEffect(() => {
    if (!userId || (followingIds.length === 0 && followerIds.length === 0)) { setFriends([]); return; }
    const mutualIds = followingIds.filter(id => followerIds.includes(id));
    const unsubs = mutualIds.map(id => onSnapshot(doc(db, "users", id), (snap) => {
      if (snap.exists()) setFriends(prev => [...prev.filter(p => p.id !== id), { id, ...snap.data() }]);
    }));
    return () => unsubs.forEach(u => u());
  }, [followingIds, followerIds]);

  // ---------------- ACTIONS ----------------

  const createGroupWeave = async () => {
    if (!groupName.trim()) { Alert.alert("VOID INPUT", "Please name your Groupweave."); return; }
    try {
      const docRef = await addDoc(collection(db, "groups"), {
        name: groupName.trim(),
        type: groupType,
        privacy: isPrivate ? "private" : "public",
        createdBy: userId, 
        members: [userId],
        createdAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
        weaveLevel: 1
      });
      setModalVisible(false);
      setGroupName("");
      router.push(`/group/${docRef.id}` as any);
    } catch (e: any) { Alert.alert("SYNC ERROR", e.message); }
  };

  const switchTab = (tab: "Chats" | "Friends" | "Groups", index: number) => {
    setActiveTab(tab);
    Animated.spring(tabScrollValue, { 
      toValue: index * ((width - 40) / 3), 
      useNativeDriver: Platform.OS !== 'web', 
      friction: 8 
    }).start();
  };

  const getGroupIcon = (itemType: string) => {
    switch (itemType) {
      case 'research': return "flask-outline";
      case 'reading': return "book-outline";
      case 'study': return "school-outline";
      default: return "chatbubbles-outline";
    }
  };

  // ---------------- RENDER COMPONENTS ----------------

  const ListHeader = () => {
    if (activeTab !== "Groups") return null;
    return (
      <View style={styles.groupHeaderContainer}>
        <View style={styles.statsStrip}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{groups.length}</Text>
            <Text style={styles.statLabel}>ACTIVE</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{groups.filter(g => g.privacy === 'private').length}</Text>
            <Text style={styles.statLabel}>PRIVATE</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{groups.reduce((acc, g) => acc + (g.members?.length || 0), 0)}</Text>
            <Text style={styles.statLabel}>SCHOLARS</Text>
          </View>
        </View>
      </View>
    );
  };

  const RenderItem = ({ item }: { item: any }) => {
    // --- GROUP CARD (EXACT HUB/WEAVES STYLE) ---
    if (activeTab === "Groups") {
      return (
        <TouchableOpacity 
          activeOpacity={0.8} 
          style={styles.goldBorderWrapper} 
          onPress={() => router.push(`/group/${item.id}` as any)}
        >
          <View style={styles.cardInternal}>
            <View style={styles.cardHeader}>
              <View style={[styles.tag, { borderColor: item.type === 'research' ? THEME.purple : THEME.accent }]}>
                <Text style={styles.tagText}>{item.type?.toUpperCase()}</Text>
              </View>
              <Ionicons name={item.privacy === 'private' ? "lock-closed" : "globe-outline"} size={14} color={THEME.textMuted} />
            </View>
            <View style={styles.cardMain}>
              <View style={styles.weaveAvatar}><Text style={styles.weaveAvatarText}>{item.name ? item.name[0] : '?'}</Text></View>
              <View style={styles.weaveInfo}>
                <Text style={styles.weaveName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.memberStrip}>
                  <Ionicons name="people-outline" size={12} color={THEME.textMuted} />
                  <Text style={styles.memberCount}>{item.members?.length || 1} scholars joined</Text>
                </View>
              </View>
              <View style={styles.lvlBadge}><Text style={styles.lvlText}>LVL {item.weaveLevel || 1}</Text></View>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // --- CHAT/FRIEND CARD (ORIGINAL SOCIAL STYLE) ---
    const isChat = activeTab === "Chats";
    const otherId = isChat ? item.participants?.find((p: string) => p !== userId) : item.id;
    const userData = isChat ? item.participantData?.[otherId] : item;
    
    return (
      <View style={styles.socialCard}>
        <TouchableOpacity style={styles.cardClickArea} onPress={() => router.push(`/profile/${otherId}` as any)}>
          <View style={styles.avatarWrap}>
            <Image source={{ uri: userData?.photoURL || userData?.photo || "https://ui-avatars.com/api/?name=S" }} style={styles.avatarImg} />
            {userData?.isOnline && <View style={styles.onlineDot} />}
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{userData?.username || userData?.name}</Text>
            <Text style={styles.status} numberOfLines={1}>{isChat ? item.lastMessage : "Scholar"}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/chat/${otherId}`)}>
          <Ionicons name="chatbubble-ellipses" size={20} color={THEME.bg} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* LOOM ART BACKGROUND (ONLY VISIBLE ON GROUPS) */}
      {activeTab === "Groups" && (
        <View style={styles.loomArt}>
          <View style={[styles.glowCircle, { top: -50, left: -50, backgroundColor: THEME.purple }]} />
          <View style={[styles.glowCircle, { bottom: 100, right: -80, backgroundColor: THEME.accent, opacity: 0.1 }]} />
        </View>
      )}

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.brandTitle}>SOCIAL</Text>
          <View style={{ flexDirection: 'row', gap: 15 }}>
            <TouchableOpacity onPress={() => setModalVisible(true)}>
              <Ionicons name="add-circle-outline" size={32} color={THEME.accent} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowNotifs(true)}>
              <Ionicons name="notifications-outline" size={28} color={THEME.accent} />
              {unreadCount > 0 && <View style={styles.notifBadge}><Text style={styles.badgeText}>{unreadCount}</Text></View>}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.tabs}>
        <Animated.View style={[styles.tabIndicator, { transform: [{ translateX: tabScrollValue }] }]} />
        <TouchableOpacity style={styles.tab} onPress={() => switchTab("Chats", 0)}><Text style={styles.tabText}>CHATS</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => switchTab("Friends", 1)}><Text style={styles.tabText}>FRIENDS</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => switchTab("Groups", 2)}><Text style={styles.tabText}>GROUPS</Text></TouchableOpacity>
      </View>

      <FlatList
        data={activeTab === "Chats" ? chats : activeTab === "Friends" ? friends : groups}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => <RenderItem item={item} />}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
      />

      {/* --- GROUP CREATION MODAL (1:1 PORT) --- */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBackdrop}>
          <View style={styles.modalWindow}>
            <View style={styles.modalIndicator} />
            <View style={styles.modalTop}>
              <Text style={styles.modalHeading}>New Group Weave</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color={THEME.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>WEAVE DESIGNATION</Text>
              <TextInput placeholder="Ex: Quantum Ethics Discussion" placeholderTextColor="#333" value={groupName} onChangeText={setGroupName} style={styles.goldInput} />

              <Text style={styles.inputLabel}>PRIVACY LEVEL</Text>
              <View style={styles.privacyRow}>
                <TouchableOpacity onPress={() => setIsPrivate(false)} style={[styles.privacyBtn, !isPrivate && styles.privacyActive]}>
                  <Ionicons name="globe-outline" size={20} color={!isPrivate ? THEME.bg : THEME.textMuted} />
                  <Text style={[styles.privacyBtnText, !isPrivate && styles.privacyActiveText]}>Public</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsPrivate(true)} style={[styles.privacyBtn, isPrivate && styles.privacyActive]}>
                  <Ionicons name="lock-closed-outline" size={20} color={isPrivate ? THEME.bg : THEME.textMuted} />
                  <Text style={[styles.privacyBtnText, isPrivate && styles.privacyActiveText]}>Private</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>RESEARCH FOCUS</Text>
              <View style={styles.typeGrid}>
                {(["reading", "research", "discussion", "study"] as GroupType[]).map(t => (
                  <TouchableOpacity key={t} style={[styles.typeCell, groupType === t && styles.typeCellActive]} onPress={() => setGroupType(t)}>
                    <Ionicons name={getGroupIcon(t)} size={24} color={groupType === t ? THEME.bg : THEME.accent} />
                    <Text style={[styles.typeCellText, groupType === t && styles.typeCellTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.launchButton} onPress={createGroupWeave}>
                <Text style={styles.launchButtonText}>CREATE GROUP</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  loomArt: { ...StyleSheet.absoluteFillObject, zIndex: -1, overflow: 'hidden' },
  glowCircle: { position: 'absolute', width: 250, height: 250, borderRadius: 125, opacity: 0.15 },
  header: { paddingTop: 60, paddingHorizontal: 25 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandTitle: { color: THEME.text, fontSize: 26, fontWeight: "900", letterSpacing: 4 },
  notifBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#FF4444', minWidth: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  tabs: { flexDirection: "row", marginHorizontal: 25, backgroundColor: THEME.ui, borderRadius: 15, height: 50, marginTop: 25 },
  tab: { flex: 1, justifyContent: 'center', alignItems: "center", zIndex: 1 },
  tabText: { color: THEME.text, fontWeight: "900", fontSize: 12 },
  tabIndicator: { position: "absolute", width: "33.33%", height: "100%", backgroundColor: THEME.accent, borderRadius: 15 },
  
  // STATS STRIP
  groupHeaderContainer: { marginBottom: 20 },
  statsStrip: { flexDirection: 'row', backgroundColor: THEME.surface, borderRadius: 20, padding: 15, borderWidth: 1, borderColor: '#222', alignItems: 'center' },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { color: THEME.accent, fontSize: 18, fontWeight: '900' },
  statLabel: { color: THEME.textMuted, fontSize: 8, fontWeight: '900', marginTop: 2 },
  statDivider: { width: 1, height: 25, backgroundColor: '#333' },

  // CARDS (SOCIAL)
  socialCard: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, padding: 15, borderRadius: 25, marginBottom: 15 },
  cardClickArea: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatarWrap: { width: 55, height: 55, borderRadius: 18, backgroundColor: "#000" },
  avatarImg: { width: '100%', height: '100%', borderRadius: 18 },
  onlineDot: { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: THEME.online, borderWidth: 3, borderColor: THEME.ui },
  info: { marginLeft: 15, flex: 1 },
  name: { color: THEME.text, fontWeight: "900", fontSize: 16 },
  status: { color: THEME.accent, fontSize: 12, fontWeight: '700' },
  actionBtn: { backgroundColor: THEME.accent, padding: 12, borderRadius: 15 },

  // CARDS (GROUPS - WEAVES STYLE)
  goldBorderWrapper: { backgroundColor: THEME.accent, padding: 1, borderRadius: 24, marginBottom: 20 },
  cardInternal: { backgroundColor: THEME.ui, borderRadius: 23, padding: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  tag: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { color: THEME.text, fontSize: 9, fontWeight: '900' },
  cardMain: { flexDirection: 'row', alignItems: 'center' },
  weaveAvatar: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  weaveAvatarText: { color: THEME.accent, fontSize: 22, fontWeight: '900' },
  weaveInfo: { flex: 1, marginLeft: 15 },
  weaveName: { color: THEME.text, fontSize: 18, fontWeight: '800' },
  memberStrip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberCount: { color: THEME.textMuted, fontSize: 11, fontWeight: '600' },
  lvlBadge: { backgroundColor: THEME.purple + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  lvlText: { color: THEME.purple, fontSize: 10, fontWeight: '900' },

  // MODAL (WEAVES STYLE)
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'flex-end' },
  modalWindow: { backgroundColor: THEME.ui, borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 30, maxHeight: height * 0.85, borderWidth: 1, borderColor: '#222' },
  modalIndicator: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  modalHeading: { color: THEME.text, fontSize: 24, fontWeight: '900' },
  inputLabel: { color: THEME.accent, fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 15 },
  goldInput: { backgroundColor: '#000', borderRadius: 15, padding: 20, color: THEME.text, fontSize: 16, borderWidth: 1, borderColor: '#222', marginBottom: 30 },
  privacyRow: { flexDirection: 'row', gap: 15, marginBottom: 30 },
  privacyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18, borderRadius: 15, backgroundColor: '#000', borderWidth: 1, borderColor: '#222' },
  privacyActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  privacyBtnText: { color: THEME.textMuted, fontWeight: '800', textTransform: 'uppercase', fontSize: 12 },
  privacyActiveText: { color: THEME.bg },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 40 },
  typeCell: { width: '48%', backgroundColor: '#000', padding: 20, borderRadius: 18, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#222' },
  typeCellActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  typeCellText: { color: THEME.textMuted, fontWeight: '900', textTransform: 'uppercase', fontSize: 10 },
  typeCellTextActive: { color: THEME.bg },
  launchButton: { backgroundColor: THEME.purple, padding: 22, borderRadius: 20, alignItems: 'center' },
  launchButtonText: { color: THEME.text, fontWeight: '900', letterSpacing: 3, fontSize: 14 }
});