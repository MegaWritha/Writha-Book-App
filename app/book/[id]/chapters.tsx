import React, { useEffect, useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export default function ChaptersScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const bookId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);

  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookId) return;
    
    // Listen to the specific book document to get the internal chapters array
    const unsub = onSnapshot(doc(db, "books", bookId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.chapters)) {
          setChapters(data.chapters);
        } else {
          setChapters([]);
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [bookId]);

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#FFD700" /></View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={30} color="#FFD700" /></TouchableOpacity>
        <Text style={styles.title}>CHRONICLES</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 25 }}>
        {chapters.length > 0 ? chapters.map((item, index) => (
          <TouchableOpacity 
            key={index} 
            style={styles.chapterCard}
            onPress={() => router.push(`/book/${bookId}/reader`)}
          >
            <View style={styles.numCircle}><Text style={styles.numText}>{index + 1}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.chapterName}>{item.title || `Manuscript Part ${index + 1}`}</Text>
              <Text style={styles.wordCount}>{item.content?.split(' ').length || 0} WORDS</Text>
            </View>
            <MaterialCommunityIcons name="feather" size={20} color="#FFD700" />
          </TouchableOpacity>
        )) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No chapters found in this scroll.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F071A" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F071A" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 60, paddingHorizontal: 25 },
  title: { color: "#FFD700", fontSize: 18, fontWeight: "900", letterSpacing: 5 },
  chapterCard: { backgroundColor: "#1E1135", padding: 25, borderRadius: 25, marginBottom: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)' },
  numCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,215,0,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 20 },
  numText: { color: '#FFD700', fontWeight: '900' },
  chapterName: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  wordCount: { color: "#A78BFA", fontSize: 10, fontWeight: '900', marginTop: 5 },
  emptyBox: { marginTop: 100, alignItems: 'center' },
  emptyText: { color: '#A78BFA', fontSize: 14 }
});