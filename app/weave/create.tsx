import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, StatusBar, ActivityIndicator, Platform,
  Alert, Switch, Dimensions, Modal, KeyboardAvoidingView,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "@/lib/firebase";
import {
  collection, addDoc, doc, setDoc, updateDoc,
  increment, serverTimestamp,
} from "firebase/firestore";
import BookReferenceScreen, { BookReference } from "./book-reference";

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
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) buttons.find((b) => b.style !== "cancel")?.onPress?.();
    }
  } else {
    Alert.alert(title, message, buttons as any);
  }
};

// ── THEMES ───────────────────────────────────────────────────────────────
const DARK_THEME = {
  mode:        "dark"  as const,
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
  blue:        "#38BDF8",
  orange:      "#F97316",
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
  blue:        "#0284C7",
  orange:      "#EA580C",
  statusBar:   "dark-content" as const,
};

// ── WEAVE TYPES ──────────────────────────────────────────────────────────
const WEAVE_TYPES = [
  {
    key:   "Analysis",
    icon:  "microscope",
    color: "#38BDF8",
    desc:  "Deep reading of themes, symbols and structure",
    fields: ["title", "content", "quote", "tags"],
  },
  {
    key:   "Critique",
    icon:  "star-half-full",
    color: "#FFD700",
    desc:  "Critical evaluation with a rating",
    fields: ["title", "content", "rating", "quote", "tags"],
  },
  {
    key:   "Research",
    icon:  "book-search",
    color: "#A78BFA",
    desc:  "Academic or historical research with sources",
    fields: ["title", "content", "sources", "findings", "tags"],
  },
  {
    key:   "Memory",
    icon:  "heart-outline",
    color: "#F97316",
    desc:  "Personal connection — where this book found you",
    fields: ["content", "tags"],
  },
  {
    key:   "Legacy",
    icon:  "trophy-outline",
    color: "#22C55E",
    desc:  "The author's impact, era and lasting influence",
    fields: ["title", "content", "sources", "tags"],
  },
  {
    key:   "Discussion",
    icon:  "forum-outline",
    color: "#6D28D9",
    desc:  "An open question or debate starter for the community",
    fields: ["content", "tags"],
  },
] as const;

type WeaveTypeKey = typeof WEAVE_TYPES[number]["key"];

// ── FAIR USE LIMIT ───────────────────────────────────────────────────────
const QUOTE_CHAR_LIMIT = 300;

