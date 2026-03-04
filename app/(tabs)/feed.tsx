import React, { useEffect, useState, useRef, useCallback, memo } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity,
  Image, StatusBar, RefreshControl, Alert, Share, Animated,
  Dimensions, TextInput, Modal, ScrollView, Platform, TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { db, auth } from "../../lib/firebase";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection, query, orderBy, limit, startAfter, onSnapshot,
  getDocs, doc, updateDoc, arrayUnion, arrayRemove, getDoc,
  deleteDoc, addDoc, serverTimestamp, where, increment,
} from "firebase/firestore";
import CommentsModal from "@/components/CommentsModal";

const { width } = Dimensions.get("window");
const PAGE_SIZE = 15;

const THEME = {
  bg:          "#07030F",
  ui:          "#0F0820",
  ui2:         "#170D2E",
  ui3:         "#201540",
  accent:      "#FFD700",
  accentDim:   "rgba(255,215,0,0.08)",
  purple:      "#6D28D9",
  purpleLight: "#A78BFA",
  purpleDim:   "rgba(109,40,217,0.15)",
  text:        "#EDE8F5",
  textMuted:   "#6B5F80",
  green:       "#22C55E",
  red:         "#EF4444",
  blue:        "#38BDF8",
  border:      "#1A1030",
};

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

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: string; bg: string }> = {
  discussion:  { label: "DISCUSSION",   color: THEME.purpleLight, icon: "chatbubbles",  bg: THEME.purpleDim          },
  article:     { label: "ARTICLE",      color: THEME.blue,        icon: "newspaper",    bg: "rgba(56,189,248,0.1)"   },
  book:        { label: "NEW BOOK",     color: THEME.accent,      icon: "book",         bg: THEME.accentDim          },
  book_update: { label: "BOOK UPDATE",  color: THEME.accent,      icon: "book-outline", bg: THEME.accentDim          },
  research:    { label: "RESEARCH",     color: "#00D1FF",         icon: "flask",        bg: "rgba(0,209,255,0.08)"   },
  admin:       { label: "ANNOUNCEMENT", color: THEME.purple,      icon: "megaphone",    bg: THEME.purpleDim          },
  ad:          { label: "SPONSORED",    color: THEME.textMuted,   icon: "star-outline", bg: "rgba(255,255,255,0.03)" },
  weave:       { label: "WEAVE",        color: "#F59E0B",         icon: "feather",      bg: "rgba(245,158,11,0.1)"   },
};

const WEAVE_TYPE_COLOR: Record<string, string> = {
  Analysis:   "#38BDF8",
  Critique:   "#FFD700",
  Research:   "#A78BFA",
  Memory:     "#F97316",
  Legacy:     "#22C55E",
  Discussion: "#6D28D9",
};

const WEAVE_TYPE_ICON: Record<string, string> = {
  Analysis:   "microscope",
  Critique:   "star-half-full",
  Research:   "book-search",
  Memory:     "heart-outline",
  Legacy:     "trophy-outline",
  Discussion: "forum-outline",
};

const FILTER_TABS = [
  { key: "all",        label: "All"         },
  { key: "discussion", label: "Discussions" },
  { key: "article",    label: "Articles"    },
  { key: "book",       label: "Books"       },
  { key: "research",   label: "Research"    },
  { key: "weave",      label: "Weaves"      },
];

const REACTIONS = ["❤️", "🔥", "🤯", "👏", "💡", "😂"];

const formatTime = (ts: any): string => {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60)     return "just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
};

