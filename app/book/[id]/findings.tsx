import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

export default function PublishFinding() {
  const { id, quote, bookTitle } = useLocalSearchParams();
  const router = useRouter();
  const [commentary, setCommentary] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePublish = async () => {
    if (!commentary.trim()) return Alert.alert("Wait!", "Add your own insight.");
    setLoading(true);

    try {
      await addDoc(collection(db, "weaves"), {
        claim: quote || "General Finding",
        commentary: commentary,
        bookId: id,
        bookTitle: bookTitle,
        creatorId: auth.currentUser?.uid,
        creatorName: auth.currentUser?.displayName || "Anonymous Scholar",
        timestamp: serverTimestamp(),
      });
      Alert.alert("Success", "Woven into the Vanguard.");
      router.back();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>YOUR INTELLECTUAL FINDING</Text>
      <TextInput
        style={styles.input}
        placeholder="How does this apply to the modern African context?"
        placeholderTextColor="#555"
        multiline
        value={commentary}
        onChangeText={setCommentary}
      />
      <TouchableOpacity style={styles.publishBtn} onPress={handlePublish} disabled={loading}>
        <Ionicons name="flash" size={20} color="#fff" />
        <Text style={styles.publishText}>{loading ? "WEAVING..." : "PUBLISH"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 25, paddingTop: 60 },
  label: { color: '#4A00E0', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 15 },
  input: { flex: 1, color: '#fff', fontSize: 18, textAlignVertical: 'top' },
  publishBtn: { backgroundColor: '#4A00E0', padding: 20, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  publishText: { color: '#fff', fontWeight: '900' }
});