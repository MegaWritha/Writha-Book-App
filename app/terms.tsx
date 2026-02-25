// app/terms.tsx
import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const T = { bg: "#0F071A", ui: "#1E1135", ui2: "#2D1B4D", accent: "#FFD700", text: "#E2E8F0", muted: "#94A3B8" };

const SECTIONS = [
  { title: "1. Acceptance of Terms", body: "By creating an account or using Writha, you agree to be bound by these Terms of Service. If you do not agree, please do not use the app." },
  { title: "2. User Accounts", body: "You are responsible for maintaining the security of your account and password. Writha cannot be held responsible for losses resulting from unauthorised use of your account." },
  { title: "3. Content Ownership", body: "You retain full ownership of all content you publish on Writha, including books, articles, weaves, and discussions. By publishing, you grant Writha a non-exclusive licence to display your content within the platform." },
  { title: "4. Prohibited Content", body: "You may not publish content that is defamatory, obscene, harassing, or infringes on the intellectual property rights of others. Writha reserves the right to remove content that violates these guidelines." },
  { title: "5. Paid Content", body: "Authors set their own prices for books and research. Writha collects a platform fee on transactions. All payments are final unless a technical error occurred on our side." },
  { title: "6. Termination", body: "Writha reserves the right to suspend or terminate accounts that violate these terms at any time, with or without prior notice." },
  { title: "7. Changes to Terms", body: "We may update these terms from time to time. Continued use of the app after changes constitutes acceptance of the new terms." },
  { title: "8. Contact", body: "For questions about these terms, contact us at legal@writha.com." },
];

export default function TermsScreen() {
  const router = useRouter();
  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={T.accent} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Terms of Service</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.lastUpdated}>Last updated: January 2025</Text>
        {SECTIONS.map((sec) => (
          <View key={sec.title} style={s.section}>
            <Text style={s.secTitle}>{sec.title}</Text>
            <Text style={s.secBody}>{sec.body}</Text>
          </View>
        ))}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: T.ui, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: T.text },
  scroll: { padding: 24 },
  lastUpdated: { color: T.muted, fontSize: 12, marginBottom: 24 },
  section: { marginBottom: 24 },
  secTitle: { color: T.accent, fontSize: 13, fontWeight: "900", marginBottom: 8 },
  secBody: { color: T.muted, fontSize: 14, lineHeight: 22 },
});