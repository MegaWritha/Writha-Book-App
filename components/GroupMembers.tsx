import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";

export default function GroupMembers({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;

    // This fetches REAL members from your Firebase sub-collection
    const q = query(collection(db, "groups", groupId, "members"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const memberList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMembers(memberList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [groupId]);

  if (loading) return <ActivityIndicator color="#8E2DE2" style={{ marginTop: 20 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ACTIVE WEAVERS ({members.length})</Text>
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.card} 
            onPress={() => router.push({ pathname: "/user/[id]", params: { id: item.id } } as any)}
          >
            <View style={[styles.avatar, { backgroundColor: item.color || "#8E2DE2" }]}>
              <Text style={styles.avatarText}>{item.name?.[0] || "W"}</Text>
            </View>
            <View style={styles.content}>
              <View>
                <Text style={styles.name}>{item.name || "Unknown Weaver"}</Text>
                <Text style={styles.role}>{item.role || "Member"}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No other weavers in this loom yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#000" },
  title: { color: "#444", fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 20 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#111", padding: 15, borderRadius: 15, marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginRight: 15 },
  avatarText: { color: "#FFF", fontWeight: "bold" },
  content: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: "#FFF", fontWeight: "700" },
  role: { color: "#8E2DE2", fontSize: 12 },
  chevron: { color: "#444", fontSize: 24 },
  empty: { color: "#444", textAlign: 'center', marginTop: 20 }
});