import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
  Animated,
  Vibration,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  writeBatch,
  Timestamp,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
  read: boolean;
  type: "text" | "voice" | "emoji";
  reactions?: { [key: string]: string };
  expiresAt?: any;
  replyTo?: { text: string; senderId: string } | null;
  isForwarded?: boolean;
  isStarred?: { [userId: string]: boolean };
  voiceUrl?: string;
  voiceDuration?: number;
}

const THEME = {
  bg: "#0F071A",
  ui: "#1E1135",
  ui2: "#2D1B4D",
  accent: "#FFD700",
  accentDim: "rgba(255,215,0,0.15)",
  text: "#E2E8F0",
  textMuted: "#94A3B8",
  purple: "#6D28D9",
  green: "#22C55E",
};

const EMOJI_LIST = ["❤️", "😂", "😮", "😢", "😡", "👍", "🔥", "🙌", "📚", "✍️"];
const QUICK_EMOJIS = ["😊", "😂", "❤️", "🔥", "👍", "😭", "🙏", "💯", "📖", "✨"];

const formatTime = (timestamp: any) => {
  if (!timestamp?.toDate) return "";
  return timestamp.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatLastSeen = (timestamp: any) => {
  if (!timestamp) return "Offline";
  const date = timestamp.toDate();
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const currentUser = auth.currentUser?.uid;
  const otherId = id as string;
  const chatId = currentUser! < otherId ? `${currentUser}_${otherId}` : `${otherId}_${currentUser}`;

  // Core state
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [otherUser, setOtherUser] = useState<any>(null);
  const [chatSettings, setChatSettings] = useState<any>({});
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [replyTo, setReplyTo] = useState<any>(null);
  const [pinnedMessage, setPinnedMessage] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [showStarredModal, setShowStarredModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimer = useRef<any>(null);
  const recordPulse = useRef(new Animated.Value(1)).current;

  // ── INIT ──────────────────────────────────────────────────────────────────
  const ensureChatDoc = async () => {
    const ref = doc(db, "chats", chatId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        participants: [currentUser, otherId],
        lastMessage: "",
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        disappearingMode: false,
        blockedUsers: {},
        typingStatus: {},
      });
    }
  };

  useEffect(() => {
    if (!currentUser || !otherId) return;
    let unsubMsgs: any, unsubChat: any, unsubUser: any;

    const init = async () => {
      try {
        await ensureChatDoc();

        unsubUser = onSnapshot(doc(db, "users", otherId), (snap) =>
          setOtherUser(snap.data() || {})
        );

        unsubChat = onSnapshot(doc(db, "chats", chatId), (snap) => {
          const data = snap.data() || {};
          setChatSettings(data);
          setIsOtherTyping(data?.typingStatus?.[otherId] || false);
          setPinnedMessage(data?.pinnedMessage || null);
        });

        const msgQuery = query(
          collection(db, "chats", chatId, "messages"),
          orderBy("createdAt", "desc")
        );

        unsubMsgs = onSnapshot(msgQuery, (snapshot) => {
          const nowMillis = Timestamp.now().toMillis();
          const msgs = snapshot.docs
            .map((d) => {
              const data = d.data();
              return {
                id: d.id,
                text: data.text || "",
                senderId: data.senderId || "",
                createdAt: data.createdAt,
                read: data.read || false,
                type: data.type || "text",
                reactions: data.reactions || {},
                expiresAt: data.expiresAt || null,
                replyTo: data.replyTo || null,
                isForwarded: data.isForwarded || false,
                isStarred: data.isStarred || {},
                voiceUrl: data.voiceUrl || null,
                voiceDuration: data.voiceDuration || 0,
              } as Message;
            })
            .filter((m) => !m.expiresAt || m.expiresAt.toMillis() > nowMillis);

          setMessages(msgs);
          setLoading(false);

          const unread = msgs.filter((m) => !m.read && m.senderId === otherId);
          if (unread.length > 0) {
            const batch = writeBatch(db);
            unread.forEach((m) =>
              batch.update(doc(db, "chats", chatId, "messages", m.id), { read: true })
            );
            batch.commit().catch(console.error);
          }
        }, (err) => {
          console.error(err);
          setError("Failed to load messages.");
          setLoading(false);
        });
      } catch (e) {
        console.error(e);
        setError("Something went wrong.");
        setLoading(false);
      }
    };

    init();
    return () => { unsubMsgs?.(); unsubChat?.(); unsubUser?.(); };
  }, [chatId, otherId]);

  // ── DERIVED ───────────────────────────────────────────────────────────────
  const starredMessages = useMemo(
    () => messages.filter((m) => m.isStarred?.[currentUser!]),
    [messages]
  );
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    return messages.filter((m) =>
      m.text.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [messages, searchQuery]);

  // ── SEND TEXT ─────────────────────────────────────────────────────────────
  const sendMessage = async (content?: string, msgType: string = "text") => {
    const msgContent = content || text.trim();
    if (!msgContent && msgType === "text") return;
    if (chatSettings?.blockedUsers?.[currentUser!]) return;

    const replyData = replyTo;
    setText("");
    setReplyTo(null);
    setShowEmojiPicker(false);

    const expiresAt = chatSettings?.disappearingMode
      ? Timestamp.fromMillis(Date.now() + 86400000)
      : null;

    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: currentUser,
        type: msgType,
        text: msgContent,
        createdAt: serverTimestamp(),
        read: false,
        reactions: {},
        expiresAt,
        isForwarded: false,
        replyTo: replyData ? { text: replyData.text, senderId: replyData.senderId } : null,
      });
      await setDoc(
        doc(db, "chats", chatId),
        { lastMessage: msgContent, lastMessageAt: serverTimestamp(), [`typingStatus.${currentUser}`]: false },
        { merge: true }
      );
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to send message.");
    }
  };

  // ── VOICE RECORDING ───────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return Alert.alert("Permission needed", "Allow microphone access to send voice notes.");

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordPulse, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(recordPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();

      recordingTimer.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
    } catch (e) {
      console.error(e);
    }
  };

  const stopRecording = async () => {
    try {
      clearInterval(recordingTimer.current);
      recordPulse.stopAnimation();
      recordPulse.setValue(1);
      setIsRecording(false);

      if (!recordingRef.current) return;
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) return;
      const duration = recordingDuration;

      // Save voice note as text ref (in production upload to Firebase Storage)
      // For now store URI locally and send as voice type
      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: currentUser,
        type: "voice",
        text: `🎤 Voice note (${duration}s)`,
        voiceUrl: uri,
        voiceDuration: duration,
        createdAt: serverTimestamp(),
        read: false,
        reactions: {},
        expiresAt: null,
        isForwarded: false,
        replyTo: null,
      });
      await setDoc(
        doc(db, "chats", chatId),
        { lastMessage: `🎤 Voice note`, lastMessageAt: serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      console.error(e);
    }
  };

  const cancelRecording = async () => {
    clearInterval(recordingTimer.current);
    recordPulse.stopAnimation();
    recordPulse.setValue(1);
    setIsRecording(false);
    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
    }
    setRecordingDuration(0);
  };

  // ── VOICE PLAYBACK ────────────────────────────────────────────────────────
  const playVoiceNote = async (uri: string) => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri });
      await sound.playAsync();
    } catch (e) {
      Alert.alert("Playback Error", "Could not play voice note.");
    }
  };

  // ── REACTIONS ─────────────────────────────────────────────────────────────
  const addReaction = async (message: Message, emoji: string) => {
    setShowReactionPicker(false);
    setSelectedMsg(null);
    await updateDoc(doc(db, "chats", chatId, "messages", message.id), {
      [`reactions.${currentUser}`]: emoji,
    });
  };

  // ── LONG PRESS MENU ───────────────────────────────────────────────────────
  const showActionMenu = (message: Message) => {
    Vibration.vibrate(30);
    setSelectedMsg(message);
    setShowReactionPicker(true);
  };

  const handleAction = (action: string) => {
    if (!selectedMsg) return;
    setShowReactionPicker(false);
    const isMine = selectedMsg.senderId === currentUser;
    const isStarred = selectedMsg.isStarred?.[currentUser!] || false;

    switch (action) {
      case "reply":
        setReplyTo(selectedMsg);
        break;
      case "forward":
        sendMessage(selectedMsg.text);
        break;
      case "pin":
        updateDoc(doc(db, "chats", chatId), { pinnedMessage: selectedMsg });
        break;
      case "star":
        updateDoc(doc(db, "chats", chatId, "messages", selectedMsg.id), {
          [`isStarred.${currentUser}`]: !isStarred,
        });
        break;
      case "delete":
        if (isMine) deleteDoc(doc(db, "chats", chatId, "messages", selectedMsg.id));
        break;
    }
    setSelectedMsg(null);
  };

  // ── SETTINGS ──────────────────────────────────────────────────────────────
  const openSettings = () => {
    Alert.alert("Chat Settings", "", [
      { text: "⭐ Starred Messages", onPress: () => setShowStarredModal(true) },
      {
        text: chatSettings?.disappearingMode ? "🔥 Disable Disappearing" : "🔥 Enable Disappearing Messages",
        onPress: () => updateDoc(doc(db, "chats", chatId), { disappearingMode: !chatSettings?.disappearingMode }),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // ── EARLY RETURNS ─────────────────────────────────────────────────────────
  if (!currentUser) return (
    <View style={styles.centered}>
      <Text style={{ color: THEME.textMuted }}>Not logged in.</Text>
    </View>
  );

  if (error) return (
    <View style={styles.centered}>
      <Ionicons name="warning-outline" size={48} color={THEME.accent} />
      <Text style={{ color: THEME.text, marginTop: 10 }}>{error}</Text>
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
        <Text style={{ color: THEME.accent }}>← Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator color={THEME.accent} size="large" />
      <Text style={{ color: THEME.textMuted, marginTop: 12 }}>Loading chat...</Text>
    </View>
  );

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── HEADER ── */}
      <View style={styles.header}>
        {!isSearchVisible ? (
          <>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={THEME.text} />
            </TouchableOpacity>

            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {(otherUser?.displayName || "?")[0].toUpperCase()}
              </Text>
            </View>

            <TouchableOpacity onPress={openSettings} style={styles.headerInfo}>
              <Text style={styles.headerName}>{otherUser?.displayName || "Chat"}</Text>
              <View style={styles.statusRow}>
                {otherUser?.isOnline && <View style={styles.onlineDot} />}
                <Text style={styles.statusText}>
                  {isOtherTyping ? "typing..." : otherUser?.isOnline ? "Online" : `Last seen ${formatLastSeen(otherUser?.lastSeen)}`}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsSearchVisible(true)} style={styles.headerIcon}>
              <Ionicons name="search" size={20} color={THEME.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={openSettings} style={styles.headerIcon}>
              <Ionicons name="ellipsis-vertical" size={20} color={THEME.textMuted} />
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color={THEME.textMuted} />
            <TextInput
              autoFocus
              placeholder="Search messages..."
              placeholderTextColor={THEME.textMuted}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity onPress={() => { setIsSearchVisible(false); setSearchQuery(""); }}>
              <Text style={{ color: THEME.accent, fontWeight: "bold" }}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── PINNED MESSAGE ── */}
      {pinnedMessage && (
        <View style={styles.pinnedBar}>
          <Ionicons name="pin" size={12} color={THEME.accent} />
          <Text style={styles.pinnedText} numberOfLines={1}>📌 {pinnedMessage.text}</Text>
          <TouchableOpacity onPress={() => updateDoc(doc(db, "chats", chatId), { pinnedMessage: null })}>
            <Ionicons name="close" size={14} color={THEME.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── MESSAGES ── */}
      <FlatList
        data={filteredMessages}
        inverted
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 80 }}>
            <Text style={{ fontSize: 40 }}>📚</Text>
            <Text style={{ color: THEME.textMuted, marginTop: 10 }}>Start the conversation!</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isMine = item.senderId === currentUser;
          const reactions = Object.values(item.reactions || {});
          const isStarred = item.isStarred?.[currentUser!];

          return (
            <View style={[styles.msgWrapper, isMine ? { alignItems: "flex-end" } : { alignItems: "flex-start" }]}>

              {/* Reply preview above bubble */}
              {item.replyTo && (
                <View style={[styles.replyPreview, isMine ? { alignSelf: "flex-end", borderRightWidth: 3, borderRightColor: THEME.accent, borderLeftWidth: 0 } : {}]}>
                  <Text style={styles.replyPreviewText} numberOfLines={1}>
                    ↩ {item.replyTo.text}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onLongPress={() => showActionMenu(item)}
                activeOpacity={0.85}
                style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}
              >
                {/* Forwarded label */}
                {item.isForwarded && (
                  <Text style={[styles.forwardedLabel, isMine && { color: "rgba(0,0,0,0.5)" }]}>
                    ↪ Forwarded
                  </Text>
                )}

                {/* Voice note */}
                {item.type === "voice" ? (
                  <TouchableOpacity
                    style={styles.voiceRow}
                    onPress={() => item.voiceUrl && playVoiceNote(item.voiceUrl)}
                  >
                    <Ionicons name="play-circle" size={32} color={isMine ? "#000" : THEME.accent} />
                    <View style={styles.voiceWave}>
                      {[...Array(12)].map((_, i) => (
                        <View
                          key={i}
                          style={[styles.waveBar, { height: 4 + Math.random() * 16, backgroundColor: isMine ? "rgba(0,0,0,0.4)" : THEME.purple }]}
                        />
                      ))}
                    </View>
                    <Text style={[styles.voiceDuration, isMine && { color: "rgba(0,0,0,0.6)" }]}>
                      {item.voiceDuration}s
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.msgText, isMine && { color: "#000" }]}>{item.text}</Text>
                )}

                {/* Timestamp + read receipt */}
                <View style={styles.msgMeta}>
                  {isStarred && <Ionicons name="star" size={10} color={isMine ? "#000" : THEME.accent} style={{ marginRight: 4 }} />}
                  <Text style={[styles.timeText, isMine && { color: "rgba(0,0,0,0.4)" }]}>
                    {formatTime(item.createdAt)}
                  </Text>
                  {isMine && (
                    <Ionicons
                      name={item.read ? "checkmark-done" : "checkmark"}
                      size={12}
                      color={item.read ? "#4FC3F7" : "rgba(0,0,0,0.4)"}
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </View>
              </TouchableOpacity>

              {/* Reactions */}
              {reactions.length > 0 && (
                <View style={[styles.reactionsRow, isMine ? { alignSelf: "flex-end" } : {}]}>
                  {[...new Set(reactions)].map((emoji, i) => (
                    <Text key={i} style={styles.reactionEmoji}>{emoji}</Text>
                  ))}
                </View>
              )}
            </View>
          );
        }}
      />

      {/* ── TYPING INDICATOR ── */}
      {isOtherTyping && (
        <View style={styles.typingBubble}>
          <Text style={styles.typingDots}>● ● ●</Text>
        </View>
      )}

      {/* ── REACTION + ACTION MODAL ── */}
      <Modal visible={showReactionPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setShowReactionPicker(false); setSelectedMsg(null); }}>
          <View style={styles.actionModal}>
            {/* Emoji reactions */}
            <View style={styles.emojiReactRow}>
              {EMOJI_LIST.map((emoji) => (
                <TouchableOpacity key={emoji} onPress={() => selectedMsg && addReaction(selectedMsg, emoji)}>
                  <Text style={styles.reactEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.divider} />

            {/* Actions */}
            {[
              { icon: "return-down-back", label: "Reply", action: "reply" },
              { icon: "arrow-redo", label: "Forward", action: "forward" },
              { icon: "pin", label: "Pin", action: "pin" },
              { icon: "star", label: selectedMsg?.isStarred?.[currentUser!] ? "Unstar" : "Star", action: "star" },
              ...(selectedMsg?.senderId === currentUser ? [{ icon: "trash", label: "Delete", action: "delete" }] : []),
            ].map((item: any) => (
              <TouchableOpacity key={item.action} style={styles.actionRow} onPress={() => handleAction(item.action)}>
                <Ionicons name={item.icon as any} size={20} color={item.action === "delete" ? "#EF4444" : THEME.text} />
                <Text style={[styles.actionLabel, item.action === "delete" && { color: "#EF4444" }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── STARRED MESSAGES MODAL ── */}
      <Modal visible={showStarredModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>⭐ Starred Messages</Text>
              <TouchableOpacity onPress={() => setShowStarredModal(false)}>
                <Ionicons name="close" size={24} color={THEME.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={starredMessages}
              keyExtractor={(item) => "star_" + item.id}
              renderItem={({ item }) => (
                <View style={styles.starredItem}>
                  <Text style={styles.starredSender}>
                    {item.senderId === currentUser ? "You" : otherUser?.displayName || "Them"}
                  </Text>
                  <Text style={styles.starredText}>{item.text}</Text>
                  <Text style={styles.starredTime}>{formatTime(item.createdAt)}</Text>
                </View>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: "center", marginTop: 60 }}>
                  <Text style={{ fontSize: 32 }}>⭐</Text>
                  <Text style={{ color: THEME.textMuted, marginTop: 10 }}>No starred messages yet.</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* ── EMOJI PICKER ── */}
      {showEmojiPicker && (
        <View style={styles.emojiPanel}>
          <Text style={styles.emojiPanelTitle}>Quick Send</Text>
          <View style={styles.emojiGrid}>
            {QUICK_EMOJIS.map((emoji) => (
              <TouchableOpacity key={emoji} onPress={() => sendMessage(emoji, "emoji")} style={styles.emojiGridBtn}>
                <Text style={{ fontSize: 28 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ── REPLY BAR ── */}
      {replyTo && (
        <View style={styles.replyBar}>
          <View style={styles.replyBarInner}>
            <Text style={styles.replyBarLabel}>Replying to</Text>
            <Text style={styles.replyBarText} numberOfLines={1}>{replyTo.text}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Ionicons name="close-circle" size={22} color={THEME.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── INPUT BAR ── */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        {isRecording ? (
          // RECORDING STATE
          <View style={styles.recordingBar}>
            <TouchableOpacity onPress={cancelRecording} style={styles.cancelRecordBtn}>
              <Ionicons name="trash" size={22} color="#EF4444" />
            </TouchableOpacity>
            <View style={styles.recordingInfo}>
              <Animated.View style={[styles.recordDot, { transform: [{ scale: recordPulse }] }]} />
              <Text style={styles.recordingTime}>
                {Math.floor(recordingDuration / 60).toString().padStart(2, "0")}:{(recordingDuration % 60).toString().padStart(2, "0")}
              </Text>
              <Text style={styles.recordingLabel}>Recording...</Text>
            </View>
            <TouchableOpacity onPress={stopRecording} style={styles.sendVoiceBtn}>
              <Ionicons name="send" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        ) : (
          // NORMAL INPUT
          <View style={styles.inputWrapper}>
            <TouchableOpacity onPress={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachMenu(false); }} style={styles.inputIcon}>
              <Ionicons name={showEmojiPicker ? "close" : "happy-outline"} size={24} color={THEME.textMuted} />
            </TouchableOpacity>

            <TextInput
              value={text}
              onChangeText={(val) => {
                setText(val);
                setDoc(doc(db, "chats", chatId), { [`typingStatus.${currentUser}`]: val.length > 0 }, { merge: true }).catch(console.error);
              }}
              placeholder="Message..."
              placeholderTextColor={THEME.textMuted}
              style={styles.input}
              multiline
              maxLength={2000}
            />

            {text.trim().length > 0 ? (
              <TouchableOpacity onPress={() => sendMessage()} style={styles.sendBtn}>
                <Ionicons name="send" size={20} color="#000" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPressIn={startRecording} onPressOut={stopRecording} style={styles.sendBtn}>
                <Ionicons name="mic" size={20} color="#000" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  centered: { flex: 1, backgroundColor: THEME.bg, justifyContent: "center", alignItems: "center" },

  // Header
  header: { paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: THEME.ui, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  backBtn: { marginRight: 4 },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: THEME.purple, justifyContent: "center", alignItems: "center", marginRight: 10 },
  avatarText: { color: THEME.accent, fontWeight: "bold", fontSize: 16 },
  headerInfo: { flex: 1 },
  headerName: { color: THEME.text, fontWeight: "bold", fontSize: 15 },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: THEME.green, marginRight: 5 },
  statusText: { color: THEME.textMuted, fontSize: 11 },
  headerIcon: { padding: 6 },
  searchContainer: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui2, paddingHorizontal: 12, borderRadius: 12, gap: 8, height: 38 },
  searchInput: { flex: 1, color: THEME.text, fontSize: 14 },

  // Pinned
  pinnedBar: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui2, paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  pinnedText: { color: THEME.textMuted, fontSize: 12, flex: 1 },

  // Messages
  msgWrapper: { marginVertical: 3, width: "100%" },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, maxWidth: "78%" },
  myBubble: { backgroundColor: THEME.accent, borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: THEME.ui, borderBottomLeftRadius: 4 },
  msgText: { color: THEME.text, fontSize: 15, lineHeight: 21 },
  msgMeta: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 4 },
  timeText: { color: "rgba(255,255,255,0.4)", fontSize: 10 },
  forwardedLabel: { color: "rgba(255,255,255,0.4)", fontSize: 10, marginBottom: 4 },
  replyPreview: { backgroundColor: THEME.accentDim, borderLeftWidth: 3, borderLeftColor: THEME.accent, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginBottom: 4, maxWidth: "78%" },
  replyPreviewText: { color: THEME.textMuted, fontSize: 12 },
  reactionsRow: { flexDirection: "row", backgroundColor: THEME.ui2, borderRadius: 12, paddingHorizontal: 6, paddingVertical: 3, marginTop: 2 },
  reactionEmoji: { fontSize: 14, marginHorizontal: 2 },

  // Voice
  voiceRow: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 160 },
  voiceWave: { flexDirection: "row", alignItems: "center", gap: 2, flex: 1 },
  waveBar: { width: 3, borderRadius: 2 },
  voiceDuration: { color: "rgba(255,255,255,0.5)", fontSize: 11 },

  // Typing
  typingBubble: { marginLeft: 16, marginBottom: 4, backgroundColor: THEME.ui, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, alignSelf: "flex-start" },
  typingDots: { color: THEME.textMuted, letterSpacing: 3, fontSize: 12 },

  // Action modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  actionModal: { backgroundColor: THEME.ui, borderRadius: 20, width: "85%", padding: 16, borderWidth: 1, borderColor: THEME.ui2 },
  emojiReactRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 12 },
  reactEmoji: { fontSize: 26 },
  divider: { height: 1, backgroundColor: THEME.ui2, marginVertical: 8 },
  actionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 16, paddingHorizontal: 8 },
  actionLabel: { color: THEME.text, fontSize: 15 },

  // Bottom sheet
  bottomSheet: { backgroundColor: THEME.ui, height: "75%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, position: "absolute", bottom: 0, left: 0, right: 0 },
  sheetHandle: { width: 40, height: 4, backgroundColor: THEME.ui2, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sheetTitle: { color: THEME.accent, fontSize: 18, fontWeight: "bold" },
  starredItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  starredSender: { color: THEME.accent, fontSize: 11, marginBottom: 4 },
  starredText: { color: THEME.text, fontSize: 14 },
  starredTime: { color: THEME.textMuted, fontSize: 10, marginTop: 4 },

  // Emoji picker
  emojiPanel: { backgroundColor: THEME.ui, paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: THEME.ui2 },
  emojiPanelTitle: { color: THEME.textMuted, fontSize: 10, fontWeight: "bold", letterSpacing: 1, marginBottom: 10 },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emojiGridBtn: { padding: 4 },

  // Reply bar
  replyBar: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, paddingHorizontal: 16, paddingVertical: 10, borderLeftWidth: 3, borderLeftColor: THEME.accent, marginHorizontal: 10, marginBottom: 4, borderRadius: 10 },
  replyBarInner: { flex: 1 },
  replyBarLabel: { color: THEME.accent, fontSize: 11, fontWeight: "bold" },
  replyBarText: { color: THEME.textMuted, fontSize: 12, marginTop: 2 },

  // Input
  inputWrapper: { flexDirection: "row", alignItems: "flex-end", backgroundColor: THEME.ui, margin: 10, borderRadius: 28, paddingHorizontal: 8, paddingVertical: 6, gap: 6, borderWidth: 1, borderColor: THEME.ui2 },
  inputIcon: { padding: 4, justifyContent: "center", alignItems: "center", height: 36 },
  input: { flex: 1, color: THEME.text, fontSize: 15, maxHeight: 120, paddingHorizontal: 4, paddingVertical: 4 },
  sendBtn: { backgroundColor: THEME.accent, width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center" },

  // Recording
  recordingBar: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, margin: 10, borderRadius: 28, paddingHorizontal: 16, paddingVertical: 10, gap: 12, borderWidth: 1, borderColor: "#EF4444" },
  cancelRecordBtn: { padding: 6 },
  recordingInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  recordDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" },
  recordingTime: { color: THEME.text, fontWeight: "bold", fontSize: 15 },
  recordingLabel: { color: THEME.textMuted, fontSize: 12 },
  sendVoiceBtn: { backgroundColor: THEME.accent, width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center" },
});