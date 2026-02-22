import React, { useEffect, useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, StatusBar, Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#0F071A", ui: "#1E1135", ui2: "#2D1B4D",
  accent: "#FFD700", purple: "#6D28D9", purpleLight: "#A78BFA",
  text: "#EDE8F5", textMuted: "#7A6E8A", green: "#22C55E",
};

interface Section {
  index: number;
  title: string;
  content: string;
  wordCount: number;
  readTime: number;
  type: "chapter" | "act" | "part" | "named";
}

export default function ChaptersScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bookId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);

  const [sections, setSections] = useState<Section[]>([]);
  const [bookTitle, setBookTitle] = useState("");
  const [manuscriptMode, setManuscriptMode] = useState<"chapters" | "acts" | "full">("chapters");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookId) return;

    const unsub = onSnapshot(doc(db, "books", bookId), (snap) => {
      if (!snap.exists()) { setLoading(false); return; }

      const data = snap.data();
      setBookTitle(data.title || "");

      const built: Section[] = [];

      // ── CHAPTERS ARRAY ──────────────────────────────────────────────
      if (Array.isArray(data.chapters) && data.chapters.length > 0) {
        setManuscriptMode("chapters");
        data.chapters.forEach((ch: any, i: number) => {
          const content = ch.content || "";
          const words = content.trim() ? content.trim().split(/\s+/).length : 0;
          // Detect if title is a real name (not "Chapter X")
          const rawTitle = ch.title || "";
          const isNumbered = /^(chapter|part|section)\s*\d+/i.test(rawTitle);
          built.push({
            index: i,
            title: rawTitle || `Chapter ${i + 1}`,
            content,
            wordCount: words,
            readTime: Math.max(1, Math.ceil(words / 250)),
            type: isNumbered ? "chapter" : "named",
          });
        });

      // ── ACTS ARRAY ──────────────────────────────────────────────────
      } else if (Array.isArray(data.acts) && data.acts.length > 0) {
        setManuscriptMode("acts");
        data.acts.forEach((act: any, i: number) => {
          const content = act.content || "";
          const words = content.trim() ? content.trim().split(/\s+/).length : 0;
          built.push({
            index: i,
            title: act.title || `Act ${i + 1}`,
            content,
            wordCount: words,
            readTime: Math.max(1, Math.ceil(words / 250)),
            type: "act",
          });
        });

      // ── FULL TEXT — split on headings or double newlines ────────────
      } else if (data.content && typeof data.content === "string") {
        setManuscriptMode("full");
        // Try splitting on markdown headings (## Heading) or ALL CAPS lines
        const headingRegex = /^(#{1,3}\s+.+|[A-Z][A-Z\s]{4,})$/gm;
        const parts = data.content.split(headingRegex).filter(Boolean);

        if (parts.length > 1) {
          // Interleave headings with content
          for (let i = 0; i < parts.length; i += 2) {
            const heading = parts[i]?.replace(/^#+\s*/, "").trim() || `Part ${Math.ceil((i + 1) / 2)}`;
            const content = parts[i + 1] || "";
            const words = content.trim() ? content.trim().split(/\s+/).length : 0;
            built.push({
              index: Math.floor(i / 2),
              title: heading,
              content,
              wordCount: words,
              readTime: Math.max(1, Math.ceil(words / 250)),
              type: "part",
            });
          }
        } else {
          // No headings — treat as single piece
          const words = data.content.trim().split(/\s+/).length;
          built.push({
            index: 0,
            title: data.title || "Full Manuscript",
            content: data.content,
            wordCount: words,
            readTime: Math.max(1, Math.ceil(words / 250)),
            type: "part",
          });
        }
      }

      setSections(built);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [bookId]);

  const totalWords = sections.reduce((a, s) => a + s.wordCount, 0);
  const totalReadTime = sections.reduce((a, s) => a + s.readTime, 0);

  const modeLabel =
    manuscriptMode === "acts" ? "ACTS" :
    sections.some(s => s.type === "named") ? "CHAPTERS & PARTS" :
    "CHAPTERS";

  const typeIcon = (type: Section["type"]) => {
    if (type === "act") return "layers-outline";
    if (type === "named") return "bookmark-outline";
    return "book-outline";
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={THEME.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <LinearGradient
        colors={["#1A0B2E", THEME.bg]}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={THEME.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerSmall}>{modeLabel}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{bookTitle}</Text>
        </View>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* STATS BAR */}
      {sections.length > 0 && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{sections.length}</Text>
            <Text style={styles.statLbl}>
              {manuscriptMode === "acts" ? "Acts" : "Sections"}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{totalWords.toLocaleString()}</Text>
            <Text style={styles.statLbl}>Words</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{totalReadTime}</Text>
            <Text style={styles.statLbl}>Min Read</Text>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {sections.length > 0 ? (
          sections.map((section, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.sectionCard}
              onPress={() =>
                router.push({
                  pathname: "/book/[id]/reader",
                  params: { id: bookId, sectionIndex: section.index },
                } as any)
              }
              activeOpacity={0.85}
            >
              {/* Left — number or icon */}
              <View style={styles.sectionLeft}>
                {section.type === "named" ? (
                  <View style={styles.iconCircle}>
                    <Ionicons name={typeIcon(section.type)} size={16} color={THEME.accent} />
                  </View>
                ) : (
                  <LinearGradient
                    colors={["#FFD700", "#B8860B"]}
                    style={styles.numCircle}
                  >
                    <Text style={styles.numText}>{idx + 1}</Text>
                  </LinearGradient>
                )}
              </View>

              {/* Center — title + meta */}
              <View style={styles.sectionCenter}>
                {/* Show "Chapter X" label only if it's a numbered chapter */}
                {section.type === "chapter" && (
                  <Text style={styles.sectionTypeLabel}>
                    {manuscriptMode === "acts" ? `ACT ${idx + 1}` : `CHAPTER ${idx + 1}`}
                  </Text>
                )}
                {section.type === "act" && (
                  <Text style={styles.sectionTypeLabel}>ACT {idx + 1}</Text>
                )}
                <Text style={styles.sectionTitle} numberOfLines={2}>
                  {section.title}
                </Text>
                <View style={styles.sectionMeta}>
                  <View style={styles.metaPill}>
                    <Ionicons name="reader-outline" size={10} color={THEME.purpleLight} />
                    <Text style={styles.metaPillTxt}>{section.wordCount.toLocaleString()} words</Text>
                  </View>
                  <View style={styles.metaPill}>
                    <Ionicons name="time-outline" size={10} color={THEME.purpleLight} />
                    <Text style={styles.metaPillTxt}>{section.readTime} min</Text>
                  </View>
                </View>
              </View>

              {/* Right — arrow */}
              <Ionicons name="chevron-forward" size={18} color={THEME.ui2} />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="book-open-page-variant-outline" size={60} color={THEME.ui2} />
            <Text style={styles.emptyTitle}>No sections found</Text>
            <Text style={styles.emptySub}>
              This book hasn't been structured into chapters yet.
            </Text>
          </View>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: THEME.bg },
  header: { paddingHorizontal: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.06)", justifyContent: "center", alignItems: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerSmall: { color: THEME.accent, fontSize: 9, fontWeight: "900", letterSpacing: 3 },
  headerTitle: { color: THEME.text, fontSize: 16, fontWeight: "900", marginTop: 3, maxWidth: width * 0.6, textAlign: "center" },
  statsBar: { flexDirection: "row", backgroundColor: THEME.ui, marginHorizontal: 16, borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: THEME.ui2 },
  statItem: { flex: 1, alignItems: "center" },
  statVal: { color: THEME.accent, fontSize: 18, fontWeight: "900" },
  statLbl: { color: THEME.textMuted, fontSize: 9, fontWeight: "700", marginTop: 2 },
  statDivider: { width: 1, backgroundColor: THEME.ui2 },
  list: { paddingHorizontal: 16 },
  sectionCard: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: THEME.ui2, gap: 14 },
  sectionLeft: {},
  numCircle: { width: 40, height: 40, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  numText: { color: "#000", fontWeight: "900", fontSize: 15 },
  iconCircle: { width: 40, height: 40, borderRadius: 13, backgroundColor: "rgba(255,215,0,0.1)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: THEME.accent + "40" },
  sectionCenter: { flex: 1 },
  sectionTypeLabel: { color: THEME.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 1.5, marginBottom: 3 },
  sectionTitle: { color: THEME.text, fontSize: 16, fontWeight: "800", lineHeight: 22 },
  sectionMeta: { flexDirection: "row", gap: 8, marginTop: 6 },
  metaPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: THEME.ui2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  metaPillTxt: { color: THEME.purpleLight, fontSize: 9, fontWeight: "700" },
  emptyState: { alignItems: "center", marginTop: 80, gap: 12 },
  emptyTitle: { color: THEME.text, fontSize: 18, fontWeight: "800" },
  emptySub: { color: THEME.textMuted, fontSize: 13, textAlign: "center", lineHeight: 20, paddingHorizontal: 30 },
});