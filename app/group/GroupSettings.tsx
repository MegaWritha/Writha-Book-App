import React, { useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  KeyboardAvoidingView, 
  Platform 
} from "react-native";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const THEME = {
  bg: "#000",
  surface: "#0A0A0A",
  accent: "#D4AF37", // Gold
  purple: "#8E2DE2",
  danger: "#FF3B30",
  textMuted: "#666",
  border: "#222"
};

export default function GroupSettings({ groupId, groupData }: { groupId: string, groupData?: any }) {
  const [bio, setBio] = useState(groupData?.bio || "");
  const [name, setName] = useState(groupData?.name || "");

  const saveSettings = async () => {
    if (!name.trim()) {
      Alert.alert("VOID INPUT", "A weave must have a name to exist in the archive.");
      return;
    }
    
    try {
      const groupRef = doc(db, "groups", groupId);
      await updateDoc(groupRef, {
        name: name.trim(),
        bio: bio.trim(),
      });
      Alert.alert("IDENTITY REFRAMED", "The thread metadata has been synchronized.");
    } catch (e) {
      console.error(e);
      Alert.alert("SYNC ERROR", "The ink didn't dry. Check your connection.");
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={{ flex: 1 }}
    >
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* IDENTITY SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="pencil-ruler" size={16} color={THEME.accent} />
            <Text style={styles.label}>CORE IDENTITY</Text>
          </View>
          
          <View style={styles.inputCard}>
            <Text style={styles.innerLabel}>DESIGNATION</Text>
            <TextInput 
              style={styles.input} 
              value={name} 
              onChangeText={setName} 
              placeholder="Enter Group Name..." 
              placeholderTextColor="#333" 
            />
            
            <View style={styles.divider} />
            
            <Text style={styles.innerLabel}>ARCHIVE BIO</Text>
            <TextInput 
              style={[styles.input, styles.bioInput]} 
              value={bio} 
              onChangeText={setBio} 
              multiline 
              placeholder="Describe the research, critique goals, or the shared vision of this weave..." 
              placeholderTextColor="#333" 
            />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={saveSettings}>
            <Text style={styles.saveText}>SYNCHRONIZE CHANGES</Text>
          </TouchableOpacity>
        </View>

        {/* PUBLISHING & PRIVACY */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="shield-check" size={16} color={THEME.purple} />
            <Text style={[styles.label, { color: THEME.purple }]}>WEAVE VISIBILITY</Text>
          </View>

          <View style={styles.optionCard}>
            <View style={styles.optionHeader}>
              <Ionicons name="eye-outline" size={20} color={THEME.accent} />
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Discoverable Mode</Text>
                <Text style={styles.optionSub}>Allow other scholars to find this thread in the Archive Search.</Text>
              </View>
              <MaterialCommunityIcons name="toggle-switch-off" size={32} color="#333" />
            </View>
          </View>

          <TouchableOpacity 
            style={styles.publishAction} 
            onPress={() => Alert.alert("STAGING", "This feature will broadcast your critique to the Global Feed.")}
          >
            <View style={styles.publishIconCircle}>
              <Ionicons name="megaphone" size={18} color="#FFF" />
            </View>
            <View style={styles.publishTextGroup}>
              <Text style={styles.publishText}>Push to Global Feed</Text>
              <Text style={styles.publishSubText}>Exhibit this weave's brilliance</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        {/* MANAGEMENT */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="alert-octagon" size={16} color={THEME.danger} />
            <Text style={[styles.label, { color: THEME.danger }]}>DANGER ZONE</Text>
          </View>
          
          <View style={styles.dangerCard}>
            <TouchableOpacity style={styles.dangerAction}>
              <Text style={styles.dangerText}>Archive Weave</Text>
              <Text style={styles.dangerSub}>Make this thread read-only</Text>
            </TouchableOpacity>
            
            <View style={styles.divider} />

            <TouchableOpacity style={styles.dangerAction}>
              <Text style={styles.dangerText}>Dissolve Thread</Text>
              <Text style={styles.dangerSub}>Permanently erase from the loom</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  scrollContent: { padding: 25, paddingBottom: 100 },
  section: { marginBottom: 40 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15 },
  label: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  
  inputCard: { backgroundColor: THEME.surface, borderRadius: 20, borderWidth: 1, borderColor: THEME.border, padding: 20 },
  innerLabel: { color: "#444", fontSize: 9, fontWeight: "900", marginBottom: 8, letterSpacing: 1 },
  input: { color: "#FFF", fontSize: 16, paddingVertical: 10, fontWeight: '600' },
  bioInput: { minHeight: 80, textAlignVertical: 'top', lineHeight: 22 },
  divider: { height: 1, backgroundColor: "#1A1A1A", marginVertical: 15 },

  saveBtn: { marginTop: 15, backgroundColor: THEME.accent, padding: 18, borderRadius: 15, alignItems: "center" },
  saveText: { color: "#000", fontWeight: "900", fontSize: 12, letterSpacing: 1 },

  optionCard: { backgroundColor: THEME.surface, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: THEME.border },
  optionHeader: { flexDirection: 'row', alignItems: 'center' },
  optionTextContainer: { flex: 1, marginLeft: 15 },
  optionTitle: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  optionSub: { color: THEME.textMuted, fontSize: 12, marginTop: 4, lineHeight: 18 },

  publishAction: { 
    marginTop: 15,
    backgroundColor: THEME.purple, 
    flexDirection: 'row', 
    padding: 20, 
    borderRadius: 20, 
    alignItems: "center",
    gap: 15 
  },
  publishIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  publishTextGroup: { flex: 1 },
  publishText: { color: "#FFF", fontWeight: "900", fontSize: 15 },
  publishSubText: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 },

  dangerCard: { backgroundColor: THEME.surface, borderRadius: 20, borderWidth: 1, borderColor: THEME.border, overflow: 'hidden' },
  dangerAction: { padding: 20 },
  dangerText: { color: THEME.danger, fontWeight: "800", fontSize: 15 },
  dangerSub: { color: "#444", fontSize: 11, marginTop: 4 }
});