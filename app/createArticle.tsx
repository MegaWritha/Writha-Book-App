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

const CATEGORIES = [
  "Literature", "Philosophy", "Science", "Technology",
  "History", "Culture", "Politics", "Arts", "Education", "Other",
];

const FORMATTING_TOOLS = [
  { icon: "format-bold", label: "Bold", wrap: "**" },
  { icon: "format-italic", label: "Italic", wrap: "_" },
  { icon: "format-quote-open", label: "Quote", wrap: "> " },
  { icon: "format-list-bulleted", label: "List", wrap: "• " },
  { icon: "format-header-1", label: "Heading", wrap: "## " },
];

export default function CreateArticleScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const bodyInputRef = useRef<TextInput>(null);

  // Article content
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);

  // Settings
  const [publishToWeb, setPublishToWeb] = useState(false);
  const [allowComments, setAllowComments] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [readTime, setReadTime] = useState(0);

  // State
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [activeSection, setActiveSection] = useState<"write" | "settings" | "preview">("write");

  // Auto calculate read time
  const calcReadTime = (text: string) => {
    const words = text.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
  };

  // ── IMAGE PICKER ──────────────────────────────────────────────────────
  const pickCoverImage = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
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
      const storage = getStorage();
      const response = await fetch(coverImageUri);
      const blob = await response.blob();
      const storageRef = ref(storage, `articles/${user!.uid}/${Date.now()}.jpg`);
      await uploadBytes(storageRef, blob);
      return await getDownloadURL(storageRef);
    } catch (e) {
      console.error("Image upload error:", e);
      return null;
    }
  };

  // ── FORMATTING TOOLS ──────────────────────────────────────────────────
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
  const validate = () => {
    if (!title.trim()) {
      Alert.alert("Title Required", "Please give your article a title.");
      return false;
    }
    if (title.trim().length < 10) {
      Alert.alert("Title Too Short", "Title must be at least 10 characters.");
      return false;
    }
    if (!body.trim()) {
      Alert.alert("Content Required", "Please write your article body.");
      return false;
    }
    if (body.trim().split(/\s+/).length < 50) {
      Alert.alert("Too Short", "Articles must be at least 50 words.");
      return false;
    }
    if (!category) {
      Alert.alert("Category Required", "Please select a category.");
      return false;
    }
    return true;
  };

  // ── SAVE DRAFT ────────────────────────────────────────────────────────
  const saveDraft = async () => {
    if (!title.trim()) {
      Alert.alert("Title Required", "Add a title to save your draft.");
      return;
    }
    setSavingDraft(true);
    try {
      await addDoc(collection(db, "feed"), {
        type: "article",
        status: "draft",
        title: title.trim(),
        subtitle: subtitle.trim(),
        content: body.trim(),
        category,
        tags,
        coverUrl: coverImage,
        publishToWeb: false,
        allowComments,
        userId: user!.uid,
        userName: user?.displayName || "Scholar",
        userPhoto: user?.photoURL || "",
        likesCount: 0,
        commentsCount: 0,
        likedBy: [],
        readTime: calcReadTime(body),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      Alert.alert("Draft Saved ✅", "Your article draft has been saved.", [
        { text: "Keep Writing" },
        { text: "Go Back", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSavingDraft(false);
    }
  };

  // ── PUBLISH ───────────────────────────────────────────────────────────
  const publishArticle = async () => {
    if (!validate()) return;

    Alert.alert(
      "Publish Article",
      publishToWeb
        ? "This article will be published to the Writha app AND the public Writha website."
        : "This article will be published to the Writha app only.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Publish",
          onPress: async () => {
            setPublishing(true);
            try {
              // Upload cover image if selected
              let coverUrl = coverImage;
              if (coverImageUri && !coverImageUri.startsWith("http")) {
                coverUrl = await uploadCoverImage();
              }

              const articleData = {
                type: "article",
                status: "published",
                title: title.trim(),
                subtitle: subtitle.trim(),
                content: body.trim(),
                category,
                tags,
                coverUrl: coverUrl || null,
                publishToWeb,
                allowComments,
                isFeatured,
                userId: user!.uid,
                userName: user?.displayName || "Scholar",
                userPhoto: user?.photoURL || "",
                likesCount: 0,
                commentsCount: 0,
                likedBy: [],
                readTime: calcReadTime(body),
                wordCount: body.trim().split(/\s+/).length,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              };

              // Save to feed collection
              const docRef = await addDoc(collection(db, "feed"), articleData);

              // If publish to web, also mirror to articles collection
              if (publishToWeb) {
                await addDoc(collection(db, "articles"), {
                  ...articleData,
                  feedId: docRef.id,
                });
              }

              // Increment user's article count
              await updateDoc(doc(db, "users", user!.uid), {
                articleCount: increment(1),
              });

              Alert.alert(
                "Published! 🎉",
                publishToWeb
                  ? "Your article is live on the app and Writha web!"
                  : "Your article is live on Writha!",
                [{ text: "Done", onPress: () => router.back() }]
              );
            } catch (e: any) {
              Alert.alert("Error", e.message);
            } finally {
              setPublishing(false);
            }
          },
        },
      ]
    );
  };

  // ── WORD COUNT ────────────────────────────────────────────────────────
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const estimatedReadTime = calcReadTime(body);

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (title || body) {
            Alert.alert("Discard Article?", "You have unsaved content.", [
              { text: "Keep Writing", style: "cancel" },
              { text: "Discard", style: "destructive", onPress: () => router.back() },
            ]);
          } else {
            router.back();
          }
        }}>
          <Ionicons name="arrow-back" size={24} color={THEME.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Write Article</Text>
          <Text style={styles.headerMeta}>
            {wordCount} words · {estimatedReadTime} min read
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.draftBtn}
            onPress={saveDraft}
            disabled={savingDraft}
          >
            {savingDraft ? (
              <ActivityIndicator size="small" color={THEME.purpleLight} />
            ) : (
              <Text style={styles.draftBtnTxt}>Draft</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.publishBtn, publishing && { opacity: 0.7 }]}
            onPress={publishArticle}
            disabled={publishing}
          >
            {publishing ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.publishBtnTxt}>Publish</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* SECTION TABS */}
      <View style={styles.sectionTabs}>
        {[
          { key: "write", icon: "create-outline", label: "Write" },
          { key: "settings", icon: "settings-outline", label: "Settings" },
          { key: "preview", icon: "eye-outline", label: "Preview" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.sectionTab, activeSection === tab.key && styles.sectionTabActive]}
            onPress={() => setActiveSection(tab.key as any)}
          >
            <Ionicons
              name={tab.icon as any}
              size={16}
              color={activeSection === tab.key ? "#000" : THEME.textMuted}
            />
            <Text style={[styles.sectionTabTxt, activeSection === tab.key && styles.sectionTabTxtActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── WRITE TAB ── */}
        {activeSection === "write" && (
          <View style={styles.writeSection}>

            {/* COVER IMAGE */}
            <TouchableOpacity style={styles.coverPicker} onPress={pickCoverImage} activeOpacity={0.85}>
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
              placeholderTextColor={THEME.ui2}
              value={title}
              onChangeText={setTitle}
              multiline
              maxLength={120}
            />
            <Text style={styles.charHint}>{title.length}/120</Text>

            {/* SUBTITLE */}
            <TextInput
              style={styles.subtitleInput}
              placeholder="Subtitle or summary (optional)"
              placeholderTextColor={THEME.textMuted}
              value={subtitle}
              onChangeText={setSubtitle}
              maxLength={200}
            />

            {/* DIVIDER */}
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
                    <MaterialCommunityIcons name={tool.icon as any} size={18} color={THEME.purpleLight} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* BODY */}
            <TextInput
              ref={bodyInputRef}
              style={styles.bodyInput}
              placeholder={`Start writing your article here...\n\nTip: Use ## for headings, ** for bold, _ for italic, and > for quotes.`}
              placeholderTextColor={THEME.textMuted}
              value={body}
              onChangeText={(t) => {
                setBody(t);
                setReadTime(calcReadTime(t));
              }}
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
                <Text style={[styles.wordCountNum, wordCount >= 50 ? { color: THEME.green } : { color: THEME.red }]}>
                  {wordCount >= 50 ? "✓" : `${50 - wordCount} more`}
                </Text>
                <Text style={styles.wordCountLbl}>Min Words</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── SETTINGS TAB ── */}
        {activeSection === "settings" && (
          <View style={styles.settingsSection}>

            {/* CATEGORY */}
            <Text style={styles.settingsLabel}>CATEGORY</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryPill, category === cat && styles.categoryPillActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.categoryPillTxt, category === cat && styles.categoryPillTxtActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* TAGS */}
            <Text style={styles.settingsLabel}>TAGS ({tags.length}/8)</Text>
            <View style={styles.tagInputRow}>
              <TextInput
                style={styles.tagInput}
                placeholder="Add a tag..."
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
            <View style={styles.tagsWrap}>
              {tags.map((tag) => (
                <TouchableOpacity key={tag} style={styles.tagPill} onPress={() => removeTag(tag)}>
                  <Text style={styles.tagPillTxt}>#{tag}</Text>
                  <Ionicons name="close" size={12} color={THEME.accent} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              ))}
            </View>

            {/* PUBLISH OPTIONS */}
            <Text style={styles.settingsLabel}>PUBLISH OPTIONS</Text>

            {/* Publish to Web */}
            <View style={styles.settingRow}>
              <View style={styles.settingRowInfo}>
                <View style={styles.settingIconCircle}>
                  <Ionicons name="globe-outline" size={18} color={THEME.blue} />
                </View>
                <View>
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

            {/* Allow Comments */}
            <View style={styles.settingRow}>
              <View style={styles.settingRowInfo}>
                <View style={styles.settingIconCircle}>
                  <Ionicons name="chatbubbles-outline" size={18} color={THEME.purpleLight} />
                </View>
                <View>
                  <Text style={styles.settingRowTitle}>Allow Comments</Text>
                  <Text style={styles.settingRowSub}>Let readers comment on your article</Text>
                </View>
              </View>
              <Switch
                value={allowComments}
                onValueChange={setAllowComments}
                trackColor={{ false: THEME.ui2, true: THEME.purple }}
                thumbColor={allowComments ? THEME.accent : THEME.textMuted}
              />
            </View>

            {/* Web publishing info box */}
            {publishToWeb && (
              <View style={styles.webInfoBox}>
                <Ionicons name="information-circle" size={18} color={THEME.blue} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.webInfoTitle}>Web Publishing Active</Text>
                  <Text style={styles.webInfoTxt}>
                    Your article will appear on writha.com/articles and may be indexed by search engines.
                    Make sure your content follows Writha's community guidelines.
                  </Text>
                </View>
              </View>
            )}

            {/* GUIDELINES */}
            <View style={styles.guidelinesBox}>
              <Text style={styles.guidelinesTitle}>📋 Article Guidelines</Text>
              <Text style={styles.guidelinesTxt}>
                • Minimum 50 words required for publishing{"\n"}
                • No plagiarised content — original work only{"\n"}
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
              <Text style={styles.previewBannerTxt}>This is how your article will appear to readers</Text>
            </View>

            {/* Cover */}
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.previewCover} resizeMode="cover" />
            ) : (
              <View style={styles.previewNoCover}>
                <Ionicons name="image-outline" size={32} color={THEME.textMuted} />
                <Text style={{ color: THEME.textMuted, marginTop: 8, fontSize: 12 }}>No cover image</Text>
              </View>
            )}

            {/* Category + tags */}
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

            {/* Title */}
            <Text style={styles.previewTitle}>
              {title || "Your Article Title"}
            </Text>

            {/* Subtitle */}
            {subtitle ? (
              <Text style={styles.previewSubtitle}>{subtitle}</Text>
            ) : null}

            {/* Author + read time */}
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
                <Text style={styles.previewAuthorName}>{user?.displayName || "Scholar"}</Text>
                <Text style={styles.previewReadTime}>
                  {estimatedReadTime} min read · {wordCount} words
                </Text>
              </View>
            </View>

            <View style={styles.previewDivider} />

            {/* Body preview */}
            <Text style={styles.previewBody}>
              {body || "Your article content will appear here..."}
            </Text>

            {/* Tags */}
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

      {/* BOTTOM PUBLISH BAR */}
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
        </View>
        <TouchableOpacity
          style={[styles.bottomPublishBtn, publishing && { opacity: 0.7 }]}
          onPress={publishArticle}
          disabled={publishing}
        >
          {publishing ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <>
              <Ionicons name="rocket-outline" size={18} color="#000" />
              <Text style={styles.bottomPublishBtnTxt}>PUBLISH ARTICLE</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },

  // Header
  header: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  headerCenter: { flex: 1, marginHorizontal: 12 },
  headerTitle: { color: THEME.text, fontWeight: "900", fontSize: 16 },
  headerMeta: { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8 },
  draftBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: THEME.ui2 },
  draftBtnTxt: { color: THEME.purpleLight, fontWeight: "700", fontSize: 13 },
  publishBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: THEME.accent },
  publishBtnTxt: { color: "#000", fontWeight: "900", fontSize: 13 },

  // Section tabs
  sectionTabs: { flexDirection: "row", backgroundColor: THEME.ui, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  sectionTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, gap: 6 },
  sectionTabActive: { backgroundColor: THEME.accent, borderRadius: 0 },
  sectionTabTxt: { color: THEME.textMuted, fontWeight: "700", fontSize: 12 },
  sectionTabTxtActive: { color: "#000" },

  // Write section
  writeSection: { padding: 16 },
  coverPicker: { borderRadius: 16, overflow: "hidden", marginBottom: 20, borderWidth: 1.5, borderColor: THEME.ui2, borderStyle: "dashed" },
  coverPlaceholder: { height: 180, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center", gap: 8 },
  coverPlaceholderTxt: { color: THEME.textMuted, fontWeight: "700", fontSize: 14 },
  coverPlaceholderSub: { color: THEME.textMuted, fontSize: 11 },
  coverPreviewWrap: { height: 180, position: "relative" },
  coverPreview: { width: "100%", height: "100%" },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", gap: 6 },
  coverOverlayTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  titleInput: { color: THEME.text, fontSize: 28, fontWeight: "900", lineHeight: 36, marginBottom: 4 },
  charHint: { color: THEME.textMuted, fontSize: 10, textAlign: "right", marginBottom: 12 },
  subtitleInput: { color: THEME.textMuted, fontSize: 16, lineHeight: 24, marginBottom: 16 },
  divider: { height: 1, backgroundColor: THEME.ui2, marginBottom: 12 },
  formattingBar: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 },
  formattingLabel: { color: THEME.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  formatBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center", marginRight: 6 },
  bodyInput: { color: THEME.text, fontSize: 16, lineHeight: 26, minHeight: 400, textAlignVertical: "top" },
  wordCountBar: { flexDirection: "row", backgroundColor: THEME.ui, borderRadius: 14, padding: 14, marginTop: 20, borderWidth: 1, borderColor: THEME.ui2 },
  wordCountItem: { flex: 1, alignItems: "center" },
  wordCountNum: { color: THEME.accent, fontSize: 18, fontWeight: "900" },
  wordCountLbl: { color: THEME.textMuted, fontSize: 9, fontWeight: "700", marginTop: 2 },
  wordCountDivider: { width: 1, backgroundColor: THEME.ui2 },

  // Settings section
  settingsSection: { padding: 16 },
  settingsLabel: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 12, marginTop: 24 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2 },
  categoryPillActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  categoryPillTxt: { color: THEME.textMuted, fontWeight: "700", fontSize: 12 },
  categoryPillTxtActive: { color: "#000" },
  tagInputRow: { flexDirection: "row", gap: 10 },
  tagInput: { flex: 1, backgroundColor: THEME.ui, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: THEME.text, borderWidth: 1, borderColor: THEME.ui2, fontSize: 14 },
  tagAddBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: THEME.accent, justifyContent: "center", alignItems: "center" },
  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  tagPill: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.accentDim, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: THEME.accent + "40" },
  tagPillTxt: { color: THEME.accent, fontSize: 12, fontWeight: "700" },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: THEME.ui, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: THEME.ui2 },
  settingRowInfo: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, marginRight: 10 },
  settingIconCircle: { width: 36, height: 36, borderRadius: 10, backgroundColor: THEME.ui2, justifyContent: "center", alignItems: "center" },
  settingRowTitle: { color: THEME.text, fontWeight: "800", fontSize: 14 },
  settingRowSub: { color: THEME.textMuted, fontSize: 11, marginTop: 2, maxWidth: width * 0.55 },
  webInfoBox: { flexDirection: "row", gap: 10, backgroundColor: THEME.blue + "15", borderRadius: 14, padding: 14, marginTop: 4, borderWidth: 1, borderColor: THEME.blue + "30", alignItems: "flex-start" },
  webInfoTitle: { color: THEME.blue, fontWeight: "800", fontSize: 13, marginBottom: 4 },
  webInfoTxt: { color: THEME.textMuted, fontSize: 12, lineHeight: 18 },
  guidelinesBox: { backgroundColor: THEME.ui, borderRadius: 16, padding: 18, marginTop: 20, borderWidth: 1, borderColor: THEME.ui2 },
  guidelinesTitle: { color: THEME.text, fontWeight: "900", fontSize: 14, marginBottom: 12 },
  guidelinesTxt: { color: THEME.textMuted, fontSize: 12, lineHeight: 22 },

  // Preview section
  previewSection: { padding: 16 },
  previewBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: THEME.blue + "15", borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: THEME.blue + "30" },
  previewBannerTxt: { color: THEME.blue, fontSize: 12, fontWeight: "600" },
  previewCover: { width: "100%", height: 200, borderRadius: 18, marginBottom: 16 },
  previewNoCover: { width: "100%", height: 120, borderRadius: 18, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: THEME.ui2 },
  previewMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  previewCategoryBadge: { backgroundColor: THEME.accentDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  previewCategoryTxt: { color: THEME.accent, fontSize: 9, fontWeight: "900" },
  previewWebBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: THEME.blue + "20", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  previewWebTxt: { color: THEME.blue, fontSize: 9, fontWeight: "900" },
  previewTitle: { color: THEME.text, fontSize: 26, fontWeight: "900", lineHeight: 34, marginBottom: 10 },
  previewSubtitle: { color: THEME.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 16 },
  previewAuthorRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  previewAvatar: { width: 40, height: 40, borderRadius: 12 },
  previewAvatarFallback: { backgroundColor: THEME.purple, justifyContent: "center", alignItems: "center" },
  previewAuthorName: { color: THEME.text, fontWeight: "800", fontSize: 14 },
  previewReadTime: { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  previewDivider: { height: 1, backgroundColor: THEME.ui2, marginBottom: 20 },
  previewBody: { color: THEME.text, fontSize: 15, lineHeight: 26 },
  previewTagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 24 },
  previewTag: { backgroundColor: THEME.ui, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: THEME.ui2 },
  previewTagTxt: { color: THEME.textMuted, fontSize: 12 },

  // Bottom bar
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: THEME.ui, borderTopWidth: 1, borderTopColor: THEME.ui2, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bottomBarLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  bottomBarTxt: { color: THEME.textMuted, fontSize: 12, fontWeight: "700" },
  bottomPublishBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: THEME.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  bottomPublishBtnTxt: { color: "#000", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
});