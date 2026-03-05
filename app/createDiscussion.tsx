import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Switch, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";

const THEME = {
  bg: "#0F071A", ui: "#1E1135", ui2: "#2D1B4D",
  accent: "#FFD700", accentDim: "rgba(255,215,0,0.1)",
  purple: "#6D28D9", purpleLight: "#A78BFA",
  text: "#E2E8F0", textMuted: "#94A3B8",
  green: "#22C55E", red: "#EF4444", blue: "#38BDF8",
};

const MOODS = [
  "💡 Idea", "🔥 Hot Take", "🤔 Question",
  "📢 Announcement", "💬 Open Debate", "📚 Book Talk",
];

const SectionLabel = ({ label, icon }: { label: string; icon?: string }) => (
  <View style={styles.sectionLabel}>
    {icon && <Ionicons name={icon as any} size={14} color={THEME.accent} />}
    <Text style={styles.sectionLabelTxt}>{label}</Text>
  </View>
);

const SettingRow = ({
  icon, iconColor = THEME.purpleLight, title, subtitle,
  value, onValueChange, trackColor,
}: {
  icon: string; iconColor?: string; title: string; subtitle: string;
  value: boolean; onValueChange: (v: boolean) => void; trackColor?: string;
}) => (
  <View style={styles.settingRow}>
    <View style={[styles.settingIcon, { backgroundColor: iconColor + "20" }]}>
      <Ionicons name={icon as any} size={18} color={iconColor} />
    </View>
    <View style={styles.settingInfo}>
      <Text style={styles.settingTitle}>{title}</Text>
      <Text style={styles.settingSubtitle}>{subtitle}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: THEME.ui2, true: trackColor || THEME.purple }}
      thumbColor={value ? THEME.accent : THEME.textMuted}
    />
  </View>
);

// ── SUCCESS SCREEN ─────────────────────────────────────────────────────
const SuccessScreen = ({ onDone }: { onDone: () => void }) => (
  <View style={styles.successContainer}>
    <View style={styles.successIconCircle}>
      <Ionicons name="checkmark" size={48} color="#000" />
    </View>
    <Text style={styles.successTitle}>Discussion Posted! 🎉</Text>
    <Text style={styles.successSub}>
      Your discussion is now live on the Writha community feed.
    </Text>
    <TouchableOpacity style={styles.successBtn} onPress={onDone}>
      <Text style={styles.successBtnTxt}>Back to Feed</Text>
    </TouchableOpacity>
  </View>
);

