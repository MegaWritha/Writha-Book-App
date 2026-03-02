import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Animated, Dimensions,
  Platform, StatusBar, Share, TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { db, auth } from "@/lib/firebase";
import {
  doc, onSnapshot, collection, query, orderBy,
  addDoc, updateDoc, serverTimestamp, increment,
  arrayUnion, arrayRemove,
} from "firebase/firestore";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const THEME = {
  bg:          "#0F071A",
  ui:          "#1E1135",
  ui2:         "#2D1B4D",
  ui3:         "#3D2660",
  accent:      "#FFD700",
  accentDim:   "rgba(255,215,0,0.1)",
  purple:      "#6D28D9",
  purpleLight: "#A78BFA",
  text:        "#E2E8F0",
  textMuted:   "#94A3B8",
  green:       "#22C55E",
  red:         "#EF4444",
  blue:        "#38BDF8",
  border:      "#2D1B4D",
};

const REACTIONS = ["❤️", "🔥", "🤯", "👏", "💡", "😂"];

const formatTime = (ts: any): string => {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60)     return "just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString("en-NG", {
    month: "short", day: "numeric", year: "numeric",
  });
};

// ── MARKDOWN RENDERER ─────────────────────────────────────────────────────
const renderBody = (text: string) => {
  if (!text) return null;
  return text.split("\n").map((line, i) => {
    if (line.startsWith("## ")) {
      return (
        <Text key={i} style={styles.bodyHeading}>
          {line.replace("## ", "")}
        </Text>
      );
    }
    if (line.startsWith("> ")) {
      return (
        <View key={i} style={styles.blockquoteWrap}>
          <View style={styles.blockquoteLine} />
          <Text style={styles.blockquoteText}>{line.replace("> ", "")}</Text>
        </View>
      );
    }
    if (line.startsWith("• ")) {
      return (
        <View key={i} style={styles.bulletRow}>
          <View style={styles.bulletDot} />
          <Text style={styles.bulletText}>{line.replace("• ", "")}</Text>
        </View>
      );
    }
    if (line.trim() === "") return <View key={i} style={{ height: 12 }} />;

    const parts = line.split(/(\*\*.*?\*\*|_.*?_)/g);
    return (
      <Text key={i} style={styles.bodyParagraph}>
        {parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**"))
            return <Text key={j} style={styles.boldText}>{part.slice(2, -2)}</Text>;
          if (part.startsWith("_") && part.endsWith("_"))
            return <Text key={j} style={styles.italicText}>{part.slice(1, -1)}</Text>;
          return part;
        })}
      </Text>
    );
  });
};

