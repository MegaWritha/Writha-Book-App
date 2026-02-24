import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, KeyboardAvoidingView, Platform, Switch,
} from "react-native";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const THEME = {
  bg: "#000", surface: "#0A0A0A", accent: "#D4AF37",
  purple: "#8E2DE2", danger: "#FF3B30", textMuted: "#666", border: "#222",
};

const GROUP_PHASES = ["reading", "discussion", "writing", "review", "published"];

export default function GroupSettings({ groupId, groupData }: { groupId: string; groupData?: any }) {
  const [name, setName] = useState(groupData?.name || "");
  const [bio, setBio] = useState(groupData?.bio || "");
  const [isPublic, setIsPublic] = useState(groupData?.visibility !== "private");
  const [hasAI, setHasAI] = useState(groupData?.hasAI || false);
  const [currentPhase, setCurrentPhase] = useState(groupData?.currentPhase || "reading");
  const [saving, setSaving] = useState(false);

  const saveSettings = async () => {
    if (!name.trim()) {
      Alert.alert("VOID INPUT", "A weave must have a name.");
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "groups", groupId), {
        name: name.trim(),
        bio: bio.trim(),
        visibility: isPublic ? "public" : "private",
        hasAI,
        currentPhase,
      });
      Alert.alert("SYNCHRONIZED", "The weave identity has been updated.");
    } catch (e) {
      Alert.alert("SYNC ERROR", "Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* IDENTITY */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="pencil-ruler" size={15} color={THEME.accent} />
            <Text style={styles.sectionLabel}>CORE IDENTITY</Text>
          </View>
          <View style={styles.inputCard}>
            <Text style={styles.innerLabel}>DESIGNATION</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Group name..." placeholderTextColor="#333" />
            <View style={styles.divider} />
            <Text style={styles.innerLabel}>ARCHIVE BIO</Text>
            <TextInput style={[styles.input, styles.bioInput]} value={bio} onChangeText={setBio} multiline placeholder="Describe the weave's purpose..." placeholderTextColor="#333" />
          </View>
          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={saveSettings} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? "SYNCHRONIZING..." : "SYNCHRONIZE CHANGES"}</Text>
          </TouchableOpacity>
        </View>

        {/* PHASE CONTROL */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="timeline-outline" size={15} color={THEME.purple} />
            <Text style={[styles.sectionLabel, { color: THEME.purple }]}>WEAVE PHASE</Text>
          </View>
          <View style={styles.phaseRow}>
            {GROUP_PHASES.map((phase) => (
              <TouchableOpacity
                key={phase}
                style={[styles.phaseChip, currentPhase === phase && styles.phaseChipActive]}
                onPress={() => setCurrentPhase(phase)}
              >
                <Text style={[styles.phaseChipText, currentPhase === phase && { color: "#000" }]}>
                  {phase.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.phaseHint}>Moving a phase notifies all members and unlocks new tools.</Text>
        </View>

        {/* SETTINGS TOGGLES */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="shield-check" size={15} color={THEME.purple} />
            <Text style={[styles.sectionLabel, { color: THEME.purple }]}>WEAVE SETTINGS</Text>
          </View>

          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="earth-outline" size={20} color={isPublic ? "#22C55E" : THEME.textMuted} />
                <View style={{ marginLeft: 14 }}>
                  <Text style={styles.settingTitle}>Public Visibility</Text>
                  <Text style={styles.settingSub}>{isPublic ? "Anyone can discover and join" : "Invite-only — members must be added"}</Text>
                </View>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: "#1A1A1A", true: "#22C55E40" }}
                thumbColor={isPublic ? "#22C55E" : "#333"}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <MaterialCommunityIcons name="brain" size={20} color={hasAI ? THEME.accent : THEME.textMuted} />
                <View style={{ marginLeft: 14 }}>
                  <Text style={styles.settingTitle}>AI Scholar Member</Text>
                  <Text style={styles.settingSub}>{hasAI ? "AI can be summoned with @ai" : "AI assistance is disabled"}</Text>
                </View>
              </View>
              <Switch
                value={hasAI}
                onValueChange={setHasAI}
                trackColor={{ false: "#1A1A1A", true: THEME.accent + "40" }}
                thumbColor={hasAI ? THEME.accent : "#333"}
              />
            </View>
          </View>
        </View>

        {/* PUBLISHING */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="megaphone-outline" size={15} color={THEME.accent} />
            <Text style={styles.sectionLabel}>PUBLISH OUTPUT</Text>
          </View>
          <TouchableOpacity style={styles.publishBtn} onPress={() => Alert.alert("BROADCASTING", "This pushes the weave output to the Global Feed.")}>
            <View style={styles.publishIconCircle}>
              <Ionicons name="megaphone" size={16} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.publishTitle}>Push to Global Feed</Text>
              <Text style={styles.publishSub}>Share the compiled output with all scholars</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>

        {/* DANGER ZONE */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="alert-octagon" size={15} color={THEME.danger} />
            <Text style={[styles.sectionLabel, { color: THEME.danger }]}>DANGER ZONE</Text>
          </View>
          <View style={styles.dangerCard}>
            <TouchableOpacity style={styles.dangerRow} onPress={() => Alert.alert("ARCHIVE", "This will make the thread read-only.")}>
              <Text style={styles.dangerTitle}>Archive Weave</Text>
              <Text style={styles.dangerSub}>Make this thread read-only</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.dangerRow} onPress={() => Alert.alert("DISSOLVE", "This permanently erases the weave. Are you sure?")}>
              <Text style={[styles.dangerTitle, { color: THEME.danger }]}>Dissolve Thread</Text>
              <Text style={styles.dangerSub}>Permanently erase from the loom</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  scroll: { padding: 24 },
  section: { marginBottom: 36 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionLabel: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  inputCard: { backgroundColor: THEME.surface, borderRadius: 20, borderWidth: 1, borderColor: THEME.border, padding: 20 },
  innerLabel: { color: "#444", fontSize: 9, fontWeight: "900", letterSpacing: 1, marginBottom: 8 },
  input: { color: "#FFF", fontSize: 15, paddingVertical: 8, fontWeight: "600" },
  bioInput: { minHeight: 80, textAlignVertical: "top", lineHeight: 22 },
  divider: { height: 1, backgroundColor: "#111", marginVertical: 14 },
  saveBtn: { marginTop: 14, backgroundColor: THEME.accent, padding: 18, borderRadius: 16, alignItems: "center" },
  saveBtnText: { color: "#000", fontWeight: "900", fontSize: 12, letterSpacing: 1 },
  phaseRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  phaseChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: "#222", backgroundColor: "#0A0A0A" },
  phaseChipActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  phaseChipText: { color: "#555", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  phaseHint: { color: "#333", fontSize: 11, marginTop: 10, lineHeight: 16 },
  settingsCard: { backgroundColor: THEME.surface, borderRadius: 20, borderWidth: 1, borderColor: THEME.border, overflow: "hidden" },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18 },
  settingLeft: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 10 },
  settingTitle: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  settingSub: { color: THEME.textMuted, fontSize: 11, marginTop: 2, lineHeight: 16 },
  publishBtn: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.purple, padding: 18, borderRadius: 18, gap: 14 },
  publishIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  publishTitle: { color: "#FFF", fontWeight: "900", fontSize: 14 },
  publishSub: { color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2 },
  dangerCard: { backgroundColor: THEME.surface, borderRadius: 20, borderWidth: 1, borderColor: THEME.border },
  dangerRow: { padding: 20 },
  dangerTitle: { color: "#FFF", fontWeight: "800", fontSize: 14 },
  dangerSub: { color: "#444", fontSize: 11, marginTop: 4 },
});