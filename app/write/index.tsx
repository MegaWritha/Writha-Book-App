import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Image, Alert, ActivityIndicator, Switch,
  KeyboardAvoidingView, Platform, Dimensions, StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { db, auth } from "@/lib/firebase";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp, doc, setDoc } from "firebase/firestore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#080410",
  ui: "#100820",
  ui2: "#1A0E30",
  ui3: "#251645",
  accent: "#FFD700",
  accentDim: "rgba(255,215,0,0.1)",
  purple: "#6D28D9",
  purpleLight: "#A78BFA",
  text: "#EDE8F5",
  textMuted: "#6B6080",
  green: "#22C55E",
  red: "#EF4444",
};

const GENRES = [
  "Romance", "Fantasy", "Horror", "Mystery", "Sci-Fi",
  "Thriller", "Drama", "Historical", "Adventure", "Comedy",
  "Literary Fiction", "Non-Fiction", "Biography", "Self-Help", "Other",
];

type ManuscriptMode = "full" | "chapters" | "acts";
type ActiveSection = "cover" | "story" | "publish";

export default function WrithaStudio() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = auth.currentUser;
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftIdRef = useRef<string | null>(null);

  const [activeSection, setActiveSection] = useState<ActiveSection>("cover");
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Book metadata
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState(user?.displayName || "");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("");
  const [customGenre, setCustomGenre] = useState("");
  const [isCustomGenre, setIsCustomGenre] = useState(false);
  const [coverUrl, setCoverUrl] = useState("");
  const [coverLocalUri, setCoverLocalUri] = useState<string | null>(null);
  const [showWrithaLogo, setShowWrithaLogo] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // Content
  const [manuscriptMode, setManuscriptMode] = useState<ManuscriptMode>("chapters");
  const [fullContent, setFullContent] = useState("");
  const [chapters, setChapters] = useState([{ title: "Chapter 1", content: "" }]);
  const [acts, setActs] = useState([{ title: "Act 1", content: "" }]);

  // Publishing
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isMature, setIsMature] = useState(false);

  // ── WORD COUNT ────────────────────────────────────────────────────────
  const wordCount = (() => {
    const text = manuscriptMode === "full"
      ? fullContent
      : manuscriptMode === "chapters"
      ? chapters.map((c) => c.content).join(" ")
      : acts.map((a) => a.content).join(" ");
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  })();

  // ── AUTOSAVE ──────────────────────────────────────────────────────────
  const buildPayload = useCallback((status: "draft" | "published") => {
    const finalGenre = isCustomGenre ? customGenre : genre;
    return {
      title: title.trim(),
      authorName: authorName.trim() || user?.displayName || "Author",
      authorId: user!.uid,
      description: description.trim(),
      genre: finalGenre,
      tags,
      coverUrl: coverUrl || null,
      showWrithaLogo,
      manuscriptMode,
      content: manuscriptMode === "full" ? fullContent.trim() : null,
      chapters: manuscriptMode === "chapters" ? chapters : null,
      acts: manuscriptMode === "acts" ? acts : null,
      isFree,
      isMature,
      price: isFree ? 0 : parseFloat(price) || 0,
      status,
      agreedToTerms,
      wordCount,
      updatedAt: serverTimestamp(),
    };
  }, [
    title, authorName, description, genre, customGenre, isCustomGenre,
    coverUrl, showWrithaLogo, manuscriptMode, fullContent, chapters, acts,
    isFree, price, agreedToTerms, tags, isMature, wordCount, user,
  ]);

  // Auto-save every 30 seconds when there's a title
  useEffect(() => {
    if (!title.trim() || !user) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(async () => {
      try {
        const payload = buildPayload("draft");
        if (draftIdRef.current) {
          // Update existing draft
          await setDoc(doc(db, "books", draftIdRef.current), payload, { merge: true });
        } else {
          // Create new draft
          const ref = await addDoc(collection(db, "books"), {
            ...payload,
            createdAt: serverTimestamp(),
          });
          draftIdRef.current = ref.id;
        }
        setLastSaved(new Date());
      } catch (e) {
        console.error("Autosave failed:", e);
      }
    }, 30000); // 30 seconds

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [title, fullContent, chapters, acts, buildPayload, user]);

  // ── COVER IMAGE PICKER ────────────────────────────────────────────────
  const pickCoverImage = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert("Permission Required", "Allow photo library access to upload your cover.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [2, 3], // Book cover ratio
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverLocalUri(result.assets[0].uri);
      // Show local preview immediately
      setCoverUrl(result.assets[0].uri);
    }
  };

  const uploadCoverToStorage = async (): Promise<string | null> => {
    if (!coverLocalUri || coverLocalUri.startsWith("http")) return coverUrl || null;
    setUploadingCover(true);
    try {
      const storage = getStorage();
      const response = await fetch(coverLocalUri);
      const blob = await response.blob();
      const storageRef = ref(storage, `book-covers/${user!.uid}/${Date.now()}.jpg`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      setCoverUrl(url);
      return url;
    } catch (e) {
      console.error("Cover upload failed:", e);
      return null;
    } finally {
      setUploadingCover(false);
    }
  };

  // ── TAGS ───────────────────────────────────────────────────────────────
  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 8) {
      setTags([...tags, t]);
      setTagInput("");
    }
  };

  // ── SAVE ──────────────────────────────────────────────────────────────
  const saveToFirebase = async (status: "published" | "draft") => {
    if (!user) return Alert.alert("Required", "Please log in.");

    if (status === "published") {
      if (!agreedToTerms)
        return Alert.alert("Legal Required", "You must agree to the publishing terms.");
      if (!title.trim())
        return Alert.alert("Required", "Please add a book title.");
      const finalGenre = isCustomGenre ? customGenre : genre;
      if (!finalGenre)
        return Alert.alert("Required", "Please select a genre.");
      const hasContent =
        manuscriptMode === "full"     ? fullContent.trim() !== ""     :
        manuscriptMode === "chapters" ? chapters.some((c) => c.content.trim() !== "") :
                                        acts.some((a) => a.content.trim() !== "");
      if (!hasContent)
        return Alert.alert("Required", "Please add some content before publishing.");
      if (wordCount < 100)
        return Alert.alert("Too Short", "Your book needs at least 100 words to publish.");
    }

    if (status === "draft" && !title.trim())
      return Alert.alert("Required", "Add a title to save your draft.");

    status === "published" ? setPublishing(true) : setSavingDraft(true);

    try {
      // Upload cover image if local
      let finalCoverUrl = coverUrl;
      if (coverLocalUri && !coverLocalUri.startsWith("http")) {
        finalCoverUrl = (await uploadCoverToStorage()) || coverUrl;
      }

      const payload = {
        ...buildPayload(status),
        coverUrl: finalCoverUrl,
        views: 0,
        likesCount: 0,
        commentsCount: 0,
        likedBy: [],
        purchasedBy: [],
      };

      if (draftIdRef.current) {
        await setDoc(doc(db, "books", draftIdRef.current), payload, { merge: true });
      } else {
        const docRef = await addDoc(collection(db, "books"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        draftIdRef.current = docRef.id;
      }

      setLastSaved(new Date());

      if (status === "draft") {
        Alert.alert("Draft Saved ✅", "Your work is saved in your library drafts.", [
          { text: "Keep Writing" },
          { text: "Go to Library", onPress: () => router.replace("/(tabs)/library" as any) },
        ]);
      } else {
        Alert.alert("Published! 🎉", "Your book is now live on Writha.", [
          { text: "View Book", onPress: () => router.replace(`/book/${draftIdRef.current}` as any) },
          { text: "Go Home", onPress: () => router.replace("/(tabs)" as any) },
        ]);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setPublishing(false);
      setSavingDraft(false);
    }
  };

  const finalGenre = isCustomGenre ? customGenre : genre;

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#0D0820", THEME.bg]} style={StyleSheet.absoluteFill} />

      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => {
            if (title) {
              Alert.alert("Save before leaving?", "", [
                { text: "Discard", style: "destructive", onPress: () => router.back() },
                { text: "Save Draft", onPress: () => saveToFirebase("draft") },
                { text: "Cancel", style: "cancel" },
              ]);
            } else {
              router.back();
            }
          }}
        >
          <Ionicons name="close" size={22} color={THEME.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>BOOK STUDIO</Text>
          {lastSaved && (
            <Text style={styles.autoSaveTxt}>
              ✓ Saved {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          )}
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.draftHeaderBtn}
            onPress={() => saveToFirebase("draft")}
            disabled={savingDraft}
          >
            {savingDraft ? (
              <ActivityIndicator size="small" color={THEME.textMuted} />
            ) : (
              <Text style={styles.draftHeaderBtnTxt}>DRAFT</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.publishHeaderBtn, publishing && { opacity: 0.7 }]}
            onPress={() => saveToFirebase("published")}
            disabled={publishing}
          >
            {publishing ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.publishHeaderBtnTxt}>PUBLISH</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* SECTION TABS */}
      <View style={styles.sectionTabs}>
        {([
          { key: "cover",   label: "Cover & Info",  icon: "image-outline"           },
          { key: "story",   label: "Write Story",   icon: "create-outline"          },
          { key: "publish", label: "Publish",       icon: "rocket-outline"          },
        ] as { key: ActiveSection; label: string; icon: string }[]).map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.sectionTab, activeSection === s.key && styles.sectionTabActive]}
            onPress={() => setActiveSection(s.key)}
          >
            <Ionicons
              name={s.icon as any}
              size={15}
              color={activeSection === s.key ? "#000" : THEME.textMuted}
            />
            <Text style={[styles.sectionTabTxt, activeSection === s.key && styles.sectionTabTxtActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollBody}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── COVER & INFO TAB ── */}
          {activeSection === "cover" && (
            <View>
              {/* COVER PICKER */}
              <Text style={styles.fieldLabel}>BOOK COVER</Text>
              <View style={styles.coverSection}>
                <TouchableOpacity
                  style={styles.coverPickerBtn}
                  onPress={pickCoverImage}
                  activeOpacity={0.85}
                >
                  {coverUrl ? (
                    <Image source={{ uri: coverUrl }} style={styles.coverPreview} resizeMode="cover" />
                  ) : (
                    <View style={styles.coverEmpty}>
                      <Ionicons name="image-outline" size={36} color={THEME.textMuted} />
                      <Text style={styles.coverEmptyTxt}>Upload Cover</Text>
                      <Text style={styles.coverEmptySub}>2:3 ratio recommended</Text>
                    </View>
                  )}
                  {showWrithaLogo && (
                    <View style={styles.writhaBadge}>
                      <Text style={styles.writhaBadgeTxt}>WRITHA BOOKS</Text>
                    </View>
                  )}
                  {uploadingCover && (
                    <View style={styles.uploadingOverlay}>
                      <ActivityIndicator color={THEME.accent} />
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.coverRight}>
                  <Text style={styles.coverHint}>
                    📸 Upload from your camera roll — or use a Canva design!
                  </Text>
                  <Text style={styles.coverHintSub}>
                    Export your Canva cover as JPG/PNG and upload it here.
                  </Text>

                  <TouchableOpacity style={styles.uploadCoverBtn} onPress={pickCoverImage}>
                    <Ionicons name="cloud-upload-outline" size={16} color="#000" />
                    <Text style={styles.uploadCoverBtnTxt}>
                      {coverUrl ? "Change Cover" : "Upload Image"}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.logoToggleRow}>
                    <Text style={styles.logoToggleTxt}>Show "WRITHA BOOKS" badge</Text>
                    <Switch
                      value={showWrithaLogo}
                      onValueChange={setShowWrithaLogo}
                      trackColor={{ false: THEME.ui2, true: THEME.accent }}
                      thumbColor={showWrithaLogo ? "#000" : THEME.textMuted}
                    />
                  </View>
                </View>
              </View>

              {/* TITLE */}
              <Text style={styles.fieldLabel}>BOOK TITLE</Text>
              <TextInput
                style={styles.titleInput}
                placeholder="Enter your book title..."
                placeholderTextColor={THEME.ui3}
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />
              <Text style={styles.charHint}>{title.length}/100</Text>

              {/* AUTHOR */}
              <Text style={styles.fieldLabel}>AUTHOR NAME</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Your name or pen name..."
                placeholderTextColor={THEME.textMuted}
                value={authorName}
                onChangeText={setAuthorName}
              />

              {/* DESCRIPTION */}
              <Text style={styles.fieldLabel}>SYNOPSIS / BLURB</Text>
              <TextInput
                style={styles.descInput}
                placeholder="Hook readers with a compelling description..."
                placeholderTextColor={THEME.textMuted}
                multiline
                value={description}
                onChangeText={setDescription}
                maxLength={1000}
                textAlignVertical="top"
              />
              <Text style={styles.charHint}>{description.length}/1000</Text>

              {/* GENRE */}
              <Text style={styles.fieldLabel}>GENRE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.genreRow}>
                  {GENRES.map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.genrePill, genre === g && !isCustomGenre && styles.genrePillActive]}
                      onPress={() => { setGenre(g); setIsCustomGenre(false); }}
                    >
                      <Text style={[styles.genrePillTxt, genre === g && !isCustomGenre && styles.genrePillTxtActive]}>
                        {g}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.genrePill, isCustomGenre && styles.genrePillActive]}
                    onPress={() => setIsCustomGenre(true)}
                  >
                    <Text style={[styles.genrePillTxt, isCustomGenre && styles.genrePillTxtActive]}>
                      Custom +
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
              {isCustomGenre && (
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Type your genre..."
                  placeholderTextColor={THEME.textMuted}
                  value={customGenre}
                  onChangeText={setCustomGenre}
                />
              )}

              {/* TAGS */}
              <Text style={styles.fieldLabel}>TAGS ({tags.length}/8)</Text>
              <View style={styles.tagRow}>
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
                  <TouchableOpacity
                    key={tag}
                    style={styles.tagPill}
                    onPress={() => setTags(tags.filter((t) => t !== tag))}
                  >
                    <Text style={styles.tagPillTxt}>#{tag}</Text>
                    <Ionicons name="close" size={11} color={THEME.accent} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ── STORY WRITING TAB ── */}
          {activeSection === "story" && (
            <View>
              {/* MODE SELECTOR */}
              <Text style={styles.fieldLabel}>MANUSCRIPT STRUCTURE</Text>
              <View style={styles.modeGrid}>
                {([
                  { key: "chapters", icon: "book-outline",      label: "Chapters",   sub: "Classic chapter structure"   },
                  { key: "acts",     icon: "layers-outline",     label: "Acts",       sub: "Dramatic act structure"      },
                  { key: "full",     icon: "document-outline",   label: "Full Text",  sub: "Paste entire manuscript"     },
                ] as { key: ManuscriptMode; icon: string; label: string; sub: string }[]).map((m) => (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.modeCard, manuscriptMode === m.key && styles.modeCardActive]}
                    onPress={() => setManuscriptMode(m.key)}
                  >
                    <Ionicons
                      name={m.icon as any}
                      size={20}
                      color={manuscriptMode === m.key ? "#000" : THEME.purpleLight}
                    />
                    <Text style={[styles.modeCardLabel, manuscriptMode === m.key && { color: "#000" }]}>
                      {m.label}
                    </Text>
                    <Text style={[styles.modeCardSub, manuscriptMode === m.key && { color: "rgba(0,0,0,0.6)" }]}>
                      {m.sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* WORD COUNT BAR */}
              <View style={styles.wordCountBar}>
                <View style={styles.wordCountItem}>
                  <Text style={styles.wordCountNum}>{wordCount.toLocaleString()}</Text>
                  <Text style={styles.wordCountLbl}>Words</Text>
                </View>
                <View style={styles.wordCountDiv} />
                <View style={styles.wordCountItem}>
                  <Text style={styles.wordCountNum}>{Math.max(1, Math.ceil(wordCount / 250))}</Text>
                  <Text style={styles.wordCountLbl}>Est. Pages</Text>
                </View>
                <View style={styles.wordCountDiv} />
                <View style={styles.wordCountItem}>
                  <Text style={[
                    styles.wordCountNum,
                    wordCount >= 100 ? { color: THEME.green } : { color: THEME.red },
                  ]}>
                    {wordCount >= 100 ? "✓ Ready" : `${100 - wordCount} more`}
                  </Text>
                  <Text style={styles.wordCountLbl}>Min to Publish</Text>
                </View>
              </View>

              {/* FULL MODE */}
              {manuscriptMode === "full" && (
                <TextInput
                  style={styles.fullInput}
                  placeholder={"Start writing or paste your manuscript here...\n\nTip: You can paste a full manuscript from Word/Google Docs."}
                  placeholderTextColor={THEME.textMuted}
                  multiline
                  value={fullContent}
                  onChangeText={setFullContent}
                  textAlignVertical="top"
                />
              )}

              {/* CHAPTERS MODE */}
              {manuscriptMode === "chapters" && (
                <View>
                  {chapters.map((chapter, index) => (
                    <View key={index} style={styles.entryCard}>
                      <View style={styles.entryHeader}>
                        <TextInput
                          style={styles.entryTitleInput}
                          value={chapter.title}
                          onChangeText={(t) => {
                            const u = [...chapters]; u[index].title = t; setChapters(u);
                          }}
                          placeholder="Chapter Title"
                          placeholderTextColor={THEME.textMuted}
                        />
                        {chapters.length > 1 && (
                          <TouchableOpacity
                            onPress={() => setChapters(chapters.filter((_, i) => i !== index))}
                          >
                            <Ionicons name="trash-outline" size={18} color={THEME.red} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <TextInput
                        style={styles.entryContentInput}
                        multiline
                        value={chapter.content}
                        onChangeText={(t) => {
                          const u = [...chapters]; u[index].content = t; setChapters(u);
                        }}
                        placeholder={`Write Chapter ${index + 1} here...`}
                        placeholderTextColor={THEME.textMuted}
                        textAlignVertical="top"
                      />
                      <Text style={styles.entryWordCount}>
                        {chapter.content.trim() ? chapter.content.trim().split(/\s+/).length : 0} words
                      </Text>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.addEntryBtn}
                    onPress={() => setChapters([...chapters, { title: `Chapter ${chapters.length + 1}`, content: "" }])}
                  >
                    <Ionicons name="add-circle-outline" size={20} color={THEME.accent} />
                    <Text style={styles.addEntryBtnTxt}>ADD CHAPTER</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ACTS MODE */}
              {manuscriptMode === "acts" && (
                <View>
                  {acts.map((act, index) => (
                    <View key={index} style={styles.entryCard}>
                      <View style={styles.entryHeader}>
                        <TextInput
                          style={styles.entryTitleInput}
                          value={act.title}
                          onChangeText={(t) => {
                            const u = [...acts]; u[index].title = t; setActs(u);
                          }}
                          placeholder="Act Title"
                          placeholderTextColor={THEME.textMuted}
                        />
                        {acts.length > 1 && (
                          <TouchableOpacity
                            onPress={() => setActs(acts.filter((_, i) => i !== index))}
                          >
                            <Ionicons name="trash-outline" size={18} color={THEME.red} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <TextInput
                        style={styles.entryContentInput}
                        multiline
                        value={act.content}
                        onChangeText={(t) => {
                          const u = [...acts]; u[index].content = t; setActs(u);
                        }}
                        placeholder={`Write Act ${index + 1} here...`}
                        placeholderTextColor={THEME.textMuted}
                        textAlignVertical="top"
                      />
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.addEntryBtn}
                    onPress={() => setActs([...acts, { title: `Act ${acts.length + 1}`, content: "" }])}
                  >
                    <Ionicons name="add-circle-outline" size={20} color={THEME.accent} />
                    <Text style={styles.addEntryBtnTxt}>ADD ACT</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ── PUBLISH TAB ── */}
          {activeSection === "publish" && (
            <View>
              {/* READINESS CHECK */}
              <Text style={styles.fieldLabel}>READINESS CHECK</Text>
              <View style={styles.checklistCard}>
                {[
                  { label: "Book title",     done: !!title.trim()                             },
                  { label: "Cover image",    done: !!coverUrl                                 },
                  { label: "Genre selected", done: !!(isCustomGenre ? customGenre : genre)    },
                  { label: "Synopsis",       done: description.trim().length > 20             },
                  { label: "Content added",  done: wordCount >= 100                           },
                  { label: "Terms agreed",   done: agreedToTerms                              },
                ].map((item, i) => (
                  <View key={i} style={styles.checklistRow}>
                    <View style={[styles.checkCircle, item.done && styles.checkCircleDone]}>
                      {item.done && <Ionicons name="checkmark" size={12} color="#000" />}
                    </View>
                    <Text style={[styles.checkLabel, item.done && styles.checkLabelDone]}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>

              {/* MONETISATION */}
              <Text style={styles.fieldLabel}>MONETISATION</Text>
              <View style={styles.settingCard}>
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="gift-outline" size={20} color={THEME.green} />
                    <View>
                      <Text style={styles.settingTitle}>Free to Read</Text>
                      <Text style={styles.settingSubtitle}>All readers can access for free</Text>
                    </View>
                  </View>
                  <Switch
                    value={isFree}
                    onValueChange={setIsFree}
                    trackColor={{ false: THEME.ui2, true: THEME.green }}
                    thumbColor={isFree ? THEME.accent : THEME.textMuted}
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
                  </View>
                )}
              </View>

              {/* CONTENT SETTINGS */}
              <Text style={styles.fieldLabel}>CONTENT SETTINGS</Text>
              <View style={styles.settingCard}>
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="warning-outline" size={20} color={THEME.red} />
                    <View>
                      <Text style={styles.settingTitle}>Mature Content (18+)</Text>
                      <Text style={styles.settingSubtitle}>Contains adult themes or language</Text>
                    </View>
                  </View>
                  <Switch
                    value={isMature}
                    onValueChange={setIsMature}
                    trackColor={{ false: THEME.ui2, true: THEME.red }}
                    thumbColor={isMature ? "#fff" : THEME.textMuted}
                  />
                </View>
              </View>

              {/* LEGAL & ANTI-PIRACY */}
              <Text style={styles.fieldLabel}>PUBLISHING AGREEMENT</Text>
              <View style={styles.legalCard}>
                <View style={styles.legalHeader}>
                  <MaterialCommunityIcons name="shield-check" size={28} color={THEME.accent} />
                  <Text style={styles.legalTitle}>INTELLECTUAL PROPERTY DECLARATION</Text>
                </View>

                <Text style={styles.legalBody}>
                  By publishing on Writha, you declare that:{"\n\n"}
                  <Text style={styles.legalPoint}>1. ORIGINAL WORK</Text> — This manuscript is your original intellectual property. You hold full copyright.{"\n\n"}
                  <Text style={styles.legalPoint}>2. ANTI-PIRACY ACT</Text> — Uploading stolen, plagiarised, or previously published content belonging to another author is a criminal offence under Nigerian copyright law (Copyright Act 2022) and international IP treaties. Violations result in immediate account termination, forfeiture of all earnings, and referral to law enforcement.{"\n\n"}
                  <Text style={styles.legalPoint}>3. PLATFORM LICENCE</Text> — You grant Writha a non-exclusive licence to display, distribute, and promote your work on the platform. You retain full ownership.{"\n\n"}
                  <Text style={styles.legalPoint}>4. REVENUE SHARE</Text> — Writha retains 20% of all sales as a platform fee. You receive 80%.{"\n\n"}
                  <Text style={styles.legalPoint}>5. CONTENT STANDARDS</Text> — Content must comply with Writha's community guidelines. Prohibited: hate speech, incitement to violence, content involving minors.
                </Text>

                <View style={styles.legalAgreeRow}>
                  <Switch
                    value={agreedToTerms}
                    onValueChange={setAgreedToTerms}
                    trackColor={{ false: THEME.ui2, true: THEME.purple }}
                    thumbColor={agreedToTerms ? THEME.accent : THEME.textMuted}
                  />
                  <Text style={styles.legalAgreeTxt}>
                    I have read, understood, and agree to the above Publishing Agreement and Writha's Terms of Service.
                  </Text>
                </View>
              </View>

              {/* PUBLISH BUTTON */}
              <TouchableOpacity
                style={[styles.publishBigBtn, (!agreedToTerms || publishing) && { opacity: 0.6 }]}
                onPress={() => saveToFirebase("published")}
                disabled={!agreedToTerms || publishing}
              >
                {publishing ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="rocket-launch" size={22} color="#000" />
                    <Text style={styles.publishBigBtnTxt}>PUBLISH BOOK</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveDraftBigBtn}
                onPress={() => saveToFirebase("draft")}
                disabled={savingDraft}
              >
                {savingDraft ? (
                  <ActivityIndicator color={THEME.textMuted} />
                ) : (
                  <Text style={styles.saveDraftBigBtnTxt}>Save as Draft</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  closeBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: THEME.text, fontWeight: "900", letterSpacing: 2, fontSize: 13 },
  autoSaveTxt: { color: THEME.green, fontSize: 10, marginTop: 2 },
  headerRight: { flexDirection: "row", gap: 8 },
  draftHeaderBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: THEME.ui2 },
  draftHeaderBtnTxt: { color: THEME.textMuted, fontWeight: "800", fontSize: 12 },
  publishHeaderBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: THEME.accent },
  publishHeaderBtnTxt: { color: "#000", fontWeight: "900", fontSize: 12 },
  sectionTabs: { flexDirection: "row", backgroundColor: THEME.ui, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  sectionTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 13, gap: 5 },
  sectionTabActive: { backgroundColor: THEME.accent },
  sectionTabTxt: { color: THEME.textMuted, fontWeight: "700", fontSize: 11 },
  sectionTabTxtActive: { color: "#000" },
  scrollBody: { padding: 16, paddingBottom: 60 },
  fieldLabel: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 10, marginTop: 22 },
  charHint: { color: THEME.textMuted, fontSize: 10, textAlign: "right", marginTop: 4 },
  coverSection: { flexDirection: "row", gap: 14 },
  coverPickerBtn: { width: 120, height: 180, borderRadius: 14, overflow: "hidden", borderWidth: 1.5, borderColor: THEME.ui2, position: "relative" },
  coverPreview: { width: "100%", height: "100%" },
  coverEmpty: { flex: 1, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center", gap: 6 },
  coverEmptyTxt: { color: THEME.textMuted, fontWeight: "700", fontSize: 12 },
  coverEmptySub: { color: THEME.textMuted, fontSize: 9, textAlign: "center" },
  writhaBadge: { position: "absolute", bottom: 0, width: "100%", backgroundColor: THEME.accent, paddingVertical: 3 },
  writhaBadgeTxt: { color: "#000", fontSize: 7, fontWeight: "900", textAlign: "center" },
  uploadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  coverRight: { flex: 1 },
  coverHint: { color: THEME.text, fontWeight: "700", fontSize: 13, lineHeight: 18 },
  coverHintSub: { color: THEME.textMuted, fontSize: 11, marginTop: 6, lineHeight: 16 },
  uploadCoverBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: THEME.accent, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginTop: 14, alignSelf: "flex-start" },
  uploadCoverBtnTxt: { color: "#000", fontWeight: "900", fontSize: 12 },
  logoToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  logoToggleTxt: { color: THEME.textMuted, fontSize: 11, flex: 1 },
  titleInput: { backgroundColor: THEME.ui, color: THEME.text, borderRadius: 14, padding: 16, fontSize: 18, fontWeight: "800", borderWidth: 1, borderColor: THEME.ui2 },
  fieldInput: { backgroundColor: THEME.ui, color: THEME.text, borderRadius: 14, padding: 14, fontSize: 14, borderWidth: 1, borderColor: THEME.ui2 },
  descInput: { backgroundColor: THEME.ui, color: THEME.text, borderRadius: 14, padding: 14, fontSize: 14, minHeight: 120, textAlignVertical: "top", lineHeight: 22, borderWidth: 1, borderColor: THEME.ui2 },
  genreRow: { flexDirection: "row", gap: 8, paddingBottom: 8 },
  genrePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2 },
  genrePillActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  genrePillTxt: { color: THEME.textMuted, fontWeight: "700", fontSize: 12 },
  genrePillTxtActive: { color: "#000" },
  tagRow: { flexDirection: "row", gap: 8 },
  tagInput: { flex: 1, backgroundColor: THEME.ui, color: THEME.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: THEME.ui2, fontSize: 13 },
  tagAddBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: THEME.accent, justifyContent: "center", alignItems: "center" },
  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  tagPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: THEME.accentDim, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: THEME.accent + "40" },
  tagPillTxt: { color: THEME.accent, fontSize: 12, fontWeight: "700" },
  modeGrid: { flexDirection: "row", gap: 10, marginBottom: 16 },
  modeCard: { flex: 1, backgroundColor: THEME.ui, borderRadius: 16, padding: 14, alignItems: "center", gap: 4, borderWidth: 1, borderColor: THEME.ui2 },
  modeCardActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  modeCardLabel: { color: THEME.purpleLight, fontWeight: "800", fontSize: 12 },
  modeCardSub: { color: THEME.textMuted, fontSize: 9, textAlign: "center" },
  wordCountBar: { flexDirection: "row", backgroundColor: THEME.ui, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: THEME.ui2 },
  wordCountItem: { flex: 1, alignItems: "center" },
  wordCountNum: { color: THEME.accent, fontSize: 18, fontWeight: "900" },
  wordCountLbl: { color: THEME.textMuted, fontSize: 9, fontWeight: "700", marginTop: 2 },
  wordCountDiv: { width: 1, backgroundColor: THEME.ui2 },
  fullInput: { backgroundColor: THEME.ui, color: THEME.text, borderRadius: 14, padding: 16, minHeight: 400, fontSize: 15, lineHeight: 24, textAlignVertical: "top", borderWidth: 1, borderColor: THEME.ui2 },
  entryCard: { backgroundColor: THEME.ui, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: THEME.ui2 },
  entryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  entryTitleInput: { flex: 1, color: THEME.text, fontWeight: "800", fontSize: 16, borderBottomWidth: 1, borderBottomColor: THEME.ui2, paddingBottom: 6 },
  entryContentInput: { color: THEME.text, fontSize: 15, lineHeight: 24, minHeight: 200, textAlignVertical: "top" },
  entryWordCount: { color: THEME.textMuted, fontSize: 10, marginTop: 8, textAlign: "right" },
  addEntryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: THEME.accent + "60" },
  addEntryBtnTxt: { color: THEME.accent, fontWeight: "900", fontSize: 11 },
  checklistCard: { backgroundColor: THEME.ui, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: THEME.ui2 },
  checklistRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  checkCircle: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: THEME.ui2, justifyContent: "center", alignItems: "center" },
  checkCircleDone: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  checkLabel: { color: THEME.textMuted, fontSize: 14 },
  checkLabelDone: { color: THEME.text, fontWeight: "700" },
  settingCard: { backgroundColor: THEME.ui, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: THEME.ui2 },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  settingInfo: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, marginRight: 12 },
  settingTitle: { color: THEME.text, fontWeight: "800", fontSize: 14 },
  settingSubtitle: { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  priceRow: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.bg, borderRadius: 12, padding: 14, marginTop: 14, borderWidth: 1, borderColor: THEME.ui2 },
  currencySymbol: { color: THEME.accent, fontSize: 24, fontWeight: "900", marginRight: 8 },
  priceInput: { flex: 1, color: THEME.text, fontSize: 28, fontWeight: "900" },
  legalCard: { backgroundColor: THEME.ui, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: THEME.ui2 },
  legalHeader: { alignItems: "center", marginBottom: 16 },
  legalTitle: { color: THEME.accent, fontWeight: "900", fontSize: 11, letterSpacing: 1.5, marginTop: 10 },
  legalBody: { color: THEME.textMuted, fontSize: 12, lineHeight: 20 },
  legalPoint: { color: THEME.text, fontWeight: "900" },
  legalAgreeRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 20, padding: 14, backgroundColor: THEME.bg, borderRadius: 14 },
  legalAgreeTxt: { color: THEME.text, fontSize: 12, flex: 1, lineHeight: 18 },
  publishBigBtn: { backgroundColor: THEME.accent, borderRadius: 20, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 24 },
  publishBigBtnTxt: { color: "#000", fontWeight: "900", fontSize: 16, letterSpacing: 1 },
  saveDraftBigBtn: { alignItems: "center", paddingVertical: 16, marginTop: 10 },
  saveDraftBigBtnTxt: { color: THEME.textMuted, fontWeight: "800", fontSize: 14 },
});