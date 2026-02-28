import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, StatusBar, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert, Dimensions,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp, arrayUnion } from "firebase/firestore";

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

// ── WEAVE TYPES (synced with create.tsx) ─────────────────────────────────
const WEAVE_TYPES = [
  {
    key:    "Analysis",
    icon:   "microscope",
    color:  "#38BDF8",
    desc:   "Deep reading of themes, symbols and structure",
    fields: ["title", "content", "quote", "tags"],
  },
  {
    key:    "Critique",
    icon:   "star-half-full",
    color:  "#FFD700",
    desc:   "Critical evaluation with a rating",
    fields: ["title", "content", "rating", "quote", "tags"],
  },
  {
    key:    "Research",
    icon:   "book-search",
    color:  "#A78BFA",
    desc:   "Academic or historical research with sources",
    fields: ["title", "content", "sources", "findings", "tags"],
  },
  {
    key:    "Memory",
    icon:   "heart-outline",
    color:  "#F97316",
    desc:   "Personal connection — where this book found you",
    fields: ["content", "tags"],
  },
  {
    key:    "Legacy",
    icon:   "trophy-outline",
    color:  "#22C55E",
    desc:   "The author's impact, era and lasting influence",
    fields: ["title", "content", "sources", "tags"],
  },
  {
    key:    "Discussion",
    icon:   "forum-outline",
    color:  "#6D28D9",
    desc:   "An open question or debate starter for the community",
    fields: ["content", "tags"],
  },
] as const;

type WeaveTypeKey = typeof WEAVE_TYPES[number]["key"];

const QUOTE_CHAR_LIMIT = 300;

interface EditHistory {
  editedAt:  any;
  prevContent: string;
}

