// app/privacy-policy.tsx
import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const T = { bg: "#0F071A", ui: "#1E1135", accent: "#FFD700", text: "#E2E8F0", muted: "#94A3B8" };

const SECTIONS = [
  { title: "Information We Collect", body: "We collect information you provide directly: name, email address, profile photo, and content you create. We also collect usage data such as pages viewed and features used to improve the app." },
  { title: "How We Use Your Information", body: "Your information is used to provide and improve the Writha service, communicate with you about your account, personalise your reading and writing experience, and process payments for paid content." },
  { title: "Data Sharing", body: "We do not sell your personal data. We share data only with service providers necessary to operate Writha (such as Firebase for database and storage), and when required by law." },
  { title: "Your Content", body: "Content you publish publicly on Writha (books, discussions, articles) is visible to other users. Private drafts and account details are only accessible to you." },
  { title: "Data Retention", body: "We retain your data for as long as your account is active. When you delete your account, your personal data is removed within 30 days, though some data may be retained in backups for up to 90 days." },
  { title: "Security", body: "We use industry-standard security measures including encryption in transit and at rest. However, no system is completely secure, and we cannot guarantee absolute security." },
  { title: "Children's Privacy", body: "Writha is not intended for users under 13. We do not knowingly collect data from children. If you believe a child has created an account, contact us immediately." },
  { title: "Contact Us", body: "For privacy-related questions or requests, email us at privacy@writha.com." },
];

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={T.accent} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.lastUpdated}>Last updated: January 2025</Text>
        <Text style={s.intro}>
          MegaWritha Limited ("Writha") is committed to protecting your privacy.
          This policy explains what data we collect and how we use it.
        </Text>
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
  lastUpdated: { color: T.muted, fontSize: 12, marginBottom: 8 },
  intro: { color: T.muted, fontSize: 14, lineHeight: 22, marginBottom: 24 },
  section: { marginBottom: 24 },
  secTitle: { color: T.accent, fontSize: 13, fontWeight: "900", marginBottom: 8 },
  secBody: { color: T.muted, fontSize: 14, lineHeight: 22 },
});