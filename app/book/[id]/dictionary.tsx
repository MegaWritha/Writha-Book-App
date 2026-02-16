import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, limit } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

export default function VanguardDictionary() {
  const { id, word } = useLocalSearchParams();
  const router = useRouter();
  const [examples, setExamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      // In a real app, you'd query by the specific 'word'
      const q = query(collection(db, "books"), limit(5));
      const snap = await getDocs(q);
      setExamples(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    fetchUsage();
  }, [word]);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Ionicons name="arrow-back" size={24} color="#4A00E0" />
      </TouchableOpacity>

      <Text style={styles.wordTitle}>{word?.toString().toUpperCase() || "GLOSSARY"}</Text>
      <View style={styles.divider} />
      
      <Text style={styles.sectionLabel}>VANGUARD CONTEXT</Text>
      {loading ? (
        <ActivityIndicator color="#4A00E0" />
      ) : (
        <FlatList
          data={examples}
          renderItem={({ item }) => (
            <View style={styles.exampleCard}>
              <Text style={styles.bookTitle}>{item.title}</Text>
              <Text style={styles.usageSnippet}>"The depth of {word || 'this concept'} is explored in our archives..."</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No entries found.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 25, paddingTop: 60 },
  back: { marginBottom: 20 },
  wordTitle: { color: '#fff', fontSize: 32, fontWeight: '900' },
  divider: { height: 4, width: 60, backgroundColor: '#4A00E0', marginVertical: 20 },
  sectionLabel: { color: '#555', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 20 },
  exampleCard: { backgroundColor: '#111', padding: 20, borderRadius: 15, marginBottom: 15 },
  bookTitle: { color: '#4A00E0', fontWeight: 'bold', fontSize: 12, marginBottom: 5 },
  usageSnippet: { color: '#fff', fontSize: 14, fontStyle: 'italic' },
  empty: { color: '#333', textAlign: 'center', marginTop: 20 }
});