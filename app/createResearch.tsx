import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Switch, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, Image, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { auth, db } from "@/lib/firebase";
import {
  collection, addDoc, serverTimestamp, doc, updateDoc, increment,
} from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const THEME = {
  bg:          "#0F071A",
  ui:          "#1E1135",
  ui2:         "#2D1B4D",
  ui3:         "#3D2660",
  accent:      "#FFD700",
  accentDim:   "rgba(255,215,0,0.1)",
  purple:      "#6D28D9",
  purpleLight: "#A78BFA",
  text:        "#E2E8F0",
  textMuted:   "#94A3B8",
  green:       "#22C55E",
  red:         "#EF4444",
  blue:        "#38BDF8",
  cyan:        "#00D1FF",
  orange:      "#F97316",
};

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

// ── CROSS PLATFORM HELPERS ────────────────────────────────────────────────
const webAlert = (title: string, msg: string) => {
  if (Platform.OS === "web") window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
};

const webConfirm = (
  title: string,
  msg: string,
  onConfirm: () => void,
  confirmLabel = "Confirm"
) => {
  if (Platform.OS === "web") {
    const ok = window.confirm(`${title}\n\n${msg}`);
    if (ok) onConfirm();
  } else {
    Alert.alert(title, msg, [
      { text: "Cancel", style: "cancel" },
      { text: confirmLabel, onPress: onConfirm },
    ]);
  }
};

// ── SECTION LABEL ─────────────────────────────────────────────────────────
const SectionLabel = ({ label, icon }: { label: string; icon?: string }) => (
  <View style={styles.sectionLabel}>
    {icon && <Ionicons name={icon as any} size={14} color={THEME.accent} />}
    <Text style={styles.sectionLabelTxt}>{label}</Text>
  </View>
);

// ── SETTING ROW ───────────────────────────────────────────────────────────
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

