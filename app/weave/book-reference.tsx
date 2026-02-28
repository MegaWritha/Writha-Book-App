import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, StatusBar, ActivityIndicator, Platform, Alert,
  Dimensions, FlatList,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot, addDoc,
  serverTimestamp, getDocs, limit,
} from "firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

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

export interface BookReference {
  id:           string;
  title:        string;
  author:       string;
  year?:        string;
  genre?:       string;
  publisher?:   string;
  isOnPlatform: boolean;
  coverUrl?:    string;
  description?: string;
}

interface Props {
  onSelect: (book: BookReference) => void;
  onClose:  () => void;
}

export default function BookReferenceScreen({ onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets();

  const [isDark,         setIsDark]         = useState(true);
  const [searchQuery,    setSearchQuery]     = useState("");
  const [searchResults,  setSearchResults]   = useState<any[]>([]);
  const [searching,      setSearching]       = useState(false);
  const [activeTab,      setActiveTab]       = useState<"search" | "manual">("search");

  // Manual reference form
  const [refTitle,       setRefTitle]        = useState("");
  const [refAuthor,      setRefAuthor]       = useState("");
  const [refYear,        setRefYear]         = useState("");
  const [refGenre,       setRefGenre]        = useState("");
  const [refPublisher,   setRefPublisher]    = useState("");
  const [refDescription, setRefDescription]  = useState("");
  const [saving,         setSaving]          = useState(false);

  const T = isDark ? DARK_THEME : LIGHT_THEME;
  const s = makeStyles(T);

  // ── SEARCH ON-PLATFORM BOOKS ─────────────────────────────────────
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        // Search published books on platform
        const snap = await getDocs(
          query(
            collection(db, "books"),
            where("status", "==", "published"),
            limit(20)
          )
        );

        const books = snap.docs
          .map((d) => ({ id: d.id, ...d.data() })) as any[];

        // Client-side filter by title or author
        const q = searchQuery.toLowerCase();
        const filtered = books.filter((b) =>
          b.title?.toLowerCase().includes(q) ||
          b.authorName?.toLowerCase().includes(q)
        );

        // Also search existing book_references
        const refSnap = await getDocs(
          query(
            collection(db, "book_references"),
            limit(20)
          )
        );
        const refs = refSnap.docs
          .map((d) => ({ id: d.id, ...d.data(), isOnPlatform: false })) as any[];
        const filteredRefs = refs.filter((b) =>
          b.title?.toLowerCase().includes(q) ||
          b.author?.toLowerCase().includes(q)
        );

        setSearchResults([
          ...filtered.map((b) => ({ ...b, isOnPlatform: true })),
          ...filteredRefs,
        ]);
      } catch (e) {
        console.error(e);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── SAVE MANUAL REFERENCE ────────────────────────────────────────
  const handleSaveReference = async () => {
    if (!refTitle.trim()) {
      showAlert("Required", "Book title is required.", [{ text: "OK" }]);
      return;
    }
    if (!refAuthor.trim()) {
      showAlert("Required", "Author name is required.", [{ text: "OK" }]);
      return;
    }

    setSaving(true);
    try {
      // Check if reference already exists
      const existing = await getDocs(
        query(
          collection(db, "book_references"),
          where("titleLower", "==", refTitle.trim().toLowerCase()),
          where("authorLower", "==", refAuthor.trim().toLowerCase()),
          limit(1)
        )
      );

      let refId: string;
      let refData: BookReference;

      if (!existing.empty) {
        // Use existing reference
        refId   = existing.docs[0].id;
        refData = { id: refId, ...existing.docs[0].data() } as BookReference;
      } else {
        // Create new reference
        const docRef = await addDoc(collection(db, "book_references"), {
          title:        refTitle.trim(),
          titleLower:   refTitle.trim().toLowerCase(),
          author:       refAuthor.trim(),
          authorLower:  refAuthor.trim().toLowerCase(),
          year:         refYear.trim(),
          genre:        refGenre.trim(),
          publisher:    refPublisher.trim(),
          description:  refDescription.trim(),
          isOnPlatform: false,
          weaveCount:   0,
          createdAt:    serverTimestamp(),
        });
        refId   = docRef.id;
        refData = {
          id:           refId,
          title:        refTitle.trim(),
          author:       refAuthor.trim(),
          year:         refYear.trim(),
          genre:        refGenre.trim(),
          publisher:    refPublisher.trim(),
          description:  refDescription.trim(),
          isOnPlatform: false,
        };
      }

      onSelect(refData);
    } catch (e: any) {
      showAlert("Error", e.message, [{ text: "OK" }]);
    } finally {
      setSaving(false);
    }
  };

  // ── RENDER SEARCH RESULT ─────────────────────────────────────────
  const renderResult = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={s.resultRow}
      onPress={() => onSelect({
        id:           item.id,
        title:        item.title || item.bookTitle,
        author:       item.authorName || item.author,
        isOnPlatform: item.isOnPlatform,
        coverUrl:     item.coverUrl || item.cover,
        genre:        item.genre,
        year:         item.year,
      })}
      activeOpacity={0.8}
    >
      <View style={[s.resultCover, { backgroundColor: T.ui3 }]}>
        <Ionicons name="book" size={20} color={T.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.resultTitleRow}>
          <Text style={s.resultTitle} numberOfLines={1}>
            {item.title || item.bookTitle}
          </Text>
          {item.isOnPlatform && (
            <View style={s.onPlatformBadge}>
              <Ionicons name="checkmark-circle" size={11} color={T.green} />
              <Text style={[s.onPlatformTxt, { color: T.green }]}>On Writha</Text>
            </View>
          )}
        </View>
        <Text style={s.resultAuthor}>
          {item.authorName || item.author}
          {item.year ? ` · ${item.year}` : ""}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
    </TouchableOpacity>
  );

  const GENRES = [
    "Fiction", "Non-Fiction", "Poetry", "Drama", "Romance",
    "Historical", "Biography", "Children", "Sci-Fi", "Other",
  ];

  return (
    <View style={s.container}>
      <StatusBar barStyle={T.statusBar} />
      <LinearGradient
        colors={T.mode === "dark" ? ["#0F071A", T.bg] : ["#EDE8F8", T.bg]}
        style={StyleSheet.absoluteFill}
      />

      {/* HEADER */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={20} color={T.accent} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>SELECT BOOK</Text>
        <TouchableOpacity style={s.themeBtn} onPress={() => setIsDark(!isDark)}>
          <Ionicons
            name={isDark ? "sunny-outline" : "moon-outline"}
            size={18}
            color={T.accent}
          />
        </TouchableOpacity>
      </View>

      {/* LEGAL NOTICE */}
      <View style={s.legalNotice}>
        <MaterialCommunityIcons name="shield-check-outline" size={16} color={T.accent} />
        <Text style={s.legalNoticeTxt}>
          Weaves are original literary commentary. You do not need permission to
          analyse, critique or discuss any published work.
        </Text>
      </View>

      {/* TABS */}
      <View style={s.tabRow}>
        <TouchableOpacity
          style={[s.tab, activeTab === "search" && s.tabActive]}
          onPress={() => setActiveTab("search")}
        >
          <Ionicons
            name="search"
            size={14}
            color={activeTab === "search" ? "#000" : T.textMuted}
          />
          <Text style={[s.tabTxt, activeTab === "search" && s.tabTxtActive]}>
            Search Books
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === "manual" && s.tabActive]}
          onPress={() => setActiveTab("manual")}
        >
          <Ionicons
            name="pencil"
            size={14}
            color={activeTab === "manual" ? "#000" : T.textMuted}
          />
          <Text style={[s.tabTxt, activeTab === "manual" && s.tabTxtActive]}>
            Not on Writha
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── SEARCH TAB ── */}
      {activeTab === "search" && (
        <View style={{ flex: 1 }}>
          <View style={s.searchRow}>
            <Ionicons name="search-outline" size={16} color={T.textMuted} />
            <TextInput
              style={s.searchInput}
              placeholder="Search by title or author..."
              placeholderTextColor={T.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searching && (
              <ActivityIndicator size="small" color={T.accent} />
            )}
            {searchQuery.length > 0 && !searching && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={16} color={T.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {searchResults.length === 0 && searchQuery.length > 1 && !searching ? (
            <View style={s.noResults}>
              <Text style={{ fontSize: 40 }}>📚</Text>
              <Text style={s.noResultsTitle}>Not found on Writha</Text>
              <Text style={s.noResultsSub}>
                Switch to the "Not on Writha" tab to reference this book for your Weave.
              </Text>
              <TouchableOpacity
                style={[s.switchTabBtn, { backgroundColor: T.accent }]}
                onPress={() => {
                  setRefTitle(searchQuery);
                  setActiveTab("manual");
                }}
              >
                <Text style={s.switchTabBtnTxt}>Reference This Book</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={renderResult}
              contentContainerStyle={{ padding: 16, gap: 8 }}
              ListHeaderComponent={
                searchResults.length > 0 ? (
                  <Text style={s.resultsHeader}>
                    {searchResults.filter(r => r.isOnPlatform).length} on Writha ·{" "}
                    {searchResults.filter(r => !r.isOnPlatform).length} referenced
                  </Text>
                ) : null
              }
              ListEmptyComponent={
                searchQuery.length < 2 ? (
                  <View style={s.searchPrompt}>
                    <MaterialCommunityIcons
                      name="book-search-outline"
                      size={48}
                      color={T.textMuted}
                    />
                    <Text style={s.searchPromptTxt}>
                      Search for any book — on Writha or not
                    </Text>
                  </View>
                ) : null
              }
            />
          )}
        </View>
      )}

      {/* ── MANUAL REFERENCE TAB ── */}
      {activeTab === "manual" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, gap: 4, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Disclaimer */}
          <View style={s.disclaimerCard}>
            <Text style={s.disclaimerTitle}>📋 Literary Reference</Text>
            <Text style={s.disclaimerBody}>
              You are creating a reference for literary discussion purposes only.
              Writha does not host, distribute or claim any rights to this work.
              Your Weave will carry the following notice:{"\n\n"}
              <Text style={{ fontStyle: "italic", color: T.accent }}>
                "This is an independent critical work. Writha is not affiliated
                with the author or publisher of the referenced work."
              </Text>
            </Text>
          </View>

          <Text style={s.fieldLabel}>BOOK TITLE *</Text>
          <TextInput
            style={s.fieldInput}
            placeholder="e.g. Things Fall Apart"
            placeholderTextColor={T.textMuted}
            value={refTitle}
            onChangeText={setRefTitle}
          />

          <Text style={s.fieldLabel}>AUTHOR *</Text>
          <TextInput
            style={s.fieldInput}
            placeholder="e.g. Chinua Achebe"
            placeholderTextColor={T.textMuted}
            value={refAuthor}
            onChangeText={setRefAuthor}
          />

          <Text style={s.fieldLabel}>YEAR PUBLISHED</Text>
          <TextInput
            style={s.fieldInput}
            placeholder="e.g. 1958"
            placeholderTextColor={T.textMuted}
            value={refYear}
            onChangeText={setRefYear}
            keyboardType="numeric"
            maxLength={4}
          />

          <Text style={s.fieldLabel}>GENRE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.genreRow}>
              {GENRES.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[s.genrePill, refGenre === g && s.genrePillActive]}
                  onPress={() => setRefGenre(g)}
                >
                  <Text style={[
                    s.genrePillTxt,
                    refGenre === g && s.genrePillTxtActive,
                  ]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={s.fieldLabel}>PUBLISHER</Text>
          <TextInput
            style={s.fieldInput}
            placeholder="e.g. Heinemann"
            placeholderTextColor={T.textMuted}
            value={refPublisher}
            onChangeText={setRefPublisher}
          />

          <Text style={s.fieldLabel}>BRIEF DESCRIPTION</Text>
          <TextInput
            style={[s.fieldInput, { minHeight: 80 }]}
            placeholder="A short description of the book..."
            placeholderTextColor={T.textMuted}
            value={refDescription}
            onChangeText={setRefDescription}
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[s.saveRefBtn, { backgroundColor: T.accent }, saving && { opacity: 0.6 }]}
            onPress={handleSaveReference}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="bookmark-outline" size={16} color="#000" />
                <Text style={s.saveRefBtnTxt}>USE THIS BOOK</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (T: typeof DARK_THEME | typeof LIGHT_THEME) => StyleSheet.create({
  container:          { flex: 1, backgroundColor: T.bg },
  header:             { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: T.ui2 },
  closeBtn:           { width: 40, height: 40, borderRadius: 12, backgroundColor: T.ui, justifyContent: "center", alignItems: "center" },
  themeBtn:           { width: 40, height: 40, borderRadius: 12, backgroundColor: T.ui, justifyContent: "center", alignItems: "center" },
  headerTitle:        { color: T.accent, fontSize: 13, fontWeight: "900", letterSpacing: 3 },
  legalNotice:        { flexDirection: "row", alignItems: "flex-start", gap: 10, margin: 16, backgroundColor: T.accentDim, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: T.accent + "30" },
  legalNoticeTxt:     { color: T.textMuted, fontSize: 12, flex: 1, lineHeight: 18 },
  tabRow:             { flexDirection: "row", marginHorizontal: 16, marginBottom: 12, backgroundColor: T.ui, borderRadius: 14, padding: 4, gap: 4 },
  tab:                { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
  tabActive:          { backgroundColor: T.accent },
  tabTxt:             { color: T.textMuted, fontSize: 12, fontWeight: "800" },
  tabTxtActive:       { color: "#000" },
  searchRow:          { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginBottom: 8, backgroundColor: T.ui, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: T.ui2 },
  searchInput:        { flex: 1, color: T.text, fontSize: 14 },
  resultRow:          { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.ui, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: T.ui2 },
  resultCover:        { width: 44, height: 60, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  resultTitleRow:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  resultTitle:        { color: T.text, fontWeight: "800", fontSize: 14, flex: 1 },
  resultAuthor:       { color: T.textMuted, fontSize: 12 },
  onPlatformBadge:    { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: T.green + "20", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  onPlatformTxt:      { fontSize: 9, fontWeight: "900" },
  resultsHeader:      { color: T.textMuted, fontSize: 11, marginBottom: 8 },
  noResults:          { alignItems: "center", paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  noResultsTitle:     { color: T.text, fontSize: 16, fontWeight: "900" },
  noResultsSub:       { color: T.textMuted, fontSize: 13, textAlign: "center", lineHeight: 20 },
  switchTabBtn:       { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  switchTabBtnTxt:    { color: "#000", fontWeight: "900", fontSize: 13 },
  searchPrompt:       { alignItems: "center", paddingTop: 80, gap: 12 },
  searchPromptTxt:    { color: T.textMuted, fontSize: 14, textAlign: "center" },
  disclaimerCard:     { backgroundColor: T.ui, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: T.ui2, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: T.accent },
  disclaimerTitle:    { color: T.text, fontWeight: "900", fontSize: 14, marginBottom: 10 },
  disclaimerBody:     { color: T.textMuted, fontSize: 12, lineHeight: 20 },
  fieldLabel:         { color: T.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 8, marginTop: 16 },
  fieldInput:         { backgroundColor: T.ui, borderRadius: 12, padding: 14, color: T.text, fontSize: 14, borderWidth: 1, borderColor: T.ui2 },
  genreRow:           { flexDirection: "row", gap: 8, paddingBottom: 4 },
  genrePill:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: T.ui, borderWidth: 1, borderColor: T.ui2 },
  genrePillActive:    { backgroundColor: T.accent, borderColor: T.accent },
  genrePillTxt:       { color: T.textMuted, fontWeight: "700", fontSize: 12 },
  genrePillTxtActive: { color: "#000" },
  saveRefBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 16, marginTop: 20 },
  saveRefBtnTxt:      { color: "#000", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
});