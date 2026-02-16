import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { db, auth } from "../../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "expo-router";

export default function CritiqueEditor() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  const publishToHub = async () => {
    if (!title || !excerpt) {
      Alert.alert("Incomplete", "The world needs a title and a core thought.");
      return;
    }

    setIsPublishing(true);
    try {
      await addDoc(collection(db, "discover"), {
        title,
        excerpt,
        type: "critique",
        authorName: auth.currentUser?.displayName || "Anonymous Creator",
        authorId: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
      });
      
      Alert.alert("Success", "Your thinking is now part of the Global Pulse.");
      router.back();
    } catch (e) {
      Alert.alert("Error", "The Loom stalled. Check your connection.");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={publishToHub} disabled={isPublishing}>
          <Text style={styles.publish}>{isPublishing ? "Weaving..." : "Publish"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.editor}>
        <TextInput
          placeholder="Thesis Title"
          placeholderTextColor="#444"
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          multiline
        />
        <View style={styles.divider} />
        <TextInput
          placeholder="Start thinking aloud here..."
          placeholderTextColor="#444"
          style={styles.bodyInput}
          value={excerpt}
          onChangeText={setExcerpt}
          multiline
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  nav: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    paddingHorizontal: 20, 
    paddingTop: 60,
    paddingBottom: 20 
  },
  cancel: { color: "#666", fontWeight: "700" },
  publish: { color: "#8E2DE2", fontWeight: "900", fontSize: 16 },
  editor: { paddingHorizontal: 25 },
  titleInput: { 
    color: "#FFF", 
    fontSize: 32, 
    fontWeight: "900", 
    marginBottom: 10 
  },
  divider: { height: 1, backgroundColor: "#222", marginVertical: 20 },
  bodyInput: { 
    color: "#EEE", 
    fontSize: 18, 
    lineHeight: 28, 
    minHeight: 300, 
    textAlignVertical: 'top' 
  }
});