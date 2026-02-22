import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { auth, db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#0F071A",
  ui: "#1E1135",
  ui2: "#2D1B4D",
  accent: "#FFD700",
  accentDim: "rgba(255,215,0,0.1)",
  purple: "#6D28D9",
  purpleLight: "#A78BFA",
  text: "#E2E8F0",
  textMuted: "#94A3B8",
  green: "#22C55E",
  red: "#EF4444",
  blue: "#38BDF8",
};

type CreateMode = "DISCUSSION" | "RESEARCH";
type ResearchMethod = "MANUAL" | "PDF" | "SCRIPT";

const RESEARCH_CATEGORIES = [
  "Research Paper", "Thesis", "Case Study", "Literature Review",
  "Technical Report", "White Paper", "Essay", "Dissertation",
];

const FIELDS_OF_STUDY = [
  "Computer Science", "Medicine", "Law", "Economics",
  "Literature", "Philosophy", "Engineering", "Psychology",
  "History", "Biology", "Chemistry", "Mathematics", "Other",
];

// ── SECTION LABEL ─────────────────────────────────────────────────────────
const SectionLabel = ({ label, icon }: { label: string; icon?: string }) => (
  <View style={styles.sectionLabel}>
    {icon && <Ionicons name={icon as any} size={14} color={THEME.accent} />}
    <Text style={styles.sectionLabelTxt}>{label}</Text>
  </View>
);

