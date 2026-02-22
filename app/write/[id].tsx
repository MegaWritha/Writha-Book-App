import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Switch, KeyboardAvoidingView, Platform,
  ActivityIndicator, StatusBar, Image, Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { auth, db } from "@/lib/firebase";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#080410",
  ui: "#100820",
  ui2: "#1A0E30",
  ui3: "#251645",
  accent: "#FFD700",
  accentDim: "rgba(255,215,0,0.1)",
  purple: "#6D28D9",
  purpleLight: "#A78BFA",
  text: "#EDE8F5",
  textMuted: "#6B6080",
  green: "#22C55E",
  red: "#EF4444",
  blue: "#38BDF8",
};

export default function WrithaEditor() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = auth.currentUser;
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(false);
  const [initialSync, setInitialSync] = useState(true);
  const [activeTab, setActiveTab] = useState<"Editor" | "Metadata" | "Legal">("Editor");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    cover: "",
    coverLocalUri: null as string | null,
    genre: "",
    tags: "",
    description: "",
    content: "",
    mode: "write" as "write" | "upload",
    fileName: null as string | null,
    fileUri: null as string | null,
    fileUrl: null as string | null,
    isMature: false,
    isPremium: false,
    price: "0",
    isOriginal: false,
    status: "draft" as "draft" | "submitted" | "published",
  });

  // ── LOAD EXISTING BOOK ────────────────────────────────────────────────
  useEffect(() => {
    if (id && id !== "new") {
      const load = async () => {
        try {
          const snap = await getDoc(doc(db, "books", id as string));
          if (snap.exists()) {
            const data = snap.data();
            setForm((prev) => ({ ...prev, ...data }));
          }
        } catch {
          Alert.alert("Error", "Could not load this book.");
        } finally {
          setInitialSync(false);
        }
      };
      load();
    } else {
      setInitialSync(false);
    }
  }, [id]);

  // ── AUTOSAVE every 20 seconds when title exists ───────────────────────
  useEffect(() => {
    if (!form.title.trim() || !user || initialSync) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(async () => {
      try {
        const docId = (id && id !== "new")
          ? id as string
          : `draft_${user.uid}_${Date.now()}`;
        await setDoc(
          doc(db, "books", docId),
          { ...form, authorId: user.uid, updatedAt: serverTimestamp() },
          { merge: true }
        );
        setLastSaved(new Date());
      } catch (e) {
        console.error("Autosave failed:", e);
      }
    }, 20000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [form.title, form.content, form.description, initialSync]);

  // ── COVER IMAGE PICKER ────────────────────────────────────────────────
  const pickCover = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert("Permission Required", "Allow photo library access to upload your cover.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setForm((prev) => ({
        ...prev,
        coverLocalUri: result.assets[0].uri,
        cover: result.assets[0].uri,
      }));
    }
  };

  // ── MANUSCRIPT FILE PICKER ────────────────────────────────────────────
  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/msword",
          "text/plain",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const file = result.assets[0];
        const sizeInMB = (file.size || 0) / (1024 * 1024);
        if (sizeInMB > 50) {
          Alert.alert("File Too Large", "Maximum file size is 50MB.");
          return;
        }
        setForm((prev) => ({
          ...prev,
          fileName: file.name,
          fileUri: file.uri,
          mode: "upload",
        }));
      }
    } catch {
      Alert.alert("Error", "File picker failed.");
    }
  };

  // ── UPLOAD COVER TO FIREBASE STORAGE ─────────────────────────────────
  const uploadCover = async (): Promise<string> => {
    if (!form.coverLocalUri || form.coverLocalUri.startsWith("http")) {
      return form.cover;
    }
    setUploadingCover(true);
    try {
      const storage = getStorage();
      const response = await fetch(form.coverLocalUri);
      const blob = await response.blob();
      const storageRef = ref(storage, `book-covers/${user!.uid}/${Date.now()}.jpg`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      return url;
    } catch (e) {
      console.error("Cover upload failed:", e);
      return form.cover;
    } finally {
      setUploadingCover(false);
    }
  };

  // ── UPLOAD MANUSCRIPT FILE TO FIREBASE STORAGE ────────────────────────
  const uploadManuscriptFile = async (): Promise<string | null> => {
    if (!form.fileUri || form.fileUri.startsWith("http")) {
      return form.fileUrl;
    }
    setUploadingFile(true);
    try {
      const storage = getStorage();
      const response = await fetch(form.fileUri);
      const blob = await response.blob();
      const ext = form.fileName?.split(".").pop() || "pdf";
      const storageRef = ref(
        storage,
        `manuscripts/${user!.uid}/${Date.now()}.${ext}`
      );
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      return url;
    } catch (e) {
      console.error("File upload failed:", e);
      return null;
    } finally {
      setUploadingFile(false);
    }
  };

  // ── SAVE / SUBMIT ─────────────────────────────────────────────────────
  const handleSave = async (status: "submitted" | "draft") => {
    if (!user) return Alert.alert("Error", "Not logged in.");

    if (status === "submitted") {
      if (!form.title.trim())
        return Alert.alert("Required", "Add a title.");
      if (form.mode === "write" && form.content.trim().length < 50)
        return Alert.alert("Too Short", "Manuscript needs at least 50 characters.");
      if (form.mode === "upload" && !form.fileUri && !form.fileUrl)
        return Alert.alert("Required", "Upload your manuscript file.");
      if (!form.isOriginal)
        return Alert.alert("Required", "Confirm originality in the Legal tab.");
    } else {
      if (!form.title.trim())
        return Alert.alert("Required", "Add a title to save.");
    }

    setLoading(true);
    try {
      // Upload cover if it's a local URI
      const finalCover = await uploadCover();

      // Upload manuscript file if local
      const finalFileUrl =
        form.mode === "upload" ? await uploadManuscriptFile() : null;

      const docId =
        id && id !== "new"
          ? (id as string)
          : `book_${user.uid}_${Date.now()}`;

      await setDoc(
        doc(db, "books", docId),
        {
          ...form,
          cover: finalCover,
          coverUrl: finalCover,
          fileUrl: finalFileUrl || form.fileUrl,
          coverLocalUri: null, // don't persist local URI
          fileUri: null,       // don't persist local URI
          authorId: user.uid,
          authorName: user.displayName || "Author",
          status,
          views: 0,
          likesCount: 0,
          commentsCount: 0,
          likedBy: [],
          purchasedBy: [],
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      setLastSaved(new Date());

      if (status === "submitted") {
        Alert.alert(
          "Submitted! 🎓",
          "Your manuscript is in the editorial queue. You'll be notified when approved.",
          [{ text: "Go to Library", onPress: () => router.replace("/(tabs)/library" as any) }]
        );
      } else {
        Alert.alert("Draft Saved ✅", "Saved to your library drafts.", [
          { text: "Keep Writing" },
          { text: "Go to Library", onPress: () => router.replace("/(tabs)/library" as any) },
        ]);
      }
    } catch (err: any) {
      Alert.alert("Save Error", err.message || "Could not save.");
    } finally {
      setLoading(false);
    }
  };

  // ── DELETE ────────────────────────────────────────────────────────────
  const handleDelete = () => {
    if (!id || id === "new") return;
    Alert.alert(
      "Delete Forever?",
      "This permanently removes your work. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "books", id as string));
              router.replace("/(tabs)/library" as any);
            } catch {
              Alert.alert("Error", "Could not delete.");
            }
          },
        },
      ]
    );
  };

  const canSubmit =
    form.title.trim() &&
    (form.content.trim().length >= 50 || form.fileUri || form.fileUrl) &&
    form.isOriginal;

  const wordCount = form.content.trim()
    ? form.content.trim().split(/\s+/).length
    : 0;

  if (initialSync) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={THEME.accent} size="large" />
        <Text style={{ color: THEME.textMuted, marginTop: 12 }}>
          Loading manuscript...
        </Text>
      </View>
    );
  }

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={["#0F071A", THEME.bg]}
        style={StyleSheet.absoluteFill}
      />

      {/* TOOLBAR */}
      <View style={[styles.toolbar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => {
            if (form.title) {
              Alert.alert("Save before leaving?", "", [
                { text: "Discard", style: "destructive", onPress: () => router.back() },
                { text: "Save Draft", onPress: () => handleSave("draft") },
                { text: "Cancel", style: "cancel" },
              ]);
            } else {
              router.back();
            }
          }}
        >
          <Ionicons name="close" size={22} color={THEME.text} />
        </TouchableOpacity>

        {/* TABS */}
        <View style={styles.tabContainer}>
          {(["Editor", "Metadata", "Legal"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tabItem, activeTab === tab && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={() => handleSave("submitted")}
          disabled={!canSubmit || loading}
          style={{ opacity: canSubmit ? 1 : 0.4 }}
        >
          {loading ? (
            <ActivityIndicator color={THEME.accent} size="small" />
          ) : (
            <Text style={styles.submitAction}>SUBMIT</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* AUTOSAVE INDICATOR */}
      {lastSaved && (
        <View style={styles.autosaveBanner}>
          <Ionicons name="cloud-done-outline" size={12} color={THEME.green} />
          <Text style={styles.autosaveTxt}>
            Auto-saved at{" "}
            {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── EDITOR TAB ── */}
        {activeTab === "Editor" && (
          <View style={styles.pane}>
            <TextInput
              placeholder="MANUSCRIPT TITLE"
              placeholderTextColor={THEME.ui3}
              style={styles.mainTitle}
              value={form.title}
              onChangeText={(t) => setForm({ ...form, title: t })}
            />
            <TextInput
              placeholder="Subtitle or tagline..."
              placeholderTextColor={THEME.textMuted}
              style={styles.mainSubtitle}
              value={form.subtitle}
              onChangeText={(t) => setForm({ ...form, subtitle: t })}
            />

            {/* MODE SWITCH */}
            <View style={styles.modeSwitch}>
              <TouchableOpacity
                onPress={() => setForm({ ...form, mode: "write" })}
                style={[styles.modeOpt, form.mode === "write" && styles.modeOptActive]}
              >
                <Ionicons
                  name="create-outline"
                  size={15}
                  color={form.mode === "write" ? "#000" : THEME.textMuted}
                />
                <Text style={[styles.modeOptTxt, form.mode === "write" && styles.modeOptTxtActive]}>
                  WRITE
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setForm({ ...form, mode: "upload" })}
                style={[styles.modeOpt, form.mode === "upload" && styles.modeOptActive]}
              >
                <Ionicons
                  name="cloud-upload-outline"
                  size={15}
                  color={form.mode === "upload" ? "#000" : THEME.textMuted}
                />
                <Text style={[styles.modeOptTxt, form.mode === "upload" && styles.modeOptTxtActive]}>
                  UPLOAD FILE
                </Text>
              </TouchableOpacity>
            </View>

            {/* WRITE MODE */}
            {form.mode === "write" && (
              <>
                {/* Word count bar */}
                <View style={styles.wordCountRow}>
                  <Text style={styles.wordCountTxt}>{wordCount} words</Text>
                  <Text style={[
                    styles.wordCountStatus,
                    wordCount >= 50 ? { color: THEME.green } : { color: THEME.red },
                  ]}>
                    {wordCount >= 50 ? "✓ Ready to submit" : `Need ${50 - wordCount} more words`}
                  </Text>
                </View>
                <TextInput
                  placeholder={"Once upon a time...\n\nTip: Your work is auto-saved every 20 seconds."}
                  placeholderTextColor={THEME.textMuted}
                  style={styles.editorBody}
                  multiline
                  scrollEnabled={false}
                  value={form.content}
                  onChangeText={(t) => setForm({ ...form, content: t })}
                  textAlignVertical="top"
                />
              </>
            )}

            {/* UPLOAD MODE */}
            {form.mode === "upload" && (
              <View>
                <View style={styles.uploadInfoBox}>
                  <Ionicons name="information-circle-outline" size={16} color={THEME.blue} />
                  <Text style={styles.uploadInfoTxt}>
                    Upload PDF, DOC, DOCX, or TXT. Max 50MB. Your file is stored securely on Writha servers.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.uploadCard}
                  onPress={pickFile}
                  disabled={uploadingFile}
                >
                  {uploadingFile ? (
                    <ActivityIndicator color={THEME.accent} size="large" />
                  ) : form.fileName ? (
                    <>
                      <View style={styles.fileSuccessIcon}>
                        <Ionicons name="document-text" size={36} color={THEME.red} />
                      </View>
                      <Text style={styles.fileSuccessName} numberOfLines={1}>
                        {form.fileName}
                      </Text>
                      <Text style={styles.fileSuccessSub}>
                        Tap to change file
                      </Text>
                      <View style={styles.fileSuccessBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={THEME.green} />
                        <Text style={styles.fileSuccessBadgeTxt}>File Ready</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <MaterialCommunityIcons name="file-upload-outline" size={52} color={THEME.purpleLight} />
                      <Text style={styles.uploadCardTitle}>Select Manuscript File</Text>
                      <Text style={styles.uploadCardSub}>PDF · DOC · DOCX · TXT — Max 50MB</Text>
                      <View style={styles.uploadCardCanvaHint}>
                        <Text style={styles.uploadCardCanvaHintTxt}>
                          💡 Exported from Word or Google Docs? Upload directly here.
                        </Text>
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── METADATA TAB ── */}
        {activeTab === "Metadata" && (
          <View style={styles.pane}>

            {/* COVER IMAGE */}
            <Text style={styles.fieldTag}>COVER IMAGE</Text>
            <View style={styles.coverRow}>
              <TouchableOpacity
                style={styles.coverPickerBtn}
                onPress={pickCover}
                activeOpacity={0.85}
              >
                {form.cover ? (
                  <>
                    <Image source={{ uri: form.cover }} style={styles.coverPreview} />
                    <View style={styles.coverEditOverlay}>
                      <Ionicons name="camera-outline" size={20} color="#fff" />
                      <Text style={styles.coverEditTxt}>Change</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.coverEmpty}>
                    <Ionicons name="image-outline" size={30} color={THEME.textMuted} />
                    <Text style={styles.coverEmptyTxt}>Add Cover</Text>
                  </View>
                )}
                {uploadingCover && (
                  <View style={styles.coverUploading}>
                    <ActivityIndicator color={THEME.accent} />
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.coverHintBox}>
                <Text style={styles.coverHintTitle}>📸 Upload your cover</Text>
                <Text style={styles.coverHintBody}>
                  Made a cover on Canva?{"\n"}
                  Export as JPG or PNG and tap here to upload it.{"\n\n"}
                  Recommended size: 800 × 1200px (2:3 ratio)
                </Text>
                <TouchableOpacity style={styles.coverUploadSmallBtn} onPress={pickCover}>
                  <Text style={styles.coverUploadSmallBtnTxt}>Upload from Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* GENRE */}
            <Text style={styles.fieldTag}>GENRE / CATEGORY</Text>
            <TextInput
              style={styles.fieldIn}
              placeholder="e.g. Romance, Fantasy, History..."
              placeholderTextColor={THEME.textMuted}
              value={form.genre}
              onChangeText={(t) => setForm({ ...form, genre: t })}
            />

            {/* TAGS */}
            <Text style={styles.fieldTag}>TAGS</Text>
            <TextInput
              style={styles.fieldIn}
              placeholder="e.g. love, war, magic (comma separated)"
              placeholderTextColor={THEME.textMuted}
              value={form.tags}
              onChangeText={(t) => setForm({ ...form, tags: t })}
            />

            {/* DESCRIPTION */}
            <Text style={styles.fieldTag}>SYNOPSIS / BLURB</Text>
            <TextInput
              style={styles.blurbArea}
              placeholder="Write a compelling book description..."
              multiline
              placeholderTextColor={THEME.textMuted}
              value={form.description}
              onChangeText={(t) => setForm({ ...form, description: t })}
              textAlignVertical="top"
            />

            {/* PREMIUM */}
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Premium / Paid Content</Text>
                <Text style={styles.settingSub}>Readers pay to access this book</Text>
              </View>
              <Switch
                value={form.isPremium}
                onValueChange={(v) => setForm({ ...form, isPremium: v })}
                trackColor={{ false: THEME.ui2, true: THEME.accent }}
                thumbColor={form.isPremium ? "#000" : THEME.textMuted}
              />
            </View>
            {form.isPremium && (
              <View style={styles.priceRow}>
                <Text style={styles.currencySymbol}>₦</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="0.00"
                  placeholderTextColor={THEME.ui3}
                  keyboardType="numeric"
                  value={form.price}
                  onChangeText={(t) => setForm({ ...form, price: t })}
                />
              </View>
            )}

            {/* MATURE */}
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Mature Content (18+)</Text>
                <Text style={styles.settingSub}>Contains adult themes or language</Text>
              </View>
              <Switch
                value={form.isMature}
                onValueChange={(v) => setForm({ ...form, isMature: v })}
                trackColor={{ false: THEME.ui2, true: THEME.red }}
                thumbColor={form.isMature ? "#fff" : THEME.textMuted}
              />
            </View>
          </View>
        )}

        {/* ── LEGAL TAB ── */}
        {activeTab === "Legal" && (
          <View style={styles.pane}>
            <View style={styles.legalHeaderBox}>
              <FontAwesome5 name="shield-alt" size={40} color={THEME.accent} />
              <Text style={styles.legalMainTitle}>
                INTELLECTUAL PROPERTY GUARD
              </Text>
            </View>

            <Text style={styles.legalBody}>
              By submitting this manuscript, you legally declare:{"\n\n"}
              <Text style={styles.legalPoint}>1. ORIGINAL WORK</Text>
              {"\n"}This is your original intellectual property. You hold full copyright and have not plagiarised any portion.{"\n\n"}
              <Text style={styles.legalPoint}>2. ANTI-PIRACY ACT</Text>
              {"\n"}Submitting stolen or plagiarised content is a criminal offence under Nigerian Copyright Law (Copyright Act 2022) and international IP treaties. Violations result in immediate permanent ban, forfeiture of all earnings, and referral to law enforcement authorities.{"\n\n"}
              <Text style={styles.legalPoint}>3. PLATFORM LICENCE</Text>
              {"\n"}You grant Writha a non-exclusive licence to display and distribute your work on the platform. You retain full ownership.{"\n\n"}
              <Text style={styles.legalPoint}>4. REVENUE SHARE</Text>
              {"\n"}Writha retains 20% of all sales. You receive 80% directly to your wallet.{"\n\n"}
              <Text style={styles.legalPoint}>5. EDITORIAL REVIEW</Text>
              {"\n"}All submissions undergo editorial review before going live. This typically takes 24–48 hours. You will be notified of the outcome.
            </Text>

            {/* ORIGINAL WORK TOGGLE */}
            <View style={styles.legalToggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.legalItemH}>✍️ Original Work Certification</Text>
                <Text style={styles.legalItemS}>
                  I certify this manuscript is entirely my own creation.
                </Text>
              </View>
              <Switch
                value={form.isOriginal}
                onValueChange={(v) => setForm({ ...form, isOriginal: v })}
                trackColor={{ false: THEME.ui2, true: THEME.purple }}
                thumbColor={form.isOriginal ? THEME.accent : THEME.textMuted}
              />
            </View>

            {/* MATURE TOGGLE */}
            <View style={styles.legalToggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.legalItemH}>🔞 Mature Content (18+)</Text>
                <Text style={styles.legalItemS}>
                  This work contains adult themes, language, or content.
                </Text>
              </View>
              <Switch
                value={form.isMature}
                onValueChange={(v) => setForm({ ...form, isMature: v })}
                trackColor={{ false: THEME.ui2, true: THEME.red }}
                thumbColor={form.isMature ? "#fff" : THEME.textMuted}
              />
            </View>

            {/* DELETE */}
            {id && id !== "new" && (
              <TouchableOpacity style={styles.dangerZone} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={16} color={THEME.red} />
                <Text style={styles.dangerTxt}>DELETE THIS MANUSCRIPT FOREVER</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* FOOTER */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={styles.draftBtn}
          onPress={() => handleSave("draft")}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={THEME.textMuted} size="small" />
          ) : (
            <Text style={styles.draftBtnTxt}>SAVE DRAFT</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitBtn, (!canSubmit || loading) && { opacity: 0.5 }]}
          disabled={!canSubmit || loading}
          onPress={() => handleSave("submitted")}
        >
          {loading ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.submitBtnTxt}>SUBMIT FOR REVIEW</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: THEME.bg },
  toolbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  closeBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  tabContainer: { flexDirection: "row", backgroundColor: THEME.ui, borderRadius: 12, padding: 4, gap: 4 },
  tabItem: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  tabActive: { backgroundColor: THEME.accent },
  tabLabel: { color: THEME.textMuted, fontSize: 10, fontWeight: "900" },
  tabLabelActive: { color: "#000" },
  submitAction: { color: THEME.accent, fontWeight: "900", fontSize: 13 },
  autosaveBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: THEME.green + "15", paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: THEME.green + "30" },
  autosaveTxt: { color: THEME.green, fontSize: 11, fontWeight: "600" },
  pane: { padding: 20 },
  mainTitle: { color: THEME.text, fontSize: 30, fontWeight: "900", letterSpacing: -0.5, marginBottom: 8 },
  mainSubtitle: { color: THEME.textMuted, fontSize: 16, marginBottom: 24 },
  modeSwitch: { flexDirection: "row", gap: 12, marginBottom: 24 },
  modeOpt: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 14, backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2 },
  modeOptActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  modeOptTxt: { color: THEME.textMuted, fontSize: 11, fontWeight: "900" },
  modeOptTxtActive: { color: "#000" },
  wordCountRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  wordCountTxt: { color: THEME.textMuted, fontSize: 12 },
  wordCountStatus: { fontSize: 11, fontWeight: "700" },
  editorBody: { color: THEME.text, fontSize: 17, lineHeight: 28, minHeight: 400, backgroundColor: THEME.ui, borderRadius: 16, padding: 16, textAlignVertical: "top", borderWidth: 1, borderColor: THEME.ui2 },
  uploadInfoBox: { flexDirection: "row", gap: 10, backgroundColor: "rgba(56,189,248,0.15)", borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "rgba(56,189,248,0.30)" },
  uploadInfoTxt: { color: THEME.textMuted, fontSize: 12, flex: 1, lineHeight: 18 },
  uploadCard: { minHeight: 240, borderRadius: 24, borderStyle: "dashed", borderWidth: 2, borderColor: THEME.ui2, justifyContent: "center", alignItems: "center", backgroundColor: THEME.ui, gap: 10, padding: 24 },
  uploadCardTitle: { color: THEME.text, fontWeight: "800", fontSize: 16 },
  uploadCardSub: { color: THEME.textMuted, fontSize: 12 },
  uploadCardCanvaHint: { backgroundColor: THEME.accentDim, borderRadius: 10, padding: 10, marginTop: 8 },
  uploadCardCanvaHintTxt: { color: THEME.accent, fontSize: 11, textAlign: "center" },
  fileSuccessIcon: { width: 64, height: 64, borderRadius: 18, backgroundColor: THEME.red + "20", justifyContent: "center", alignItems: "center" },
  fileSuccessName: { color: THEME.text, fontWeight: "800", fontSize: 14, maxWidth: width - 100, textAlign: "center" },
  fileSuccessSub: { color: THEME.textMuted, fontSize: 11 },
  fileSuccessBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: THEME.green + "20", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  fileSuccessBadgeTxt: { color: THEME.green, fontWeight: "800", fontSize: 11 },
  fieldTag: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginTop: 24, marginBottom: 10 },
  fieldIn: { backgroundColor: THEME.ui, borderRadius: 12, padding: 14, color: THEME.text, fontSize: 14, borderWidth: 1, borderColor: THEME.ui2 },
  blurbArea: { backgroundColor: THEME.ui, borderRadius: 14, padding: 14, color: THEME.text, fontSize: 14, minHeight: 120, textAlignVertical: "top", borderWidth: 1, borderColor: THEME.ui2, lineHeight: 22 },
  coverRow: { flexDirection: "row", gap: 14 },
  coverPickerBtn: { width: 110, height: 160, borderRadius: 14, overflow: "hidden", backgroundColor: THEME.ui, borderWidth: 1.5, borderColor: THEME.ui2, position: "relative" },
  coverPreview: { width: "100%", height: "100%" },
  coverEditOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", gap: 4 },
  coverEditTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },
  coverEmpty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 6 },
  coverEmptyTxt: { color: THEME.textMuted, fontSize: 11, fontWeight: "700" },
  coverUploading: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  coverHintBox: { flex: 1, justifyContent: "center" },
  coverHintTitle: { color: THEME.text, fontWeight: "800", fontSize: 14, marginBottom: 8 },
  coverHintBody: { color: THEME.textMuted, fontSize: 12, lineHeight: 19 },
  coverUploadSmallBtn: { marginTop: 12, backgroundColor: THEME.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, alignSelf: "flex-start" },
  coverUploadSmallBtnTxt: { color: "#000", fontWeight: "900", fontSize: 11 },
  settingRow: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, borderRadius: 14, padding: 16, marginTop: 16, borderWidth: 1, borderColor: THEME.ui2 },
  settingTitle: { color: THEME.text, fontWeight: "800", fontSize: 14 },
  settingSub: { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  priceRow: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.bg, borderRadius: 12, padding: 14, marginTop: 10, borderWidth: 1, borderColor: THEME.ui2 },
  currencySymbol: { color: THEME.accent, fontSize: 24, fontWeight: "900", marginRight: 8 },
  priceInput: { flex: 1, color: THEME.text, fontSize: 28, fontWeight: "900" },
  legalHeaderBox: { alignItems: "center", padding: 24, backgroundColor: THEME.ui, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: THEME.ui2 },
  legalMainTitle: { color: THEME.accent, fontWeight: "900", marginTop: 14, letterSpacing: 1.5, fontSize: 12, textAlign: "center" },
  legalBody: { color: THEME.textMuted, fontSize: 13, lineHeight: 22, marginBottom: 10 },
  legalPoint: { color: THEME.text, fontWeight: "900" },
  legalToggleRow: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, borderRadius: 14, padding: 16, marginTop: 12, borderWidth: 1, borderColor: THEME.ui2 },
  legalItemH: { color: THEME.text, fontWeight: "700", fontSize: 14 },
  legalItemS: { color: THEME.textMuted, fontSize: 11, marginTop: 3 },
  dangerZone: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 60, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: THEME.red + "40" },
  dangerTxt: { color: THEME.red, fontWeight: "900", fontSize: 11, letterSpacing: 1 },
  footer: { position: "absolute", bottom: 0, width: "100%", flexDirection: "row", padding: 16, backgroundColor: THEME.ui, borderTopWidth: 1, borderTopColor: THEME.ui2, gap: 12 },
  draftBtn: { flex: 1, paddingVertical: 16, alignItems: "center", borderRadius: 16, backgroundColor: THEME.bg, borderWidth: 1, borderColor: THEME.ui2 },
  draftBtnTxt: { color: THEME.textMuted, fontWeight: "900", fontSize: 12 },
  submitBtn: { flex: 2, paddingVertical: 16, alignItems: "center", borderRadius: 16, backgroundColor: THEME.accent },
  submitBtnTxt: { color: "#000", fontWeight: "900", fontSize: 12 },
});