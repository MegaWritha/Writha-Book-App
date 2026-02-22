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
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  orderBy,
  limit,
  serverTimestamp,
  deleteDoc,
  updateDoc,
  addDoc,
  getDocs,
  getDoc,
} from "firebase/firestore";

const { width, height } = Dimensions.get("window");

type GroupType = "reading" | "research" | "discussion" | "study";

const THEME = {
  bg: "#0F071A",
  ui: "#1E1135",
  ui2: "#2D1B4D",
  accent: "#FFD700",
  accentDim: "rgba(255,215,0,0.12)",
  purple: "#6D28D9",
  purpleBright: "#8E2DE2",
  text: "#E2E8F0",
  textMuted: "#94A3B8",
  online: "#22C55E",
  red: "#EF4444",
};

const GROUP_ICONS: Record<GroupType, any> = {
  research: "flask-outline",
  reading: "book-outline",
  study: "school-outline",
  discussion: "chatbubbles-outline",
};

export default function SocialScreen() {
  const router = useRouter();
  const userId = auth.currentUser?.uid;

  const [activeTab, setActiveTab] = useState<"Chats" | "Friends" | "Groups">("Chats");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [chats, setChats] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [chatUserData, setChatUserData] = useState<Record<string, any>>({});

  // Group creation
  const [modalVisible, setModalVisible] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupType, setGroupType] = useState<GroupType>("reading");
  const [isPrivate, setIsPrivate] = useState(true);
  const [creating, setCreating] = useState(false);

  const tabAnim = useRef(new Animated.Value(0)).current;
  const tabWidth = (width - 48) / 3;

  // ── LISTENERS ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return;

    // Chats
    const qChats = query(
      collection(db, "chats"),
      where("participants", "array-contains", userId),
      orderBy("lastMessageAt", "desc")
    );
    const unsubChats = onSnapshot(qChats, async (snap) => {
      const chatList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setChats(chatList);
      setLoading(false);

      // Fetch other user data for each chat
      const userData: Record<string, any> = {};
      await Promise.all(
        chatList.map(async (chat: any) => {
          const otherId = chat.participants?.find((p: string) => p !== userId);
          if (otherId && !userData[otherId]) {
            const snap = await getDoc(doc(db, "users", otherId));
            if (snap.exists()) userData[otherId] = { id: otherId, ...snap.data() };
          }
        })
      );
      setChatUserData(userData);
    });

    // Groups
    const qGroups = query(collection(db, "groups"), where("members", "array-contains", userId));
    const unsubGroups = onSnapshot(qGroups, (snap) => {
      setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // Following / followers
    const unsubFollowing = onSnapshot(
      collection(db, "users", userId, "following"),
      (snap) => setFollowingIds(snap.docs.map((d) => d.id))
    );
    const unsubFollowers = onSnapshot(
      collection(db, "users", userId, "followers"),
      (snap) => setFollowerIds(snap.docs.map((d) => d.id))
    );

    // Notifications
    const qNotifs = query(
      collection(db, "users", userId, "notifications"),
      orderBy("timestamp", "desc"),
      limit(30)
    );
    const unsubNotifs = onSnapshot(qNotifs, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setNotifications(data);
      setUnreadCount(data.filter((n: any) => !n.read).length);
    });

    // People you may know — fetch random users excluding self
    const fetchSuggestions = async () => {
      const snap = await getDocs(query(collection(db, "users"), limit(20)));
      const all = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u: any) => u.id !== userId);
      setSuggestions(all.slice(0, 10));
    };
    fetchSuggestions();

    return () => {
      unsubChats();
      unsubGroups();
      unsubFollowing();
      unsubFollowers();
      unsubNotifs();
    };
  }, [userId]);

  // Mutual friends
  useEffect(() => {
    if (!userId) return;
    const mutualIds = followingIds.filter((id) => followerIds.includes(id));
    if (mutualIds.length === 0) { setFriends([]); return; }

    const unsubs = mutualIds.map((id) =>
      onSnapshot(doc(db, "users", id), (snap) => {
        if (snap.exists())
          setFriends((prev) => [
            ...prev.filter((p) => p.id !== id),
            { id, ...snap.data() },
          ]);
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [followingIds, followerIds]);

  // ── ACTIONS ───────────────────────────────────────────────────────────────

  const switchTab = (tab: "Chats" | "Friends" | "Groups", index: number) => {
    setActiveTab(tab);
    Animated.spring(tabAnim, {
      toValue: index * tabWidth,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  const openChat = (otherId: string) => {
    router.push(`/chat/${otherId}` as any);
  };

  const openProfile = (uid: string) => {
    router.push(`/profile/${uid}` as any);
  };

  const followUser = async (targetId: string) => {
    if (!userId) return;
    await addDoc(collection(db, "users", userId, "following"), { followedAt: serverTimestamp() });
    await addDoc(collection(db, "users", targetId, "followers"), { followedAt: serverTimestamp() });
  };

  const markNotifsRead = async () => {
    notifications
      .filter((n) => !n.read)
      .forEach((n) =>
        updateDoc(doc(db, "users", userId!, "notifications", n.id), { read: true })
      );
  };

  const createGroup = async () => {
    if (!groupName.trim()) return Alert.alert("Name Required", "Give your Group Weave a name.");
    setCreating(true);
    try {
      const ref = await addDoc(collection(db, "groups"), {
        name: groupName.trim(),
        type: groupType,
        privacy: isPrivate ? "private" : "public",
        createdBy: userId,
        members: [userId],
        createdAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
        weaveLevel: 1,
      });
      setModalVisible(false);
      setGroupName("");
      router.push(`/group/${ref.id}` as any);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCreating(false);
    }
  };

  // ── FILTERED DATA ─────────────────────────────────────────────────────────

  const filteredChats = chats.filter((c) => {
    const otherId = c.participants?.find((p: string) => p !== userId);
    const user = chatUserData[otherId];
    if (!searchQuery) return true;
    return (
      user?.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const filteredFriends = friends.filter((f) =>
    !searchQuery || f.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter((g) =>
    !searchQuery || g.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── RENDER HELPERS ────────────────────────────────────────────────────────

  const formatTime = (ts: any) => {
    if (!ts?.toDate) return "";
    const d = ts.toDate();
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const ChatCard = ({ item }: { item: any }) => {
    const otherId = item.participants?.find((p: string) => p !== userId);
    const user = chatUserData[otherId] || {};
    const unread = item.unreadCount?.[userId!] || 0;

    return (
      <TouchableOpacity
        style={styles.chatCard}
        activeOpacity={0.75}
        onPress={() => openChat(otherId)}
      >
        <TouchableOpacity onPress={() => openProfile(otherId)} activeOpacity={0.8}>
          <View style={styles.avatarWrap}>
            {user.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {(user.displayName || "?")[0].toUpperCase()}
                </Text>
              </View>
            )}
            {user.isOnline && <View style={styles.onlineDot} />}
          </View>
        </TouchableOpacity>

        <View style={styles.chatInfo}>
          <View style={styles.chatRow1}>
            <Text style={styles.chatName} numberOfLines={1}>
              {user.displayName || user.username || user.name || "Writha Scholar"}
            </Text>
            <Text style={styles.chatTime}>{formatTime(item.lastMessageAt)}</Text>
          </View>
          <View style={styles.chatRow2}>
            <Text style={styles.chatPreview} numberOfLines={1}>
              {item.lastMessage || "Start a conversation..."}
            </Text>
            {unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const FriendCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.friendCard}
      activeOpacity={0.8}
      onPress={() => openProfile(item.id)}
    >
      <View style={styles.friendAvatarWrap}>
        {item.photoURL ? (
          <Image source={{ uri: item.photoURL }} style={styles.friendAvatar} />
        ) : (
          <View style={[styles.friendAvatar, styles.friendAvatarFallback]}>
            <Text style={styles.friendInitial}>{(item.displayName || "?")[0].toUpperCase()}</Text>
          </View>
        )}
        {item.isOnline && <View style={styles.onlineDotFriend} />}
      </View>
      <Text style={styles.friendName} numberOfLines={1}>
        {item.displayName || item.username || item.name || "Scholar"}
      </Text>
      <Text style={styles.friendHandle} numberOfLines={1}>
        @{item.username || "writha"}
      </Text>
      <TouchableOpacity style={styles.friendChatBtn} onPress={() => openChat(item.id)}>
        <Ionicons name="chatbubble-ellipses" size={16} color="#000" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const GroupCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.groupCard}
      activeOpacity={0.8}
      onPress={() => router.push(`/group/${item.id}` as any)}
    >
      <View style={styles.groupCardTop}>
        <View style={[styles.groupTypeBadge, { borderColor: item.type === "research" ? THEME.purpleBright : THEME.accent }]}>
          <Text style={styles.groupTypeTxt}>{(item.type || "group").toUpperCase()}</Text>
        </View>
        <Ionicons
          name={item.privacy === "private" ? "lock-closed" : "globe-outline"}
          size={13}
          color={THEME.textMuted}
        />
      </View>
      <View style={styles.groupCardMain}>
        <View style={styles.groupIconCircle}>
          <Ionicons name={GROUP_ICONS[item.type as GroupType] || "people-outline"} size={22} color={THEME.accent} />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.groupMeta}>
            <Ionicons name="people-outline" size={11} color={THEME.textMuted} />
            <Text style={styles.groupMetaTxt}>{item.members?.length || 1} scholars</Text>
          </View>
        </View>
        <View style={styles.lvlBadge}>
          <Text style={styles.lvlTxt}>LVL {item.weaveLevel || 1}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const SuggestionCard = ({ item }: { item: any }) => {
    const isFollowing = followingIds.includes(item.id);
    return (
      <TouchableOpacity style={styles.suggestionCard} onPress={() => openProfile(item.id)} activeOpacity={0.8}>
        <View style={styles.suggestionAvatar}>
          {item.photoURL ? (
            <Image source={{ uri: item.photoURL }} style={{ width: "100%", height: "100%", borderRadius: 22 }} />
          ) : (
            <Text style={styles.suggestionInitial}>{(item.displayName || "?")[0].toUpperCase()}</Text>
          )}
        </View>
        <Text style={styles.suggestionName} numberOfLines={1}>{item.displayName || "Scholar"}</Text>
        <Text style={styles.suggestionHandle} numberOfLines={1}>@{item.username || "writha"}</Text>
        <TouchableOpacity
          style={[styles.followBtn, isFollowing && styles.followingBtn]}
          onPress={() => !isFollowing && followUser(item.id)}
        >
          <Text style={[styles.followBtnTxt, isFollowing && { color: THEME.textMuted }]}>
            {isFollowing ? "Following" : "Follow"}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // ── MAIN RENDER ───────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* AMBIENT GLOW */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.glow1} />
        <View style={styles.glow2} />
      </View>

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.brandSmall}>WRITHA</Text>
            <Text style={styles.brandTitle}>SOCIAL</Text>
          </View>
          <View style={styles.headerActions}>
            {/* NOTIFICATIONS */}
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => { setShowNotifs(true); markNotifsRead(); }}
            >
              <Ionicons name="notifications-outline" size={22} color={THEME.accent} />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeTxt}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* CREATE GROUP — clearly labeled */}
            <TouchableOpacity
              style={styles.createGroupBtn}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="people" size={16} color="#000" />
              <Text style={styles.createGroupBtnTxt}>New Group</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SEARCH */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={THEME.textMuted} />
          <TextInput
            placeholder="Search chats, friends, groups..."
            placeholderTextColor={THEME.textMuted}
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color={THEME.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* TABS */}
      <View style={styles.tabsContainer}>
        <View style={styles.tabs}>
          <Animated.View
            style={[styles.tabIndicator, { width: tabWidth, transform: [{ translateX: tabAnim }] }]}
          />
          {(["Chats", "Friends", "Groups"] as const).map((tab, i) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, { width: tabWidth }]}
              onPress={() => switchTab(tab, i)}
            >
              <Ionicons
                name={tab === "Chats" ? "chatbubbles" : tab === "Friends" ? "people" : "library"}
                size={15}
                color={activeTab === tab ? "#000" : THEME.textMuted}
              />
              <Text style={[styles.tabTxt, activeTab === tab && styles.tabTxtActive]}>
                {tab.toUpperCase()}
              </Text>
              {tab === "Chats" && chats.length > 0 && (
                <View style={styles.tabCount}>
                  <Text style={styles.tabCountTxt}>{chats.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* CONTENT */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={THEME.accent} size="large" />
          <Text style={{ color: THEME.textMuted, marginTop: 12 }}>Loading...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

          {/* ── CHATS TAB ── */}
          {activeTab === "Chats" && (
            <View style={styles.section}>
              {filteredChats.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={{ fontSize: 48 }}>💬</Text>
                  <Text style={styles.emptyTitle}>No Chats Yet</Text>
                  <Text style={styles.emptySubtitle}>Follow scholars and start a conversation</Text>
                </View>
              ) : (
                filteredChats.map((item) => <ChatCard key={item.id} item={item} />)
              )}

              {/* PEOPLE YOU MAY KNOW */}
              {suggestions.length > 0 && (
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>PEOPLE YOU MAY KNOW</Text>
                    <Text style={styles.sectionSub}>Based on Writha community</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                    {suggestions
                      .filter((s) => !followingIds.includes(s.id))
                      .map((item) => <SuggestionCard key={item.id} item={item} />)}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* ── FRIENDS TAB ── */}
          {activeTab === "Friends" && (
            <View style={styles.section}>
              {/* Stats banner */}
              <View style={styles.friendsStats}>
                <View style={styles.statPill}>
                  <Text style={styles.statNum}>{followingIds.length}</Text>
                  <Text style={styles.statLbl}>Following</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statPill}>
                  <Text style={styles.statNum}>{followerIds.length}</Text>
                  <Text style={styles.statLbl}>Followers</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statPill}>
                  <Text style={styles.statNum}>{friends.length}</Text>
                  <Text style={styles.statLbl}>Mutual</Text>
                </View>
              </View>

              {/* Mutual friends grid */}
              {filteredFriends.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>MUTUAL FRIENDS</Text>
                  <View style={styles.friendsGrid}>
                    {filteredFriends.map((item) => <FriendCard key={item.id} item={item} />)}
                  </View>
                </>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={{ fontSize: 48 }}>🤝</Text>
                  <Text style={styles.emptyTitle}>No Mutual Friends</Text>
                  <Text style={styles.emptySubtitle}>Follow scholars back to become friends</Text>
                </View>
              )}

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <View style={[styles.sectionBlock, { marginTop: 30 }]}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>DISCOVER SCHOLARS</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                    {suggestions.map((item) => <SuggestionCard key={item.id} item={item} />)}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* ── GROUPS TAB ── */}
          {activeTab === "Groups" && (
            <View style={styles.section}>
              {/* Stats */}
              <View style={styles.groupsStatsBanner}>
                <View style={styles.groupStatBox}>
                  <Text style={styles.groupStatNum}>{groups.length}</Text>
                  <Text style={styles.groupStatLbl}>ACTIVE</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.groupStatBox}>
                  <Text style={styles.groupStatNum}>{groups.filter((g) => g.privacy === "private").length}</Text>
                  <Text style={styles.groupStatLbl}>PRIVATE</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.groupStatBox}>
                  <Text style={styles.groupStatNum}>{groups.reduce((a, g) => a + (g.members?.length || 0), 0)}</Text>
                  <Text style={styles.groupStatLbl}>SCHOLARS</Text>
                </View>
              </View>

              {/* Create CTA if no groups */}
              {groups.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={{ fontSize: 48 }}>📚</Text>
                  <Text style={styles.emptyTitle}>No Group Weaves</Text>
                  <Text style={styles.emptySubtitle}>Create your first reading or discussion group</Text>
                  <TouchableOpacity style={styles.emptyCreateBtn} onPress={() => setModalVisible(true)}>
                    <Ionicons name="add-circle" size={18} color="#000" />
                    <Text style={styles.emptyCreateBtnTxt}>Create Group Weave</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                filteredGroups.map((item) => <GroupCard key={item.id} item={item} />)
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── NOTIFICATIONS MODAL ── */}
      <Modal visible={showNotifs} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>🔔 Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotifs(false)}>
                <Ionicons name="close" size={24} color={THEME.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {notifications.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={{ fontSize: 36 }}>🔕</Text>
                  <Text style={styles.emptySubtitle}>No notifications yet</Text>
                </View>
              ) : (
                notifications.map((n) => (
                  <View key={n.id} style={[styles.notifItem, !n.read && styles.notifUnread]}>
                    <View style={styles.notifDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notifTxt}>{n.message || n.type}</Text>
                      <Text style={styles.notifTime}>{formatTime(n.timestamp)}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── CREATE GROUP MODAL ── */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={[styles.bottomSheet, { maxHeight: height * 0.88 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>New Group Weave</Text>
                <Text style={{ color: THEME.textMuted, fontSize: 12, marginTop: 2 }}>
                  Create a scholarly reading circle
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color={THEME.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>GROUP NAME</Text>
              <TextInput
                placeholder="e.g. Quantum Ethics Discussion"
                placeholderTextColor={THEME.textMuted}
                value={groupName}
                onChangeText={setGroupName}
                style={styles.textInput}
              />

              <Text style={styles.inputLabel}>PRIVACY</Text>
              <View style={styles.privacyRow}>
                {[
                  { label: "Public", icon: "globe-outline", val: false },
                  { label: "Private", icon: "lock-closed-outline", val: true },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.privacyOpt, isPrivate === opt.val && styles.privacyOptActive]}
                    onPress={() => setIsPrivate(opt.val)}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={20}
                      color={isPrivate === opt.val ? "#000" : THEME.textMuted}
                    />
                    <Text style={[styles.privacyOptTxt, isPrivate === opt.val && { color: "#000" }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>GROUP TYPE</Text>
              <View style={styles.typeGrid}>
                {(["reading", "research", "discussion", "study"] as GroupType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeCell, groupType === t && styles.typeCellActive]}
                    onPress={() => setGroupType(t)}
                  >
                    <Ionicons
                      name={GROUP_ICONS[t]}
                      size={26}
                      color={groupType === t ? "#000" : THEME.accent}
                    />
                    <Text style={[styles.typeCellTxt, groupType === t && { color: "#000" }]}>
                      {t.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.createBtn, creating && { opacity: 0.7 }]}
                onPress={createGroup}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Ionicons name="add-circle" size={20} color="#000" />
                    <Text style={styles.createBtnTxt}>CREATE GROUP WEAVE</Text>
                  </>
                )}
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
  centered: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },

  // Ambient
  glow1: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: THEME.purpleBright, opacity: 0.06, top: -80, left: -80 },
  glow2: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: THEME.accent, opacity: 0.04, bottom: 200, right: -60 },

  // Header
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: THEME.ui, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  brandSmall: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 4 },
  brandTitle: { color: THEME.text, fontSize: 28, fontWeight: "900", letterSpacing: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIconBtn: { padding: 8, backgroundColor: THEME.ui2, borderRadius: 12, position: "relative" },
  notifBadge: { position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.red },
  notifBadgeTxt: { color: "#fff", fontSize: 8 },
  createGroupBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: THEME.accent, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14 },
  createGroupBtnTxt: { color: "#000", fontWeight: "900", fontSize: 12 },

  // Search
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui2, borderRadius: 14, paddingHorizontal: 14, height: 42, gap: 10 },
  searchInput: { flex: 1, color: THEME.text, fontSize: 14 },

  // Tabs
  tabsContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  tabs: { flexDirection: "row", backgroundColor: THEME.ui, borderRadius: 16, height: 48, position: "relative", overflow: "hidden" },
  tabIndicator: { position: "absolute", height: "100%", backgroundColor: THEME.accent, borderRadius: 16 },
  tab: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, zIndex: 1 },
  tabTxt: { color: THEME.textMuted, fontWeight: "900", fontSize: 11 },
  tabTxtActive: { color: "#000" },
  tabCount: { backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  tabCountTxt: { color: "#000", fontSize: 9, fontWeight: "900" },

  // Section
  section: { paddingHorizontal: 16, paddingTop: 12 },
  sectionBlock: { marginTop: 20 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 4 },
  sectionSub: { color: THEME.textMuted, fontSize: 10 },

  // Chat cards
  chatCard: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, borderRadius: 20, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: THEME.ui2 },
  avatarWrap: { width: 52, height: 52, borderRadius: 16, position: "relative" },
  avatarImg: { width: 52, height: 52, borderRadius: 16 },
  avatarFallback: { width: 52, height: 52, borderRadius: 16, backgroundColor: THEME.purple, justifyContent: "center", alignItems: "center" },
  avatarInitial: { color: THEME.accent, fontSize: 20, fontWeight: "900" },
  onlineDot: { position: "absolute", bottom: -1, right: -1, width: 13, height: 13, borderRadius: 7, backgroundColor: THEME.online, borderWidth: 2, borderColor: THEME.ui },
  chatInfo: { flex: 1, marginLeft: 12 },
  chatRow1: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chatRow2: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 3 },
  chatName: { color: THEME.text, fontWeight: "800", fontSize: 15, flex: 1 },
  chatTime: { color: THEME.textMuted, fontSize: 11 },
  chatPreview: { color: THEME.textMuted, fontSize: 13, flex: 1 },
  unreadBadge: { backgroundColor: THEME.accent, minWidth: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center", paddingHorizontal: 4 },
  unreadText: { color: "#000", fontSize: 10, fontWeight: "900" },

  // Friends stats
  friendsStats: { flexDirection: "row", backgroundColor: THEME.ui, borderRadius: 20, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: THEME.ui2 },
  statPill: { flex: 1, alignItems: "center" },
  statNum: { color: THEME.accent, fontSize: 22, fontWeight: "900" },
  statLbl: { color: THEME.textMuted, fontSize: 10, fontWeight: "700", marginTop: 2 },
  statDivider: { width: 1, backgroundColor: THEME.ui2, marginVertical: 4 },

  // Friend cards (grid)
  friendsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 },
  friendCard: { width: (width - 56) / 2, backgroundColor: THEME.ui, borderRadius: 20, padding: 16, alignItems: "center", borderWidth: 1, borderColor: THEME.ui2 },
  friendAvatarWrap: { position: "relative", marginBottom: 10 },
  friendAvatar: { width: 60, height: 60, borderRadius: 18 },
  friendAvatarFallback: { backgroundColor: THEME.purple, justifyContent: "center", alignItems: "center" },
  friendInitial: { color: THEME.accent, fontSize: 24, fontWeight: "900" },
  onlineDotFriend: { position: "absolute", bottom: -1, right: -1, width: 13, height: 13, borderRadius: 7, backgroundColor: THEME.online, borderWidth: 2, borderColor: THEME.ui },
  friendName: { color: THEME.text, fontWeight: "800", fontSize: 14, textAlign: "center" },
  friendHandle: { color: THEME.textMuted, fontSize: 11, marginTop: 2, textAlign: "center" },
  friendChatBtn: { backgroundColor: THEME.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 6 },

  // Suggestions
  suggestionCard: { width: 130, backgroundColor: THEME.ui, borderRadius: 20, padding: 14, alignItems: "center", marginRight: 12, borderWidth: 1, borderColor: THEME.ui2 },
  suggestionAvatar: { width: 54, height: 54, borderRadius: 16, backgroundColor: THEME.purple, justifyContent: "center", alignItems: "center", marginBottom: 10, overflow: "hidden" },
  suggestionInitial: { color: THEME.accent, fontSize: 22, fontWeight: "900" },
  suggestionName: { color: THEME.text, fontWeight: "800", fontSize: 13, textAlign: "center" },
  suggestionHandle: { color: THEME.textMuted, fontSize: 10, marginTop: 2, textAlign: "center" },
  followBtn: { backgroundColor: THEME.accent, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 12, marginTop: 10 },
  followingBtn: { backgroundColor: THEME.ui2 },
  followBtnTxt: { color: "#000", fontWeight: "900", fontSize: 11 },

  // Group cards
  groupCard: { backgroundColor: THEME.ui, borderRadius: 22, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: THEME.ui2 },
  groupCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  groupTypeBadge: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  groupTypeTxt: { color: THEME.text, fontSize: 9, fontWeight: "900" },
  groupCardMain: { flexDirection: "row", alignItems: "center" },
  groupIconCircle: { width: 48, height: 48, borderRadius: 14, backgroundColor: THEME.ui2, justifyContent: "center", alignItems: "center" },
  groupName: { color: THEME.text, fontSize: 17, fontWeight: "800" },
  groupMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  groupMetaTxt: { color: THEME.textMuted, fontSize: 11 },
  lvlBadge: { backgroundColor: THEME.purple + "25", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  lvlTxt: { color: THEME.purpleBright, fontSize: 10, fontWeight: "900" },

  // Groups stats
  groupsStatsBanner: { flexDirection: "row", backgroundColor: THEME.ui, borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: THEME.ui2 },
  groupStatBox: { flex: 1, alignItems: "center" },
  groupStatNum: { color: THEME.accent, fontSize: 22, fontWeight: "900" },
  groupStatLbl: { color: THEME.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 2 },

  // Empty states
  emptyState: { alignItems: "center", paddingVertical: 50 },
  emptyTitle: { color: THEME.text, fontSize: 18, fontWeight: "800", marginTop: 12 },
  emptySubtitle: { color: THEME.textMuted, fontSize: 13, marginTop: 6, textAlign: "center" },
  emptyCreateBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: THEME.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 20 },
  emptyCreateBtnTxt: { color: "#000", fontWeight: "900", fontSize: 13 },

  // Bottom sheet / modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  bottomSheet: { backgroundColor: THEME.ui, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderWidth: 1, borderColor: THEME.ui2 },
  sheetHandle: { width: 40, height: 4, backgroundColor: THEME.ui2, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  sheetTitle: { color: THEME.accent, fontSize: 20, fontWeight: "900" },

  // Notifications
  notifItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  notifUnread: { backgroundColor: THEME.accentDim, borderRadius: 12, paddingHorizontal: 10 },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.accent },
  notifTxt: { color: THEME.text, fontSize: 13 },
  notifTime: { color: THEME.textMuted, fontSize: 11, marginTop: 2 },

  // Modal form
  inputLabel: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 10, marginTop: 20 },
  textInput: { backgroundColor: THEME.ui2, borderRadius: 14, padding: 16, color: THEME.text, fontSize: 15, borderWidth: 1, borderColor: "#333" },
  privacyRow: { flexDirection: "row", gap: 12 },
  privacyOpt: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 14, backgroundColor: THEME.ui2, borderWidth: 1, borderColor: "#333" },
  privacyOptActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  privacyOptTxt: { color: THEME.textMuted, fontWeight: "800", fontSize: 13 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4 },
  typeCell: { width: "47%", backgroundColor: THEME.ui2, padding: 18, borderRadius: 16, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#333" },
  typeCellActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  typeCellTxt: { color: THEME.textMuted, fontWeight: "900", fontSize: 10 },
  createBtn: { backgroundColor: THEME.accent, padding: 20, borderRadius: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 30, marginBottom: 10 },
  createBtnTxt: { color: "#000", fontWeight: "900", letterSpacing: 2, fontSize: 14 },
});