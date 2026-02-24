import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#000000", accent: "#D4AF37", purple: "#8E2DE2",
  text: "#FFFFFF", textMuted: "#666666", border: "#1A1A1A",
};

const GROUP_PHASE_COLORS: Record<string, string> = {
  reading: "#3B82F6", discussion: "#8E2DE2",
  writing: "#D4AF37", review: "#10B981", published: "#22C55E",
};

interface HeaderProps {
  groupId: string;
  groupData: any;
  onMenuPress?: () => void;
}

export default function GroupHeader({ groupId, groupData, onMenuPress }: HeaderProps) {
  const router = useRouter();

  const name = groupData?.name || "Loading Thread...";
  const type = groupData?.type || "WEAVE";
  const memberCount = groupData?.members?.length || 1;
  const bio = groupData?.bio || "A collaborative space within the Writha Home.";
  const isPrivate = groupData?.visibility === "private";
  const currentPhase = groupData?.currentPhase || "reading";
  const hasAI = groupData?.hasAI || false;
  const phaseColor = GROUP_PHASE_COLORS[currentPhase] || THEME.accent;

  return (
    <View style={styles.header}>
      <View style={styles.glowSpot} />
      <View style={styles.glowSpot2} />

      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={28} color="#FFF" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuBtn} onPress={onMenuPress}>
        <Ionicons name="ellipsis-horizontal" size={24} color="#FFF" />
      </TouchableOpacity>

      <View style={styles.infoContainer}>
        {/* Avatar */}
        <View style={styles.goldBorder}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          {hasAI && (
            <View style={styles.aiBadge}>
              <MaterialCommunityIcons name="brain" size={10} color="#000" />
            </View>
          )}
        </View>

        {/* Name */}
        <Text style={styles.title}>{name}</Text>

        {/* Tags Row */}
        <View style={styles.tagsRow}>
          <View style={styles.typeTag}>
            <Text style={styles.typeTagText}>#{type.toUpperCase()}</Text>
          </View>
          <View style={[styles.privacyTag, isPrivate && styles.privateTag]}>
            <Ionicons name={isPrivate ? "lock-closed" : "earth"} size={9} color={isPrivate ? THEME.purple : "#22C55E"} />
            <Text style={[styles.privacyTagText, { color: isPrivate ? THEME.purple : "#22C55E" }]}>
              {isPrivate ? "PRIVATE" : "PUBLIC"}
            </Text>
          </View>
        </View>

        {/* Bio */}
        <Text style={styles.bio}>{bio}</Text>

        {/* Stats + Phase */}
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <MaterialCommunityIcons name="molecule" size={13} color={THEME.accent} />
            <Text style={styles.statText}>
              <Text style={styles.bold}>{memberCount}</Text>{" "}
              {memberCount === 1 ? "Scholar" : "Scholars"}
            </Text>
          </View>

          <View style={[styles.phasePill, { borderColor: phaseColor + "50" }]}>
            <View style={[styles.phaseDot, { backgroundColor: phaseColor }]} />
            <Text style={[styles.phaseText, { color: phaseColor }]}>
              {currentPhase.toUpperCase()} PHASE
            </Text>
          </View>
        </View>

        {/* Book if present */}
        {groupData?.bookTitle && (
          <View style={styles.bookTag}>
            <Ionicons name="book-outline" size={11} color="#666" />
            <Text style={styles.bookTagText} numberOfLines={1}>
              {groupData.bookTitle}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 60, paddingBottom: 32, paddingHorizontal: 25,
    backgroundColor: "#000", borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40, overflow: "hidden",
    borderBottomWidth: 1, borderColor: "#1A1A1A",
  },
  glowSpot: { position: "absolute", top: -50, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: THEME.purple, opacity: 0.18 },
  glowSpot2: { position: "absolute", top: -30, left: -80, width: 250, height: 250, borderRadius: 125, backgroundColor: THEME.accent, opacity: 0.03 },
  backBtn: { position: "absolute", top: 52, left: 20, zIndex: 10 },
  menuBtn: { position: "absolute", top: 52, right: 20, zIndex: 10 },
  infoContainer: { alignItems: "center", marginTop: 10 },
  goldBorder: { padding: 3, backgroundColor: THEME.accent, borderRadius: 32, marginBottom: 14 },
  avatar: { width: 86, height: 86, borderRadius: 28, backgroundColor: "#0A0A0A", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#000" },
  avatarText: { color: THEME.accent, fontSize: 36, fontWeight: "900" },
  aiBadge: { position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: THEME.accent, justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: "#000" },
  title: { fontSize: 26, fontWeight: "900", color: "#FFF", textAlign: "center", letterSpacing: -0.5 },
  tagsRow: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" },
  typeTag: { backgroundColor: THEME.purple, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  typeTagText: { color: "#FFF", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  privacyTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#001A0A", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: "#22C55E30" },
  privateTag: { backgroundColor: "#0D0020", borderColor: THEME.purple + "40" },
  privacyTagText: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  bio: { marginTop: 14, color: "#777", textAlign: "center", fontSize: 13, lineHeight: 20, paddingHorizontal: 12 },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 18, alignItems: "center" },
  statPill: { flexDirection: "row", alignItems: "center", backgroundColor: "#111", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#222", gap: 6 },
  statText: { color: "#AAA", fontSize: 12, fontWeight: "600" },
  bold: { fontWeight: "900", color: THEME.accent },
  phasePill: { flexDirection: "row", alignItems: "center", backgroundColor: "#0A0A0A", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, gap: 6 },
  phaseDot: { width: 6, height: 6, borderRadius: 3 },
  phaseText: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  bookTag: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, backgroundColor: "#0A0A0A", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: "#1A1A1A", maxWidth: width - 80 },
  bookTagText: { color: "#555", fontSize: 11, fontWeight: "600" },
});