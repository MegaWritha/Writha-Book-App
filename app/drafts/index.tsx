import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, Image, ActivityIndicator, Animated,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { auth, db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot, orderBy,
  deleteDoc, doc, serverTimestamp, setDoc,
} from "firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";

const THEME = {
  bg: "#0A0612",
  ui: "#130D1F",
  ui2: "#1E1535",
  ui3: "#2A1D47",
  accent: "#FFD700",
  accentDim: "rgba(255,215,0,0.1)",
  purple: "#6D28D9",
  purpleLight: "#A78BFA",
  text: "#EDE8F5",
  textMuted: "#7A6E8A",
  green: "#22C55E",
  red: "#EF4444",
  blue: "#38BDF8",
};

type SortOrder = "recent" | "manual";

interface Draft {
  id: string;
  title?: string;
  cover?: string;
  coverUrl?: string;
  genre?: string;
  description?: string;
  content?: string;
  mode?: "write" | "upload";
  fileName?: string;
  status?: string;
  authorId?: string;
  updatedAt?: any;
  createdAt?: any;
  wordCount?: number;
  manualOrder?: number;
}

const timeAgo = (ts: any): string => {
  if (!ts) return "";
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

const formatDate = (ts: any): string => {
  if (!ts) return "";
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  return `Draft — ${date.toLocaleDateString("en-GB", { month: "short", day: "numeric" })}`;
};

const getWordCount = (draft: Draft): number => {
  if (draft.wordCount) return draft.wordCount;
  if (draft.content) return draft.content.trim().split(/\s+/).filter(Boolean).length;
  return 0;
};

const getCompletionHints = (draft: Draft): string[] => {
  const hints: string[] = [];
  if (!draft.cover && !draft.coverUrl) hints.push("No cover");
  if (!draft.genre) hints.push("No genre");
  if (!draft.description) hints.push("No synopsis");
  if (draft.mode === "write" && getWordCount(draft) < 500) hints.push("Under 500 words");
  if (draft.mode === "upload" && !draft.fileName) hints.push("No file uploaded");
  return hints;
};

const DraftCard = ({
  draft,
  onPress,
  onDelete,
}: {
  draft: Draft;
  onPress: () => void;
  onDelete: () => void;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const hints = getCompletionHints(draft);
  const wc = getWordCount(draft);
  const cover = draft.coverUrl || draft.cover;
  const hasTitle = !!draft.title?.trim();

  const handlePressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start();
  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.cardCover}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.cardCoverImg} />
          ) : (
            <View style={styles.cardCoverEmpty}>
              <MaterialCommunityIcons name="book-open-page-variant" size={28} color={THEME.ui3} />
            </View>
          )}
          <View style={[
            styles.modeBadge,
            { backgroundColor: draft.mode === "upload" ? THEME.blue + "CC" : THEME.purple + "CC" },
          ]}>
            <Ionicons
              name={draft.mode === "upload" ? "cloud-upload-outline" : "create-outline"}
              size={9}
              color="#fff"
            />
            <Text style={styles.modeBadgeTxt}>
              {draft.mode === "upload" ? "FILE" : "WRITING"}
            </Text>
          </View>
        </View>

        <View style={styles.cardInfo}>
          <View style={styles.cardTitleRow}>
            <Text
              style={[styles.cardTitle, !hasTitle && styles.cardTitleUntitled]}
              numberOfLines={1}
            >
              {hasTitle ? draft.title : "Untitled"}
            </Text>
            <TouchableOpacity
              onPress={onDelete}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.deleteBtn}
            >
              <Ionicons name="trash-outline" size={15} color={THEME.red + "99"} />
            </TouchableOpacity>
          </View>

          <Text style={styles.cardDate}>
            {!hasTitle ? formatDate(draft.createdAt) : timeAgo(draft.updatedAt)}
          </Text>

          <View style={styles.cardMetaRow}>
            {draft.mode === "upload" ? (
              draft.fileName ? (
                <>
                  <Ionicons name="document-text-outline" size={11} color={THEME.textMuted} />
                  <Text style={styles.cardMeta} numberOfLines={1}>{draft.fileName}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="alert-circle-outline" size={11} color={THEME.accent} />
                  <Text style={[styles.cardMeta, { color: THEME.accent }]}>No file yet</Text>
                </>
              )
            ) : (
              <>
                <Ionicons name="reader-outline" size={11} color={THEME.textMuted} />
                <Text style={styles.cardMeta}>{wc.toLocaleString()} words</Text>
              </>
            )}
          </View>

          {hints.length > 0 && (
            <View style={styles.hintsRow}>
              {hints.slice(0, 2).map((hint) => (
                <View key={hint} style={styles.hintChip}>
                  <Text style={styles.hintChipTxt}>{hint}</Text>
                </View>
              ))}
              {hints.length > 2 && (
                <View style={styles.hintChip}>
                  <Text style={styles.hintChipTxt}>+{hints.length - 2}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default function DraftsScreen() {
  const insets = useSafeAreaInsets();
  const user = auth.currentUser;

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [filtered, setFiltered] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("recent");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "books"),
      where("authorId", "==", user.uid),
      where("status", "==", "draft"),
      orderBy("updatedAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Draft));
        setDrafts(data);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [user]);

  useEffect(() => {
    let result = [...drafts];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((d) =>
        (d.title || "untitled").toLowerCase().includes(q) ||
        (d.genre || "").toLowerCase().includes(q)
      );
    }

    if (sortOrder === "manual") {
      result.sort((a, b) => (a.manualOrder ?? 0) - (b.manualOrder ?? 0));
    }

    setFiltered(result);
  }, [drafts, search, sortOrder]);

  const handleNewDraft = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const newId = `draft_${user.uid}_${Date.now()}`;
      await setDoc(doc(db, "books", newId), {
        title: "",
        authorId: user.uid,
        status: "draft",
        mode: "write",
        content: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      router.push({ pathname: "/write/[id]", params: { id: newId } } as any);
    } catch {
      Alert.alert("Error", "Could not create a new draft. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (draft: Draft) => {
    Alert.alert(
      "Delete Draft?",
      `"${draft.title?.trim() || "Untitled"}" will be permanently deleted. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "books", draft.id));
            } catch {
              Alert.alert("Error", "Could not delete this draft.");
            }
          },
        },
      ]
    );
  };

  const handleOpen = (draft: Draft) => {
    router.push({ pathname: "/write/[id]", params: { id: draft.id } } as any);
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <MaterialCommunityIcons name="file-document-edit-outline" size={44} color={THEME.ui3} />
      </View>
      <Text style={styles.emptyTitle}>
        {search.trim() ? "No drafts match your search" : "No drafts yet"}
      </Text>
      <Text style={styles.emptySub}>
        {search.trim()
          ? "Try a different title or genre"
          : "Everything you write or upload lives here until you publish it"}
      </Text>
      {!search.trim() && (
        <TouchableOpacity style={styles.emptyBtn} onPress={handleNewDraft}>
          <MaterialCommunityIcons name="pencil-plus" size={16} color="#000" />
          <Text style={styles.emptyBtnTxt}>Start Writing</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={THEME.accent} size="large" />
        <Text style={{ color: THEME.textMuted, marginTop: 12 }}>Loading drafts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0D0818", "#0A0612"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={THEME.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerEyebrow}>WRITHA STUDIO</Text>
          <Text style={styles.headerTitle}>My Drafts</Text>
        </View>

        <TouchableOpacity
          style={[styles.newBtn, creating && { opacity: 0.6 }]}
          onPress={handleNewDraft}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="pencil-plus" size={16} color="#000" />
              <Text style={styles.newBtnTxt}>New</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={THEME.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search drafts..."
            placeholderTextColor={THEME.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={THEME.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.sortToggle}>
          <TouchableOpacity
            style={[styles.sortBtn, sortOrder === "recent" && styles.sortBtnActive]}
            onPress={() => setSortOrder("recent")}
          >
            <Ionicons
              name="time-outline"
              size={14}
              color={sortOrder === "recent" ? "#000" : THEME.textMuted}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortBtn, sortOrder === "manual" && styles.sortBtnActive]}
            onPress={() => setSortOrder("manual")}
          >
            <MaterialCommunityIcons
              name="drag-horizontal-variant"
              size={14}
              color={sortOrder === "manual" ? "#000" : THEME.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>

      {drafts.length > 0 && (
        <View style={styles.countRow}>
          <Text style={styles.countTxt}>
            {filtered.length} {filtered.length === 1 ? "draft" : "drafts"}
            {search.trim() ? ` matching "${search}"` : ""}
          </Text>
          {sortOrder === "manual" && (
            <Text style={styles.dragHint}>Hold to reorder</Text>
          )}
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DraftCard
            draft={item}
            onPress={() => handleOpen(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          filtered.length === 0 && { flex: 1 },
        ]}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.accent} />
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />

      <View style={{ height: insets.bottom + 20 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  centered: { flex: 1, backgroundColor: THEME.bg, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: THEME.ui2 },
  headerCenter: { flex: 1 },
  headerEyebrow: { color: THEME.accent, fontSize: 9, fontWeight: "900", letterSpacing: 3 },
  headerTitle: { color: THEME.text, fontSize: 22, fontWeight: "900", marginTop: 2 },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: THEME.accent, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  newBtnTxt: { color: "#000", fontWeight: "900", fontSize: 13 },
  searchRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  searchBar: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: THEME.ui, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: THEME.ui2 },
  searchInput: { flex: 1, color: THEME.text, fontSize: 14 },
  sortToggle: { flexDirection: "row", backgroundColor: THEME.ui, borderRadius: 14, borderWidth: 1, borderColor: THEME.ui2, overflow: "hidden" },
  sortBtn: { paddingHorizontal: 13, paddingVertical: 11, justifyContent: "center", alignItems: "center" },
  sortBtnActive: { backgroundColor: THEME.accent },
  countRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 8 },
  countTxt: { color: THEME.textMuted, fontSize: 12, fontWeight: "600" },
  dragHint: { color: THEME.textMuted, fontSize: 11 },
  listContent: { paddingHorizontal: 16, paddingTop: 4 },
  card: { flexDirection: "row", backgroundColor: THEME.ui, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: THEME.ui2 },
  cardCover: { width: 90, height: 130, backgroundColor: THEME.ui2, position: "relative" },
  cardCoverImg: { width: "100%", height: "100%" },
  cardCoverEmpty: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: THEME.ui2 },
  modeBadge: { position: "absolute", bottom: 8, left: 6, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  modeBadgeTxt: { color: "#fff", fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  cardInfo: { flex: 1, padding: 14, justifyContent: "center", gap: 4 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: THEME.text, fontWeight: "800", fontSize: 15, flex: 1, marginRight: 8 },
  cardTitleUntitled: { color: THEME.textMuted, fontStyle: "italic" },
  deleteBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: THEME.red + "15", justifyContent: "center", alignItems: "center" },
  cardDate: { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  cardMeta: { color: THEME.textMuted, fontSize: 11, flex: 1 },
  hintsRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
  hintChip: { backgroundColor: THEME.accent + "18", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: THEME.accent + "30" },
  hintChipTxt: { color: THEME.accent, fontSize: 9, fontWeight: "800" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32, paddingTop: 40 },
  emptyIconWrap: { width: 88, height: 88, borderRadius: 26, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center", marginBottom: 20, borderWidth: 1, borderColor: THEME.ui2 },
  emptyTitle: { color: THEME.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  emptySub: { color: THEME.textMuted, fontSize: 13, textAlign: "center", lineHeight: 20, marginTop: 8 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: THEME.accent, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14, marginTop: 24 },
  emptyBtnTxt: { color: "#000", fontWeight: "900", fontSize: 13 },
});