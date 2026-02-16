import React, { useState, useEffect, useRef } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  Image,
  Dimensions
} from "react-native";
import { db, auth } from "../../lib/firebase";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#000",
  accent: "#D4AF37",
  purple: "#8E2DE2",
  myBubble: "#8E2DE2",
  theirBubble: "#111",
  text: "#FFF",
  textMuted: "#666"
};

export default function GroupChat({ groupId }: { groupId: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const q = query(
      collection(db, "groups", groupId, "messages"), 
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsub;
  }, [groupId]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    const user = auth.currentUser;
    if (!user) return;

    try {
      await addDoc(collection(db, "groups", groupId, "messages"), {
        text: text.trim(),
        senderId: user.uid,
        senderName: user.displayName || "Member",
        senderPhoto: user.photoURL || null,
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch (e) { 
      console.error("Loom failure:", e); 
    }
  };

  const renderMessage = ({ item, index }: { item: any, index: number }) => {
    const isMe = item.senderId === auth.currentUser?.uid;
    const showName = !isMe && (index === 0 || messages[index - 1].senderId !== item.senderId);

    return (
      <View style={[styles.msgWrapper, isMe ? styles.myMsg : styles.theirMsg]}>
        {!isMe && (
          <View style={styles.avatarContainer}>
            {item.senderPhoto ? (
              <Image source={{ uri: item.senderPhoto }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{item.senderName?.charAt(0)}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.messageContent}>
          {showName && <Text style={styles.senderName}>{item.senderName}</Text>}
          <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
            <Text style={styles.msgText}>{item.text}</Text>
          </View>
          <Text style={[styles.timeText, isMe && { textAlign: 'right' }]}>
            {item.createdAt?.toDate() ? new Date(item.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "..."}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : undefined} 
      keyboardVerticalOffset={Platform.OS === "ios" ? 120 : 0} 
      style={styles.container}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.inputWrapper}>
        <View style={styles.goldInputFrame}>
          <TouchableOpacity style={styles.attachBtn}>
            <Ionicons name="add" size={24} color={THEME.textMuted} />
          </TouchableOpacity>
          
          <TextInput 
            style={styles.input} 
            placeholder="Interweave thoughts..." 
            placeholderTextColor="#444" 
            value={text} 
            onChangeText={setText} 
            multiline 
          />
          
          <TouchableOpacity 
            style={[styles.sendBtn, !text.trim() && { opacity: 0.5 }]} 
            onPress={sendMessage}
            disabled={!text.trim()}
          >
            <MaterialCommunityIcons name="arrow-up" size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  listContent: { paddingHorizontal: 15, paddingBottom: 20, paddingTop: 10 },
  msgWrapper: { 
    marginVertical: 4, 
    flexDirection: "row", 
    alignItems: "flex-end",
    maxWidth: "85%"
  },
  myMsg: { alignSelf: "flex-end" },
  theirMsg: { alignSelf: "flex-start" },
  
  avatarContainer: { marginRight: 8, marginBottom: 12 },
  avatar: { width: 30, height: 30, borderRadius: 10 },
  avatarPlaceholder: { 
    width: 30, 
    height: 30, 
    borderRadius: 10, 
    backgroundColor: "#222", 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: "#333"
  },
  avatarText: { color: THEME.accent, fontSize: 12, fontWeight: '900' },

  messageContent: { flexShrink: 1 },
  senderName: { color: THEME.accent, fontSize: 11, fontWeight: "900", marginBottom: 4, marginLeft: 4, letterSpacing: 1 },
  
  bubble: { padding: 14, borderRadius: 20 },
  myBubble: { backgroundColor: THEME.myBubble, borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: THEME.theirBubble, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "#222" },
  
  msgText: { color: "#FFF", fontSize: 15, lineHeight: 20 },
  timeText: { color: "#444", fontSize: 9, marginTop: 4, fontWeight: '700' },

  inputWrapper: { 
    padding: 15, 
    paddingBottom: Platform.OS === 'ios' ? 30 : 15,
    backgroundColor: '#000'
  },
  goldInputFrame: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#222',
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  attachBtn: { padding: 10 },
  input: { 
    flex: 1, 
    color: "#FFF", 
    fontSize: 15, 
    maxHeight: 100,
    paddingHorizontal: 10
  },
  sendBtn: { 
    backgroundColor: THEME.accent, 
    width: 38, 
    height: 38, 
    borderRadius: 19, 
    justifyContent: "center", 
    alignItems: "center",
    marginLeft: 5
  }
});