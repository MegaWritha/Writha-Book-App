import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  increment,
} from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const { width } = Dimensions.get("window");

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
  orange:      "#F97316",
};

const CATEGORIES = [
  "Literature", "Philosophy", "Science", "Technology",
  "History", "Culture", "Politics", "Arts", "Education", "Other",
];

const FORMATTING_TOOLS = [
  { icon: "format-bold",          label: "Bold",    wrap: "**"  },
  { icon: "format-italic",        label: "Italic",  wrap: "_"   },
  { icon: "format-quote-open",    label: "Quote",   wrap: "> "  },
  { icon: "format-list-bulleted", label: "List",    wrap: "• "  },
  { icon: "format-header-1",      label: "Heading", wrap: "## " },
];

// ── CROSS PLATFORM HELPERS ────────────────────────────────────────────────
const webAlert = (msg: string) => {
  if (Platform.OS === "web") window.alert(msg);
  else Alert.alert("Notice", msg);
};

const webConfirm = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
) => {
  if (Platform.OS === "web") {
    const ok = window.confirm(`${title}\n\n${message}`);
    if (ok) onConfirm();
    else onCancel?.();
  } else {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: onCancel },
      { text: "Confirm", onPress: onConfirm },
    ]);
  }
};

// ── PLACEHOLDER ───────────────────────────────────────────────────────────
const LinearGradientPlaceholder = () => (
  <View style={StyleSheet.absoluteFill} />
);

