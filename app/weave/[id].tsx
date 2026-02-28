import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, StatusBar, ActivityIndicator,
  Platform, Alert, Dimensions, Image, KeyboardAvoidingView,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "@/lib/firebase";
import {
  doc, getDoc, onSnapshot, collection, addDoc,
  updateDoc, increment, serverTimestamp, query,
  orderBy, deleteDoc, arrayUnion, arrayRemove,
  where, getDocs, limit,
} from "firebase/firestore";

const { width } = Dimensions.get("window");

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
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) buttons.find((b) => b.style !== "cancel")?.onPress?.();
    }
  } else {
    Alert.alert(title, message, buttons as any);
  }
};

// ── THEMES ───────────────────────────────────────────────────────────────
const DARK_THEME = {
  mode:        "dark"  as const,
  bg:          "#080410",
  ui:          "#100820",
  ui2:         "#1A0E30",
  ui3:         "#251645",
  accent:      "#FFD700",
  accentDim:   "rgba(255,215,0,0.08)",
  purple:      "#6D28D9",
  purpleLight: "#A78BFA",
  text:        "#EDE8F5",
  textMuted:   "#6B6080",
  green:       "#22C55E",
  red:         "#EF4444",
  blue:        "#38BDF8",
  orange:      "#F97316",
  statusBar:   "light-content" as const,
};

const LIGHT_THEME = {
  mode:        "light" as const,
  bg:          "#FAF8FF",
  ui:          "#F0EBF8",
  ui2:         "#E2D9F3",
  ui3:         "#C9BBDF",
  accent:      "#6D28D9",
  accentDim:   "rgba(109,40,217,0.08)",
  purple:      "#6D28D9",
  purpleLight: "#A78BFA",
  text:        "#1A0E30",
  textMuted:   "#6B6080",
  green:       "#16A34A",
  red:         "#DC2626",
  blue:        "#0284C7",
  orange:      "#EA580C",
  statusBar:   "dark-content" as const,
};

// ── TYPE CONFIGS ─────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  Analysis:   { color: "#38BDF8", icon: "microscope",       label: "Analysis"   },
  Critique:   { color: "#FFD700", icon: "star-half-full",   label: "Critique"   },
  Research:   { color: "#A78BFA", icon: "book-search",      label: "Research"   },
  Memory:     { color: "#F97316", icon: "heart-outline",    label: "Memory"     },
  Legacy:     { color: "#22C55E", icon: "trophy-outline",   label: "Legacy"     },
  Discussion: { color: "#6D28D9", icon: "forum-outline",    label: "Discussion" },
};

interface Comment {
  id:         string;
  content:    string;
  userId:     string;
  userName:   string;
  userPhoto?: string;
  createdAt:  any;
  likesCount: number;
  likedBy:    string[];
  replyTo?:   string;
  replyToName?: string;
  isEdited?:  boolean;
}

