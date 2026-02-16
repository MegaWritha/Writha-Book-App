import React, { useState, useEffect } from "react";
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ScrollView, Alert, Switch, KeyboardAvoidingView, Platform, 
  ActivityIndicator, Dimensions, StatusBar 
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from 'expo-haptics';

export default function WrithaExecutiveStudio() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const user = auth.currentUser;

  // --- COMPREHENSIVE STATE ---
  const [loading, setLoading] = useState(false);
  const [initialSync, setInitialSync] = useState(true);
  const [activeTab, setActiveTab] = useState<"Editor" | "Metadata" | "Legal">("Editor");

  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    cover: "", // ADDED: Crucial for Home Screen
    genre: "",
    tags: "",
    summary: "",
    content: "",
    mode: "write" as "write" | "upload",
    fileName: null as string | null,
    fileUri: null as string | null,
    isMature: false,
    isPremium: false,
    isOriginal: false,
  });

  // --- INITIAL DATA FETCH ---
  useEffect(() => {
    if (id && id !== "new") {
      const loadManuscript = async () => {
        try {
          const snap = await getDoc(doc(db, "books", id as string));
          if (snap.exists()) {
            setForm(prev => ({ ...prev, ...snap.data() }));
          }
        } catch (err) {
          Alert.alert("Error", "Could not synchronize with cloud servers.");
        } finally {
          setInitialSync(false);
        }
      };
      loadManuscript();
    } else {
      setInitialSync(false);
    }
  }, [id]);

  // --- FILE PICKER ---
  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/msword", "text/plain"],
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        setForm(prev => ({ 
          ...prev, 
          fileName: selectedAsset.name, 
          fileUri: selectedAsset.uri,
          mode: "upload" 
        }));
        // Provide haptic feedback
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      Alert.alert("Error", "Document picker failed.");
    }
  };

  // --- PERSISTENCE ENGINE (PUBLISH) ---
  const handleArchiveSync = async (status: "published" | "draft") => {
    if (!user) return Alert.alert("Error", "You must be logged in.");
    if (!form.title.trim()) return Alert.alert("Required", "Title cannot be empty.");
    
    if (status === "published") {
      if (form.mode === "write" && !form.content.trim()) return Alert.alert("Empty Work", "Please add content.");
      if (!form.isOriginal) return Alert.alert("Verification", "Please confirm originality in the Legal tab.");
    }

    setLoading(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Use existing ID or create a clean URL-friendly ID from title
    const docId = (id && id !== "new") 
      ? id as string 
      : form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    try {
      await setDoc(doc(db, "books", docId), {
        ...form,
        // Ensure these fields match what Home Screen expects
        authorId: user.uid,
        authorName: user.displayName || "Anonymous",
        likesCount: 0, // Initialize likes
        commentsCount: 0,
        premium: form.isPremium, // Map to Home Screen 'premium' check
        cover: form.cover || "https://picsum.photos/300/500", // Default if empty
        status: status,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }, { merge: true });

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert("Success", "Published successfully!", [
        { text: "OK", onPress: () => router.push("/(tabs)") } // Go to Home
      ]);
      
    } catch (err) {
      console.error(err);
      Alert.alert("Sync Error", "Could not save to database.");
    } finally {
      setLoading(false);
    }
  };

  if (initialSync) return <View style={styles.loader}><ActivityIndicator color="#FFD700" /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0F071A', '#000']} style={StyleSheet.absoluteFill} />
      
      {/* EXECUTIVE TOOLBAR */}
      <View style={[styles.toolbar, { paddingTop: 60 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        
        <View style={styles.tabContainer}>
          {(["Editor", "Metadata", "Legal"] as const).map(tab => (
            <TouchableOpacity 
              key={tab} 
              onPress={() => setActiveTab(tab)} 
              style={[styles.tabItem, activeTab === tab && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={() => handleArchiveSync("published")}>
          <Text style={styles.postAction}>POST</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 150 }}>
        
        {/* TAB 1: EDITOR */}
        {activeTab === "Editor" && (
          <View style={styles.pane}>
            <TextInput 
              placeholder="MANUSCRIPT TITLE" 
              placeholderTextColor="#555" 
              style={styles.mainTitle} 
              value={form.title} 
              onChangeText={t => setForm({...form, title: t})} 
            />
            <TextInput 
              placeholder="Subtitle / Catchphrase..." 
              placeholderTextColor="#555" 
              style={styles.mainSubtitle} 
              value={form.subtitle} 
              onChangeText={t => setForm({...form, subtitle: t})} 
            />

            <View style={styles.modeSwitch}>
              <TouchableOpacity onPress={() => setForm({...form, mode: 'write'})} style={[styles.opt, form.mode === 'write' && styles.optActive]}>
                <Feather name="edit-3" size={14} color={form.mode === 'write' ? "#000" : "#888"} />
                <Text style={[styles.optText, form.mode === 'write' && styles.optTextActive]}>WRITE</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setForm({...form, mode: 'upload'})} style={[styles.opt, form.mode === 'upload' && styles.optActive]}>
                <Feather name="upload-cloud" size={14} color={form.mode === 'upload' ? "#000" : "#888"} />
                <Text style={[styles.optText, form.mode === 'upload' && styles.optTextActive]}>UPLOAD</Text>
              </TouchableOpacity>
            </View>

            {form.mode === "write" ? (
              <TextInput
                placeholder="Once upon a time..."
                placeholderTextColor="#333"
                style={styles.editorBody}
                multiline
                scrollEnabled={false}
                value={form.content}
                onChangeText={t => setForm({...form, content: t})}
              />
            ) : (
              <TouchableOpacity style={styles.uploadCard} onPress={pickFile}>
                <MaterialCommunityIcons name="file-upload" size={50} color="#FFD700" />
                <Text style={styles.upMainText}>{form.fileName ? form.fileName : "Select Manuscript File"}</Text>
                <Text style={styles.upSubText}>PDF, DOC, DOCX - Secure Upload</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* TAB 2: METADATA */}
        {activeTab === "Metadata" && (
          <View style={styles.pane}>
            <Text style={styles.fieldTag}>COVER IMAGE URL</Text>
            <TextInput 
              style={styles.fieldIn} 
              placeholder="https://..." 
              placeholderTextColor="#333" 
              value={form.cover} 
              onChangeText={t => setForm({...form, cover: t})} 
            />

            <Text style={styles.fieldTag}>GENRE / CATEGORY</Text>
            <TextInput 
              style={styles.fieldIn} 
              placeholder="History, Sci-Fi, etc." 
              placeholderTextColor="#333" 
              value={form.genre} 
              onChangeText={t => setForm({...form, genre: t})} 
            />
            
            <Text style={styles.fieldTag}>SUMMARY / BLURB</Text>
            <TextInput 
              style={styles.blurbArea} 
              placeholder="Enter your summary here..." 
              multiline 
              placeholderTextColor="#333" 
              value={form.summary} 
              onChangeText={t => setForm({...form, summary: t})} 
            />
            
            <View style={styles.rowItem}>
               <View style={{flex:1}}>
                  <Text style={styles.rowTitle}>Premium Content</Text>
                  <Text style={styles.rowSub}>Mark as PAID content.</Text>
               </View>
               <Switch 
                  value={form.isPremium} 
                  onValueChange={v => setForm({...form, isPremium: v})} 
                  trackColor={{ false: "#333", true: '#FFD700' }} 
                  thumbColor={form.isPremium ? "#000" : "#f4f3f4"}
               />
            </View>
          </View>
        )}

        {/* TAB 3: LEGAL */}
        {activeTab === "Legal" && (
          <View style={styles.pane}>
             <View style={styles.legalHeaderBox}>
                <FontAwesome5 name="shield-alt" size={44} color="#FFD700" />
                <Text style={styles.legalMainTitle}>INTELLECTUAL PROPERTY GUARD</Text>
                <Text style={styles.legalBodyContent}>
                   Writha maintains a zero-tolerance policy for plagiarism. By using this platform, you acknowledge that you own all rights to this work.
                </Text>
             </View>

             <View style={styles.legalToggleRow}>
                <View style={{flex: 1}}>
                    <Text style={styles.legalItemH}>Original Work Verification</Text>
                    <Text style={styles.legalItemS}>I certify this is my own intellectual creation.</Text>
                </View>
                <Switch 
                  value={form.isOriginal} 
                  onValueChange={v => setForm({...form, isOriginal: v})} 
                  trackColor={{ false: "#333", true: '#FFD700' }} 
                  thumbColor={form.isOriginal ? "#000" : "#f4f3f4"}
                />
             </View>

             <View style={styles.legalToggleRow}>
                <View style={{flex: 1}}>
                    <Text style={styles.legalItemH}>Mature Content (18+)</Text>
                    <Text style={styles.legalItemS}>Check this if the work has mature themes.</Text>
                </View>
                <Switch 
                  value={form.isMature} 
                  onValueChange={v => setForm({...form, isMature: v})} 
                  trackColor={{ false: "#333", true: '#FFD700' }} 
                  thumbColor={form.isMature ? "#000" : "#f4f3f4"}
                />
             </View>

             {id && id !== "new" && (
                <TouchableOpacity style={styles.dangerZone} onPress={() => {
                    Alert.alert("DELETE FOREVER?", "This removes your work from the archive.", [
                        { text: "Cancel" },
                        { text: "DELETE", style: 'destructive', onPress: async () => { await deleteDoc(doc(db, "books", id as string)); router.back(); }}
                    ]);
                }}>
                   <Ionicons name="trash-outline" size={18} color="#FF4444" />
                   <Text style={styles.dangerText}>SCRUB FROM ARCHIVE</Text>
                </TouchableOpacity>
             )}
          </View>
        )}

      </ScrollView>

      {/* FOOTER */}
      <View style={styles.studioFooter}>
          <TouchableOpacity style={styles.draftBtn} onPress={() => handleArchiveSync("draft")}>
            <Text style={styles.draftBtnText}>SAVE DRAFT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.postBtn} onPress={() => handleArchiveSync("published")}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.postBtnText}>FINALIZE & POST</Text>}
          </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderColor: '#111' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#0F071A', borderRadius: 12, padding: 5, gap: 5 },
  tabItem: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  tabActive: { backgroundColor: '#FFD700' },
  tabLabel: { color: '#666', fontSize: 10, fontWeight: '900' },
  tabLabelActive: { color: '#000' },
  postAction: { color: '#FFD700', fontWeight: '900', fontSize: 12 },

  pane: { padding: 25 },
  mainTitle: { color: '#FFF', fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  mainSubtitle: { color: '#555', fontSize: 16, marginTop: 5, marginBottom: 30 },
  
  modeSwitch: { flexDirection: 'row', marginBottom: 35, gap: 15 },
  opt: { flex: 1, flexDirection: 'row', padding: 16, borderRadius: 16, backgroundColor: '#0F071A', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: '#1E1135' },
  optActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  optText: { color: '#888', fontSize: 11, fontWeight: '900' },
  optTextActive: { color: '#000' },

  editorBody: { color: '#FFF', fontSize: 18, lineHeight: 28, minHeight: 400, textAlignVertical: 'top' },
  uploadCard: { height: 300, borderRadius: 30, borderStyle: 'dashed', borderWidth: 2, borderColor: '#1E1135', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F071A' },
  upMainText: { color: '#FFF', fontWeight: '800', marginTop: 15, fontSize: 16 },
  upSubText: { color: '#444', fontSize: 12, marginTop: 5 },

  fieldTag: { color: '#FFD700', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: 25, marginBottom: 12 },
  fieldIn: { borderBottomWidth: 1, borderColor: '#333', color: '#FFF', paddingVertical: 12, fontSize: 16 },
  blurbArea: { backgroundColor: '#1E1135', borderRadius: 18, padding: 20, color: '#FFF', fontSize: 16, minHeight: 120, textAlignVertical: 'top' },

  rowItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40 },
  rowTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  rowSub: { color: '#444', fontSize: 12, marginTop: 2 },

  legalHeaderBox: { alignItems: 'center', padding: 25, backgroundColor: '#1E1135', borderRadius: 25, marginBottom: 10 },
  legalMainTitle: { color: '#FFD700', fontWeight: '900', marginTop: 18, letterSpacing: 1.5, fontSize: 13 },
  legalBodyContent: { color: '#888', textAlign: 'center', marginTop: 14, lineHeight: 22, fontSize: 13 },
  legalToggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 35 },
  legalItemH: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  legalItemS: { color: '#444', fontSize: 11, marginTop: 3 },

  dangerZone: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 80, gap: 10 },
  dangerText: { color: '#FF4444', fontWeight: '900', fontSize: 11 },

  studioFooter: { position: 'absolute', bottom: 0, width: '100%', flexDirection: 'row', padding: 20, backgroundColor: '#0F071A', borderTopWidth: 1, borderColor: '#111', gap: 15, paddingBottom: 40 },
  draftBtn: { flex: 1, paddingVertical: 18, alignItems: 'center', borderRadius: 18, backgroundColor: '#0F071A', borderWidth: 1, borderColor: '#333' },
  draftBtnText: { color: '#888', fontWeight: '900', fontSize: 12 },
  postBtn: { flex: 2, paddingVertical: 18, alignItems: 'center', borderRadius: 18, backgroundColor: '#FFD700' },
  postBtnText: { color: '#000', fontWeight: '900', fontSize: 12 },
});