// ── REACTION STRIP ────────────────────────────────────────────────────────
const ReactionStrip = ({
  postId, uid, reactions,
}: {
  postId: string; uid: string; reactions: Record<string, string[]>;
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const openPicker = () => {
    setPickerOpen(true);
    Animated.spring(scaleAnim, {
      toValue: 1, useNativeDriver: true, friction: 6,
    }).start();
  };

  const react = async (emoji: string) => {
    setPickerOpen(false);
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
    .slice(0, 4);

  return (
    <View style={styles.reactionWrap}>
      {topReactions.map(([emoji, users]) => (
        <TouchableOpacity
          key={emoji}
          style={[
            styles.reactionPill,
            users.includes(uid) && styles.reactionPillActive,
          ]}
          onPress={() => react(emoji)}
        >
          <Text style={styles.reactionEmoji}>{emoji}</Text>
          <Text style={styles.reactionCount}>{users.length}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.reactionAddBtn} onPress={openPicker}>
        <Text style={styles.reactionAddTxt}>+</Text>
      </TouchableOpacity>
      {pickerOpen && (
        <Animated.View style={[
          styles.reactionPicker,
          { transform: [{ scale: scaleAnim }] },
        ]}>
          {REACTIONS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.reactionPickerBtn}
              onPress={() => react(emoji)}
            >
              <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}
    </View>
  );
};

export default function DiscussionDetailScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const uid     = auth.currentUser?.uid || "";
  const scrollY = useRef(new Animated.Value(0)).current;

  const [post,        setPost]        = useState<any>(null);
  const [comments,    setComments]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [commentText, setCommentText] = useState("");
  const [posting,     setPosting]     = useState(false);
  const [liked,       setLiked]       = useState(false);
  const [activeTab,   setActiveTab]   = useState<"post" | "comments">("post");
  const [bookmarked,  setBookmarked]  = useState(false);

  // ── LOAD POST ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "feed", id), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as any;
        setPost(data);
        setLiked(data.likedBy?.includes(uid));
      }
      setLoading(false);
    });
    return () => unsub();
  }, [id, uid]);

  // ── LOAD COMMENTS ─────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, "feed", id, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [id]);

  // ── LIKE ──────────────────────────────────────────────────────────
  const toggleLike = async () => {
    if (!uid || !id) return;
    try {
      setLiked(!liked);
      await updateDoc(doc(db, "feed", id), {
        likedBy:    liked ? arrayRemove(uid) : arrayUnion(uid),
        likesCount: increment(liked ? -1 : 1),
      });
    } catch (e) { console.error(e); }
  };

  // ── BOOKMARK ──────────────────────────────────────────────────────
  const toggleBookmark = async () => {
    setBookmarked(!bookmarked);
    try {
      await updateDoc(doc(db, "users", uid, "bookmarks", id!), {
        postId:  id,
        savedAt: serverTimestamp(),
      });
    } catch (e) { console.error(e); }
  };

  // ── POST COMMENT ──────────────────────────────────────────────────
  const postComment = async () => {
    if (!commentText.trim() || !uid || !id) return;
    setPosting(true);
    try {
      await addDoc(collection(db, "feed", id, "comments"), {
        content:   commentText.trim(),
        userId:    uid,
        userName:  auth.currentUser?.displayName || "Scholar",
        userPhoto: auth.currentUser?.photoURL    || "",
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "feed", id), {
        commentsCount: increment(1),
      });
      setCommentText("");
      // Switch to comments tab after posting
      setActiveTab("comments");
    } catch (e) { console.error(e); } finally { setPosting(false); }
  };

  // ── SHARE ─────────────────────────────────────────────────────────
  const handleShare = async () => {
    const url   = `https://writha-book-app.vercel.app/discussion/${id}`;
    const title = post?.title || post?.content?.slice(0, 60) || "Discussion on Writha";

    if (Platform.OS === "web") {
      if (navigator.share) {
        try { await navigator.share({ title, url }); } catch (_) {}
      } else {
        await navigator.clipboard.writeText(url);
        window.alert("Link copied to clipboard!");
      }
      return;
    }
    try {
      await Share.share({
        title,
        message: Platform.OS === "android" ? `${title}\n${url}` : title,
        url,
      });
    } catch (e) { console.error(e); }
  };

  const headerBg = scrollY.interpolate({
    inputRange:  [0, 120],
    outputRange: ["rgba(15,7,26,0)", "rgba(15,7,26,1)"],
    extrapolate: "clamp",
  });

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={THEME.purpleLight} size="large" />
        <Text style={styles.loadingTxt}>Loading discussion...</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.loadingScreen}>
        <MaterialCommunityIcons
          name="chat-remove-outline"
          size={48}
          color={THEME.textMuted}
        />
        <Text style={styles.errorTxt}>Discussion not found</Text>
        <TouchableOpacity
          style={styles.backBtnLarge}
          onPress={() => router.back()}
        >
          <Text style={styles.backBtnLargeTxt}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const authorName  = post.userName   || post.authorName  || "Scholar";
  const authorPhoto = post.userPhoto  || post.authorPhoto || "";
  const authorId    = post.userId     || post.authorId    || "";
  const isOwner     = uid === authorId;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* FLOATING HEADER */}
      <Animated.View style={[
        styles.floatingHeader,
        { backgroundColor: headerBg, paddingTop: insets.top + 8 },
      ]}>
        <TouchableOpacity
          style={styles.floatingBtn}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={THEME.text} />
        </TouchableOpacity>

        <Text style={styles.floatingTitle} numberOfLines={1}>
          {post.title || "Discussion"}
        </Text>

        <TouchableOpacity style={styles.floatingBtn} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={22} color={THEME.text} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* HERO BAND */}
        <View style={[styles.heroBand, { paddingTop: insets.top + 64 }]}>
          <View style={styles.discussionIconCircle}>
            <MaterialCommunityIcons
              name="forum-outline"
              size={32}
              color={THEME.purpleLight}
            />
          </View>
          <View style={styles.typeBadge}>
            <Ionicons name="chatbubbles" size={11} color={THEME.purpleLight} />
            <Text style={styles.typeBadgeTxt}>DISCUSSION</Text>
          </View>
          {post.title && (
            <Text style={styles.heroTitle}>{post.title}</Text>
          )}
        </View>

        {/* CONTENT AREA */}
        <View style={styles.content}>

          {/* AUTHOR ROW */}
          <TouchableOpacity
            style={styles.authorRow}
            onPress={() => router.push(`/profile/${authorId}` as any)}
            activeOpacity={0.8}
          >
            {authorPhoto ? (
              <Image source={{ uri: authorPhoto }} style={styles.authorAvatar} />
            ) : (
              <View style={[styles.authorAvatar, styles.authorAvatarFallback]}>
                <Text style={styles.authorAvatarTxt}>
                  {authorName[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.authorNameRow}>
                <Text style={styles.authorName}>{authorName}</Text>
                {post.isAuthor && (
                  <MaterialCommunityIcons
                    name="check-decagram"
                    size={14}
                    color={THEME.accent}
                    style={{ marginLeft: 4 }}
                  />
                )}
              </View>
              <Text style={styles.authorMeta}>
                {post.userHandle ? `@${post.userHandle} · ` : ""}
                {formatTime(post.createdAt)}
              </Text>
            </View>
            {post.isPinned && (
              <View style={styles.pinnedBadge}>
                <Ionicons name="pin" size={11} color={THEME.accent} />
                <Text style={styles.pinnedTxt}>PINNED</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* TABS */}
          <View style={styles.tabsRow}>
            {[
              { key: "post",     label: "Post",     icon: "chatbubble-outline"  },
              { key: "comments", label: "Comments", icon: "chatbubbles-outline" },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => setActiveTab(tab.key as any)}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={14}
                  color={activeTab === tab.key ? "#000" : THEME.textMuted}
                />
                <Text style={[
                  styles.tabTxt,
                  activeTab === tab.key && styles.tabTxtActive,
                ]}>
                  {tab.label}
                  {tab.key === "comments" && comments.length > 0
                    ? ` (${comments.length})` : ""}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── POST TAB ── */}
          {activeTab === "post" && (
            <View>
              {/* Cover image if present */}
              {(post.coverUrl || post.image) && (
                <Image
                  source={{ uri: post.coverUrl || post.image }}
                  style={styles.coverImage}
                  resizeMode="cover"
                />
              )}

              {/* Mood tag */}
              {post.mood && (
                <View style={styles.moodTag}>
                  <Text style={styles.moodTagTxt}>{post.mood}</Text>
                </View>
              )}

              {/* Body content */}
              <View style={styles.bodyWrap}>
                {post.content
                  ? renderBody(post.content)
                  : (
                    <Text style={styles.noBodyTxt}>
                      No content available for this post.
                    </Text>
                  )
                }
              </View>

              {/* Tags */}
              {post.tags?.length > 0 && (
                <View style={styles.tagsRow}>
                  {post.tags.map((tag: string) => (
                    <View key={tag} style={styles.tagPill}>
                      <Text style={styles.tagPillTxt}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.divider} />

              {/* REACTIONS */}
              <ReactionStrip
                postId={id!}
                uid={uid}
                reactions={post.reactions || {}}
              />

              {/* ACTION BAR */}
              <View style={styles.actionBar}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={toggleLike}
                >
                  <Ionicons
                    name={liked ? "heart" : "heart-outline"}
                    size={22}
                    color={liked ? THEME.red : THEME.textMuted}
                  />
                  <Text style={[
                    styles.actionTxt,
                    liked && { color: THEME.red },
                  ]}>
                    {post.likesCount || 0}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => setActiveTab("comments")}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={20}
                    color={THEME.textMuted}
                  />
                  <Text style={styles.actionTxt}>
                    {post.commentsCount || 0}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={handleShare}
                >
                  <Ionicons
                    name="share-social-outline"
                    size={20}
                    color={THEME.accent}
                  />
                  <Text style={[styles.actionTxt, { color: THEME.accent }]}>
                    Share
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={toggleBookmark}
                >
                  <Ionicons
                    name={bookmarked ? "bookmark" : "bookmark-outline"}
                    size={20}
                    color={bookmarked ? THEME.accent : THEME.textMuted}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.weaveBtn}
                  onPress={() => router.push({
                    pathname: "/weave/create",
                    params: {
                      bookId:     post.bookId || post.id,
                      bookTitle:  post.title  || "Discussion",
                      authorName: authorName,
                    },
                  } as any)}
                >
                  <MaterialCommunityIcons
                    name="feather"
                    size={14}
                    color="#000"
                  />
                  <Text style={styles.weaveBtnTxt}>WEAVE</Text>
                </TouchableOpacity>
              </View>

              {/* QUICK COMMENT INPUT */}
              <View style={styles.quickCommentWrap}>
                <Text style={styles.quickCommentLabel}>ADD A COMMENT</Text>
                <View style={styles.quickCommentRow}>
                  {auth.currentUser?.photoURL ? (
                    <Image
                      source={{ uri: auth.currentUser.photoURL }}
                      style={styles.commentAvatar}
                    />
                  ) : (
                    <View style={[styles.commentAvatar, styles.commentAvatarFallback]}>
                      <Text style={styles.commentAvatarTxt}>
                        {(auth.currentUser?.displayName || "W")[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.commentInputInner}>
                    <TextInput
                      style={styles.commentInput}
                      placeholder="Share your thoughts..."
                      placeholderTextColor={THEME.textMuted}
                      value={commentText}
                      onChangeText={setCommentText}
                      multiline
                      maxLength={500}
                    />
                    {commentText.trim().length > 0 && (
                      <TouchableOpacity
                        onPress={postComment}
                        disabled={posting}
                      >
                        {posting
                          ? <ActivityIndicator size="small" color={THEME.accent} />
                          : <Ionicons name="send" size={18} color={THEME.accent} />
                        }
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ── COMMENTS TAB ── */}
          {activeTab === "comments" && (
            <View style={styles.commentsSection}>

              {/* Comment input */}
              <View style={styles.commentInputRow}>
                {auth.currentUser?.photoURL ? (
                  <Image
                    source={{ uri: auth.currentUser.photoURL }}
                    style={styles.commentAvatar}
                  />
                ) : (
                  <View style={[styles.commentAvatar, styles.commentAvatarFallback]}>
                    <Text style={styles.commentAvatarTxt}>
                      {(auth.currentUser?.displayName || "W")[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.commentInputInner}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Write a comment..."
                    placeholderTextColor={THEME.textMuted}
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                    maxLength={500}
                    autoFocus
                  />
                  {commentText.trim().length > 0 && (
                    <TouchableOpacity
                      onPress={postComment}
                      disabled={posting}
                    >
                      {posting
                        ? <ActivityIndicator size="small" color={THEME.accent} />
                        : <Ionicons name="send" size={18} color={THEME.accent} />
                      }
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Comments list */}
              {comments.length === 0 ? (
                <View style={styles.noComments}>
                  <MaterialCommunityIcons
                    name="chat-outline"
                    size={48}
                    color={THEME.textMuted}
                  />
                  <Text style={styles.noCommentsTxt}>No comments yet</Text>
                  <Text style={styles.noCommentsSubTxt}>
                    Start the conversation
                  </Text>
                </View>
              ) : (
                comments.map((c) => (
                  <View key={c.id} style={styles.commentCard}>
                    {c.userPhoto ? (
                      <Image
                        source={{ uri: c.userPhoto }}
                        style={styles.commentCardAvatar}
                      />
                    ) : (
                      <View style={[
                        styles.commentCardAvatar,
                        styles.commentAvatarFallback,
                      ]}>
                        <Text style={styles.commentAvatarTxt}>
                          {(c.userName || "W")[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.commentCardBody}>
                      <View style={styles.commentCardHeader}>
                        <Text style={styles.commentCardName}>
                          {c.userName || "Scholar"}
                        </Text>
                        <Text style={styles.commentCardTime}>
                          {formatTime(c.createdAt)}
                        </Text>
                      </View>
                      <Text style={styles.commentCardTxt}>{c.content}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: THEME.bg },
  loadingScreen:          { flex: 1, backgroundColor: THEME.bg, justifyContent: "center", alignItems: "center", gap: 16 },
  loadingTxt:             { color: THEME.textMuted, fontSize: 14 },
  errorTxt:               { color: THEME.text, fontSize: 16, fontWeight: "700" },
  backBtnLarge:           { marginTop: 16, backgroundColor: THEME.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  backBtnLargeTxt:        { color: "#000", fontWeight: "900", fontSize: 14 },

  // Floating header
  floatingHeader:         { position: "absolute", top: 0, left: 0, right: 0, zIndex: 100, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12 },
  floatingBtn:            { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  floatingTitle:          { flex: 1, color: THEME.text, fontWeight: "800", fontSize: 14, marginHorizontal: 12 },

  // Hero
  heroBand:               { backgroundColor: THEME.ui, paddingHorizontal: 24, paddingBottom: 28, alignItems: "center", borderBottomWidth: 1, borderBottomColor: THEME.border },
  discussionIconCircle:   { width: 64, height: 64, borderRadius: 20, backgroundColor: THEME.purpleLight + "15", justifyContent: "center", alignItems: "center", marginBottom: 14, borderWidth: 1, borderColor: THEME.purpleLight + "30" },
  typeBadge:              { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: THEME.purpleLight + "15", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: THEME.purpleLight + "30" },
  typeBadgeTxt:           { color: THEME.purpleLight, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  heroTitle:              { color: THEME.text, fontSize: 22, fontWeight: "900", lineHeight: 30, textAlign: "center" },

  // Content
  content:                { paddingHorizontal: 20, paddingTop: 20 },
  authorRow:              { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  authorAvatar:           { width: 44, height: 44, borderRadius: 14 },
  authorAvatarFallback:   { backgroundColor: THEME.purple, justifyContent: "center", alignItems: "center" },
  authorAvatarTxt:        { color: THEME.accent, fontWeight: "900", fontSize: 16 },
  authorNameRow:          { flexDirection: "row", alignItems: "center" },
  authorName:             { color: THEME.text, fontWeight: "800", fontSize: 15 },
  authorMeta:             { color: THEME.textMuted, fontSize: 12, marginTop: 2 },
  pinnedBadge:            { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: THEME.accentDim, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  pinnedTxt:              { color: THEME.accent, fontSize: 9, fontWeight: "900" },
  divider:                { height: 1, backgroundColor: THEME.border, marginVertical: 16 },

  // Tabs
  tabsRow:                { flexDirection: "row", backgroundColor: THEME.ui, borderRadius: 14, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: THEME.border },
  tab:                    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 11 },
  tabActive:              { backgroundColor: THEME.accent },
  tabTxt:                 { color: THEME.textMuted, fontWeight: "700", fontSize: 13 },
  tabTxtActive:           { color: "#000", fontWeight: "900" },

  // Body
  coverImage:             { width: "100%", height: 200, borderRadius: 18, marginBottom: 16 },
  moodTag:                { backgroundColor: THEME.ui2, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, alignSelf: "flex-start", marginBottom: 14 },
  moodTagTxt:             { color: THEME.purpleLight, fontSize: 12, fontWeight: "700" },
  bodyWrap:               { marginBottom: 20 },
  bodyParagraph:          { color: THEME.text, fontSize: 16, lineHeight: 28, marginBottom: 6 },
  bodyHeading:            { color: THEME.text, fontSize: 20, fontWeight: "900", lineHeight: 28, marginTop: 24, marginBottom: 12 },
  blockquoteWrap:         { flexDirection: "row", gap: 12, marginVertical: 12 },
  blockquoteLine:         { width: 3, backgroundColor: THEME.purpleLight, borderRadius: 2 },
  blockquoteText:         { color: THEME.textMuted, fontSize: 16, lineHeight: 26, fontStyle: "italic", flex: 1 },
  bulletRow:              { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 8 },
  bulletDot:              { width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.purpleLight, marginTop: 10 },
  bulletText:             { color: THEME.text, fontSize: 16, lineHeight: 26, flex: 1 },
  boldText:               { fontWeight: "900", color: THEME.text },
  italicText:             { fontStyle: "italic", color: THEME.textMuted },
  noBodyTxt:              { color: THEME.textMuted, fontSize: 14, fontStyle: "italic", textAlign: "center", paddingVertical: 32 },
  tagsRow:                { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  tagPill:                { backgroundColor: THEME.ui, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: THEME.border },
  tagPillTxt:             { color: THEME.textMuted, fontSize: 12 },

  // Reactions
  reactionWrap:           { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14, position: "relative" },
  reactionPill:           { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: THEME.ui2, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: THEME.border },
  reactionPillActive:     { borderColor: THEME.accent, backgroundColor: THEME.accentDim },
  reactionEmoji:          { fontSize: 13 },
  reactionCount:          { color: THEME.textMuted, fontSize: 11, fontWeight: "700" },
  reactionAddBtn:         { width: 32, height: 28, borderRadius: 10, backgroundColor: THEME.ui2, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: THEME.border },
  reactionAddTxt:         { color: THEME.textMuted, fontSize: 18, fontWeight: "900", marginTop: -2 },
  reactionPicker:         { position: "absolute", bottom: 38, left: 0, flexDirection: "row", gap: 4, backgroundColor: THEME.ui3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: THEME.border, zIndex: 100 },
  reactionPickerBtn:      { padding: 4 },
  reactionPickerEmoji:    { fontSize: 22 },

  // Actions
  actionBar:              { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap", marginBottom: 24 },
  actionBtn:              { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: THEME.ui },
  actionTxt:              { color: THEME.textMuted, fontSize: 13, fontWeight: "700" },
  weaveBtn:               { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: THEME.accent, marginLeft: "auto" },
  weaveBtnTxt:            { color: "#000", fontWeight: "900", fontSize: 11, letterSpacing: 1 },

  // Quick comment on post tab
  quickCommentWrap:       { marginTop: 8 },
  quickCommentLabel:      { color: THEME.accent, fontSize: 9, fontWeight: "900", letterSpacing: 2, marginBottom: 12 },
  quickCommentRow:        { flexDirection: "row", gap: 10, alignItems: "flex-end" },

  // Comments shared
  commentInputRow:        { flexDirection: "row", gap: 10, marginBottom: 24, alignItems: "flex-end" },
  commentAvatar:          { width: 36, height: 36, borderRadius: 11 },
  commentAvatarFallback:  { backgroundColor: THEME.purple, justifyContent: "center", alignItems: "center" },
  commentAvatarTxt:       { color: THEME.accent, fontWeight: "900", fontSize: 13 },
  commentInputInner:      { flex: 1, flexDirection: "row", alignItems: "flex-end", backgroundColor: THEME.ui, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, gap: 8, borderWidth: 1, borderColor: THEME.border },
  commentInput:           { flex: 1, color: THEME.text, fontSize: 14, maxHeight: 100 },

  // Comments section
  commentsSection:        { paddingTop: 4 },
  noComments:             { alignItems: "center", paddingVertical: 48, gap: 10 },
  noCommentsTxt:          { color: THEME.text, fontSize: 15, fontWeight: "700" },
  noCommentsSubTxt:       { color: THEME.textMuted, fontSize: 13 },
  commentCard:            { flexDirection: "row", gap: 10, marginBottom: 16 },
  commentCardAvatar:      { width: 36, height: 36, borderRadius: 11, flexShrink: 0 },
  commentCardBody:        { flex: 1, backgroundColor: THEME.ui, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: THEME.border },
  commentCardHeader:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  commentCardName:        { color: THEME.text, fontWeight: "800", fontSize: 13 },
  commentCardTime:        { color: THEME.textMuted, fontSize: 11 },
  commentCardTxt:         { color: THEME.text, fontSize: 14, lineHeight: 20 },
});