export default function EditWeaveScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const user    = auth.currentUser;

  // ── THEME ────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(true);
  const T = isDark ? DARK_THEME : LIGHT_THEME;
  const s = makeStyles(T);

  // ── LOAD STATE ───────────────────────────────────────────────────
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [originalData,  setOriginalData]  = useState<any>(null);

  // ── FORM STATE ───────────────────────────────────────────────────
  const [weaveType,  setWeaveType]  = useState<WeaveTypeKey>("Discussion");
  const [title,      setTitle]      = useState("");
  const [content,    setContent]    = useState("");
  const [quote,      setQuote]      = useState("");
  const [rating,     setRating]     = useState("");
  const [sources,    setSources]    = useState("");
  const [findings,   setFindings]   = useState("");
  const [tagInput,   setTagInput]   = useState("");
  const [tags,       setTags]       = useState<string[]>([]);

  // ── BOOK INFO (read only) ────────────────────────────────────────
  const [bookTitle,  setBookTitle]  = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [isExternal, setIsExternal] = useState(false);

  const activeType = WEAVE_TYPES.find((t) => t.key === weaveType)!;
  const hasField   = (f: string) => activeType.fields.includes(f as any);

  // ── LOAD WEAVE ───────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    const fetchWeave = async () => {
      try {
        const snap = await getDoc(doc(db, "weaves", id));
        if (!snap.exists()) {
          showAlert("Not Found", "This Weave no longer exists.", [{
            text: "OK",
            onPress: () => router.back(),
          }]);
          return;
        }

        const data = snap.data();

        // Verify ownership
        if (data.userId !== user?.uid) {
          showAlert("Access Denied", "You can only edit your own Weaves.", [{
            text: "OK",
            onPress: () => router.back(),
          }]);
          return;
        }

        setOriginalData(data);
        setWeaveType((data.type as WeaveTypeKey) || "Discussion");
        setTitle(data.title       || "");
        setContent(data.content   || "");
        setQuote(data.quote       || "");
        setRating(data.rating     || "");
        setSources(data.sources   || "");
        setFindings(data.findings || "");
        setTags(data.tags         || []);
        setBookTitle(data.bookTitle  || "");
        setBookAuthor(data.bookAuthor || "");
        setIsExternal(data.isExternalBook || false);

      } catch (e: any) {
        showAlert("Error", e.message, [{ text: "OK", onPress: () => router.back() }]);
      } finally {
        setLoading(false);
      }
    };

    fetchWeave();
  }, [id]);

  // ── ADD TAG ──────────────────────────────────────────────────────
  const addTag = () => {
    const cleaned = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (!cleaned || tags.length >= 8 || tags.includes(cleaned)) return;
    setTags([...tags, cleaned]);
    setTagInput("");
  };

  // ── VALIDATE ─────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!content.trim())
      return "The body of your Weave cannot be empty.";
    if (content.trim().length < 50)
      return "Your Weave needs at least 50 characters.";
    if (weaveType === "Critique" && !rating.trim())
      return "A Critique requires a rating.";
    if (weaveType === "Research" && !sources.trim())
      return "Research requires at least one source citation.";
    if (quote.length > QUOTE_CHAR_LIMIT)
      return `Direct quotes must be under ${QUOTE_CHAR_LIMIT} characters.`;
    return null;
  };

  // ── SAVE ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    const error = validate();
    if (error) {
      showAlert("Not Ready", error, [{ text: "OK" }]);
      return;
    }
    if (!id || !user) return;

    showAlert(
      "Save Changes",
      "Update this Weave? It will be marked as edited.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: async () => {
            setSaving(true);
            try {
              const tagsArray = [
                ...tags.filter(Boolean),
              ].filter((t, i, arr) => arr.indexOf(t) === i);

              // Build edit history entry
              const historyEntry: EditHistory = {
                editedAt:    new Date().toISOString(),
                prevContent: originalData?.content || "",
              };

              const updateData: any = {
                type:     weaveType,
                content:  content.trim(),
                tags:     tagsArray,
                isEdited: true,
                editedAt: serverTimestamp(),
                // Append to edit history array
                editHistory: arrayUnion(historyEntry),
              };

              // Conditional fields based on type
              if (hasField("title"))    updateData.title    = title.trim()    || null;
              if (hasField("quote"))    updateData.quote    = quote.trim()    || null;
              if (hasField("rating"))   updateData.rating   = rating.trim()   || null;
              if (hasField("sources"))  updateData.sources  = sources.trim()  || null;
              if (hasField("findings")) updateData.findings = findings.trim() || null;

              // Clear fields that no longer apply to the new type
              if (!hasField("title"))    updateData.title    = null;
              if (!hasField("quote"))    updateData.quote    = null;
              if (!hasField("rating"))   updateData.rating   = null;
              if (!hasField("sources"))  updateData.sources  = null;
              if (!hasField("findings")) updateData.findings = null;

              await updateDoc(doc(db, "weaves", id), updateData);

              // Also update in feed if public
              try {
                await updateDoc(doc(db, "feed", id), updateData);
              } catch {
                // Feed doc may not exist if private — ignore
              }

              showAlert(
                "Saved ✅",
                "Your Weave has been updated.",
                [{
                  text: "View Weave",
                  onPress: () => router.replace(`/weave/${id}` as any),
                }]
              );

            } catch (e: any) {
              showAlert("Error", e.message, [{ text: "OK" }]);
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  // ── HAS UNSAVED CHANGES ──────────────────────────────────────────
  const hasChanges =
    originalData &&
    (content    !== (originalData.content   || "") ||
     title      !== (originalData.title     || "") ||
     quote      !== (originalData.quote     || "") ||
     rating     !== (originalData.rating    || "") ||
     sources    !== (originalData.sources   || "") ||
     findings   !== (originalData.findings  || "") ||
     weaveType  !== (originalData.type      || "Discussion") ||
     JSON.stringify(tags) !== JSON.stringify(originalData.tags || []));

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: DARK_THEME.bg, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color={DARK_THEME.accent} />
    </View>
  );

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
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => {
              if (hasChanges) {
                showAlert(
                  "Unsaved Changes",
                  "You have unsaved changes. Discard them?",
                  [
                    { text: "Keep Editing", style: "cancel" },
                    { text: "Discard", style: "destructive", onPress: () => router.back() },
                  ]
                );
              } else {
                router.back();
              }
            }}
          >
            <Ionicons name="chevron-back" size={22} color={T.accent} />
          </TouchableOpacity>

          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>EDIT WEAVE</Text>
            {hasChanges && (
              <View style={[s.unsavedDot, { backgroundColor: T.orange }]} />
            )}
          </View>

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

          {/* BOOK REFERENCE (read only) */}
          <View style={s.bookBanner}>
            <View style={[s.bookBannerIcon, { backgroundColor: T.accent + "20" }]}>
              <Ionicons name="book" size={16} color={T.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.bookBannerTitle} numberOfLines={1}>
                {bookTitle}
              </Text>
              <Text style={s.bookBannerAuthor}>{bookAuthor}</Text>
            </View>
            {isExternal && (
              <View style={[s.externalBadge, { backgroundColor: T.orange + "20" }]}>
                <Ionicons name="globe-outline" size={11} color={T.orange} />
                <Text style={[s.externalBadgeTxt, { color: T.orange }]}>External</Text>
              </View>
            )}
            <View style={[s.lockedBadge, { backgroundColor: T.ui2 }]}>
              <Ionicons name="lock-closed" size={11} color={T.textMuted} />
              <Text style={s.lockedBadgeTxt}>Locked</Text>
            </View>
          </View>
          <Text style={s.lockedNote}>
            The referenced book cannot be changed after publishing.
          </Text>

          {/* EDIT NOTICE */}
          {originalData?.isEdited && (
            <View style={s.editedNotice}>
              <Ionicons name="time-outline" size={14} color={T.purpleLight} />
              <Text style={[s.editedNoticeTxt, { color: T.purpleLight }]}>
                This Weave has been edited before. Changes are tracked for transparency.
              </Text>
            </View>
          )}

          {/* WEAVE TYPE */}
          <Text style={s.fieldLabel}>WEAVE TYPE</Text>
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
                    size={14}
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

          {/* TYPE CHANGE WARNING */}
          {originalData?.type && weaveType !== originalData.type && (
            <View style={[s.typeChangeWarning, { borderColor: T.orange + "40" }]}>
              <Ionicons name="warning-outline" size={14} color={T.orange} />
              <Text style={[s.typeChangeWarningTxt, { color: T.orange }]}>
                Changing type from {originalData.type} to {weaveType}.
                Fields that don't apply will be cleared.
              </Text>
            </View>
          )}

          {/* TYPE DESC */}
          <View style={[s.typeDescCard, { borderLeftColor: activeType.color }]}>
            <Text style={[s.typeDescTxt, { color: activeType.color }]}>
              {activeType.desc}
            </Text>
          </View>

          {/* TITLE */}
          {hasField("title") && (
            <>
              <Text style={s.fieldLabel}>TITLE</Text>
              <TextInput
                style={s.titleInput}
                placeholder="Title..."
                placeholderTextColor={T.textMuted}
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />
            </>
          )}

          {/* MAIN CONTENT */}
          <Text style={s.fieldLabel}>
            {weaveType === "Memory"     ? "YOUR MEMORY"   :
             weaveType === "Discussion" ? "THE QUESTION"  :
             weaveType === "Critique"   ? "THE REVIEW"    :
             weaveType === "Legacy"     ? "THE LEGACY"    :
             weaveType === "Research"   ? "THE RESEARCH"  :
                                         "THE ANALYSIS"  }
            {" *"}
          </Text>
          <TextInput
            style={s.contentInput}
            placeholder="Start weaving..."
            placeholderTextColor={T.textMuted}
            multiline
            value={content}
            onChangeText={setContent}
            textAlignVertical="top"
            maxLength={5000}
          />
          <Text style={s.charCount}>{content.length}/5000</Text>

          {/* DIRECT QUOTE */}
          {hasField("quote") && (
            <>
              <Text style={s.fieldLabel}>DIRECT QUOTE (Optional)</Text>
              <View style={[s.quoteCard, { borderLeftColor: activeType.color }]}>
                <TextInput
                  style={s.quoteInput}
                  placeholder={`Quoted passage from the book...\nMax ${QUOTE_CHAR_LIMIT} characters`}
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

          {/* RATING */}
          {hasField("rating") && weaveType === "Critique" && (
            <>
              <Text style={s.fieldLabel}>CRITICAL RATING *</Text>
              <View style={s.ratingRow}>
                {["1","2","3","4","5","6","7","8","9","10"].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      s.ratingBtn,
                      rating === r && { backgroundColor: T.accent, borderColor: T.accent },
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
                  {Number(rating) >= 9 ? "Masterpiece"        :
                   Number(rating) >= 7 ? "Highly Recommended" :
                   Number(rating) >= 5 ? "Worth Reading"      :
                   Number(rating) >= 3 ? "Has Merit"          :
                                         "Not Recommended"    }
                </Text>
              )}
            </>
          )}

          {/* SOURCES */}
          {hasField("sources") && (
            <>
              <Text style={s.fieldLabel}>
                {weaveType === "Research" ? "SOURCES & CITATIONS *" : "SOURCES"}
              </Text>
              <TextInput
                style={[s.fieldInput, { minHeight: 80 }]}
                placeholder="List your sources, one per line..."
                placeholderTextColor={T.textMuted}
                multiline
                value={sources}
                onChangeText={setSources}
                textAlignVertical="top"
              />
            </>
          )}

          {/* FINDINGS */}
          {hasField("findings") && weaveType === "Research" && (
            <>
              <Text style={s.fieldLabel}>KEY FINDINGS</Text>
              <TextInput
                style={[s.fieldInput, { minHeight: 80 }]}
                placeholder="Summarise your key findings..."
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

          {/* TRANSPARENCY NOTICE */}
          <View style={s.transparencyCard}>
            <MaterialCommunityIcons
              name="archive-check"
              size={16}
              color={T.accent}
            />
            <View style={{ flex: 1 }}>
              <Text style={[s.transparencyTitle, { color: T.accent }]}>
                Archive Transparency
              </Text>
              <Text style={s.transparencySub}>
                Edited Weaves are marked as "edited" with a timestamp.
                Your original contribution remains in the edit history
                for scholarly integrity.
              </Text>
            </View>
          </View>

        </ScrollView>

        {/* FOOTER */}
        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={s.discardBtn}
            onPress={() => router.back()}
          >
            <Text style={[s.discardBtnTxt, { color: T.textMuted }]}>Discard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              s.saveBtn,
              { backgroundColor: T.accent },
              (!hasChanges || saving) && { opacity: 0.4 },
            ]}
            onPress={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color="#000" />
                <Text style={s.saveBtnTxt}>SAVE CHANGES</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (T: typeof DARK_THEME | typeof LIGHT_THEME) => StyleSheet.create({
  container:            { flex: 1, backgroundColor: T.bg },
  header:               { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: T.ui2 },
  backBtn:              { width: 40, height: 40, borderRadius: 12, backgroundColor: T.ui, justifyContent: "center", alignItems: "center" },
  themeBtn:             { width: 40, height: 40, borderRadius: 12, backgroundColor: T.ui, justifyContent: "center", alignItems: "center" },
  headerCenter:         { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle:          { color: T.accent, fontSize: 13, fontWeight: "900", letterSpacing: 3 },
  unsavedDot:           { width: 8, height: 8, borderRadius: 4 },
  bookBanner:           { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.ui, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: T.ui2 },
  bookBannerIcon:       { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  bookBannerTitle:      { color: T.text, fontSize: 14, fontWeight: "900" },
  bookBannerAuthor:     { color: T.textMuted, fontSize: 11, marginTop: 2 },
  externalBadge:        { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  externalBadgeTxt:     { fontSize: 9, fontWeight: "900" },
  lockedBadge:          { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  lockedBadgeTxt:       { color: T.textMuted, fontSize: 9, fontWeight: "800" },
  lockedNote:           { color: T.textMuted, fontSize: 11, marginTop: 6, marginBottom: 4, fontStyle: "italic" },
  editedNotice:         { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: T.ui, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: T.purpleLight + "40", marginBottom: 8 },
  editedNoticeTxt:      { fontSize: 12, flex: 1, lineHeight: 18 },
  fieldLabel:           { color: T.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 10, marginTop: 20 },
  fieldInput:           { backgroundColor: T.ui, borderRadius: 14, padding: 14, color: T.text, fontSize: 14, borderWidth: 1, borderColor: T.ui2 },
  typeRow:              { flexDirection: "row", gap: 10, paddingBottom: 4 },
  typePill:             { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: T.ui, borderWidth: 1, borderColor: T.ui2 },
  typePillTxt:          { color: T.textMuted, fontWeight: "800", fontSize: 12 },
  typeChangeWarning:    { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: T.ui, borderRadius: 12, padding: 12, borderWidth: 1, marginTop: 10 },
  typeChangeWarningTxt: { fontSize: 12, flex: 1, lineHeight: 18 },
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
  transparencyCard:     { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: T.accentDim, borderRadius: 16, padding: 16, marginTop: 24, borderWidth: 1, borderColor: T.accent + "30" },
  transparencyTitle:    { fontSize: 12, fontWeight: "900", marginBottom: 4 },
  transparencySub:      { color: T.textMuted, fontSize: 11, lineHeight: 18 },
  footer:               { position: "absolute", bottom: 0, width: "100%", flexDirection: "row", padding: 16, gap: 12, backgroundColor: T.ui, borderTopWidth: 1, borderTopColor: T.ui2 },
  discardBtn:           { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 16, backgroundColor: T.bg, borderWidth: 1, borderColor: T.ui2 },
  discardBtnTxt:        { fontWeight: "800", fontSize: 13 },
  saveBtn:              { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 16 },
  saveBtnTxt:           { color: "#000", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
});