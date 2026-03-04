import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Image, ActivityIndicator, Modal,
  Platform, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { db, auth } from "@/lib/firebase";
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, increment,
} from "firebase/firestore";

const THEME = {
  bg:        "#07030F",
  ui:        "#0F0820",
  ui2:       "#170D2E",
  ui3:       "#201540",
  accent:    "#FFD700",
  accentDim: "rgba(255,215,0,0.08)",
  purple:    "#6D28D9",
  text:      "#EDE8F5",
  textMuted: "#6B5F80",
  blue:      "#38BDF8",
  red:       "#EF4444",
  border:    "#1A1030",
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

interface Props {
  visible:      boolean;
  onClose:      () => void;
  postId:       string;
  uid:          string;
  userPhoto:    string;
  postAuthorId: string;
  collection?:  string;
}

export default function CommentsModal({
  visible,
  onClose,
  postId,
  uid,
  userPhoto,
  postAuthorId,
  collection: collectionName = "feed",
}: Props) {
  const [comments,    setComments]    = useState<any[]>([]);
  const [text,        setText]        = useState("");
  const [posting,     setPosting]     = useState(false);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    if (!visible || !postId) return;
    const q = query(
      collection(db, collectionName, postId, "comments"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [visible, postId, collectionName]);

  // ── POST NEW COMMENT ───────────────────────────────────────────────
  const submit = async () => {
    if (!text.trim() || !uid) return;
    setPosting(true);
    try {
      const user = auth.currentUser;
      await addDoc(
        collection(db, collectionName, postId, "comments"),
        {
          content:   text.trim(),
          userId:    uid,
          userName:  user?.displayName || "Scholar",
          userPhoto: user?.photoURL    || "",
          createdAt: serverTimestamp(),
          edited:    false,
        }
      );
      await updateDoc(doc(db, collectionName, postId), {
        commentsCount: increment(1),
      });
      if (postAuthorId && postAuthorId !== uid) {
        await addDoc(
          collection(db, "users", postAuthorId, "notifications"),
          {
            type:          "comment",
            message:       `${user?.displayName || "Someone"} commented on your post`,
            postId,
            fromUserId:    uid,
            fromUserName:  user?.displayName || "Scholar",
            fromUserPhoto: user?.photoURL    || "",
            read:          false,
            createdAt:     serverTimestamp(),
          }
        );
        await updateDoc(doc(db, "users", postAuthorId), { hasUnread: true });
      }
      setText("");
    } catch (e) {
      console.error(e);
    } finally {
      setPosting(false);
    }
  };

  // ── EDIT COMMENT ───────────────────────────────────────────────────
  const startEdit = (comment: any) => {
    setEditingId(comment.id);
    setEditingText(comment.content);
  };

  const saveEdit = async () => {
    if (!editingText.trim() || !editingId) return;
    try {
      await updateDoc(
        doc(db, collectionName, postId, "comments", editingId),
        {
          content: editingText.trim(),
          edited:  true,
        }
      );
      setEditingId(null);
      setEditingText("");
    } catch (e) {
      console.error(e);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  // ── DELETE COMMENT ─────────────────────────────────────────────────
  const deleteComment = (commentId: string) => {
    showAlert(
      "Delete Comment",
      "This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(
                doc(db, collectionName, postId, "comments", commentId)
              );
              await updateDoc(doc(db, collectionName, postId), {
                commentsCount: increment(-1),
              });
            } catch (e) {
              console.error(e);
            }
          },
        },
      ]
    );
  };

  const formatTime = (ts: any): string => {
    if (!ts) return "";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60)    return "just now";
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modal}>

        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.title}>Comments ({comments.length})</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={THEME.text} />
          </TouchableOpacity>
        </View>

        {/* COMMENT LIST */}
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color={THEME.textMuted} />
              <Text style={styles.emptyTxt}>No comments yet. Be the first.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isOwner = item.userId === uid;
            const isEditing = editingId === item.id;

            return (
              <View style={styles.commentItem}>
                {/* AVATAR */}
                {item.userPhoto ? (
                  <Image source={{ uri: item.userPhoto }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={{ color: THEME.accent, fontWeight: "900", fontSize: 12 }}>
                      {(item.userName || "W")[0].toUpperCase()}
                    </Text>
                  </View>
                )}

                {/* BUBBLE */}
                <View style={styles.commentContent}>
                  <View style={styles.bubble}>
                    <View style={styles.bubbleHeader}>
                      <Text style={styles.commentName}>{item.userName || "Scholar"}</Text>
                      {isOwner && !isEditing && (
                        <View style={styles.ownerActions}>
                          <TouchableOpacity
                            style={styles.ownerBtn}
                            onPress={() => startEdit(item)}
                          >
                            <Ionicons name="pencil-outline" size={13} color={THEME.blue} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.ownerBtn}
                            onPress={() => deleteComment(item.id)}
                          >
                            <Ionicons name="trash-outline" size={13} color={THEME.red} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {/* EDITING MODE */}
                    {isEditing ? (
                      <View style={styles.editWrap}>
                        <TextInput
                          style={styles.editInput}
                          value={editingText}
                          onChangeText={setEditingText}
                          multiline
                          autoFocus
                          placeholderTextColor={THEME.textMuted}
                        />
                        <View style={styles.editActions}>
                          <TouchableOpacity
                            style={[styles.editBtn, { backgroundColor: THEME.ui3 }]}
                            onPress={cancelEdit}
                          >
                            <Text style={[styles.editBtnTxt, { color: THEME.textMuted }]}>
                              Cancel
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.editBtn, { backgroundColor: THEME.accent }]}
                            onPress={saveEdit}
                          >
                            <Text style={[styles.editBtnTxt, { color: "#000" }]}>
                              Save
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.commentText}>{item.content}</Text>
                    )}
                  </View>

                  {/* TIME + EDITED BADGE */}
                  <View style={styles.commentMeta}>
                    <Text style={styles.commentTime}>{formatTime(item.createdAt)}</Text>
                    {item.edited && (
                      <Text style={styles.editedBadge}>· edited</Text>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />

        {/* INPUT BAR */}
        <View style={styles.inputBar}>
          {userPhoto ? (
            <Image source={{ uri: userPhoto }} style={styles.inputAvatar} />
          ) : (
            <View style={[styles.inputAvatar, styles.avatarFallback]}>
              <Text style={{ color: THEME.accent, fontWeight: "900" }}>W</Text>
            </View>
          )}
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Write a comment..."
              placeholderTextColor={THEME.textMuted}
              value={text}
              onChangeText={setText}
              multiline
            />
            <TouchableOpacity onPress={submit} disabled={!text.trim() || posting}>
              {posting ? (
                <ActivityIndicator size="small" color={THEME.accent} />
              ) : (
                <Ionicons
                  name="send"
                  size={20}
                  color={text.trim() ? THEME.accent : THEME.textMuted}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal:          { flex: 1, backgroundColor: THEME.bg },
  header:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: THEME.border },
  title:          { color: THEME.text, fontSize: 22, fontWeight: "900" },
  closeBtn:       { width: 36, height: 36, borderRadius: 12, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  empty:          { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTxt:       { color: THEME.textMuted, fontSize: 14 },
  commentItem:    { flexDirection: "row", gap: 10, marginBottom: 16 },
  avatar:         { width: 36, height: 36, borderRadius: 12 },
  avatarFallback: { backgroundColor: THEME.purple, justifyContent: "center", alignItems: "center" },
  commentContent: { flex: 1, gap: 4 },
  bubble:         { backgroundColor: THEME.ui2, borderRadius: 14, padding: 12 },
  bubbleHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  commentName:    { color: THEME.text, fontWeight: "800", fontSize: 13 },
  ownerActions:   { flexDirection: "row", gap: 8 },
  ownerBtn:       { padding: 2 },
  commentText:    { color: THEME.text, fontSize: 13, lineHeight: 18 },
  commentMeta:    { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 8 },
  commentTime:    { color: THEME.textMuted, fontSize: 11 },
  editedBadge:    { color: THEME.textMuted, fontSize: 11, fontStyle: "italic" },
  editWrap:       { gap: 8 },
  editInput:      { color: THEME.text, fontSize: 13, lineHeight: 18, borderBottomWidth: 1, borderBottomColor: THEME.accent, paddingBottom: 4 },
  editActions:    { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  editBtn:        { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 },
  editBtnTxt:     { fontSize: 12, fontWeight: "800" },
  inputBar:       { flexDirection: "row", gap: 10, alignItems: "flex-end", padding: 16, borderTopWidth: 1, borderTopColor: THEME.border },
  inputAvatar:    { width: 32, height: 32, borderRadius: 11 },
  inputWrap:      { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui2, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderWidth: 1, borderColor: THEME.border },
  input:          { flex: 1, color: THEME.text, fontSize: 13, maxHeight: 80 },
});