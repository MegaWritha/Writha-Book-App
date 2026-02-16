import React, { useState, useEffect } from "react";
import { View, FlatList, TextInput, TouchableOpacity, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { db, auth } from "../../lib/firebase";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";

export default function PrivateLoom() {
  const { id } = useLocalSearchParams();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const me = auth.currentUser?.uid;
  const chatId = [me, id].sort().join("_");

  useEffect(() => {
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
  }, [chatId]);

  const send = async () => {
    if (!text.trim() || !me) return;
    await addDoc(collection(db, "chats", chatId, "messages"), { text, sender: me, createdAt: serverTimestamp() });
    setText("");
  };

  return (
    <View style={styles.container}>
      <FlatList inverted data={messages} renderItem={({ item }) => (
        <View style={[styles.bubble, item.sender === me ? styles.myBubble : styles.theirBubble]}>
          <Text style={styles.txt}>{item.text}</Text>
        </View>
      )} />
      <View style={styles.inputArea}>
        <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Send a message..." placeholderTextColor="#444" />
        <TouchableOpacity onPress={send}><Text style={styles.sendTxt}>Send</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  bubble: { margin: 10, padding: 12, borderRadius: 15, maxWidth: "75%" },
  myBubble: { alignSelf: 'flex-end', backgroundColor: "#8E2DE2" },
  theirBubble: { alignSelf: 'flex-start', backgroundColor: "#1A1A1A" },
  txt: { color: "#FFF" },
  inputArea: { flexDirection: 'row', padding: 20, borderTopWidth: 1, borderColor: "#111" },
  input: { flex: 1, color: "#FFF" },
  sendTxt: { color: "#8E2DE2", fontWeight: "bold", marginLeft: 10 }
});