export default function WeaveDetail() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const user    = auth.currentUser;

  // ── THEME ────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(true);
  const T = isDark ? DARK_THEME : LIGHT_THEME;
  const s = makeStyles(T);

  // ── STATE ────────────────────────────────────────────────────────
  const [weave,          setWeave]          = useState<any>(null);
  const [comments,       setComments]       = useState<Comment[]>([]);
  const [relatedWeaves,  setRelatedWeaves]  = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [commentText,    setCommentText]    = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [replyTo,        setReplyTo]        = useState<Comment | null>(null);
  const [liked,          setLiked]          = useState(false);
  const [likeCount,      setLikeCount]      = useState(0);
  const [showFullContent, setShowFullContent] = useState(false);

  const scrollRef     = useRef<ScrollView>(null);
  const commentInputRef = useRef<TextInput>(null);

  // ── LOAD WEAVE ───────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    const unsub = onSnapshot(doc(db, "weaves", id), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as any;
        setWeave(data);
        setLikeCount(data.likesCount || 0);
        setLiked((data.likedBy || []).includes(user?.uid));
      }
      setLoading(false);
    });

    return () => unsub();
  }, [id]);

  // ── LOAD COMMENTS ────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    const unsub = onSnapshot(
      query(
        collection(db, "weaves", id, "comments"),
        orderBy("createdAt", "asc")
      ),
      (snap) => {
        setComments(
          snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Comment[]
        );
      },
      () => {}
    );

    return () => unsub();
  }, [id]);

  // ── LOAD RELATED WEAVES ──────────────────────────────────────────
  useEffect(() => {
    if (!weave) return;

    const loadRelated = async () => {
      try {
        const q = weave.bookId
          ? query(
              collection(db, "weaves"),
              where("bookId", "==", weave.bookId),
              limit(4)
            )
          : query(
              collection(db, "weaves"),
              where("bookTitle", "==", weave.bookTitle),
              limit(4)
            );

        const snap = await getDocs(q);
        const related = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((w: any) => w.id !== id);
        setRelatedWeaves(related.slice(0, 3));
      } catch {}
    };

    loadRelated();
  }, [weave]);

  // ── LIKE WEAVE ───────────────────────────────────────────────────
  const handleLike = async () => {
    if (!user || !id) return;
    try {
      const ref = doc(db, "weaves", id);
      if (liked) {
        await updateDoc(ref, {
          likesCount: increment(-1),
          likedBy:    arrayRemove(user.uid),
        });
        setLiked(false);
        setLikeCount((c) => c - 1);
      } else {
        await updateDoc(ref, {
          likesCount: increment(1),
          likedBy:    arrayUnion(user.uid),
        });
        setLiked(true);
        setLikeCount((c) => c + 1);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ── POST COMMENT ─────────────────────────────────────────────────
  const handlePostComment = async () => {
    if (!commentText.trim() || !user || !id) return;
    setPostingComment(true);

    try {
      await addDoc(collection(db, "weaves", id, "comments"), {
        content:     commentText.trim(),
        userId:      user.uid,
        userName:    user.displayName || "Writha Member",
        userPhoto:   user.photoURL    || null,
        replyTo:     replyTo?.id      || null,
        replyToName: replyTo?.userName || null,
        likesCount:  0,
        likedBy:     [],
        createdAt:   serverTimestamp(),
      });

      // Increment comment count on weave
      await updateDoc(doc(db, "weaves", id), {
        commentsCount: increment(1),
      });

      setCommentText("");
      setReplyTo(null);

      // Scroll to bottom
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 300);

    } catch (e: any) {
      showAlert("Error", e.message, [{ text: "OK" }]);
    } finally {
      setPostingComment(false);
    }
  };

  // ── DELETE COMMENT ───────────────────────────────────────────────
  const handleDeleteComment = (comment: Comment) => {
    if (comment.userId !== user?.uid) return;
    showAlert(
      "Delete Comment",
      "Remove this comment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "weaves", id!, "comments", comment.id));
              await updateDoc(doc(db, "weaves", id!), {
                commentsCount: increment(-1),
              });
            } catch {}
          },
        },
      ]
    );
  };

  // ── LIKE COMMENT ─────────────────────────────────────────────────
  const handleLikeComment = async (comment: Comment) => {
    if (!user || !id) return;
    const ref     = doc(db, "weaves", id, "comments", comment.id);
    const isLiked = (comment.likedBy || []).includes(user.uid);
    try {
      await updateDoc(ref, {
        likesCount: increment(isLiked ? -1 : 1),
        likedBy:    isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });
    } catch {}
  };

  // ── FORMAT TIME ──────────────────────────────────────────────────
  const formatTime = (ts: any): string => {
    if (!ts?.toDate) return "";
    const date  = ts.toDate();
    const diff  = Date.now() - date.getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)   return "Just now";
    if (mins  < 60)  return `${mins}m ago`;
    if (hours < 24)  return `${hours}h ago`;
    if (days  < 7)   return `${days}d ago`;
    return date.toLocaleDateString("en-NG", {
      day: "numeric", month: "short", year: "numeric",
    });
  };

  const formatArchiveDate = (ts: any): string => {
    if (!ts?.toDate) return "";
    return ts.toDate().toLocaleDateString("en-NG", {
      day: "numeric", month: "long", year: "numeric",
    });
  };

  if (loading) return (
    <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
      <ActivityIndicator size="large" color={DARK_THEME.accent} />
    </View>
  );

  if (!weave) return (
    <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
      <Text style={{ color: DARK_THEME.textMuted }}>Weave not found.</Text>
    </View>
  );

  const typeConfig   = TYPE_CONFIG[weave.type] || TYPE_CONFIG["Discussion"];
  const isOwner      = weave.userId === user?.uid;
  const contentLimit = 600;
  const isLong       = (weave.content || "").length > contentLimit;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <View style={s.container}>
        <StatusBar barStyle={T.statusBar} />
        <LinearGradient
          colors={T.mode === "dark" ? ["#0F071A", T.bg] : ["#EDE8F8", T.bg]}
          style={StyleSheet.absoluteFill}
        />

        {/* HEADER */}
        <View style={[s.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={T.accent} />
          </TouchableOpacity>
          <View style={[s.typeChip, { backgroundColor: typeConfig.color + "20", borderColor: typeConfig.color + "40" }]}>
            <MaterialCommunityIcons
              name={typeConfig.icon as any}
              size={13}
              color={typeConfig.color}
            />
            <Text style={[s.typeChipTxt, { color: typeConfig.color }]}>
              {typeConfig.label.toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity style={s.themeBtn} onPress={() => setIsDark(!isDark)}>
            <Ionicons
              name={isDark ? "sunny-outline" : "moon-outline"}
              size={18}
              color={T.accent}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >

          {/* BOOK REFERENCE */}
          <TouchableOpacity
            style={s.bookBanner}
            onPress={() => {
              if (weave.bookId) {
                router.push(`/book/${weave.bookId}` as any);
              }
            }}
            activeOpacity={weave.bookId ? 0.8 : 1}
          >
            <LinearGradient
              colors={[typeConfig.color + "20", "transparent"]}
              style={s.bookBannerGradient}
            >
              <View style={s.bookBannerLeft}>
                <View style={[s.bookBannerIcon, { backgroundColor: typeConfig.color + "25" }]}>
                  <Ionicons name="book" size={18} color={typeConfig.color} />
                </View>
                <View>
                  <Text style={[s.bookBannerTitle, { color: typeConfig.color }]}>
                    {weave.bookTitle}
                  </Text>
                  <Text style={s.bookBannerAuthor}>
                    {weave.bookAuthor}
                    {weave.bookYear ? ` · ${weave.bookYear}` : ""}
                  </Text>
                </View>
              </View>
              {weave.isExternalBook ? (
                <View style={[s.externalBadge, { backgroundColor: T.orange + "20" }]}>
                  <Ionicons name="globe-outline" size={11} color={T.orange} />
                  <Text style={[s.externalBadgeTxt, { color: T.orange }]}>External</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={16} color={typeConfig.color} />
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={s.body}>

            {/* EXTERNAL DISCLAIMER */}
            {weave.disclaimer && (
              <View style={s.disclaimerCard}>
                <Ionicons name="shield-checkmark-outline" size={14} color={T.textMuted} />
                <Text style={s.disclaimerTxt}>{weave.disclaimer}</Text>
              </View>
            )}

            {/* TITLE */}
            {weave.title ? (
              <Text style={s.weaveTitle}>{weave.title}</Text>
            ) : null}

            {/* AUTHOR ROW */}
            <View style={s.authorRow}>
              <View style={s.authorAvatar}>
                {weave.userPhoto ? (
                  <Image
                    source={{ uri: weave.userPhoto }}
                    style={s.authorAvatarImg}
                  />
                ) : (
                  <Ionicons name="person" size={16} color={T.textMuted} />
                )}
              </View>
              <View>
                <Text style={s.authorName}>{weave.userName}</Text>
                <Text style={s.authorTime}>{formatTime(weave.createdAt)}</Text>
              </View>
              {isOwner && (
                <TouchableOpacity
                  style={s.editBtn}
                  onPress={() => router.push(`/weave/edit?id=${id}` as any)}
                >
                  <Ionicons name="pencil-outline" size={14} color={T.accent} />
                  <Text style={[s.editBtnTxt, { color: T.accent }]}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* RATING (Critique) */}
            {weave.rating && (
              <View style={[s.ratingCard, { borderColor: typeConfig.color + "40" }]}>
                <Text style={[s.ratingNum, { color: typeConfig.color }]}>
                  {weave.rating}
                  <Text style={[s.ratingDenom, { color: T.textMuted }]}>/10</Text>
                </Text>
                <Text style={[s.ratingLabel, { color: T.textMuted }]}>
                  {Number(weave.rating) >= 9 ? "Masterpiece"        :
                   Number(weave.rating) >= 7 ? "Highly Recommended" :
                   Number(weave.rating) >= 5 ? "Worth Reading"      :
                   Number(weave.rating) >= 3 ? "Has Merit"          :
                                               "Not Recommended"    }
                </Text>
              </View>
            )}

            {/* DIRECT QUOTE */}
            {weave.quote && (
              <View style={[s.quoteBlock, { borderLeftColor: typeConfig.color }]}>
                <Text style={[s.quoteText, { color: T.text }]}>
                  "{weave.quote}"
                </Text>
                <Text style={s.quoteMeta}>
                  — {weave.bookTitle}, {weave.bookAuthor}
                </Text>
              </View>
            )}

            {/* MAIN CONTENT */}
            <Text style={s.contentTxt}>
              {isLong && !showFullContent
                ? weave.content.substring(0, contentLimit) + "..."
                : weave.content}
            </Text>
            {isLong && (
              <TouchableOpacity
                onPress={() => setShowFullContent(!showFullContent)}
              >
                <Text style={[s.readMoreBtn, { color: typeConfig.color }]}>
                  {showFullContent ? "Show less ↑" : "Read full Weave ↓"}
                </Text>
              </TouchableOpacity>
            )}

            {/* SOURCES */}
            {weave.sources && (
              <View style={s.sourcesCard}>
                <Text style={[s.sourcesLabel, { color: T.accent }]}>
                  SOURCES
                </Text>
                <Text style={s.sourcesTxt}>{weave.sources}</Text>
              </View>
            )}

            {/* FINDINGS */}
            {weave.findings && (
              <View style={[s.findingsCard, { borderColor: typeConfig.color + "30" }]}>
                <Text style={[s.findingsLabel, { color: typeConfig.color }]}>
                  KEY FINDINGS
                </Text>
                <Text style={s.findingsTxt}>{weave.findings}</Text>
              </View>
            )}

            {/* TAGS */}
            {weave.tags?.length > 0 && (
              <View style={s.tagsRow}>
                {weave.tags.map((tag: string) => (
                  <View key={tag} style={[s.tagPill, { backgroundColor: T.accentDim }]}>
                    <Text style={[s.tagTxt, { color: T.accent }]}>#{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* ACTIONS */}
            <View style={s.actionsRow}>
              <TouchableOpacity
                style={[s.actionBtn, liked && { backgroundColor: T.red + "20" }]}
                onPress={handleLike}
              >
                <Ionicons
                  name={liked ? "heart" : "heart-outline"}
                  size={18}
                  color={liked ? T.red : T.textMuted}
                />
                <Text style={[s.actionTxt, liked && { color: T.red }]}>
                  {likeCount}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.actionBtn}
                onPress={() => commentInputRef.current?.focus()}
              >
                <Ionicons name="chatbubble-outline" size={18} color={T.textMuted} />
                <Text style={s.actionTxt}>{comments.length}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.actionBtn}>
                <Ionicons name="share-social-outline" size={18} color={T.textMuted} />
                <Text style={s.actionTxt}>Share</Text>
              </TouchableOpacity>
            </View>

            {/* ARCHIVE STAMP */}
            <View style={s.archiveStamp}>
              <MaterialCommunityIcons name="archive-check" size={14} color={T.accent} />
              <Text style={s.archiveStampTxt}>
                Archived to the Writha Literary Record
                {weave.archivedAt
                  ? ` · ${formatArchiveDate(weave.archivedAt)}`
                  : ""}
              </Text>
            </View>

          </View>

          {/* RELATED WEAVES */}
          {relatedWeaves.length > 0 && (
            <View style={s.relatedSection}>
              <Text style={s.relatedTitle}>MORE WEAVES ON THIS BOOK</Text>
              {relatedWeaves.map((rw) => {
                const rwType = TYPE_CONFIG[rw.type] || TYPE_CONFIG["Discussion"];
                return (
                  <TouchableOpacity
                    key={rw.id}
                    style={s.relatedCard}
                    onPress={() => router.push(`/weave/${rw.id}` as any)}
                    activeOpacity={0.8}
                  >
                    <View style={[s.relatedTypeIcon, { backgroundColor: rwType.color + "20" }]}>
                      <MaterialCommunityIcons
                        name={rwType.icon as any}
                        size={14}
                        color={rwType.color}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.relatedCardTitle} numberOfLines={1}>
                        {rw.title || rw.content?.substring(0, 60)}
                      </Text>
                      <Text style={s.relatedCardMeta}>
                        {rw.userName} · {rwType.label}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={T.textMuted} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* COMMENTS SECTION */}
          <View style={s.commentsSection}>
            <Text style={s.commentsSectionTitle}>
              DISCUSSION ({comments.length})
            </Text>

            {comments.length === 0 ? (
              <View style={s.noComments}>
                <MaterialCommunityIcons
                  name="forum-outline"
                  size={32}
                  color={T.textMuted}
                />
                <Text style={s.noCommentsTxt}>
                  Be the first to respond to this Weave
                </Text>
              </View>
            ) : (
              comments.map((comment) => {
                const isCommentLiked = (comment.likedBy || []).includes(user?.uid || "");
                const isCommentOwner = comment.userId === user?.uid;

                return (
                  <View key={comment.id} style={[
                    s.commentCard,
                    comment.replyTo && s.commentReply,
                  ]}>
                    {/* Reply indicator */}
                    {comment.replyTo && comment.replyToName && (
                      <View style={s.replyIndicator}>
                        <Ionicons
                          name="return-down-forward"
                          size={12}
                          color={T.textMuted}
                        />
                        <Text style={s.replyIndicatorTxt}>
                          Replying to {comment.replyToName}
                        </Text>
                      </View>
                    )}

                    <View style={s.commentHeader}>
                      <View style={s.commentAvatar}>
                        {comment.userPhoto ? (
                          <Image
                            source={{ uri: comment.userPhoto }}
                            style={s.commentAvatarImg}
                          />
                        ) : (
                          <Ionicons name="person" size={12} color={T.textMuted} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.commentName}>{comment.userName}</Text>
                        <Text style={s.commentTime}>
                          {formatTime(comment.createdAt)}
                          {comment.isEdited ? " · edited" : ""}
                        </Text>
                      </View>
                      {isCommentOwner && (
                        <TouchableOpacity
                          onPress={() => handleDeleteComment(comment)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={14}
                            color={T.red}
                          />
                        </TouchableOpacity>
                      )}
                    </View>

                    <Text style={s.commentContent}>{comment.content}</Text>

                    <View style={s.commentActions}>
                      <TouchableOpacity
                        style={s.commentAction}
                        onPress={() => handleLikeComment(comment)}
                      >
                        <Ionicons
                          name={isCommentLiked ? "heart" : "heart-outline"}
                          size={13}
                          color={isCommentLiked ? T.red : T.textMuted}
                        />
                        {comment.likesCount > 0 && (
                          <Text style={[
                            s.commentActionTxt,
                            isCommentLiked && { color: T.red },
                          ]}>
                            {comment.likesCount}
                          </Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={s.commentAction}
                        onPress={() => {
                          setReplyTo(comment);
                          commentInputRef.current?.focus();
                        }}
                      >
                        <Ionicons
                          name="return-down-forward-outline"
                          size={13}
                          color={T.textMuted}
                        />
                        <Text style={s.commentActionTxt}>Reply</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* COMMENT INPUT */}
        <View style={[s.commentInputWrap, { paddingBottom: insets.bottom + 8 }]}>
          {replyTo && (
            <View style={s.replyBanner}>
              <Ionicons name="return-down-forward" size={14} color={T.accent} />
              <Text style={[s.replyBannerTxt, { color: T.accent }]}>
                Replying to {replyTo.userName}
              </Text>
              <TouchableOpacity onPress={() => setReplyTo(null)}>
                <Ionicons name="close" size={16} color={T.textMuted} />
              </TouchableOpacity>
            </View>
          )}
          <View style={s.commentInputRow}>
            <TextInput
              ref={commentInputRef}
              style={s.commentInput}
              placeholder="Add to the discussion..."
              placeholderTextColor={T.textMuted}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[
                s.commentPostBtn,
                { backgroundColor: T.accent },
                (!commentText.trim() || postingComment) && { opacity: 0.4 },
              ]}
              onPress={handlePostComment}
              disabled={!commentText.trim() || postingComment}
            >
              {postingComment ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Ionicons name="send" size={16} color="#000" />
              )}
            </TouchableOpacity>
          </View>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (T: typeof DARK_THEME | typeof LIGHT_THEME) => StyleSheet.create({
  container:            { flex: 1, backgroundColor: T.bg },
  header:               { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: T.ui2 },
  backBtn:              { width: 40, height: 40, borderRadius: 12, backgroundColor: T.ui, justifyContent: "center", alignItems: "center" },
  themeBtn:             { width: 40, height: 40, borderRadius: 12, backgroundColor: T.ui, justifyContent: "center", alignItems: "center" },
  typeChip:             { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1 },
  typeChipTxt:          { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  bookBanner:           { marginHorizontal: 20, marginTop: 16, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: T.ui2 },
  bookBannerGradient:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  bookBannerLeft:       { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  bookBannerIcon:       { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  bookBannerTitle:      { fontSize: 14, fontWeight: "900" },
  bookBannerAuthor:     { color: T.textMuted, fontSize: 11, marginTop: 2 },
  externalBadge:        { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  externalBadgeTxt:     { fontSize: 9, fontWeight: "900" },
  body:                 { padding: 20, gap: 16 },
  disclaimerCard:       { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: T.ui, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: T.ui2 },
  disclaimerTxt:        { color: T.textMuted, fontSize: 11, flex: 1, lineHeight: 18, fontStyle: "italic" },
  weaveTitle:           { color: T.text, fontSize: 24, fontWeight: "900", lineHeight: 32 },
  authorRow:            { flexDirection: "row", alignItems: "center", gap: 10 },
  authorAvatar:         { width: 38, height: 38, borderRadius: 19, backgroundColor: T.ui2, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  authorAvatarImg:      { width: "100%", height: "100%" },
  authorName:           { color: T.text, fontWeight: "800", fontSize: 13 },
  authorTime:           { color: T.textMuted, fontSize: 11, marginTop: 1 },
  editBtn:              { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto", backgroundColor: T.accentDim, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  editBtnTxt:           { fontSize: 11, fontWeight: "800" },
  ratingCard:           { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.ui, borderRadius: 16, padding: 16, borderWidth: 1 },
  ratingNum:            { fontSize: 36, fontWeight: "900" },
  ratingDenom:          { fontSize: 18 },
  ratingLabel:          { fontSize: 13, fontWeight: "700" },
  quoteBlock:           { borderLeftWidth: 4, paddingLeft: 16, paddingVertical: 8 },
  quoteText:            { fontSize: 15, lineHeight: 24, fontStyle: "italic" },
  quoteMeta:            { color: T.textMuted, fontSize: 11, marginTop: 8 },
  contentTxt:           { color: T.text, fontSize: 15, lineHeight: 26 },
  readMoreBtn:          { fontWeight: "900", fontSize: 13, marginTop: 4 },
  sourcesCard:          { backgroundColor: T.ui, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: T.ui2 },
  sourcesLabel:         { fontSize: 9, fontWeight: "900", letterSpacing: 2, marginBottom: 8 },
  sourcesTxt:           { color: T.textMuted, fontSize: 12, lineHeight: 20 },
  findingsCard:         { backgroundColor: T.ui, borderRadius: 14, padding: 14, borderWidth: 1 },
  findingsLabel:        { fontSize: 9, fontWeight: "900", letterSpacing: 2, marginBottom: 8 },
  findingsTxt:          { color: T.text, fontSize: 13, lineHeight: 20 },
  tagsRow:              { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagPill:              { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  tagTxt:               { fontSize: 11, fontWeight: "700" },
  actionsRow:           { flexDirection: "row", gap: 12 },
  actionBtn:            { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: T.ui, borderWidth: 1, borderColor: T.ui2 },
  actionTxt:            { color: T.textMuted, fontSize: 13, fontWeight: "700" },
  archiveStamp:         { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, borderTopWidth: 1, borderTopColor: T.ui2 },
  archiveStampTxt:      { color: T.textMuted, fontSize: 10, fontStyle: "italic" },
  relatedSection:       { marginHorizontal: 20, marginBottom: 16 },
  relatedTitle:         { color: T.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 12 },
  relatedCard:          { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.ui, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: T.ui2, marginBottom: 8 },
  relatedTypeIcon:      { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  relatedCardTitle:     { color: T.text, fontWeight: "800", fontSize: 12 },
  relatedCardMeta:      { color: T.textMuted, fontSize: 10, marginTop: 2 },
  commentsSection:      { marginHorizontal: 20 },
  commentsSectionTitle: { color: T.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 14 },
  noComments:           { alignItems: "center", paddingVertical: 30, gap: 10 },
  noCommentsTxt:        { color: T.textMuted, fontSize: 13, textAlign: "center" },
  commentCard:          { backgroundColor: T.ui, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: T.ui2, marginBottom: 10 },
  commentReply:         { marginLeft: 20, borderLeftWidth: 2, borderLeftColor: T.accent + "40" },
  replyIndicator:       { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  replyIndicatorTxt:    { color: T.textMuted, fontSize: 10, fontStyle: "italic" },
  commentHeader:        { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  commentAvatar:        { width: 30, height: 30, borderRadius: 15, backgroundColor: T.ui2, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  commentAvatarImg:     { width: "100%", height: "100%" },
  commentName:          { color: T.text, fontWeight: "800", fontSize: 12 },
  commentTime:          { color: T.textMuted, fontSize: 10, marginTop: 1 },
  commentContent:       { color: T.text, fontSize: 13, lineHeight: 20, marginBottom: 10 },
  commentActions:       { flexDirection: "row", gap: 14 },
  commentAction:        { flexDirection: "row", alignItems: "center", gap: 4 },
  commentActionTxt:     { color: T.textMuted, fontSize: 11, fontWeight: "700" },
  commentInputWrap:     { backgroundColor: T.ui, borderTopWidth: 1, borderTopColor: T.ui2, padding: 12 },
  replyBanner:          { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, backgroundColor: T.accentDim, borderRadius: 10, padding: 8 },
  replyBannerTxt:       { flex: 1, fontSize: 12, fontWeight: "700" },
  commentInputRow:      { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  commentInput:         { flex: 1, backgroundColor: T.bg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, color: T.text, fontSize: 14, borderWidth: 1, borderColor: T.ui2, maxHeight: 100 },
  commentPostBtn:       { width: 42, height: 42, borderRadius: 13, justifyContent: "center", alignItems: "center" },
});