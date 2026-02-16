import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export default function DiscussionDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [post, setPost] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "discussions", id as string), (snap) => {
      if (snap.exists()) setPost({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [id]);

  if (!post) return null;

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={24} color="#FFD700" />
      </TouchableOpacity>
      
      <View style={styles.mainPost}>
        <View style={styles.userRow}>
          <Image source={{ uri: post.userPhoto }} style={styles.pfp} />
          <Text style={styles.userName}>{post.userName}</Text>
        </View>
        <Text style={styles.content}>{post.content}</Text>
      </View>
      
      {/* Replies would go here later */}
      <Text style={styles.replyPlaceholder}>Comments coming soon...</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F071A", padding: 20 },
  backBtn: { marginTop: 40, marginBottom: 20 },
  mainPost: { backgroundColor: "#1E1135", padding: 20, borderRadius: 20, borderWidth: 1, borderColor: "#4C1D95" },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  pfp: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  userName: { color: "#FFD700", fontWeight: "900" },
  content: { color: "#FFF", fontSize: 16, lineHeight: 24 },
  replyPlaceholder: { color: "#A78BFA", marginTop: 30, textAlign: 'center', fontWeight: "700" }
});