export default function CreateResearch() {
  const router = useRouter();
  const user   = auth.currentUser;
  if (!user) return null;

  // UI
  const [loading,       setLoading]       = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [uploadMsg,     setUploadMsg]     = useState<string | null>(null);
  const [activeTab,     setActiveTab]     = useState<"content" | "details" | "settings">("content");

  // Method
  const [resMethod,     setResMethod]     = useState<ResearchMethod>("MANUAL");

  // Content
  const [resTitle,         setResTitle]         = useState("");
  const [resAbstract,      setResAbstract]      = useState("");
  const [resManualContent, setResManualContent] = useState("");
  const [resScriptContent, setResScriptContent] = useState("");
  const [resPdfUrl,        setResPdfUrl]        = useState<string | null>(null);
  const [resPdfName,       setResPdfName]       = useState<string | null>(null);
  const [resPdfSize,       setResPdfSize]       = useState<number | null>(null);
  const [resCoverUri,      setResCoverUri]      = useState<string | null>(null);
  const [resCoverUrl,      setResCoverUrl]      = useState<string | null>(null);

  // Details
  const [resCategory,    setResCategory]    = useState("Research Paper");
  const [resField,       setResField]       = useState("");
  const [resInstitution, setResInstitution] = useState("");
  const [resTags,        setResTags]        = useState<string[]>([]);
  const [resTagInput,    setResTagInput]    = useState("");

  // Settings
  const [resIsPaid,        setResIsPaid]        = useState(false);
  const [resPrice,         setResPrice]         = useState("");
  const [resPublishToWeb,  setResPublishToWeb]  = useState(false);
  const [resAllowComments, setResAllowComments] = useState(true);

  const tabAnim  = useRef(new Animated.Value(0)).current;
  const tabWidth = (340 - 32) / 3; // approximate

  const switchTab = (tab: "content" | "details" | "settings", idx: number) => {
    setActiveTab(tab);
    Animated.spring(tabAnim, {
      toValue: idx * tabWidth,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  // ── COMPUTED ──────────────────────────────────────────────────────
  const resWordCount = resManualContent.trim()
    ? resManualContent.trim().split(/\s+/).length : 0;

  const contentReady =
    (resMethod === "MANUAL" && resManualContent.length >= 300) ||
    (resMethod === "SCRIPT" && resScriptContent.trim().length > 0) ||
    (resMethod === "PDF"    && !!resPdfUrl);

  // ── IMAGE PICKER ──────────────────────────────────────────────────
  const pickCover = async () => {
    if (Platform.OS === "web") {
      const input    = document.createElement("input");
      input.type     = "file";
      input.accept   = "image/*";
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        setResCoverUri(url);
      };
      input.click();
      return;
    }
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) { webAlert("Permission Required", "Allow access to your photo library."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [16, 9], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setResCoverUri(result.assets[0].uri);
    }
  };

  // ── PDF PICKER ────────────────────────────────────────────────────
  const pickPdf = async () => {
    if (Platform.OS === "web") {
      const input    = document.createElement("input");
      input.type     = "file";
      input.accept   = "application/pdf";
      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        const sizeInMB = file.size / (1024 * 1024);
        if (sizeInMB > 20) { webAlert("File Too Large", "PDF must be under 20MB."); return; }
        setResPdfName(file.name);
        setResPdfSize(file.size);
        setUploading(true);
        setUploadMsg("Uploading PDF...");
        try {
          const storage    = getStorage();
          const storageRef = ref(storage, `research/${user.uid}/${Date.now()}.pdf`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          setResPdfUrl(url);
          setUploadMsg(null);
        } catch (err) {
          webAlert("Upload Failed", "Could not upload PDF. Please try again.");
          setResPdfName(null);
          setResPdfSize(null);
        } finally { setUploading(false); }
      };
      input.click();
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        const file     = result.assets[0];
        const sizeInMB = (file.size || 0) / (1024 * 1024);
        if (sizeInMB > 20) { webAlert("File Too Large", "PDF must be under 20MB."); return; }
        setResPdfName(file.name);
        setResPdfSize(file.size || null);
        setUploading(true);
        setUploadMsg("Uploading PDF...");
        const response   = await fetch(file.uri);
        const blob       = await response.blob();
        const storage    = getStorage();
        const storageRef = ref(storage, `research/${user.uid}/${Date.now()}.pdf`);
        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);
        setResPdfUrl(url);
        setUploadMsg(null);
      }
    } catch (e) {
      webAlert("Error", "Failed to upload PDF.");
      setResPdfName(null);
      setResPdfSize(null);
    } finally { setUploading(false); }
  };

  // ── UPLOAD COVER ──────────────────────────────────────────────────
  const uploadCoverImage = async (): Promise<string | null> => {
    if (!resCoverUri) return null;
    try {
      setUploadMsg("Uploading cover image...");
      const response   = await fetch(resCoverUri);
      const blob       = await response.blob();
      const storage    = getStorage();
      const storageRef = ref(storage, `research-covers/${user.uid}/${Date.now()}.jpg`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      setUploadMsg(null);
      return url;
    } catch (e) {
      setUploadMsg(null);
      return null;
    }
  };

  // ── TAGS ──────────────────────────────────────────────────────────
  const addTag = () => {
    const t = resTagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !resTags.includes(t) && resTags.length < 6) {
      setResTags([...resTags, t]);
      setResTagInput("");
    }
  };

  // ── VALIDATION ────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!resTitle.trim() || resTitle.trim().length < 5)
      return "Title must be at least 5 characters.";
    if (!resAbstract.trim() || resAbstract.trim().length < 50)
      return "Abstract must be at least 50 characters.";
    if (!resField)
      return "Please select a field of study in the Details tab.";
    if (resIsPaid && (!resPrice || parseFloat(resPrice) <= 0))
      return "Enter a valid price for paid research.";
    if (resMethod === "MANUAL" && resManualContent.trim().length < 300)
      return "Research body must be at least 300 characters.";
    if (resMethod === "SCRIPT" && !resScriptContent.trim())
      return "Script content cannot be empty.";
    if (resMethod === "PDF" && !resPdfUrl)
      return "Please upload your PDF before submitting.";
    return null;
  };

  // ── SUBMIT ────────────────────────────────────────────────────────
  const handleSubmit = async (status: "draft" | "pending") => {
    if (status === "pending") {
      const err = validate();
      if (err) { webAlert("Validation Error", err); return; }
    } else {
      if (!resTitle.trim()) { webAlert("Title Required", "Add a title to save your draft."); return; }
    }

    setLoading(true);
    try {
      const coverUrl = await uploadCoverImage();
      const parsedPrice = resIsPaid ? parseFloat(resPrice) || 0 : 0;

      const payload: Record<string, any> = {
        userId:        user.uid,
        userName:      user.displayName || "Scholar",
        userPhoto:     user.photoURL    || "",
        userHandle:    user.email?.split("@")[0] || "scholar",
        title:         resTitle.trim(),
        abstract:      resAbstract.trim(),
        content:       resAbstract.trim(), // feed preview uses content field
        category:      resCategory,
        fieldOfStudy:  resField,
        institution:   resInstitution.trim(),
        tags:          resTags,
        coverUrl:      coverUrl || null,
        isPaid:        resIsPaid,
        price:         parsedPrice,
        publishToWeb:  resPublishToWeb,
        allowComments: resAllowComments,
        type:          "research",
        fileType:      resMethod.toLowerCase(),
        status,
        likesCount:    0,
        commentsCount: 0,
        downloadsCount:0,
        viewsCount:    0,
        likedBy:       [],
        reactions:     {},
        createdAt:     serverTimestamp(),
        updatedAt:     serverTimestamp(),
      };

      // Method-specific content
      const fullPayload = {
        ...payload,
        manualContent:    resMethod === "MANUAL" ? resManualContent : null,
        scriptContent:    resMethod === "SCRIPT" ? resScriptContent : null,
        pdfUrl:           resMethod === "PDF"    ? resPdfUrl        : null,
        pdfSize:          resMethod === "PDF"    ? resPdfSize       : null,
        wordCount:        resMethod === "MANUAL" ? resWordCount      : null,
        adminReviewedAt:  null,
        adminFeedback:    null,
        approvedBy:       null,
      };

      // Save to research collection
      const resRef = await addDoc(collection(db, "research"), fullPayload);

      // Only add to feed if submitting for review (pending) — not drafts
      if (status === "pending") {
        await addDoc(collection(db, "feed"), {
          ...payload,
          originalId: resRef.id,
        });
      }

      // Update user research count — wrapped in try/catch so it doesn't block
      try {
        await updateDoc(doc(db, "users", user.uid), {
          researchCount: increment(1),
        });
      } catch (_) {}

      const isDraft = status === "draft";
      if (Platform.OS === "web") {
        window.alert(
          isDraft
            ? "Draft Saved!\n\nYou can continue editing later."
            : "Submitted for Review! 🎓\n\nYou'll be notified when your research is approved (24–48 hours)."
        );
        router.back();
      } else {
        Alert.alert(
          isDraft ? "Draft Saved 📁" : "Submitted! 🎓",
          isDraft
            ? "Your draft has been saved. You can continue editing later."
            : "Your research has been submitted for admin review. You'll be notified when approved (24–48 hours).",
          [{ text: "Done", onPress: () => router.back() }]
        );
      }
    } catch (e: any) {
      webAlert("Error", e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
      setUploadMsg(null);
    }
  };

  // ── BACK GUARD ────────────────────────────────────────────────────
  const handleBack = () => {
    const hasContent = resTitle || resAbstract || resManualContent;
    if (!hasContent) { router.back(); return; }
    webConfirm(
      "Discard Research?",
      "You have unsaved content. Are you sure you want to leave?",
      () => router.back(),
      "Discard"
    );
  };

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={handleBack}>
          <Ionicons name="arrow-back" size={22} color={THEME.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.typeBadge}>
            <MaterialCommunityIcons name="flask" size={14} color="#000" />
            <Text style={styles.typeBadgeTxt}>RESEARCH</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.draftHeaderBtn, loading && { opacity: 0.4 }]}
          onPress={() => handleSubmit("draft")}
          disabled={loading}
        >
          <Text style={styles.draftHeaderBtnTxt}>DRAFT</Text>
        </TouchableOpacity>
      </View>

      {/* UPLOAD PROGRESS BANNER */}
      {(uploading || uploadMsg) && (
        <View style={styles.uploadBanner}>
          <ActivityIndicator size="small" color={THEME.accent} />
          <Text style={styles.uploadBannerTxt}>{uploadMsg || "Uploading..."}</Text>
        </View>
      )}

      {/* TABS */}
      <View style={styles.tabsWrap}>
        <View style={styles.tabs}>
          {(["content", "details", "settings"] as const).map((tab, i) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => switchTab(tab, i)}
            >
              <Ionicons
                name={
                  tab === "content"  ? "create-outline"   :
                  tab === "details"  ? "layers-outline"   : "settings-outline"
                }
                size={14}
                color={activeTab === tab ? "#000" : THEME.textMuted}
              />
              <Text style={[styles.tabTxt, activeTab === tab && styles.tabTxtActive]}>
                {tab.toUpperCase()}
              </Text>
              {/* Alert dots */}
              {tab === "details" && !resField && (
                <View style={styles.tabDot} />
              )}
              {tab === "content" && !contentReady && (resTitle.length > 0) && (
                <View style={[styles.tabDot, { backgroundColor: THEME.orange }]} />
              )}
            </TouchableOpacity>
          ))}
        </View>
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

          {/* ── CONTENT TAB ── */}
          {activeTab === "content" && (
            <View>
              {/* SUBMISSION METHOD */}
              <SectionLabel label="SUBMISSION METHOD" icon="layers-outline" />
              <View style={styles.methodGrid}>
                {([
                  { key: "MANUAL", icon: "create-outline",   label: "Type It",      sub: "Write directly in app"  },
                  { key: "PDF",    icon: "document-outline", label: "Upload PDF",   sub: "Max 20MB · No page limit" },
                  { key: "SCRIPT", icon: "code-outline",     label: "Paste Script", sub: "Paste formatted text"   },
                ] as { key: ResearchMethod; icon: string; label: string; sub: string }[]).map((m) => (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.methodCard, resMethod === m.key && styles.methodCardActive]}
                    onPress={() => setResMethod(m.key)}
                  >
                    <Ionicons
                      name={m.icon as any} size={22}
                      color={resMethod === m.key ? "#000" : THEME.purpleLight}
                    />
                    <Text style={[styles.methodCardLabel, resMethod === m.key && { color: "#000" }]}>
                      {m.label}
                    </Text>
                    <Text style={[styles.methodCardSub, resMethod === m.key && { color: "#00000099" }]}>
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
              <SectionLabel label="RESEARCH TITLE *" icon="bookmark-outline" />
              <TextInput
                style={styles.titleInput}
                placeholder="Full title of your research..."
                placeholderTextColor={THEME.textMuted}
                value={resTitle}
                onChangeText={setResTitle}
                maxLength={150}
              />
              <View style={styles.hintRow}>
                <Text style={styles.charHint}>{resTitle.length}/150</Text>
                {resTitle.length > 0 && resTitle.length < 5 && (
                  <Text style={styles.hintWarn}>{5 - resTitle.length} more chars needed</Text>
                )}
              </View>

              {/* ABSTRACT */}
              <SectionLabel label="ABSTRACT *" icon="document-text-outline" />
              <TextInput
                style={styles.abstractInput}
                placeholder="Summarise your research (min 50 characters)..."
                placeholderTextColor={THEME.textMuted}
                multiline
                value={resAbstract}
                onChangeText={setResAbstract}
                maxLength={800}
              />
              <View style={styles.hintRow}>
                <Text style={styles.charHint}>{resAbstract.length}/800</Text>
                {resAbstract.length > 0 && resAbstract.length < 50 && (
                  <Text style={styles.hintWarn}>{50 - resAbstract.length} more chars needed</Text>
                )}
              </View>

              {/* CONTENT AREA */}
              {resMethod === "MANUAL" && (
                <>
                  <SectionLabel label="RESEARCH BODY *" icon="create-outline" />
                  <TextInput
                    style={styles.bodyInput}
                    placeholder={"Write your full research here...\n\nMin 300 characters required.\n## Heading\n**bold**\n> quote\n• bullet"}
                    placeholderTextColor={THEME.textMuted}
                    multiline
                    textAlignVertical="top"
                    value={resManualContent}
                    onChangeText={setResManualContent}
                  />
                  <View style={styles.wordCountBar}>
                    <View style={styles.wordCountItem}>
                      <Text style={styles.wordCountNum}>{resManualContent.length}</Text>
                      <Text style={styles.wordCountLbl}>Chars</Text>
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
                        resManualContent.length >= 300
                          ? { color: THEME.green }
                          : { color: THEME.red },
                      ]}>
                        {resManualContent.length >= 300
                          ? "✓ Ready"
                          : `${300 - resManualContent.length} more`}
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
                      placeholder={"Paste your formatted research text here...\n\nNo limit."}
                      placeholderTextColor={THEME.textMuted}
                      multiline
                      textAlignVertical="top"
                      value={resScriptContent}
                      onChangeText={setResScriptContent}
                    />
                  </View>
                  {resScriptContent.length > 0 && (
                    <Text style={[styles.charHint, { textAlign: "left", marginTop: 6 }]}>
                      {resScriptContent.trim().split(/\s+/).length} words
                    </Text>
                  )}
                </>
              )}

              {resMethod === "PDF" && (
                <>
                  <SectionLabel label="UPLOAD PDF *" icon="document-outline" />
                  {resPdfUrl ? (
                    <View style={styles.pdfUploaded}>
                      <View style={styles.pdfUploadedIcon}>
                        <Ionicons name="document-text" size={28} color={THEME.red} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pdfFileName} numberOfLines={1}>
                          {resPdfName}
                        </Text>
                        <Text style={styles.pdfFileSize}>
                          {resPdfSize
                            ? `${(resPdfSize / (1024 * 1024)).toFixed(2)} MB`
                            : ""} · Uploaded ✓
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setResPdfUrl(null);
                          setResPdfName(null);
                          setResPdfSize(null);
                        }}
                      >
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
                        <>
                          <ActivityIndicator color={THEME.accent} />
                          <Text style={styles.pdfDropzoneSub}>Uploading PDF...</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="cloud-upload-outline" size={36} color={THEME.purpleLight} />
                          <Text style={styles.pdfDropzoneTitle}>Tap to Upload PDF</Text>
                          <Text style={styles.pdfDropzoneSub}>Maximum: 20MB · No page limit</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}

              {/* CHECKLIST */}
              <View style={styles.checklistCard}>
                <Text style={styles.checklistTitle}>SUBMISSION CHECKLIST</Text>
                {[
                  { label: "Title (5+ chars)",     ok: resTitle.trim().length >= 5     },
                  { label: "Abstract (50+ chars)",  ok: resAbstract.trim().length >= 50 },
                  { label: "Field of study",        ok: !!resField                      },
                  { label: "Content ready",         ok: contentReady                    },
                  { label: "Cover image",           ok: !!resCoverUri, optional: true   },
                  { label: "Tags added",            ok: resTags.length > 0, optional: true },
                ].map((item) => (
                  <View key={item.label} style={styles.checklistRow}>
                    <Ionicons
                      name={item.ok ? "checkmark-circle" : "ellipse-outline"}
                      size={15}
                      color={
                        item.ok ? THEME.green :
                        item.optional ? THEME.textMuted : THEME.red
                      }
                    />
                    <Text style={[
                      styles.checklistLbl,
                      item.ok && { color: THEME.green },
                      !item.ok && !item.optional && { color: THEME.red },
                    ]}>
                      {item.label}
                      {item.optional && !item.ok ? " (optional)" : ""}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── DETAILS TAB ── */}
          {activeTab === "details" && (
            <View>
              {/* CATEGORY */}
              <SectionLabel label="CATEGORY" icon="folder-outline" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryRow}
              >
                {RESEARCH_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryPill,
                      resCategory === cat && styles.categoryPillActive,
                    ]}
                    onPress={() => setResCategory(cat)}
                  >
                    <Text style={[
                      styles.categoryPillTxt,
                      resCategory === cat && styles.categoryPillTxtActive,
                    ]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* FIELD OF STUDY */}
              <SectionLabel label="FIELD OF STUDY *" icon="school-outline" />
              <View style={styles.fieldGrid}>
                {FIELDS_OF_STUDY.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.fieldPill, resField === f && styles.fieldPillActive]}
                    onPress={() => setResField(f)}
                  >
                    <Text style={[
                      styles.fieldPillTxt,
                      resField === f && styles.fieldPillTxtActive,
                    ]}>
                      {f}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {!resField && (
                <View style={styles.fieldHint}>
                  <Ionicons name="alert-circle-outline" size={14} color={THEME.orange} />
                  <Text style={styles.fieldHintTxt}>Field of study is required to submit</Text>
                </View>
              )}

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
                  placeholder="Add keyword tags and press enter..."
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
              {resTags.length > 0 && (
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
              )}

              {/* GUIDELINES */}
              <View style={styles.guidelinesBox}>
                <Text style={styles.guidelinesTitle}>📋 Research Guidelines</Text>
                <Text style={styles.guidelinesTxt}>
                  • Original and unpublished work only{"\n"}
                  • Minimum 300 characters for manual entry{"\n"}
                  • Abstract must clearly summarise the work{"\n"}
                  • No plagiarised or AI-generated content without disclosure{"\n"}
                  • Peer review quality strongly encouraged{"\n"}
                  • All submissions are reviewed by Writha admins (24–48 hours)
                </Text>
              </View>
            </View>
          )}

          {/* ── SETTINGS TAB ── */}
          {activeTab === "settings" && (
            <View>
              {/* MONETISATION */}
              <SectionLabel label="MONETISATION" icon="cash-outline" />
              <SettingRow
                icon="cash-outline" iconColor={THEME.green}
                title="Sell This Research"
                subtitle="Readers pay to access the full content"
                value={resIsPaid} onValueChange={setResIsPaid}
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
                    onChangeText={(t) => {
                      // Only allow numbers and one decimal point
                      const clean = t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
                      setResPrice(clean);
                    }}
                  />
                  {resIsPaid && resPrice && parseFloat(resPrice) > 0 && (
                    <Text style={styles.pricePreview}>
                      = ₦{parseFloat(resPrice).toLocaleString()}
                    </Text>
                  )}
                </View>
              )}

              {/* PUBLISH SETTINGS */}
              <SectionLabel label="PUBLISH SETTINGS" icon="settings-outline" />
              <SettingRow
                icon="globe-outline" iconColor={THEME.blue}
                title="Publish to Web"
                subtitle="Visible on the public Writha website"
                value={resPublishToWeb} onValueChange={setResPublishToWeb}
                trackColor={THEME.blue}
              />
              {resPublishToWeb && (
                <View style={styles.webInfoBox}>
                  <Ionicons name="globe-outline" size={16} color={THEME.blue} />
                  <Text style={styles.webInfoTxt}>
                    Your research will appear on writha.com and may be indexed by search engines.
                  </Text>
                </View>
              )}
              <SettingRow
                icon="chatbubbles-outline" iconColor={THEME.purpleLight}
                title="Allow Comments"
                subtitle="Let readers comment on your research"
                value={resAllowComments} onValueChange={setResAllowComments}
              />

              {/* REVIEW INFO */}
              <View style={styles.reviewInfoBox}>
                <Ionicons name="shield-checkmark-outline" size={20} color={THEME.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewInfoTitle}>Admin Review Required</Text>
                  <Text style={styles.reviewInfoTxt}>
                    All research submissions are reviewed before going live. This usually
                    takes 24–48 hours. You'll receive a notification when approved or if
                    changes are needed.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* ── SUBMIT BUTTONS (always visible) ── */}
          <TouchableOpacity
            style={[styles.primaryBtn, (loading || uploading) && { opacity: 0.6 }]}
            onPress={() => handleSubmit("pending")}
            disabled={loading || uploading}
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
            style={[styles.draftBtn, (loading || uploading) && { opacity: 0.6 }]}
            onPress={() => handleSubmit("draft")}
            disabled={loading || uploading}
          >
            <Ionicons name="save-outline" size={16} color={THEME.purpleLight} />
            <Text style={styles.draftBtnTxt}>Save as Draft</Text>
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:             { flex: 1, backgroundColor: THEME.bg },

  // Header
  header:                { paddingTop: Platform.OS === "ios" ? 56 : 40, paddingHorizontal: 16, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: THEME.ui, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  closeBtn:              { width: 38, height: 38, borderRadius: 12, backgroundColor: THEME.ui2, justifyContent: "center", alignItems: "center" },
  headerCenter:          { flex: 1, alignItems: "center" },
  typeBadge:             { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: THEME.cyan, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  typeBadgeTxt:          { color: "#000", fontWeight: "900", fontSize: 12, letterSpacing: 1 },
  draftHeaderBtn:        { borderWidth: 1, borderColor: THEME.purpleLight, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  draftHeaderBtnTxt:     { color: THEME.purpleLight, fontWeight: "900", fontSize: 12 },

  // Upload banner
  uploadBanner:          { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: THEME.ui2, paddingHorizontal: 16, paddingVertical: 10 },
  uploadBannerTxt:       { color: THEME.text, fontSize: 13 },

  // Tabs
  tabsWrap:              { backgroundColor: THEME.ui, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  tabs:                  { flexDirection: "row" },
  tab:                   { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 12, position: "relative" },
  tabActive:             { backgroundColor: THEME.accent },
  tabTxt:                { color: THEME.textMuted, fontWeight: "800", fontSize: 11 },
  tabTxtActive:          { color: "#000" },
  tabDot:                { position: "absolute", top: 6, right: 14, width: 7, height: 7, borderRadius: 4, backgroundColor: THEME.red },

  // Scroll
  scroll:                { padding: 16, paddingBottom: 80 },
  sectionLabel:          { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 24, marginBottom: 10 },
  sectionLabelTxt:       { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2 },

  // Setting row
  settingRow:            { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: THEME.ui2 },
  settingIcon:           { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center", marginRight: 12 },
  settingInfo:           { flex: 1, marginRight: 10 },
  settingTitle:          { color: THEME.text, fontWeight: "800", fontSize: 14 },
  settingSubtitle:       { color: THEME.textMuted, fontSize: 11, marginTop: 2 },

  // Method grid
  methodGrid:            { flexDirection: "row", gap: 10, marginBottom: 8 },
  methodCard:            { flex: 1, backgroundColor: THEME.ui, borderRadius: 16, padding: 14, alignItems: "center", gap: 6, borderWidth: 1, borderColor: THEME.ui2 },
  methodCardActive:      { backgroundColor: THEME.accent, borderColor: THEME.accent },
  methodCardLabel:       { color: THEME.purpleLight, fontWeight: "800", fontSize: 12 },
  methodCardSub:         { color: THEME.textMuted, fontSize: 9, textAlign: "center" },

  // Cover
  coverPicker:           { borderRadius: 16, overflow: "hidden", borderWidth: 1.5, borderColor: THEME.ui2, borderStyle: "dashed" },
  coverEmpty:            { height: 140, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center", gap: 6 },
  coverEmptyTxt:         { color: THEME.textMuted, fontWeight: "700", fontSize: 13 },
  coverEmptySub:         { color: THEME.textMuted, fontSize: 10 },
  coverPreviewWrap:      { height: 140, position: "relative" },
  coverPreview:          { width: "100%", height: "100%" },
  coverEditOverlay:      { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", gap: 4 },
  coverEditTxt:          { color: "#fff", fontWeight: "700" },

  // Inputs
  titleInput:            { backgroundColor: THEME.ui, color: THEME.text, borderRadius: 14, padding: 16, fontSize: 16, fontWeight: "700", borderWidth: 1, borderColor: THEME.ui2 },
  abstractInput:         { backgroundColor: THEME.ui, color: THEME.text, borderRadius: 14, padding: 16, fontSize: 14, minHeight: 120, textAlignVertical: "top", lineHeight: 22, borderWidth: 1, borderColor: THEME.ui2 },
  fieldInput:            { backgroundColor: THEME.ui, color: THEME.text, borderRadius: 14, padding: 16, fontSize: 14, borderWidth: 1, borderColor: THEME.ui2 },
  bodyInput:             { backgroundColor: THEME.ui, color: THEME.text, borderRadius: 14, padding: 16, minHeight: 350, fontSize: 15, lineHeight: 24, textAlignVertical: "top", borderWidth: 1, borderColor: THEME.ui2 },

  // Hints
  hintRow:               { flexDirection: "row", justifyContent: "space-between", marginTop: 4, marginBottom: 4 },
  charHint:              { color: THEME.textMuted, fontSize: 10 },
  hintWarn:              { color: THEME.orange, fontSize: 10, fontWeight: "700" },

  // Category
  categoryRow:           { marginBottom: 8 },
  categoryPill:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2, marginRight: 8 },
  categoryPillActive:    { backgroundColor: THEME.accent, borderColor: THEME.accent },
  categoryPillTxt:       { color: THEME.textMuted, fontWeight: "700", fontSize: 12 },
  categoryPillTxtActive: { color: "#000" },

  // Field
  fieldGrid:             { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  fieldPill:             { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2 },
  fieldPillActive:       { backgroundColor: THEME.purple, borderColor: THEME.purple },
  fieldPillTxt:          { color: THEME.textMuted, fontSize: 12, fontWeight: "600" },
  fieldPillTxtActive:    { color: "#fff" },
  fieldHint:             { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: THEME.orange + "15", borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: THEME.orange + "30" },
  fieldHintTxt:          { color: THEME.orange, fontSize: 12, fontWeight: "700" },

  // Tags
  tagRow:                { flexDirection: "row", gap: 10, marginBottom: 10 },
  tagInput:              { flex: 1, backgroundColor: THEME.ui, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: THEME.text, borderWidth: 1, borderColor: THEME.ui2, fontSize: 14 },
  tagAddBtn:             { width: 44, height: 44, borderRadius: 12, backgroundColor: THEME.accent, justifyContent: "center", alignItems: "center" },
  tagsWrap:              { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  tagPill:               { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: THEME.accentDim, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: THEME.accent + "40" },
  tagPillTxt:            { color: THEME.accent, fontSize: 12, fontWeight: "700" },

  // Script
  scriptBox:             { backgroundColor: THEME.bg, borderRadius: 14, borderWidth: 1, borderColor: THEME.ui2 },
  scriptInput:           { color: THEME.text, padding: 16, minHeight: 300, fontSize: 14, lineHeight: 22, fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace", textAlignVertical: "top" },

  // Word count
  wordCountBar:          { flexDirection: "row", backgroundColor: THEME.ui, borderRadius: 14, padding: 14, marginTop: 12, borderWidth: 1, borderColor: THEME.ui2 },
  wordCountItem:         { flex: 1, alignItems: "center" },
  wordCountNum:          { color: THEME.accent, fontSize: 16, fontWeight: "900" },
  wordCountLbl:          { color: THEME.textMuted, fontSize: 9, fontWeight: "700", marginTop: 2 },
  wordCountDiv:          { width: 1, backgroundColor: THEME.ui2 },

  // PDF
  pdfDropzone:           { height: 160, backgroundColor: THEME.ui, borderRadius: 16, borderWidth: 2, borderColor: THEME.ui2, borderStyle: "dashed", justifyContent: "center", alignItems: "center", gap: 10 },
  pdfDropzoneTitle:      { color: THEME.purpleLight, fontWeight: "800", fontSize: 15 },
  pdfDropzoneSub:        { color: THEME.textMuted, fontSize: 12 },
  pdfUploaded:           { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, borderRadius: 16, padding: 16, gap: 14, borderWidth: 1, borderColor: THEME.green + "50" },
  pdfUploadedIcon:       { width: 48, height: 48, borderRadius: 12, backgroundColor: THEME.red + "20", justifyContent: "center", alignItems: "center" },
  pdfFileName:           { color: THEME.text, fontWeight: "700", fontSize: 13 },
  pdfFileSize:           { color: THEME.green, fontSize: 11, marginTop: 3 },

  // Price
  priceInputWrap:        { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: THEME.ui2, marginTop: 10, marginBottom: 10 },
  currencySymbol:        { color: THEME.accent, fontSize: 24, fontWeight: "900", marginRight: 8 },
  priceInput:            { flex: 1, color: THEME.text, fontSize: 28, fontWeight: "900" },
  pricePreview:          { color: THEME.green, fontSize: 13, fontWeight: "700" },

  // Checklist
  checklistCard:         { backgroundColor: THEME.ui, borderRadius: 16, padding: 16, marginTop: 20, borderWidth: 1, borderColor: THEME.ui2 },
  checklistTitle:        { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 12 },
  checklistRow:          { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  checklistLbl:          { color: THEME.textMuted, fontSize: 13 },

  // Info boxes
  webInfoBox:            { flexDirection: "row", gap: 10, backgroundColor: THEME.blue + "15", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: THEME.blue + "30", alignItems: "flex-start", marginBottom: 10 },
  webInfoTxt:            { color: THEME.textMuted, fontSize: 12, flex: 1, lineHeight: 18 },
  reviewInfoBox:         { flexDirection: "row", gap: 12, backgroundColor: THEME.accentDim, borderRadius: 16, padding: 16, marginTop: 20, borderWidth: 1, borderColor: THEME.accent + "30", alignItems: "flex-start" },
  reviewInfoTitle:       { color: THEME.accent, fontWeight: "800", fontSize: 13, marginBottom: 6 },
  reviewInfoTxt:         { color: THEME.textMuted, fontSize: 12, lineHeight: 19 },
  guidelinesBox:         { backgroundColor: THEME.ui, borderRadius: 16, padding: 18, marginTop: 20, borderWidth: 1, borderColor: THEME.ui2 },
  guidelinesTitle:       { color: THEME.text, fontWeight: "900", fontSize: 13, marginBottom: 10 },
  guidelinesTxt:         { color: THEME.textMuted, fontSize: 12, lineHeight: 22 },

  // Buttons
  primaryBtn:            { backgroundColor: THEME.accent, borderRadius: 18, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 24 },
  primaryBtnTxt:         { color: "#000", fontWeight: "900", fontSize: 14, letterSpacing: 1 },
  draftBtn:              { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, marginTop: 10 },
  draftBtnTxt:           { color: THEME.purpleLight, fontWeight: "800", fontSize: 14 },
});