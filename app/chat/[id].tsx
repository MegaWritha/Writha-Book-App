import React, { useEffect, useState, useMemo } from "react";
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
  ImageBackground,
  Modal,
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
} from "firebase/firestore";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";

// TYPESCRIPT INTERFACE - FIXES IMAGE #1
interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
  read: boolean;
  type: string;
  reactions?: { [key: string]: string };
  expiresAt?: any;
  replyTo?: { text: string; senderId: string } | null;
  isForwarded?: boolean;
  isStarred?: { [userId: string]: boolean };
}

const THEME = {
  bg: "#0F071A",
  ui: "#1E1135",
  accent: "#FFD700",
  text: "#E2E8F0",
  textMuted: "#94A3B8",
};

const formatLastSeen = (timestamp: any) => {
  if (!timestamp) return "Offline";
  const date = timestamp.toDate();
  const now = new Date();
  const diff = (now.getTime() - date.getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const currentUser = auth.currentUser?.uid;

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [otherUser, setOtherUser] = useState<any>(null);
  const [chatSettings, setChatSettings] = useState<any>({});
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [pinnedMessage, setPinnedMessage] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  
  // FEATURE #20: STARRED VIEW STATE
  const [showStarredModal, setShowStarredModal] = useState(false);

  const chatId = currentUser! < (id as string) ? `${currentUser}_${id}` : `${id}_${currentUser}`;

  useEffect(() => {
    const foregroundSub = Notifications.addNotificationReceivedListener((n) => console.log(n));
    const responseSub = Notifications.addNotificationResponseReceivedListener((res) => {
      const sId = res.notification.request.content.data.senderId;
      if (sId) router.push({ pathname: "/chat/[id]", params: { id: sId } } as any);
    });

    if (!id) return;
    onSnapshot(doc(db, "users", id as string), (snap) => setOtherUser(snap.data()));
    onSnapshot(doc(db, "chats", chatId), (snap) => {
      const data = snap.data();
      setChatSettings(data || {});
      setIsOtherTyping(data?.typingStatus?.[id as string] || false);
      setPinnedMessage(data?.pinnedMessage || null);
    });

    const msgQuery = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "desc"));
    const unsubMsgs = onSnapshot(msgQuery, (snapshot) => {
      const nowMillis = Timestamp.now().toMillis();
      
      // EXPLICIT MAPPING - FIXES "Property does not exist" ERRORS
      const msgs = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          text: data.text || "",
          senderId: data.senderId || "",
          createdAt: data.createdAt,
          read: data.read || false,
          type: data.type || "text",
          reactions: data.reactions || {},
          expiresAt: data.expiresAt,
          replyTo: data.replyTo || null,
          isForwarded: data.isForwarded || false,
          isStarred: data.isStarred || {},
        } as Message;
      }).filter((m) => !m.expiresAt || m.expiresAt.toMillis() > nowMillis);

      setMessages(msgs);

      const unread = msgs.filter((m) => !m.read && m.senderId === id);
      if (unread.length > 0) {
        const batch = writeBatch(db);
        unread.forEach((m) => batch.update(doc(db, "chats", chatId, "messages", m.id), { read: true }));
        batch.commit();
      }
    });

    return () => { foregroundSub.remove(); responseSub.remove(); unsubMsgs(); };
  }, [id, chatId]);

  const starredMessages = useMemo(() => messages.filter(m => m.isStarred?.[currentUser!]), [messages]);
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    return messages.filter((m) => m.text.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [messages, searchQuery]);

  const sendText = async (forwardedContent?: string) => {
    if (chatSettings?.blockedUsers?.[currentUser!] || (!text.trim() && !forwardedContent)) return;
    const msgContent = forwardedContent || text;
    const replyData = replyTo;
    setText("");
    setReplyTo(null);
    const expiresAt = chatSettings?.disappearingMode ? Timestamp.fromMillis(Date.now() + 86400000) : null;

    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderId: currentUser, type: "text", text: msgContent, createdAt: serverTimestamp(),
      read: false, reactions: {}, expiresAt, isForwarded: !!forwardedContent,
      replyTo: replyData ? { text: replyData.text, senderId: replyData.senderId } : null,
    });
    await updateDoc(doc(db, "chats", chatId), { lastMessage: msgContent, lastMessageAt: serverTimestamp(), [`typingStatus.${currentUser}`]: false });
  };

  const showActionMenu = (message: Message) => {
    const isMine = message.senderId === currentUser;
    const isStarred = message.isStarred?.[currentUser!] || false;
    Alert.alert("Options", "Select action", [
      { text: "Reply", onPress: () => setReplyTo(message) },
      { text: "Forward", onPress: () => sendText(message.text) },
      { text: "Pin to Top", onPress: () => updateDoc(doc(db, "chats", chatId), { pinnedMessage: message }) },
      { text: isStarred ? "Unstar" : "Star", onPress: () => updateDoc(doc(db, "chats", chatId, "messages", message.id), { [`isStarred.${currentUser}`]: !isStarred }) },
      isMine ? { text: "Delete", style: "destructive", onPress: () => deleteDoc(doc(db, "chats", chatId, "messages", message.id)) } : { text: "Cancel", style: "cancel" },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const openSettings = () => {
    Alert.alert("Chat Settings", "Customize your chat", [
      { text: "View Starred Messages", onPress: () => setShowStarredModal(true) }, // FEATURE #20
      { text: "Change Wallpaper", onPress: () => updateDoc(doc(db, "chats", chatId), { wallpaper: "#0A192F" }) },
      { text: chatSettings?.disappearingMode ? "Disable Disappearing" : "Enable Disappearing", onPress: () => updateDoc(doc(db, "chats", chatId), { disappearingMode: !chatSettings?.disappearingMode }) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: chatSettings?.wallpaper || THEME.bg }]}>
      <ImageBackground source={chatSettings?.wallpaperUrl ? { uri: chatSettings.wallpaperUrl } : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          {!isSearchVisible ? (
            <>
              <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={THEME.text} /></TouchableOpacity>
              <TouchableOpacity onPress={openSettings} style={styles.headerInfo}>
                <Text style={styles.headerName}>{otherUser?.displayName || "Chat"}</Text>
                <Text style={styles.statusText}>{isOtherTyping ? "typing..." : (otherUser?.isOnline ? "Online" : `Last seen ${formatLastSeen(otherUser?.lastSeen)}`)}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsSearchVisible(true)}><Ionicons name="search" size={22} color={THEME.text} /></TouchableOpacity>
            </>
          ) : (
            <View style={styles.searchContainer}>
              <TextInput autoFocus placeholder="Search..." placeholderTextColor={THEME.textMuted} style={styles.searchInput} value={searchQuery} onChangeText={setSearchQuery} />
              <TouchableOpacity onPress={() => {setIsSearchVisible(false); setSearchQuery("");}}><Text style={{color: THEME.accent}}>Cancel</Text></TouchableOpacity>
            </View>
          )}
        </View>

        {/* FEATURE #20: STARRED MESSAGES MODAL */}
        <Modal visible={showStarredModal} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Starred Messages</Text>
                <TouchableOpacity onPress={() => setShowStarredModal(false)}><Ionicons name="close" size={24} color={THEME.text} /></TouchableOpacity>
              </View>
              <FlatList
                data={starredMessages}
                keyExtractor={(item) => "star_" + item.id}
                renderItem={({ item }) => (
                  <View style={styles.starredItem}>
                    <Text style={styles.starredText}>{item.text}</Text>
                  </View>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No starred messages yet.</Text>}
              />
            </View>
          </View>
        </Modal>

        <FlatList
          data={filteredMessages}
          inverted
          renderItem={({ item }) => {
            const isMine = item.senderId === currentUser;
            return (
              <View style={[styles.msgWrapper, isMine ? { alignItems: "flex-end" } : { alignItems: "flex-start" }]}>
                <TouchableOpacity onLongPress={() => showActionMenu(item)} style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}>
                  {item.isStarred?.[currentUser!] && <Ionicons name="star" size={10} color={THEME.accent} style={{position:'absolute', top:-5, left:-5}} />}
                  <Text style={[styles.msgText, isMine && { color: "#000" }]}>{item.text}</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
          <View style={styles.inputBar}>
            <TextInput value={text} onChangeText={setText} placeholder="Message..." placeholderTextColor={THEME.textMuted} style={styles.input} />
            <TouchableOpacity onPress={() => sendText()} style={styles.sendBtn}><Ionicons name="send" size={20} color={THEME.bg} /></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20, backgroundColor: THEME.ui, flexDirection: "row", alignItems: "center" },
  headerInfo: { marginLeft: 15, flex: 1 },
  headerName: { color: THEME.text, fontWeight: "bold" },
  statusText: { color: THEME.textMuted, fontSize: 11 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 10, borderRadius: 10 },
  searchInput: { flex: 1, color: THEME.text, marginHorizontal: 8, height: 35 },
  msgWrapper: { marginVertical: 4, width: "100%" },
  bubble: { padding: 10, borderRadius: 15, maxWidth: "80%", position: "relative" },
  myBubble: { backgroundColor: THEME.accent, borderBottomRightRadius: 2 },
  theirBubble: { backgroundColor: THEME.ui, borderBottomLeftRadius: 2 },
  msgText: { color: THEME.text, fontSize: 15 },
  inputBar: { flexDirection: "row", padding: 10, alignItems: "center", backgroundColor: THEME.ui, margin: 10, borderRadius: 25 },
  input: { flex: 1, color: THEME.text, paddingHorizontal: 12 },
  sendBtn: { backgroundColor: THEME.accent, padding: 8, borderRadius: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: THEME.ui, height: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { color: THEME.accent, fontSize: 18, fontWeight: 'bold' },
  starredItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#2D1B4D' },
  starredText: { color: THEME.text },
  emptyText: { color: THEME.textMuted, textAlign: 'center', marginTop: 50 }
});