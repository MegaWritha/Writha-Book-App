import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Switch, KeyboardAvoidingView, Platform,
  ActivityIndicator, StatusBar, Image, Dimensions, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

// ── CROSS PLATFORM ALERT ─────────────────────────────────────────────────
const showAlert = (
  title: string,
  message: string,
  buttons: { text: string; style?: string; onPress?: () => void }[]
) => {
  if (Platform.OS === "web") {
    if (buttons.length === 1) {
      window.alert(`${title}\n\n${message}`);
      buttons[0].onPress?.();
    } else {
      const confirmBtn = buttons.find((b) => b.style !== "cancel");
      const confirmed  = window.confirm(`${title}\n\n${message}`);
      if (confirmed) confirmBtn?.onPress?.();
    }
  } else {
    Alert.alert(title, message, buttons as any);
  }
};

// ── THEMES ───────────────────────────────────────────────────────────────
const DARK_THEME = {
  mode:        "dark" as const,
  bg:          "#080410",
  ui:          "#100820",
  ui2:         "#1A0E30",
  ui3:         "#251645",
  accent:      "#FFD700",
  accentDim:   "rgba(255,215,0,0.08)",
  purple:      "#6D28D9",
  purpleLight: "#A78BFA",
  text:        "#EDE8F5",
  textMuted:   "#6B6080",
  green:       "#22C55E",
  red:         "#EF4444",
  statusBar:   "light-content" as const,
};

const LIGHT_THEME = {
  mode:        "light" as const,
  bg:          "#FAF8FF",
  ui:          "#F0EBF8",
  ui2:         "#E2D9F3",
  ui3:         "#C9BBDF",
  accent:      "#6D28D9",
  accentDim:   "rgba(109,40,217,0.08)",
  purple:      "#6D28D9",
  purpleLight: "#A78BFA",
  text:        "#1A0E30",
  textMuted:   "#6B6080",
  green:       "#16A34A",
  red:         "#DC2626",
  statusBar:   "dark-content" as const,
};

const GENRES = [
  "Romance", "Fantasy", "Mystery", "Thriller", "Sci-Fi",
  "Historical", "Horror", "Biography", "Self-Help", "Poetry",
  "Children", "Drama", "Adventure", "Literary", "Other",
];

const TABS = ["Cover & Info", "Write Story", "Publish"] as const;
type Tab = typeof TABS[number];