export default function CreateWeave() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const user    = auth.currentUser;
  const params  = useLocalSearchParams();

  // ── THEME ────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(true);
  const T = isDark ? DARK_THEME : LIGHT_THEME;
  const s = makeStyles(T);

  // ── BOOK STATE ───────────────────────────────────────────────────
  const [selectedBook,     setSelectedBook]     = useState<BookReference | null>(
    params.bookId ? {
      id:           String(params.bookId),
      title:        String(params.bookTitle || ""),
      author:       String(params.authorName || ""),
      isOnPlatform: true,
    } : null
  );
  const [showBookSelector, setShowBookSelector] = useState(false);

  // ── FORM STATE ───────────────────────────────────────────────────
  const [weaveType,    setWeaveType]    = useState<WeaveTypeKey>("Discussion");
  const [title,        setTitle]        = useState("");
  const [content,      setContent]      = useState("");
  const [quote,        setQuote]        = useState("");
  const [rating,       setRating]       = useState("");
  const [sources,      setSources]      = useState("");
  const [findings,     setFindings]     = useState("");
  const [tagInput,     setTagInput]     = useState("");
  const [tags,         setTags]         = useState<string[]>([]);
  const [isPublic,     setIsPublic]     = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [published,    setPublished]    = useState(false);

  const activeType = WEAVE_TYPES.find((t) => t.key === weaveType)!;
  const hasField   = (f: string) => activeType.fields.includes(f as any);

  // ── OPEN BOOK SELECTOR IF NO BOOK ───────────────────────────────
  useEffect(() => {
    if (!selectedBook) {
      setShowBookSelector(true);
    }
  }, []);

  // ── ADD TAG ──────────────────────────────────────────────────────
  const addTag = () => {
    const cleaned = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (!cleaned || tags.length >= 8 || tags.includes(cleaned)) return;
    setTags([...tags, cleaned]);
    setTagInput("");
  };

  // ── VALIDATE ─────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!selectedBook)           return "Please select a book for your Weave.";
    if (!content.trim())         return "The body of your Weave cannot be empty.";
    if (content.trim().length < 50)
      return "Your Weave needs at least 50 characters to be meaningful.";
    if (hasField("rating") && weaveType === "Critique" && !rating.trim())
      return "A Critique requires a rating.";
    if (hasField("sources") && weaveType === "Research" && !sources.trim())
      return "Research requires at least one source citation.";
    if (quote.length > QUOTE_CHAR_LIMIT)
      return `Direct quotes must be under ${QUOTE_CHAR_LIMIT} characters (fair use limit).`;
    return null;
  };

  // ── PUBLISH ──────────────────────────────────────────────────────
  const handlePublish = async () => {
    const error = validate();
    if (error) {
      showAlert("Not Ready", error, [{ text: "OK" }]);
      return;
    }
    if (!user) {
      showAlert("Sign In Required", "Please sign in to publish a Weave.", [{ text: "OK" }]);
      return;
    }

    setIsSubmitting(true);

    try {
      const tagsArray = [
        ...tags,
        selectedBook!.title.toLowerCase().replace(/\s+/g, "-"),
        selectedBook!.author.toLowerCase().replace(/\s+/g, "-"),
        weaveType.toLowerCase(),
      ].filter((t, i, arr) => arr.indexOf(t) === i);

      const weaveData = {
        // Book reference
        bookId:            selectedBook!.isOnPlatform ? selectedBook!.id : null,
        bookReferenceId:   !selectedBook!.isOnPlatform ? selectedBook!.id : null,
        bookTitle:         selectedBook!.title,
        bookAuthor:        selectedBook!.author,
        bookYear:          selectedBook!.year || null,
        bookGenre:         selectedBook!.genre || null,
        isExternalBook:    !selectedBook!.isOnPlatform,

        // Weave content
        type:              weaveType,
        title:             hasField("title") ? title.trim() : null,
        content:           content.trim(),
        quote:             quote.trim() || null,
        rating:            hasField("rating") ? rating.trim() : null,
        sources:           hasField("sources") ? sources.trim() : null,
        findings:          hasField("findings") ? findings.trim() : null,
        tags:              tagsArray,

        // Visibility
        isPublic,

        // Attribution
        userId:            user.uid,
        userName:          user.displayName || "Writha Member",
        userPhoto:         user.photoURL    || null,

        // Legal
        disclaimer: selectedBook!.isOnPlatform
          ? null
          : "This is an independent critical work. Writha is not affiliated with the author or publisher of the referenced work.",

        // Meta
        likesCount:        0,
        likedBy:           [],
        commentsCount:     0,
        isArchived:        true,
        archivedAt:        serverTimestamp(),
        createdAt:         serverTimestamp(),
      };

      // 1. Save to weaves collection
      const docRef = await addDoc(collection(db, "weaves"), weaveData);

       // 2. Mirror to global feed if public
if (isPublic) {
  try {
    const feedData = {
      // Core identity
      type:         "weave",
      weaveType:    weaveType,
      feedType:     "weave",
      originalId:   docRef.id,
      status:       "published",
      isArchived:   false,

      // Book reference
      bookTitle:    selectedBook!.title,
      bookAuthor:   selectedBook!.author,
      isExternalBook: !selectedBook!.isOnPlatform,

      // Content
      title:        hasField("title") ? title.trim() : "",
      content:      content.trim(),
      findings:     hasField("findings") ? findings.trim() : "",
      rating:       hasField("rating") ? rating.trim() : "",
      tags:         weaveData.tags,

      // Author
      userId:       user.uid,
      userName:     user.displayName || "Writha Scholar",
      userPhoto:    user.photoURL || "",

      // Counts
      likesCount:   0,
      likedBy:      [],
      commentsCount: 0,
      reactions:    {},

      // Timestamp
      createdAt:    serverTimestamp(),
    };

    await setDoc(doc(db, "feed", docRef.id), feedData);
    console.log("Feed write successful");
  } catch (feedError: any) {
    console.error("Feed write failed:", feedError.message);
    showAlert(
      "Feed Error",
      feedError.message,
      [{ text: "OK" }]
    );
  }
}
      

      // 3. Increment weave count on user profile
      await updateDoc(doc(db, "users", user.uid), {
        weaveCount: increment(1),
      });

      // 4. Increment weave count on book reference if external
      if (!selectedBook!.isOnPlatform && selectedBook!.id) {
        await updateDoc(doc(db, "book_references", selectedBook!.id), {
          weaveCount: increment(1),
        }).catch(() => {});
      }

      setPublished(true);
      setTimeout(() => router.back(), 2000);

    } catch (e: any) {
      showAlert("Error", e.message || "Failed to publish. Check your connection.", [{ text: "OK" }]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={s.container}>
        <StatusBar barStyle={T.statusBar} />
        <LinearGradient
          colors={T.mode === "dark" ? ["#0F071A", T.bg] : ["#EDE8F8", T.bg]}
          style={StyleSheet.absoluteFill}
        />

        {/* HEADER */}
        <View style={[s.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={20} color={T.accent} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>WEAVE SUITE</Text>
          <TouchableOpacity style={s.themeBtn} onPress={() => setIsDark(!isDark)}>
            <Ionicons
              name={isDark ? "sunny-outline" : "moon-outline"}
              size={18}
              color={T.accent}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >

          {/* BOOK SELECTOR */}
          <Text style={s.fieldLabel}>TARGET WORK</Text>
          <TouchableOpacity
            style={s.bookSelector}
            onPress={() => setShowBookSelector(true)}
            activeOpacity={0.85}
          >
            {selectedBook ? (
              <View style={s.bookSelected}>
                <View style={[s.bookSelectedIcon, { backgroundColor: T.accent + "20" }]}>
                  <Ionicons name="book" size={20} color={T.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.bookSelectedTitleRow}>
                    <Text style={s.bookSelectedTitle} numberOfLines={1}>
                      {selectedBook.title}
                    </Text>
                    {!selectedBook.isOnPlatform && (
                      <View style={[s.externalBadge, { backgroundColor: T.orange + "20" }]}>
                        <Ionicons name="globe-outline" size={10} color={T.orange} />
                        <Text style={[s.externalBadgeTxt, { color: T.orange }]}>
                          External
                        </Text>
                      </View>
                    )}
                    {selectedBook.isOnPlatform && (
                      <View style={[s.externalBadge, { backgroundColor: T.green + "20" }]}>
                        <Ionicons name="checkmark-circle" size={10} color={T.green} />
                        <Text style={[s.externalBadgeTxt, { color: T.green }]}>
                          On Writha
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.bookSelectedAuthor}>
                    {selectedBook.author}
                    {selectedBook.year ? ` · ${selectedBook.year}` : ""}
                  </Text>
                </View>
                <Ionicons name="pencil-outline" size={16} color={T.textMuted} />
              </View>
            ) : (
              <View style={s.bookEmpty}>
                <Ionicons name="book-outline" size={24} color={T.textMuted} />
                <Text style={s.bookEmptyTxt}>Select a book to weave about</Text>
                <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
              </View>
            )}
          </TouchableOpacity>

          {/* EXTERNAL BOOK DISCLAIMER */}
          {selectedBook && !selectedBook.isOnPlatform && (
            <View style={s.disclaimerStrip}>
              <MaterialCommunityIcons
                name="shield-check-outline"
                size={14}
                color={T.accent}
              />
              <Text style={s.disclaimerStripTxt}>
                Your Weave will carry an independent commentary disclaimer
              </Text>
            </View>
          )}

          {/* WEAVE TYPE */}
          <Text style={[s.fieldLabel, { marginTop: 24 }]}>WEAVE TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.typeRow}>
              {WEAVE_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[
                    s.typePill,
                    weaveType === t.key && {
                      backgroundColor: t.color + "20",
                      borderColor:     t.color,
                    },
                  ]}
                  onPress={() => setWeaveType(t.key)}
                >
                  <MaterialCommunityIcons
                    name={t.icon as any}
                    size={16}
                    color={weaveType === t.key ? t.color : T.textMuted}
                  />
                  <Text style={[
                    s.typePillTxt,
                    weaveType === t.key && { color: t.color },
                  ]}>
                    {t.key}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* TYPE DESCRIPTION */}
          <View style={[s.typeDescCard, { borderLeftColor: activeType.color }]}>
            <Text style={[s.typeDescTxt, { color: activeType.color }]}>
              {activeType.desc}
            </Text>
          </View>

          {/* TITLE (for Analysis, Critique, Research, Legacy) */}
          {hasField("title") && (
            <>
              <Text style={s.fieldLabel}>TITLE</Text>
              <TextInput
                style={s.titleInput}
                placeholder="Give your Weave a title..."
                placeholderTextColor={T.textMuted}
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />
            </>
          )}

          {/* MAIN CONTENT */}
          <Text style={s.fieldLabel}>
            {weaveType === "Memory"     ? "YOUR MEMORY"      :
             weaveType === "Discussion" ? "THE QUESTION"     :
             weaveType === "Critique"   ? "THE REVIEW"       :
             weaveType === "Legacy"     ? "THE LEGACY"       :
             weaveType === "Research"   ? "THE RESEARCH"     :
                                         "THE ANALYSIS"     }
            {" *"}
          </Text>
          <TextInput
            style={s.contentInput}
            placeholder={
              weaveType === "Memory"
                ? "Where were you when this book found you? What did it change?"
                : weaveType === "Discussion"
                ? "Ask the community something worth debating..."
                : weaveType === "Legacy"
                ? "Who was this author? What did they give to literature?"
                : "Start weaving your thoughts..."
            }
            placeholderTextColor={T.textMuted}
            multiline
            value={content}
            onChangeText={setContent}
            textAlignVertical="top"
            maxLength={5000}
          />
          <Text style={s.charCount}>{content.length}/5000</Text>

          {/* DIRECT QUOTE (fair use) */}
          {hasField("quote") && (
            <>
              <Text style={s.fieldLabel}>DIRECT QUOTE (Optional)</Text>
              <View style={[s.quoteCard, { borderLeftColor: activeType.color }]}>
                <TextInput
                  style={s.quoteInput}
                  placeholder={`Paste a passage from the book for analysis...\nMax ${QUOTE_CHAR_LIMIT} characters (fair use limit)`}
                  placeholderTextColor={T.textMuted}
                  multiline
                  value={quote}
                  onChangeText={setQuote}
                  maxLength={QUOTE_CHAR_LIMIT}
                  textAlignVertical="top"
                />
                <View style={s.quoteFooter}>
                  <Ionicons name="information-circle-outline" size={12} color={T.textMuted} />
                  <Text style={[
                    s.quoteCharCount,
                    quote.length > QUOTE_CHAR_LIMIT * 0.8 && { color: T.red },
                  ]}>
                    {quote.length}/{QUOTE_CHAR_LIMIT} · Fair use limit
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* RATING (Critique only) */}
          {hasField("rating") && weaveType === "Critique" && (
            <>
              <Text style={s.fieldLabel}>CRITICAL RATING *</Text>
              <View style={s.ratingRow}>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      s.ratingBtn,
                      rating === r && {
                        backgroundColor: T.accent,
                        borderColor:     T.accent,
                      },
                    ]}
                    onPress={() => setRating(r)}
                  >
                    <Text style={[
                      s.ratingBtnTxt,
                      rating === r && { color: "#000" },
                    ]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {rating && (
                <Text style={[s.ratingDisplay, { color: T.accent }]}>
                  {rating}/10 —{" "}
                  {Number(rating) >= 9 ? "Masterpiece"  :
                   Number(rating) >= 7 ? "Highly Recommended" :
                   Number(rating) >= 5 ? "Worth Reading" :
                   Number(rating) >= 3 ? "Has Merit"    :
                                         "Not Recommended"}
                </Text>
              )}
            </>
          )}

          {/* SOURCES (Research + Legacy) */}
          {hasField("sources") && (
            <>
              <Text style={s.fieldLabel}>
                {weaveType === "Research" ? "SOURCES & CITATIONS *" : "SOURCES"}
              </Text>
              <TextInput
                style={[s.fieldInput, { minHeight: 80 }]}
                placeholder={
                  "List your sources, one per line:\n" +
                  "e.g. Achebe, C. (1958). Things Fall Apart. Heinemann.\n" +
                  "e.g. https://example.com/article"
                }
                placeholderTextColor={T.textMuted}
                multiline
                value={sources}
                onChangeText={setSources}
                textAlignVertical="top"
              />
            </>
          )}

          {/* FINDINGS (Research only) */}
          {hasField("findings") && weaveType === "Research" && (
            <>
              <Text style={s.fieldLabel}>KEY FINDINGS</Text>
              <TextInput
                style={[s.fieldInput, { minHeight: 80 }]}
                placeholder="Summarise your key findings in 2–3 points..."
                placeholderTextColor={T.textMuted}
                multiline
                value={findings}
                onChangeText={setFindings}
                textAlignVertical="top"
              />
            </>
          )}

          {/* TAGS */}
          <Text style={s.fieldLabel}>TAGS (up to 8)</Text>
          <View style={s.tagInputRow}>
            <TextInput
              style={s.tagInput}
              placeholder="Add a tag..."
              placeholderTextColor={T.textMuted}
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={addTag}
            />
            <TouchableOpacity
              style={[s.tagAddBtn, { backgroundColor: T.accent }]}
              onPress={addTag}
            >
              <Ionicons name="add" size={20} color="#000" />
            </TouchableOpacity>
          </View>
          {tags.length > 0 && (
            <View style={s.tagCloud}>
              {tags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[s.tagPill, { backgroundColor: T.accentDim, borderColor: T.accent + "40" }]}
                  onPress={() => setTags(tags.filter((t) => t !== tag))}
                >
                  <Text style={[s.tagPillTxt, { color: T.accent }]}>#{tag}</Text>
                  <Ionicons name="close" size={11} color={T.accent} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ARCHIVE NOTICE */}
          <View style={s.archiveNotice}>
            <MaterialCommunityIcons name="archive-outline" size={16} color={T.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[s.archiveTitle, { color: T.accent }]}>
                Writha Literary Archive
              </Text>
              <Text style={s.archiveSub}>
                Your Weave will be permanently preserved. Future readers and
                scholars may discover it years from now.
              </Text>
            </View>
          </View>

          {/* VISIBILITY */}
          <View style={s.visibilityCard}>
            <View style={s.visibilityLeft}>
              <View style={[s.visibilityIcon, {
                backgroundColor: isPublic ? T.green + "20" : T.ui2,
              }]}>
                <Ionicons
                  name={isPublic ? "globe-outline" : "lock-closed-outline"}
                  size={20}
                  color={isPublic ? T.green : T.textMuted}
                />
              </View>
              <View>
                <Text style={s.visibilityTitle}>
                  {isPublic ? "Public — Global Feed" : "Private — Your Library Only"}
                </Text>
                <Text style={s.visibilitySub}>
                  {isPublic
                    ? "Visible to all readers and indexed in the archive"
                    : "Only you can see this Weave"}
                </Text>
              </View>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: T.ui2, true: T.green }}
              thumbColor={isPublic ? "#fff" : T.textMuted}
            />
          </View>

        </ScrollView>

        {/* FOOTER */}
        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[
              s.publishBtn,
              { backgroundColor: published ? T.green : T.accent },
              (isSubmitting || !selectedBook) && { opacity: 0.5 },
            ]}
            onPress={handlePublish}
            disabled={isSubmitting || published || !selectedBook}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#000" />
            ) : published ? (
              <>
                <Ionicons name="checkmark-done" size={20} color="#000" />
                <Text style={s.publishBtnTxt}>WEAVE ARCHIVED</Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="feather" size={18} color="#000" />
                <Text style={s.publishBtnTxt}>PUBLISH WEAVE</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* BOOK SELECTOR MODAL */}
        <Modal
          visible={showBookSelector}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            if (selectedBook) setShowBookSelector(false);
            else router.back();
          }}
        >
          <BookReferenceScreen
            onSelect={(book) => {
              setSelectedBook(book);
              setShowBookSelector(false);
            }}
            onClose={() => {
              if (selectedBook) setShowBookSelector(false);
              else router.back();
            }}
          />
        </Modal>

      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (T: typeof DARK_THEME | typeof LIGHT_THEME) => StyleSheet.create({
  container:            { flex: 1, backgroundColor: T.bg },
  header:               { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: T.ui2 },
  backBtn:              { width: 40, height: 40, borderRadius: 12, backgroundColor: T.ui, justifyContent: "center", alignItems: "center" },
  themeBtn:             { width: 40, height: 40, borderRadius: 12, backgroundColor: T.ui, justifyContent: "center", alignItems: "center" },
  headerTitle:          { color: T.accent, fontSize: 13, fontWeight: "900", letterSpacing: 3 },
  fieldLabel:           { color: T.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 10, marginTop: 20 },
  fieldInput:           { backgroundColor: T.ui, borderRadius: 14, padding: 14, color: T.text, fontSize: 14, borderWidth: 1, borderColor: T.ui2 },
  bookSelector:         { backgroundColor: T.ui, borderRadius: 18, borderWidth: 1, borderColor: T.ui2, overflow: "hidden" },
  bookSelected:         { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  bookSelectedIcon:     { width: 44, height: 44, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  bookSelectedTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  bookSelectedTitle:    { color: T.text, fontSize: 15, fontWeight: "900", flex: 1 },
  bookSelectedAuthor:   { color: T.textMuted, fontSize: 12 },
  externalBadge:        { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  externalBadgeTxt:     { fontSize: 9, fontWeight: "900" },
  bookEmpty:            { flexDirection: "row", alignItems: "center", gap: 12, padding: 20 },
  bookEmptyTxt:         { flex: 1, color: T.textMuted, fontSize: 14 },
  disclaimerStrip:      { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: T.accentDim, borderRadius: 10, padding: 10, marginTop: 8, borderWidth: 1, borderColor: T.accent + "20" },
  disclaimerStripTxt:   { color: T.textMuted, fontSize: 11, flex: 1 },
  typeRow:              { flexDirection: "row", gap: 10, paddingBottom: 4 },
  typePill:             { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: T.ui, borderWidth: 1, borderColor: T.ui2 },
  typePillTxt:          { color: T.textMuted, fontWeight: "800", fontSize: 12 },
  typeDescCard:         { borderLeftWidth: 3, backgroundColor: T.ui, borderRadius: 12, padding: 12, marginTop: 10, borderWidth: 1, borderColor: T.ui2 },
  typeDescTxt:          { fontSize: 12, fontStyle: "italic" },
  titleInput:           { backgroundColor: T.ui, borderRadius: 14, padding: 16, color: T.text, fontSize: 20, fontWeight: "900", borderWidth: 1, borderColor: T.ui2 },
  contentInput:         { backgroundColor: T.ui, borderRadius: 14, padding: 16, color: T.text, fontSize: 15, minHeight: 200, borderWidth: 1, borderColor: T.ui2, lineHeight: 24 },
  charCount:            { color: T.textMuted, fontSize: 10, textAlign: "right", marginTop: 4 },
  quoteCard:            { backgroundColor: T.ui, borderRadius: 14, borderWidth: 1, borderColor: T.ui2, borderLeftWidth: 3, overflow: "hidden" },
  quoteInput:           { padding: 14, color: T.text, fontSize: 14, minHeight: 100, lineHeight: 22, fontStyle: "italic" },
  quoteFooter:          { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingBottom: 10 },
  quoteCharCount:       { color: T.textMuted, fontSize: 10 },
  ratingRow:            { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ratingBtn:            { width: 44, height: 44, borderRadius: 13, backgroundColor: T.ui, borderWidth: 1, borderColor: T.ui2, justifyContent: "center", alignItems: "center" },
  ratingBtnTxt:         { color: T.textMuted, fontWeight: "900", fontSize: 14 },
  ratingDisplay:        { fontSize: 13, fontWeight: "700", marginTop: 8 },
  tagInputRow:          { flexDirection: "row", gap: 10 },
  tagInput:             { flex: 1, backgroundColor: T.ui, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: T.text, fontSize: 14, borderWidth: 1, borderColor: T.ui2 },
  tagAddBtn:            { width: 46, height: 46, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  tagCloud:             { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  tagPill:              { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  tagPillTxt:           { fontSize: 12, fontWeight: "700" },
  archiveNotice:        { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: T.accentDim, borderRadius: 16, padding: 16, marginTop: 24, borderWidth: 1, borderColor: T.accent + "30" },
  archiveTitle:         { fontSize: 12, fontWeight: "900", marginBottom: 4 },
  archiveSub:           { color: T.textMuted, fontSize: 11, lineHeight: 18 },
  visibilityCard:       { flexDirection: "row", alignItems: "center", backgroundColor: T.ui, borderRadius: 16, padding: 16, marginTop: 16, borderWidth: 1, borderColor: T.ui2 },
  visibilityLeft:       { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  visibilityIcon:       { width: 42, height: 42, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  visibilityTitle:      { color: T.text, fontWeight: "800", fontSize: 13 },
  visibilitySub:        { color: T.textMuted, fontSize: 11, marginTop: 2 },
  footer:               { position: "absolute", bottom: 0, width: "100%", padding: 16, backgroundColor: T.ui, borderTopWidth: 1, borderTopColor: T.ui2 },
  publishBtn:           { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 18, borderRadius: 16 },
  publishBtnTxt:        { color: "#000", fontWeight: "900", fontSize: 14, letterSpacing: 1 },
});