export default function CreateDiscussion() {
  const router = useRouter();
  const user = auth.currentUser;
  if (!user) return null;

  const [content, setContent] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [publishToWeb, setPublishToWeb] = useState(false);
  const [allowComments, setAllowComments] = useState(true);
  const [loading, setLoading] = useState(false);
  const [posted, setPosted] = useState(false); // ── NEW

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const WORD_LIMIT = 500;
  const wordsRemaining = WORD_LIMIT - wordCount;
  const overLimit = wordCount > WORD_LIMIT;

  const handleChangeText = (text: string) => {
    setContent(text);
  };

  const handlePost = async () => {
    if (!content.trim()) {
      Alert.alert("Empty", "Please write something before posting.");
      return;
    }
    if (content.trim().length < 10) {
      Alert.alert("Too Short", "Discussion must be at least 10 characters.");
      return;
    }
    if (overLimit) {
      Alert.alert(
        "Word Limit Exceeded",
        `Your discussion is ${wordCount} words. Please trim it to 500 words or fewer.`
      );
      return;
    }

    setLoading(true);
    try {
      const payload = {
        content: content.trim(),
        mood,
        userId: user.uid,
        userName: user.displayName || "Scholar",
        userPhoto: user.photoURL || "",
        likesCount: 0,
        commentsCount: 0,
        likedBy: [],
        publishToWeb,
        allowComments,
        type: "discussion",
        createdAt: serverTimestamp(),
      };

      const discRef = await addDoc(collection(db, "discussions"), payload);
      await addDoc(collection(db, "feed"), { ...payload, originalId: discRef.id });
      await updateDoc(doc(db, "users", user.uid), {
        discussionCount: increment(1),
      });

      setPosted(true); // ── SHOW SUCCESS SCREEN instead of Alert
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── SHOW SUCCESS SCREEN AFTER POSTING ─────────────────────────────
  if (posted) {
    return (
      <View style={styles.container}>
        <SuccessScreen onDone={() => router.replace("/(tabs)" as any)} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => {
            if (content) {
              Alert.alert("Discard?", "You have unsaved content.", [
                { text: "Keep Editing", style: "cancel" },
                { text: "Discard", style: "destructive", onPress: () => router.replace("/(tabs)" as any) },
              ]);
            } else {
              router.replace("/(tabs)" as any);
            }
          }}
        >
          <Ionicons name="close" size={22} color={THEME.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.typeBadge}>
            <Ionicons name="chatbubbles-outline" size={14} color="#000" />
            <Text style={styles.typeBadgeTxt}>DISCUSSION</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.postBtn, (!content.trim() || loading || overLimit) && { opacity: 0.4 }]}
          onPress={handlePost}
          disabled={!content.trim() || loading || overLimit}
        >
          {loading
            ? <ActivityIndicator color="#000" size="small" />
            : <Text style={styles.postBtnTxt}>POST</Text>
          }
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* USER ROW */}
          <View style={styles.userRow}>
            {user.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.userAvatar} />
            ) : (
              <View style={[styles.userAvatar, styles.userAvatarFallback]}>
                <Text style={styles.userAvatarInitial}>
                  {(user.displayName || "W")[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.userName}>{user.displayName || "Scholar"}</Text>
              <Text style={styles.userHandle}>Posting to Writha Community</Text>
            </View>
          </View>

          {/* MOOD */}
          <SectionLabel label="WHAT KIND OF POST IS THIS?" icon="pricetag-outline" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moodRow}>
            {MOODS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.moodPill, mood === m && styles.moodPillActive]}
                onPress={() => setMood(mood === m ? null : m)}
              >
                <Text style={[styles.moodPillTxt, mood === m && styles.moodPillTxtActive]}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* CONTENT */}
          <SectionLabel label="YOUR DISCUSSION" icon="create-outline" />
          <View style={styles.discInputWrap}>
            <TextInput
              style={styles.discInput}
              placeholder="What's on your scholarly mind? Start a debate, share an idea, ask a question..."
              placeholderTextColor={THEME.textMuted}
              multiline
              value={content}
              onChangeText={handleChangeText}
              autoFocus
            />
            <View style={styles.discInputFooter}>
              <View style={styles.wordCountWrap}>
                <Text style={[
                  styles.wordCountTxt,
                  overLimit ? { color: THEME.red } : wordsRemaining <= 50 ? { color: THEME.accent } : {},
                ]}>
                  {overLimit
                    ? `${Math.abs(wordsRemaining)} words over limit`
                    : `${wordsRemaining} words remaining`
                  }
                </Text>
                <Text style={[
                  styles.wordCountNum,
                  overLimit ? { color: THEME.red } : {},
                ]}>
                  {wordCount} / {WORD_LIMIT}
                </Text>
              </View>
              <View style={styles.wordBar}>
                <View style={[
                  styles.wordBarFill,
                  {
                    width: `${Math.min((wordCount / WORD_LIMIT) * 100, 100)}%` as any,
                    backgroundColor: overLimit ? THEME.red : wordCount > 400 ? THEME.accent : THEME.green,
                  },
                ]} />
              </View>
            </View>
          </View>

          {/* SETTINGS */}
          <SectionLabel label="POST SETTINGS" icon="settings-outline" />
          <SettingRow
            icon="globe-outline" iconColor={THEME.blue}
            title="Publish to Web"
            subtitle="Visible on the public Writha website"
            value={publishToWeb} onValueChange={setPublishToWeb}
            trackColor={THEME.blue}
          />
          <SettingRow
            icon="chatbubbles-outline" iconColor={THEME.purpleLight}
            title="Allow Comments"
            subtitle="Let the community reply to your post"
            value={allowComments} onValueChange={setAllowComments}
          />

          {publishToWeb && (
            <View style={styles.webInfoBox}>
              <Ionicons name="globe" size={16} color={THEME.blue} />
              <Text style={styles.webInfoTxt}>
                This discussion will appear on writha.com and may be indexed by search engines.
              </Text>
            </View>
          )}

          {/* POST BUTTON */}
          <TouchableOpacity
            style={[styles.primaryBtn, (!content.trim() || loading || overLimit) && { opacity: 0.6 }]}
            onPress={handlePost}
            disabled={!content.trim() || loading || overLimit}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#000" />
                <Text style={styles.primaryBtnTxt}>POST DISCUSSION</Text>
              </>
            )}
          </TouchableOpacity>

          {/* GUIDELINES */}
          <View style={styles.guidelinesBox}>
            <Text style={styles.guidelinesTitle}>📋 Discussion Guidelines</Text>
            <Text style={styles.guidelinesTxt}>
              • Be respectful and constructive{"\n"}
              • No spam, hate speech, or misinformation{"\n"}
              • Stay on topic — this is a scholarly community{"\n"}
              • Maximum 500 words per discussion{"\n"}
              • Posts violating guidelines will be removed
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: {
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingHorizontal: 16, paddingBottom: 16,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: THEME.ui, borderBottomWidth: 1, borderBottomColor: THEME.ui2,
  },
  closeBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: THEME.ui2, justifyContent: "center", alignItems: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  typeBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: THEME.accent, paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 12,
  },
  typeBadgeTxt: { color: "#000", fontWeight: "900", fontSize: 12, letterSpacing: 1 },
  postBtn: {
    backgroundColor: THEME.accent, paddingHorizontal: 18,
    paddingVertical: 10, borderRadius: 12,
  },
  postBtnTxt: { color: "#000", fontWeight: "900", fontSize: 13 },
  scroll: { padding: 16, paddingBottom: 60 },
  sectionLabel: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 24, marginBottom: 10,
  },
  sectionLabelTxt: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  userAvatar: { width: 44, height: 44, borderRadius: 13, borderWidth: 2, borderColor: THEME.accent },
  userAvatarFallback: { backgroundColor: THEME.purple, justifyContent: "center", alignItems: "center" },
  userAvatarInitial: { color: THEME.accent, fontWeight: "900", fontSize: 18 },
  userName: { color: THEME.text, fontWeight: "800", fontSize: 15 },
  userHandle: { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  moodRow: { marginBottom: 8 },
  moodPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2, marginRight: 8,
  },
  moodPillActive: { backgroundColor: THEME.accentDim, borderColor: THEME.accent },
  moodPillTxt: { color: THEME.textMuted, fontSize: 13, fontWeight: "600" },
  moodPillTxtActive: { color: THEME.accent },
  discInputWrap: {
    backgroundColor: THEME.ui, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: THEME.ui2,
  },
  discInput: {
    color: THEME.text, fontSize: 16, lineHeight: 26,
    minHeight: 180, textAlignVertical: "top",
  },
  discInputFooter: {
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: THEME.ui2, gap: 8,
  },
  wordCountWrap: { flexDirection: "row", justifyContent: "space-between" },
  wordCountTxt: { color: THEME.textMuted, fontSize: 11 },
  wordCountNum: { color: THEME.textMuted, fontSize: 11, fontWeight: "700" },
  wordBar: { height: 3, backgroundColor: THEME.ui2, borderRadius: 2, overflow: "hidden" },
  wordBarFill: { height: "100%", borderRadius: 2 },
  settingRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui,
    borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: THEME.ui2,
  },
  settingIcon: {
    width: 38, height: 38, borderRadius: 11,
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  settingInfo: { flex: 1, marginRight: 10 },
  settingTitle: { color: THEME.text, fontWeight: "800", fontSize: 14 },
  settingSubtitle: { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  webInfoBox: {
    flexDirection: "row", gap: 10, backgroundColor: THEME.blue + "15",
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: THEME.blue + "30",
    alignItems: "flex-start", marginBottom: 10,
  },
  webInfoTxt: { color: THEME.textMuted, fontSize: 12, flex: 1, lineHeight: 18 },
  primaryBtn: {
    backgroundColor: THEME.accent, borderRadius: 18, padding: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, marginTop: 24,
  },
  primaryBtnTxt: { color: "#000", fontWeight: "900", fontSize: 14, letterSpacing: 1 },
  guidelinesBox: {
    backgroundColor: THEME.ui, borderRadius: 16, padding: 18,
    marginTop: 20, borderWidth: 1, borderColor: THEME.ui2,
  },
  guidelinesTitle: { color: THEME.text, fontWeight: "900", fontSize: 13, marginBottom: 10 },
  guidelinesTxt: { color: THEME.textMuted, fontSize: 12, lineHeight: 22 },

  // ── SUCCESS SCREEN STYLES ──────────────────────────────────────────
  successContainer: {
    flex: 1, justifyContent: "center", alignItems: "center",
    padding: 40, gap: 20,
  },
  successIconCircle: {
    width: 100, height: 100, borderRadius: 30,
    backgroundColor: THEME.accent, justifyContent: "center", alignItems: "center",
    marginBottom: 8,
  },
  successTitle: { color: THEME.text, fontSize: 26, fontWeight: "900", textAlign: "center" },
  successSub: { color: THEME.textMuted, fontSize: 14, textAlign: "center", lineHeight: 22 },
  successBtn: {
    backgroundColor: THEME.accent, paddingHorizontal: 40,
    paddingVertical: 16, borderRadius: 18, marginTop: 16,
  },
  successBtnTxt: { color: "#000", fontWeight: "900", fontSize: 15 },
});