export default function CreateArticleScreen() {
  const router       = useRouter();
  const user         = auth.currentUser;
  const bodyInputRef = useRef<TextInput>(null);

  // Content
  const [title,         setTitle]         = useState("");
  const [subtitle,      setSubtitle]      = useState("");
  const [body,          setBody]          = useState("");
  const [category,      setCategory]      = useState("");
  const [tags,          setTags]          = useState<string[]>([]);
  const [tagInput,      setTagInput]      = useState("");
  const [coverImage,    setCoverImage]    = useState<string | null>(null);
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);

  // Settings
  const [publishToWeb,  setPublishToWeb]  = useState(false);
  const [allowComments, setAllowComments] = useState(true);
  const [isFeatured,    setIsFeatured]    = useState(false);

  // UI state
  const [publishing,     setPublishing]     = useState(false);
  const [savingDraft,    setSavingDraft]    = useState(false);
  const [activeSection,  setActiveSection]  = useState<"write" | "settings" | "preview">("write");
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // ── HELPERS ───────────────────────────────────────────────────────────
  const calcReadTime = (text: string) =>
    Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 200));

  const wordCount         = body.trim() ? body.trim().split(/\s+/).length : 0;
  const estimatedReadTime = calcReadTime(body);

  // ── IMAGE PICKER ──────────────────────────────────────────────────────
  const pickCoverImage = async () => {
    if (Platform.OS === "web") {
      const input    = document.createElement("input");
      input.type     = "file";
      input.accept   = "image/*";
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataurl = ev.target?.result as string;
          setCoverImageUri(dataurl);
          setCoverImage(dataurl);
        };
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      webAlert("Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverImageUri(result.assets[0].uri);
      setCoverImage(result.assets[0].uri);
    }
  };

  const uploadCoverImage = async (): Promise<string | null> => {
    if (!coverImageUri) return null;
    try {
      setUploadProgress("Uploading cover image...");
      const storage    = getStorage();
      const response   = await fetch(coverImageUri);
      const blob       = await response.blob();
      const storageRef = ref(storage, `articles/${user!.uid}/${Date.now()}.jpg`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      setUploadProgress(null);
      return url;
    } catch (e) {
      console.error("Image upload error:", e);
      setUploadProgress(null);
      return null;
    }
  };

  // ── FORMATTING ────────────────────────────────────────────────────────
  const applyFormatting = (wrap: string) => {
    if (wrap.startsWith(">") || wrap.startsWith("•") || wrap.startsWith("#")) {
      setBody((prev) => prev + "\n" + wrap);
    } else {
      setBody((prev) => prev + wrap + "text" + wrap);
    }
    bodyInputRef.current?.focus();
  };

  // ── TAGS ──────────────────────────────────────────────────────────────
  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !tags.includes(t) && tags.length < 8) {
      setTags([...tags, t]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  // ── VALIDATION ────────────────────────────────────────────────────────
  const validate = (): boolean => {
    if (!title.trim() || title.trim().length < 10) {
      webAlert("Title must be at least 10 characters.");
      return false;
    }
    if (!body.trim()) {
      webAlert("Please write your article body.");
      return false;
    }
    if (wordCount < 50) {
      webAlert(`Articles must be at least 50 words. You have ${wordCount}.`);
      return false;
    }
    if (!category) {
      webAlert("Please select a category in the Settings tab.");
      return false;
    }
    return true;
  };

  // ── SAVE DRAFT ────────────────────────────────────────────────────────
  const saveDraft = async () => {
    if (!title.trim()) {
      webAlert("Add a title to save your draft.");
      return;
    }
    setSavingDraft(true);
    try {
      await addDoc(collection(db, "drafts"), {
        type:         "article",
        status:       "draft",
        title:        title.trim(),
        subtitle:     subtitle.trim(),
        content:      body.trim(),
        category,
        tags,
        coverUrl:     coverImage,
        publishToWeb: false,
        allowComments,
        userId:       user!.uid,
        userName:     user?.displayName || "Scholar",
        userPhoto:    user?.photoURL    || "",
        readTime:     calcReadTime(body),
        createdAt:    serverTimestamp(),
        updatedAt:    serverTimestamp(),
      });

      if (Platform.OS === "web") {
        window.alert("Draft saved! You can find it in your profile drafts.");
      } else {
        Alert.alert("Draft Saved ✅", "Your article draft has been saved.", [
          { text: "Keep Writing" },
          { text: "Go Back", onPress: () => router.back() },
        ]);
      }
    } catch (e: any) {
      webAlert("Error saving draft: " + e.message);
    } finally {
      setSavingDraft(false);
    }
  };

  // ── PUBLISH (submit for admin review) ────────────────────────────────
  const publishArticle = () => {
    if (!validate()) return;

    const confirmMsg = publishToWeb
      ? "Your article will be reviewed by admins before going live on the app and Writha website."
      : "Your article will be reviewed by admins before going live on the Writha app.";

    webConfirm("Submit for Review", confirmMsg, doPublish);
  };

  const doPublish = async () => {
    setPublishing(true);
    try {
      let coverUrl = coverImage;
      if (coverImageUri && !coverImageUri.startsWith("http")) {
        coverUrl = await uploadCoverImage();
      }

      const articleData: Record<string, any> = {
        type:          "article",
        status:        "pending",
        title:         title.trim(),
        subtitle:      subtitle.trim(),
        content:       body.trim(),
        category,
        tags,
        coverUrl:      coverUrl || null,
        publishToWeb,
        allowComments,
        isFeatured,
        userId:        user!.uid,
        userName:      user?.displayName || "Scholar",
        userPhoto:     user?.photoURL    || "",
        userHandle:    user?.email?.split("@")[0] || "scholar",
        likesCount:    0,
        commentsCount: 0,
        likedBy:       [],
        reactions:     {},
        readTime:      calcReadTime(body),
        wordCount,
        createdAt:     serverTimestamp(),
        updatedAt:     serverTimestamp(),
      };

      // Save to articles collection — NOT feed
      const articleRef = await addDoc(collection(db, "articles"), articleData);

      // Add to admin review queue
      await addDoc(collection(db, "adminQueue"), {
        type:        "article",
        articleId:   articleRef.id,
        title:       title.trim(),
        subtitle:    subtitle.trim(),
        coverUrl:    coverUrl || null,
        category,
        content:     body.trim(),
        userId:      user!.uid,
        userName:    user?.displayName || "Scholar",
        userPhoto:   user?.photoURL    || "",
        status:      "pending",
        submittedAt: serverTimestamp(),
      });

      // Update user article count
      try {
        await updateDoc(doc(db, "users", user!.uid), {
          articleCount: increment(1),
        });
      } catch (_) {}

      if (Platform.OS === "web") {
        window.alert(
          "Submitted for Review! 📝\n\nYour article is in the admin queue. You'll be notified when it goes live."
        );
        router.back();
      } else {
        Alert.alert(
          "Submitted for Review! 📝",
          "Your article is in the admin queue. You'll be notified when it goes live.",
          [{ text: "Done", onPress: () => router.back() }]
        );
      }
    } catch (e: any) {
      webAlert("Publish failed: " + e.message);
    } finally {
      setPublishing(false);
    }
  };

  // ── BACK GUARD ────────────────────────────────────────────────────────
  const handleBack = () => {
    if (!title && !body) { router.back(); return; }
    webConfirm(
      "Discard Article?",
      "You have unsaved content. Are you sure?",
      () => router.back()
    );
  };

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={THEME.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Write Article</Text>
          <Text style={styles.headerMeta}>
            {wordCount} words · {estimatedReadTime} min read
            {category ? ` · ${category}` : ""}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.draftBtn}
            onPress={saveDraft}
            disabled={savingDraft}
          >
            {savingDraft
              ? <ActivityIndicator size="small" color={THEME.purpleLight} />
              : <Text style={styles.draftBtnTxt}>Draft</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.publishBtn, publishing && { opacity: 0.6 }]}
            onPress={publishArticle}
            disabled={publishing}
          >
            {publishing
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={styles.publishBtnTxt}>Submit</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* UPLOAD PROGRESS */}
      {uploadProgress && (
        <View style={styles.uploadBanner}>
          <ActivityIndicator size="small" color={THEME.accent} />
          <Text style={styles.uploadBannerTxt}>{uploadProgress}</Text>
        </View>
      )}

      {/* SECTION TABS */}
      <View style={styles.sectionTabs}>
        {[
          { key: "write",    icon: "create-outline",   label: "Write"    },
          { key: "settings", icon: "settings-outline", label: "Settings" },
          { key: "preview",  icon: "eye-outline",      label: "Preview"  },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.sectionTab,
              activeSection === tab.key && styles.sectionTabActive,
            ]}
            onPress={() => setActiveSection(tab.key as any)}
          >
            <Ionicons
              name={tab.icon as any}
              size={16}
              color={activeSection === tab.key ? "#000" : THEME.textMuted}
            />
            <Text style={[
              styles.sectionTabTxt,
              activeSection === tab.key && styles.sectionTabTxtActive,
            ]}>
              {tab.label}
            </Text>
            {tab.key === "settings" && !category && (
              <View style={styles.tabAlert} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── WRITE TAB ── */}
        {activeSection === "write" && (
          <View style={styles.writeSection}>

            {/* COVER IMAGE */}
            <TouchableOpacity
              style={styles.coverPicker}
              onPress={pickCoverImage}
              activeOpacity={0.85}
            >
              {coverImage ? (
                <View style={styles.coverPreviewWrap}>
                  <Image source={{ uri: coverImage }} style={styles.coverPreview} />
                  <View style={styles.coverOverlay}>
                    <Ionicons name="camera-outline" size={24} color="#fff" />
                    <Text style={styles.coverOverlayTxt}>Change Cover</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.coverPlaceholder}>
                  <LinearGradientPlaceholder />
                  <Ionicons name="image-outline" size={36} color={THEME.textMuted} />
                  <Text style={styles.coverPlaceholderTxt}>Add Cover Image</Text>
                  <Text style={styles.coverPlaceholderSub}>Recommended: 1600 × 900px</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* TITLE */}
            <TextInput
              style={styles.titleInput}
              placeholder="Article Title..."
              placeholderTextColor={THEME.ui3}
              value={title}
              onChangeText={setTitle}
              multiline
              maxLength={120}
            />
            <View style={styles.charHintRow}>
              <Text style={styles.charHint}>{title.length}/120</Text>
              {title.length > 0 && title.length < 10 && (
                <Text style={styles.charHintWarn}>
                  {10 - title.length} more chars needed
                </Text>
              )}
            </View>

            {/* SUBTITLE */}
            <TextInput
              style={styles.subtitleInput}
              placeholder="Subtitle or summary (optional)"
              placeholderTextColor={THEME.textMuted}
              value={subtitle}
              onChangeText={setSubtitle}
              maxLength={200}
            />

            <View style={styles.divider} />

            {/* FORMATTING TOOLBAR */}
            <View style={styles.formattingBar}>
              <Text style={styles.formattingLabel}>FORMAT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {FORMATTING_TOOLS.map((tool) => (
                  <TouchableOpacity
                    key={tool.label}
                    style={styles.formatBtn}
                    onPress={() => applyFormatting(tool.wrap)}
                  >
                    <MaterialCommunityIcons
                      name={tool.icon as any}
                      size={18}
                      color={THEME.purpleLight}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* BODY */}
            <TextInput
              ref={bodyInputRef}
              style={styles.bodyInput}
              placeholder={`Start writing your article here...\n\nTips:\n## Heading\n**bold text**\n_italic text_\n> blockquote\n• list item`}
              placeholderTextColor={THEME.textMuted}
              value={body}
              onChangeText={setBody}
              multiline
              textAlignVertical="top"
            />

            {/* WORD COUNT BAR */}
            <View style={styles.wordCountBar}>
              <View style={styles.wordCountItem}>
                <Text style={styles.wordCountNum}>{wordCount}</Text>
                <Text style={styles.wordCountLbl}>Words</Text>
              </View>
              <View style={styles.wordCountDivider} />
              <View style={styles.wordCountItem}>
                <Text style={styles.wordCountNum}>{estimatedReadTime}</Text>
                <Text style={styles.wordCountLbl}>Min Read</Text>
              </View>
              <View style={styles.wordCountDivider} />
              <View style={styles.wordCountItem}>
                <Text style={[
                  styles.wordCountNum,
                  wordCount >= 50 ? { color: THEME.green } : { color: THEME.red },
                ]}>
                  {wordCount >= 50 ? "✓ Ready" : `${50 - wordCount} more`}
                </Text>
                <Text style={styles.wordCountLbl}>Min Words</Text>
              </View>
            </View>

            {!category && (
              <TouchableOpacity
                style={styles.categoryHint}
                onPress={() => setActiveSection("settings")}
              >
                <Ionicons name="alert-circle-outline" size={16} color={THEME.orange} />
                <Text style={styles.categoryHintTxt}>
                  Don't forget to select a category in Settings
                </Text>
                <Ionicons name="chevron-forward" size={14} color={THEME.orange} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── SETTINGS TAB ── */}
        {activeSection === "settings" && (
          <View style={styles.settingsSection}>

            <Text style={styles.settingsLabel}>CATEGORY *</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryPill,
                    category === cat && styles.categoryPillActive,
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[
                    styles.categoryPillTxt,
                    category === cat && styles.categoryPillTxtActive,
                  ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.settingsLabel}>TAGS ({tags.length}/8)</Text>
            <View style={styles.tagInputRow}>
              <TextInput
                style={styles.tagInput}
                placeholder="Add a tag and press enter..."
                placeholderTextColor={THEME.textMuted}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={addTag}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.tagAddBtn} onPress={addTag}>
                <Ionicons name="add" size={20} color="#000" />
              </TouchableOpacity>
            </View>
            {tags.length > 0 && (
              <View style={styles.tagsWrap}>
                {tags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={styles.tagPill}
                    onPress={() => removeTag(tag)}
                  >
                    <Text style={styles.tagPillTxt}>#{tag}</Text>
                    <Ionicons name="close" size={12} color={THEME.accent} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.settingsLabel}>PUBLISH OPTIONS</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingRowInfo}>
                <View style={[styles.settingIconCircle, { backgroundColor: THEME.blue + "20" }]}>
                  <Ionicons name="globe-outline" size={18} color={THEME.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingRowTitle}>Publish to Web</Text>
                  <Text style={styles.settingRowSub}>
                    Visible on the public Writha website and search engines
                  </Text>
                </View>
              </View>
              <Switch
                value={publishToWeb}
                onValueChange={setPublishToWeb}
                trackColor={{ false: THEME.ui2, true: THEME.blue }}
                thumbColor={publishToWeb ? THEME.accent : THEME.textMuted}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingRowInfo}>
                <View style={[styles.settingIconCircle, { backgroundColor: THEME.purple + "20" }]}>
                  <Ionicons name="chatbubbles-outline" size={18} color={THEME.purpleLight} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingRowTitle}>Allow Comments</Text>
                  <Text style={styles.settingRowSub}>
                    Let readers comment on your article
                  </Text>
                </View>
              </View>
              <Switch
                value={allowComments}
                onValueChange={setAllowComments}
                trackColor={{ false: THEME.ui2, true: THEME.purple }}
                thumbColor={allowComments ? THEME.accent : THEME.textMuted}
              />
            </View>

            {publishToWeb && (
              <View style={styles.webInfoBox}>
                <Ionicons name="information-circle" size={18} color={THEME.blue} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.webInfoTitle}>Web Publishing Active</Text>
                  <Text style={styles.webInfoTxt}>
                    Your article will appear on writha.com/articles after admin approval.
                  </Text>
                </View>
              </View>
            )}

            {/* Admin review notice */}
            <View style={styles.reviewNotice}>
              <Ionicons name="shield-checkmark-outline" size={18} color={THEME.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewNoticeTitle}>Admin Review Required</Text>
                <Text style={styles.reviewNoticeTxt}>
                  All articles are reviewed before going live. This usually takes 24–48 hours.
                  You'll be notified when your article is approved or if changes are needed.
                </Text>
              </View>
            </View>

            <View style={styles.guidelinesBox}>
              <Text style={styles.guidelinesTitle}>📋 Article Guidelines</Text>
              <Text style={styles.guidelinesTxt}>
                • Minimum 50 words required{"\n"}
                • Original work only — no plagiarism{"\n"}
                • Respectful and constructive tone{"\n"}
                • No misinformation or unverified claims{"\n"}
                • Images must be owned by you or royalty-free{"\n"}
                • Articles violating guidelines will be removed
              </Text>
            </View>
          </View>
        )}

        {/* ── PREVIEW TAB ── */}
        {activeSection === "preview" && (
          <View style={styles.previewSection}>
            <View style={styles.previewBanner}>
              <Ionicons name="eye-outline" size={16} color={THEME.blue} />
              <Text style={styles.previewBannerTxt}>
                Reader preview — this is how your article will appear after approval
              </Text>
            </View>

            <View style={styles.readinessCard}>
              <Text style={styles.readinessTitle}>SUBMISSION CHECKLIST</Text>
              {[
                { label: "Title (10+ chars)",  ok: title.trim().length >= 10    },
                { label: "Body (50+ words)",    ok: wordCount >= 50              },
                { label: "Category selected",   ok: !!category                  },
                { label: "Cover image",         ok: !!coverImage, optional: true },
                { label: "Subtitle",            ok: !!subtitle,   optional: true },
                { label: "Tags added",          ok: tags.length > 0, optional: true },
              ].map((item) => (
                <View key={item.label} style={styles.checklistRow}>
                  <Ionicons
                    name={item.ok ? "checkmark-circle" : "ellipse-outline"}
                    size={16}
                    color={
                      item.ok ? THEME.green :
                      item.optional ? THEME.textMuted : THEME.red
                    }
                  />
                  <Text style={[
                    styles.checklistLabel,
                    item.ok && { color: THEME.green },
                    !item.ok && !item.optional && { color: THEME.red },
                  ]}>
                    {item.label}
                    {item.optional && !item.ok ? " (optional)" : ""}
                  </Text>
                </View>
              ))}
            </View>

            {coverImage ? (
              <Image
                source={{ uri: coverImage }}
                style={styles.previewCover}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.previewNoCover}>
                <Ionicons name="image-outline" size={32} color={THEME.textMuted} />
                <Text style={{ color: THEME.textMuted, marginTop: 8, fontSize: 12 }}>
                  No cover image
                </Text>
              </View>
            )}

            {category && (
              <View style={styles.previewMeta}>
                <View style={styles.previewCategoryBadge}>
                  <Text style={styles.previewCategoryTxt}>{category.toUpperCase()}</Text>
                </View>
                {publishToWeb && (
                  <View style={styles.previewWebBadge}>
                    <Ionicons name="globe-outline" size={10} color={THEME.blue} />
                    <Text style={styles.previewWebTxt}>WEB</Text>
                  </View>
                )}
              </View>
            )}

            <Text style={styles.previewTitle}>
              {title || "Your Article Title"}
            </Text>

            {subtitle ? (
              <Text style={styles.previewSubtitle}>{subtitle}</Text>
            ) : null}

            <View style={styles.previewAuthorRow}>
              {user?.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.previewAvatar} />
              ) : (
                <View style={[styles.previewAvatar, styles.previewAvatarFallback]}>
                  <Text style={{ color: THEME.accent, fontWeight: "900", fontSize: 14 }}>
                    {(user?.displayName || "W")[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View>
                <Text style={styles.previewAuthorName}>
                  {user?.displayName || "Scholar"}
                </Text>
                <Text style={styles.previewReadTime}>
                  {estimatedReadTime} min read · {wordCount} words
                </Text>
              </View>
            </View>

            <View style={styles.previewDivider} />

            <Text style={styles.previewBody}>
              {body || "Your article content will appear here..."}
            </Text>

            {tags.length > 0 && (
              <View style={styles.previewTagsRow}>
                {tags.map((tag) => (
                  <View key={tag} style={styles.previewTag}>
                    <Text style={styles.previewTagTxt}>#{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* BOTTOM BAR */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarLeft}>
          <Ionicons
            name={publishToWeb ? "globe" : "phone-portrait-outline"}
            size={16}
            color={publishToWeb ? THEME.blue : THEME.textMuted}
          />
          <Text style={[styles.bottomBarTxt, publishToWeb && { color: THEME.blue }]}>
            {publishToWeb ? "App + Web" : "App Only"}
          </Text>
          {wordCount > 0 && (
            <Text style={styles.bottomWordCount}>· {wordCount} words</Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.bottomPublishBtn, publishing && { opacity: 0.6 }]}
          onPress={publishArticle}
          disabled={publishing}
        >
          {publishing ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <>
              <Ionicons name="rocket-outline" size={18} color="#000" />
              <Text style={styles.bottomPublishBtnTxt}>SUBMIT FOR REVIEW</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:             { flex: 1, backgroundColor: THEME.bg },
  header:                { paddingTop: Platform.OS === "ios" ? 56 : 40, paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  backBtn:               { padding: 4 },
  headerCenter:          { flex: 1, marginHorizontal: 12 },
  headerTitle:           { color: THEME.text, fontWeight: "900", fontSize: 16 },
  headerMeta:            { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  headerActions:         { flexDirection: "row", gap: 8 },
  draftBtn:              { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: THEME.ui2 },
  draftBtnTxt:           { color: THEME.purpleLight, fontWeight: "700", fontSize: 13 },
  publishBtn:            { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: THEME.accent },
  publishBtnTxt:         { color: "#000", fontWeight: "900", fontSize: 13 },
  uploadBanner:          { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: THEME.ui2, paddingHorizontal: 16, paddingVertical: 10 },
  uploadBannerTxt:       { color: THEME.text, fontSize: 13 },
  sectionTabs:           { flexDirection: "row", backgroundColor: THEME.ui, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  sectionTab:            { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, gap: 6, position: "relative" },
  sectionTabActive:      { backgroundColor: THEME.accent },
  sectionTabTxt:         { color: THEME.textMuted, fontWeight: "700", fontSize: 12 },
  sectionTabTxtActive:   { color: "#000" },
  tabAlert:              { position: "absolute", top: 8, right: 18, width: 7, height: 7, borderRadius: 4, backgroundColor: THEME.red },
  writeSection:          { padding: 16 },
  coverPicker:           { borderRadius: 16, overflow: "hidden", marginBottom: 20, borderWidth: 1.5, borderColor: THEME.ui2, borderStyle: "dashed" },
  coverPlaceholder:      { height: 180, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center", gap: 8 },
  coverPlaceholderTxt:   { color: THEME.textMuted, fontWeight: "700", fontSize: 14 },
  coverPlaceholderSub:   { color: THEME.textMuted, fontSize: 11 },
  coverPreviewWrap:      { height: 180, position: "relative" },
  coverPreview:          { width: "100%", height: "100%" },
  coverOverlay:          { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", gap: 6 },
  coverOverlayTxt:       { color: "#fff", fontWeight: "700", fontSize: 13 },
  titleInput:            { color: THEME.text, fontSize: 28, fontWeight: "900", lineHeight: 36, marginBottom: 4 },
  charHintRow:           { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  charHint:              { color: THEME.textMuted, fontSize: 10 },
  charHintWarn:          { color: THEME.orange, fontSize: 10, fontWeight: "700" },
  subtitleInput:         { color: THEME.textMuted, fontSize: 16, lineHeight: 24, marginBottom: 16 },
  divider:               { height: 1, backgroundColor: THEME.ui2, marginBottom: 12 },
  formattingBar:         { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 },
  formattingLabel:       { color: THEME.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  formatBtn:             { width: 36, height: 36, borderRadius: 10, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center", marginRight: 6 },
  bodyInput:             { color: THEME.text, fontSize: 16, lineHeight: 28, minHeight: 400, textAlignVertical: "top" },
  wordCountBar:          { flexDirection: "row", backgroundColor: THEME.ui, borderRadius: 14, padding: 14, marginTop: 20, borderWidth: 1, borderColor: THEME.ui2 },
  wordCountItem:         { flex: 1, alignItems: "center" },
  wordCountNum:          { color: THEME.accent, fontSize: 18, fontWeight: "900" },
  wordCountLbl:          { color: THEME.textMuted, fontSize: 9, fontWeight: "700", marginTop: 2 },
  wordCountDivider:      { width: 1, backgroundColor: THEME.ui2 },
  categoryHint:          { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: THEME.orange + "15", borderRadius: 12, padding: 12, marginTop: 16, borderWidth: 1, borderColor: THEME.orange + "30" },
  categoryHintTxt:       { color: THEME.orange, fontSize: 12, fontWeight: "700", flex: 1 },
  settingsSection:       { padding: 16 },
  settingsLabel:         { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 12, marginTop: 24 },
  categoryGrid:          { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryPill:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2 },
  categoryPillActive:    { backgroundColor: THEME.accent, borderColor: THEME.accent },
  categoryPillTxt:       { color: THEME.textMuted, fontWeight: "700", fontSize: 12 },
  categoryPillTxtActive: { color: "#000" },
  tagInputRow:           { flexDirection: "row", gap: 10 },
  tagInput:              { flex: 1, backgroundColor: THEME.ui, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: THEME.text, borderWidth: 1, borderColor: THEME.ui2, fontSize: 14 },
  tagAddBtn:             { width: 44, height: 44, borderRadius: 12, backgroundColor: THEME.accent, justifyContent: "center", alignItems: "center" },
  tagsWrap:              { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  tagPill:               { flexDirection: "row", alignItems: "center", backgroundColor: THEME.accentDim, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: THEME.accent + "40" },
  tagPillTxt:            { color: THEME.accent, fontSize: 12, fontWeight: "700" },
  settingRow:            { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: THEME.ui, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: THEME.ui2 },
  settingRowInfo:        { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, marginRight: 10 },
  settingIconCircle:     { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  settingRowTitle:       { color: THEME.text, fontWeight: "800", fontSize: 14 },
  settingRowSub:         { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  webInfoBox:            { flexDirection: "row", gap: 10, backgroundColor: THEME.blue + "15", borderRadius: 14, padding: 14, marginTop: 4, borderWidth: 1, borderColor: THEME.blue + "30", alignItems: "flex-start" },
  webInfoTitle:          { color: THEME.blue, fontWeight: "800", fontSize: 13, marginBottom: 4 },
  webInfoTxt:            { color: THEME.textMuted, fontSize: 12, lineHeight: 18 },
  reviewNotice:          { flexDirection: "row", gap: 12, backgroundColor: THEME.accentDim, borderRadius: 16, padding: 16, marginTop: 16, borderWidth: 1, borderColor: THEME.accent + "30", alignItems: "flex-start" },
  reviewNoticeTitle:     { color: THEME.accent, fontWeight: "800", fontSize: 13, marginBottom: 6 },
  reviewNoticeTxt:       { color: THEME.textMuted, fontSize: 12, lineHeight: 19 },
  guidelinesBox:         { backgroundColor: THEME.ui, borderRadius: 16, padding: 18, marginTop: 16, borderWidth: 1, borderColor: THEME.ui2 },
  guidelinesTitle:       { color: THEME.text, fontWeight: "900", fontSize: 14, marginBottom: 12 },
  guidelinesTxt:         { color: THEME.textMuted, fontSize: 12, lineHeight: 22 },
  previewSection:        { padding: 16 },
  previewBanner:         { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: THEME.blue + "15", borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: THEME.blue + "30" },
  previewBannerTxt:      { color: THEME.blue, fontSize: 12, fontWeight: "600", flex: 1 },
  readinessCard:         { backgroundColor: THEME.ui, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: THEME.ui2 },
  readinessTitle:        { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 12 },
  checklistRow:          { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  checklistLabel:        { color: THEME.textMuted, fontSize: 13 },
  previewCover:          { width: "100%", height: 200, borderRadius: 18, marginBottom: 16 },
  previewNoCover:        { width: "100%", height: 120, borderRadius: 18, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: THEME.ui2 },
  previewMeta:           { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  previewCategoryBadge:  { backgroundColor: THEME.accentDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  previewCategoryTxt:    { color: THEME.accent, fontSize: 9, fontWeight: "900" },
  previewWebBadge:       { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: THEME.blue + "20", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  previewWebTxt:         { color: THEME.blue, fontSize: 9, fontWeight: "900" },
  previewTitle:          { color: THEME.text, fontSize: 26, fontWeight: "900", lineHeight: 34, marginBottom: 10 },
  previewSubtitle:       { color: THEME.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 16 },
  previewAuthorRow:      { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  previewAvatar:         { width: 40, height: 40, borderRadius: 12 },
  previewAvatarFallback: { backgroundColor: THEME.purple, justifyContent: "center", alignItems: "center" },
  previewAuthorName:     { color: THEME.text, fontWeight: "800", fontSize: 14 },
  previewReadTime:       { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  previewDivider:        { height: 1, backgroundColor: THEME.ui2, marginBottom: 20 },
  previewBody:           { color: THEME.text, fontSize: 15, lineHeight: 26 },
  previewTagsRow:        { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 24 },
  previewTag:            { backgroundColor: THEME.ui, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: THEME.ui2 },
  previewTagTxt:         { color: THEME.textMuted, fontSize: 12 },
  bottomBar:             { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: THEME.ui, borderTopWidth: 1, borderTopColor: THEME.ui2, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bottomBarLeft:         { flexDirection: "row", alignItems: "center", gap: 6 },
  bottomBarTxt:          { color: THEME.textMuted, fontSize: 12, fontWeight: "700" },
  bottomWordCount:       { color: THEME.textMuted, fontSize: 11 },
  bottomPublishBtn:      { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: THEME.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  bottomPublishBtnTxt:   { color: "#000", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
});