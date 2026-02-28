import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  Animated, Dimensions, StatusBar, TextInput, ActivityIndicator,
  Platform, Alert, Modal, ScrollView, KeyboardAvoidingView,
  RefreshControl,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { db, auth } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot, doc, orderBy,
  limit, serverTimestamp, deleteDoc, updateDoc, addDoc,
  getDocs, getDoc, setDoc,
} from "firebase/firestore";

const { width, height } = Dimensions.get("window");

// ── CROSS PLATFORM ALERT ─────────────────────────────────────────────────
const showAlert = (
  title: string,
  message: string,
  buttons: { text: string; style?: string; onPress?: () => void }[]
) => {
  if (Platform.OS === "web") {
    if (buttons.length === 1) {
      window.alert(`${title}\n\n${message}`);
      buttons[0].onPress?.();
    } else {
      const ok = window.confirm(`${title}\n\n${message}`);
      if (ok) buttons.find((b) => b.style !== "cancel")?.onPress?.();
      else    buttons.find((b) => b.style === "cancel")?.onPress?.();
    }
  } else {
    Alert.alert(title, message, buttons as any);
  }
};

type GroupType = "reading" | "research" | "discussion" | "study";
type TabType   = "Chats" | "Friends" | "Groups";

const THEME = {
  bg:           "#0F071A",
  ui:           "#1E1135",
  ui2:          "#2D1B4D",
  ui3:          "#3D2660",
  accent:       "#FFD700",
  accentDim:    "rgba(255,215,0,0.12)",
  purple:       "#6D28D9",
  purpleBright: "#8E2DE2",
  purpleLight:  "#A78BFA",
  text:         "#E2E8F0",
  textMuted:    "#94A3B8",
  online:       "#22C55E",
  red:          "#EF4444",
  blue:         "#38BDF8",
  border:       "#2D1B4D",
};

const GROUP_ICONS: Record<GroupType, any> = {
  research:   "flask-outline",
  reading:    "book-outline",
  study:      "school-outline",
  discussion: "chatbubbles-outline",
};

const NOTIF_ICONS: Record<string, { icon: string; color: string }> = {
  like:          { icon: "heart",            color: THEME.red          },
  comment:       { icon: "chatbubble",       color: THEME.blue         },
  follow:        { icon: "person-add",       color: THEME.purple       },
  purchase:      { icon: "cart",             color: THEME.online       },
  review:        { icon: "shield-checkmark", color: THEME.accent       },
  mention:       { icon: "at-circle",        color: THEME.purpleLight  },
  weave:         { icon: "feather",          color: "#F59E0B"          },
  book_approved: { icon: "checkmark-circle", color: THEME.online       },
  book_rejected: { icon: "close-circle",     color: THEME.red          },
  default:       { icon: "notifications",    color: THEME.textMuted    },
};

const formatTime = (ts: any): string => {
  if (!ts) return "";
  const d    = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)     return "just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

