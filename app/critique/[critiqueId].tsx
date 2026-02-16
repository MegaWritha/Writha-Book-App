import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, SafeAreaView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Ionicons } from "@expo/vector-icons";

export default function CritiqueView() {
  const { critiqueId } = useLocalSearchParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchCritique = async () => {
      const docSnap = await getDoc(doc(db, "discover", critiqueId as string));
      if (docSnap.exists()) setData(docSnap.data());
    };
    fetchCritique();
  }, [critiqueId]);

  if (!data) return <View style={styles.container}><Text style={styles.loading}>Opening Scroll...</Text></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.navType}>{data.type?.toUpperCase()}</Text>
        <Ionicons name="share-outline" size={24} color="#8E2DE2" />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{data.title}</Text>
        <View style={styles.authorRow}>
          <View style={styles.dot} />
          <Text style={styles.authorName}>By {data.authorName}</Text>
          {data.bookTitle && <Text style={styles.bookLink}>on {data.bookTitle}</Text>}
        </View>

        <Text style={styles.bodyText}>{data.excerpt}</Text>
        {/* Full content would go here */}
        <View style={styles.divider} />
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>Published via {data.groupName || "Writha Hub"}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050505" },
  loading: { color: "#8E2DE2", textAlign: "center", marginTop: 50, fontWeight: "bold" },
  nav: { flexDirection: "row", justifyContent: "space-between", padding: 20, alignItems: "center" },
  navType: { color: "#8E2DE2", fontWeight: "900", letterSpacing: 2, fontSize: 12 },
  scrollContent: { padding: 25 },
  title: { color: "#FFF", fontSize: 32, fontWeight: "900", lineHeight: 40, marginBottom: 20 },
  authorRow: { flexDirection: "row", alignItems: "center", marginBottom: 30 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#D4AF37", marginRight: 10 },
  authorName: { color: "#AAA", fontWeight: "700" },
  bookLink: { color: "#8E2DE2", marginLeft: 5, fontWeight: "700" },
  bodyText: { color: "#EEE", fontSize: 18, lineHeight: 30, letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: "#222", marginVertical: 40 },
  footer: { alignItems: "center", paddingBottom: 50 },
  footerText: { color: "#444", fontWeight: "bold", fontSize: 12, letterSpacing: 1 }
});