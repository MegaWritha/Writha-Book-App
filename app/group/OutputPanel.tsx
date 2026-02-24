import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, Dimensions,
} from "react-native";
import { doc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#000000", surface: "#0A0A0A", accent: "#D4AF37",
  purple: "#8E2DE2", text: "#FFFFFF", textMuted: "#555555",
  border: "#1A1A1A", success: "#22C55E", danger: "#FF3B30",
};

const ROLE_COLORS: Record<string, string> = {
  analyst: "#D4AF37", narrator: "#3B82F6", critic: "#EC4899",
  historian: "#10B981", connector: "#F59E0B", editor: "#8E2DE2", member: "#666",
};

const ROLE_FIELDS: Record<string, { id: string; label: string }[]> = {
  analyst:   [
    { id: "thesis",     label: "Central Thesis" },
    { id: "structure",  label: "Structural Analysis" },
    { id: "evidence",   label: "Key Evidence" },
    { id: "weakness",   label: "Analytical Gaps" },
  ],
  narrator:  [
    { id: "voice",      label: "Narrative Voice" },
    { id: "arc",        label: "Story Arc" },
    { id: "tension",    label: "Tension Points" },
    { id: "resolution", label: "Resolution" },
  ],
  critic:    [
    { id: "strengths",  label: "Strengths" },
    { id: "weaknesses", label: "Weaknesses" },
    { id: "style",      label: "Writing Style" },
    { id: "verdict",    label: "Final Verdict" },
  ],
  historian: [
    { id: "context",    label: "Historical Context" },
    { id: "influences", label: "Key Influences" },
    { id: "legacy",     label: "Lasting Impact" },
  ],
  connector: [
    { id: "parallels",  label: "Parallel Works" },
    { id: "themes",     label: "Recurring Themes" },
    { id: "contrast",   label: "Contrasts" },
  ],
  editor:    [
    { id: "summary",    label: "Executive Summary" },
    { id: "cohesion",   label: "Cohesion Notes" },
    { id: "polish",     label: "Polish Suggestions" },
  ],
  member:    [
    { id: "thoughts",   label: "Thoughts & Insights" },
    { id: "questions",  label: "Questions Raised" },
  ],
};

// Extracted as a proper component to fix the void return / scope errors
function ContribSection({
  memberUid,
  groupData,
}: {
  memberUid: string;
  groupData: any;
}) {
  const contributions: Record<string, any> = groupData?.contributions || {};
  const contrib = contributions[memberUid] || {};
  const memberRole: string = groupData?.memberRoles?.[memberUid] || "member";
  const memberName: string = groupData?.memberNames?.[memberUid] || "Scholar";
  const fields = ROLE_FIELDS[memberRole] || ROLE_FIELDS.member;
  const roleColor = ROLE_COLORS[memberRole] || "#666";

  return (
    <View style={[styles.contribSection, { borderLeftColor: roleColor }]}>
      <View style={styles.contribSectionHeader}>
        <View style={[styles.contribAvatar, { backgroundColor: roleColor + "20" }]}>
          <Text style={[styles.contribInitial, { color: roleColor }]}>
            {memberName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.contribName}>{memberName}</Text>
          <Text style={[styles.contribRole, { color: roleColor }]}>
            {memberRole.toUpperCase()}
          </Text>
        </View>
        <View style={[styles.sealBadge, { borderColor: roleColor }]}>
          <Ionicons name="checkmark" size={10} color={roleColor} />
          <Text style={[styles.sealText, { color: roleColor }]}>SEALED</Text>
        </View>
      </View>

      {fields.map((f) =>
        contrib[f.id] ? (
          <View key={f.id} style={styles.outputField}>
            <Text style={styles.outputFieldLabel}>{f.label.toUpperCase()}</Text>
            <Text style={styles.outputFieldValue}>{contrib[f.id]}</Text>
          </View>
        ) : null
      )}
    </View>
  );
}