// ── AVATAR HELPER ─────────────────────────────────────────────────────────
const Avatar = ({
  uri, name, size = 48, radius = 15,
}: { uri?: string; name?: string; size?: number; radius?: number }) => {
  const fallbackUri = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "W")}&background=2D1B4D&color=FFD700&bold=true&size=128`;
  return (
    <Image
      source={{ uri: uri || fallbackUri }}
      style={{ width: size, height: size, borderRadius: radius }}
    />
  );
};

export default function SocialScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const userId  = auth.currentUser?.uid;

  const [activeTab,     setActiveTab]     = useState<TabType>("Chats");
  const [searchQuery,   setSearchQuery]   = useState("");
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);

  // Data
  const [chats,         setChats]         = useState<any[]>([]);
  const [friends,       setFriends]       = useState<any[]>([]);
  const [groups,        setGroups]        = useState<any[]>([]);
  const [publicGroups,  setPublicGroups]  = useState<any[]>([]);
  const [suggestions,   setSuggestions]   = useState<any[]>([]);
  const [followingIds,  setFollowingIds]  = useState<string[]>([]);
  const [followerIds,   setFollowerIds]   = useState<string[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [chatUserData,  setChatUserData]  = useState<Record<string, any>>({});
  const [userSearch,    setUserSearch]    = useState<any[]>([]);
  const [searching,     setSearching]     = useState(false);

  // Modals
  const [showNotifs,    setShowNotifs]    = useState(false);
  const [modalVisible,  setModalVisible]  = useState(false);

  // Group creation
  const [groupName,     setGroupName]     = useState("");
  const [groupType,     setGroupType]     = useState<GroupType>("reading");
  const [isPrivate,     setIsPrivate]     = useState(true);
  const [creating,      setCreating]      = useState(false);

  const tabAnim  = useRef(new Animated.Value(0)).current;
  const tabWidth = (width - 48) / 3;

  // ── LISTENERS ────────────────────────────────────────────────────
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
      setRefreshing(false);

      const userData: Record<string, any> = {};
      await Promise.all(
        chatList.map(async (chat: any) => {
          const otherId = chat.participants?.find((p: string) => p !== userId);
          if (otherId && !chatUserData[otherId]) {
            const snap = await getDoc(doc(db, "users", otherId));
            if (snap.exists()) userData[otherId] = { id: otherId, ...snap.data() };
          }
        })
      );
      setChatUserData((prev) => ({ ...prev, ...userData }));
    }, () => { setLoading(false); setRefreshing(false); });

    // Groups I'm in
    const qGroups = query(
      collection(db, "groups"),
      where("members", "array-contains", userId)
    );
    const unsubGroups = onSnapshot(qGroups, (snap) => {
      setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // Public groups for discovery
    const qPublic = query(
      collection(db, "groups"),
      where("privacy", "==", "public"),
      limit(10)
    );
    const unsubPublic = onSnapshot(qPublic, (snap) => {
      setPublicGroups(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((g: any) => !g.members?.includes(userId))
      );
    });

    // Following
    const unsubFollowing = onSnapshot(
      collection(db, "users", userId, "following"),
      (snap) => setFollowingIds(snap.docs.map((d) => d.id))
    );

    // Followers
    const unsubFollowers = onSnapshot(
      collection(db, "users", userId, "followers"),
      (snap) => setFollowerIds(snap.docs.map((d) => d.id))
    );

    // Notifications — use createdAt consistently
    const qNotifs = query(
      collection(db, "users", userId, "notifications"),
      orderBy("createdAt", "desc"),
      limit(30)
    );
    const unsubNotifs = onSnapshot(qNotifs, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setNotifications(data);
      setUnreadCount(data.filter((n: any) => !n.read).length);
    });

    // Suggestions
    fetchSuggestions();

    return () => {
      unsubChats();
      unsubGroups();
      unsubPublic();
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

    const seen = new Set<string>();
    const unsubs = mutualIds.map((id) =>
      onSnapshot(doc(db, "users", id), (snap) => {
        if (!snap.exists() || seen.has(id)) return;
        seen.add(id);
        setFriends((prev) => [
          ...prev.filter((p) => p.id !== id),
          { id, ...snap.data() },
        ]);
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [followingIds, followerIds]);

  const fetchSuggestions = async () => {
    try {
      const snap = await getDocs(query(collection(db, "users"), limit(30)));
      const all = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u: any) => u.id !== userId);
      setSuggestions(all.slice(0, 15));
    } catch (e) { console.error(e); }
  };

  // ── USER SEARCH ──────────────────────────────────────────────────
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setUserSearch([]);
      return;
    }
    if (activeTab !== "Friends") return;

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const snap = await getDocs(query(collection(db, "users"), limit(50)));
        const q    = searchQuery.toLowerCase();
        const results = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u: any) =>
            u.id !== userId &&
            (u.displayName?.toLowerCase().includes(q) ||
             u.username?.toLowerCase().includes(q))
          );
        setUserSearch(results);
      } catch (e) { console.error(e); } finally { setSearching(false); }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  // ── TAB SWITCH ───────────────────────────────────────────────────
  const switchTab = (tab: TabType, index: number) => {
    setActiveTab(tab);
    setSearchQuery("");
    Animated.spring(tabAnim, {
      toValue:  index * tabWidth,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  // ── FOLLOW / UNFOLLOW ────────────────────────────────────────────
  const followUser = async (targetId: string) => {
    if (!userId) return;
    try {
      await setDoc(doc(db, "users", userId, "following", targetId), {
        followedAt: serverTimestamp(),
      });
      await setDoc(doc(db, "users", targetId, "followers", userId), {
        followedAt: serverTimestamp(),
      });
      // Send follow notification
      await addDoc(collection(db, "users", targetId, "notifications"), {
        type:       "follow",
        message:    "Someone started following you",
        fromUserId: userId,
        read:       false,
        createdAt:  serverTimestamp(),
      });
    } catch (e) { console.error(e); }
  };

  const unfollowUser = async (targetId: string) => {
    if (!userId) return;
    try {
      await deleteDoc(doc(db, "users", userId, "following", targetId));
      await deleteDoc(doc(db, "users", targetId, "followers", userId));
    } catch (e) { console.error(e); }
  };

  // ── JOIN GROUP ───────────────────────────────────────────────────
  const joinGroup = async (groupId: string) => {
    if (!userId) return;
    try {
      await updateDoc(doc(db, "groups", groupId), {
        members: [...(groups.find((g) => g.id === groupId)?.members || []), userId],
      });
    } catch (e) { console.error(e); }
  };

  // ── MARK NOTIFICATIONS READ ──────────────────────────────────────
  const markNotifsRead = useCallback(async () => {
    if (!userId) return;
    try {
      const unread = notifications.filter((n) => !n.read);
      await Promise.all(
        unread.map((n) =>
          updateDoc(doc(db, "users", userId, "notifications", n.id), { read: true })
        )
      );
      await updateDoc(doc(db, "users", userId), { hasUnread: false });
    } catch (e) { console.error(e); }
  }, [userId, notifications]);

  // ── CREATE GROUP ─────────────────────────────────────────────────
  const createGroup = async () => {
    if (!groupName.trim()) {
      showAlert("Name Required", "Give your Group Weave a name.", [{ text: "OK" }]);
      return;
    }
    setCreating(true);
    try {
      const ref = await addDoc(collection(db, "groups"), {
        name:         groupName.trim(),
        type:         groupType,
        privacy:      isPrivate ? "private" : "public",
        createdBy:    userId,
        members:      [userId],
        createdAt:    serverTimestamp(),
        lastActivity: serverTimestamp(),
        weaveLevel:   1,
      });
      setModalVisible(false);
      setGroupName("");
      router.push(`/group/${ref.id}` as any);
    } catch (e: any) {
      showAlert("Error", e.message, [{ text: "OK" }]);
    } finally {
      setCreating(false);
    }
  };

  // ── REFRESH ──────────────────────────────────────────────────────
  const onRefresh = () => {
    setRefreshing(true);
    fetchSuggestions();
  };

  // ── FILTERED DATA ────────────────────────────────────────────────
  const filteredChats = chats.filter((c) => {
    if (!searchQuery) return true;
    const otherId = c.participants?.find((p: string) => p !== userId);
    const user    = chatUserData[otherId];
    return (
      user?.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const filteredFriends = friends.filter((f) =>
    !searchQuery ||
    f.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter((g) =>
    !searchQuery || g.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayFriends = searchQuery.length >= 2 && activeTab === "Friends"
    ? userSearch
    : filteredFriends;

  // ── FOLLOW CATEGORIES ────────────────────────────────────────────
  const notMutual       = followingIds.filter((id) => !followerIds.includes(id));
  const followsYouBack  = followerIds.filter((id) => !followingIds.includes(id));

  // ── RENDER: CHAT CARD ────────────────────────────────────────────
  const renderChatCard = ({ item }: { item: any }) => {
    const otherId = item.participants?.find((p: string) => p !== userId);
    const user    = chatUserData[otherId] || {};
    const unread  = item.unreadCount?.[userId!] || 0;

    return (
      <TouchableOpacity
        style={s.chatCard}
        activeOpacity={0.75}
        onPress={() => router.push(`/chat/${otherId}` as any)}
      >
        <TouchableOpacity
          onPress={() => router.push(`/profile/${otherId}` as any)}
          activeOpacity={0.8}
        >
          <View style={s.avatarWrap}>
            <Avatar uri={user.photoURL} name={user.displayName} size={52} radius={16} />
            {user.isOnline && <View style={s.onlineDot} />}
          </View>
        </TouchableOpacity>

        <View style={s.chatInfo}>
          <View style={s.chatRow1}>
            <Text style={s.chatName} numberOfLines={1}>
              {user.displayName || user.username || "Writha Scholar"}
            </Text>
            <Text style={s.chatTime}>{formatTime(item.lastMessageAt)}</Text>
          </View>
          <View style={s.chatRow2}>
            <Text style={s.chatPreview} numberOfLines={1}>
              {item.lastMessage || "Start a conversation..."}
            </Text>
            {unread > 0 && (
              <View style={s.unreadBadge}>
                <Text style={s.unreadText}>{unread > 9 ? "9+" : unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── RENDER: PERSON CARD (friends + search results) ───────────────
  const renderPersonCard = (item: any, compact = false) => {
    const isFollowing  = followingIds.includes(item.id);
    const followsMe    = followerIds.includes(item.id);
    const isMutual     = isFollowing && followsMe;

    return (
      <TouchableOpacity
        key={item.id}
        style={compact ? s.suggestionCard : s.friendCard}
        activeOpacity={0.8}
        onPress={() => router.push(`/profile/${item.id}` as any)}
      >
        {/* Avatar */}
        <View style={{ position: "relative", marginBottom: 10 }}>
          <Avatar
            uri={item.photoURL}
            name={item.displayName}
            size={compact ? 54 : 62}
            radius={compact ? 16 : 18}
          />
          {item.isOnline && (
            <View style={[s.onlineDotFriend, { borderColor: THEME.ui }]} />
          )}
        </View>

        <Text style={s.friendName} numberOfLines={1}>
          {item.displayName || "Scholar"}
        </Text>
        <Text style={s.friendHandle} numberOfLines={1}>
          @{item.username || "writha"}
        </Text>

        {/* Bio if available */}
        {!compact && item.bio ? (
          <Text style={s.friendBio} numberOfLines={2}>{item.bio}</Text>
        ) : null}

        {/* Stats row */}
        {!compact && (
          <View style={s.friendStats}>
            {item.weaveCount > 0 && (
              <View style={s.friendStat}>
                <MaterialCommunityIcons name="feather" size={10} color={THEME.accent} />
                <Text style={s.friendStatTxt}>{item.weaveCount} weaves</Text>
              </View>
            )}
            {isMutual && (
              <View style={[s.mutualBadge]}>
                <Ionicons name="people" size={10} color={THEME.online} />
                <Text style={[s.mutualBadgeTxt, { color: THEME.online }]}>Mutual</Text>
              </View>
            )}
          </View>
        )}

        {/* Relationship badge */}
        {!isMutual && followsMe && !isFollowing && (
          <View style={s.followsYouBadge}>
            <Text style={s.followsYouTxt}>Follows you</Text>
          </View>
        )}

        {/* Follow / Unfollow */}
        <View style={s.friendActions}>
          <TouchableOpacity
            style={[
              s.followBtn,
              isFollowing ? s.unfollowBtn : s.followBtnActive,
            ]}
            onPress={() => isFollowing ? unfollowUser(item.id) : followUser(item.id)}
          >
            <Text style={[
              s.followBtnTxt,
              isFollowing && { color: THEME.textMuted },
            ]}>
              {isFollowing ? "Unfollow" : followsMe ? "Follow Back" : "Follow"}
            </Text>
          </TouchableOpacity>

          {isMutual && (
            <TouchableOpacity
              style={s.chatIconBtn}
              onPress={() => router.push(`/chat/${item.id}` as any)}
            >
              <Ionicons name="chatbubble-ellipses" size={15} color="#000" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ── RENDER: GROUP CARD ───────────────────────────────────────────
  const renderGroupCard = (item: any, isPublic = false) => (
    <TouchableOpacity
      key={item.id}
      style={s.groupCard}
      activeOpacity={0.8}
      onPress={() => {
        if (isPublic && !item.members?.includes(userId)) {
          showAlert(
            "Join Group",
            `Join "${item.name}"?`,
            [
              { text: "Cancel", style: "cancel" },
              { text: "Join", onPress: () => joinGroup(item.id) },
            ]
          );
        } else {
          router.push(`/group/${item.id}` as any);
        }
      }}
    >
      <View style={s.groupCardTop}>
        <View style={[s.groupTypeBadge, {
          borderColor: item.type === "research" ? THEME.purpleBright : THEME.accent + "60",
        }]}>
          <Ionicons
            name={GROUP_ICONS[item.type as GroupType] || "people-outline"}
            size={10}
            color={item.type === "research" ? THEME.purpleBright : THEME.accent}
          />
          <Text style={[s.groupTypeTxt, {
            color: item.type === "research" ? THEME.purpleBright : THEME.accent,
          }]}>
            {(item.type || "GROUP").toUpperCase()}
          </Text>
        </View>
        <View style={s.groupCardRight}>
          {isPublic && (
            <View style={s.publicBadge}>
              <Ionicons name="globe-outline" size={10} color={THEME.blue} />
              <Text style={[s.publicBadgeTxt, { color: THEME.blue }]}>Public</Text>
            </View>
          )}
          <Ionicons
            name={item.privacy === "private" ? "lock-closed" : "globe-outline"}
            size={13}
            color={THEME.textMuted}
          />
        </View>
      </View>

      <View style={s.groupCardMain}>
        <View style={[s.groupIconCircle, {
          backgroundColor: item.type === "research"
            ? THEME.purpleBright + "20"
            : THEME.accentDim,
        }]}>
          <Ionicons
            name={GROUP_ICONS[item.type as GroupType] || "people-outline"}
            size={22}
            color={item.type === "research" ? THEME.purpleBright : THEME.accent}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={s.groupName} numberOfLines={1}>{item.name}</Text>
          <View style={s.groupMeta}>
            <Ionicons name="people-outline" size={11} color={THEME.textMuted} />
            <Text style={s.groupMetaTxt}>{item.members?.length || 1} scholars</Text>
            {item.bookTitle && (
              <>
                <Text style={{ color: THEME.textMuted, fontSize: 10 }}>·</Text>
                <Ionicons name="book-outline" size={10} color={THEME.textMuted} />
                <Text style={s.groupMetaTxt} numberOfLines={1}>{item.bookTitle}</Text>
              </>
            )}
          </View>
        </View>
        {isPublic ? (
          <View style={[s.joinBtn, { backgroundColor: THEME.accent }]}>
            <Text style={s.joinBtnTxt}>JOIN</Text>
          </View>
        ) : (
          <View style={s.lvlBadge}>
            <Text style={s.lvlTxt}>LVL {item.weaveLevel || 1}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* AMBIENT GLOW */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={s.glow1} />
        <View style={s.glow2} />
      </View>

      {/* HEADER */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.brandSmall}>WRITHA</Text>
            <Text style={s.brandTitle}>SOCIAL</Text>
          </View>
          <View style={s.headerActions}>
            <TouchableOpacity
              style={s.headerIconBtn}
              onPress={() => {
                setShowNotifs(true);
                markNotifsRead();
              }}
            >
              <Ionicons name="notifications-outline" size={22} color={THEME.accent} />
              {unreadCount > 0 && (
                <View style={s.notifBadge}>
                  <Text style={s.notifBadgeTxt}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={s.createGroupBtn}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="people" size={16} color="#000" />
              <Text style={s.createGroupBtnTxt}>New Group</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SEARCH */}
        <View style={s.searchBar}>
          <Ionicons name="search" size={16} color={THEME.textMuted} />
          <TextInput
            placeholder={
              activeTab === "Chats"   ? "Search chats..."        :
              activeTab === "Friends" ? "Search any user by name or handle..." :
                                       "Search groups..."
            }
            placeholderTextColor={THEME.textMuted}
            style={s.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color={THEME.textMuted} />
            </TouchableOpacity>
          )}
          {searching && <ActivityIndicator size="small" color={THEME.accent} />}
        </View>
      </View>

      {/* TABS */}
      <View style={s.tabsContainer}>
        <View style={s.tabs}>
          <Animated.View style={[s.tabIndicator, {
            width: tabWidth,
            transform: [{ translateX: tabAnim }],
          }]} />
          {(["Chats", "Friends", "Groups"] as const).map((tab, i) => (
            <TouchableOpacity
              key={tab}
              style={[s.tab, { width: tabWidth }]}
              onPress={() => switchTab(tab, i)}
            >
              <Ionicons
                name={
                  tab === "Chats"   ? "chatbubbles" :
                  tab === "Friends" ? "people"       : "library"
                }
                size={15}
                color={activeTab === tab ? "#000" : THEME.textMuted}
              />
              <Text style={[s.tabTxt, activeTab === tab && s.tabTxtActive]}>
                {tab.toUpperCase()}
              </Text>
              {tab === "Chats" && chats.length > 0 && (
                <View style={s.tabCount}>
                  <Text style={s.tabCountTxt}>{chats.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* CONTENT */}
      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color={THEME.accent} size="large" />
          <Text style={{ color: THEME.textMuted, marginTop: 12 }}>Loading...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={THEME.accent}
            />
          }
        >

          {/* ── CHATS TAB ── */}
          {activeTab === "Chats" && (
            <View style={s.section}>
              {filteredChats.length === 0 && searchQuery.length === 0 ? (
                <View style={s.emptyState}>
                  <Text style={{ fontSize: 48 }}>💬</Text>
                  <Text style={s.emptyTitle}>No Chats Yet</Text>
                  <Text style={s.emptySubtitle}>
                    Go to a friend's profile and tap Message to start a conversation
                  </Text>
                </View>
              ) : filteredChats.length === 0 && searchQuery.length > 0 ? (
                <View style={s.emptyState}>
                  <Text style={{ fontSize: 36 }}>🔍</Text>
                  <Text style={s.emptySubtitle}>No chats match "{searchQuery}"</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredChats}
                  keyExtractor={(item) => item.id}
                  renderItem={renderChatCard}
                  scrollEnabled={false}
                />
              )}

              {/* People you may know */}
              {suggestions.filter((s) => !followingIds.includes(s.id)).length > 0 && (
                <View style={s.sectionBlock}>
                  <View style={s.sectionHeaderRow}>
                    <Text style={s.sectionTitle}>PEOPLE YOU MAY KNOW</Text>
                    <Text style={s.sectionSub}>Writha community</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: 12 }}
                  >
                    <View style={{ flexDirection: "row", gap: 12, paddingBottom: 4 }}>
                      {suggestions
                        .filter((s) => !followingIds.includes(s.id))
                        .slice(0, 8)
                        .map((item) => renderPersonCard(item, true))}
                    </View>
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* ── FRIENDS TAB ── */}
          {activeTab === "Friends" && (
            <View style={s.section}>

              {/* Stats banner */}
              <View style={s.friendsStats}>
                <TouchableOpacity style={s.statPill}>
                  <Text style={s.statNum}>{followingIds.length}</Text>
                  <Text style={s.statLbl}>Following</Text>
                </TouchableOpacity>
                <View style={s.statDivider} />
                <TouchableOpacity style={s.statPill}>
                  <Text style={s.statNum}>{followerIds.length}</Text>
                  <Text style={s.statLbl}>Followers</Text>
                </TouchableOpacity>
                <View style={s.statDivider} />
                <TouchableOpacity style={s.statPill}>
                  <Text style={s.statNum}>{friends.length}</Text>
                  <Text style={s.statLbl}>Mutual</Text>
                </TouchableOpacity>
              </View>

              {/* Search results */}
              {searchQuery.length >= 2 && (
                <>
                  <Text style={s.sectionTitle}>
                    SEARCH RESULTS {userSearch.length > 0 ? `(${userSearch.length})` : ""}
                  </Text>
                  {searching ? (
                    <ActivityIndicator color={THEME.accent} style={{ marginTop: 20 }} />
                  ) : userSearch.length === 0 ? (
                    <View style={s.emptyState}>
                      <Text style={{ fontSize: 36 }}>🔍</Text>
                      <Text style={s.emptySubtitle}>No users found for "{searchQuery}"</Text>
                    </View>
                  ) : (
                    <View style={s.friendsGrid}>
                      {userSearch.map((item) => renderPersonCard(item))}
                    </View>
                  )}
                </>
              )}

              {/* Mutual friends */}
              {searchQuery.length < 2 && (
                <>
                  {friends.length > 0 ? (
                    <>
                      <Text style={s.sectionTitle}>MUTUAL FRIENDS</Text>
                      <View style={s.friendsGrid}>
                        {friends.map((item) => renderPersonCard(item))}
                      </View>
                    </>
                  ) : (
                    <View style={s.emptyState}>
                      <Text style={{ fontSize: 48 }}>🤝</Text>
                      <Text style={s.emptyTitle}>No Mutual Friends Yet</Text>
                      <Text style={s.emptySubtitle}>
                        Search for scholars above or explore suggestions below
                      </Text>
                    </View>
                  )}

                  {/* Following but they don't follow back */}
                  {notMutual.length > 0 && (
                    <View style={[s.sectionBlock, { marginTop: 24 }]}>
                      <Text style={s.sectionTitle}>
                        YOU FOLLOW · NOT FOLLOWING BACK ({notMutual.length})
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ marginTop: 12 }}
                      >
                        <View style={{ flexDirection: "row", gap: 12 }}>
                          {suggestions
                            .filter((s) => notMutual.includes(s.id))
                            .map((item) => renderPersonCard(item, true))}
                        </View>
                      </ScrollView>
                    </View>
                  )}

                  {/* They follow you but you don't follow back */}
                  {followsYouBack.length > 0 && (
                    <View style={[s.sectionBlock, { marginTop: 24 }]}>
                      <Text style={s.sectionTitle}>
                        FOLLOWS YOU · FOLLOW BACK ({followsYouBack.length})
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ marginTop: 12 }}
                      >
                        <View style={{ flexDirection: "row", gap: 12 }}>
                          {suggestions
                            .filter((s) => followsYouBack.includes(s.id))
                            .map((item) => renderPersonCard(item, true))}
                        </View>
                      </ScrollView>
                    </View>
                  )}

                  {/* Discover */}
                  <View style={[s.sectionBlock, { marginTop: 24 }]}>
                    <Text style={s.sectionTitle}>DISCOVER SCHOLARS</Text>
                    <View style={s.friendsGrid}>
                      {suggestions
                        .filter((s) => !followingIds.includes(s.id) && !followerIds.includes(s.id))
                        .slice(0, 6)
                        .map((item) => renderPersonCard(item))}
                    </View>
                  </View>
                </>
              )}
            </View>
          )}

          {/* ── GROUPS TAB ── */}
          {activeTab === "Groups" && (
            <View style={s.section}>

              {/* Stats */}
              <View style={s.groupsStatsBanner}>
                <View style={s.groupStatBox}>
                  <Text style={s.groupStatNum}>{groups.length}</Text>
                  <Text style={s.groupStatLbl}>MY GROUPS</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.groupStatBox}>
                  <Text style={s.groupStatNum}>
                    {groups.filter((g) => g.privacy === "private").length}
                  </Text>
                  <Text style={s.groupStatLbl}>PRIVATE</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.groupStatBox}>
                  <Text style={s.groupStatNum}>
                    {groups.reduce((a, g) => a + (g.members?.length || 0), 0)}
                  </Text>
                  <Text style={s.groupStatLbl}>SCHOLARS</Text>
                </View>
              </View>

              {/* My groups */}
              {filteredGroups.length === 0 && searchQuery.length === 0 ? (
                <View style={s.emptyState}>
                  <Text style={{ fontSize: 48 }}>📚</Text>
                  <Text style={s.emptyTitle}>No Group Weaves</Text>
                  <Text style={s.emptySubtitle}>
                    Create your first reading or discussion group
                  </Text>
                  <TouchableOpacity
                    style={s.emptyCreateBtn}
                    onPress={() => setModalVisible(true)}
                  >
                    <Ionicons name="add-circle" size={18} color="#000" />
                    <Text style={s.emptyCreateBtnTxt}>Create Group Weave</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={s.sectionTitle}>MY GROUPS</Text>
                  {filteredGroups.map((item) => renderGroupCard(item))}
                </>
              )}

              {/* Discover public groups */}
              {publicGroups.length > 0 && searchQuery.length === 0 && (
                <View style={[s.sectionBlock, { marginTop: 24 }]}>
                  <View style={s.sectionHeaderRow}>
                    <Text style={s.sectionTitle}>DISCOVER PUBLIC GROUPS</Text>
                  </View>
                  <View style={{ marginTop: 12 }}>
                    {publicGroups.map((item) => renderGroupCard(item, true))}
                  </View>
                </View>
              )}

              {/* Create group CTA */}
              <TouchableOpacity
                style={s.createGroupCTA}
                onPress={() => setModalVisible(true)}
              >
                <LinearGradient
                  colors={["#2D1B4D", "#1A0E30"]}
                  style={s.createGroupCTAGradient}
                >
                  <Ionicons name="add-circle-outline" size={24} color={THEME.accent} />
                  <View>
                    <Text style={s.createGroupCTATitle}>Start a Group Weave</Text>
                    <Text style={s.createGroupCTASub}>
                      Bring scholars together around a book or topic
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── NOTIFICATIONS MODAL ── */}
      <Modal visible={showNotifs} animationType="slide" presentationStyle="pageSheet">
        <View style={s.notifModal}>
          <View style={s.notifHeader}>
            <Text style={s.notifTitle}>Notifications</Text>
            <TouchableOpacity
              onPress={() => setShowNotifs(false)}
              style={s.notifCloseBtn}
            >
              <Ionicons name="close" size={22} color={THEME.text} />
            </TouchableOpacity>
          </View>

          {notifications.length === 0 ? (
            <View style={s.notifEmpty}>
              <Ionicons name="notifications-off-outline" size={48} color={THEME.textMuted} />
              <Text style={s.notifEmptyTxt}>No notifications yet</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {notifications.map((notif) => {
                const cfg = NOTIF_ICONS[notif.type] || NOTIF_ICONS.default;
                return (
                  <View
                    key={notif.id}
                    style={[s.notifItem, !notif.read && s.notifItemUnread]}
                  >
                    <View style={[s.notifIconCircle, { backgroundColor: cfg.color + "20" }]}>
                      <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
                    </View>
                    <View style={s.notifContent}>
                      <Text style={s.notifItemTxt}>
                        {notif.message || notif.body || notif.type}
                      </Text>
                      <Text style={s.notifItemTime}>
                        {formatTime(notif.createdAt)}
                      </Text>
                    </View>
                    {!notif.read && <View style={s.unreadDot} />}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* ── CREATE GROUP MODAL ── */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={s.modalOverlay}
        >
          <View style={[s.bottomSheet, { maxHeight: height * 0.88 }]}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>New Group Weave</Text>
                <Text style={{ color: THEME.textMuted, fontSize: 12, marginTop: 2 }}>
                  Create a scholarly reading circle
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color={THEME.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.inputLabel}>GROUP NAME</Text>
              <TextInput
                placeholder="e.g. Quantum Ethics Discussion"
                placeholderTextColor={THEME.textMuted}
                value={groupName}
                onChangeText={setGroupName}
                style={s.textInput}
              />

              <Text style={s.inputLabel}>PRIVACY</Text>
              <View style={s.privacyRow}>
                {[
                  { label: "Public",  icon: "globe-outline",      val: false },
                  { label: "Private", icon: "lock-closed-outline", val: true  },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.label}
                    style={[s.privacyOpt, isPrivate === opt.val && s.privacyOptActive]}
                    onPress={() => setIsPrivate(opt.val)}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={20}
                      color={isPrivate === opt.val ? "#000" : THEME.textMuted}
                    />
                    <Text style={[
                      s.privacyOptTxt,
                      isPrivate === opt.val && { color: "#000" },
                    ]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.inputLabel}>GROUP TYPE</Text>
              <View style={s.typeGrid}>
                {(["reading", "research", "discussion", "study"] as GroupType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[s.typeCell, groupType === t && s.typeCellActive]}
                    onPress={() => setGroupType(t)}
                  >
                    <Ionicons
                      name={GROUP_ICONS[t]}
                      size={26}
                      color={groupType === t ? "#000" : THEME.accent}
                    />
                    <Text style={[s.typeCellTxt, groupType === t && { color: "#000" }]}>
                      {t.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[s.createBtn, creating && { opacity: 0.7 }]}
                onPress={createGroup}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Ionicons name="add-circle" size={20} color="#000" />
                    <Text style={s.createBtnTxt}>CREATE GROUP WEAVE</Text>
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

const s = StyleSheet.create({
  container:           { flex: 1, backgroundColor: THEME.bg },
  centered:            { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
  glow1:               { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: THEME.purpleBright, opacity: 0.06, top: -80, left: -80 },
  glow2:               { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: THEME.accent, opacity: 0.04, bottom: 200, right: -60 },

  // Header
  header:              { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: THEME.ui, borderBottomWidth: 1, borderBottomColor: THEME.border },
  headerTop:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  brandSmall:          { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 4 },
  brandTitle:          { color: THEME.text, fontSize: 28, fontWeight: "900", letterSpacing: 2 },
  headerActions:       { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIconBtn:       { padding: 8, backgroundColor: THEME.ui2, borderRadius: 12, position: "relative" },
  notifBadge:          { position: "absolute", top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: THEME.red, justifyContent: "center", alignItems: "center", paddingHorizontal: 3 },
  notifBadgeTxt:       { color: "#fff", fontSize: 8, fontWeight: "900" },
  createGroupBtn:      { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: THEME.accent, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14 },
  createGroupBtnTxt:   { color: "#000", fontWeight: "900", fontSize: 12 },
  searchBar:           { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui2, borderRadius: 14, paddingHorizontal: 14, height: 44, gap: 10, borderWidth: 1, borderColor: THEME.border },
  searchInput:         { flex: 1, color: THEME.text, fontSize: 14 },

  // Tabs
  tabsContainer:       { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  tabs:                { flexDirection: "row", backgroundColor: THEME.ui, borderRadius: 16, height: 48, position: "relative", overflow: "hidden" },
  tabIndicator:        { position: "absolute", height: "100%", backgroundColor: THEME.accent, borderRadius: 16 },
  tab:                 { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, zIndex: 1 },
  tabTxt:              { color: THEME.textMuted, fontWeight: "900", fontSize: 11 },
  tabTxtActive:        { color: "#000" },
  tabCount:            { backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  tabCountTxt:         { color: "#000", fontSize: 9, fontWeight: "900" },

  // Section
  section:             { paddingHorizontal: 16, paddingTop: 12 },
  sectionBlock:        {},
  sectionHeaderRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle:        { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 12 },
  sectionSub:          { color: THEME.textMuted, fontSize: 10 },

  // Chat cards
  chatCard:            { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, borderRadius: 20, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: THEME.border },
  avatarWrap:          { position: "relative" },
  onlineDot:           { position: "absolute", bottom: -1, right: -1, width: 13, height: 13, borderRadius: 7, backgroundColor: THEME.online, borderWidth: 2, borderColor: THEME.ui },
  chatInfo:            { flex: 1, marginLeft: 12 },
  chatRow1:            { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chatRow2:            { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 3 },
  chatName:            { color: THEME.text, fontWeight: "800", fontSize: 15, flex: 1 },
  chatTime:            { color: THEME.textMuted, fontSize: 11 },
  chatPreview:         { color: THEME.textMuted, fontSize: 13, flex: 1 },
  unreadBadge:         { backgroundColor: THEME.accent, minWidth: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center", paddingHorizontal: 4 },
  unreadText:          { color: "#000", fontSize: 10, fontWeight: "900" },

  // Friends
  friendsStats:        { flexDirection: "row", backgroundColor: THEME.ui, borderRadius: 20, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: THEME.border },
  statPill:            { flex: 1, alignItems: "center" },
  statNum:             { color: THEME.accent, fontSize: 22, fontWeight: "900" },
  statLbl:             { color: THEME.textMuted, fontSize: 10, fontWeight: "700", marginTop: 2 },
  statDivider:         { width: 1, backgroundColor: THEME.border, marginVertical: 4 },
  friendsGrid:         { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 },
  friendCard:          { width: (width - 56) / 2, backgroundColor: THEME.ui, borderRadius: 20, padding: 16, alignItems: "center", borderWidth: 1, borderColor: THEME.border },
  onlineDotFriend:     { position: "absolute", bottom: -1, right: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: THEME.online, borderWidth: 2 },
  friendName:          { color: THEME.text, fontWeight: "800", fontSize: 14, textAlign: "center" },
  friendHandle:        { color: THEME.textMuted, fontSize: 11, marginTop: 2, textAlign: "center" },
  friendBio:           { color: THEME.textMuted, fontSize: 11, marginTop: 6, textAlign: "center", lineHeight: 16 },
  friendStats:         { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap", justifyContent: "center" },
  friendStat:          { flexDirection: "row", alignItems: "center", gap: 3 },
  friendStatTxt:       { color: THEME.textMuted, fontSize: 10 },
  mutualBadge:         { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: THEME.online + "15", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  mutualBadgeTxt:      { fontSize: 9, fontWeight: "900" },
  followsYouBadge:     { backgroundColor: THEME.purpleLight + "20", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  followsYouTxt:       { color: THEME.purpleLight, fontSize: 9, fontWeight: "800" },
  friendActions:       { flexDirection: "row", gap: 8, marginTop: 12, alignItems: "center" },
  followBtn:           { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  followBtnActive:     { backgroundColor: THEME.accent },
  unfollowBtn:         { backgroundColor: THEME.ui2, borderWidth: 1, borderColor: THEME.border },
  followBtnTxt:        { color: "#000", fontWeight: "900", fontSize: 11 },
  chatIconBtn:         { backgroundColor: THEME.accent, width: 34, height: 34, borderRadius: 11, justifyContent: "center", alignItems: "center" },

  // Suggestion card (compact horizontal)
  suggestionCard:      { width: 130, backgroundColor: THEME.ui, borderRadius: 20, padding: 14, alignItems: "center", borderWidth: 1, borderColor: THEME.border },

  // Groups
  groupCard:           { backgroundColor: THEME.ui, borderRadius: 22, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: THEME.border },
  groupCardTop:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  groupCardRight:      { flexDirection: "row", alignItems: "center", gap: 8 },
  groupTypeBadge:      { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  groupTypeTxt:        { fontSize: 9, fontWeight: "900" },
  publicBadge:         { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: THEME.blue + "15", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  publicBadgeTxt:      { fontSize: 9, fontWeight: "900" },
  groupCardMain:       { flexDirection: "row", alignItems: "center" },
  groupIconCircle:     { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  groupName:           { color: THEME.text, fontSize: 17, fontWeight: "800" },
  groupMeta:           { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4, flexWrap: "wrap" },
  groupMetaTxt:        { color: THEME.textMuted, fontSize: 11 },
  joinBtn:             { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  joinBtnTxt:          { color: "#000", fontWeight: "900", fontSize: 11, letterSpacing: 1 },
  lvlBadge:            { backgroundColor: THEME.purple + "25", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  lvlTxt:              { color: THEME.purpleBright, fontSize: 10, fontWeight: "900" },
  groupsStatsBanner:   { flexDirection: "row", backgroundColor: THEME.ui, borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: THEME.border },
  groupStatBox:        { flex: 1, alignItems: "center" },
  groupStatNum:        { color: THEME.accent, fontSize: 22, fontWeight: "900" },
  groupStatLbl:        { color: THEME.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 2 },
  createGroupCTA:      { marginTop: 20, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: THEME.accent + "30" },
  createGroupCTAGradient: { flexDirection: "row", alignItems: "center", gap: 14, padding: 20 },
  createGroupCTATitle: { color: THEME.accent, fontWeight: "900", fontSize: 14 },
  createGroupCTASub:   { color: THEME.textMuted, fontSize: 11, marginTop: 2 },

  // Empty states
  emptyState:          { alignItems: "center", paddingVertical: 50 },
  emptyTitle:          { color: THEME.text, fontSize: 18, fontWeight: "800", marginTop: 12 },
  emptySubtitle:       { color: THEME.textMuted, fontSize: 13, marginTop: 6, textAlign: "center", paddingHorizontal: 20 },
  emptyCreateBtn:      { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: THEME.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 20 },
  emptyCreateBtnTxt:   { color: "#000", fontWeight: "900", fontSize: 13 },

  // Notifications modal (full page sheet — consistent with feed)
  notifModal:          { flex: 1, backgroundColor: THEME.bg },
  notifHeader:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: THEME.border },
  notifTitle:          { color: THEME.text, fontSize: 22, fontWeight: "900" },
  notifCloseBtn:       { width: 36, height: 36, borderRadius: 12, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  notifEmpty:          { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  notifEmptyTxt:       { color: THEME.textMuted, fontSize: 16, fontWeight: "600" },
  notifItem:           { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: THEME.border },
  notifItemUnread:     { backgroundColor: THEME.accentDim },
  notifIconCircle:     { width: 40, height: 40, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  notifContent:        { flex: 1 },
  notifItemTxt:        { color: THEME.text, fontSize: 13, lineHeight: 18 },
  notifItemTime:       { color: THEME.textMuted, fontSize: 11, marginTop: 3 },
  unreadDot:           { width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.accent },

  // Create group modal
  modalOverlay:        { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  bottomSheet:         { backgroundColor: THEME.ui, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderWidth: 1, borderColor: THEME.border },
  sheetHandle:         { width: 40, height: 4, backgroundColor: THEME.ui2, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  sheetHeader:         { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  sheetTitle:          { color: THEME.accent, fontSize: 20, fontWeight: "900" },
  inputLabel:          { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 10, marginTop: 20 },
  textInput:           { backgroundColor: THEME.ui2, borderRadius: 14, padding: 16, color: THEME.text, fontSize: 15, borderWidth: 1, borderColor: THEME.border },
  privacyRow:          { flexDirection: "row", gap: 12 },
  privacyOpt:          { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 14, backgroundColor: THEME.ui2, borderWidth: 1, borderColor: THEME.border },
  privacyOptActive:    { backgroundColor: THEME.accent, borderColor: THEME.accent },
  privacyOptTxt:       { color: THEME.textMuted, fontWeight: "800", fontSize: 13 },
  typeGrid:            { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4 },
  typeCell:            { width: "47%", backgroundColor: THEME.ui2, padding: 18, borderRadius: 16, alignItems: "center", gap: 8, borderWidth: 1, borderColor: THEME.border },
  typeCellActive:      { backgroundColor: THEME.accent, borderColor: THEME.accent },
  typeCellTxt:         { color: THEME.textMuted, fontWeight: "900", fontSize: 10 },
  createBtn:           { backgroundColor: THEME.accent, padding: 20, borderRadius: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 30, marginBottom: 10 },
  createBtnTxt:        { color: "#000", fontWeight: "900", letterSpacing: 2, fontSize: 14 },
});