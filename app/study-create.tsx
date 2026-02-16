import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function StudyCreate() {
  const { bookId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  // From your sketch: students can choose their study focus
  const [focus, setFocus] = useState<"Criticism" | "Discussion" | "Learning">("Discussion");

  useEffect(() => {
    const fetchBook = async () => {
      if (!bookId) return;
      const snap = await getDoc(doc(db, "books", bookId as string));
      if (snap.exists()) setBook(snap.data());
      setLoading(false);
    };
    fetchBook();
  }, [bookId]);

  const handleCreateStudy = async () => {
    if (!auth.currentUser || !book) return;
    setCreating(true);

    try {
      // Create the Study Room in Firestore
      const studyRef = await addDoc(collection(db, "bookStudies"), {
        bookId: bookId,
        title: `${book.title} - ${focus} Room`,
        focus: focus,
        creatorId: auth.currentUser.uid,
        creatorName: auth.currentUser.displayName,
        createdAt: serverTimestamp(),
        description: `An academic ${focus} space for ${book.title}.`,
        type: "educational" // To distinguish from Open Circles
      });

      // Navigate to the newly created room
      router.replace(`/group/${studyRef.id}`);
    } catch (error) {
      console.error("Error creating study room:", error);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return (
    <View style={[styles.container, { justifyContent: 'center' }]}>
      <ActivityIndicator size="large" color="#4A00E0" />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Start Study Room</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>BOOK SELECTED</Text>
        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle}>{book?.title}</Text>
          <Text style={styles.bookAuthor}>{book?.authorName}</Text>
        </View>

        <Text style={styles.label}>CHOOSE FOCUS (From your sketch)</Text>
        <View style={styles.focusContainer}>
          {["Criticism", "Discussion", "Learning"].map((item: any) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.focusBtn,
                focus === item && styles.focusBtnActive
              ]}
              onPress={() => setFocus(item)}
            >
              <Text style={[
                styles.focusText,
                focus === item && styles.focusTextActive
              ]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="#4A00E0" />
          <Text style={styles.infoText}>
            Study Rooms are academic focused. For general chat, use the "Open Circle" option on the book page.
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.createBtn} 
          onPress={handleCreateStudy}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createBtnText}>Create Study Room</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20 
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  content: { padding: 20 },
  label: { color: '#4A00E0', fontSize: 12, fontWeight: 'bold', marginBottom: 10, letterSpacing: 1 },
  bookInfo: { backgroundColor: '#111', padding: 20, borderRadius: 15, marginBottom: 30 },
  bookTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  bookAuthor: { color: '#666', fontSize: 14, marginTop: 5 },
  focusContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  focusBtn: { 
    flex: 1, 
    marginHorizontal: 5, 
    paddingVertical: 12, 
    borderRadius: 10, 
    backgroundColor: '#111', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222'
  },
  focusBtnActive: { backgroundColor: '#4A00E0', borderColor: '#4A00E0' },
  focusText: { color: '#666', fontWeight: 'bold' },
  focusTextActive: { color: '#fff' },
  infoBox: { 
    flexDirection: 'row', 
    backgroundColor: '#111', 
    padding: 15, 
    borderRadius: 10, 
    gap: 10,
    marginBottom: 40 
  },
  infoText: { color: '#888', flex: 1, fontSize: 12, lineHeight: 18 },
  createBtn: { backgroundColor: "#4A00E0", padding: 18, borderRadius: 15, alignItems: "center" },
  createBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" }
});