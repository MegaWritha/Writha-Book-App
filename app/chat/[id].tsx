import React, { useState, useEffect, useRef } from "react";
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  FlatList, KeyboardAvoidingView, Platform, StatusBar, Image,
  ActivityIndicator, Dimensions
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, Feather, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { db, auth } from "@/lib/firebase";
import { 
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, getDoc 
} from "firebase/firestore";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#0F071A",
  ui: "#1E1135",
  accent: "#FFD700",
  text: "#E2E8F0",
  textMuted: "#94A3B8",
  bubbleMe: "#FFD700",
  bubbleThem: "#251642"
};

export default function AdvancedChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const userId = auth.currentUser?.uid;
  
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!id) return;

    // Fetch Other User Data for Header & Profile Link
    const fetchChatData = async () => {
      const chatDoc = await getDoc(doc(db, "chats", id as string));
      if (chatDoc.exists()) {
        const data = chatDoc.data();
        const otherId = data.participants.find((p: string) => p !== userId);
        setOtherUser({ id: otherId, ...data.participantData[otherId] });
      }
    };

    fetchChatData();

    const q = query(
      collection(db, "chats", id as string, "messages"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsub();
  }, [id]);

  const sendMessage = async (type = "text", content = message) => {
    if (type === "text" && !content.trim()) return;

    const msgData = {
      text: content,
      type: type, // text, voice, file
      senderId: userId,
      createdAt: serverTimestamp(),
    };

    setMessage("");
    await addDoc(collection(db, "chats", id as string, "messages"), msgData);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <StatusBar barStyle="light-content" />

      {/* ADVANCED HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={THEME.accent} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.headerProfile} 
          onPress={() => router.push(`/profile/${otherUser?.id}` as any)}
        >
          <Image source={{ uri: otherUser?.photo || 'https://via.placeholder.com/150' }} style={styles.headerAvatar} />
          <View>
            <Text style={styles.headerName}>{otherUser?.name || "Member"}</Text>
            <Text style={styles.statusText}>Online</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headIcon}><Feather name="phone" size={20} color={THEME.textMuted} /></TouchableOpacity>
          <TouchableOpacity style={styles.headIcon}><Feather name="video" size={20} color={THEME.textMuted} /></TouchableOpacity>
        </View>
      </View>

      {/* CHAT AREA */}
      <FlatList
        data={messages}
        inverted
        contentContainerStyle={styles.listContent}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isMine = item.senderId === userId;
          return (
            <View style={[styles.messageRow, isMine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
              {!isMine && (
                <TouchableOpacity onPress={() => router.push(`/profile/${otherUser?.id}` as any)}>
                    <Image source={{ uri: otherUser?.photo }} style={styles.smallAvatar} />
                </TouchableOpacity>
              )}
              <View style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}>
                <Text style={[styles.msgText, isMine && { color: THEME.bg }]}>{item.text}</Text>
              </View>
            </View>
          );
        }}
      />

      {/* INPUT TOOLS */}
      <View style={styles.inputArea}>
        <View style={styles.inputCard}>
          <TouchableOpacity style={styles.toolBtn}><Ionicons name="add" size={24} color={THEME.accent} /></TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Type your message..."
            placeholderTextColor={THEME.textMuted}
            value={message}
            onChangeText={setMessage}
            multiline
          />
          {message.length > 0 ? (
            <TouchableOpacity style={styles.sendBtn} onPress={() => sendMessage()}>
              <Ionicons name="send" size={20} color={THEME.bg} />
            </TouchableOpacity>
          ) : (
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity style={styles.toolBtn}><Feather name="mic" size={20} color={THEME.textMuted} /></TouchableOpacity>
              <TouchableOpacity style={styles.toolBtn}><Feather name="image" size={20} color={THEME.textMuted} /></TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: { 
    paddingTop: 60, paddingBottom: 15, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.ui,
    borderBottomWidth: 1, borderBottomColor: THEME.accent + '20'
  },
  backBtn: { marginRight: 15 },
  headerProfile: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 40, height: 40, borderRadius: 12, marginRight: 12 },
  headerName: { color: THEME.text, fontWeight: 'bold', fontSize: 16 },
  statusText: { color: THEME.accent, fontSize: 11, fontWeight: '600' },
  headerActions: { flexDirection: 'row' },
  headIcon: { marginLeft: 15 },

  listContent: { padding: 20 },
  messageRow: { flexDirection: 'row', marginBottom: 15, alignItems: 'flex-end' },
  smallAvatar: { width: 28, height: 28, borderRadius: 10, marginRight: 8 },
  bubble: { maxWidth: width * 0.7, padding: 14, borderRadius: 20 },
  myBubble: { backgroundColor: THEME.accent, borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: THEME.ui, borderBottomLeftRadius: 4 },
  msgText: { color: THEME.text, fontSize: 15, lineHeight: 22 },

  inputArea: { padding: 20, backgroundColor: THEME.bg },
  inputCard: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.ui, 
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: THEME.accent + '20'
  },
  input: { flex: 1, color: THEME.text, paddingHorizontal: 10, fontSize: 15, maxHeight: 100 },
  toolBtn: { padding: 10 },
  sendBtn: { width: 40, height: 40, borderRadius: 15, backgroundColor: THEME.accent, justifyContent: 'center', alignItems: 'center' }
});