export default function WriteStudio() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const user    = auth.currentUser;

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftIdRef    = useRef<string | null>(null);

  // ── THEME STATE ──────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(true);
  const T = isDark ? DARK_THEME : LIGHT_THEME;

  // ── UI STATE ─────────────────────────────────────────────────────
  const [activeTab,  setActiveTab]  = useState<Tab>("Cover & Info");
  const [lastSaved,  setLastSaved]  = useState<Date | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [isAdmin,    setIsAdmin]    = useState(false);

  // ── FORM STATE ───────────────────────────────────────────────────
  const [title,          setTitle]          = useState("");
  const [subtitle,       setSubtitle]       = useState("");
  const [authorName,     setAuthorName]     = useState("");
  const [coverUrl,       setCoverUrl]       = useState("");
  const [coverLocalUri,  setCoverLocalUri]  = useState<string | null>(null);
  const [genre,          setGenre]          = useState("");
  const [customGenre,    setCustomGenre]    = useState("");
  const [tags,           setTags]           = useState<string[]>([]);
  const [tagInput,       setTagInput]       = useState("");
  const [description,    setDescription]   = useState("");
  const [manuscriptMode, setManuscriptMode] = useState<"chapters" | "full">("full");
  const [fullContent,    setFullContent]    = useState("");
  const [chapters,       setChapters]       = useState([{ title: "Chapter 1", content: "" }]);
  const [isFree,         setIsFree]         = useState(true);
  const [price,          setPrice]          = useState("");
  const [isMature,       setIsMature]       = useState(false);
  const [agreedToTerms,  setAgreedToTerms]  = useState(false);

  // ── LOAD USER PROFILE ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          // Set admin status
          setIsAdmin(data.isAdmin === true || data.isAdmin === "true");
          // Auto fill author name from profile for non-admins
          if (!data.isAdmin) {
            setAuthorName(
              data.displayName ||
              data.fullName    ||
              user.displayName ||
              ""
            );
          }
        }
      })
      .catch(() => {});
  }, [user]);

  // ── COMPUTED ─────────────────────────────────────────────────────
  const finalCover = coverLocalUri || coverUrl;
  const wordCount  = manuscriptMode === "full"
    ? fullContent.trim().split(/\s+/).filter(Boolean).length
    : chapters.reduce((a, c) => a + c.content.trim().split(/\s+/).filter(Boolean).length, 0);
  const finalGenre = genre === "Other" ? customGenre : genre;

  const readinessItems = [
    { label: "Title added",      done: title.trim().length > 0        },
    { label: "Author name",      done: authorName.trim().length > 0   },
    { label: "Cover image",      done: finalCover.length > 0          },
    { label: "Genre selected",   done: finalGenre.trim().length > 0   },
    { label: "Synopsis written", done: description.trim().length > 30 },
    { label: "Content ready",    done: wordCount >= 500               },
    { label: "Terms agreed",     done: agreedToTerms                  },
  ];
  const readinessScore = readinessItems.filter(i => i.done).length;
  const canPublish     = readinessItems.every(i => i.done);

  // ── BUILD BOOK DATA ───────────────────────────────────────────────
  const buildBookData = useCallback((status: string) => ({
    title,
    subtitle,
    coverUrl:      finalCover,
    genre:         finalGenre,
    tags,
    description,
    manuscriptMode,
    content:       fullContent,
    chapters,
    isFree,
    price:         isFree ? 0 : parseFloat(price) || 0,
    isMature,
    agreedToTerms,
    authorId:      user?.uid,
    authorName:    authorName.trim() || user?.displayName || "Author",
    wordCount,
    status,
    updatedAt:     serverTimestamp(),
  }), [
    title, subtitle, finalCover, finalGenre, tags, description,
    manuscriptMode, fullContent, chapters, isFree, price,
    isMature, agreedToTerms, user, authorName, wordCount,
  ]);

  // ── AUTOSAVE ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!title.trim() || !user) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(async () => {
      try {
        const docId = draftIdRef.current || `draft_${user.uid}_${Date.now()}`;
        draftIdRef.current = docId;
        await setDoc(
          doc(db, "books", docId),
          { ...buildBookData("draft"), createdAt: serverTimestamp() },
          { merge: true }
        );
        setLastSaved(new Date());
      } catch (e) { console.error("Autosave failed:", e); }
    }, 30000);

    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [title, subtitle, fullContent, chapters, description, genre, coverUrl, coverLocalUri, authorName]);

  // ── COVER PICKER ─────────────────────────────────────────────────
  const pickCover = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      showAlert("Permission Required", "Allow photo library access to upload a cover.", [{ text: "OK" }]);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverLocalUri(result.assets[0].uri);
      setCoverUrl("");
    }
  };

  // ── ADD TAG ──────────────────────────────────────────────────────
  const addTag = () => {
    const cleaned = tagInput.trim().replace(/^#/, "");
    if (!cleaned || tags.length >= 8 || tags.includes(cleaned)) return;
    setTags([...tags, cleaned]);
    setTagInput("");
  };

  // ── SAVE DRAFT ───────────────────────────────────────────────────
  const saveDraft = async () => {
    if (!title.trim()) {
      showAlert("Title Required", "Add a title to save your draft.", [{ text: "OK" }]);
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      const docId = draftIdRef.current || `draft_${user.uid}_${Date.now()}`;
      draftIdRef.current = docId;
      await setDoc(
        doc(db, "books", docId),
        { ...buildBookData("draft"), createdAt: serverTimestamp() },
        { merge: true }
      );
      setLastSaved(new Date());
      showAlert("Draft Saved ✅", "Your work is safe in your library.", [
        { text: "Keep Writing" },
        { text: "Go to Library", onPress: () => router.replace("/(tabs)/library" as any) },
      ]);
    } catch (e: any) {
      showAlert("Save Error", e.message, [{ text: "OK" }]);
    } finally { setSaving(false); }
  };

  // ── PUBLISH ──────────────────────────────────────────────────────
  const publish = async () => {
    if (!canPublish) {
      const missing = readinessItems
        .filter(i => !i.done)
        .map(i => `• ${i.label}`)
        .join("\n");
      showAlert("Not Ready", `Complete these before publishing:\n\n${missing}`, [{ text: "OK" }]);
      return;
    }
    if (!user) return;

    setPublishing(true);
    try {
      const docId = draftIdRef.current || `draft_${user.uid}_${Date.now()}`;
      draftIdRef.current = docId;
      await setDoc(
        doc(db, "books", docId),
        {
          ...buildBookData("submitted"),
          views:        0,
          likesCount:   0,
          commentsCount: 0,
          likedBy:      [],
          purchasedBy:  [],
          createdAt:    serverTimestamp(),
        },
        { merge: true }
      );

      showAlert(
        "Submitted! 🎉",
        "Your manuscript is in the editorial queue. You'll be notified within 24–48 hours.",
        [{ text: "Go to Library", onPress: () => router.replace("/(tabs)/library" as any) }]
      );
    } catch (e: any) {
      showAlert("Publish Error", e.message, [{ text: "OK" }]);
    } finally { setPublishing(false); }
  };

  // ── CHAPTER HELPERS ──────────────────────────────────────────────
  const addChapter = () =>
    setChapters([...chapters, { title: `Chapter ${chapters.length + 1}`, content: "" }]);

  const updateChapter = (index: number, field: "title" | "content", value: string) => {
    const updated = [...chapters];
    updated[index][field] = value;
    setChapters(updated);
  };

  const removeChapter = (index: number) => {
    if (chapters.length === 1) return;
    setChapters(chapters.filter((_, i) => i !== index));
  };

  // ── STYLES (theme-aware) ─────────────────────────────────────────
  const s = makeStyles(T);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle={T.statusBar} />
      <LinearGradient
        colors={T.mode === "dark" ? ["#0F071A", T.bg] : ["#EDE8F8", T.bg]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── HEADER ── */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={s.headerClose}
          onPress={() => {
            if (title) {
              showAlert("Leave Studio?", "You have unsaved changes.", [
                { text: "Discard", style: "destructive", onPress: () => router.back() },
                { text: "Save Draft", onPress: saveDraft },
                { text: "Cancel", style: "cancel" },
              ]);
            } else {
              router.back();
            }
          }}
        >
          <Ionicons name="close" size={22} color={T.text} />
        </TouchableOpacity>

        <View style={s.tabRow}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[s.tab, activeTab === tab && s.tabActive]}
            >
              <Text style={[s.tabTxt, activeTab === tab && s.tabTxtActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Dark/Light toggle */}
        <TouchableOpacity
          style={s.themeToggle}
          onPress={() => setIsDark(!isDark)}
        >
          <Ionicons
            name={isDark ? "sunny-outline" : "moon-outline"}
            size={18}
            color={T.accent}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 160 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ══════════════════════════════════════════════
            TAB 1 — COVER & INFO
        ══════════════════════════════════════════════ */}
        {activeTab === "Cover & Info" && (
          <View style={s.pane}>

            {/* TITLE */}
            <Text style={s.fieldLabel}>TITLE *</Text>
            <TextInput
              style={s.titleInput}
              placeholder="Your book title..."
              placeholderTextColor={T.ui3}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
            <Text style={s.charCount}>{title.length}/100</Text>

            {/* SUBTITLE */}
            <Text style={s.fieldLabel}>SUBTITLE</Text>
            <TextInput
              style={s.fieldInput}
              placeholder="Optional subtitle or tagline..."
              placeholderTextColor={T.textMuted}
              value={subtitle}
              onChangeText={setSubtitle}
            />

            {/* AUTHOR NAME */}
            <Text style={s.fieldLabel}>AUTHOR NAME *</Text>
            {isAdmin ? (
              // Admins can type any author name
              <TextInput
                style={s.fieldInput}
                placeholder="Enter author name..."
                placeholderTextColor={T.textMuted}
                value={authorName}
                onChangeText={setAuthorName}
              />
            ) : (
              // Regular authors see their name locked
              <View style={s.lockedField}>
                <Ionicons name="person-circle-outline" size={18} color={T.accent} />
                <Text style={s.lockedFieldTxt}>{authorName || "Loading..."}</Text>
                <View style={[s.lockedBadge, { backgroundColor: T.accentDim }]}>
                  <Ionicons name="lock-closed" size={10} color={T.accent} />
                  <Text style={[s.lockedBadgeTxt, { color: T.accent }]}>Auto-filled</Text>
                </View>
              </View>
            )}
            {isAdmin && (
              <View style={s.adminHint}>
                <Ionicons name="shield-checkmark-outline" size={13} color={T.accent} />
                <Text style={[s.adminHintTxt, { color: T.accent }]}>
                  Admin mode — you can set any author name for sample books
                </Text>
              </View>
            )}

            {/* COVER IMAGE */}
            <Text style={s.fieldLabel}>BOOK COVER</Text>
            <View style={s.coverUrlRow}>
              <Ionicons name="link-outline" size={16} color={T.textMuted} />
              <TextInput
                style={s.coverUrlInput}
                placeholder="Paste cover URL (Canva, Imgur, Google Drive...)"
                placeholderTextColor={T.textMuted}
                value={coverUrl}
                onChangeText={(t) => { setCoverUrl(t); setCoverLocalUri(null); }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              {coverUrl.length > 0 && (
                <TouchableOpacity onPress={() => setCoverUrl("")}>
                  <Ionicons name="close-circle" size={18} color={T.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <View style={s.orDivider}>
              <View style={s.orLine} />
              <Text style={s.orTxt}>or upload from device</Text>
              <View style={s.orLine} />
            </View>

            <TouchableOpacity style={s.coverPickerBtn} onPress={pickCover} activeOpacity={0.85}>
              {finalCover ? (
                <View style={s.coverPreviewWrap}>
                  <Image source={{ uri: finalCover }} style={s.coverPreviewImg} resizeMode="cover" />
                  <View style={s.coverPreviewOverlay}>
                    <Ionicons name="camera-outline" size={20} color="#fff" />
                    <Text style={s.coverPreviewOverlayTxt}>Change Cover</Text>
                  </View>
                </View>
              ) : (
                <View style={[s.coverEmpty, { backgroundColor: T.ui }]}>
                  <Ionicons name="image-outline" size={34} color={T.textMuted} />
                  <Text style={s.coverEmptyTxt}>Upload from Gallery</Text>
                  <Text style={s.coverEmptyHint}>JPG or PNG · 2:3 ratio recommended</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={s.canvaHint}>
              <MaterialCommunityIcons name="palette-outline" size={14} color={T.accent} />
              <Text style={s.canvaHintTxt}>
                Made your cover on Canva?{"  "}Share → Copy link → paste above.{"\n"}
                Or export as PNG and upload from gallery.
              </Text>
            </View>

            {/* GENRE */}
            <Text style={s.fieldLabel}>GENRE *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.genreScroll}>
              <View style={s.genreRow}>
                {GENRES.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[s.genrePill, genre === g && s.genrePillActive]}
                    onPress={() => setGenre(g)}
                  >
                    <Text style={[s.genrePillTxt, genre === g && s.genrePillTxtActive]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            {genre === "Other" && (
              <TextInput
                style={[s.fieldInput, { marginTop: 10 }]}
                placeholder="Enter your genre..."
                placeholderTextColor={T.textMuted}
                value={customGenre}
                onChangeText={setCustomGenre}
              />
            )}

            {/* TAGS */}
            <Text style={s.fieldLabel}>TAGS (up to 8)</Text>
            <View style={s.tagInputRow}>
              <TextInput
                style={s.tagInput}
                placeholder="Add a tag and press +"
                placeholderTextColor={T.textMuted}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={addTag}
              />
              <TouchableOpacity style={[s.tagAddBtn, { backgroundColor: T.accent }]} onPress={addTag}>
                <Ionicons name="add" size={20} color="#000" />
              </TouchableOpacity>
            </View>
            {tags.length > 0 && (
              <View style={s.tagCloud}>
                {tags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={s.tagPill}
                    onPress={() => setTags(tags.filter(t => t !== tag))}
                  >
                    <Text style={s.tagPillTxt}>#{tag}</Text>
                    <Ionicons name="close" size={11} color={T.accent} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* SYNOPSIS */}
            <Text style={s.fieldLabel}>SYNOPSIS / BLURB *</Text>
            <TextInput
              style={s.synopsisInput}
              placeholder="Write a compelling description that makes readers want to dive in..."
              placeholderTextColor={T.textMuted}
              multiline
              value={description}
              onChangeText={setDescription}
              maxLength={1000}
              textAlignVertical="top"
            />
            <Text style={s.charCount}>{description.length}/1000</Text>
          </View>
        )}

        {/* ══════════════════════════════════════════════
            TAB 2 — WRITE STORY
        ══════════════════════════════════════════════ */}
        {activeTab === "Write Story" && (
          <View style={s.pane}>
            <View style={s.modeSwitch}>
              {(["full", "chapters"] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[s.modeBtn, manuscriptMode === m && s.modeBtnActive]}
                  onPress={() => setManuscriptMode(m)}
                >
                  <Ionicons
                    name={m === "full" ? "document-text-outline" : "list-outline"}
                    size={15}
                    color={manuscriptMode === m ? "#000" : T.textMuted}
                  />
                  <Text style={[s.modeBtnTxt, manuscriptMode === m && s.modeBtnTxtActive]}>
                    {m === "full" ? "FULL TEXT" : "CHAPTERS"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.wordCountBar}>
              <View style={s.wordCountLeft}>
                <Text style={s.wordCountNum}>{wordCount.toLocaleString()}</Text>
                <Text style={s.wordCountLbl}> words</Text>
              </View>
              <Text style={s.wordCountPages}>~{Math.ceil(wordCount / 250)} pages</Text>
              <Text style={[
                s.wordCountStatus,
                { color: wordCount >= 500 ? T.green : T.textMuted },
              ]}>
                {wordCount >= 500 ? "✓ Ready" : `Need ${500 - wordCount} more`}
              </Text>
            </View>

            {lastSaved && (
              <View style={s.autosaveNote}>
                <Ionicons name="cloud-done-outline" size={12} color={T.green} />
                <Text style={[s.autosaveNoteTxt, { color: T.green }]}>
                  Saved at {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            )}

            {manuscriptMode === "full" ? (
              <TextInput
                style={s.manuscriptInput}
                placeholder={"Start writing your manuscript here...\n\nTip: Your work auto-saves every 30 seconds."}
                placeholderTextColor={T.textMuted}
                multiline
                scrollEnabled={false}
                value={fullContent}
                onChangeText={setFullContent}
                textAlignVertical="top"
              />
            ) : (
              <View>
                {chapters.map((chapter, index) => (
                  <View key={index} style={s.chapterBlock}>
                    <View style={s.chapterBlockHeader}>
                      <TextInput
                        style={[s.chapterTitleInput, { color: T.accent }]}
                        placeholder={`Chapter ${index + 1} title...`}
                        placeholderTextColor={T.textMuted}
                        value={chapter.title}
                        onChangeText={(v) => updateChapter(index, "title", v)}
                      />
                      {chapters.length > 1 && (
                        <TouchableOpacity onPress={() => removeChapter(index)}>
                          <Ionicons name="trash-outline" size={16} color={T.red} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={[s.chapterWordCount, { color: T.textMuted }]}>
                      {chapter.content.trim().split(/\s+/).filter(Boolean).length} words
                    </Text>
                    <TextInput
                      style={[s.chapterContentInput, { color: T.text }]}
                      placeholder="Write this chapter..."
                      placeholderTextColor={T.textMuted}
                      multiline
                      scrollEnabled={false}
                      value={chapter.content}
                      onChangeText={(v) => updateChapter(index, "content", v)}
                      textAlignVertical="top"
                    />
                  </View>
                ))}
                <TouchableOpacity style={s.addChapterBtn} onPress={addChapter}>
                  <Ionicons name="add-circle-outline" size={20} color={T.accent} />
                  <Text style={[s.addChapterBtnTxt, { color: T.accent }]}>ADD CHAPTER</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ══════════════════════════════════════════════
            TAB 3 — PUBLISH
        ══════════════════════════════════════════════ */}
        {activeTab === "Publish" && (
          <View style={s.pane}>

            {/* READINESS */}
            <View style={s.readinessCard}>
              <View style={s.readinessHeader}>
                <Text style={s.readinessTitle}>PUBLISH READINESS</Text>
                <Text style={s.readinessScore}>{readinessScore}/{readinessItems.length}</Text>
              </View>
              <View style={s.readinessTrack}>
                <View style={[
                  s.readinessFill,
                  { width: `${(readinessScore / readinessItems.length) * 100}%` },
                ]} />
              </View>
              <View style={s.checklistRows}>
                {readinessItems.map((item) => (
                  <View key={item.label} style={s.checklistRow}>
                    <Ionicons
                      name={item.done ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={item.done ? T.green : T.textMuted}
                    />
                    <Text style={[s.checklistTxt, item.done && { color: T.text }]}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* MONETIZATION */}
            <Text style={s.sectionLabel}>MONETIZATION</Text>
            <View style={s.toggleCard}>
              <View style={s.toggleLeft}>
                <View style={[s.toggleIcon, {
                  backgroundColor: isFree ? T.green + "20" : T.accentDim,
                }]}>
                  <Ionicons
                    name={isFree ? "gift-outline" : "cash-outline"}
                    size={20}
                    color={isFree ? T.green : T.accent}
                  />
                </View>
                <View>
                  <Text style={s.toggleTitle}>{isFree ? "Free to Read" : "Paid Book"}</Text>
                  <Text style={s.toggleSub}>
                    {isFree ? "Everyone can access this book" : "Readers pay to access"}
                  </Text>
                </View>
              </View>
              <Switch
                value={!isFree}
                onValueChange={(v) => setIsFree(!v)}
                trackColor={{ false: T.ui2, true: T.accent }}
                thumbColor={!isFree ? "#000" : T.textMuted}
              />
            </View>

            {!isFree && (
              <View style={s.priceRow}>
                <Text style={s.currencySymbol}>₦</Text>
                <TextInput
                  style={s.priceInput}
                  placeholder="0.00"
                  placeholderTextColor={T.ui3}
                  keyboardType="numeric"
                  value={price}
                  onChangeText={setPrice}
                />
                <Text style={[s.revenueNote, { color: T.green }]}>You earn 80%</Text>
              </View>
            )}

            {/* MATURE */}
            <View style={[s.toggleCard, { marginTop: 12 }]}>
              <View style={s.toggleLeft}>
                <View style={[s.toggleIcon, {
                  backgroundColor: isMature ? T.red + "20" : T.ui2,
                }]}>
                  <Ionicons name="warning-outline" size={20} color={isMature ? T.red : T.textMuted} />
                </View>
                <View>
                  <Text style={s.toggleTitle}>Mature Content (18+)</Text>
                  <Text style={s.toggleSub}>Contains adult themes or language</Text>
                </View>
              </View>
              <Switch
                value={isMature}
                onValueChange={setIsMature}
                trackColor={{ false: T.ui2, true: T.red }}
                thumbColor={isMature ? "#fff" : T.textMuted}
              />
            </View>

            {/* LEGAL */}
            <Text style={[s.sectionLabel, { marginTop: 20 }]}>LEGAL DECLARATION</Text>
            <View style={s.legalCard}>
              <View style={s.legalHeader}>
                <FontAwesome5 name="shield-alt" size={22} color={T.accent} />
                <Text style={s.legalHeaderTxt}>INTELLECTUAL PROPERTY GUARD</Text>
              </View>
              <Text style={s.legalBody}>
                By publishing, you declare that:{"\n\n"}
                <Text style={s.legalPoint}>1. ORIGINAL WORK{"\n"}</Text>
                This is your original creation. You hold full copyright.{"\n\n"}
                <Text style={s.legalPoint}>2. ANTI-PIRACY{"\n"}</Text>
                Submitting stolen or plagiarised content is a criminal offence under the Nigerian Copyright Act 2022.{"\n\n"}
                <Text style={s.legalPoint}>3. PLATFORM LICENCE{"\n"}</Text>
                You grant Writha a non-exclusive licence to distribute your work. You retain full ownership.{"\n\n"}
                <Text style={s.legalPoint}>4. REVENUE SHARE{"\n"}</Text>
                You earn 80% of all sales. Writha retains 20%.{"\n\n"}
                <Text style={s.legalPoint}>5. EDITORIAL REVIEW{"\n"}</Text>
                All books undergo review before going live (24–48 hours).
              </Text>
              <TouchableOpacity
                style={s.agreeRow}
                onPress={() => setAgreedToTerms(!agreedToTerms)}
              >
                <View style={[s.agreeCheckbox, agreedToTerms && s.agreeCheckboxActive]}>
                  {agreedToTerms && <Ionicons name="checkmark" size={14} color="#000" />}
                </View>
                <Text style={s.agreeTxt}>
                  I confirm this is my original work and I agree to the terms above
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── FOOTER ── */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={s.draftBtn} onPress={saveDraft} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={T.textMuted} />
          ) : (
            <Text style={s.draftBtnTxt}>SAVE DRAFT</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.publishBtn, { backgroundColor: T.accent }, !canPublish && { opacity: 0.4 }]}
          onPress={publish}
          disabled={!canPublish || publishing}
        >
          {publishing ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="rocket-outline" size={16} color="#000" />
              <Text style={s.publishBtnTxt}>SUBMIT FOR REVIEW</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── THEME-AWARE STYLES ───────────────────────────────────────────────────
const makeStyles = (T: typeof DARK_THEME | typeof LIGHT_THEME) => StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: T.ui2,
  },
  headerClose: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: T.ui, justifyContent: "center", alignItems: "center",
  },
  themeToggle: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: T.ui, justifyContent: "center", alignItems: "center",
  },
  tabRow: {
    flexDirection: "row", backgroundColor: T.ui,
    borderRadius: 12, padding: 3, gap: 3,
  },
  tab:          { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  tabActive:    { backgroundColor: T.accent },
  tabTxt:       { color: T.textMuted, fontSize: 9, fontWeight: "900" },
  tabTxtActive: { color: "#000" },
  pane:         { padding: 20 },
  fieldLabel: {
    color: T.accent, fontSize: 10, fontWeight: "900",
    letterSpacing: 2, marginBottom: 10, marginTop: 20,
  },
  fieldInput: {
    backgroundColor: T.ui, borderRadius: 12, padding: 14,
    color: T.text, fontSize: 14,
    borderWidth: 1, borderColor: T.ui2,
  },
  titleInput: {
    backgroundColor: T.ui, borderRadius: 14, padding: 16,
    color: T.text, fontSize: 22, fontWeight: "900",
    borderWidth: 1, borderColor: T.ui2,
  },
  charCount:  { color: T.textMuted, fontSize: 10, textAlign: "right", marginTop: 4 },

  // Author name locked field
  lockedField: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: T.ui, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: T.ui2,
  },
  lockedFieldTxt: { flex: 1, color: T.text, fontSize: 14, fontWeight: "700" },
  lockedBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  lockedBadgeTxt: { fontSize: 9, fontWeight: "900" },

  // Admin hint
  adminHint: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 8, padding: 10, borderRadius: 10,
    backgroundColor: "rgba(255,215,0,0.08)",
  },
  adminHintTxt: { fontSize: 11, fontWeight: "600", flex: 1 },

  // Cover
  coverUrlRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: T.ui, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: T.ui2, marginBottom: 14,
  },
  coverUrlInput:        { flex: 1, color: T.text, fontSize: 13 },
  orDivider:            { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  orLine:               { flex: 1, height: 1, backgroundColor: T.ui2 },
  orTxt:                { color: T.textMuted, fontSize: 11, fontWeight: "600" },
  coverPickerBtn: {
    borderRadius: 16, overflow: "hidden",
    borderWidth: 1.5, borderColor: T.ui2,
    borderStyle: "dashed", marginBottom: 12,
  },
  coverPreviewWrap:        { width: "100%", height: 220, position: "relative" },
  coverPreviewImg:         { width: "100%", height: "100%" },
  coverPreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center", alignItems: "center", gap: 6,
  },
  coverPreviewOverlayTxt:  { color: "#fff", fontWeight: "700", fontSize: 13 },
  coverEmpty: {
    height: 150, justifyContent: "center",
    alignItems: "center", gap: 8,
  },
  coverEmptyTxt:  { color: T.textMuted, fontWeight: "800", fontSize: 13 },
  coverEmptyHint: { color: T.ui3, fontSize: 10 },
  canvaHint: {
    flexDirection: "row", gap: 8, alignItems: "flex-start",
    backgroundColor: T.accentDim, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: T.accent + "30", marginBottom: 4,
  },
  canvaHintTxt: { flex: 1, color: T.accent, fontSize: 12, lineHeight: 18 },

  // Genre
  genreScroll:        { marginBottom: 4 },
  genreRow:           { flexDirection: "row", gap: 8, paddingBottom: 4 },
  genrePill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    backgroundColor: T.ui, borderWidth: 1, borderColor: T.ui2,
  },
  genrePillActive:    { backgroundColor: T.accent, borderColor: T.accent },
  genrePillTxt:       { color: T.textMuted, fontWeight: "700", fontSize: 12 },
  genrePillTxtActive: { color: "#000" },

  // Tags
  tagInputRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  tagInput: {
    flex: 1, backgroundColor: T.ui, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    color: T.text, fontSize: 14,
    borderWidth: 1, borderColor: T.ui2,
  },
  tagAddBtn:   { width: 46, height: 46, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  tagCloud:    { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  tagPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: T.accentDim, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1, borderColor: T.accent + "40",
  },
  tagPillTxt: { color: T.accent, fontSize: 12, fontWeight: "700" },

  // Synopsis
  synopsisInput: {
    backgroundColor: T.ui, borderRadius: 14, padding: 14,
    color: T.text, fontSize: 14, minHeight: 120,
    borderWidth: 1, borderColor: T.ui2, lineHeight: 22,
  },

  // Write tab
  modeSwitch:       { flexDirection: "row", gap: 12, marginBottom: 16 },
  modeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8, padding: 14,
    borderRadius: 14, backgroundColor: T.ui,
    borderWidth: 1, borderColor: T.ui2,
  },
  modeBtnActive:    { backgroundColor: T.accent, borderColor: T.accent },
  modeBtnTxt:       { color: T.textMuted, fontSize: 11, fontWeight: "900" },
  modeBtnTxtActive: { color: "#000" },
  wordCountBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.ui, borderRadius: 12, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: T.ui2, gap: 6,
  },
  wordCountLeft:  { flexDirection: "row", alignItems: "baseline" },
  wordCountNum:   { color: T.text, fontSize: 18, fontWeight: "900" },
  wordCountLbl:   { color: T.textMuted, fontSize: 12 },
  wordCountPages: { flex: 1, color: T.textMuted, fontSize: 11, textAlign: "center" },
  wordCountStatus:{ fontSize: 11, fontWeight: "700" },
  autosaveNote:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  autosaveNoteTxt:{ fontSize: 11, fontWeight: "600" },
  manuscriptInput: {
    backgroundColor: T.ui, borderRadius: 16, padding: 16,
    color: T.text, fontSize: 16, lineHeight: 28,
    minHeight: 500, borderWidth: 1, borderColor: T.ui2,
  },
  chapterBlock: {
    backgroundColor: T.ui, borderRadius: 16, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: T.ui2,
  },
  chapterBlockHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 6,
  },
  chapterTitleInput: { flex: 1, fontWeight: "800", fontSize: 15, marginRight: 10 },
  chapterWordCount:  { fontSize: 10, marginBottom: 10 },
  chapterContentInput: {
    fontSize: 15, lineHeight: 26,
    minHeight: 200, textAlignVertical: "top",
  },
  addChapterBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, padding: 16, borderRadius: 16,
    borderWidth: 1.5, borderColor: T.accent + "40",
    borderStyle: "dashed",
  },
  addChapterBtnTxt: { fontWeight: "900", fontSize: 12 },

  // Publish tab
  readinessCard: {
    backgroundColor: T.ui, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: T.ui2, marginBottom: 20,
  },
  readinessHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 10,
  },
  readinessTitle:  { color: T.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  readinessScore:  { color: T.text, fontWeight: "900", fontSize: 15 },
  readinessTrack: {
    height: 4, backgroundColor: T.ui2,
    borderRadius: 2, overflow: "hidden", marginBottom: 16,
  },
  readinessFill:   { height: "100%", backgroundColor: T.green, borderRadius: 2 },
  checklistRows:   { gap: 12 },
  checklistRow:    { flexDirection: "row", alignItems: "center", gap: 10 },
  checklistTxt:    { color: T.textMuted, fontSize: 13 },
  sectionLabel: {
    color: T.accent, fontSize: 10, fontWeight: "900",
    letterSpacing: 2, marginBottom: 12,
  },
  toggleCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.ui, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: T.ui2,
  },
  toggleLeft:  { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  toggleIcon: {
    width: 42, height: 42, borderRadius: 13,
    justifyContent: "center", alignItems: "center",
  },
  toggleTitle: { color: T.text, fontWeight: "800", fontSize: 14 },
  toggleSub:   { color: T.textMuted, fontSize: 11, marginTop: 2 },
  priceRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.ui, borderRadius: 14, padding: 14,
    marginTop: 10, borderWidth: 1, borderColor: T.ui2, gap: 8,
  },
  currencySymbol: { color: T.accent, fontSize: 24, fontWeight: "900" },
  priceInput:     { flex: 1, color: T.text, fontSize: 28, fontWeight: "900" },
  revenueNote:    { fontSize: 11, fontWeight: "700" },
  legalCard: {
    backgroundColor: T.ui, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: T.ui2,
  },
  legalHeader: {
    flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14,
  },
  legalHeaderTxt: { color: T.accent, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  legalBody:      { color: T.textMuted, fontSize: 12, lineHeight: 20 },
  legalPoint:     { color: T.text, fontWeight: "900" },
  agreeRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    marginTop: 18, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: T.ui2,
  },
  agreeCheckbox: {
    width: 24, height: 24, borderRadius: 8,
    borderWidth: 2, borderColor: T.textMuted,
    justifyContent: "center", alignItems: "center", flexShrink: 0,
  },
  agreeCheckboxActive: { backgroundColor: T.accent, borderColor: T.accent },
  agreeTxt: { flex: 1, color: T.textMuted, fontSize: 12, lineHeight: 18 },

  // Footer
  footer: {
    position: "absolute", bottom: 0, width: "100%",
    flexDirection: "row", padding: 16, gap: 12,
    backgroundColor: T.ui, borderTopWidth: 1, borderTopColor: T.ui2,
  },
  draftBtn: {
    flex: 1, paddingVertical: 16, alignItems: "center",
    borderRadius: 16, backgroundColor: T.bg,
    borderWidth: 1, borderColor: T.ui2,
  },
  draftBtnTxt:  { color: T.textMuted, fontWeight: "900", fontSize: 12 },
  publishBtn: {
    flex: 2, paddingVertical: 16, alignItems: "center",
    borderRadius: 16, flexDirection: "row",
    justifyContent: "center", gap: 8,
  },
  publishBtnTxt: { color: "#000", fontWeight: "900", fontSize: 12 },
});