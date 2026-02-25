import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Platform, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const T = {
  bg: "#0F071A", ui: "#1E1135", ui2: "#2D1B4D",
  accent: "#FFD700", purpleLight: "#A78BFA",
  text: "#E2E8F0", muted: "#94A3B8",
};

const FAQS = [
  {
    q: "How do I publish a book?",
    a: "Go to your Profile tab and tap 'Publish Book'. Fill in the title, upload your manuscript and cover, set a price (or make it free), then tap Publish. Books go live immediately.",
  },
  {
    q: "What is a Weave?",
    a: "A Weave is a collaborative writing project. You can start one from any book page, invite other writers, and each person contributes to the same story from different perspectives.",
  },
  {
    q: "How do I join a reading group?",
    a: "Browse Active Groups on the home screen or search for a group. Tap on it and hit 'Join Group'. Private groups require the creator to approve your request.",
  },
  {
    q: "How does the paid book system work?",
    a: "Authors set a price in Naira (₦) when publishing. Readers pay once to access the full book. Writha takes a platform cut and the rest goes to the author.",
  },
  {
    q: "Can I read offline?",
    a: "Yes. On any book page, tap the download icon to save it to your device. You can then read it from the Archive even without internet.",
  },
  {
    q: "How do I delete a post or book?",
    a: "Open the post or book, tap the three-dot menu in the top right, and select Delete. This action is permanent and cannot be undone.",
  },
  {
    q: "Why was my research submission rejected?",
    a: "Research goes through admin review before going live. If rejected, you'll receive a notification with feedback explaining what needs to change. You can edit and resubmit.",
  },
  {
    q: "How do I report a user?",
    a: "Tap on their profile, then tap the three-dot menu and select 'Report'. Choose a reason and submit. Our team reviews all reports within 48 hours.",
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={T.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & FAQ</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Contact banner */}
        <View style={styles.contactBox}>
          <View style={styles.contactIcon}>
            <Ionicons name="headset-outline" size={28} color={T.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactTitle}>Still need help?</Text>
            <Text style={styles.contactSub}>Our support team usually replies within 24 hours.</Text>
          </View>
          <TouchableOpacity
            style={styles.contactBtn}
            onPress={() => Linking.openURL("mailto:support@writha.com")}
          >
            <Text style={styles.contactBtnTxt}>Email Us</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>FREQUENTLY ASKED QUESTIONS</Text>

        {FAQS.map((faq, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.faqItem, expanded === i && styles.faqItemActive]}
            onPress={() => setExpanded(expanded === i ? null : i)}
            activeOpacity={0.85}
          >
            <View style={styles.faqHeader}>
              <Text style={[styles.faqQ, expanded === i && { color: T.accent }]}>
                {faq.q}
              </Text>
              <Ionicons
                name={expanded === i ? "chevron-up" : "chevron-down"}
                size={18}
                color={expanded === i ? T.accent : T.muted}
              />
            </View>
            {expanded === i && (
              <Text style={styles.faqA}>{faq.a}</Text>
            )}
          </TouchableOpacity>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 20,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: T.ui, justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: T.text },
  scroll: { padding: 20 },
  contactBox: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: T.ui, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: T.accent + "30", marginBottom: 28,
  },
  contactIcon: {
    width: 50, height: 50, borderRadius: 14,
    backgroundColor: T.ui2, justifyContent: "center", alignItems: "center",
  },
  contactTitle: { color: T.text, fontWeight: "800", fontSize: 14 },
  contactSub: { color: T.muted, fontSize: 11, marginTop: 3, lineHeight: 16 },
  contactBtn: {
    backgroundColor: T.accent, paddingHorizontal: 14,
    paddingVertical: 10, borderRadius: 12,
  },
  contactBtnTxt: { color: "#000", fontWeight: "900", fontSize: 12 },
  sectionLabel: {
    color: T.accent, fontSize: 10, fontWeight: "900",
    letterSpacing: 2, marginBottom: 14,
  },
  faqItem: {
    backgroundColor: T.ui, borderRadius: 16, padding: 18,
    marginBottom: 10, borderWidth: 1, borderColor: T.ui2,
  },
  faqItemActive: { borderColor: T.accent + "40" },
  faqHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  faqQ: { color: T.text, fontSize: 14, fontWeight: "700", flex: 1, lineHeight: 20 },
  faqA: { color: T.muted, fontSize: 13, marginTop: 14, lineHeight: 21 },
});