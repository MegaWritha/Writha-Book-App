import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Animated, Dimensions, Alert, ActivityIndicator,
} from "react-native";
import { doc, updateDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

const THEME = {
  bg: "#000000", surface: "#0A0A0A", accent: "#D4AF37",
  purple: "#8E2DE2", text: "#FFFFFF", textMuted: "#555555",
  border: "#1A1A1A", success: "#22C55E", danger: "#FF3B30",
};

// Every role has its own fields
const ROLE_FIELDS: Record<string, { id: string; label: string; placeholder: string; required: boolean }[]> = {
  analyst: [
    { id: "thesis",     label: "CENTRAL THESIS",       placeholder: "What is the core argument or claim?", required: true },
    { id: "structure",  label: "STRUCTURAL ANALYSIS",  placeholder: "How is the work structured? What patterns emerge?", required: true },
    { id: "evidence",   label: "KEY EVIDENCE",         placeholder: "What evidence supports the main ideas?", required: false },
    { id: "weakness",   label: "ANALYTICAL GAPS",      placeholder: "What does the analysis miss or fail to address?", required: false },
  ],
  narrator: [
    { id: "voice",      label: "NARRATIVE VOICE",      placeholder: "Describe the narrator's voice and perspective.", required: true },
    { id: "arc",        label: "STORY ARC",            placeholder: "Map out the progression of events or ideas.", required: true },
    { id: "tension",    label: "TENSION POINTS",       placeholder: "Where does conflict or tension build?", required: false },
    { id: "resolution", label: "RESOLUTION",           placeholder: "How does the narrative resolve?", required: false },
  ],
  critic: [
    { id: "strengths",  label: "STRENGTHS",            placeholder: "What does this work do exceptionally well?", required: true },
    { id: "weaknesses", label: "WEAKNESSES",           placeholder: "Where does the work fall short?", required: true },
    { id: "style",      label: "WRITING STYLE",        placeholder: "Evaluate the author's craft and technique.", required: true },
    { id: "verdict",    label: "FINAL VERDICT",        placeholder: "Your overall critical assessment.", required: true },
  ],
  historian: [
    { id: "context",    label: "HISTORICAL CONTEXT",   placeholder: "What period and circumstances shaped this work?", required: true },
    { id: "influences", label: "KEY INFLUENCES",       placeholder: "What movements, events or figures influenced it?", required: true },
    { id: "legacy",     label: "LASTING IMPACT",       placeholder: "How has this work influenced what came after?", required: false },
  ],
  connector: [
    { id: "parallels",  label: "PARALLEL WORKS",       placeholder: "What other works share similar themes or approaches?", required: true },
    { id: "themes",     label: "RECURRING THEMES",     placeholder: "What themes connect this to broader literature?", required: true },
    { id: "contrast",   label: "CONTRASTS",            placeholder: "Where does this work diverge from its peers?", required: false },
  ],
  editor: [
    { id: "summary",    label: "EXECUTIVE SUMMARY",    placeholder: "Write a polished summary of the group's findings.", required: true },
    { id: "cohesion",   label: "COHESION NOTES",       placeholder: "How well do the contributions fit together?", required: true },
    { id: "polish",     label: "POLISH SUGGESTIONS",   placeholder: "What needs refining before publishing?", required: false },
    { id: "finalDraft", label: "FINAL DRAFT NOTES",    placeholder: "Notes for the final compiled output.", required: false },
  ],
  member: [
    { id: "thoughts",   label: "THOUGHTS & INSIGHTS",  placeholder: "Share your perspective on the work.", required: true },
    { id: "questions",  label: "QUESTIONS RAISED",     placeholder: "What questions does this work raise for you?", required: false },
  ],
};

const SCHOLARLY_REACTIONS = [
  { id: "brilliant",  label: "Brilliant",       emoji: "💡" },
  { id: "strong",     label: "Strong Argument", emoji: "💪" },
  { id: "evidence",   label: "Needs Evidence",  emoji: "🔍" },
  { id: "disagree",   label: "I Disagree",      emoji: "⚔️" },
  { id: "question",   label: "Raises Questions",emoji: "❓" },
];

interface ContributionPanelProps {
  groupId: string;
  groupData: any;
}

export default function ContributionPanel({ groupId, groupData }: ContributionPanelProps) {
  const uid = auth.currentUser?.uid || "";
  const role: string = groupData?.memberRoles?.[uid] || "member";
  const fields = ROLE_FIELDS[role] || ROLE_FIELDS.member;
  const contributions: Record<string, any> = groupData?.contributions || {};
  const myContribution = contributions[uid] || {};
  const isSubmitted = myContribution.submitted || false;

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [viewingMember, setViewingMember] = useState<string | null>(null);

  const submitAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef(fields.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Load saved field values
    const saved: Record<string, string> = {};
    fields.forEach((f) => { saved[f.id] = myContribution[f.id] || ""; });
    setFieldValues(saved);
  }, [groupData]);

  useEffect(() => {
    // Stagger card entry animations
    fields.forEach((_, i) => {
      Animated.timing(cardAnims[i], {
        toValue: 1, duration: 400,
        delay: i * 80, useNativeDriver: true,
      }).start();
    });
  }, []);

  const saveField = async (fieldId: string, value: string) => {
    if (!uid) return;
    try {
      await updateDoc(doc(db, "groups", groupId), {
        [`contributions.${uid}.${fieldId}`]: value,
        [`contributions.${uid}.lastUpdated`]: serverTimestamp(),
        [`contributions.${uid}.role`]: role,
      });
    } catch (e) { console.error(e); }
  };

  const handleFieldChange = (fieldId: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleFieldBlur = async (fieldId: string) => {
    setActiveField(null);
    await saveField(fieldId, fieldValues[fieldId] || "");
  };

  const allRequiredFilled = fields.filter((f) => f.required).every((f) => fieldValues[f.id]?.trim().length > 0);

  const handleSubmit = async () => {
    if (!allRequiredFilled) {
      Alert.alert("INCOMPLETE", "Fill all required fields before submitting your contribution.");
      return;
    }
    setSubmitting(true);
    try {
      const updates: Record<string, any> = {};
      fields.forEach((f) => { updates[`contributions.${uid}.${f.id}`] = fieldValues[f.id] || ""; });
      updates[`contributions.${uid}.submitted`] = true;
      updates[`contributions.${uid}.submittedAt`] = serverTimestamp();
      updates[`contributions.${uid}.role`] = role;
      await updateDoc(doc(db, "groups", groupId), updates);

      Animated.spring(submitAnim, { toValue: 1, useNativeDriver: true, tension: 60 }).start();
    } catch (e) {
      Alert.alert("SUBMISSION FAILED", "Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const addReaction = async (targetUid: string, reactionId: string) => {
    try {
      await updateDoc(doc(db, "groups", groupId), {
        [`contributions.${targetUid}.reactions.${uid}`]: reactionId,
      });
    } catch (e) { console.error(e); }
  };

  const members: string[] = groupData?.members || [];
  const roleColor = {
    analyst: "#D4AF37", narrator: "#3B82F6", critic: "#EC4899",
    historian: "#10B981", connector: "#F59E0B", editor: "#8E2DE2", member: "#666",
  }[role] || THEME.accent;

  // ---- SUBMITTED STATE ----
  if (isSubmitted && !viewingMember) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Sealed Card */}
        <Animated.View style={[styles.sealedCard, { transform: [{ scale: submitAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1] }) }] }]}>
          <View style={[styles.sealedStamp, { borderColor: roleColor }]}>
            <Ionicons name="checkmark" size={32} color={roleColor} />
          </View>
          <Text style={[styles.sealedTitle, { color: roleColor }]}>CONTRIBUTION SEALED</Text>
          <Text style={styles.sealedSub}>Your work as {role.toUpperCase()} has been submitted</Text>

          {/* Preview own fields */}
          {fields.map((f) => fieldValues[f.id] ? (
            <View key={f.id} style={styles.sealedField}>
              <Text style={styles.sealedFieldLabel}>{f.label}</Text>
              <Text style={styles.sealedFieldValue}>{fieldValues[f.id]}</Text>
            </View>
          ) : null)}
        </Animated.View>

        {/* Other members contributions */}
        <Text style={styles.sectionTitle}>OTHER CONTRIBUTIONS</Text>
        {members.filter((m) => m !== uid).map((memberUid) => {
          const contrib = contributions[memberUid];
          const memberRole = groupData?.memberRoles?.[memberUid] || "member";
          const memberName = groupData?.memberNames?.[memberUid] || "Scholar";
          const mColor = ({ analyst: "#D4AF37", narrator: "#3B82F6", critic: "#EC4899", historian: "#10B981", connector: "#F59E0B", editor: "#8E2DE2", member: "#666",} as Record<string, string>)[memberRole] || "#666";

          if (!contrib?.submitted) {
            return (
              <View key={memberUid} style={styles.pendingCard}>
                <View style={[styles.pendingDot, { backgroundColor: "#1A1A1A" }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pendingName}>{memberName}</Text>
                  <Text style={styles.pendingRole}>{memberRole.toUpperCase()} — pending</Text>
                </View>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>IN PROGRESS</Text>
                </View>
              </View>
            );
          }

          return (
            <TouchableOpacity
              key={memberUid}
              style={[styles.memberContribCard, { borderColor: mColor + "30" }]}
              onPress={() => setViewingMember(memberUid)}
            >
              <View style={styles.memberContribHeader}>
                <View style={[styles.memberContribAvatar, { backgroundColor: mColor + "20", borderColor: mColor + "50" }]}>
                  <Text style={[styles.memberContribInitial, { color: mColor }]}>
                    {memberName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberContribName}>{memberName}</Text>
                  <Text style={[styles.memberContribRole, { color: mColor }]}>{memberRole.toUpperCase()}</Text>
                </View>
                <View style={[styles.sealedMini, { borderColor: mColor }]}>
                  <Ionicons name="checkmark" size={12} color={mColor} />
                </View>
              </View>

              {/* Preview first field */}
              {ROLE_FIELDS[memberRole]?.[0] && contrib[ROLE_FIELDS[memberRole][0].id] && (
                <Text style={styles.memberContribPreview} numberOfLines={2}>
                  {contrib[ROLE_FIELDS[memberRole][0].id]}
                </Text>
              )}

              {/* Reactions */}
              <View style={styles.reactionsRow}>
                {SCHOLARLY_REACTIONS.map((r) => {
                  const count = Object.values(contrib.reactions || {}).filter((v) => v === r.id).length;
                  const myReaction = contrib.reactions?.[uid] === r.id;
                  if (count === 0 && !myReaction) return null;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.reactionChip, myReaction && styles.reactionChipActive]}
                      onPress={() => addReaction(memberUid, r.id)}
                    >
                      <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                      {count > 0 && <Text style={styles.reactionCount}>{count}</Text>}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity style={styles.addReactionBtn} onPress={() => setViewingMember(memberUid)}>
                  <Ionicons name="add" size={12} color="#444" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>
    );
  }

  // ---- VIEWING ANOTHER MEMBER'S CONTRIBUTION ----
  if (viewingMember) {
    const contrib = contributions[viewingMember];
    const memberRole = groupData?.memberRoles?.[viewingMember] || "member";
    const memberName = groupData?.memberNames?.[viewingMember] || "Scholar";
    const memberFields = ROLE_FIELDS[memberRole] || ROLE_FIELDS.member;
    const mColor = ({ analyst: "#D4AF37", narrator: "#a117e0", critic: "#EC4899", historian: "#10B981", connector: "#F59E0B", editor: "#8E2DE2", member: "#666" } as Record<string, string>)[memberRole] || "#666";

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backRow} onPress={() => setViewingMember(null)}>
          <Ionicons name="chevron-back" size={20} color="#FFF" />
          <Text style={styles.backRowText}>BACK</Text>
        </TouchableOpacity>

        <View style={[styles.viewingHeader, { borderColor: mColor + "30" }]}>
          <View style={[styles.viewingAvatar, { backgroundColor: mColor + "20" }]}>
            <Text style={[styles.viewingInitial, { color: mColor }]}>{memberName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.viewingName}>{memberName}</Text>
          <View style={[styles.viewingRoleTag, { borderColor: mColor + "50" }]}>
            <Text style={[styles.viewingRoleText, { color: mColor }]}>{memberRole.toUpperCase()}</Text>
          </View>
        </View>

        {memberFields.map((f) => contrib?.[f.id] ? (
          <View key={f.id} style={styles.viewingField}>
            <Text style={styles.viewingFieldLabel}>{f.label}</Text>
            <Text style={styles.viewingFieldValue}>{contrib[f.id]}</Text>
          </View>
        ) : null)}

        {/* Scholarly reactions */}
        <Text style={styles.sectionTitle}>REACT TO THIS CONTRIBUTION</Text>
        <View style={styles.allReactionsGrid}>
          {SCHOLARLY_REACTIONS.map((r) => {
            const count = Object.values(contrib?.reactions || {}).filter((v) => v === r.id).length;
            const myReaction = contrib?.reactions?.[uid] === r.id;
            return (
              <TouchableOpacity
                key={r.id}
                style={[styles.bigReactionBtn, myReaction && { borderColor: THEME.accent, backgroundColor: "#0D0A00" }]}
                onPress={() => addReaction(viewingMember, r.id)}
              >
                <Text style={styles.bigReactionEmoji}>{r.emoji}</Text>
                <Text style={[styles.bigReactionLabel, myReaction && { color: THEME.accent }]}>{r.label}</Text>
                {count > 0 && <Text style={styles.bigReactionCount}>{count}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ height: 80 }} />
      </ScrollView>
    );
  }

  // ---- CONTRIBUTION FORM ----
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Role Card */}
      <View style={[styles.roleCard, { borderColor: roleColor + "40" }]}>
        <View style={[styles.roleIconCircle, { backgroundColor: roleColor + "20" }]}>
          <MaterialCommunityIcons name="feather" size={22} color={roleColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.roleCardLabel}>YOUR ROLE</Text>
          <Text style={[styles.roleCardTitle, { color: roleColor }]}>{role.toUpperCase()}</Text>
          <Text style={styles.roleCardSub}>Fill all required fields to submit your contribution</Text>
        </View>
        <View style={styles.roleProgress}>
          <Text style={[styles.roleProgressNum, { color: roleColor }]}>
            {fields.filter((f) => fieldValues[f.id]?.trim().length > 0).length}/{fields.length}
          </Text>
          <Text style={styles.roleProgressLabel}>fields</Text>
        </View>
      </View>

      {/* Fields */}
      {fields.map((field, i) => {
        const isFilled = fieldValues[field.id]?.trim().length > 0;
        const isActive = activeField === field.id;

        return (
          <Animated.View
            key={field.id}
            style={[styles.fieldCard, {
              opacity: cardAnims[i],
              transform: [{ translateY: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
              borderColor: isActive ? roleColor + "60" : isFilled ? "#1A3A1A" : THEME.border,
            }]}
          >
            <View style={styles.fieldHeader}>
              <Text style={[styles.fieldLabel, isActive && { color: roleColor }]}>{field.label}</Text>
              <View style={styles.fieldMeta}>
                {field.required && (
                  <Text style={styles.requiredTag}>REQUIRED</Text>
                )}
                {isFilled && (
                  <Ionicons name="checkmark-circle" size={16} color={THEME.success} />
                )}
              </View>
            </View>
            <TextInput
              style={[styles.fieldInput, isActive && { color: "#FFF" }]}
              placeholder={field.placeholder}
              placeholderTextColor="#2A2A2A"
              value={fieldValues[field.id] || ""}
              onChangeText={(v) => handleFieldChange(field.id, v)}
              onFocus={() => setActiveField(field.id)}
              onBlur={() => handleFieldBlur(field.id)}
              multiline
              textAlignVertical="top"
            />
            {isFilled && (
              <Text style={styles.charCount}>{fieldValues[field.id].length} chars</Text>
            )}
          </Animated.View>
        );
      })}

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, !allRequiredFilled && { opacity: 0.35 }, { backgroundColor: roleColor }]}
        onPress={handleSubmit}
        disabled={!allRequiredFilled || submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <Ionicons name="checkmark-circle-outline" size={20} color="#000" />
            <Text style={styles.submitBtnText}>SEAL MY CONTRIBUTION</Text>
          </>
        )}
      </TouchableOpacity>

      {!allRequiredFilled && (
        <Text style={styles.submitHint}>
          {fields.filter((f) => f.required && !fieldValues[f.id]?.trim()).length} required {fields.filter((f) => f.required && !fieldValues[f.id]?.trim()).length === 1 ? "field" : "fields"} remaining
        </Text>
      )}

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  scroll: { padding: 20 },
  sectionTitle: { color: "#333", fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 14, marginTop: 28 },

  roleCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: THEME.surface, padding: 18, borderRadius: 20,
    borderWidth: 1, marginBottom: 24,
  },
  roleIconCircle: { width: 48, height: 48, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  roleCardLabel: { color: "#444", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  roleCardTitle: { fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  roleCardSub: { color: "#444", fontSize: 11, marginTop: 2, lineHeight: 15 },
  roleProgress: { alignItems: "center" },
  roleProgressNum: { fontSize: 22, fontWeight: "900" },
  roleProgressLabel: { color: "#333", fontSize: 9, fontWeight: "700" },

  fieldCard: {
    backgroundColor: THEME.surface, borderRadius: 20,
    borderWidth: 1, padding: 18, marginBottom: 14,
  },
  fieldHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  fieldLabel: { color: "#555", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  fieldMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  requiredTag: { color: THEME.danger, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  fieldInput: { color: "#888", fontSize: 14, lineHeight: 22, minHeight: 80 },
  charCount: { color: "#222", fontSize: 9, textAlign: "right", marginTop: 8 },

  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, padding: 22, borderRadius: 20, marginTop: 10,
  },
  submitBtnText: { color: "#000", fontWeight: "900", fontSize: 14, letterSpacing: 1 },
  submitHint: { color: "#333", fontSize: 11, textAlign: "center", marginTop: 12 },

  // Sealed state
  sealedCard: {
    backgroundColor: THEME.surface, borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: "#1A1A1A", alignItems: "center",
    marginBottom: 28, gap: 10,
  },
  sealedStamp: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  sealedTitle: { fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  sealedSub: { color: "#555", fontSize: 12, textAlign: "center" },
  sealedField: { width: "100%", borderTopWidth: 1, borderColor: "#111", paddingTop: 14, marginTop: 6 },
  sealedFieldLabel: { color: "#444", fontSize: 9, fontWeight: "900", letterSpacing: 1, marginBottom: 6 },
  sealedFieldValue: { color: "#888", fontSize: 13, lineHeight: 20 },

  // Member contribution cards
  memberContribCard: { backgroundColor: THEME.surface, borderRadius: 20, padding: 18, borderWidth: 1, marginBottom: 12, gap: 12 },
  memberContribHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  memberContribAvatar: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  memberContribInitial: { fontSize: 16, fontWeight: "900" },
  memberContribName: { color: "#FFF", fontWeight: "800", fontSize: 14 },
  memberContribRole: { fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 2 },
  sealedMini: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, justifyContent: "center", alignItems: "center" },
  memberContribPreview: { color: "#444", fontSize: 12, lineHeight: 18 },
  reactionsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  reactionChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: "#111", borderWidth: 1, borderColor: "#1A1A1A" },
  reactionChipActive: { borderColor: THEME.accent + "60", backgroundColor: "#0D0A00" },
  reactionEmoji: { fontSize: 12 },
  reactionCount: { color: "#666", fontSize: 10, fontWeight: "700" },
  addReactionBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: "#0A0A0A", borderWidth: 1, borderColor: "#1A1A1A", justifyContent: "center", alignItems: "center" },

  pendingCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: THEME.surface, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: "#111", marginBottom: 10 },
  pendingDot: { width: 10, height: 10, borderRadius: 5 },
  pendingName: { color: "#444", fontWeight: "700", fontSize: 13 },
  pendingRole: { color: "#2A2A2A", fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 2 },
  pendingBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#0A0A0A", borderWidth: 1, borderColor: "#1A1A1A" },
  pendingBadgeText: { color: "#2A2A2A", fontSize: 8, fontWeight: "900", letterSpacing: 1 },

  // Viewing member
  backRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 },
  backRowText: { color: "#FFF", fontWeight: "900", fontSize: 12, letterSpacing: 1 },
  viewingHeader: { alignItems: "center", backgroundColor: THEME.surface, padding: 24, borderRadius: 20, borderWidth: 1, marginBottom: 20, gap: 10 },
  viewingAvatar: { width: 64, height: 64, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  viewingInitial: { fontSize: 28, fontWeight: "900" },
  viewingName: { color: "#FFF", fontSize: 20, fontWeight: "900" },
  viewingRoleTag: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  viewingRoleText: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  viewingField: { backgroundColor: THEME.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: "#111", marginBottom: 12 },
  viewingFieldLabel: { color: "#444", fontSize: 9, fontWeight: "900", letterSpacing: 1, marginBottom: 10 },
  viewingFieldValue: { color: "#AAA", fontSize: 14, lineHeight: 22 },
  allReactionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  bigReactionBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: THEME.surface, borderWidth: 1, borderColor: "#1A1A1A" },
  bigReactionEmoji: { fontSize: 18 },
  bigReactionLabel: { color: "#555", fontSize: 12, fontWeight: "700" },
  bigReactionCount: { color: THEME.accent, fontSize: 11, fontWeight: "900", marginLeft: 4 },
});