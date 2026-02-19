import React, { useEffect, useState } from "react";
import { 
  View, Text, StyleSheet, FlatList, TextInput, 
  TouchableOpacity, Image, ActivityIndicator, 
  KeyboardAvoidingView, Platform, Alert
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

// Using @ alias for absolute path safety
import { db, auth } from "@/lib/firebase"; 
import { 
  collection, addDoc, query, orderBy, 
  onSnapshot, serverTimestamp, getDocs, doc, updateDoc, arrayUnion 
} from "firebase/firestore";

export default function BookComments() {
  const { id } = useLocalSearchParams(); 
  const router = useRouter();
  
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<any>(null);

  // --- FETCH COMMENTS & SUB-COMMENTS ---
  useEffect(() => {
    if (!id) return; // Prevention: Don't run if id is missing

    const q = query(collection(db, "books", id as string, "comments"), orderBy("createdAt", "desc"));
    
    const unsub = onSnapshot(q, async (snap) => {
      try {
        const parentComments = await Promise.all(snap.docs.map(async (d) => {
          const data = d.data();
          // Fetch Nested Replies
          const subSnap = await getDocs(query(collection(db, "books", id as string, "comments", d.id, "replies"), orderBy("createdAt", "asc")));
          const replies = subSnap.docs.map(sd => ({ id: sd.id, ...sd.data() }));
          return { id: d.id, ...data, replies };
        }));
        setComments(parentComments);
        setLoading(false);
      } catch (err) {
        console.error("Fetch Error:", err);
        setLoading(false);
      }
    });

    return () => unsub();
  }, [id]);

  const handlePost = async () => {
    if (!text.trim() || !id) return;
    const user = auth.currentUser;
    if (!user) return Alert.alert("Join the weave", "Please log in to comment.");

    const payload = {
      text: text.trim(),
      userId: user.uid,
      userName: user.displayName || "Writha User",
      userImg: user.photoURL || "https://picsum.photos/200",
      createdAt: serverTimestamp()
    };

    try {
      if (replyTo) {
        await addDoc(collection(db, "books", id as string, "comments", replyTo.id, "replies"), payload);
      } else {
        await addDoc(collection(db, "books", id as string, "comments"), payload);
      }
      setText("");
      setReplyTo(null);
    } catch (e) {
      console.error("Post Error:", e);
    }
  };

  const handleFollow = async (targetUserId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), { following: arrayUnion(targetUserId) });
      Alert.alert("Success", "Following author");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : undefined} 
      style={styles.main}
      keyboardVerticalOffset={100}
    >
      {/* --- HEADER --- */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#FFD700" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Comments</Text>
          <Text style={styles.subTitle}>Reader Discussions</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#FFD700" size="large" /></View>
      ) : (
        <FlatList 
          data={comments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{padding: 20, paddingBottom: 150}}
          renderItem={({item}) => (
            <View style={styles.commentContainer}>
              {/* Main Comment */}
              <View style={styles.row}>
                <TouchableOpacity onPress={() => router.push(`/profile/${item.userId}`)}>
                  <Image source={{uri: item.userImg}} style={styles.pfp} />
                </TouchableOpacity>
                <View style={styles.bubble}>
                  <View style={styles.bubbleTop}>
                    <Text style={styles.uName}>{item.userName}</Text>
                    <TouchableOpacity onPress={() => handleFollow(item.userId)} style={styles.followBadge}>
                      <Text style={styles.followTxt}>Follow</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.uText}>{item.text}</Text>
                  
                  <View style={styles.actionRow}>
                    <TouchableOpacity onPress={() => setReplyTo(item)} style={styles.action}>
                      <Text style={styles.actionText}>Reply</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.action}>
                      <Text style={styles.actionText}>Send Request</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Sub-Comments (Replies) */}
              {item.replies?.map((reply: any) => (
                <View key={reply.id} style={styles.replyRow}>
                  <View style={styles.replyLine} />
                  <Image source={{uri: reply.userImg}} style={styles.replyPfp} />
                  <View style={[styles.bubble, {backgroundColor: '#130B21'}]}>
                    <Text style={styles.uName}>{reply.userName}</Text>
                    <Text style={styles.uText}>{reply.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="comment-text-outline" size={50} color="#333" />
              <Text style={styles.emptyTxt}>The scrolls are empty. Be the first to speak.</Text>
            </View>
          }
        />
      )}

      {/* --- INPUT --- */}
      <View style={styles.inputWrapper}>
        {replyTo && (
          <View style={styles.replyingBar}>
            <Text style={styles.replyingText}>Replying to {replyTo.userName}</Text>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Ionicons name="close-circle" size={18} color="#FFD700" />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
          <TextInput 
            style={styles.input} 
            placeholder="Write a thought..." 
            placeholderTextColor="#6D28D9" 
            value={text} 
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity onPress={handlePost} style={styles.sendBtn}>
            <Ionicons name="paper-plane" size={20} color="#000" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#0F071A" },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginTop: 50, padding: 20, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1E1135' },
  backBtn: { marginRight: 15 },
  title: { color: "#FFF", fontSize: 22, fontWeight: "900" },
  subTitle: { color: '#FFD700', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  commentContainer: { marginBottom: 25 },
  row: { flexDirection: 'row' },
  pfp: { width: 45, height: 45, borderRadius: 22.5, borderWidth: 1.5, borderColor: '#FFD700' },
  bubble: { flex: 1, marginLeft: 12, backgroundColor: '#1E1135', padding: 15, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  bubbleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  uName: { color: '#FFD700', fontWeight: 'bold', fontSize: 13 },
  followBadge: { backgroundColor: '#4C1D95', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  followTxt: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  uText: { color: '#EEE', fontSize: 14, lineHeight: 20 },
  actionRow: { flexDirection: 'row', marginTop: 12 },
  action: { marginRight: 20 },
  actionText: { color: '#A78BFA', fontSize: 11, fontWeight: 'bold' },
  // Replies
  replyRow: { flexDirection: 'row', marginLeft: 45, marginTop: 10 },
  replyLine: { width: 2, backgroundColor: '#333', marginRight: 10, marginBottom: 15 },
  replyPfp: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#A78BFA' },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyTxt: { color: '#444', marginTop: 10, fontStyle: 'italic' },
  inputWrapper: { backgroundColor: '#1E1135', borderTopWidth: 1, borderTopColor: '#4C1D95' },
  replyingBar: { backgroundColor: '#2D1B4D', padding: 8, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 },
  replyingText: { color: '#FFD700', fontSize: 11 },
  inputRow: { flexDirection: 'row', padding: 15, alignItems: 'center', paddingBottom: Platform.OS === 'ios' ? 40 : 15 },
  input: { flex: 1, color: '#FFF', fontSize: 15, maxHeight: 100 },
  sendBtn: { backgroundColor: '#FFD700', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginLeft: 10 }
});