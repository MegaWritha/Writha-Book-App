import React, { useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Dimensions, Animated, Image,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

const THEME = {
  bg:          "#080410",
  ui:          "#100820",
  ui2:         "#1A0E30",
  accent:      "#FFD700",
  accentDim:   "rgba(255,215,0,0.08)",
  purple:      "#6D28D9",
  purpleLight: "#A78BFA",
  text:        "#EDE8F5",
  textMuted:   "#6B6080",
  green:       "#22C55E",
  blue:        "#38BDF8",
};

export default function PublishLanding() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  // ── ANIMATIONS ───────────────────────────────────────────────────
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(40)).current;
  const card1Anim  = useRef(new Animated.Value(60)).current;
  const card2Anim  = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.stagger(150, [
        Animated.timing(card1Anim, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(card2Anim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={["#1A0533", "#080410"]}
        style={StyleSheet.absoluteFill}
      />

      {/* BACK */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={THEME.accent} />
        </TouchableOpacity>
      </View>

      {/* HERO */}
      <Animated.View style={[
        styles.hero,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}>
        <View style={styles.heroBadge}>
          <MaterialCommunityIcons name="feather" size={16} color={THEME.accent} />
          <Text style={styles.heroBadgeTxt}>WRITHA PUBLISHING</Text>
        </View>
        <Text style={styles.heroTitle}>
          Share Your{"\n"}Story With{"\n"}The World
        </Text>
        <Text style={styles.heroSub}>
          Whether you're starting fresh or bringing{"\n"}
          a finished manuscript — we've got you.
        </Text>
      </Animated.View>

      {/* CARDS */}
      <View style={styles.cards}>

        {/* WRITE NEW */}
        <Animated.View style={{ transform: [{ translateY: card1Anim }] }}>
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push("/write" as any)}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={["#1E1135", "#2D1B4D"]}
              style={styles.cardGradient}
            >
              <View style={styles.cardIconWrap}>
                <LinearGradient
                  colors={[THEME.purple, "#4C1D95"]}
                  style={styles.cardIcon}
                >
                  <Ionicons name="pencil" size={28} color="#fff" />
                </LinearGradient>
              </View>

              <View style={styles.cardContent}>
                <Text style={styles.cardLabel}>NEW AUTHOR</Text>
                <Text style={styles.cardTitle}>Write a Book</Text>
                <Text style={styles.cardDesc}>
                  Start from scratch in our distraction-free writing studio. 
                  Auto-saves as you go.
                </Text>
              </View>

              <View style={styles.cardFeatures}>
                {["Auto-save every 30s", "Chapter organiser", "Word count tracker"].map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={14} color={THEME.purpleLight} />
                    <Text style={styles.featureTxt}>{f}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.cardArrow}>
                <Ionicons name="arrow-forward" size={18} color={THEME.purple} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* UPLOAD MANUSCRIPT */}
        <Animated.View style={{ transform: [{ translateY: card2Anim }] }}>
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push("/publish/upload" as any)}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={["#1A1500", "#2A2000"]}
              style={styles.cardGradient}
            >
              <View style={styles.cardIconWrap}>
                <LinearGradient
                  colors={[THEME.accent, "#B8860B"]}
                  style={styles.cardIcon}
                >
                  <Ionicons name="cloud-upload" size={28} color="#000" />
                </LinearGradient>
              </View>

              <View style={styles.cardContent}>
                <Text style={[styles.cardLabel, { color: THEME.accent }]}>
                  ALREADY WRITTEN
                </Text>
                <Text style={styles.cardTitle}>Upload Manuscript</Text>
                <Text style={styles.cardDesc}>
                  Have a finished book? Upload your Word doc, PDF or text file 
                  and we'll handle the rest.
                </Text>
              </View>

              <View style={styles.cardFeatures}>
                {[
                  "Supports .docx .pdf .txt",
                  "Auto chapter detection",
                  "Preview before publishing",
                ].map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={14} color={THEME.accent} />
                    <Text style={[styles.featureTxt, { color: THEME.accent + "99" }]}>{f}</Text>
                  </View>
                ))}
              </View>

              {/* NEW badge */}
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeTxt}>NEW</Text>
              </View>

              <View style={styles.cardArrow}>
                <Ionicons name="arrow-forward" size={18} color={THEME.accent} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* BOTTOM NOTE */}
      <Animated.View style={[styles.bottomNote, { opacity: fadeAnim }]}>
        <Ionicons name="shield-checkmark-outline" size={14} color={THEME.textMuted} />
        <Text style={styles.bottomNoteTxt}>
          All submissions reviewed within 24–48 hours
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: THEME.bg },
  topBar:         { paddingHorizontal: 20, paddingBottom: 10 },
  backBtn:        { width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  hero:           { paddingHorizontal: 28, paddingTop: 10, paddingBottom: 28 },
  heroBadge:      { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: THEME.accentDim, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: THEME.accent + "30", marginBottom: 16 },
  heroBadgeTxt:   { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  heroTitle:      { color: THEME.text, fontSize: 38, fontWeight: "900", lineHeight: 44, marginBottom: 12 },
  heroSub:        { color: THEME.textMuted, fontSize: 14, lineHeight: 22 },
  cards:          { paddingHorizontal: 20, gap: 14 },
  card:           { borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: THEME.ui2 },
  cardGradient:   { padding: 20 },
  cardIconWrap:   { marginBottom: 16 },
  cardIcon:       { width: 56, height: 56, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  cardContent:    { marginBottom: 14 },
  cardLabel:      { color: THEME.purpleLight, fontSize: 9, fontWeight: "900", letterSpacing: 2, marginBottom: 4 },
  cardTitle:      { color: THEME.text, fontSize: 20, fontWeight: "900", marginBottom: 6 },
  cardDesc:       { color: THEME.textMuted, fontSize: 12, lineHeight: 18 },
  cardFeatures:   { gap: 6, marginBottom: 14 },
  featureRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
  featureTxt:     { color: THEME.purpleLight + "99", fontSize: 11 },
  cardArrow:      { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)", justifyContent: "center", alignItems: "center", alignSelf: "flex-end" },
  newBadge:       { position: "absolute", top: 16, right: 16, backgroundColor: THEME.accent, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  newBadgeTxt:    { color: "#000", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  bottomNote:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 20 },
  bottomNoteTxt:  { color: THEME.textMuted, fontSize: 11 },
});