import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Animated, Dimensions,
  Platform, StatusBar, Share,
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

const formatTime = (ts: any): string => {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60)     return "just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" });
};

// ── SIMPLE MARKDOWN RENDERER ─────────────────────────────────────────────
const renderBody = (text: string, styles: any) => {
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
    if (line.trim() === "") {
      return <View key={i} style={{ height: 12 }} />;
    }
    // Bold and italic inline
    const parts = line.split(/(\*\*.*?\*\*|_.*?_)/g);
    return (
      <Text key={i} style={styles.bodyParagraph}>
        {parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <Text key={j} style={styles.boldText}>
                {part.slice(2, -2)}
              </Text>
            );
          }
          if (part.startsWith("_") && part.endsWith("_")) {
            return (
              <Text key={j} style={styles.italicText}>
                {part.slice(1, -1)}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  });
};

export default function ArticleDetailScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const uid       = auth.currentUser?.uid;
  const scrollY   = useRef(new Animated.Value(0)).current;

  const [article,      setArticle]      = useState<any>(null);
  const [comments,     setComments]     = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [commentText,  setCommentText]  = useState("");
  const [posting,      setPosting]      = useState(false);
  const [liked,        setLiked]        = useState(false);
  const [showComments, setShowComments] = useState(false);

  // ── LOAD ARTICLE ──────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "feed", id), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setArticle(data);
        setLiked((data as any).likedBy?.includes(uid));
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
    } catch (e) { console.error(e); } finally { setPosting(false); }
  };

  // ── SHARE ─────────────────────────────────────────────────────────
  const handleShare = async () => {
    try {
      await Share.share({
        message: `${article?.title} — Read on Writha`,
      });
    } catch (e) { console.error(e); }
  };

  // ── HEADER OPACITY ────────────────────────────────────────────────
  const headerBg = scrollY.interpolate({
    inputRange:  [0, 200],
    outputRange: ["rgba(15,7,26,0)", "rgba(15,7,26,1)"],
    extrapolate: "clamp",
  });

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={THEME.accent} size="large" />
        <Text style={styles.loadingTxt}>Loading article...</Text>
      </View>
    );
  }

  if (!article) {
    return (
      <View style={styles.loadingScreen}>
        <MaterialCommunityIcons name="newspaper-remove" size={48} color={THEME.textMuted} />
        <Text style={styles.errorTxt}>Article not found</Text>
        <TouchableOpacity style={styles.backBtnLarge} onPress={() => router.back()}>
          <Text style={styles.backBtnLargeTxt}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* FLOATING HEADER */}
      <Animated.View style={[styles.floatingHeader, { backgroundColor: headerBg, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.floatingBack} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={THEME.text} />
        </TouchableOpacity>
        <Text style={styles.floatingTitle} numberOfLines={1}>
          {article.title}
        </Text>
        <TouchableOpacity style={styles.floatingShare} onPress={handleShare}>
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
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* HERO COVER */}
        {article.coverUrl ? (
          <View style={styles.heroWrap}>
            <Image
              source={{ uri: article.coverUrl }}
              style={styles.heroCover}
              resizeMode="cover"
            />
            <View style={styles.heroOverlay} />
          </View>
        ) : (
          <View style={styles.heroNoCover} />
        )}

        {/* ARTICLE CONTENT */}
        <View style={styles.content}>

          {/* Category + web badge */}
          <View style={styles.metaRow}>
            {article.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeTxt}>
                  {article.category.toUpperCase()}
                </Text>
              </View>
            )}
            {article.publishToWeb && (
              <View style={styles.webBadge}>
                <Ionicons name="globe-outline" size={10} color={THEME.blue} />
                <Text style={styles.webBadgeTxt}>WEB</Text>
              </View>
            )}
            <Text style={styles.readTimeTxt}>
              {article.readTime || 1} min read
            </Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{article.title}</Text>

          {/* Subtitle */}
          {article.subtitle ? (
            <Text style={styles.subtitle}>{article.subtitle}</Text>
          ) : null}

          {/* Author row */}
          <TouchableOpacity
            style={styles.authorRow}
            onPress={() => router.push(`/profile/${article.userId}` as any)}
            activeOpacity={0.8}
          >
            {article.userPhoto ? (
              <Image source={{ uri: article.userPhoto }} style={styles.authorAvatar} />
            ) : (
              <View style={[styles.authorAvatar, styles.authorAvatarFallback]}>
                <Text style={styles.authorAvatarTxt}>
                  {(article.userName || "W")[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.authorName}>{article.userName || "Scholar"}</Text>
              <Text style={styles.articleMeta}>
                {formatTime(article.createdAt)}
                {article.wordCount ? ` · ${article.wordCount} words` : ""}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* BODY */}
          <View style={styles.bodyWrap}>
            {renderBody(article.content, styles)}
          </View>

          {/* TAGS */}
          {article.tags?.length > 0 && (
            <View style={styles.tagsRow}>
              {article.tags.map((tag: string) => (
                <View key={tag} style={styles.tagPill}>
                  <Text style={styles.tagPillTxt}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.divider} />

          {/* ACTION BAR */}
          <View style={styles.actionBar}>
            <TouchableOpacity style={styles.actionBtn} onPress={toggleLike}>
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={22}
                color={liked ? THEME.red : THEME.textMuted}
              />
              <Text style={[styles.actionTxt, liked && { color: THEME.red }]}>
                {article.likesCount || 0}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setShowComments(!showComments)}
            >
              <Ionicons name="chatbubble-outline" size={21} color={THEME.textMuted} />
              <Text style={styles.actionTxt}>{article.commentsCount || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={21} color={THEME.accent} />
              <Text style={[styles.actionTxt, { color: THEME.accent }]}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.weaveBtn}
              onPress={() => router.push({
                pathname: "/weave/create",
                params: {
                  bookId:     article.id,
                  bookTitle:  article.title,
                  authorName: article.userName || "",
                },
              } as any)}
            >
              <MaterialCommunityIcons name="feather" size={15} color="#000" />
              <Text style={styles.weaveBtnTxt}>WEAVE</Text>
            </TouchableOpacity>
          </View>

          {/* COMMENTS SECTION */}
          {showComments && (
            <View style={styles.commentsSection}>
              <Text style={styles.commentsSectionTitle}>
                COMMENTS ({comments.length})
              </Text>

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
                <View style={styles.commentInputWrap}>
                  <TextInputComment
                    value={commentText}
                    onChange={setCommentText}
                    onSubmit={postComment}
                    posting={posting}
                  />
                </View>
              </View>

              {/* Comments list */}
              {comments.length === 0 ? (
                <View style={styles.noComments}>
                  <Ionicons name="chatbubbles-outline" size={32} color={THEME.textMuted} />
                  <Text style={styles.noCommentsTxt}>
                    Be the first to comment
                  </Text>
                </View>
              ) : (
                comments.map((c) => (
                  <View key={c.id} style={styles.commentCard}>
                    {c.userPhoto ? (
                      <Image source={{ uri: c.userPhoto }} style={styles.commentCardAvatar} />
                    ) : (
                      <View style={[styles.commentCardAvatar, styles.commentAvatarFallback]}>
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

// ── COMMENT INPUT ─────────────────────────────────────────────────────────
import { TextInput } from "react-native";

const TextInputComment = ({
  value, onChange, onSubmit, posting,
}: {
  value: string;
  onChange: (t: string) => void;
  onSubmit: () => void;
  posting: boolean;
}) => (
  <View style={styles.commentInputInner}>
    <TextInput
      style={styles.commentInput}
      placeholder="Write a comment..."
      placeholderTextColor={THEME.textMuted}
      value={value}
      onChangeText={onChange}
      multiline
      maxLength={500}
    />
    {value.trim().length > 0 && (
      <TouchableOpacity onPress={onSubmit} disabled={posting}>
        {posting
          ? <ActivityIndicator size="small" color={THEME.accent} />
          : <Ionicons name="send" size={18} color={THEME.accent} />
        }
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: THEME.bg },
  loadingScreen:          { flex: 1, backgroundColor: THEME.bg, justifyContent: "center", alignItems: "center", gap: 16 },
  loadingTxt:             { color: THEME.textMuted, fontSize: 14 },
  errorTxt:               { color: THEME.text, fontSize: 16, fontWeight: "700" },
  backBtnLarge:           { marginTop: 16, backgroundColor: THEME.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  backBtnLargeTxt:        { color: "#000", fontWeight: "900", fontSize: 14 },

  // Floating header
  floatingHeader:         { position: "absolute", top: 0, left: 0, right: 0, zIndex: 100, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12 },
  floatingBack:           { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  floatingTitle:          { flex: 1, color: THEME.text, fontWeight: "800", fontSize: 14, marginHorizontal: 12 },
  floatingShare:          { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },

  // Hero
  heroWrap:               { width, height: 280, position: "relative" },
  heroCover:              { width: "100%", height: "100%" },
  heroOverlay:            { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,7,26,0.4)" },
  heroNoCover:            { width, height: 120, backgroundColor: THEME.ui },

  // Content
  content:                { paddingHorizontal: 20, paddingTop: 24 },
  metaRow:                { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  categoryBadge:          { backgroundColor: THEME.accentDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: THEME.accent + "30" },
  categoryBadgeTxt:       { color: THEME.accent, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  webBadge:               { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: THEME.blue + "20", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  webBadgeTxt:            { color: THEME.blue, fontSize: 9, fontWeight: "900" },
  readTimeTxt:            { color: THEME.textMuted, fontSize: 11 },
  title:                  { color: THEME.text, fontSize: 28, fontWeight: "900", lineHeight: 36, marginBottom: 12 },
  subtitle:               { color: THEME.textMuted, fontSize: 16, lineHeight: 24, marginBottom: 20 },
  authorRow:              { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  authorAvatar:           { width: 44, height: 44, borderRadius: 14 },
  authorAvatarFallback:   { backgroundColor: THEME.purple, justifyContent: "center", alignItems: "center" },
  authorAvatarTxt:        { color: THEME.accent, fontWeight: "900", fontSize: 16 },
  authorName:             { color: THEME.text, fontWeight: "800", fontSize: 15 },
  articleMeta:            { color: THEME.textMuted, fontSize: 12, marginTop: 2 },
  divider:                { height: 1, backgroundColor: THEME.border, marginVertical: 24 },

  // Body
  bodyWrap:               { marginBottom: 24 },
  bodyParagraph:          { color: THEME.text, fontSize: 16, lineHeight: 28, marginBottom: 4 },
  bodyHeading:            { color: THEME.text, fontSize: 22, fontWeight: "900", lineHeight: 30, marginTop: 24, marginBottom: 12 },
  blockquoteWrap:         { flexDirection: "row", gap: 12, marginVertical: 12, paddingVertical: 4 },
  blockquoteLine:         { width: 3, backgroundColor: THEME.accent, borderRadius: 2 },
  blockquoteText:         { color: THEME.textMuted, fontSize: 16, lineHeight: 26, fontStyle: "italic", flex: 1 },
  bulletRow:              { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 6 },
  bulletDot:              { width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.accent, marginTop: 10 },
  bulletText:             { color: THEME.text, fontSize: 16, lineHeight: 26, flex: 1 },
  boldText:               { fontWeight: "900", color: THEME.text },
  italicText:             { fontStyle: "italic", color: THEME.textMuted },

  // Tags
  tagsRow:                { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  tagPill:                { backgroundColor: THEME.ui, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: THEME.border },
  tagPillTxt:             { color: THEME.textMuted, fontSize: 12 },

  // Action bar
  actionBar:              { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  actionBtn:              { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: THEME.ui },
  actionTxt:              { color: THEME.textMuted, fontSize: 13, fontWeight: "700" },
  weaveBtn:               { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: THEME.accent, marginLeft: "auto" },
  weaveBtnTxt:            { color: "#000", fontWeight: "900", fontSize: 11, letterSpacing: 1 },

  // Comments
  commentsSection:        { marginTop: 32 },
  commentsSectionTitle:   { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 16 },
  commentInputRow:        { flexDirection: "row", gap: 10, marginBottom: 20, alignItems: "flex-end" },
  commentAvatar:          { width: 36, height: 36, borderRadius: 11 },
  commentAvatarFallback:  { backgroundColor: THEME.purple, justifyContent: "center", alignItems: "center" },
  commentAvatarTxt:       { color: THEME.accent, fontWeight: "900", fontSize: 13 },
  commentInputWrap:       { flex: 1 },
  commentInputInner:      { flexDirection: "row", alignItems: "flex-end", backgroundColor: THEME.ui, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, gap: 8, borderWidth: 1, borderColor: THEME.border },
  commentInput:           { flex: 1, color: THEME.text, fontSize: 14, maxHeight: 100 },
  noComments:             { alignItems: "center", paddingVertical: 32, gap: 10 },
  noCommentsTxt:          { color: THEME.textMuted, fontSize: 14 },
  commentCard:            { flexDirection: "row", gap: 10, marginBottom: 16 },
  commentCardAvatar:      { width: 36, height: 36, borderRadius: 11, flexShrink: 0 },
  commentCardBody:        { flex: 1, backgroundColor: THEME.ui, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: THEME.border },
  commentCardHeader:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  commentCardName:        { color: THEME.text, fontWeight: "800", fontSize: 13 },
  commentCardTime:        { color: THEME.textMuted, fontSize: 11 },
  commentCardTxt:         { color: THEME.text, fontSize: 14, lineHeight: 20 },
});