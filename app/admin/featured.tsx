import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Image, StatusBar, ActivityIndicator,
  Platform, Alert,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot,
  updateDoc, doc, serverTimestamp, orderBy,
} from "firebase/firestore";

const THEME = {
  bg: "#0F071A", ui: "#1E1135", ui2: "#2D1B4D",
  accent: "#FFD700", purple: "#6D28D9", purpleLight: "#A78BFA",
  text: "#E2E8F0", textMuted: "#94A3B8",
  green: "#22C55E", red: "#EF4444", blue: "#38BDF8",
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

type FeaturedSlot = "hero" | "trending" | "editors_pick" | "new_arrival" | null;

const FEATURED_SLOTS: { key: FeaturedSlot; label: string; icon: string; color: string; desc: string }[] = [
  { key: "hero",         label: "Hero Banner",    icon: "star",           color: THEME.accent,  desc: "Top of home screen" },
  { key: "trending",     label: "Trending",       icon: "trending-up",    color: THEME.red,     desc: "Trending section"   },
  { key: "editors_pick", label: "Editor's Pick",  icon: "ribbon",         color: THEME.purple,  desc: "Curated selection"  },
  { key: "new_arrival",  label: "New Arrival",    icon: "sparkles",       color: THEME.blue,    desc: "New books section"  },
];

export default function FeaturedScreen() {
  const router = useRouter();

  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState("");
  const [allBooks,       setAllBooks]       = useState<any[]>([]);
  const [featuredBooks,  setFeaturedBooks]  = useState<any[]>([]);
  const [selectedSlot,   setSelectedSlot]   = useState<FeaturedSlot>("hero");
  const [activeTab,      setActiveTab]      = useState<"featured" | "browse">("featured");

  // ── LOAD PUBLISHED BOOKS ─────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "books"), where("status", "==", "published")),
      (snap) => {
        const books = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAllBooks(books);
        setFeaturedBooks(books.filter((b: any) => b.featuredSlot));
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // ── FEATURE A BOOK ───────────────────────────────────────────────
  const featureBook = (book: any) => {
    if (!selectedSlot) return;
    const slotLabel = FEATURED_SLOTS.find((s) => s.key === selectedSlot)?.label;

    // Check if slot already taken
    const existing = featuredBooks.find((b) => b.featuredSlot === selectedSlot);

    showAlert(
      "Feature This Book",
      existing
        ? `"${existing.title}" is currently in ${slotLabel}. Replace it with "${book.title}"?`
        : `Add "${book.title}" to ${slotLabel}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: existing ? "Replace" : "Feature",
          onPress: async () => {
            try {
              // Remove slot from existing book if any
              if (existing && existing.id !== book.id) {
                await updateDoc(doc(db, "books", existing.id), {
                  featuredSlot: null,
                  featuredAt:   null,
                });
              }
              // Set new featured book
              await updateDoc(doc(db, "books", book.id), {
                featuredSlot: selectedSlot,
                featuredAt:   serverTimestamp(),
                isFeatured:   true,
              });
              showAlert("Featured ✅", `"${book.title}" is now in ${slotLabel}.`, [{ text: "OK" }]);
              setActiveTab("featured");
            } catch (e: any) {
              showAlert("Error", e.message, [{ text: "OK" }]);
            }
          },
        },
      ]
    );
  };

  // ── UNFEATURE A BOOK ─────────────────────────────────────────────
  const unfeatureBook = (book: any) => {
    showAlert(
      "Remove from Featured",
      `Remove "${book.title}" from featured?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "books", book.id), {
                featuredSlot: null,
                featuredAt:   null,
                isFeatured:   false,
              });
            } catch (e: any) {
              showAlert("Error", e.message, [{ text: "OK" }]);
            }
          },
        },
      ]
    );
  };

  const filteredBooks = allBooks.filter((b: any) =>
    b.title?.toLowerCase().includes(search.toLowerCase()) ||
    b.authorName?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={THEME.accent} />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={THEME.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FEATURED BOOKS</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* TABS */}
      <View style={styles.tabRow}>
        {(["featured", "browse"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabTxt, activeTab === tab && styles.tabTxtActive]}>
              {tab === "featured" ? "⭐  Currently Featured" : "📚  Browse & Add"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── FEATURED TAB ── */}
      {activeTab === "featured" && (
        <FlatList
          data={FEATURED_SLOTS}
          keyExtractor={(item) => item.key || "null"}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item: slot }) => {
            const featured = featuredBooks.find((b) => b.featuredSlot === slot.key);
            return (
              <View style={[styles.slotCard, { borderColor: slot.color + "30" }]}>
                {/* Slot header */}
                <View style={styles.slotHeader}>
                  <View style={[styles.slotIconCircle, { backgroundColor: slot.color + "20" }]}>
                    <Ionicons name={slot.icon as any} size={18} color={slot.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.slotTitle, { color: slot.color }]}>{slot.label}</Text>
                    <Text style={styles.slotDesc}>{slot.desc}</Text>
                  </View>
                  {featured && (
                    <TouchableOpacity onPress={() => unfeatureBook(featured)}>
                      <Ionicons name="close-circle" size={22} color={THEME.red} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Featured book or empty */}
                {featured ? (
                  <View style={styles.featuredBookRow}>
                    <Image
                      source={{ uri: featured.coverUrl || featured.cover || "https://picsum.photos/60/90" }}
                      style={styles.featuredCover}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.featuredTitle} numberOfLines={2}>{featured.title}</Text>
                      <Text style={styles.featuredAuthor}>{featured.authorName}</Text>
                      <View style={[styles.activeBadge, { backgroundColor: THEME.green + "20" }]}>
                        <View style={[styles.activeDot, { backgroundColor: THEME.green }]} />
                        <Text style={[styles.activeTxt, { color: THEME.green }]}>Live</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.emptySlot}
                    onPress={() => { setSelectedSlot(slot.key); setActiveTab("browse"); }}
                  >
                    <Ionicons name="add-circle-outline" size={20} color={slot.color} />
                    <Text style={[styles.emptySlotTxt, { color: slot.color }]}>
                      Add a book to this slot
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}

      {/* ── BROWSE TAB ── */}
      {activeTab === "browse" && (
        <View style={{ flex: 1 }}>
          {/* Slot selector */}
          <View style={styles.slotSelector}>
            <Text style={styles.slotSelectorLabel}>FEATURING IN:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.slotPillRow}>
                {FEATURED_SLOTS.map((slot) => (
                  <TouchableOpacity
                    key={slot.key}
                    style={[styles.slotPill, {
                      backgroundColor: selectedSlot === slot.key ? slot.color : THEME.ui,
                      borderColor:     selectedSlot === slot.key ? slot.color : THEME.ui2,
                    }]}
                    onPress={() => setSelectedSlot(slot.key)}
                  >
                    <Text style={[styles.slotPillTxt, {
                      color: selectedSlot === slot.key ? "#000" : THEME.textMuted,
                    }]}>
                      {slot.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Search */}
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={THEME.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search books or authors..."
              placeholderTextColor={THEME.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <FlatList
            data={filteredBooks}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            renderItem={({ item }) => {
              const isAlreadyFeatured = !!item.featuredSlot;
              const isInSelectedSlot  = item.featuredSlot === selectedSlot;
              return (
                <View style={[styles.bookRow, isInSelectedSlot && { borderColor: THEME.accent + "50" }]}>
                  <Image
                    source={{ uri: item.coverUrl || item.cover || "https://picsum.photos/50/75" }}
                    style={styles.bookCover}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.bookAuthor}>{item.authorName}</Text>
                    {isAlreadyFeatured && (
                      <Text style={[styles.featuredTag, { color: THEME.accent }]}>
                        ⭐ In {FEATURED_SLOTS.find((s) => s.key === item.featuredSlot)?.label}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.featureBtn, {
                      backgroundColor: isInSelectedSlot ? THEME.green : THEME.accent,
                    }]}
                    onPress={() => featureBook(item)}
                  >
                    <Text style={styles.featureBtnTxt}>
                      {isInSelectedSlot ? "Current" : "Feature"}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyTxt}>No published books found</Text>
            }
          />
        </View>
      )}
    </View>
  );
}

// Missing import for ScrollView in browse tab
import { ScrollView } from "react-native";

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: THEME.bg },
  loader:           { flex: 1, backgroundColor: THEME.bg, justifyContent: "center", alignItems: "center" },
  header:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  backBtn:          { width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  headerTitle:      { color: THEME.accent, fontSize: 14, fontWeight: "900", letterSpacing: 3 },
  tabRow:           { flexDirection: "row", margin: 16, backgroundColor: THEME.ui, borderRadius: 14, padding: 4, gap: 4 },
  tab:              { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  tabActive:        { backgroundColor: THEME.accent },
  tabTxt:           { color: THEME.textMuted, fontSize: 12, fontWeight: "800" },
  tabTxtActive:     { color: "#000" },
  slotCard:         { backgroundColor: THEME.ui, borderRadius: 20, padding: 16, borderWidth: 1 },
  slotHeader:       { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  slotIconCircle:   { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  slotTitle:        { fontSize: 13, fontWeight: "900" },
  slotDesc:         { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  featuredBookRow:  { flexDirection: "row", gap: 12, alignItems: "center" },
  featuredCover:    { width: 50, height: 70, borderRadius: 8, borderWidth: 1, borderColor: THEME.ui2 },
  featuredTitle:    { color: THEME.text, fontSize: 13, fontWeight: "800" },
  featuredAuthor:   { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  activeBadge:      { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  activeDot:        { width: 6, height: 6, borderRadius: 3 },
  activeTxt:        { fontSize: 10, fontWeight: "800" },
  emptySlot:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderWidth: 1, borderStyle: "dashed", borderColor: THEME.ui2, borderRadius: 12 },
  emptySlotTxt:     { fontSize: 13, fontWeight: "700" },
  slotSelector:     { paddingHorizontal: 16, paddingVertical: 10 },
  slotSelectorLabel:{ color: THEME.accent, fontSize: 9, fontWeight: "900", letterSpacing: 2, marginBottom: 8 },
  slotPillRow:      { flexDirection: "row", gap: 8 },
  slotPill:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  slotPillTxt:      { fontSize: 11, fontWeight: "800" },
  searchRow:        { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginBottom: 4, backgroundColor: THEME.ui, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: THEME.ui2 },
  searchInput:      { flex: 1, color: THEME.text, fontSize: 14 },
  bookRow:          { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: THEME.ui, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: THEME.ui2 },
  bookCover:        { width: 45, height: 65, borderRadius: 8 },
  bookTitle:        { color: THEME.text, fontSize: 13, fontWeight: "800" },
  bookAuthor:       { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  featuredTag:      { fontSize: 10, fontWeight: "700", marginTop: 4 },
  featureBtn:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  featureBtnTxt:    { color: "#000", fontWeight: "900", fontSize: 11 },
  emptyTxt:         { color: THEME.textMuted, fontSize: 13, textAlign: "center", marginTop: 40 },
});