// Extracted approval thumb as component
function ApprovalThumb({
  memberUid,
  groupData,
  approvals,
}: {
  memberUid: string;
  groupData: any;
  approvals: string[];
}) {
  const approved = approvals.includes(memberUid);
  const name: string = groupData?.memberNames?.[memberUid] || "S";
  return (
    <View style={[styles.approvalThumb, approved && styles.approvalThumbDone]}>
      <Text style={[styles.approvalThumbText, approved && { color: THEME.success }]}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

interface OutputPanelProps {
  groupId: string;
  groupData: any;
}

export default function OutputPanel({ groupId, groupData }: OutputPanelProps) {
  const [publishing, setPublishing] = useState(false);
  const [approvals, setApprovals] = useState<string[]>(
    groupData?.outputApprovals || []
  );

  const uid = auth.currentUser?.uid || "";
  const contributions: Record<string, any> = groupData?.contributions || {};
  const members: string[] = groupData?.members || [];
  const submittedMembers = members.filter(
    (m) => contributions[m]?.submitted
  );
  const allSubmitted =
    submittedMembers.length === members.length && members.length > 0;
  const completionPct =
    members.length > 0
      ? Math.round((submittedMembers.length / members.length) * 100)
      : 0;

  const isPublished = groupData?.currentPhase === "published";
  const myApproval = approvals.includes(uid);
  const approvalPct =
    members.length > 0
      ? Math.round((approvals.length / members.length) * 100)
      : 0;

  const handleApprove = async () => {
    if (approvals.includes(uid)) return;
    const newApprovals = [...approvals, uid];
    setApprovals(newApprovals);
    try {
      await updateDoc(doc(db, "groups", groupId), {
        outputApprovals: newApprovals,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handlePublish = async () => {
    if (!allSubmitted) {
      Alert.alert(
        "NOT READY",
        "All members must submit their contributions before publishing."
      );
      return;
    }
    setPublishing(true);
    try {
      await addDoc(collection(db, "feed"), {
        type: "group_output",
        groupId,
        groupName: groupData.name,
        groupType: groupData.type,
        bookTitle: groupData.bookTitle || null,
        bookAuthor: groupData.bookAuthor || null,
        topic: groupData.topic || null,
        contributions,
        members,
        memberRoles: groupData.memberRoles || {},
        memberNames: groupData.memberNames || {},
        publishedBy: uid,
        publishedAt: serverTimestamp(),
        approvals,
      });
      await updateDoc(doc(db, "groups", groupId), {
        currentPhase: "published",
        publishedAt: serverTimestamp(),
      });
      Alert.alert(
        "BROADCAST COMPLETE",
        "The weave has been published to the Global Archive."
      );
    } catch (e) {
      Alert.alert("PUBLISH FAILED", "Check your connection and try again.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* Document Header */}
      <View style={styles.docHeader}>
        <View style={styles.docHeaderTop}>
          <MaterialCommunityIcons
            name="file-document-outline"
            size={20}
            color={THEME.accent}
          />
          <Text style={styles.docLabel}>COMPILED OUTPUT</Text>
          {isPublished && (
            <View style={styles.publishedBadge}>
              <Ionicons name="checkmark-circle" size={12} color={THEME.success} />
              <Text style={styles.publishedText}>PUBLISHED</Text>
            </View>
          )}
        </View>
        <Text style={styles.docTitle}>{groupData.name}</Text>
        {(groupData.bookTitle || groupData.topic) && (
          <Text style={styles.docSubtitle}>
            {groupData.bookTitle
              ? `"${groupData.bookTitle}"`
              : groupData.topic}
            {groupData.bookAuthor ? ` — ${groupData.bookAuthor}` : ""}
          </Text>
        )}
        <Text style={styles.docMeta}>
          {groupData.type?.toUpperCase()} · {members.length} CONTRIBUTORS
        </Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${completionPct}%` as any,
                backgroundColor:
                  completionPct === 100 ? THEME.success : THEME.accent,
              },
            ]}
          />
        </View>
        <Text style={styles.progressLabel}>
          {completionPct}% of contributions received
        </Text>
      </View>

      {/* Contributions */}
      {submittedMembers.length === 0 ? (
        <View style={styles.emptyOutput}>
          <MaterialCommunityIcons
            name="file-clock-outline"
            size={48}
            color="#1A1A1A"
          />
          <Text style={styles.emptyTitle}>OUTPUT ASSEMBLING</Text>
          <Text style={styles.emptySub}>
            Contributions will appear here as members submit their work.
          </Text>
        </View>
      ) : (
        submittedMembers.map((memberUid) => (
          <ContribSection
            key={memberUid}
            memberUid={memberUid}
            groupData={groupData}
          />
        ))
      )}

      {/* Approval + Publish */}
      {allSubmitted && !isPublished && (
        <View style={styles.publishSection}>
          <View style={styles.approvalHeader}>
            <Text style={styles.approvalTitle}>READY TO BROADCAST?</Text>
            <Text style={styles.approvalSub}>
              {approvals.length}/{members.length} members approved ·{" "}
              {approvalPct}%
            </Text>
          </View>

          <View style={styles.approvalAvatars}>
            {members.map((m) => (
              <ApprovalThumb
                key={m}
                memberUid={m}
                groupData={groupData}
                approvals={approvals}
              />
            ))}
          </View>

          {!myApproval ? (
            <TouchableOpacity style={styles.approveBtn} onPress={handleApprove}>
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color="#000"
              />
              <Text style={styles.approveBtnText}>APPROVE OUTPUT</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.approvedBadge}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={THEME.success}
              />
              <Text style={styles.approvedText}>YOU APPROVED THIS OUTPUT</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.publishBtn,
              (publishing || approvals.length < members.length) && {
                opacity: 0.4,
              },
            ]}
            onPress={handlePublish}
            disabled={publishing || approvals.length < members.length}
          >
            {publishing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons
                  name="megaphone-outline"
                  size={20}
                  color="#FFF"
                />
                <Text style={styles.publishBtnText}>
                  BROADCAST TO ARCHIVE
                </Text>
              </>
            )}
          </TouchableOpacity>

          {approvals.length < members.length && (
            <Text style={styles.publishHint}>
              Waiting for all members to approve before broadcasting.
            </Text>
          )}
        </View>
      )}

      {isPublished && (
        <View style={styles.publishedCard}>
          <Ionicons name="megaphone" size={32} color={THEME.success} />
          <Text style={styles.publishedCardTitle}>WEAVE BROADCAST</Text>
          <Text style={styles.publishedCardSub}>
            This output has been published to the Global Archive.
          </Text>
        </View>
      )}

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  scroll: { padding: 20 },

  docHeader: {
    backgroundColor: THEME.surface, borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: THEME.border, marginBottom: 20, gap: 8,
  },
  docHeaderTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  docLabel: { color: THEME.accent, fontSize: 9, fontWeight: "900", letterSpacing: 2, flex: 1 },
  publishedBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#001A0A", paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1, borderColor: THEME.success + "40",
  },
  publishedText: { color: THEME.success, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  docTitle: { color: "#FFF", fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  docSubtitle: { color: THEME.accent, fontSize: 14, fontStyle: "italic" },
  docMeta: { color: "#444", fontSize: 10, fontWeight: "700", letterSpacing: 1 },

  progressBar: { marginBottom: 24, gap: 8 },
  progressTrack: { height: 4, backgroundColor: "#0A0A0A", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  progressLabel: { color: "#333", fontSize: 10, fontWeight: "700" },

  emptyOutput: { alignItems: "center", paddingVertical: 60, gap: 14 },
  emptyTitle: { color: "#222", fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  emptySub: { color: "#1A1A1A", fontSize: 12, textAlign: "center", lineHeight: 18 },

  contribSection: {
    backgroundColor: THEME.surface, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: THEME.border, borderLeftWidth: 3,
    marginBottom: 16, gap: 16,
  },
  contribSectionHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  contribAvatar: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  contribInitial: { fontSize: 18, fontWeight: "900" },
  contribName: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  contribRole: { fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 2 },
  sealBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
  },
  sealText: { fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  outputField: { borderTopWidth: 1, borderColor: "#111", paddingTop: 14, gap: 6 },
  outputFieldLabel: { color: "#333", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  outputFieldValue: { color: "#888", fontSize: 14, lineHeight: 22 },

  publishSection: {
    backgroundColor: THEME.surface, borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: THEME.border, marginTop: 10, gap: 16,
  },
  approvalHeader: { gap: 4 },
  approvalTitle: { color: "#FFF", fontSize: 16, fontWeight: "900" },
  approvalSub: { color: "#444", fontSize: 12 },
  approvalAvatars: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  approvalThumb: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#111", borderWidth: 1, borderColor: "#1A1A1A",
    justifyContent: "center", alignItems: "center",
  },
  approvalThumbDone: { backgroundColor: "#001A0A", borderColor: THEME.success + "60" },
  approvalThumbText: { color: "#333", fontWeight: "900", fontSize: 13 },
  approveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, backgroundColor: THEME.accent, padding: 18, borderRadius: 16,
  },
  approveBtnText: { color: "#000", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
  approvedBadge: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#001A0A", padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: THEME.success + "40",
  },
  approvedText: { color: THEME.success, fontWeight: "900", fontSize: 11, letterSpacing: 1 },
  publishBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, backgroundColor: THEME.purple, padding: 20, borderRadius: 16,
  },
  publishBtnText: { color: "#FFF", fontWeight: "900", fontSize: 14, letterSpacing: 1 },
  publishHint: { color: "#333", fontSize: 11, textAlign: "center" },

  publishedCard: {
    alignItems: "center", backgroundColor: "#001A0A", borderRadius: 20,
    padding: 30, borderWidth: 1, borderColor: THEME.success + "30",
    marginTop: 10, gap: 12,
  },
  publishedCardTitle: { color: THEME.success, fontSize: 18, fontWeight: "900", letterSpacing: 1 },
  publishedCardSub: { color: "#444", fontSize: 13, textAlign: "center", lineHeight: 20 },
});