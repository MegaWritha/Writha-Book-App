import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, StatusBar, ActivityIndicator, Image,
  Platform, Alert, Switch, Dimensions,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

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
  statusBar:   "dark-content" as const,
};

const GENRES = [
  "Romance", "Fantasy", "Mystery", "Thriller", "Sci-Fi",
  "Historical", "Horror", "Biography", "Self-Help", "Poetry",
  "Children", "Drama", "Adventure", "Literary", "Other",
];

export default function PublishDetails() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const user    = auth.currentUser;
  const params  = useLocalSearchParams();

  // ── THEME ────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(true);
  const T = isDark ? DARK_THEME : LIGHT_THEME;
  const s = makeStyles(T);

  // ── MANUSCRIPT DATA FROM PARAMS ──────────────────────────────────
  const wordCount    = Number(params.wordCount)    || 0;
  const chapterCount = Number(params.chapterCount) || 0;
  const pageCount    = Number(params.pageCount)    || 0;
  const readingTime  = String(params.readingTime)  || "";
  const fileType     = String(params.fileType)     || "";
  const fileName     = String(params.fileName)     || "";

  // Get content from global store
  const content = (global as any).__manuscriptContent || "";

  // ── FORM STATE ───────────────────────────────────────────────────
  const [title,         setTitle]         = useState("");
  const [authorName,    setAuthorName]    = useState("");
  const [subtitle,      setSubtitle]      = useState("");
  const [coverUrl,      setCoverUrl]      = useState("");
  const [coverLocalUri, setCoverLocalUri] = useState<string | null>(null);
  const [genre,         setGenre]         = useState("");
  const [customGenre,   setCustomGenre]   = useState("");
  const [tags,          setTags]          = useState<string[]>([]);
  const [tagInput,      setTagInput]      = useState("");
  const [description,   setDescription]  = useState("");
  const [isFree,        setIsFree]        = useState(true);
  const [price,         setPrice]         = useState("");
  const [isMature,      setIsMature]      = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isAdmin,       setIsAdmin]       = useState(false);
  const [saving,        setSaving]        = useState(false);

  const finalCover = coverLocalUri || coverUrl;
  const finalGenre = genre === "Other" ? customGenre : genre;

  // ── CHECK ADMIN ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    import("firebase/firestore").then(({ doc, getDoc }) => {
      import("@/lib/firebase").then(({ db }) => {
        getDoc(doc(db, "users", user.uid)).then((snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setIsAdmin(data.isAdmin === true);
            if (!data.isAdmin) {
              setAuthorName(
                data.displayName || data.fullName || user.displayName || ""
              );
            }
          }
        });
      });
    });
  }, [user]);

  // ── READINESS ────────────────────────────────────────────────────
  const readinessItems = [
    { label: "Title added",      done: title.trim().length > 0       },
    { label: "Author name",      done: authorName.trim().length > 0  },
    { label: "Cover image",      done: finalCover.length > 0         },
    { label: "Genre selected",   done: finalGenre.trim().length > 0  },
    { label: "Synopsis written", done: description.trim().length > 30 },
    { label: "Terms agreed",     done: agreedToTerms                 },
  ];
  const readinessScore = readinessItems.filter(i => i.done).length;
  const canSubmit      = readinessItems.every(i => i.done);

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

  // ── SUBMIT ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit) {
      const missing = readinessItems
        .filter(i => !i.done)
        .map(i => `• ${i.label}`)
        .join("\n");
      showAlert("Not Ready", `Complete these before submitting:\n\n${missing}`, [{ text: "OK" }]);
      return;
    }
    if (!user) return;

    showAlert(
      "Submit for Review",
      `Submit "${title}" for editorial review? You'll hear back within 24–48 hours.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            setSaving(true);
            try {
              const docId = `draft_${user.uid}_${Date.now()}`;
              await setDoc(doc(db, "books", docId), {
                title,
                subtitle,
                authorId:      user.uid,
                authorName:    authorName.trim() || user.displayName || "Author",
                coverUrl:      finalCover,
                genre:         finalGenre,
                tags,
                description,
                content,
                manuscriptMode: "full",
                wordCount,
                chapterCount,
                pageCount,
                readingTime,
                fileType,
                fileName,
                isFree,
                price:         isFree ? 0 : parseFloat(price) || 0,
                isMature,
                agreedToTerms,
                isUpload:      true,
                status:        "submitted",
                views:         0,
                likesCount:    0,
                commentsCount: 0,
                likedBy:       [],
                purchasedBy:   [],
                createdAt:     serverTimestamp(),
                updatedAt:     serverTimestamp(),
              });

              // Clear global content store
              (global as any).__manuscriptContent = null;

              showAlert(
                "Submitted! 🎉",
                "Your manuscript is in the editorial queue. You'll be notified within 24–48 hours.",
                [{
                  text: "Go to Library",
                  onPress: () => router.replace("/(tabs)/library" as any),
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

  return (
    <View style={s.container}>
      <StatusBar barStyle={T.statusBar} />
      <LinearGradient
        colors={T.mode === "dark" ? ["#0F071A", T.bg] : ["#EDE8F8", T.bg]}
        style={StyleSheet.absoluteFill}
      />

      {/* HEADER */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={T.accent} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>BOOK DETAILS</Text>
        <TouchableOpacity style={s.themeBtn} onPress={() => setIsDark(!isDark)}>
          <Ionicons
            name={isDark ? "sunny-outline" : "moon-outline"}
            size={18}
            color={T.accent}
          />
        </TouchableOpacity>
      </View>

      {/* MANUSCRIPT SUMMARY STRIP */}
      <View style={s.summaryStrip}>
        <MaterialCommunityIcons name="file-check-outline" size={16} color={T.green} />
        <Text style={s.summaryTxt} numberOfLines={1}>
          {fileName}
        </Text>
        <View style={s.summaryStats}>
          <Text style={[s.summaryStat, { color: T.blue }]}>
            {wordCount.toLocaleString()} words
          </Text>
          <Text style={s.summarySep}>·</Text>
          <Text style={[s.summaryStat, { color: T.purple }]}>
            {chapterCount} chapters
          </Text>
          <Text style={s.summarySep}>·</Text>
          <Text style={[s.summaryStat, { color: T.accent }]}>
            {readingTime}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.pane}>

          {/* READINESS */}
          <View style={s.readinessCard}>
            <View style={s.readinessHeader}>
              <Text style={s.readinessTitle}>COMPLETION</Text>
              <Text style={s.readinessScore}>
                {readinessScore}/{readinessItems.length}
              </Text>
            </View>
            <View style={s.readinessTrack}>
              <View style={[s.readinessFill, {
                width: `${(readinessScore / readinessItems.length) * 100}%`,
              }]} />
            </View>
            <View style={s.checklistRows}>
              {readinessItems.map((item) => (
                <View key={item.label} style={s.checklistRow}>
                  <Ionicons
                    name={item.done ? "checkmark-circle" : "ellipse-outline"}
                    size={16}
                    color={item.done ? T.green : T.textMuted}
                  />
                  <Text style={[s.checklistTxt, item.done && { color: T.text }]}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

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
            <TextInput
              style={s.fieldInput}
              placeholder="Enter author name..."
              placeholderTextColor={T.textMuted}
              value={authorName}
              onChangeText={setAuthorName}
            />
          ) : (
            <View style={s.lockedField}>
              <Ionicons name="person-circle-outline" size={18} color={T.accent} />
              <Text style={s.lockedFieldTxt}>{authorName || "Loading..."}</Text>
              <View style={[s.lockedBadge, { backgroundColor: T.accentDim }]}>
                <Ionicons name="lock-closed" size={10} color={T.accent} />
                <Text style={[s.lockedBadgeTxt, { color: T.accent }]}>Auto-filled</Text>
              </View>
            </View>
          )}

          {/* COVER */}
          <Text style={s.fieldLabel}>BOOK COVER</Text>
          <View style={s.coverUrlRow}>
            <Ionicons name="link-outline" size={16} color={T.textMuted} />
            <TextInput
              style={s.coverUrlInput}
              placeholder="Paste cover URL..."
              placeholderTextColor={T.textMuted}
              value={coverUrl}
              onChangeText={(t) => { setCoverUrl(t); setCoverLocalUri(null); }}
              autoCapitalize="none"
              keyboardType="url"
            />
            {coverUrl.length > 0 && (
              <TouchableOpacity onPress={() => setCoverUrl("")}>
                <Ionicons name="close-circle" size={18} color={T.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={s.coverPickerBtn} onPress={pickCover}>
            {finalCover ? (
              <View style={s.coverPreviewWrap}>
                <Image
                  source={{ uri: finalCover }}
                  style={s.coverPreviewImg}
                  resizeMode="cover"
                />
                <View style={s.coverPreviewOverlay}>
                  <Ionicons name="camera-outline" size={20} color="#fff" />
                  <Text style={s.coverPreviewOverlayTxt}>Change Cover</Text>
                </View>
              </View>
            ) : (
              <View style={[s.coverEmpty, { backgroundColor: T.ui }]}>
                <Ionicons name="image-outline" size={34} color={T.textMuted} />
                <Text style={s.coverEmptyTxt}>Upload Cover from Gallery</Text>
                <Text style={s.coverEmptyHint}>JPG or PNG · 2:3 ratio recommended</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* GENRE */}
          <Text style={s.fieldLabel}>GENRE *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
            placeholder="Write a compelling description..."
            placeholderTextColor={T.textMuted}
            multiline
            value={description}
            onChangeText={setDescription}
            maxLength={1000}
            textAlignVertical="top"
          />
          <Text style={s.charCount}>{description.length}/1000</Text>

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
                <Ionicons
                  name="warning-outline"
                  size={20}
                  color={isMature ? T.red : T.textMuted}
                />
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
              <MaterialCommunityIcons name="shield-check" size={22} color={T.accent} />
              <Text style={s.legalHeaderTxt}>INTELLECTUAL PROPERTY GUARD</Text>
            </View>
            <Text style={s.legalBody}>
              By submitting, you declare this is your original work or you hold
              the rights to publish it. Submitting plagiarised content is a
              criminal offence under the Nigerian Copyright Act 2022. You grant
              Writha a non-exclusive licence to distribute your work. You retain
              full ownership and earn 80% of all sales.
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
      </ScrollView>

      {/* FOOTER */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={s.previewBtn}
          onPress={() => router.push({
            pathname: "/publish/preview" as any,
            params: { title, authorName, genre: finalGenre },
          })}
        >
          <Ionicons name="eye-outline" size={16} color={T.accent} />
          <Text style={[s.previewBtnTxt, { color: T.accent }]}>PREVIEW</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.submitBtn, { backgroundColor: T.accent }, !canSubmit && { opacity: 0.4 }]}
          onPress={handleSubmit}
          disabled={!canSubmit || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="rocket-outline" size={16} color="#000" />
              <Text style={s.submitBtnTxt}>SUBMIT FOR REVIEW</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (T: typeof DARK_THEME | typeof LIGHT_THEME) => StyleSheet.create({
  container:            { flex: 1, backgroundColor: T.bg },
  header:               { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: T.ui2 },
  backBtn:              { width: 40, height: 40, borderRadius: 12, backgroundColor: T.ui, justifyContent: "center", alignItems: "center" },
  themeBtn:             { width: 40, height: 40, borderRadius: 12, backgroundColor: T.ui, justifyContent: "center", alignItems: "center" },
  headerTitle:          { color: T.accent, fontSize: 13, fontWeight: "900", letterSpacing: 3 },
  summaryStrip:         { backgroundColor: T.ui, paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.ui2, gap: 4 },
  summaryTxt:           { color: T.textMuted, fontSize: 11 },
  summaryStats:         { flexDirection: "row", alignItems: "center", gap: 6 },
  summaryStat:          { fontSize: 11, fontWeight: "800" },
  summarySep:           { color: T.textMuted, fontSize: 11 },
  pane:                 { padding: 20, gap: 4 },
  readinessCard:        { backgroundColor: T.ui, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: T.ui2, marginBottom: 16 },
  readinessHeader:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  readinessTitle:       { color: T.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  readinessScore:       { color: T.text, fontWeight: "900", fontSize: 14 },
  readinessTrack:       { height: 4, backgroundColor: T.ui2, borderRadius: 2, overflow: "hidden", marginBottom: 14 },
  readinessFill:        { height: "100%", backgroundColor: T.green, borderRadius: 2 },
  checklistRows:        { gap: 10 },
  checklistRow:         { flexDirection: "row", alignItems: "center", gap: 8 },
  checklistTxt:         { color: T.textMuted, fontSize: 12 },
  fieldLabel:           { color: T.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 8, marginTop: 16 },
  fieldInput:           { backgroundColor: T.ui, borderRadius: 12, padding: 14, color: T.text, fontSize: 14, borderWidth: 1, borderColor: T.ui2 },
  titleInput:           { backgroundColor: T.ui, borderRadius: 14, padding: 16, color: T.text, fontSize: 22, fontWeight: "900", borderWidth: 1, borderColor: T.ui2 },
  charCount:            { color: T.textMuted, fontSize: 10, textAlign: "right", marginTop: 4 },
  lockedField:          { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.ui, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: T.ui2 },
  lockedFieldTxt:       { flex: 1, color: T.text, fontSize: 14, fontWeight: "700" },
  lockedBadge:          { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  lockedBadgeTxt:       { fontSize: 9, fontWeight: "900" },
  coverUrlRow:          { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.ui, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: T.ui2, marginBottom: 10 },
  coverUrlInput:        { flex: 1, color: T.text, fontSize: 13 },
  coverPickerBtn:       { borderRadius: 16, overflow: "hidden", borderWidth: 1.5, borderColor: T.ui2, borderStyle: "dashed", marginBottom: 4 },
  coverPreviewWrap:     { width: "100%", height: 200, position: "relative" },
  coverPreviewImg:      { width: "100%", height: "100%" },
  coverPreviewOverlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", gap: 6 },
  coverPreviewOverlayTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  coverEmpty:           { height: 130, justifyContent: "center", alignItems: "center", gap: 8 },
  coverEmptyTxt:        { color: T.textMuted, fontWeight: "800", fontSize: 13 },
  coverEmptyHint:       { color: T.ui3, fontSize: 10 },
  genreRow:             { flexDirection: "row", gap: 8, paddingBottom: 4, marginBottom: 4 },
  genrePill:            { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: T.ui, borderWidth: 1, borderColor: T.ui2 },
  genrePillActive:      { backgroundColor: T.accent, borderColor: T.accent },
  genrePillTxt:         { color: T.textMuted, fontWeight: "700", fontSize: 12 },
  genrePillTxtActive:   { color: "#000" },
  tagInputRow:          { flexDirection: "row", gap: 10, marginBottom: 10 },
  tagInput:             { flex: 1, backgroundColor: T.ui, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: T.text, fontSize: 14, borderWidth: 1, borderColor: T.ui2 },
  tagAddBtn:            { width: 46, height: 46, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  tagCloud:             { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  tagPill:              { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: T.accentDim, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: T.accent + "40" },
  tagPillTxt:           { color: T.accent, fontSize: 12, fontWeight: "700" },
  synopsisInput:        { backgroundColor: T.ui, borderRadius: 14, padding: 14, color: T.text, fontSize: 14, minHeight: 120, borderWidth: 1, borderColor: T.ui2, lineHeight: 22 },
  sectionLabel:         { color: T.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginTop: 20, marginBottom: 12 },
  toggleCard:           { flexDirection: "row", alignItems: "center", backgroundColor: T.ui, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: T.ui2 },
  toggleLeft:           { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  toggleIcon:           { width: 42, height: 42, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  toggleTitle:          { color: T.text, fontWeight: "800", fontSize: 14 },
  toggleSub:            { color: T.textMuted, fontSize: 11, marginTop: 2 },
  priceRow:             { flexDirection: "row", alignItems: "center", backgroundColor: T.ui, borderRadius: 14, padding: 14, marginTop: 10, borderWidth: 1, borderColor: T.ui2, gap: 8 },
  currencySymbol:       { color: T.accent, fontSize: 24, fontWeight: "900" },
  priceInput:           { flex: 1, color: T.text, fontSize: 28, fontWeight: "900" },
  revenueNote:          { fontSize: 11, fontWeight: "700" },
  legalCard:            { backgroundColor: T.ui, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: T.ui2 },
  legalHeader:          { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  legalHeaderTxt:       { color: T.accent, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  legalBody:            { color: T.textMuted, fontSize: 12, lineHeight: 20 },
  agreeRow:             { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: T.ui2 },
  agreeCheckbox:        { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: T.textMuted, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  agreeCheckboxActive:  { backgroundColor: T.accent, borderColor: T.accent },
  agreeTxt:             { flex: 1, color: T.textMuted, fontSize: 12, lineHeight: 18 },
  footer:               { position: "absolute", bottom: 0, width: "100%", flexDirection: "row", padding: 16, gap: 12, backgroundColor: T.ui, borderTopWidth: 1, borderTopColor: T.ui2 },
  previewBtn:           { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 16, borderRadius: 16, backgroundColor: T.bg, borderWidth: 1, borderColor: T.accent + "40" },
  previewBtnTxt:        { fontWeight: "900", fontSize: 12 },
  submitBtn:            { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 16 },
  submitBtnTxt:         { color: "#000", fontWeight: "900", fontSize: 12 },
});