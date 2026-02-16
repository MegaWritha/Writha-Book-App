import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function BookResearch() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.brandText}>RESEARCH CELL</Text>
          <Text style={styles.title}>The Evidence Board</Text>
        </View>

        {/* CATEGORIES */}
        <View style={styles.grid}>
          {[
            { label: "Motifs", icon: "prism", color: "#8E2DE2" },
            { label: "Historical Context", icon: "hourglass", color: "#D4AF37" },
            { label: "Character Traces", icon: "finger-print", color: "#6B4EFF" },
            { label: "Critical Theory", icon: "infinite", color: "#FF3366" },
          ].map((item, i) => (
            <TouchableOpacity key={i} style={styles.card}>
              <Ionicons name={item.icon as any} size={28} color={item.color} />
              <Text style={styles.cardLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Draft Findings</Text>
          <View style={styles.draftCard}>
            <Text style={styles.draftText}>"The repetition of water imagery in Chapter 3..."</Text>
            <TouchableOpacity style={styles.editBtn}>
              <Text style={styles.editBtnText}>Contribute</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  scroll: { padding: 25 },
  header: { marginTop: 40, marginBottom: 30 },
  brandText: { color: "#8E2DE2", fontSize: 10, fontWeight: "900", letterSpacing: 3 },
  title: { color: "#FFF", fontSize: 32, fontWeight: "900" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 15 },
  card: { 
    width: "47%", 
    backgroundColor: "#111", 
    padding: 20, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: "#222",
    alignItems: 'center'
  },
  cardLabel: { color: "#FFF", marginTop: 10, fontWeight: "700", fontSize: 13 },
  section: { marginTop: 40 },
  sectionTitle: { color: "#8E2DE2", fontWeight: "900", letterSpacing: 2, marginBottom: 15 },
  draftCard: { backgroundColor: "#111", padding: 20, borderRadius: 20, borderLeftWidth: 4, borderLeftColor: "#D4AF37" },
  draftText: { color: "#AAA", fontStyle: "italic", lineHeight: 22 },
  editBtn: { marginTop: 15, alignSelf: 'flex-start' },
  editBtnText: { color: "#FFF", fontWeight: "bold", textDecorationLine: 'underline' }
});