import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Switch, KeyboardAvoidingView, Platform,
  ActivityIndicator, StatusBar, Image, Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const THEME = {
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
};

const GENRES = [
  "Romance", "Fantasy", "Mystery", "Thriller", "Sci-Fi",
  "Historical", "Horror", "Biography", "Self-Help", "Poetry",
  "Children", "Drama", "Adventure", "Literary", "Other",
];

const TABS = ["Cover & Info", "Write Story", "Publish"] as const;
type Tab = typeof TABS[number];

export default function WriteStudio() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = auth.currentUser;
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftIdRef = useRef<string | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>("Cover & Info");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // ── FORM STATE ────────────────────────────────────────────────────
  const [title, setTitle]               = useState("");
  const [subtitle, setSubtitle]         = useState("");
  const [coverUrl, setCoverUrl]         = useState("");
  const [coverLocalUri, setCoverLocalUri] = useState<string | null>(null);
  const [genre, setGenre]               = useState("");
  const [customGenre, setCustomGenre]   = useState("");
  const [tags, setTags]                 = useState<string[]>([]);
  const [tagInput, setTagInput]         = useState("");
  const [description, setDescription]  = useState("");
  const [manuscriptMode, setManuscriptMode] = useState<"chapters" | "full">("full");
  const [fullContent, setFullContent]   = useState("");
  const [chapters, setChapters]         = useState([{ title: "Chapter 1", content: "" }]);
  const [isFree, setIsFree]             = useState(true);
  const [price, setPrice]               = useState("");
  const [isMature, setIsMature]         = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // ── COMPUTED ──────────────────────────────────────────────────────
  const finalCover = coverLocalUri || coverUrl;
  const wordCount = manuscriptMode === "full"
    ? fullContent.trim().split(/\s+/).filter(Boolean).length
    : chapters.reduce((a, c) => a + (c.content.trim().split(/\s+/).filter(Boolean).length), 0);
  const finalGenre = genre === "Other" ? customGenre : genre;

  const readinessItems = [
    { label: "Title added",      done: title.trim().length > 0        },
    { label: "Cover image",      done: finalCover.length > 0          },
    { label: "Genre selected",   done: finalGenre.trim().length > 0   },
    { label: "Synopsis written", done: description.trim().length > 30 },
    { label: "Content ready",    done: wordCount >= 500               },
    { label: "Terms agreed",     done: agreedToTerms                  },
  ];
  const readinessScore = readinessItems.filter(i => i.done).length;
  const canPublish = readinessItems.every(i => i.done);

  // ── AUTOSAVE ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!title.trim() || !user) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(async () => {
      try {
        const docId = draftIdRef.current || `draft_${user.uid}_${Date.now()}`;
        draftIdRef.current = docId;
        await setDoc(doc(db, "books", docId), {
          title, subtitle, coverUrl: finalCover, genre: finalGenre,
          tags, description, manuscriptMode, content: fullContent,
          chapters, isFree, price: isFree ? 0 : parseFloat(price) || 0,
          isMature, authorId: user.uid,
          authorName: user.displayName || "Author",
          status: "draft", updatedAt: serverTimestamp(),
        }, { merge: true });
        setLastSaved(new Date());
      } catch (e) { console.error("Autosave failed:", e); }
    }, 30000);

    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [title, subtitle, fullContent, chapters, description, genre, coverUrl, coverLocalUri]);

  // ── COVER FROM GALLERY ────────────────────────────────────────────
  const pickCover = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert("Permission Required", "Allow photo library access to upload a cover.");
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

  // ── ADD TAG ───────────────────────────────────────────────────────
  const addTag = () => {
    const cleaned = tagInput.trim().replace(/^#/, "");
    if (!cleaned || tags.length >= 8 || tags.includes(cleaned)) return;
    setTags([...tags, cleaned]);
    setTagInput("");
  };

  // ── SAVE DRAFT ────────────────────────────────────────────────────
  const saveDraft = async () => {
    if (!title.trim()) return Alert.alert("Title Required", "Add a title to save your draft.");
    if (!user) return;
    setSaving(true);
    try {
      const docId = draftIdRef.current || `draft_${user.uid}_${Date.now()}`;
      draftIdRef.current = docId;
      await setDoc(doc(db, "books", docId), {
        title, subtitle, coverUrl: finalCover, genre: finalGenre,
        tags, description, manuscriptMode, content: fullContent,
        chapters, isFree, price: isFree ? 0 : parseFloat(price) || 0,
        isMature, agreedToTerms,
        authorId: user.uid, authorName: user.displayName || "Author",
        status: "draft",
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      }, { merge: true });
      setLastSaved(new Date());
      Alert.alert("Draft Saved ✅", "Your work is safe in your library.", [
        { text: "Keep Writing" },
        { text: "Go to Library", onPress: () => router.replace("/(tabs)/library" as any) },
      ]);
    } catch (e: any) {
      Alert.alert("Save Error", e.message);
    } finally { setSaving(false); }
  };

  // ── PUBLISH ───────────────────────────────────────────────────────
  const publish = async () => {
    if (!canPublish) {
      const missing = readinessItems.filter(i => !i.done).map(i => `• ${i.label}`).join("\n");
      return Alert.alert("Not Ready", `Complete these before publishing:\n\n${missing}`);
    }
    if (!user) return;

    setPublishing(true);
    try {
      const docId = draftIdRef.current || `book_${user.uid}_${Date.now()}`;
      draftIdRef.current = docId;
      await setDoc(doc(db, "books", docId), {
        title, subtitle, coverUrl: finalCover, genre: finalGenre,
        tags, description, manuscriptMode, content: fullContent,
        chapters, isFree, price: isFree ? 0 : parseFloat(price) || 0,
        isMature, agreedToTerms,
        authorId: user.uid, authorName: user.displayName || "Author",
        wordCount,
        status: "submitted",
        views: 0, likesCount: 0, commentsCount: 0,
        likedBy: [], purchasedBy: [],
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      }, { merge: true });

      Alert.alert(
        "Submitted! 🎉",
        "Your manuscript is now in the editorial queue. You'll be notified within 24–48 hours.",
        [{ text: "Go to Library", onPress: () => router.replace("/(tabs)/library" as any) }]
      );
    } catch (e: any) {
      Alert.alert("Publish Error", e.message);
    } finally { setPublishing(false); }
  };

  // ── CHAPTER HELPERS ───────────────────────────────────────────────
  const addChapter = () => {
    setChapters([...chapters, { title: `Chapter ${chapters.length + 1}`, content: "" }]);
  };
  const updateChapter = (index: number, field: "title" | "content", value: string) => {
    const updated = [...chapters];
    updated[index][field] = value;
    setChapters(updated);
  };
  const removeChapter = (index: number) => {
    if (chapters.length === 1) return;
    setChapters(chapters.filter((_, i) => i !== index));
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#0F071A", THEME.bg]} style={StyleSheet.absoluteFill} />

      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.headerClose}
          onPress={() => {
            if (title) {
              Alert.alert("Leave Studio?", "You have unsaved changes.", [
                { text: "Discard", style: "destructive", onPress: () => router.back() },
                { text: "Save Draft", onPress: saveDraft },
                { text: "Cancel", style: "cancel" },
              ]);
            } else {
              router.back();
            }
          }}
        >
          <Ionicons name="close" size={22} color={THEME.text} />
        </TouchableOpacity>

        <View style={styles.tabRow}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
            >
              <Text style={[styles.tabTxt, activeTab === tab && styles.tabTxtActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {lastSaved ? (
          <View style={styles.savedBadge}>
            <Ionicons name="cloud-done-outline" size={12} color={THEME.green} />
          </View>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 160 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ══════════════════════════════════════════════════
            TAB 1 — COVER & INFO
        ══════════════════════════════════════════════════ */}
        {activeTab === "Cover & Info" && (
          <View style={styles.pane}>

            <Text style={styles.fieldLabel}>TITLE *</Text>
            <TextInput
              style={styles.titleInput}
              placeholder="Your book title..."
              placeholderTextColor={THEME.ui3}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
            <Text style={styles.charCount}>{title.length}/100</Text>

            <Text style={styles.fieldLabel}>SUBTITLE</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="Optional subtitle or tagline..."
              placeholderTextColor={THEME.textMuted}
              value={subtitle}
              onChangeText={setSubtitle}
            />

            {/* ── COVER IMAGE ── */}
            <Text style={styles.fieldLabel}>BOOK COVER</Text>

            {/* Paste URL */}
            <View style={styles.coverUrlRow}>
              <Ionicons name="link-outline" size={16} color={THEME.textMuted} />
              <TextInput
                style={styles.coverUrlInput}
                placeholder="Paste cover URL (Canva, Imgur, Google Drive...)"
                placeholderTextColor={THEME.textMuted}
                value={coverUrl}
                onChangeText={(t) => {
                  setCoverUrl(t);
                  setCoverLocalUri(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              {coverUrl.length > 0 && (
                <TouchableOpacity onPress={() => setCoverUrl("")}>
                  <Ionicons name="close-circle" size={18} color={THEME.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.orDivider}>
              <View style={styles.orLine} />
              <Text style={styles.orTxt}>or upload from device</Text>
              <View style={styles.orLine} />
            </View>

            {/* Gallery picker */}
            <TouchableOpacity
              style={styles.coverPickerBtn}
              onPress={pickCover}
              activeOpacity={0.85}
            >
              {finalCover ? (
                <View style={styles.coverPreviewWrap}>
                  <Image
                    source={{ uri: finalCover }}
                    style={styles.coverPreviewImg}
                    resizeMode="cover"
                  />
                  <View style={styles.coverPreviewOverlay}>
                    <Ionicons name="camera-outline" size={20} color="#fff" />
                    <Text style={styles.coverPreviewOverlayTxt}>Change Cover</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.coverEmpty}>
                  <Ionicons name="image-outline" size={34} color={THEME.textMuted} />
                  <Text style={styles.coverEmptyTxt}>Upload from Gallery</Text>
                  <Text style={styles.coverEmptyHint}>JPG or PNG · 2:3 ratio recommended</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.canvaHint}>
              <MaterialCommunityIcons name="palette-outline" size={14} color={THEME.accent} />
              <Text style={styles.canvaHintTxt}>
                Made your cover on Canva?{"  "}
                Share → Copy link → paste above.{"\n"}
                Or export as PNG and upload from gallery.
              </Text>
            </View>

            {/* GENRE */}
            <Text style={styles.fieldLabel}>GENRE *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreScroll}>
              <View style={styles.genreRow}>
                {GENRES.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.genrePill, genre === g && styles.genrePillActive]}
                    onPress={() => setGenre(g)}
                  >
                    <Text style={[styles.genrePillTxt, genre === g && styles.genrePillTxtActive]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            {genre === "Other" && (
              <TextInput
                style={[styles.fieldInput, { marginTop: 10 }]}
                placeholder="Enter your genre..."
                placeholderTextColor={THEME.textMuted}
                value={customGenre}
                onChangeText={setCustomGenre}
              />
            )}

            {/* TAGS */}
            <Text style={styles.fieldLabel}>TAGS (up to 8)</Text>
            <View style={styles.tagInputRow}>
              <TextInput
                style={styles.tagInput}
                placeholder="Add a tag and press +"
                placeholderTextColor={THEME.textMuted}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={addTag}
              />
              <TouchableOpacity style={styles.tagAddBtn} onPress={addTag}>
                <Ionicons name="add" size={20} color="#000" />
              </TouchableOpacity>
            </View>
            {tags.length > 0 && (
              <View style={styles.tagCloud}>
                {tags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={styles.tagPill}
                    onPress={() => setTags(tags.filter(t => t !== tag))}
                  >
                    <Text style={styles.tagPillTxt}>#{tag}</Text>
                    <Ionicons name="close" size={11} color={THEME.accent} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* SYNOPSIS */}
            <Text style={styles.fieldLabel}>SYNOPSIS / BLURB *</Text>
            <TextInput
              style={styles.synopsisInput}
              placeholder="Write a compelling description that makes readers want to dive in..."
              placeholderTextColor={THEME.textMuted}
              multiline
              value={description}
              onChangeText={setDescription}
              maxLength={1000}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length}/1000</Text>
          </View>
        )}

        {/* ══════════════════════════════════════════════════
            TAB 2 — WRITE STORY
        ══════════════════════════════════════════════════ */}
        {activeTab === "Write Story" && (
          <View style={styles.pane}>

            <View style={styles.modeSwitch}>
              <TouchableOpacity
                style={[styles.modeBtn, manuscriptMode === "full" && styles.modeBtnActive]}
                onPress={() => setManuscriptMode("full")}
              >
                <Ionicons
                  name="document-text-outline"
                  size={15}
                  color={manuscriptMode === "full" ? "#000" : THEME.textMuted}
                />
                <Text style={[styles.modeBtnTxt, manuscriptMode === "full" && styles.modeBtnTxtActive]}>
                  FULL TEXT
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, manuscriptMode === "chapters" && styles.modeBtnActive]}
                onPress={() => setManuscriptMode("chapters")}
              >
                <Ionicons
                  name="list-outline"
                  size={15}
                  color={manuscriptMode === "chapters" ? "#000" : THEME.textMuted}
                />
                <Text style={[styles.modeBtnTxt, manuscriptMode === "chapters" && styles.modeBtnTxtActive]}>
                  CHAPTERS
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.wordCountBar}>
              <View style={styles.wordCountLeft}>
                <Text style={styles.wordCountNum}>{wordCount.toLocaleString()}</Text>
                <Text style={styles.wordCountLbl}> words</Text>
              </View>
              <Text style={styles.wordCountPages}>
                ~{Math.ceil(wordCount / 250)} pages
              </Text>
              <Text style={[
                styles.wordCountStatus,
                wordCount >= 500 ? { color: THEME.green } : { color: THEME.textMuted }
              ]}>
                {wordCount >= 500 ? "✓ Ready" : `Need ${500 - wordCount} more`}
              </Text>
            </View>

            {lastSaved && (
              <View style={styles.autosaveNote}>
                <Ionicons name="cloud-done-outline" size={12} color={THEME.green} />
                <Text style={styles.autosaveNoteTxt}>
                  Saved at {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            )}

            {/* FULL TEXT MODE */}
            {manuscriptMode === "full" && (
              <TextInput
                style={styles.manuscriptInput}
                placeholder={"Start writing your manuscript here...\n\nTip: Your work auto-saves every 30 seconds. Write freely!"}
                placeholderTextColor={THEME.textMuted}
                multiline
                scrollEnabled={false}
                value={fullContent}
                onChangeText={setFullContent}
                textAlignVertical="top"
              />
            )}

            {/* CHAPTERS MODE */}
            {manuscriptMode === "chapters" && (
              <View>
                {chapters.map((chapter, index) => (
                  <View key={index} style={styles.chapterBlock}>
                    <View style={styles.chapterBlockHeader}>
                      <TextInput
                        style={styles.chapterTitleInput}
                        placeholder={`Chapter ${index + 1} title...`}
                        placeholderTextColor={THEME.textMuted}
                        value={chapter.title}
                        onChangeText={(v) => updateChapter(index, "title", v)}
                      />
                      {chapters.length > 1 && (
                        <TouchableOpacity onPress={() => removeChapter(index)}>
                          <Ionicons name="trash-outline" size={16} color={THEME.red} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.chapterWordCount}>
                      {chapter.content.trim().split(/\s+/).filter(Boolean).length} words
                    </Text>
                    <TextInput
                      style={styles.chapterContentInput}
                      placeholder="Write this chapter..."
                      placeholderTextColor={THEME.textMuted}
                      multiline
                      scrollEnabled={false}
                      value={chapter.content}
                      onChangeText={(v) => updateChapter(index, "content", v)}
                      textAlignVertical="top"
                    />
                  </View>
                ))}
                <TouchableOpacity style={styles.addChapterBtn} onPress={addChapter}>
                  <Ionicons name="add-circle-outline" size={20} color={THEME.accent} />
                  <Text style={styles.addChapterBtnTxt}>ADD CHAPTER</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ══════════════════════════════════════════════════
            TAB 3 — PUBLISH
        ══════════════════════════════════════════════════ */}
        {activeTab === "Publish" && (
          <View style={styles.pane}>

            {/* READINESS CHECKLIST */}
            <View style={styles.readinessCard}>
              <View style={styles.readinessHeader}>
                <Text style={styles.readinessTitle}>PUBLISH READINESS</Text>
                <Text style={styles.readinessScore}>
                  {readinessScore}/{readinessItems.length}
                </Text>
              </View>
              <View style={styles.readinessTrack}>
                <View style={[
                  styles.readinessFill,
                  { width: `${(readinessScore / readinessItems.length) * 100}%` }
                ]} />
              </View>
              <View style={styles.checklistRows}>
                {readinessItems.map((item) => (
                  <View key={item.label} style={styles.checklistRow}>
                    <Ionicons
                      name={item.done ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={item.done ? THEME.green : THEME.textMuted}
                    />
                    <Text style={[styles.checklistTxt, item.done && { color: THEME.text }]}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* MONETIZATION */}
            <Text style={styles.sectionLabel}>MONETIZATION</Text>
            <View style={styles.toggleCard}>
              <View style={styles.toggleLeft}>
                <View style={[styles.toggleIcon, { backgroundColor: isFree ? THEME.green + "20" : THEME.accentDim }]}>
                  <Ionicons
                    name={isFree ? "gift-outline" : "cash-outline"}
                    size={20}
                    color={isFree ? THEME.green : THEME.accent}
                  />
                </View>
                <View>
                  <Text style={styles.toggleTitle}>{isFree ? "Free to Read" : "Paid Book"}</Text>
                  <Text style={styles.toggleSub}>
                    {isFree ? "Everyone can access this book" : "Readers pay to access this book"}
                  </Text>
                </View>
              </View>
              <Switch
                value={!isFree}
                onValueChange={(v) => setIsFree(!v)}
                trackColor={{ false: THEME.ui2, true: THEME.accent }}
                thumbColor={!isFree ? "#000" : THEME.textMuted}
              />
            </View>

            {!isFree && (
              <View style={styles.priceRow}>
                <Text style={styles.currencySymbol}>₦</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="0.00"
                  placeholderTextColor={THEME.ui3}
                  keyboardType="numeric"
                  value={price}
                  onChangeText={setPrice}
                />
                <Text style={styles.revenueNote}>You earn 80%</Text>
              </View>
            )}

            {/* MATURE CONTENT */}
            <View style={[styles.toggleCard, { marginTop: 12 }]}>
              <View style={styles.toggleLeft}>
                <View style={[styles.toggleIcon, { backgroundColor: isMature ? THEME.red + "20" : THEME.ui2 }]}>
                  <Ionicons name="warning-outline" size={20} color={isMature ? THEME.red : THEME.textMuted} />
                </View>
                <View>
                  <Text style={styles.toggleTitle}>Mature Content (18+)</Text>
                  <Text style={styles.toggleSub}>Contains adult themes or language</Text>
                </View>
              </View>
              <Switch
                value={isMature}
                onValueChange={setIsMature}
                trackColor={{ false: THEME.ui2, true: THEME.red }}
                thumbColor={isMature ? "#fff" : THEME.textMuted}
              />
            </View>

            {/* LEGAL */}
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>LEGAL DECLARATION</Text>
            <View style={styles.legalCard}>
              <View style={styles.legalHeader}>
                <FontAwesome5 name="shield-alt" size={22} color={THEME.accent} />
                <Text style={styles.legalHeaderTxt}>INTELLECTUAL PROPERTY GUARD</Text>
              </View>
              <Text style={styles.legalBody}>
                By publishing, you declare that:{"\n\n"}
                <Text style={styles.legalPoint}>1. ORIGINAL WORK</Text>
                {"\n"}This is your original creation. You hold full copyright.{"\n\n"}
                <Text style={styles.legalPoint}>2. ANTI-PIRACY</Text>
                {"\n"}Submitting stolen or plagiarised content is a criminal offence under the Nigerian Copyright Act 2022.{"\n\n"}
                <Text style={styles.legalPoint}>3. PLATFORM LICENCE</Text>
                {"\n"}You grant Writha a non-exclusive licence to distribute your work. You retain full ownership.{"\n\n"}
                <Text style={styles.legalPoint}>4. REVENUE SHARE</Text>
                {"\n"}You earn 80% of all sales. Writha retains 20%.{"\n\n"}
                <Text style={styles.legalPoint}>5. EDITORIAL REVIEW</Text>
                {"\n"}All books undergo review before going live (24–48 hours).
              </Text>
              <TouchableOpacity
                style={styles.agreeRow}
                onPress={() => setAgreedToTerms(!agreedToTerms)}
              >
                <View style={[styles.agreeCheckbox, agreedToTerms && styles.agreeCheckboxActive]}>
                  {agreedToTerms && <Ionicons name="checkmark" size={14} color="#000" />}
                </View>
                <Text style={styles.agreeTxt}>
                  I confirm this is my original work and I agree to the terms above
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── FOOTER ── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={styles.draftBtn}
          onPress={saveDraft}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={THEME.textMuted} />
          ) : (
            <Text style={styles.draftBtnTxt}>SAVE DRAFT</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.publishBtn, !canPublish && { opacity: 0.4 }]}
          onPress={publish}
          disabled={!canPublish || publishing}
        >
          {publishing ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="rocket-outline" size={16} color="#000" />
              <Text style={styles.publishBtnTxt}>SUBMIT FOR REVIEW</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: THEME.ui2,
  },
  headerClose: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center",
  },
  tabRow: {
    flexDirection: "row", backgroundColor: THEME.ui,
    borderRadius: 12, padding: 3, gap: 3,
  },
  tab: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  tabActive: { backgroundColor: THEME.accent },
  tabTxt: { color: THEME.textMuted, fontSize: 9, fontWeight: "900" },
  tabTxtActive: { color: "#000" },
  savedBadge: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: THEME.green + "15",
    justifyContent: "center", alignItems: "center",
  },
  pane: { padding: 20 },
  fieldLabel: {
    color: THEME.accent, fontSize: 10, fontWeight: "900",
    letterSpacing: 2, marginBottom: 10, marginTop: 20,
  },
  fieldInput: {
    backgroundColor: THEME.ui, borderRadius: 12, padding: 14,
    color: THEME.text, fontSize: 14,
    borderWidth: 1, borderColor: THEME.ui2,
  },
  titleInput: {
    backgroundColor: THEME.ui, borderRadius: 14, padding: 16,
    color: THEME.text, fontSize: 22, fontWeight: "900",
    borderWidth: 1, borderColor: THEME.ui2,
  },
  charCount: { color: THEME.textMuted, fontSize: 10, textAlign: "right", marginTop: 4 },
  coverUrlRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: THEME.ui, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: THEME.ui2, marginBottom: 14,
  },
  coverUrlInput: { flex: 1, color: THEME.text, fontSize: 13 },
  orDivider: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  orLine: { flex: 1, height: 1, backgroundColor: THEME.ui2 },
  orTxt: { color: THEME.textMuted, fontSize: 11, fontWeight: "600" },
  coverPickerBtn: {
    borderRadius: 16, overflow: "hidden",
    borderWidth: 1.5, borderColor: THEME.ui2,
    borderStyle: "dashed", marginBottom: 12,
  },
  coverPreviewWrap: { width: "100%", height: 220, position: "relative" },
  coverPreviewImg: { width: "100%", height: "100%" },
  coverPreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center", alignItems: "center", gap: 6,
  },
  coverPreviewOverlayTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  coverEmpty: {
    height: 150, justifyContent: "center",
    alignItems: "center", gap: 8, backgroundColor: THEME.ui,
  },
  coverEmptyTxt: { color: THEME.textMuted, fontWeight: "800", fontSize: 13 },
  coverEmptyHint: { color: THEME.ui3, fontSize: 10 },
  canvaHint: {
    flexDirection: "row", gap: 8, alignItems: "flex-start",
    backgroundColor: THEME.accentDim, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: THEME.accent + "30", marginBottom: 4,
  },
  canvaHintTxt: { flex: 1, color: THEME.accent, fontSize: 12, lineHeight: 18 },
  genreScroll: { marginBottom: 4 },
  genreRow: { flexDirection: "row", gap: 8, paddingBottom: 4 },
  genrePill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2,
  },
  genrePillActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  genrePillTxt: { color: THEME.textMuted, fontWeight: "700", fontSize: 12 },
  genrePillTxtActive: { color: "#000" },
  tagInputRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  tagInput: {
    flex: 1, backgroundColor: THEME.ui, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    color: THEME.text, fontSize: 14,
    borderWidth: 1, borderColor: THEME.ui2,
  },
  tagAddBtn: {
    width: 46, height: 46, borderRadius: 13,
    backgroundColor: THEME.accent, justifyContent: "center", alignItems: "center",
  },
  tagCloud: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  tagPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: THEME.accentDim, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1, borderColor: THEME.accent + "40",
  },
  tagPillTxt: { color: THEME.accent, fontSize: 12, fontWeight: "700" },
  synopsisInput: {
    backgroundColor: THEME.ui, borderRadius: 14, padding: 14,
    color: THEME.text, fontSize: 14, minHeight: 120,
    borderWidth: 1, borderColor: THEME.ui2, lineHeight: 22,
  },
  modeSwitch: { flexDirection: "row", gap: 12, marginBottom: 16 },
  modeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8, padding: 14,
    borderRadius: 14, backgroundColor: THEME.ui,
    borderWidth: 1, borderColor: THEME.ui2,
  },
  modeBtnActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  modeBtnTxt: { color: THEME.textMuted, fontSize: 11, fontWeight: "900" },
  modeBtnTxtActive: { color: "#000" },
  wordCountBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: THEME.ui, borderRadius: 12, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: THEME.ui2, gap: 6,
  },
  wordCountLeft: { flexDirection: "row", alignItems: "baseline" },
  wordCountNum: { color: THEME.text, fontSize: 18, fontWeight: "900" },
  wordCountLbl: { color: THEME.textMuted, fontSize: 12 },
  wordCountPages: { flex: 1, color: THEME.textMuted, fontSize: 11, textAlign: "center" },
  wordCountStatus: { fontSize: 11, fontWeight: "700" },
  autosaveNote: {
    flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12,
  },
  autosaveNoteTxt: { color: THEME.green, fontSize: 11, fontWeight: "600" },
  manuscriptInput: {
    backgroundColor: THEME.ui, borderRadius: 16, padding: 16,
    color: THEME.text, fontSize: 16, lineHeight: 28,
    minHeight: 500, borderWidth: 1, borderColor: THEME.ui2,
  },
  chapterBlock: {
    backgroundColor: THEME.ui, borderRadius: 16, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: THEME.ui2,
  },
  chapterBlockHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 6,
  },
  chapterTitleInput: {
    flex: 1, color: THEME.accent, fontWeight: "800",
    fontSize: 15, marginRight: 10,
  },
  chapterWordCount: { color: THEME.textMuted, fontSize: 10, marginBottom: 10 },
  chapterContentInput: {
    color: THEME.text, fontSize: 15, lineHeight: 26,
    minHeight: 200, textAlignVertical: "top",
  },
  addChapterBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, padding: 16, borderRadius: 16,
    borderWidth: 1.5, borderColor: THEME.accent + "40",
    borderStyle: "dashed",
  },
  addChapterBtnTxt: { color: THEME.accent, fontWeight: "900", fontSize: 12 },
  readinessCard: {
    backgroundColor: THEME.ui, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: THEME.ui2, marginBottom: 20,
  },
  readinessHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 10,
  },
  readinessTitle: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  readinessScore: { color: THEME.text, fontWeight: "900", fontSize: 15 },
  readinessTrack: {
    height: 4, backgroundColor: THEME.ui2,
    borderRadius: 2, overflow: "hidden", marginBottom: 16,
  },
  readinessFill: { height: "100%", backgroundColor: THEME.green, borderRadius: 2 },
  checklistRows: { gap: 12 },
  checklistRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checklistTxt: { color: THEME.textMuted, fontSize: 13 },
  sectionLabel: {
    color: THEME.accent, fontSize: 10, fontWeight: "900",
    letterSpacing: 2, marginBottom: 12,
  },
  toggleCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: THEME.ui, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: THEME.ui2,
  },
  toggleLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  toggleIcon: {
    width: 42, height: 42, borderRadius: 13,
    justifyContent: "center", alignItems: "center",
  },
  toggleTitle: { color: THEME.text, fontWeight: "800", fontSize: 14 },
  toggleSub: { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  priceRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: THEME.ui, borderRadius: 14, padding: 14,
    marginTop: 10, borderWidth: 1, borderColor: THEME.ui2, gap: 8,
  },
  currencySymbol: { color: THEME.accent, fontSize: 24, fontWeight: "900" },
  priceInput: { flex: 1, color: THEME.text, fontSize: 28, fontWeight: "900" },
  revenueNote: { color: THEME.green, fontSize: 11, fontWeight: "700" },
  legalCard: {
    backgroundColor: THEME.ui, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: THEME.ui2,
  },
  legalHeader: {
    flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14,
  },
  legalHeaderTxt: {
    color: THEME.accent, fontSize: 11, fontWeight: "900", letterSpacing: 1,
  },
  legalBody: { color: THEME.textMuted, fontSize: 12, lineHeight: 20 },
  legalPoint: { color: THEME.text, fontWeight: "900" },
  agreeRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    marginTop: 18, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: THEME.ui2,
  },
  agreeCheckbox: {
    width: 24, height: 24, borderRadius: 8,
    borderWidth: 2, borderColor: THEME.textMuted,
    justifyContent: "center", alignItems: "center", flexShrink: 0,
  },
  agreeCheckboxActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  agreeTxt: { flex: 1, color: THEME.textMuted, fontSize: 12, lineHeight: 18 },
  footer: {
    position: "absolute", bottom: 0, width: "100%",
    flexDirection: "row", padding: 16, gap: 12,
    backgroundColor: THEME.ui, borderTopWidth: 1, borderTopColor: THEME.ui2,
  },
  draftBtn: {
    flex: 1, paddingVertical: 16, alignItems: "center",
    borderRadius: 16, backgroundColor: THEME.bg,
    borderWidth: 1, borderColor: THEME.ui2,
  },
  draftBtnTxt: { color: THEME.textMuted, fontWeight: "900", fontSize: 12 },
  publishBtn: {
    flex: 2, paddingVertical: 16, alignItems: "center",
    borderRadius: 16, backgroundColor: THEME.accent,
    flexDirection: "row", justifyContent: "center", gap: 8,
  },
  publishBtnTxt: { color: "#000", fontWeight: "900", fontSize: 12 },
});