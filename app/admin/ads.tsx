import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, StatusBar,
  Modal, KeyboardAvoidingView, Platform, Switch, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { db } from "@/lib/firebase";
import {
  collection, onSnapshot, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp, orderBy, query,
} from "firebase/firestore";

const THEME = {
  bg: "#0F071A", ui: "#1E1135", ui2: "#2D1B4D",
  accent: "#FFD700", text: "#E2E8F0", textMuted: "#94A3B8",
  green: "#22C55E", red: "#EF4444", blue: "#38BDF8",
};

export default function AdsScreen() {
  const router = useRouter();
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAd, setEditingAd] = useState<any>(null);

  const [title, setTitle]         = useState("");
  const [body, setBody]           = useState("");
  const [imageUrl, setImageUrl]   = useState("");
  const [linkUrl, setLinkUrl]     = useState("");
  const [adType, setAdType]       = useState<"banner" | "popup" | "feed">("feed");
  const [isActive, setIsActive]   = useState(true);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "ads"), 
      (snap) => {
        setAds(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (error) => {
        // Collection doesn't exist yet
        setAds([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const resetForm = () => {
    setTitle(""); setBody(""); setImageUrl("");
    setLinkUrl(""); setAdType("feed"); setIsActive(true);
    setEditingAd(null);
  };

  const openCreate = () => { resetForm(); setShowModal(true); };

  const openEdit = (ad: any) => {
    setEditingAd(ad);
    setTitle(ad.title || "");
    setBody(ad.body || "");
    setImageUrl(ad.imageUrl || "");
    setLinkUrl(ad.linkUrl || "");
    setAdType(ad.adType || "feed");
    setIsActive(ad.isActive ?? true);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert("Missing", "Please enter an ad title."); return; }
    setSaving(true);
    try {
      const data = {
        title, body, imageUrl, linkUrl, adType, isActive,
        updatedAt: serverTimestamp(),
      };
      if (editingAd) {
        await updateDoc(doc(db, "ads", editingAd.id), data);
      } else {
        await addDoc(collection(db, "ads"), { ...data, createdAt: serverTimestamp(), impressions: 0, clicks: 0 });
      }
      setShowModal(false);
      resetForm();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (adId: string, adTitle: string) => {
    Alert.alert("Delete Ad", `Delete "${adTitle}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => { await deleteDoc(doc(db, "ads", adId)); }
      }
    ]);
  };

  const toggleActive = async (adId: string, current: boolean) => {
    await updateDoc(doc(db, "ads", adId), { isActive: !current });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={THEME.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ADS MANAGER</Text>
        <TouchableOpacity style={styles.createBtn} onPress={openCreate}>
          <Ionicons name="add" size={22} color="#000" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={THEME.accent} style={{ marginTop: 40 }} />
      ) : ads.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 40 }}>📢</Text>
          <Text style={styles.emptyTxt}>No ads yet</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={openCreate}>
            <Text style={styles.emptyBtnTxt}>Create First Ad</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={ads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 14 }}
          renderItem={({ item }) => (
            <View style={[styles.adCard, !item.isActive && styles.adCardInactive]}>
              <View style={styles.adHeader}>
                <View style={[styles.adTypeBadge, {
                  backgroundColor: item.adType === "banner" ? THEME.blue + "20" :
                    item.adType === "popup" ? THEME.accent + "20" : THEME.green + "20"
                }]}>
                  <Text style={[styles.adTypeTxt, {
                    color: item.adType === "banner" ? THEME.blue :
                      item.adType === "popup" ? THEME.accent : THEME.green
                  }]}>
                    {(item.adType || "feed").toUpperCase()}
                  </Text>
                </View>
                <Switch
                  value={item.isActive}
                  onValueChange={() => toggleActive(item.id, item.isActive)}
                  trackColor={{ false: THEME.ui2, true: THEME.green + "80" }}
                  thumbColor={item.isActive ? THEME.green : THEME.textMuted}
                />
              </View>

              <Text style={styles.adTitle}>{item.title}</Text>
              {item.body ? <Text style={styles.adBody} numberOfLines={2}>{item.body}</Text> : null}

              <View style={styles.adStats}>
                <View style={styles.adStat}>
                  <Ionicons name="eye-outline" size={12} color={THEME.textMuted} />
                  <Text style={styles.adStatTxt}>{item.impressions || 0} views</Text>
                </View>
                <View style={styles.adStat}>
                  <Ionicons name="hand-left-outline" size={12} color={THEME.textMuted} />
                  <Text style={styles.adStatTxt}>{item.clicks || 0} clicks</Text>
                </View>
              </View>

              <View style={styles.adActions}>
                <TouchableOpacity
                  style={styles.adEditBtn}
                  onPress={() => openEdit(item)}
                >
                  <Ionicons name="pencil" size={14} color={THEME.accent} />
                  <Text style={styles.adEditTxt}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.adDeleteBtn}
                  onPress={() => handleDelete(item.id, item.title)}
                >
                  <Ionicons name="trash" size={14} color={THEME.red} />
                  <Text style={styles.adDeleteTxt}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* CREATE / EDIT MODAL */}
      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {editingAd ? "EDIT AD" : "CREATE AD"}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>AD TITLE *</Text>
              <TextInput style={styles.input} placeholder="e.g. Summer Reading Sale" placeholderTextColor={THEME.textMuted} value={title} onChangeText={setTitle} />

              <Text style={styles.fieldLabel}>BODY TEXT</Text>
              <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]} placeholder="Ad description..." placeholderTextColor={THEME.textMuted} value={body} onChangeText={setBody} multiline />

              <Text style={styles.fieldLabel}>IMAGE URL</Text>
              <TextInput style={styles.input} placeholder="https://..." placeholderTextColor={THEME.textMuted} value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" />

              <Text style={styles.fieldLabel}>LINK URL</Text>
              <TextInput style={styles.input} placeholder="https://..." placeholderTextColor={THEME.textMuted} value={linkUrl} onChangeText={setLinkUrl} autoCapitalize="none" />

              <Text style={styles.fieldLabel}>AD TYPE</Text>
              <View style={styles.typeRow}>
                {(["feed", "banner", "popup"] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typePill, adType === t && styles.typePillActive]}
                    onPress={() => setAdType(t)}
                  >
                    <Text style={[styles.typePillTxt, adType === t && styles.typePillTxtActive]}>
                      {t.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.activeRow}>
                <Text style={styles.activeTxt}>Active / Visible</Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: THEME.ui2, true: THEME.green + "80" }}
                  thumbColor={isActive ? THEME.green : THEME.textMuted}
                />
              </View>

              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => { setShowModal(false); resetForm(); }}
                >
                  <Text style={styles.cancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveTxt}>SAVE AD</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: THEME.accent, fontSize: 14, fontWeight: "900", letterSpacing: 3 },
  createBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.accent, justifyContent: "center", alignItems: "center" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyTxt: { color: THEME.textMuted, fontSize: 14 },
  emptyBtn: { backgroundColor: THEME.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  emptyBtnTxt: { color: "#000", fontWeight: "900" },
  adCard: { backgroundColor: THEME.ui, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: THEME.ui2 },
  adCardInactive: { opacity: 0.5 },
  adHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  adTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  adTypeTxt: { fontSize: 9, fontWeight: "900" },
  adTitle: { color: THEME.text, fontSize: 15, fontWeight: "900", marginBottom: 6 },
  adBody: { color: THEME.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 10 },
  adStats: { flexDirection: "row", gap: 16, marginBottom: 12 },
  adStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  adStatTxt: { color: THEME.textMuted, fontSize: 11 },
  adActions: { flexDirection: "row", gap: 10 },
  adEditBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: THEME.accent + "40" },
  adEditTxt: { color: THEME.accent, fontSize: 11, fontWeight: "700" },
  adDeleteBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: THEME.red + "40" },
  adDeleteTxt: { color: THEME.red, fontSize: 11, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: THEME.ui, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: "90%", borderWidth: 1, borderColor: THEME.ui2 },
  modalHandle: { width: 40, height: 4, backgroundColor: THEME.ui2, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  modalTitle: { color: THEME.accent, fontSize: 16, fontWeight: "900", letterSpacing: 2, marginBottom: 20 },
  fieldLabel: { color: THEME.accent, fontSize: 9, fontWeight: "900", letterSpacing: 2, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: THEME.bg, color: THEME.text, borderRadius: 12, padding: 14, fontSize: 14, borderWidth: 1, borderColor: THEME.ui2 },
  typeRow: { flexDirection: "row", gap: 10 },
  typePill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: THEME.bg, borderWidth: 1, borderColor: THEME.ui2 },
  typePillActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  typePillTxt: { color: THEME.textMuted, fontSize: 11, fontWeight: "800" },
  typePillTxtActive: { color: "#000" },
  activeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, padding: 14, backgroundColor: THEME.bg, borderRadius: 12, borderWidth: 1, borderColor: THEME.ui2 },
  activeTxt: { color: THEME.text, fontSize: 14, fontWeight: "700" },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 24, marginBottom: 10 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: THEME.ui2, alignItems: "center" },
  cancelTxt: { color: THEME.textMuted, fontWeight: "700" },
  saveBtn: { flex: 2, padding: 16, borderRadius: 14, backgroundColor: THEME.accent, alignItems: "center" },
  saveTxt: { color: "#000", fontWeight: "900", fontSize: 14 },
});