import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Dimensions, StatusBar, ActivityIndicator,
  ImageBackground, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import GroupTabs from "./GroupTabs";

const { width, height } = Dimensions.get("window");

const THEME = {
  bg: "#000000", surface: "#0A0A0A", accent: "#D4AF37",
  purple: "#8E2DE2", text: "#FFFFFF", textMuted: "#555555",
  border: "#1A1A1A", success: "#22C55E", danger: "#FF3B30",
};

const PHASE_META: Record<string, { color: string; icon: string; label: string; desc: string }> = {
  reading:    { color: "#3B82F6", icon: "book-outline",        label: "READING",    desc: "Members are reading the material" },
  discussion: { color: "#8E2DE2", icon: "chatbubbles-outline", label: "DISCUSSION", desc: "Open debate and idea exchange" },
  writing:    { color: "#D4AF37", icon: "create-outline",      label: "WRITING",    desc: "Members filling contributions" },
  review:     { color: "#10B981", icon: "eye-outline",         label: "REVIEW",     desc: "Reviewing and refining output" },
  published:  { color: "#22C55E", icon: "megaphone-outline",   label: "PUBLISHED",  desc: "Weave broadcast to the archive" },
};

const MOOD_META: Record<string, { color: string; emoji: string; label: string }> = {
  focused:     { color: "#3B82F6", emoji: "🎯", label: "FOCUSED" },
  exploratory: { color: "#8E2DE2", emoji: "🔭", label: "EXPLORATORY" },
  debating:    { color: "#EF4444", emoji: "⚔️",  label: "DEBATING" },
  finalizing:  { color: "#22C55E", emoji: "✍️",  label: "FINALIZING" },
};

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [groupData, setGroupData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"loom" | "members" | "contribute" | "output" | "settings">("loom");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const phaseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "groups", id), (snap) => {
      if (snap.exists()) setGroupData({ id: snap.id, ...snap.data() });
      setLoading(false);
    });
    return unsub;
  }, [id]);

  useEffect(() => {
    // Ambient pulse on the progress ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    // Glow breathe
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <MaterialCommunityIcons name="molecule" size={48} color={THEME.accent} />
        </Animated.View>
        <Text style={styles.loadingText}>ENTERING THE LOOM...</Text>
      </View>
    );
  }

  if (!groupData) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.errorText}>VOID: WEAVE NOT FOUND</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>RETURN</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const phase = groupData.currentPhase || "reading";
  const phaseMeta = PHASE_META[phase];
  const mood = groupData.currentMood || "focused";
  const moodMeta = MOOD_META[mood];
  const members: string[] = groupData.members || [];
  const contributions: Record<string, any> = groupData.contributions || {};
  const submittedCount = Object.values(contributions).filter((c: any) => c.submitted).length;
  const progressPct = members.length > 0 ? Math.round((submittedCount / members.length) * 100) : 0;
  const isPrivate = groupData.visibility === "private";
  const hasAI = groupData.hasAI || false;
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.2] });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Ambient background glow tied to phase color */}
      <Animated.View style={[styles.ambientGlow, {
        backgroundColor: phaseMeta.color,
        opacity: glowOpacity,
      }]} />
      <View style={[styles.ambientGlow2, { backgroundColor: THEME.purple, opacity: 0.05 }]} />

      {/* Fixed top nav */}
      <View style={styles.topNav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={26} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.navCenter}>
          <Text style={styles.navTitle} numberOfLines={1}>{groupData.name}</Text>
          <View style={[styles.navPhasePill, { borderColor: phaseMeta.color + "60" }]}>
            <View style={[styles.navPhaseDot, { backgroundColor: phaseMeta.color }]} />
            <Text style={[styles.navPhaseText, { color: phaseMeta.color }]}>{phaseMeta.label}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setActiveTab("settings")} style={styles.navBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Scrollable Header Card */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        stickyHeaderIndices={[1]}
      >
        {/* HERO SECTION */}
        <View style={styles.hero}>
          {/* Book Cover / Group Visual */}
          <View style={styles.bookVisual}>
            <View style={[styles.bookSpine, { backgroundColor: phaseMeta.color }]} />
            <View style={styles.bookFace}>
              <Text style={styles.bookInitial}>{groupData.name?.charAt(0).toUpperCase()}</Text>
              {groupData.bookTitle && (
                <Text style={styles.bookTitleOnCover} numberOfLines={2}>{groupData.bookTitle}</Text>
              )}
            </View>
          </View>

          {/* Group Identity */}
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{groupData.name}</Text>

            {groupData.bookTitle && (
              <View style={styles.bookTagRow}>
                <Ionicons name="book" size={12} color={THEME.accent} />
                <Text style={styles.bookTagText}>{groupData.bookTitle}</Text>
                {groupData.bookAuthor && (
                  <Text style={styles.bookTagAuthor}>by {groupData.bookAuthor}</Text>
                )}
              </View>
            )}

            {groupData.topic && !groupData.bookTitle && (
              <View style={styles.bookTagRow}>
                <Ionicons name="bulb-outline" size={12} color={THEME.purple} />
                <Text style={[styles.bookTagText, { color: THEME.purple }]}>{groupData.topic}</Text>
              </View>
            )}

            {/* Mood + Privacy Row */}
            <View style={styles.badgeRow}>
              <View style={[styles.moodBadge, { borderColor: moodMeta.color + "50" }]}>
                <Text style={styles.moodEmoji}>{moodMeta.emoji}</Text>
                <Text style={[styles.moodLabel, { color: moodMeta.color }]}>{moodMeta.label}</Text>
              </View>
              <View style={[styles.privacyBadge, isPrivate && styles.privateBadgeStyle]}>
                <Ionicons
                  name={isPrivate ? "lock-closed" : "earth"}
                  size={10}
                  color={isPrivate ? THEME.purple : THEME.success}
                />
                <Text style={[styles.privacyText, { color: isPrivate ? THEME.purple : THEME.success }]}>
                  {isPrivate ? "PRIVATE" : "PUBLIC"}
                </Text>
              </View>
              {hasAI && (
                <View style={styles.aiBadge}>
                  <MaterialCommunityIcons name="brain" size={10} color="#000" />
                  <Text style={styles.aiLabel}>AI</Text>
                </View>
              )}
            </View>
          </View>

          {/* PROGRESS RING */}
          <View style={styles.progressSection}>
            <Animated.View style={[styles.progressRingOuter, { transform: [{ scale: pulseAnim }], borderColor: phaseMeta.color + "30" }]}>
              <View style={[styles.progressRingInner, { borderColor: phaseMeta.color }]}>
                <Text style={[styles.progressPct, { color: phaseMeta.color }]}>{progressPct}%</Text>
                <Text style={styles.progressLabel}>COMPLETE</Text>
              </View>
            </Animated.View>
            <Text style={styles.progressSub}>
              {submittedCount}/{members.length} contributions
            </Text>
          </View>

          {/* PHASE TIMELINE */}
          <View style={styles.phaseTimeline}>
            {Object.entries(PHASE_META).map(([key, meta], index) => {
              const phases = Object.keys(PHASE_META);
              const currentIndex = phases.indexOf(phase);
              const thisIndex = phases.indexOf(key);
              const isDone = thisIndex < currentIndex;
              const isCurrent = key === phase;

              return (
                <React.Fragment key={key}>
                  <View style={styles.phaseStep}>
                    <View style={[
                      styles.phaseDot,
                      isDone && { backgroundColor: meta.color },
                      isCurrent && { backgroundColor: meta.color, transform: [{ scale: 1.3 }] },
                      !isDone && !isCurrent && { backgroundColor: "#111", borderColor: "#222" },
                    ]}>
                      {isDone && <Ionicons name="checkmark" size={8} color="#000" />}
                    </View>
                    <Text style={[
                      styles.phaseStepLabel,
                      isCurrent && { color: meta.color, fontWeight: "900" },
                      isDone && { color: "#444" },
                    ]}>{meta.label}</Text>
                  </View>
                  {index < Object.keys(PHASE_META).length - 1 && (
                    <View style={[styles.phaseConnector, isDone && { backgroundColor: meta.color }]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>

          {/* MEMBER AVATARS STRIP */}
          <View style={styles.memberStrip}>
            <View style={styles.memberAvatars}>
              {members.slice(0, 5).map((uid, i) => (
                <View key={uid} style={[styles.memberThumb, { marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }]}>
                  <Text style={styles.memberThumbText}>
                    {(groupData.memberNames?.[uid] || "S").charAt(0).toUpperCase()}
                  </Text>
                </View>
              ))}
              {hasAI && (
                <View style={[styles.memberThumb, styles.aiThumb, { marginLeft: -10, zIndex: 1 }]}>
                  <MaterialCommunityIcons name="brain" size={12} color="#000" />
                </View>
              )}
              {members.length > 5 && (
                <View style={[styles.memberThumbMore, { marginLeft: -10 }]}>
                  <Text style={styles.memberThumbMoreText}>+{members.length - 5}</Text>
                </View>
              )}
            </View>
            <Text style={styles.memberStripLabel}>
              {members.length} {members.length === 1 ? "Scholar" : "Scholars"}
              {hasAI ? " + AI" : ""}
            </Text>
          </View>

          {/* QUICK ACTION BUTTONS */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.primaryAction, { backgroundColor: phaseMeta.color }]}
              onPress={() => setActiveTab("contribute")}
            >
              <Ionicons name="create-outline" size={18} color="#000" />
              <Text style={styles.primaryActionText}>MY CONTRIBUTION</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => setActiveTab("output")}
            >
              <MaterialCommunityIcons name="file-document-outline" size={18} color={THEME.accent} />
              <Text style={styles.secondaryActionText}>VIEW OUTPUT</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* STICKY TAB BAR */}
        <View style={styles.tabBarWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
            {[
              { id: "loom",       icon: "chatbubbles-outline", label: "LOOM" },
              { id: "contribute", icon: "create-outline",      label: "CONTRIBUTE" },
              { id: "output",     icon: "document-text-outline", label: "OUTPUT" },
              { id: "members",    icon: "people-outline",       label: "WEAVERS" },
              { id: "settings",   icon: "shield-outline",       label: "VAULT" },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => setActiveTab(tab.id as any)}
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={16}
                    color={active ? "#000" : "#444"}
                  />
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {tab.label}
                  </Text>
                  {tab.id === "contribute" && submittedCount < members.length && (
                    <View style={styles.tabDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* TAB CONTENT */}
        <View style={styles.tabContent}>
          <GroupTabs
            groupId={id}
            groupData={groupData}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  loadingScreen: { flex: 1, backgroundColor: THEME.bg, justifyContent: "center", alignItems: "center", gap: 16 },
  loadingText: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 3 },
  errorText: { color: THEME.purple, fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  backBtn: { marginTop: 20, borderWidth: 1, borderColor: "#222", paddingHorizontal: 30, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { color: "#FFF", fontWeight: "900", letterSpacing: 2, fontSize: 11 },

  ambientGlow: { position: "absolute", top: -100, alignSelf: "center", width: width * 1.5, height: 400, borderRadius: width, },
  ambientGlow2: { position: "absolute", bottom: 200, right: -100, width: 400, height: 400, borderRadius: 200 },

  // TOP NAV
  topNav: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 56 : 40, paddingHorizontal: 16,
    paddingBottom: 12, backgroundColor: "rgba(0,0,0,0.7)",
  },
  navBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  navCenter: { flex: 1, alignItems: "center", gap: 4 },
  navTitle: { color: "#FFF", fontWeight: "900", fontSize: 16, letterSpacing: -0.3 },
  navPhasePill: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  navPhaseDot: { width: 5, height: 5, borderRadius: 3 },
  navPhaseText: { fontSize: 8, fontWeight: "900", letterSpacing: 1 },

  // HERO
  hero: { paddingTop: Platform.OS === "ios" ? 120 : 100, paddingHorizontal: 20, paddingBottom: 10 },

  bookVisual: {
    flexDirection: "row", alignSelf: "center",
    width: 120, height: 160, borderRadius: 8,
    overflow: "hidden", marginBottom: 20,
    shadowColor: THEME.accent, shadowOpacity: 0.3, shadowRadius: 20,
    elevation: 10,
  },
  bookSpine: { width: 18, height: "100%" },
  bookFace: {
    flex: 1, backgroundColor: "#0D0D0D",
    borderWidth: 1, borderColor: "#222",
    justifyContent: "center", alignItems: "center",
    padding: 10, gap: 8,
  },
  bookInitial: { color: THEME.accent, fontSize: 36, fontWeight: "900" },
  bookTitleOnCover: { color: "#555", fontSize: 10, textAlign: "center", lineHeight: 14 },

  heroInfo: { alignItems: "center", gap: 10, marginBottom: 24 },
  heroName: { color: "#FFF", fontSize: 26, fontWeight: "900", textAlign: "center", letterSpacing: -0.5 },
  bookTagRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  bookTagText: { color: THEME.accent, fontSize: 12, fontWeight: "700" },
  bookTagAuthor: { color: "#555", fontSize: 11 },

  badgeRow: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" },
  moodBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, backgroundColor: "#0A0A0A" },
  moodEmoji: { fontSize: 12 },
  moodLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  privacyBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: "#22C55E30", backgroundColor: "#001A0A" },
  privateBadgeStyle: { backgroundColor: "#0D0020", borderColor: "#8E2DE240" },
  privacyText: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  aiBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: THEME.accent, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  aiLabel: { fontSize: 9, fontWeight: "900", color: "#000" },

  // PROGRESS
  progressSection: { alignItems: "center", marginBottom: 24 },
  progressRingOuter: { width: 100, height: 100, borderRadius: 50, borderWidth: 1, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  progressRingInner: { width: 82, height: 82, borderRadius: 41, borderWidth: 3, justifyContent: "center", alignItems: "center", backgroundColor: "#050505" },
  progressPct: { fontSize: 22, fontWeight: "900" },
  progressLabel: { color: "#333", fontSize: 7, fontWeight: "900", letterSpacing: 1 },
  progressSub: { color: "#444", fontSize: 11, fontWeight: "700" },

  // PHASE TIMELINE
  phaseTimeline: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 24, paddingHorizontal: 10 },
  phaseStep: { alignItems: "center", gap: 5 },
  phaseDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: "#333", justifyContent: "center", alignItems: "center" },
  phaseStepLabel: { color: "#333", fontSize: 6, fontWeight: "700", letterSpacing: 0.5, textAlign: "center", maxWidth: 44 },
  phaseConnector: { flex: 1, height: 1, backgroundColor: "#1A1A1A", marginBottom: 12 },

  // MEMBER STRIP
  memberStrip: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 24 },
  memberAvatars: { flexDirection: "row" },
  memberThumb: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#1A1A1A", borderWidth: 2, borderColor: "#000", justifyContent: "center", alignItems: "center" },
  memberThumbText: { color: THEME.accent, fontSize: 12, fontWeight: "900" },
  aiThumb: { backgroundColor: THEME.accent },
  memberThumbMore: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#111", borderWidth: 2, borderColor: "#000", justifyContent: "center", alignItems: "center" },
  memberThumbMoreText: { color: "#555", fontSize: 9, fontWeight: "900" },
  memberStripLabel: { color: "#444", fontSize: 12, fontWeight: "700" },

  // QUICK ACTIONS
  quickActions: { flexDirection: "row", gap: 10, marginBottom: 10 },
  primaryAction: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 16 },
  primaryActionText: { color: "#000", fontWeight: "900", fontSize: 12, letterSpacing: 1 },
  secondaryAction: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: "#0A0A0A", borderWidth: 1, borderColor: THEME.accent + "40" },
  secondaryActionText: { color: THEME.accent, fontWeight: "900", fontSize: 12, letterSpacing: 1 },

  // TAB BAR
  tabBarWrapper: { backgroundColor: "rgba(0,0,0,0.95)", borderBottomWidth: 1, borderColor: "#0D0D0D", zIndex: 50 },
  tabBar: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, borderWidth: 1, borderColor: "transparent" },
  tabActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  tabLabel: { color: "#444", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  tabLabelActive: { color: "#000" },
  tabDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.danger },

  tabContent: { minHeight: height * 0.6 },
});