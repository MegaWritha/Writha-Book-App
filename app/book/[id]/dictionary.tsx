import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

const THEME = {
  bg: "#0F071A", ui: "#1E1135", ui2: "#2D1B4D",
  accent: "#FFD700", purple: "#6D28D9", purpleLight: "#A78BFA",
  text: "#EDE8F5", textMuted: "#7A6E8A", green: "#22C55E", red: "#EF4444",
};

interface DictEntry {
  word: string;
  phonetics: { text?: string; audio?: string }[];
  meanings: {
    partOfSpeech: string;
    definitions: { definition: string; example?: string; synonyms?: string[] }[];
  }[];
}

export default function VanguardDictionary() {
  const { word } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [entry, setEntry] = useState<DictEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedMeaning, setExpandedMeaning] = useState<number | null>(0);

  const searchWord = Array.isArray(word) ? word[0] : word || "";

  useEffect(() => {
    if (!searchWord) { setLoading(false); return; }

    const fetchDefinition = async () => {
      try {
        const res = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(searchWord)}`
        );
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        setEntry(data[0]);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchDefinition();
  }, [searchWord]);

  const phonetic = entry?.phonetics?.find((p) => p.text)?.text || "";

  const POS_COLORS: Record<string, string> = {
    noun: "#38BDF8", verb: THEME.green, adjective: "#F59E0B",
    adverb: "#A78BFA", pronoun: THEME.accent, default: THEME.purpleLight,
  };

  const getPosColor = (pos: string) => POS_COLORS[pos.toLowerCase()] || POS_COLORS.default;

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient
        colors={["#1A0B2E", THEME.bg]}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={THEME.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerSmall}>VANGUARD LEXICON</Text>
          <Text style={styles.wordDisplay}>{searchWord.toUpperCase()}</Text>
          {phonetic ? <Text style={styles.phonetic}>{phonetic}</Text> : null}
        </View>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={THEME.accent} size="large" />
          <Text style={{ color: THEME.textMuted, marginTop: 12 }}>Looking up definition...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="book-off-outline" size={52} color={THEME.ui2} />
          <Text style={styles.errorTitle}>Word not found</Text>
          <Text style={styles.errorSub}>
            "{searchWord}" isn't in our lexicon yet.
          </Text>
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={() => Linking.openURL(`https://www.google.com/search?q=define+${searchWord}`)}
          >
            <Ionicons name="search" size={14} color="#000" />
            <Text style={styles.googleBtnTxt}>Search on Google</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* MEANINGS */}
          {entry?.meanings.map((meaning, i) => (
            <TouchableOpacity
              key={i}
              style={styles.meaningCard}
              onPress={() => setExpandedMeaning(expandedMeaning === i ? null : i)}
              activeOpacity={0.85}
            >
              {/* POS header */}
              <View style={styles.meaningHeader}>
                <View style={[styles.posBadge, { backgroundColor: getPosColor(meaning.partOfSpeech) + "20" }]}>
                  <Text style={[styles.posBadgeTxt, { color: getPosColor(meaning.partOfSpeech) }]}>
                    {meaning.partOfSpeech.toUpperCase()}
                  </Text>
                </View>
                <Ionicons
                  name={expandedMeaning === i ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={THEME.textMuted}
                />
              </View>

              {expandedMeaning === i && (
                <View style={styles.definitionList}>
                  {meaning.definitions.slice(0, 3).map((def, j) => (
                    <View key={j} style={styles.definitionRow}>
                      <View style={[styles.defDot, { backgroundColor: getPosColor(meaning.partOfSpeech) }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.definitionText}>{def.definition}</Text>
                        {def.example && (
                          <Text style={styles.exampleText}>"{def.example}"</Text>
                        )}
                        {def.synonyms && def.synonyms.length > 0 && (
                          <View style={styles.synonymRow}>
                            <Text style={styles.synonymLabel}>Also: </Text>
                            {def.synonyms.slice(0, 4).map((syn, k) => (
                              <TouchableOpacity
                                key={k}
                                onPress={() => router.push({
                                  pathname: "/book/[id]/dictionary",
                                  params: { word: syn },
                                } as any)}
                              >
                                <Text style={styles.synonymTxt}>{syn}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          ))}

          {/* LOOK UP ON GOOGLE */}
          <TouchableOpacity
            style={styles.externalBtn}
            onPress={() => Linking.openURL(`https://www.google.com/search?q=define+${searchWord}`)}
          >
            <Ionicons name="open-outline" size={14} color={THEME.textMuted} />
            <Text style={styles.externalBtnTxt}>Full definition on Google</Text>
          </TouchableOpacity>

          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10 },
  header: { paddingHorizontal: 16, paddingBottom: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.05)", justifyContent: "center", alignItems: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerSmall: { color: THEME.accent, fontSize: 9, fontWeight: "900", letterSpacing: 3 },
  wordDisplay: { color: THEME.text, fontSize: 28, fontWeight: "900", letterSpacing: 2, marginTop: 6 },
  phonetic: { color: THEME.purpleLight, fontSize: 14, marginTop: 4, fontStyle: "italic" },
  content: { padding: 16 },
  meaningCard: { backgroundColor: THEME.ui, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: THEME.ui2 },
  meaningHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  posBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  posBadgeTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  definitionList: { marginTop: 14, gap: 14 },
  definitionRow: { flexDirection: "row", gap: 10 },
  defDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0 },
  definitionText: { color: THEME.text, fontSize: 14, lineHeight: 22 },
  exampleText: { color: THEME.textMuted, fontSize: 13, fontStyle: "italic", marginTop: 6, lineHeight: 20 },
  synonymRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, gap: 6, alignItems: "center" },
  synonymLabel: { color: THEME.textMuted, fontSize: 12 },
  synonymTxt: { color: THEME.accent, fontSize: 12, fontWeight: "700", textDecorationLine: "underline" },
  errorTitle: { color: THEME.text, fontSize: 18, fontWeight: "800" },
  errorSub: { color: THEME.textMuted, fontSize: 13, textAlign: "center" },
  googleBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: THEME.accent, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, marginTop: 10 },
  googleBtnTxt: { color: "#000", fontWeight: "900", fontSize: 13 },
  externalBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14 },
  externalBtnTxt: { color: THEME.textMuted, fontSize: 12 },
});