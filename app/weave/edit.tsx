import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

const WEAVE_TYPES = ["post", "discussion", "research", "article"];

export default function EditWeaveScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [findings, setFindings] = useState("");
  const [weaveType, setWeaveType] = useState("post");
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (!id) return;
    const fetchWeave = async () => {
      const snap = await getDoc(doc(db, "weaves", id));
      if (snap.exists()) {
        const data = snap.data();
        // Verify ownership
        if (data.userId !== user?.uid) {
          Alert.alert("Error", "You can only edit your own weaves.");
          router.back();
          return;
        }
        setContent(data.content || "");
        setTitle(data.title || "");
        setFindings(data.findings || "");
        setWeaveType(data.type || "post");
        setTags(data.tags ? data.tags.join(", ") : "");
      }
      setLoading(false);
    };
    fetchWeave();
  }, [id]);

  const handleSave = async () => {
    if (!id || !user) return;
    if (!content.trim() && !findings.trim()) {
      Alert.alert("Error", "Weave content cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      const tagsArray = tags
        .split(",")
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);

      await updateDoc(doc(db, "weaves", id), {
        content: content.trim(),
        title: title.trim(),
        findings: findings.trim(),
        type: weaveType,
        tags: tagsArray,
        editedAt: new Date(),
        isEdited: true,
      });

      Alert.alert("Success", "Weave updated successfully!", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch {
      Alert.alert("Error", "Failed to update weave. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color="#FFD700" />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFD700" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Weave</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={styles.saveBtn}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color="#0F071A" />
            : <Text style={styles.saveBtnText}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* WEAVE TYPE SELECTOR */}
        <Text style={styles.label}>WEAVE TYPE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
          {WEAVE_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.typeChip, weaveType === type && styles.typeChipActive]}
              onPress={() => setWeaveType(type)}
            >
              <Text style={[styles.typeChipText, weaveType === type && styles.typeChipTextActive]}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* TITLE (for research and articles) */}
        {(weaveType === "research" || weaveType === "article") && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>TITLE</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter a title..."
              placeholderTextColor="#4C1D95"
              autoCapitalize="sentences"
            />
          </View>
        )}

        {/* MAIN CONTENT */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {weaveType === "discussion" ? "DISCUSSION PROMPT" : "CONTENT"}
          </Text>
          <TextInput
            style={[styles.input, styles.contentInput]}
            value={content}
            onChangeText={setContent}
            placeholder={
              weaveType === "discussion"
                ? "What's the discussion about?"
                : weaveType === "research"
                ? "Share your research..."
                : "What's on your mind?"
            }
            placeholderTextColor="#4C1D95"
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />
          <Text style={styles.charCount}>{content.length}/2000</Text>
        </View>

        {/* FINDINGS (for research) */}
        {weaveType === "research" && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>KEY FINDINGS</Text>
            <TextInput
              style={[styles.input, styles.findingsInput]}
              value={findings}
              onChangeText={setFindings}
              placeholder="Summarize your key findings..."
              placeholderTextColor="#4C1D95"
              multiline
              textAlignVertical="top"
              maxLength={1000}
            />
            <Text style={styles.charCount}>{findings.length}/1000</Text>
          </View>
        )}

        {/* TAGS */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>TAGS</Text>
          <TextInput
            style={styles.input}
            value={tags}
            onChangeText={setTags}
            placeholder="writing, nigeria, fiction (comma separated)"
            placeholderTextColor="#4C1D95"
            autoCapitalize="none"
          />
          <Text style={styles.hint}>Separate tags with commas</Text>
        </View>

        {/* EDITED NOTICE */}
        <View style={styles.editNotice}>
          <Ionicons name="information-circle-outline" size={16} color="#A78BFA" />
          <Text style={styles.editNoticeText}>
            Edited weaves will be marked as "edited" for transparency.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F071A" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F071A" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1E1135", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#FFF" },
  saveBtn: { backgroundColor: "#FFD700", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  saveBtnText: { color: "#0F071A", fontWeight: "800", fontSize: 14 },
  scroll: { paddingHorizontal: 20, paddingTop: 10 },
  label: { color: "#A78BFA", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: 10 },
  typeRow: { marginBottom: 24, flexDirection: "row" },
  typeChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: "#1E1135", marginRight: 10, borderWidth: 1, borderColor: "#2D1B4E" },
  typeChipActive: { backgroundColor: "#4C1D95", borderColor: "#FFD700" },
  typeChipText: { color: "#4C1D95", fontWeight: "700", fontSize: 14 },
  typeChipTextActive: { color: "#FFD700" },
  inputGroup: { marginBottom: 20 },
  input: { backgroundColor: "#1E1135", color: "#FFF", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, borderWidth: 1, borderColor: "#2D1B4E" },
  contentInput: { height: 160, paddingTop: 14 },
  findingsInput: { height: 120, paddingTop: 14 },
  charCount: { color: "#4C1D95", fontSize: 11, textAlign: "right", marginTop: 6 },
  hint: { color: "#4C1D95", fontSize: 11, marginTop: 6 },
  editNotice: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#1E1135", padding: 14, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: "#A78BFA" },
  editNoticeText: { color: "#A78BFA", fontSize: 13, flex: 1, lineHeight: 20 },
});