// ── STORY RING ────────────────────────────────────────────────────────────
const StoryRing = memo(({ user, onPress }: { user: any; onPress: () => void }) => (
  <TouchableOpacity style={styles.storyItem} onPress={onPress} activeOpacity={0.8}>
    <LinearGradient
      colors={["#FFD700", "#A78BFA", "#6D28D9"]}
      style={styles.storyRing}
      start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
    >
      <View style={styles.storyInner}>
        <Image
          source={{
            uri: user.photoURL ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "W")}&background=170D2E&color=FFD700&bold=true`,
          }}
          style={styles.storyAvatar}
        />
      </View>
    </LinearGradient>
    <Text style={styles.storyName} numberOfLines={1}>
      {user.displayName?.split(" ")[0] || "Scholar"}
    </Text>
  </TouchableOpacity>
));

// ── AD CARD ───────────────────────────────────────────────────────────────
// FIX 7: Added onPress to CTA button
const AdCard = memo(({ item }: { item: any }) => {
  const router = useRouter();
  
  return (
    <View style={styles.adCard}>
      <View style={styles.adLabel}>
        <Ionicons name="megaphone-outline" size={10} color={THEME.textMuted} />
        <Text style={styles.adLabelTxt}>Sponsored</Text>
      </View>
      {(item.coverUrl || item.image) ? (
        <Image source={{ uri: item.coverUrl || item.image }} style={styles.adImage} resizeMode="cover" />
      ) : null}
      <View style={styles.adBody}>
        <Text style={styles.adTitle}>{item.title}</Text>
        {item.content ? <Text style={styles.adContent} numberOfLines={2}>{item.content}</Text> : null}
        <TouchableOpacity 
          style={styles.adCTA} 
          onPress={() => router.push("/advertise" as any)}
        >
          <Text style={styles.adCTATxt}>{item.ctaLabel || "Get Started"}</Text>
          <Ionicons name="arrow-forward" size={12} color="#000" />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ── REACTION STRIP ────────────────────────────────────────────────────────
// FIX 4: Added overlay to dismiss emoji picker when tapping outside
const ReactionStrip = memo(({ postId, uid, reactions }: {
  postId: string; uid: string; reactions: Record<string, string[]>;
}) => {
  const [visible,  setVisible]  = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const showPicker = () => {
    setVisible(true);
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
  };

  const hidePicker = () => {
    Animated.timing(scaleAnim, { 
      toValue: 0, 
      duration: 150, 
      useNativeDriver: true 
    }).start(() => setVisible(false));
  };

  const react = async (emoji: string) => {
    hidePicker();
    try {
      const already = reactions[emoji]?.includes(uid);
      const update: Record<string, any> = {};
      update[`reactions.${emoji}`] = already ? arrayRemove(uid) : arrayUnion(uid);
      await updateDoc(doc(db, "feed", postId), update);
    } catch (e) { console.error(e); }
  };

  const topReactions = Object.entries(reactions || {})
    .filter(([, users]) => users.length > 0)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3);

  return (
    <View style={styles.reactionWrap}>
      {topReactions.map(([emoji, users]) => (
        <TouchableOpacity
          key={emoji}
          style={[styles.reactionPill, users.includes(uid) && styles.reactionPillActive]}
          onPress={() => react(emoji)}
        >
          <Text style={styles.reactionEmoji}>{emoji}</Text>
          <Text style={styles.reactionCount}>{users.length}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.reactionAddBtn} onPress={showPicker}>
        <Text style={styles.reactionAddTxt}>+</Text>
      </TouchableOpacity>
      
      {/* FIX 4: Dismissible overlay and picker */}
      {visible && (
        <>
          <TouchableWithoutFeedback onPress={hidePicker}>
            <View style={styles.reactionOverlay} />
          </TouchableWithoutFeedback>
          <Animated.View style={[styles.reactionPicker, { transform: [{ scale: scaleAnim }] }]}>
            {REACTIONS.map((emoji) => (
              <TouchableOpacity key={emoji} style={styles.reactionPickerBtn} onPress={() => react(emoji)}>
                <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </>
      )}
    </View>
  );
});

// ── NOTIFICATIONS MODAL ───────────────────────────────────────────────────
const NotificationsModal = memo(({ visible, onClose, uid }: {
  visible: boolean; onClose: () => void; uid: string;
}) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!visible || !uid) return;
    const q = query(
      collection(db, "users", uid, "notifications"),
      orderBy("createdAt", "desc"),
      limit(30)
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [visible, uid]);

  useEffect(() => {
    if (!visible || !uid) return;
    const markRead = async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, "users", uid, "notifications"),
            where("read", "==", false)
          )
        );
        snap.docs.forEach((d) => {
          updateDoc(doc(db, "users", uid, "notifications", d.id), { read: true });
        });
        await updateDoc(doc(db, "users", uid), { hasUnread: false });
      } catch (e) { console.error(e); }
    };
    markRead();
  }, [visible, uid]);

  const NOTIF_ICONS: Record<string, { icon: string; color: string }> = {
    like:          { icon: "heart",            color: THEME.red         },
    comment:       { icon: "chatbubble",       color: THEME.blue        },
    follow:        { icon: "person-add",       color: THEME.purple      },
    purchase:      { icon: "cart",             color: THEME.green       },
    review:        { icon: "shield-checkmark", color: THEME.accent      },
    mention:       { icon: "at-circle",        color: THEME.purpleLight },
    weave:         { icon: "feather",          color: "#F59E0B"         },
    book_approved: { icon: "checkmark-circle", color: THEME.green       },
    book_rejected: { icon: "close-circle",     color: THEME.red         },
    default:       { icon: "notifications",    color: THEME.textMuted   },
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.notifModal}>
        <View style={styles.notifHeader}>
          <Text style={styles.notifTitle}>Notifications</Text>
          <TouchableOpacity onPress={onClose} style={styles.notifCloseBtn}>
            <Ionicons name="close" size={22} color={THEME.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.notifLoader}>
            <ActivityIndicator color={THEME.accent} />
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.notifEmpty}>
            <Ionicons name="notifications-off-outline" size={48} color={THEME.textMuted} />
            <Text style={styles.notifEmptyTxt}>No notifications yet</Text>
            <Text style={styles.notifEmptySub}>
              Activity like likes, comments and follows will appear here
            </Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {notifications.map((notif) => {
              const cfg = NOTIF_ICONS[notif.type] || NOTIF_ICONS.default;
              return (
                <View
                  key={notif.id}
                  style={[styles.notifItem, !notif.read && styles.notifItemUnread]}
                >
                  <View style={[styles.notifIconCircle, { backgroundColor: cfg.color + "20" }]}>
                    <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
                  </View>
                  <View style={styles.notifContent}>
                    <Text style={styles.notifItemTxt}>{notif.message || notif.body}</Text>
                    <Text style={styles.notifItemTime}>{formatTime(notif.createdAt)}</Text>
                  </View>
                  {!notif.read && <View style={styles.unreadDot} />}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
});

// ── POST CARD ─────────────────────────────────────────────────────────────
const PostCard = memo(({ item, uid, userPhoto, userData, toggleLike, onProfilePress }: any) => {
  const router = useRouter();
  const liked = item.likedBy?.includes(uid);
  const isOwner = uid === item.userId || uid === item.authorId;
  const typeConfig = TYPE_CONFIG[item.type] || TYPE_CONFIG.discussion;
  
  // FIX 1: State for showing comments section
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleBookmark = async () => {
    setBookmarked(!bookmarked);
    try {
      await updateDoc(doc(db, "users", uid, "bookmarks", item.id), {
        postId: item.id,
        savedAt: serverTimestamp(),
      });
    } catch (e) { console.error(e); }
  };

  const onShare = async () => {
    const title = item.title || item.content?.slice(0, 80) || "Check this out";
    const baseUrl = "https://writha-book-app.vercel.app";

    const url =
      item.type === "article"  ? `${baseUrl}/article/${item.id}`  :
      item.type === "research" ? `${baseUrl}/research/${item.id}` :
      item.type === "book"     ? `${baseUrl}/book/${item.bookId || item.id}` :
      item.type === "weave"    ? `${baseUrl}/weave/${item.originalId || item.id}` :
                                 `${baseUrl}/discussion/${item.id}`;

    if (Platform.OS === "web") {
      if (navigator.share) {
        try {
          await navigator.share({ title: `${title} — Writha`, text: title, url });
        } catch {
          await navigator.clipboard.writeText(url);
          window.alert("Link copied to clipboard!");
        }
      } else {
        await navigator.clipboard.writeText(url);
        window.alert("Link copied to clipboard!\n\n" + url);
      }
      return;
    }
    try {
      await Share.share({
        title: `${title} — Writha`,
        message: Platform.OS === "android" ? `${title} — Writha\n${url}` : title,
        url,
      });
    } catch (e) { console.error(e); }
  };

  // FIX 2 & 6: Proper navigation for all post types including discussion
  const navigateToPost = () => {
    if (item.type === "book" || item.type === "book_update") {
      router.push(`/book/${item.bookId || item.originalId || item.id}` as any);
    } else if (item.type === "article") {
      router.push(`/article/${item.id}` as any);
    } else if (item.type === "research") {
      router.push(`/research/${item.originalId || item.id}` as any);
    } else if (item.type === "weave") {
      router.push(`/weave/${item.originalId || item.id}` as any);
    } else if (item.type === "discussion") {
      router.push(`/discussion/${item.id}` as any);
    } else {
      // Default fallback
      router.push(`/post/${item.id}` as any);
    }
  };

  const handleSettings = () => {
    const baseOptions: any[] = [
      { text: "📤 Share", onPress: onShare },
      { text: bookmarked ? "🔖 Saved" : "🔖 Bookmark", onPress: handleBookmark },
      { text: "🚫 Hide Post", onPress: () => showAlert("Hidden", "You won't see this post again.", [{ text: "OK" }]) },
      { text: "⚠️ Report", onPress: () => showAlert("Reported", "Thank you for keeping Writha safe.", [{ text: "OK" }]) },
    ];
    
    if (isOwner) {
      if (item.type === "weave") {
        baseOptions.unshift({
          text: "✏️ Edit Weave",
          onPress: () => router.push(`/weave/edit?id=${item.originalId || item.id}` as any),
        });
      }
      baseOptions.unshift({
        text: "🗑️ Delete Post",
        style: "destructive",
        onPress: () =>
          showAlert("Delete Post", "This cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: async () => {
                try {
                  await deleteDoc(doc(db, "feed", item.id));
                  if (item.type === "weave" && item.originalId) {
                    await deleteDoc(doc(db, "weaves", item.originalId));
                  }
                } catch (e) { console.error(e); }
              },
            },
          ]),
      });
    }
    baseOptions.push({ text: "Cancel", style: "cancel" });
    showAlert("Post Options", "", baseOptions);
  };

  if (item.type === "ad") return <AdCard item={item} />;

  const authorName = item.userName || item.authorName || item.displayName || item.fullName || "Scholar";
  const authorHandle = item.userHandle || item.authorUsername || item.username || authorName.toLowerCase().replace(/\s/g, "");
  const authorPhoto = item.userPhoto || item.authorPhoto || item.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=170D2E&color=FFD700&bold=true`;

  if (item.type === "admin") {
    return (
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }] }}>
        <LinearGradient
          colors={["#2D1B69", "#170D2E"]}
          style={styles.adminCard}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <View style={styles.adminCardHeader}>
            <View style={styles.adminBadge}>
              <MaterialCommunityIcons name="shield-star" size={14} color={THEME.accent} />
              <Text style={styles.adminBadgeTxt}>WRITHA OFFICIAL</Text>
            </View>
            <Text style={styles.postTime}>{formatTime(item.createdAt)}</Text>
          </View>
          <Text style={styles.adminTitle}>{item.title}</Text>
          {item.content && <Text style={styles.adminContent}>{item.content}</Text>}
          {(item.coverUrl || item.image) && (
            <Image source={{ uri: item.coverUrl || item.image }} style={styles.postImage} />
          )}
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY }] }]}>

      {item.isPinned && (
        <View style={styles.pinnedStrip}>
          <Ionicons name="pin" size={11} color={THEME.accent} />
          <Text style={styles.pinnedTxt}>PINNED</Text>
        </View>
      )}

      <View style={[styles.typeBadge, { backgroundColor: typeConfig.bg }]}>
        <Ionicons name={typeConfig.icon as any} size={11} color={typeConfig.color} />
        <Text style={[styles.typeBadgeTxt, { color: typeConfig.color }]}>{typeConfig.label}</Text>
      </View>

      {/* FIX 3: Only avatar is tappable for profile, name is not */}
      <View style={styles.authorRow}>
        <View style={styles.authorLeft}>
          <TouchableOpacity
            onPress={() => onProfilePress(item.userId || item.authorId)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[THEME.accent, THEME.purpleLight, THEME.purple]}
              style={styles.avatarRing}
              start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
            >
              <View style={styles.avatarInner}>
                <Image source={{ uri: authorPhoto }} style={styles.avatar} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.authorInfo}>
            <View style={styles.authorNameRow}>
              <Text style={styles.authorName}>{authorName}</Text>
              {item.isAuthor && (
                <MaterialCommunityIcons name="check-decagram" size={14} color={THEME.accent} style={{ marginLeft: 4 }} />
              )}
              {item.isAdmin && (
                <MaterialCommunityIcons name="shield-star" size={14} color={THEME.purple} style={{ marginLeft: 4 }} />
              )}
            </View>
            <View style={styles.authorMeta}>
              <Text style={styles.authorHandle}>@{authorHandle}</Text>
              <Text style={styles.authorDot}>·</Text>
              <Text style={styles.postTime}>{formatTime(item.createdAt)}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.moreBtn}
          onPress={handleSettings}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={THEME.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Post content - tappable to open detail */}
      <TouchableOpacity onPress={navigateToPost} activeOpacity={0.9}>

        {(item.type === "book" || item.type === "book_update") && (
          <View style={styles.bookPreviewRow}>
            <Image
              source={{ uri: item.coverUrl || item.cover || "https://picsum.photos/80/120" }}
              style={styles.bookPreviewCover}
            />
            <View style={styles.bookPreviewInfo}>
              <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
              {item.genre && (
                <View style={styles.genrePill}>
                  <Text style={styles.genrePillTxt}>{item.genre}</Text>
                </View>
              )}
              {item.content && (
                <Text style={styles.postText} numberOfLines={3}>{item.content}</Text>
              )}
              {item.price > 0 ? (
                <View style={styles.pricePill}>
                  <Text style={styles.pricePillTxt}>₦{item.price?.toLocaleString()}</Text>
                </View>
              ) : (
                <View style={[styles.pricePill, { backgroundColor: THEME.green + "20" }]}>
                  <Text style={[styles.pricePillTxt, { color: THEME.green }]}>FREE</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {item.type === "research" && (
          <View style={styles.researchCard}>
            <View style={styles.researchHeader}>
              <Ionicons name="flask" size={14} color="#00D1FF" />
              <Text style={styles.researchField}>{item.fieldOfStudy || item.category || "Research"}</Text>
            </View>
            <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
            {item.content && (
              <Text style={styles.postText} numberOfLines={3}>{item.content}</Text>
            )}
            <View style={styles.researchFooter}>
              {item.institution && (
                <View style={styles.researchTag}>
                  <Ionicons name="business-outline" size={10} color={THEME.textMuted} />
                  <Text style={styles.researchTagTxt}>{item.institution}</Text>
                </View>
              )}
              {item.isPaid && (
                <View style={[styles.researchTag, { backgroundColor: THEME.accentDim }]}>
                  <Text style={[styles.researchTagTxt, { color: THEME.accent }]}>₦{item.price?.toLocaleString()}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {(item.type === "discussion" || item.type === "article" || !item.type) && (
          <View>
            {item.title && <Text style={styles.postTitle}>{item.title}</Text>}
            {item.content && (
              <Text style={styles.postText} numberOfLines={item.type === "article" ? 3 : 6}>
                {item.content}
              </Text>
            )}
            {(item.coverUrl || item.image) && (
              <Image
                source={{ uri: item.coverUrl || item.image }}
                style={styles.postImage}
                resizeMode="cover"
              />
            )}
            {item.type === "article" && item.readTime && (
              <View style={styles.readTimePill}>
                <Ionicons name="time-outline" size={11} color={THEME.blue} />
                <Text style={styles.readTimeTxt}>{item.readTime} min read</Text>
              </View>
            )}
          </View>
        )}

        {item.type === "weave" && (
          <View style={[styles.weaveCard, {
            borderColor: (WEAVE_TYPE_COLOR[item.weaveType] || "#F59E0B") + "30",
          }]}>
            <View style={styles.weaveHeader}>
              <MaterialCommunityIcons
                name={(WEAVE_TYPE_ICON[item.weaveType] || "feather") as any}
                size={14}
                color={WEAVE_TYPE_COLOR[item.weaveType] || "#F59E0B"}
              />
              <Text style={[styles.weaveTypeTxt, {
                color: WEAVE_TYPE_COLOR[item.weaveType] || "#F59E0B",
              }]}>
                {(item.weaveType || "WEAVE").toUpperCase()}
              </Text>
            </View>
            {item.bookTitle && (
              <View style={styles.weaveBookRefRow}>
                <Ionicons name="book-outline" size={11} color={THEME.textMuted} />
                <Text style={styles.weaveBookRef} numberOfLines={1}>
                  {item.bookTitle}
                  {item.bookAuthor ? ` · ${item.bookAuthor}` : ""}
                </Text>
              </View>
            )}
            {item.title
              ? <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
              : <Text style={styles.postText} numberOfLines={3}>{item.content}</Text>
            }
            {item.weaveType === "Critique" && item.rating && (
              <View style={styles.weaveRatingRow}>
                <Text style={[styles.weaveRating, { color: WEAVE_TYPE_COLOR["Critique"] }]}>
                  {item.rating}/10
                </Text>
                <Text style={styles.weaveRatingLabel}>
                  {Number(item.rating) >= 9 ? "Masterpiece" :
                   Number(item.rating) >= 7 ? "Highly Recommended" :
                   Number(item.rating) >= 5 ? "Worth Reading" :
                                              "Has Merit"}
                </Text>
              </View>
            )}
            {item.isExternalBook && (
              <View style={styles.externalBadge}>
                <Ionicons name="globe-outline" size={10} color={THEME.textMuted} />
                <Text style={styles.externalBadgeTxt}>External Reference</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>

      {item.mood && (
        <View style={styles.moodTag}>
          <Text style={styles.moodTagTxt}>{item.mood}</Text>
        </View>
      )}

      <ReactionStrip postId={item.id} uid={uid} reactions={item.reactions || {}} />

      {/* FIX 1 & 2: Action bar with working View button and Comment toggle */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => toggleLike(item)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={20}
            color={liked ? THEME.red : THEME.textMuted}
          />
          <Text style={[styles.actionTxt, liked && { color: THEME.red }]}>
            {item.likesCount || 0}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setShowCommentsModal(!showComments)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={showComments ? "chatbubble" : "chatbubble-outline"}
            size={18}
            color={showComments ? THEME.blue : THEME.textMuted}
          />
          <Text style={[styles.actionTxt, showComments && { color: THEME.blue }]}>
            {item.commentsCount || 0}
          </Text>
        </TouchableOpacity>

        {/* FIX 2: View button now correctly navigates */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={navigateToPost}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-redo-outline" size={18} color={THEME.textMuted} />
          <Text style={styles.actionTxt}>View</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onShare}>
          <Ionicons name="share-social-outline" size={18} color={THEME.accent} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleBookmark}>
          <Ionicons
            name={bookmarked ? "bookmark" : "bookmark-outline"}
            size={18}
            color={bookmarked ? THEME.accent : THEME.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* FIX 1: Show comments section when toggled */}
      <CommentsModal
        visible={showCommentsModal}
        onClose={() => setShowCommentsModal(false)}
        postId={item.id}
        uid={uid}
        userPhoto={userPhoto}
        postAuthorId={item.userId || item.authorId}
      />
    </Animated.View>
  );
});

// ── MAIN SCREEN ───────────────────────────────────────────────────────────
export default function GlobalFeedTab() {
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  const [posts, setPosts] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterTab, setFilterTab] = useState("all");
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const scrollY = useRef(new Animated.Value(0)).current;
  const feedUnsubRef = useRef<(() => void) | null>(null);

  // User data listener
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      if (snap.exists()) setUserData(snap.data());
    });
    return () => unsub();
  }, [uid]);

  // FIX 5: Real-time unread notifications count
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "users", uid, "notifications"),
      where("read", "==", false)
    );
    const unsub = onSnapshot(q, (snap) => setUnreadCount(snap.size));
    return () => unsub();
  }, [uid]);

  // Active users listener
  useEffect(() => {
    const q = query(
      collection(db, "users"),
      where("isOnline", "==", true),
      limit(10)
    );
    const unsub = onSnapshot(q, (snap) => {
      setActiveUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Fetch feed
  const fetchFeed = useCallback(() => {
    if (feedUnsubRef.current) feedUnsubRef.current();
    setLoading(true);
    const q = query(
      collection(db, "feed"),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPosts(injectAds(items));
        setLastDoc(snap.docs[snap.docs.length - 1]);
        setLoading(false);
        setRefreshing(false);
      },
      (err) => {
        console.log("Feed error:", err.message);
        setLoading(false);
        setRefreshing(false);
      }
    );
    feedUnsubRef.current = unsub;
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = fetchFeed();
    return () => unsub();
  }, [fetchFeed]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setLastDoc(null);
    fetchFeed();
  }, [fetchFeed]);

  const injectAds = (items: any[]): any[] => {
    const adPlaceholder = {
      id: "ad_sponsored_static",
      type: "ad",
      title: "Grow Your Readership on Writha",
      content: "Reach thousands of active readers. Advertise your work today.",
      ctaLabel: "Get Started",
    };
    if (items.length === 0) return [adPlaceholder];

    const insertAt = Math.min(3, items.length);
    return [
      ...items.slice(0, insertAt), adPlaceholder, ...items.slice(insertAt),
    ];
  };

  const loadMore = async () => {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, "feed"),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      const newItems = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPosts((prev) => [...prev, ...newItems]);
      setLastDoc(snap.docs[snap.docs.length - 1]);
    } catch (e) { console.error(e); } 
    finally { setLoadingMore(false); }
  };

  // FIX 5: Enhanced toggleLike with proper notification creation
  const toggleLike = useCallback(async (post: any) => {
    if (!uid) return;
    const liked = post.likedBy?.includes(uid);
    try {
      await updateDoc(doc(db, "feed", post.id), {
        likedBy: liked ? arrayRemove(uid) : arrayUnion(uid),
        likesCount: increment(liked ? -1 : 1),
      });
      
      // Create notification on like (not unlike), and don't notify yourself
      if (!liked && post.userId && post.userId !== uid) {
        await addDoc(collection(db, "users", post.userId, "notifications"), {
          type: "like",
          message: `${userData?.displayName || "Someone"} liked your post`,
          postId: post.id,
          fromUserId: uid,
          fromUserName: userData?.displayName || "Scholar",
          fromUserPhoto: userData?.photoURL || "",
          read: false,
          createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, "users", post.userId), { hasUnread: true });
      }
    } catch (e) { console.error(e); }
  }, [uid, userData]);

  const filteredPosts = filterTab === "all"
    ? posts
    : posts.filter((p) =>
        p.type === filterTab ||
        (filterTab === "book" && p.type === "book_update")
      );

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 60], outputRange: [1, 0.95], extrapolate: "clamp",
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={THEME.accent} size="large" />
        <Text style={{ color: THEME.textMuted, marginTop: 12 }}>Loading Pulse...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <View>
          <Text style={styles.brandSub}>WRITHA</Text>
          <Text style={styles.brandMain}>Pulse</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setShowNotifs(true)}
          >
            <Ionicons name="notifications-outline" size={22} color={THEME.text} />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeTxt}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAvatarBtn}
            onPress={() => router.push(`/profile/${uid}` as any)}
          >
            <LinearGradient
              colors={[THEME.accent, THEME.purple]}
              style={styles.headerAvatarRing}
            >
              <Image
                source={{
                  uri: userData?.photoURL || userData?.profilePic ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(userData?.displayName || "W")}&background=170D2E&color=FFD700&bold=true`,
                }}
                style={styles.headerAvatarImg}
              />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.FlatList
        data={filteredPosts}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View>
            {/* Story rings */}
            {activeUsers.length > 0 && (
              <View style={styles.storySection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.storyRow}>
                    <TouchableOpacity style={styles.storyItem} activeOpacity={0.8}>
                      <View style={styles.myStoryRing}>
                        <Image
                          source={{
                            uri: userData?.photoURL ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(userData?.displayName || "W")}&background=170D2E&color=FFD700`,
                          }}
                          style={styles.storyAvatar}
                        />
                        <View style={styles.myStoryAdd}>
                          <Ionicons name="add" size={10} color="#000" />
                        </View>
                      </View>
                      <Text style={styles.storyName}>You</Text>
                    </TouchableOpacity>
                    {activeUsers.slice(0, 8).map((u) => (
                      <StoryRing
                        key={u.id}
                        user={u}
                        onPress={() => router.push(`/profile/${u.id}` as any)}
                      />
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Filter tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterContent}
            >
              {FILTER_TABS.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.filterTab, filterTab === tab.key && styles.filterTabActive]}
                  onPress={() => setFilterTab(tab.key)}
                >
                  <Text style={[
                    styles.filterTabTxt,
                    filterTab === tab.key && styles.filterTabTxtActive,
                  ]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => (
          <PostCard
            item={item}
            uid={uid}
            userPhoto={userData?.photoURL || userData?.profilePic}
            userData={userData}
            toggleLike={toggleLike}
            onProfilePress={(userId: string) => router.push(`/profile/${userId}` as any)}
          />
        )}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadMoreIndicator}>
              <ActivityIndicator color={THEME.accent} size="small" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="broadcast-off" size={52} color={THEME.ui3} />
            <Text style={styles.emptyTitle}>The Pulse is quiet</Text>
            <Text style={styles.emptySub}>
              Be the first to post a discussion, article or book
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={THEME.accent}
          />
        }
      />

      <NotificationsModal
        visible={showNotifs}
        onClose={() => setShowNotifs(false)}
        uid={uid || ""}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: THEME.bg },
  
  // Header
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brandSub: { color: THEME.purple, fontSize: 10, fontWeight: "900", letterSpacing: 4 },
  brandMain: { color: THEME.text, fontSize: 40, fontWeight: "900", letterSpacing: -2, marginTop: -4 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIconBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: THEME.border, position: "relative" },
  notifBadge: { position: "absolute", top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: THEME.red, justifyContent: "center", alignItems: "center", paddingHorizontal: 2 },
  notifBadgeTxt: { color: "#fff", fontSize: 8, fontWeight: "900" },
  headerAvatarBtn: {},
  headerAvatarRing: { padding: 2, borderRadius: 16 },
  headerAvatarImg: { width: 36, height: 36, borderRadius: 13, borderWidth: 2, borderColor: THEME.bg },
  
  // Stories
  storySection: { marginBottom: 8 },
  storyRow: { flexDirection: "row", paddingHorizontal: 16, gap: 14, paddingVertical: 4 },
  storyItem: { alignItems: "center", width: 60 },
  storyRing: { width: 58, height: 58, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  storyInner: { width: 52, height: 52, borderRadius: 16, backgroundColor: THEME.bg, justifyContent: "center", alignItems: "center" },
  storyAvatar: { width: 48, height: 48, borderRadius: 15 },
  storyName: { color: THEME.textMuted, fontSize: 10, marginTop: 5, fontWeight: "700", textAlign: "center" },
  myStoryRing: { width: 58, height: 58, borderRadius: 18, backgroundColor: THEME.ui2, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: THEME.border, position: "relative" },
  myStoryAdd: { position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: 6, backgroundColor: THEME.accent, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: THEME.bg },
  
  // Filter tabs
  filterScroll: { marginBottom: 8 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.border },
  filterTabActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  filterTabTxt: { color: THEME.textMuted, fontWeight: "700", fontSize: 12 },
  filterTabTxtActive: { color: "#000" },
  
  // Feed
  listContent: { paddingHorizontal: 14, paddingBottom: 120 },
  
  // Post card
  card: { backgroundColor: THEME.ui, borderRadius: 24, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: THEME.border },
  pinnedStrip: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 },
  pinnedTxt: { color: THEME.accent, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  typeBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start", marginBottom: 12 },
  typeBadgeTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  
  // FIX 3: Author row - avatar only is tappable
  authorRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  authorLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  avatarRing: { width: 46, height: 46, borderRadius: 15, justifyContent: "center", alignItems: "center" },
  avatarInner: { width: 40, height: 40, borderRadius: 13, backgroundColor: THEME.bg, justifyContent: "center", alignItems: "center" },
  avatar: { width: 36, height: 36, borderRadius: 11 },
  authorInfo: { flex: 1 },
  authorNameRow: { flexDirection: "row", alignItems: "center" },
  authorName: { color: THEME.text, fontWeight: "800", fontSize: 14 },
  authorMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  authorHandle: { color: THEME.accent, fontSize: 11, fontWeight: "700" },
  authorDot: { color: THEME.textMuted, fontSize: 11 },
  postTime: { color: THEME.textMuted, fontSize: 11 },
  moreBtn: { padding: 4 },
  
  // Content
  postTitle: { color: THEME.text, fontSize: 18, fontWeight: "900", marginBottom: 8, lineHeight: 24 },
  postText: { color: "#B0A8C0", fontSize: 14, lineHeight: 22, marginBottom: 12 },
  postImage: { width: "100%", height: 210, borderRadius: 18, marginBottom: 12 },
  
  // Book preview
  bookPreviewRow: { flexDirection: "row", gap: 14, marginBottom: 8 },
  bookPreviewCover: { width: 80, height: 115, borderRadius: 12, borderWidth: 2, borderColor: THEME.accent + "40" },
  bookPreviewInfo: { flex: 1 },
  genrePill: { backgroundColor: THEME.ui3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: "flex-start", marginBottom: 6 },
  genrePillTxt: { color: THEME.purpleLight, fontSize: 9, fontWeight: "900" },
  pricePill: { backgroundColor: THEME.accentDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: "flex-start", marginTop: 6 },
  pricePillTxt: { color: THEME.accent, fontSize: 11, fontWeight: "900" },
  
  // Research
  researchCard: { backgroundColor: "rgba(0,209,255,0.05)", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "rgba(0,209,255,0.15)" },
  researchHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  researchField: { color: "#00D1FF", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  researchFooter: { flexDirection: "row", gap: 8, marginTop: 8 },
  researchTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: THEME.ui2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  researchTagTxt: { color: THEME.textMuted, fontSize: 10 },
  
  // Weave
  weaveCard: { backgroundColor: "rgba(245,158,11,0.06)", borderRadius: 16, padding: 14, borderWidth: 1 },
  weaveHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  weaveTypeTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  weaveBookRefRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 },
  weaveBookRef: { color: THEME.textMuted, fontSize: 12, flex: 1 },
  weaveRatingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  weaveRating: { fontSize: 18, fontWeight: "900" },
  weaveRatingLabel: { color: THEME.textMuted, fontSize: 11, fontWeight: "700" },
  externalBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  externalBadgeTxt: { color: THEME.textMuted, fontSize: 10 },
  
  // Read time
  readTimePill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(56,189,248,0.1)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: "flex-start" },
  readTimeTxt: { color: THEME.blue, fontSize: 10, fontWeight: "700" },
  
  // Mood
  moodTag: { backgroundColor: THEME.ui2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: "flex-start", marginBottom: 10 },
  moodTagTxt: { color: THEME.purpleLight, fontSize: 11, fontWeight: "700" },
  
  // FIX 4: Reactions with dismiss overlay
  reactionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10, position: "relative" },
  reactionPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: THEME.ui2, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: THEME.border },
  reactionPillActive: { borderColor: THEME.accent, backgroundColor: THEME.accentDim },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { color: THEME.textMuted, fontSize: 11, fontWeight: "700" },
  reactionAddBtn: { width: 30, height: 26, borderRadius: 10, backgroundColor: THEME.ui2, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: THEME.border },
  reactionAddTxt: { color: THEME.textMuted, fontSize: 16, fontWeight: "900", marginTop: -2 },
  reactionOverlay: { position: "absolute", top: -500, left: -500, right: -500, bottom: -500, zIndex: 5 },
  reactionPicker: { position: "absolute", bottom: 36, left: 0, flexDirection: "row", gap: 4, backgroundColor: THEME.ui3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: THEME.border, zIndex: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  reactionPickerBtn: { padding: 4 },
  reactionPickerEmoji: { fontSize: 22 },
  
  // Action bar
  actionBar: { flexDirection: "row", alignItems: "center", gap: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: THEME.border },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10 },
  actionTxt: { color: THEME.textMuted, fontSize: 13, fontWeight: "700" },
  
  // FIX 1: Comments section styles
  commentSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: THEME.border, paddingTop: 12 },
  quickComment: { flexDirection: "row", gap: 10, alignItems: "flex-end", marginBottom: 12 },
  quickCommentAvatar: { width: 30, height: 30, borderRadius: 10 },
  quickCommentAvatarFallback: { backgroundColor: THEME.purple, justifyContent: "center", alignItems: "center" },
  quickCommentInput: { flex: 1, flexDirection: "row", alignItems: "flex-end", backgroundColor: THEME.ui2, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderWidth: 1, borderColor: THEME.border },
  quickCommentTxt: { flex: 1, color: THEME.text, fontSize: 13, maxHeight: 80 },
  noCommentsTxt: { color: THEME.textMuted, fontSize: 12, textAlign: "center", paddingVertical: 12 },
  commentCard: { flexDirection: "row", gap: 8, marginBottom: 10 },
  commentCardAvatar: { width: 28, height: 28, borderRadius: 9 },
  commentAvatarFallback: { backgroundColor: THEME.purple, justifyContent: "center", alignItems: "center" },
  commentCardBody: { flex: 1, backgroundColor: THEME.ui2, borderRadius: 12, padding: 10 },
  commentCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  commentCardName: { color: THEME.text, fontWeight: "800", fontSize: 12 },
  commentCardTime: { color: THEME.textMuted, fontSize: 10 },
  commentCardTxt: { color: THEME.text, fontSize: 13, lineHeight: 18 },
  
  // Admin card
  adminCard: { borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: THEME.purple + "50" },
  adminCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  adminBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: THEME.accentDim, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  adminBadgeTxt: { color: THEME.accent, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  adminTitle: { color: THEME.text, fontSize: 18, fontWeight: "900", marginBottom: 8 },
  adminContent: { color: "#B0A8C0", fontSize: 14, lineHeight: 22 },
  
  // FIX 7: Ad card
  adCard: { backgroundColor: THEME.ui, borderRadius: 20, overflow: "hidden", marginBottom: 16, borderWidth: 1, borderColor: THEME.border },
  adLabel: { flexDirection: "row", alignItems: "center", gap: 4, padding: 10, paddingBottom: 0 },
  adLabelTxt: { color: THEME.textMuted, fontSize: 10, fontWeight: "600" },
  adImage: { width: "100%", height: 160 },
  adBody: { padding: 14 },
  adTitle: { color: THEME.text, fontWeight: "800", fontSize: 15, marginBottom: 4 },
  adContent: { color: THEME.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 12 },
  adCTA: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: THEME.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, alignSelf: "flex-start" },
  adCTATxt: { color: "#000", fontWeight: "900", fontSize: 12 },
  
  // Loading & empty states
  loadMoreIndicator: { paddingVertical: 20, alignItems: "center" },
  emptyState: { paddingVertical: 80, alignItems: "center" },
  emptyTitle: { color: THEME.text, fontSize: 18, fontWeight: "800", marginTop: 16 },
  emptySub: { color: THEME.textMuted, fontSize: 13, marginTop: 8, textAlign: "center", lineHeight: 20 },
  
  // Comments modal
  commentModal: { flex: 1, backgroundColor: THEME.bg },
  commentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: THEME.border },
  commentTitle: { color: THEME.text, fontSize: 22, fontWeight: "900" },
  commentCloseBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  emptyComments: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyCommentsTxt: { color: THEME.textMuted, fontSize: 16, fontWeight: "600" },
  commentItem: { flexDirection: "row", gap: 10, marginBottom: 12 },
  commentAvatar: { width: 36, height: 36, borderRadius: 12 },
  commentContent: { flex: 1, gap: 4 },
  commentBubble: { backgroundColor: THEME.ui2, borderRadius: 14, padding: 12 },
  commentName: { color: THEME.text, fontWeight: "800", fontSize: 13 },
  commentText: { color: THEME.text, fontSize: 13, lineHeight: 18 },
  commentTime: { color: THEME.textMuted, fontSize: 11, marginLeft: 8 },
  commentInputBar: { flexDirection: "row", gap: 10, alignItems: "flex-end", padding: 16, borderTopWidth: 1, borderTopColor: THEME.border },
  commentInputAvatar: { width: 32, height: 32, borderRadius: 11 },
  commentInputWrap: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui2, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderWidth: 1, borderColor: THEME.border },
  commentInput: { flex: 1, color: THEME.text, fontSize: 13, maxHeight: 80 },
  
  // Notifications modal
  notifModal: { flex: 1, backgroundColor: THEME.bg },
  notifHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: THEME.border },
  notifTitle: { color: THEME.text, fontSize: 22, fontWeight: "900" },
  notifCloseBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  notifLoader: { flex: 1, justifyContent: "center", alignItems: "center" },
  notifEmpty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  notifEmptyTxt: { color: THEME.textMuted, fontSize: 16, fontWeight: "600" },
  notifEmptySub: { color: THEME.textMuted, fontSize: 13, textAlign: "center", paddingHorizontal: 40 },
  notifItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: THEME.border },
  notifItemUnread: { backgroundColor: THEME.accentDim },
  notifIconCircle: { width: 40, height: 40, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  notifContent: { flex: 1 },
  notifItemTxt: { color: THEME.text, fontSize: 13, lineHeight: 18 },
  notifItemTime: { color: THEME.textMuted, fontSize: 11, marginTop: 3 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.accent },
});