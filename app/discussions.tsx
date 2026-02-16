import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function GenericActivityScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={26} color="#4A00E0" /></TouchableOpacity>
        <Text style={styles.title}>The Collective Archive</Text>
      </View>
      <View style={styles.empty}>
        <Ionicons name="journal-outline" size={80} color="#F0F0F0" />
        <Text style={styles.emptyText}>Nothing has echoed here yet.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 25, paddingTop: 60, flexDirection: 'row', alignItems: 'center', gap: 15 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#4A00E0' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { color: '#AAA', textAlign: 'center', marginTop: 20, fontSize: 16 }
});