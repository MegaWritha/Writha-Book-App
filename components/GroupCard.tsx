import React from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#000000", surface: "#0A0A0A", accent: "#D4AF37",
  purple: "#8E2DE2", text: "#FFFFFF", textMuted: "#555555",
  border: "#1A1A1A",
};

const PHASE_COLORS: Record<string, string> = {
  reading:    "#3B82F6",
  discussion: "#8E2DE2",
  writing:    "#D4AF37",
  review:     "#10B981",
  published:  "#22C55E",
};

const TYPE_COLORS: Record<string, string> = {
  critique:   "#D4AF37",
  study:      "#8E2DE2",
  discussion: "#3B82F6",
  research:   "#10B981",
  reading:    "#F59E0B",
  book_club:  "#EC4899",
};

interface Group {
  id: string;
  name: string;
  description?: string;
  bio?: string;
  type?: string;
  category?: string;
  memberCount?: number;
  members?: string[];
  isPrivate?: boolean;
  visibility?: string;
  currentPhase?: string;
  bookTitle?: string;
  hasAI?: boolean;
  cover?: string;
}

interface GroupCardProps {
  group: Group;
}

export function GroupCard({ group }: GroupCardProps) {
  const memberCount = group.memberCount ?? group.members?.length ?? 0;
  const isPrivate = group.isPrivate || group.visibility === "private";
  const type = group.type || group.category || "discussion";
  const typeColor = TYPE_COLORS[type] || THEME.accent;
  const phase = group.currentPhase;
  const phaseColor = phase ? PHASE_COLORS[phase] : null;
  const description = group.description || group.bio || "";
  const initial = group.name?.charAt(0).toUpperCase() || "W";

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Fixed route — matches your actual group screen path
    router.push(`/groups/${group.id}` as any);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
      ]}
    >
      {/* Left accent strip colored by type */}
      <View style={[styles.accentStrip, { backgroundColor: typeColor }]} />

      {/* Avatar */}
      <View style={[styles.avatarWrapper, { borderColor: typeColor + "50" }]}>
        <Text style={[styles.avatarText, { color: typeColor }]}>{initial}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>{group.name}</Text>
          <View style={styles.badges}>
            {group.hasAI && (
              <View style={styles.aiBadge}>
                <MaterialCommunityIcons name="brain" size={10} color="#000" />
              </View>
            )}
            {isPrivate && (
              <Ionicons name="lock-closed" size={13} color={THEME.textMuted} />
            )}
          </View>
        </View>

        {description.length > 0 && (
          <Text style={styles.description} numberOfLines={2}>{description}</Text>
        )}

        {group.bookTitle && (
          <Text style={styles.bookTitle} numberOfLines={1}>
            📖 {group.bookTitle}
          </Text>
        )}

        <View style={styles.footer}>
          {/* Type tag */}
          <View style={[styles.typeTag, { borderColor: typeColor + "40" }]}>
            <Text style={[styles.typeTagText, { color: typeColor }]}>
              {type.toUpperCase()}
            </Text>
          </View>

          {/* Phase tag */}
          {phase && phaseColor && (
            <View style={[styles.phaseTag, { borderColor: phaseColor + "40" }]}>
              <View style={[styles.phaseDot, { backgroundColor: phaseColor }]} />
              <Text style={[styles.phaseText, { color: phaseColor }]}>
                {phase.toUpperCase()}
              </Text>
            </View>
          )}

          {/* Members */}
          <View style={styles.membersRow}>
            <MaterialCommunityIcons name="molecule" size={12} color={THEME.textMuted} />
            <Text style={styles.memberCount}>{memberCount}</Text>
          </View>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color="#222" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: THEME.surface, borderRadius: 20,
    borderWidth: 1, borderColor: THEME.border,
    marginBottom: 12, overflow: "hidden",
    paddingRight: 16, paddingVertical: 14, gap: 14,
  },
  accentStrip: { width: 3, alignSelf: "stretch", borderRadius: 3, marginRight: 2 },
  avatarWrapper: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: "#111", borderWidth: 1,
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 22, fontWeight: "900" },
  content: { flex: 1, gap: 6 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name: { color: THEME.text, fontSize: 16, fontWeight: "800", flex: 1 },
  badges: { flexDirection: "row", alignItems: "center", gap: 6 },
  aiBadge: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: THEME.accent,
    justifyContent: "center", alignItems: "center",
  },
  description: { color: THEME.textMuted, fontSize: 12, lineHeight: 17 },
  bookTitle: { color: "#444", fontSize: 11, fontWeight: "600" },
  footer: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  typeTag: {
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1,
  },
  typeTagText: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  phaseTag: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1,
  },
  phaseDot: { width: 5, height: 5, borderRadius: 3 },
  phaseText: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  membersRow: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
  memberCount: { color: THEME.textMuted, fontSize: 12, fontWeight: "700" },
});