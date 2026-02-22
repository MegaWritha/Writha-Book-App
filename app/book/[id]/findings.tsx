import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

const THEME = {
  bg: "#0F071A", ui: "#1E1135", ui2: "#2D1B4D",
  accent: "#FFD700", purple: "#6D28D9", purpleLight: "#A78BFA",
  text: "#EDE8F5", textMuted: "#7A6E8A", green: "#22C55E",
};

const CATEGORIES = [
  { key: "insight",   label: "💡 Insight",     color: "#FFD700" },
  { key: "critique",  label: "🔍 Critique",    color: "#38BDF8" },
  { key: "question",  label: "❓ Question",    color: "#A78BFA" },
  { key: "context",   label: "🌍 Context",     color: "#22C55E" },
  { key: "theory",    label: "🧠 Theory",      color: "#F59E0B" },
  { key: "personal",  label: "✍️ Personal",    color: "#EF4444" },
];

export default function PublishFinding() {
  const { id, quote, bookTitle } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = auth.currentUser;

  const [commentary, setCommentary] = useState("");
  const [category, setCategory] = useState("insight");
  const [shareToFeed, setShareToFeed] = useState(true);
  const [loading, setLoading] = useState(false);

  const selectedCat = CATEGORIES.find((c) => c.key === category)!;
  const wordCount = commentary.trim() ? commentary.trim().split(/\s+/).length : 0;

  const handlePublish = async () => {
    if (!commentary.trim())
      return Alert.alert("Add Your Insight", "Share your intellectual finding before publishing.");
    if (wordCount < 5)
      return Alert.alert("Too Brief", "Add at least a few sentences to your finding.");

    setLoading(true);
    try {
      const payload = {
        claim: quote || "General Finding",
        commentary: commentary.trim(),
        category,
        bookId: id,
        bookTitle: bookTitle || "Unknown Book",
        creatorId: user?.uid,
        creatorName: user?.displayName || "Anonymous Scholar",
        creatorPhoto: user?.photoURL || null,
        createdAt: serverTimestamp(),
        likesCount: 0,
        likedBy: [],
        commentsCount: 0,
      };

      // Save to weaves collection
      const weaveRef = await addDoc(collection(db, "weaves"), payload);

      // Share to global feed if toggled
      if (shareToFeed) {
        await addDoc(collection(db, "feed"), {
          ...payload,
          type: "weave",
          title: `Finding from "${bookTitle}"`,
          content: commentary.trim(),
          originalId: weaveRef.id,
          userId: user?.uid,
          userName: user?.displayName || "Scholar",
          userPhoto: user?.photoURL || null,
        });
      }

      // Increment book's weave count
      if (id) {
        await updateDoc(doc(db, "books", id as string), {
          weavesCount: increment(1),
        });
      }

      Alert.alert(
        "Woven! 🧵",
        shareToFeed
          ? "Your finding has been added to the Vanguard and shared to the feed."
          : "Your finding has been added to the Vanguard.",
        [{ text: "Done", onPress: () => router.back() }]
      );
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not publish your finding.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* HEADER */}
      <LinearGradient
        colors={["#1A0B2E", THEME.bg]}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={THEME.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerSmall}>INTELLECTUAL WEAVE</Text>
          <Text style={styles.headerTitle}>Publish Finding</Text>
        </View>
        <TouchableOpacity
          style={[styles.publishBtn, (loading || !commentary.trim()) && { opacity: 0.5 }]}
          onPress={handlePublish}
          disabled={loading || !commentary.trim()}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.publishBtnTxt}>WEAVE</Text>
          )}
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* HIGHLIGHTED QUOTE */}
        {quote && (
          <View style={styles.quoteCard}>
            <View style={styles.quoteBar} />
            <View style={styles.quoteContent}>
              <Text style={styles.quoteLabel}>HIGHLIGHTED PASSAGE</Text>
              <Text style={styles.quoteText}>"{quote}"</Text>
              {bookTitle && (
                <Text style={styles.quoteBook}>— {bookTitle}</Text>
              )}
            </View>
          </View>
        )}

        {/* CATEGORY PICKER */}
        <Text style={styles.sectionLabel}>FINDING TYPE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.categoryPill,
                  category === cat.key && { backgroundColor: cat.color + "25", borderColor: cat.color },
                ]}
                onPress={() => setCategory(cat.key)}
              >
                <Text style={[
                  styles.categoryPillTxt,
                  category === cat.key && { color: cat.color },
                ]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* COMMENTARY INPUT */}
        <Text style={styles.sectionLabel}>YOUR INSIGHT</Text>
        <View style={styles.commentaryCard}>
          <TextInput
            style={styles.commentaryInput}
            placeholder={"What does this mean to you?\n\nHow does this connect to the modern African context, to society, to your own life?\n\nAnalyse, critique, celebrate, question..."}
            placeholderTextColor={THEME.textMuted}
            multiline
            value={commentary}
            onChangeText={setCommentary}
            textAlignVertical="top"
            maxLength={2000}
          />
          <View style={styles.wordCountRow}>
            <Text style={[
              styles.wordCountTxt,
              wordCount >= 5 ? { color: THEME.green } : { color: THEME.textMuted },
            ]}>
              {wordCount} words {wordCount >= 5 ? "✓" : `(min 5)`}
            </Text>
            <Text style={styles.charCountTxt}>{commentary.length}/2000</Text>
          </View>
        </View>

        {/* SHARE TO FEED TOGGLE */}
        <TouchableOpacity
          style={styles.toggleCard}
          onPress={() => setShareToFeed(!shareToFeed)}
          activeOpacity={0.85}
        >
          <View style={styles.toggleLeft}>
            <View style={[styles.toggleIcon, { backgroundColor: shareToFeed ? THEME.accent + "20" : THEME.ui2 }]}>
              <MaterialCommunityIcons
                name="broadcast"
                size={18}
                color={shareToFeed ? THEME.accent : THEME.textMuted}
              />
            </View>
            <View>
              <Text style={styles.toggleTitle}>Share to Pulse Feed</Text>
              <Text style={styles.toggleSub}>Visible to all Writha readers</Text>
            </View>
          </View>
          <View style={[styles.toggleDot, shareToFeed && styles.toggleDotActive]}>
            <View style={[styles.toggleInner, shareToFeed && styles.toggleInnerActive]} />
          </View>
        </TouchableOpacity>

        {/* TIPS */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsLabel}>💡 GREAT FINDINGS...</Text>
          <Text style={styles.tipsTxt}>
            • Connect the text to real-world events or history{"\n"}
            • Challenge or support the author's argument{"\n"}
            • Draw parallels to other works or ideas{"\n"}
            • Ask a question that invites discussion
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.05)", justifyContent: "center", alignItems: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerSmall: { color: THEME.accent, fontSize: 9, fontWeight: "900", letterSpacing: 3 },
  headerTitle: { color: THEME.text, fontSize: 16, fontWeight: "900", marginTop: 3 },
  publishBtn: { backgroundColor: THEME.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  publishBtnTxt: { color: "#000", fontWeight: "900", fontSize: 12 },
  content: { padding: 16 },
  quoteCard: { flexDirection: "row", backgroundColor: THEME.ui, borderRadius: 18, overflow: "hidden", marginBottom: 24, borderWidth: 1, borderColor: THEME.ui2 },
  quoteBar: { width: 4, backgroundColor: THEME.accent },
  quoteContent: { flex: 1, padding: 16 },
  quoteLabel: { color: THEME.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 2, marginBottom: 8 },
  quoteText: { color: THEME.text, fontSize: 15, fontStyle: "italic", lineHeight: 23 },
  quoteBook: { color: THEME.accent, fontSize: 11, fontWeight: "700", marginTop: 10 },
  sectionLabel: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 10, marginTop: 4 },
  categoryRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  categoryPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: THEME.ui, borderWidth: 1.5, borderColor: THEME.ui2 },
  categoryPillTxt: { color: THEME.textMuted, fontWeight: "700", fontSize: 12 },
  commentaryCard: { backgroundColor: THEME.ui, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: THEME.ui2, marginBottom: 14 },
  commentaryInput: { color: THEME.text, fontSize: 15, lineHeight: 24, minHeight: 200, textAlignVertical: "top" },
  wordCountRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: THEME.ui2 },
  wordCountTxt: { fontSize: 11, fontWeight: "700" },
  charCountTxt: { color: THEME.textMuted, fontSize: 11 },
  toggleCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: THEME.ui, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: THEME.ui2, marginBottom: 14 },
  toggleLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleIcon: { width: 40, height: 40, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  toggleTitle: { color: THEME.text, fontWeight: "800", fontSize: 14 },
  toggleSub: { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  toggleDot: { width: 44, height: 26, borderRadius: 13, backgroundColor: THEME.ui2, justifyContent: "center", paddingHorizontal: 3 },
  toggleDotActive: { backgroundColor: THEME.purple },
  toggleInner: { width: 20, height: 20, borderRadius: 10, backgroundColor: THEME.textMuted },
  toggleInnerActive: { backgroundColor: THEME.accent, alignSelf: "flex-end" },
  tipsCard: { backgroundColor: THEME.ui, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: THEME.ui2 },
  tipsLabel: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 1, marginBottom: 10 },
  tipsTxt: { color: THEME.textMuted, fontSize: 13, lineHeight: 22 },
});