// ── SETTING ROW ───────────────────────────────────────────────────────────
const SettingRow = ({
  icon, iconColor = THEME.purpleLight, title, subtitle, value, onValueChange, trackColor,
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

// ── MAIN SCREEN ───────────────────────────────────────────────────────────
export default function CreateHub() {
  const router = useRouter();
  const user = auth.currentUser;
  if (!user) return null;

  const [mode, setMode] = useState<CreateMode>("DISCUSSION");
  const [loading, setLoading] = useState(false);

  // ── DISCUSSION STATE ───────────────────────────────────────────────────
  const [discContent, setDiscContent] = useState("");
  const [discMood, setDiscMood] = useState<string | null>(null);
  const [discPublishToWeb, setDiscPublishToWeb] = useState(false);
  const [discAllowComments, setDiscAllowComments] = useState(true);

  // ── RESEARCH STATE ─────────────────────────────────────────────────────
  const [resMethod, setResMethod] = useState<ResearchMethod>("MANUAL");
  const [resTitle, setResTitle] = useState("");
  const [resAbstract, setResAbstract] = useState("");
  const [resCategory, setResCategory] = useState("Research Paper");
  const [resField, setResField] = useState("");
  const [resInstitution, setResInstitution] = useState("");
  const [resTags, setResTags] = useState<string[]>([]);
  const [resTagInput, setResTagInput] = useState("");
  const [resIsPaid, setResIsPaid] = useState(false);
  const [resPrice, setResPrice] = useState("");
  const [resPublishToWeb, setResPublishToWeb] = useState(false);
  const [resAllowComments, setResAllowComments] = useState(true);
  const [resManualContent, setResManualContent] = useState("");
  const [resScriptContent, setResScriptContent] = useState("");
  const [resPdfUrl, setResPdfUrl] = useState<string | null>(null);
  const [resPdfName, setResPdfName] = useState<string | null>(null);
  const [resPdfSize, setResPdfSize] = useState<number | null>(null);
  const [resCoverUri, setResCoverUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const MOODS = ["💡 Idea", "🔥 Hot Take", "🤔 Question", "📢 Announcement", "💬 Open Debate", "📚 Book Talk"];

  // ── WORD COUNT ─────────────────────────────────────────────────────────
  const discWordCount = discContent.trim() ? discContent.trim().split(/\s+/).length : 0;
  const resWordCount = resManualContent.trim() ? resManualContent.trim().split(/\s+/).length : 0;

  // ── DISCUSSION HANDLERS ────────────────────────────────────────────────
  const handlePostDiscussion = async () => {
    if (!discContent.trim()) {
      Alert.alert("Empty", "Please write something before posting.");
      return;
    }
    if (discContent.trim().length < 10) {
      Alert.alert("Too Short", "Discussion must be at least 10 characters.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        content: discContent.trim(),
        mood: discMood,
        userId: user.uid,
        userName: user.displayName || "Scholar",
        userPhoto: user.photoURL || "",
        likesCount: 0,
        commentsCount: 0,
        likedBy: [],
        publishToWeb: discPublishToWeb,
        allowComments: discAllowComments,
        type: "discussion",
        createdAt: serverTimestamp(),
      };

      // Write to discussions collection
      const discRef = await addDoc(collection(db, "discussions"), payload);

      // Mirror to global feed
      await addDoc(collection(db, "feed"), {
        ...payload,
        originalId: discRef.id,
      });

      // Increment user post count
      await updateDoc(doc(db, "users", user.uid), {
        discussionCount: increment(1),
      });

      Alert.alert("Posted! 🎉", "Your discussion is live.", [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── PDF PICKER ─────────────────────────────────────────────────────────
  const pickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        const sizeInMB = (file.size || 0) / (1024 * 1024);
        if (sizeInMB > 20) {
          Alert.alert("File Too Large", "PDF must be under 20MB.");
          return;
        }
        setResPdfName(file.name);
        setResPdfSize(file.size || null);

        // Upload to Firebase Storage
        setUploading(true);
        const response = await fetch(file.uri);
        const blob = await response.blob();
        const storage = getStorage();
        const storageRef = ref(storage, `research/${user.uid}/${Date.now()}.pdf`);
        await uploadBytes(storageRef, blob);
        const downloadUrl = await getDownloadURL(storageRef);
        setResPdfUrl(downloadUrl);
        setUploading(false);
      }
    } catch (e) {
      setUploading(false);
      Alert.alert("Error", "Failed to upload PDF.");
    }
  };

  // ── COVER IMAGE PICKER ─────────────────────────────────────────────────
  const pickCover = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setResCoverUri(result.assets[0].uri);
    }
  };

  // ── TAGS ───────────────────────────────────────────────────────────────
  const addTag = () => {
    const t = resTagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !resTags.includes(t) && resTags.length < 6) {
      setResTags([...resTags, t]);
      setResTagInput("");
    }
  };

  // ── RESEARCH VALIDATION ────────────────────────────────────────────────
  const validateResearch = (): string | null => {
    if (!resTitle.trim() || resTitle.trim().length < 5) return "Title must be at least 5 characters.";
    if (!resAbstract.trim() || resAbstract.trim().length < 50) return "Abstract must be at least 50 characters.";
    if (!resField) return "Please select a field of study.";
    if (resIsPaid && (!resPrice || parseFloat(resPrice) <= 0)) return "Enter a valid price.";
    if (resMethod === "MANUAL" && resManualContent.trim().length < 300) return "Research body must be at least 300 characters.";
    if (resMethod === "SCRIPT" && !resScriptContent.trim()) return "Script content cannot be empty.";
    if (resMethod === "PDF" && !resPdfUrl) return "Please upload your PDF first.";
    return null;
  };

  // ── RESEARCH SUBMIT ────────────────────────────────────────────────────
  const handleSubmitResearch = async (status: "draft" | "pending") => {
    if (status === "pending") {
      const err = validateResearch();
      if (err) { Alert.alert("Validation Error", err); return; }
    } else {
      if (!resTitle.trim()) { Alert.alert("Title Required", "Add a title to save your draft."); return; }
    }

    setLoading(true);
    try {
      const parsedPrice = resIsPaid ? parseFloat(resPrice) : 0;

      // Upload cover if selected
      let coverUrl: string | null = null;
      if (resCoverUri) {
        const response = await fetch(resCoverUri);
        const blob = await response.blob();
        const storage = getStorage();
        const storageRef = ref(storage, `research-covers/${user.uid}/${Date.now()}.jpg`);
        await uploadBytes(storageRef, blob);
        coverUrl = await getDownloadURL(storageRef);
      }

      const payload = {
        userId: user.uid,
        userName: user.displayName || "Scholar",
        userPhoto: user.photoURL || "",
        title: resTitle.trim(),
        abstract: resAbstract.trim(),
        category: resCategory,
        fieldOfStudy: resField,
        institution: resInstitution.trim(),
        tags: resTags,
        coverUrl,
        isPaid: resIsPaid,
        price: parsedPrice,
        publishToWeb: resPublishToWeb,
        allowComments: resAllowComments,
        type: "research",
        fileType: resMethod.toLowerCase(),
        status,
        likesCount: 0,
        downloadsCount: 0,
        viewsCount: 0,
        commentsCount: 0,
        likedBy: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const resRef = await addDoc(collection(db, "research"), {
        ...payload,
        manualContent: resMethod === "MANUAL" ? resManualContent : null,
        scriptContent: resMethod === "SCRIPT" ? resScriptContent : null,
        pdfUrl: resMethod === "PDF" ? resPdfUrl : null,
        pdfSize: resMethod === "PDF" ? resPdfSize : null,
        adminReviewedAt: null,
        adminFeedback: null,
        approvedBy: null,
      });

      // Mirror pending research to feed
      if (status === "pending") {
        await addDoc(collection(db, "feed"), {
          ...payload,
          content: resAbstract.trim(),
          originalId: resRef.id,
        });
      }

      await updateDoc(doc(db, "users", user.uid), {
        researchCount: increment(1),
      });

      Alert.alert(
        status === "pending" ? "Submitted! 🎓" : "Draft Saved 📁",
        status === "pending"
          ? "Your research has been submitted for admin review. You'll be notified when it's approved."
          : "Your draft has been saved. You can continue editing later.",
        [{ text: "Done", onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => {
            const hasContent = discContent || resTitle || resAbstract || resManualContent;
            if (hasContent) {
              Alert.alert("Discard?", "You have unsaved content.", [
                { text: "Keep Editing", style: "cancel" },
                { text: "Discard", style: "destructive", onPress: () => router.back() },
              ]);
            } else {
              router.back();
            }
          }}
        >
          <Ionicons name="close" size={22} color={THEME.text} />
        </TouchableOpacity>

        {/* MODE SWITCHER */}
        <View style={styles.modeSwitcher}>
          {(["DISCUSSION", "RESEARCH"] as CreateMode[]).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setMode(m)}
              style={[styles.modeTab, mode === m && styles.modeTabActive]}
            >
              <Ionicons
                name={m === "DISCUSSION" ? "chatbubbles-outline" : "document-text-outline"}
                size={14}
                color={mode === m ? "#000" : THEME.textMuted}
              />
              <Text style={[styles.modeTabTxt, mode === m && styles.modeTabTxtActive]}>
                {m}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ width: 38 }} />
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

          {/* ══════════════════════════════════════════
              DISCUSSION MODE
          ══════════════════════════════════════════ */}
          {mode === "DISCUSSION" && (
            <View>

              {/* User identity row */}
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

              {/* MOOD SELECTOR */}
              <SectionLabel label="WHAT KIND OF POST IS THIS?" icon="pricetag-outline" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moodRow}>
                {MOODS.map((mood) => (
                  <TouchableOpacity
                    key={mood}
                    style={[styles.moodPill, discMood === mood && styles.moodPillActive]}
                    onPress={() => setDiscMood(discMood === mood ? null : mood)}
                  >
                    <Text style={[styles.moodPillTxt, discMood === mood && styles.moodPillTxtActive]}>
                      {mood}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* CONTENT INPUT */}
              <SectionLabel label="YOUR DISCUSSION" icon="create-outline" />
              <View style={styles.discInputWrap}>
                <TextInput
                  style={styles.discInput}
                  placeholder="What's on your scholarly mind? Start a debate, share an idea, ask a question..."
                  placeholderTextColor={THEME.textMuted}
                  multiline
                  maxLength={2000}
                  value={discContent}
                  onChangeText={setDiscContent}
                  autoFocus
                />
                {/* Word count */}
                <View style={styles.discInputFooter}>
                  <Text style={[styles.discCharCount, discContent.length > 1800 && { color: THEME.red }]}>
                    {discContent.length}/2000
                  </Text>
                  <Text style={styles.discWordCount}>{discWordCount} words</Text>
                </View>
              </View>

              {/* SETTINGS */}
              <SectionLabel label="POST SETTINGS" icon="settings-outline" />
              <SettingRow
                icon="globe-outline"
                iconColor={THEME.blue}
                title="Publish to Web"
                subtitle="Visible on the public Writha website"
                value={discPublishToWeb}
                onValueChange={setDiscPublishToWeb}
                trackColor={THEME.blue}
              />
              <SettingRow
                icon="chatbubbles-outline"
                iconColor={THEME.purpleLight}
                title="Allow Comments"
                subtitle="Let the community reply to your post"
                value={discAllowComments}
                onValueChange={setDiscAllowComments}
              />

              {/* WEB INFO */}
              {discPublishToWeb && (
                <View style={styles.webInfoBox}>
                  <Ionicons name="globe" size={16} color={THEME.blue} />
                  <Text style={styles.webInfoTxt}>
                    This discussion will appear on writha.com and may be indexed by search engines.
                  </Text>
                </View>
              )}

              {/* POST BUTTON */}
              <TouchableOpacity
                style={[styles.primaryBtn, (!discContent.trim() || loading) && { opacity: 0.6 }]}
                onPress={handlePostDiscussion}
                disabled={!discContent.trim() || loading}
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
                  • Posts violating guidelines will be removed
                </Text>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════
              RESEARCH MODE
          ══════════════════════════════════════════ */}
          {mode === "RESEARCH" && (
            <View>

              {/* SUBMISSION METHOD */}
              <SectionLabel label="HOW WILL YOU SUBMIT?" icon="layers-outline" />
              <View style={styles.methodGrid}>
                {([
                  { key: "MANUAL", icon: "create-outline", label: "Type It", sub: "Write directly in app" },
                  { key: "PDF", icon: "document-outline", label: "Upload PDF", sub: "Upload a PDF file" },
                  { key: "SCRIPT", icon: "code-outline", label: "Paste Script", sub: "Paste formatted text" },
                ] as { key: ResearchMethod; icon: string; label: string; sub: string }[]).map((m) => (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.methodCard, resMethod === m.key && styles.methodCardActive]}
                    onPress={() => setResMethod(m.key)}
                  >
                    <Ionicons
                      name={m.icon as any}
                      size={22}
                      color={resMethod === m.key ? "#000" : THEME.purpleLight}
                    />
                    <Text style={[styles.methodCardLabel, resMethod === m.key && { color: "#000" }]}>
                      {m.label}
                    </Text>
                    <Text style={[styles.methodCardSub, resMethod === m.key && { color: "#000" }]}>
                      {m.sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* COVER IMAGE */}
              <SectionLabel label="COVER IMAGE (OPTIONAL)" icon="image-outline" />
              <TouchableOpacity style={styles.coverPicker} onPress={pickCover} activeOpacity={0.85}>
                {resCoverUri ? (
                  <View style={styles.coverPreviewWrap}>
                    <Image source={{ uri: resCoverUri }} style={styles.coverPreview} />
                    <View style={styles.coverEditOverlay}>
                      <Ionicons name="camera-outline" size={20} color="#fff" />
                      <Text style={styles.coverEditTxt}>Change</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.coverEmpty}>
                    <Ionicons name="image-outline" size={32} color={THEME.textMuted} />
                    <Text style={styles.coverEmptyTxt}>Add Cover Image</Text>
                    <Text style={styles.coverEmptySub}>Recommended: 1600 × 900px</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* TITLE */}
              <SectionLabel label="RESEARCH TITLE" icon="bookmark-outline" />
              <TextInput
                style={styles.titleInput}
                placeholder="Full title of your research..."
                placeholderTextColor={THEME.textMuted}
                value={resTitle}
                onChangeText={setResTitle}
                maxLength={150}
              />
              <Text style={styles.charHint}>{resTitle.length}/150</Text>

              {/* ABSTRACT */}
              <SectionLabel label="ABSTRACT" icon="document-text-outline" />
              <TextInput
                style={styles.abstractInput}
                placeholder="Summarise your research (min 50 characters). This appears in search results and the feed..."
                placeholderTextColor={THEME.textMuted}
                multiline
                value={resAbstract}
                onChangeText={setResAbstract}
                maxLength={800}
              />
              <Text style={styles.charHint}>{resAbstract.length}/800</Text>

              {/* CATEGORY */}
              <SectionLabel label="CATEGORY" icon="folder-outline" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
                {RESEARCH_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryPill, resCategory === cat && styles.categoryPillActive]}
                    onPress={() => setResCategory(cat)}
                  >
                    <Text style={[styles.categoryPillTxt, resCategory === cat && styles.categoryPillTxtActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* FIELD OF STUDY */}
              <SectionLabel label="FIELD OF STUDY" icon="school-outline" />
              <View style={styles.fieldGrid}>
                {FIELDS_OF_STUDY.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.fieldPill, resField === f && styles.fieldPillActive]}
                    onPress={() => setResField(f)}
                  >
                    <Text style={[styles.fieldPillTxt, resField === f && styles.fieldPillTxtActive]}>
                      {f}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* INSTITUTION */}
              <SectionLabel label="INSTITUTION (OPTIONAL)" icon="business-outline" />
              <TextInput
                style={styles.fieldInput}
                placeholder="University, college, or organisation..."
                placeholderTextColor={THEME.textMuted}
                value={resInstitution}
                onChangeText={setResInstitution}
              />

              {/* TAGS */}
              <SectionLabel label={`TAGS (${resTags.length}/6)`} icon="pricetags-outline" />
              <View style={styles.tagRow}>
                <TextInput
                  style={styles.tagInput}
                  placeholder="Add keyword tags..."
                  placeholderTextColor={THEME.textMuted}
                  value={resTagInput}
                  onChangeText={setResTagInput}
                  onSubmitEditing={addTag}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.tagAddBtn} onPress={addTag}>
                  <Ionicons name="add" size={20} color="#000" />
                </TouchableOpacity>
              </View>
              <View style={styles.tagsWrap}>
                {resTags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={styles.tagPill}
                    onPress={() => setResTags(resTags.filter((t) => t !== tag))}
                  >
                    <Text style={styles.tagPillTxt}>#{tag}</Text>
                    <Ionicons name="close" size={11} color={THEME.accent} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── CONTENT AREA ── */}
              {resMethod === "MANUAL" && (
                <>
                  <SectionLabel label="RESEARCH BODY" icon="create-outline" />
                  <TextInput
                    style={styles.bodyInput}
                    placeholder={"Write your full research here...\n\nMin 300 characters required for submission."}
                    placeholderTextColor={THEME.textMuted}
                    multiline
                    textAlignVertical="top"
                    value={resManualContent}
                    onChangeText={setResManualContent}
                  />
                  <View style={styles.wordCountBar}>
                    <View style={styles.wordCountItem}>
                      <Text style={styles.wordCountNum}>{resManualContent.length}</Text>
                      <Text style={styles.wordCountLbl}>Characters</Text>
                    </View>
                    <View style={styles.wordCountDiv} />
                    <View style={styles.wordCountItem}>
                      <Text style={styles.wordCountNum}>{resWordCount}</Text>
                      <Text style={styles.wordCountLbl}>Words</Text>
                    </View>
                    <View style={styles.wordCountDiv} />
                    <View style={styles.wordCountItem}>
                      <Text style={[
                        styles.wordCountNum,
                        resManualContent.length >= 300 ? { color: THEME.green } : { color: THEME.red },
                      ]}>
                        {resManualContent.length >= 300 ? "✓ Ready" : `${300 - resManualContent.length} more`}
                      </Text>
                      <Text style={styles.wordCountLbl}>Min Length</Text>
                    </View>
                  </View>
                </>
              )}

              {resMethod === "SCRIPT" && (
                <>
                  <SectionLabel label="PASTE SCRIPT / FORMATTED TEXT" icon="code-outline" />
                  <View style={styles.scriptBox}>
                    <TextInput
                      style={styles.scriptInput}
                      placeholder={"Paste your formatted research text here...\n\nSupports plain text and markdown-style formatting."}
                      placeholderTextColor={THEME.textMuted}
                      multiline
                      textAlignVertical="top"
                      value={resScriptContent}
                      onChangeText={setResScriptContent}
                    />
                  </View>
                </>
              )}

              {resMethod === "PDF" && (
                <>
                  <SectionLabel label="UPLOAD PDF" icon="document-outline" />
                  {resPdfUrl ? (
                    <View style={styles.pdfUploaded}>
                      <View style={styles.pdfUploadedIcon}>
                        <Ionicons name="document-text" size={28} color={THEME.red} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pdfFileName} numberOfLines={1}>{resPdfName}</Text>
                        <Text style={styles.pdfFileSize}>
                          {resPdfSize ? `${(resPdfSize / (1024 * 1024)).toFixed(2)} MB` : ""} · Uploaded ✓
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => { setResPdfUrl(null); setResPdfName(null); setResPdfSize(null); }}>
                        <Ionicons name="close-circle" size={22} color={THEME.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.pdfDropzone}
                      onPress={pickPdf}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <ActivityIndicator color={THEME.accent} />
                      ) : (
                        <>
                          <Ionicons name="cloud-upload-outline" size={36} color={THEME.purpleLight} />
                          <Text style={styles.pdfDropzoneTitle}>Tap to Upload PDF</Text>
                          <Text style={styles.pdfDropzoneSub}>Maximum file size: 20MB</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}

              {/* MONETISATION */}
              <SectionLabel label="MONETISATION" icon="cash-outline" />
              <SettingRow
                icon="cash-outline"
                iconColor={THEME.green}
                title="Sell This Research"
                subtitle="Readers pay to access the full content"
                value={resIsPaid}
                onValueChange={setResIsPaid}
                trackColor={THEME.green}
              />
              {resIsPaid && (
                <View style={styles.priceInputWrap}>
                  <Text style={styles.currencySymbol}>₦</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="0.00"
                    placeholderTextColor={THEME.ui2}
                    keyboardType="numeric"
                    value={resPrice}
                    onChangeText={setResPrice}
                  />
                </View>
              )}

              {/* PUBLISH SETTINGS */}
              <SectionLabel label="PUBLISH SETTINGS" icon="settings-outline" />
              <SettingRow
                icon="globe-outline"
                iconColor={THEME.blue}
                title="Publish to Web"
                subtitle="Visible on the public Writha website"
                value={resPublishToWeb}
                onValueChange={setResPublishToWeb}
                trackColor={THEME.blue}
              />
              <SettingRow
                icon="chatbubbles-outline"
                iconColor={THEME.purpleLight}
                title="Allow Comments"
                subtitle="Let readers comment on your research"
                value={resAllowComments}
                onValueChange={setResAllowComments}
              />

              {/* REVIEW INFO */}
              <View style={styles.reviewInfoBox}>
                <Ionicons name="shield-checkmark-outline" size={18} color={THEME.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewInfoTitle}>Admin Review Required</Text>
                  <Text style={styles.reviewInfoTxt}>
                    Research submissions are reviewed by Writha admins before going live.
                    This usually takes 24–48 hours. You'll receive a notification when approved or if changes are needed.
                  </Text>
                </View>
              </View>

              {/* SUBMIT BUTTONS */}
              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                onPress={() => handleSubmitResearch("pending")}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Ionicons name="rocket-outline" size={18} color="#000" />
                    <Text style={styles.primaryBtnTxt}>SUBMIT FOR REVIEW</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.draftBtn}
                onPress={() => handleSubmitResearch("draft")}
                disabled={loading}
              >
                <Ionicons name="save-outline" size={16} color={THEME.purpleLight} />
                <Text style={styles.draftBtnTxt}>Save as Draft</Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },

  // Header
  header: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: THEME.ui, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  closeBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: THEME.ui2, justifyContent: "center", alignItems: "center" },
  modeSwitcher: { flexDirection: "row", backgroundColor: THEME.bg, borderRadius: 14, padding: 4, gap: 4 },
  modeTab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  modeTabActive: { backgroundColor: THEME.accent },
  modeTabTxt: { color: THEME.textMuted, fontWeight: "800", fontSize: 12 },
  modeTabTxtActive: { color: "#000" },

  scroll: { padding: 16, paddingBottom: 60 },

  // Section labels
  sectionLabel: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 24, marginBottom: 10 },
  sectionLabelTxt: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2 },

  // User row
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  userAvatar: { width: 44, height: 44, borderRadius: 13, borderWidth: 2, borderColor: THEME.accent },
  userAvatarFallback: { backgroundColor: THEME.purple, justifyContent: "center", alignItems: "center" },
  userAvatarInitial: { color: THEME.accent, fontWeight: "900", fontSize: 18 },
  userName: { color: THEME.text, fontWeight: "800", fontSize: 15 },
  userHandle: { color: THEME.textMuted, fontSize: 11, marginTop: 2 },

  // Mood
  moodRow: { marginBottom: 8 },
  moodPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2, marginRight: 8 },
  moodPillActive: { backgroundColor: THEME.accentDim, borderColor: THEME.accent },
  moodPillTxt: { color: THEME.textMuted, fontSize: 13, fontWeight: "600" },
  moodPillTxtActive: { color: THEME.accent },

  // Discussion input
  discInputWrap: { backgroundColor: THEME.ui, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: THEME.ui2 },
  discInput: { color: THEME.text, fontSize: 16, lineHeight: 26, minHeight: 180, textAlignVertical: "top" },
  discInputFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: THEME.ui2 },
  discCharCount: { color: THEME.textMuted, fontSize: 11 },
  discWordCount: { color: THEME.textMuted, fontSize: 11 },

  // Setting row
  settingRow: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: THEME.ui2 },
  settingIcon: { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center", marginRight: 12 },
  settingInfo: { flex: 1, marginRight: 10 },
  settingTitle: { color: THEME.text, fontWeight: "800", fontSize: 14 },
  settingSubtitle: { color: THEME.textMuted, fontSize: 11, marginTop: 2 },

  // Web info
  webInfoBox: { flexDirection: "row", gap: 10, backgroundColor: THEME.blue + "15", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: THEME.blue + "30", alignItems: "flex-start", marginBottom: 10 },
  webInfoTxt: { color: THEME.textMuted, fontSize: 12, flex: 1, lineHeight: 18 },

  // Buttons
  primaryBtn: { backgroundColor: THEME.accent, borderRadius: 18, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 24 },
  primaryBtnTxt: { color: "#000", fontWeight: "900", fontSize: 14, letterSpacing: 1 },
  draftBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, marginTop: 10 },
  draftBtnTxt: { color: THEME.purpleLight, fontWeight: "800", fontSize: 14 },

  // Guidelines
  guidelinesBox: { backgroundColor: THEME.ui, borderRadius: 16, padding: 18, marginTop: 20, borderWidth: 1, borderColor: THEME.ui2 },
  guidelinesTitle: { color: THEME.text, fontWeight: "900", fontSize: 13, marginBottom: 10 },
  guidelinesTxt: { color: THEME.textMuted, fontSize: 12, lineHeight: 22 },

  // Method grid
  methodGrid: { flexDirection: "row", gap: 10, marginBottom: 8 },
  methodCard: { flex: 1, backgroundColor: THEME.ui, borderRadius: 16, padding: 14, alignItems: "center", gap: 6, borderWidth: 1, borderColor: THEME.ui2 },
  methodCardActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  methodCardLabel: { color: THEME.purpleLight, fontWeight: "800", fontSize: 12 },
  methodCardSub: { color: THEME.textMuted, fontSize: 9, textAlign: "center" },

  // Cover
  coverPicker: { borderRadius: 16, overflow: "hidden", borderWidth: 1.5, borderColor: THEME.ui2, borderStyle: "dashed" },
  coverEmpty: { height: 140, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center", gap: 6 },
  coverEmptyTxt: { color: THEME.textMuted, fontWeight: "700", fontSize: 13 },
  coverEmptySub: { color: THEME.textMuted, fontSize: 10 },
  coverPreviewWrap: { height: 140, position: "relative" },
  coverPreview: { width: "100%", height: "100%" },
  coverEditOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", gap: 4 },
  coverEditTxt: { color: "#fff", fontWeight: "700" },

  // Inputs
  titleInput: { backgroundColor: THEME.ui, color: THEME.text, borderRadius: 14, padding: 16, fontSize: 16, fontWeight: "700", borderWidth: 1, borderColor: THEME.ui2 },
  abstractInput: { backgroundColor: THEME.ui, color: THEME.text, borderRadius: 14, padding: 16, fontSize: 14, minHeight: 120, textAlignVertical: "top", lineHeight: 22, borderWidth: 1, borderColor: THEME.ui2 },
  fieldInput: { backgroundColor: THEME.ui, color: THEME.text, borderRadius: 14, padding: 16, fontSize: 14, borderWidth: 1, borderColor: THEME.ui2 },
  charHint: { color: THEME.textMuted, fontSize: 10, textAlign: "right", marginTop: 4, marginBottom: 4 },

  // Category
  categoryRow: { marginBottom: 8 },
  categoryPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2, marginRight: 8 },
  categoryPillActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  categoryPillTxt: { color: THEME.textMuted, fontWeight: "700", fontSize: 12 },
  categoryPillTxtActive: { color: "#000" },

  // Field grid
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  fieldPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2 },
  fieldPillActive: { backgroundColor: THEME.purple, borderColor: THEME.purple },
  fieldPillTxt: { color: THEME.textMuted, fontSize: 12, fontWeight: "600" },
  fieldPillTxtActive: { color: "#fff" },

  // Tags
  tagRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  tagInput: { flex: 1, backgroundColor: THEME.ui, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: THEME.text, borderWidth: 1, borderColor: THEME.ui2, fontSize: 14 },
  tagAddBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: THEME.accent, justifyContent: "center", alignItems: "center" },
  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  tagPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: THEME.accentDim, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: THEME.accent + "40" },
  tagPillTxt: { color: THEME.accent, fontSize: 12, fontWeight: "700" },

  // Body / Script
  bodyInput: { backgroundColor: THEME.ui, color: THEME.text, borderRadius: 14, padding: 16, minHeight: 350, fontSize: 15, lineHeight: 24, textAlignVertical: "top", borderWidth: 1, borderColor: THEME.ui2 },
  scriptBox: { backgroundColor: THEME.bg, borderRadius: 14, borderWidth: 1, borderColor: THEME.ui2 },
  scriptInput: { color: THEME.text, padding: 16, minHeight: 300, fontSize: 14, lineHeight: 22, fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace", textAlignVertical: "top" },

  // Word count
  wordCountBar: { flexDirection: "row", backgroundColor: THEME.ui, borderRadius: 14, padding: 14, marginTop: 12, borderWidth: 1, borderColor: THEME.ui2 },
  wordCountItem: { flex: 1, alignItems: "center" },
  wordCountNum: { color: THEME.accent, fontSize: 16, fontWeight: "900" },
  wordCountLbl: { color: THEME.textMuted, fontSize: 9, fontWeight: "700", marginTop: 2 },
  wordCountDiv: { width: 1, backgroundColor: THEME.ui2 },

  // PDF
  pdfDropzone: { height: 160, backgroundColor: THEME.ui, borderRadius: 16, borderWidth: 2, borderColor: THEME.ui2, borderStyle: "dashed", justifyContent: "center", alignItems: "center", gap: 10 },
  pdfDropzoneTitle: { color: THEME.purpleLight, fontWeight: "800", fontSize: 15 },
  pdfDropzoneSub: { color: THEME.textMuted, fontSize: 12 },
  pdfUploaded: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, borderRadius: 16, padding: 16, gap: 14, borderWidth: 1, borderColor: THEME.green + "50" },
  pdfUploadedIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: THEME.red + "20", justifyContent: "center", alignItems: "center" },
  pdfFileName: { color: THEME.text, fontWeight: "700", fontSize: 13 },
  pdfFileSize: { color: THEME.green, fontSize: 11, marginTop: 3 },

  // Price
  priceInputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: THEME.ui2, marginTop: 10, marginBottom: 10 },
  currencySymbol: { color: THEME.accent, fontSize: 24, fontWeight: "900", marginRight: 8 },
  priceInput: { flex: 1, color: THEME.text, fontSize: 28, fontWeight: "900" },

  // Review info
  reviewInfoBox: { flexDirection: "row", gap: 12, backgroundColor: THEME.accentDim, borderRadius: 16, padding: 16, marginTop: 20, borderWidth: 1, borderColor: THEME.accent + "30", alignItems: "flex-start" },
  reviewInfoTitle: { color: THEME.accent, fontWeight: "800", fontSize: 13, marginBottom: 6 },
  reviewInfoTxt: { color: THEME.textMuted, fontSize: 12, lineHeight: 19 },
});