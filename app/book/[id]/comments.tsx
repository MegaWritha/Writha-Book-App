import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";

export default function BookComments() {
  const { id } = useLocalSearchParams(); 
  const router = useRouter();
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "books", id as string, "comments"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  const post = async () => {
    if (!text.trim()) return;
    const user = auth.currentUser;
    await addDoc(collection(db, "books", id as string, "comments"), {
      text,
      userId: user?.uid,
      userName: user?.displayName || "Writha Member",
      userImg: user?.photoURL || "https://picsum.photos/200",
      createdAt: serverTimestamp()
    });
    setText("");
  };

  return (
    <View style={styles.main}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color="#FFD700" /></TouchableOpacity>
        <Text style={styles.title}>Thread</Text>
      </View>

      {loading ? <ActivityIndicator color="#FFD700" style={{marginTop: 50}} /> : (
        <FlatList 
          data={comments}
          renderItem={({item}) => (
            <View style={styles.row}>
              <Image source={{uri: item.userImg}} style={styles.avatar} />
              <View style={styles.bubble}>
                <Text style={styles.uName}>{item.userName}</Text>
                <Text style={styles.uText}>{item.text}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.note}>No discussions here yet.</Text>}
          contentContainerStyle={{padding: 20}}
        />
      )}

      <View style={styles.inputArea}>
        <TextInput style={styles.input} placeholder="Write your thought..." placeholderTextColor="#6D28D9" value={text} onChangeText={setText} />
        <TouchableOpacity onPress={post} style={styles.send}><Ionicons name="paper-plane" size={20} color="#000" /></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#0F071A" },
  header: { marginTop: 50, padding: 20, flexDirection: 'row', alignItems: 'center' },
  title: { color: "#FFF", fontSize: 20, fontWeight: "900", marginLeft: 15 },
  row: { flexDirection: 'row', marginBottom: 20 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#FFD700' },
  bubble: { flex: 1, marginLeft: 12, backgroundColor: '#1E1135', padding: 15, borderRadius: 15 },
  uName: { color: '#FFD700', fontWeight: 'bold', fontSize: 13, marginBottom: 5 },
  uText: { color: '#EEE', fontSize: 14 },
  note: { color: '#A78BFA', textAlign: 'center', marginTop: 40, fontStyle: 'italic' },
  inputArea: { flexDirection: 'row', padding: 20, backgroundColor: '#1E1135', alignItems: 'center' },
  input: { flex: 1, color: '#FFF' },
  send: { backgroundColor: '#FFD700', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 10 }
});