import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { db, auth } from "@/lib/firebase"; 
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRESET_GENRES = ["Romance", "Fantasy", "Horror", "Mystery", "Sci-Fi", "Thriller"];

type ManuscriptMode = "full" | "chapters" | "acts";

export default function WrithaStudio() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = auth.currentUser;

  // Book State
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("");
  const [customGenre, setCustomGenre] = useState("");
  const [isCustomGenre, setIsCustomGenre] = useState(false);
  const [coverUrl, setCoverUrl] = useState("");
  const [showWrithaLogo, setShowWrithaLogo] = useState(true);
  
  // NEW: Manuscript Type Selection
  const [manuscriptMode, setManuscriptMode] = useState<ManuscriptMode>("full");
  const [fullContent, setFullContent] = useState("");
  const [chapters, setChapters] = useState([{ title: "Chapter 1", content: "" }]);
  const [acts, setActs] = useState([{ title: "Act 1", content: "" }]);

  // NEW: Legal Compliance
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState("0.00");

  const addChapter = () => setChapters([...chapters, { title: `Chapter ${chapters.length + 1}`, content: "" }]);
  const addAct = () => setActs([...acts, { title: `Act ${acts.length + 1}`, content: "" }]);

  const updateEntry = (type: 'chapter' | 'act', index: number, field: 'title' | 'content', value: string) => {
    if (type === 'chapter') {
      const newChapters = [...chapters];
      newChapters[index][field] = value;
      setChapters(newChapters);
    } else {
      const newActs = [...acts];
      newActs[index][field] = value;
      setActs(newActs);
    }
  };

  const saveToFirebase = async (status: "published" | "draft") => {
    if (!user) return Alert.alert("Required", "Please log in.");
    
    if (status === "published" && !agreedToTerms) {
      return Alert.alert("Legal Required", "You must agree to the publishing terms and anti-piracy act.");
    }

    const finalGenre = isCustomGenre ? customGenre : genre;
    const hasContent = manuscriptMode === "full" ? fullContent.trim() !== "" : 
                       manuscriptMode === "chapters" ? chapters[0].content !== "" : acts[0].content !== "";

    if (status === "published" && (!title.trim() || !finalGenre || !hasContent)) {
      return Alert.alert("Wait", "Title, Genre, and Content are required to publish.");
    }

    try {
      status === "published" ? setPublishing(true) : setSavingDraft(true);
      
      await addDoc(collection(db, "books"), {
        title: title.trim(),
        authorName: authorName.trim() || user.displayName || "Unknown Author",
        description: description.trim(),
        genre: finalGenre,
        coverUrl: coverUrl.trim() || null,
        showWrithaLogo,
        manuscriptMode,
        content: manuscriptMode === "full" ? fullContent.trim() : null,
        chapters: manuscriptMode === "chapters" ? chapters : null,
        acts: manuscriptMode === "acts" ? acts : null,
        isFree,
        price: isFree ? "0.00" : price,
        status: status, // "published" triggers author tag and live view, "draft" goes to queue
        authorId: user.uid,
        isAuthor: status === "published", // Author tag activation
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        views: 0,
      });

      if (status === "draft") {
        Alert.alert("Draft Saved", "Your work has been moved to the Queue in your Library.");
      } else {
        Alert.alert("Success", "Your book is live! You now have the Author Tag.");
      }
      router.replace("/(tabs)/library");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setPublishing(false);
      setSavingDraft(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="close" size={28} color="#FFF" /></TouchableOpacity>
        <Text style={styles.headerTitle}>BOOK STUDIO</Text>
        <View style={{ flexDirection: 'row', gap: 15 }}>
          <TouchableOpacity onPress={() => saveToFirebase("draft")} disabled={savingDraft}>
            {savingDraft ? <ActivityIndicator size="small" color="#888" /> : <Text style={styles.draftBtn}>DRAFT</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => saveToFirebase("published")} disabled={publishing}>
            {publishing ? <ActivityIndicator color="#FFD700" /> : <Text style={styles.publishBtn}>PUBLISH</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
          
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>BOOK COVER</Text>
            <View style={styles.coverRow}>
              <TouchableOpacity 
                style={[styles.coverPreview, { backgroundColor: '#1A0B2E' }]}
                onPress={() => Alert.alert("Storage Integration", "Image picker will be connected here.")}
              >
                {coverUrl ? <Image source={{ uri: coverUrl }} style={styles.fullImage} /> : <Ionicons name="add" size={40} color="#FFD700" />}
                {showWrithaLogo && (
                  <View style={styles.writhaBadge}><Text style={styles.writhaBadgeText}>WRITHA BOOKS</Text></View>
                )}
              </TouchableOpacity>
              <View style={styles.coverRight}>
                <TextInput placeholder="Image URL (Manual)" placeholderTextColor="#444" style={styles.urlInput} value={coverUrl} onChangeText={setCoverUrl} />
                <View style={styles.logoToggleRow}>
                  <Text style={styles.logoToggleText}>Show Writha Logo</Text>
                  <Switch value={showWrithaLogo} onValueChange={setShowWrithaLogo} trackColor={{ false: "#222", true: "#FFD700" }} />
                </View>
              </View>
            </View>
          </View>

          <TextInput placeholder="Book Title" placeholderTextColor="#333" style={styles.mainTitleInput} value={title} onChangeText={setTitle} />
          
          <TextInput placeholder="Author Name" placeholderTextColor="#666" style={styles.authorInput} value={authorName} onChangeText={setAuthorName} />

          <TextInput placeholder="Book Description / Synopsis" placeholderTextColor="#444" style={styles.descriptionInput} multiline value={description} onChangeText={setDescription} />

          {/* Genre Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>GENRE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreScroll}>
              {PRESET_GENRES.map((g) => (
                <TouchableOpacity key={g} onPress={() => {setGenre(g); setIsCustomGenre(false);}} style={[styles.genreChip, genre === g && !isCustomGenre && styles.activeGenreChip]}>
                  <Text style={[styles.genreText, genre === g && !isCustomGenre && styles.activeGenreText]}>{g}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setIsCustomGenre(true)} style={[styles.genreChip, isCustomGenre && styles.activeGenreChip]}>
                <Text style={[styles.genreText, isCustomGenre && styles.activeGenreText]}>Custom +</Text>
              </TouchableOpacity>
            </ScrollView>
            {isCustomGenre && (
              <TextInput placeholder="Enter custom genre..." placeholderTextColor="#444" style={styles.customGenreInput} value={customGenre} onChangeText={setCustomGenre} />
            )}
          </View>

          {/* Monetization - NAIRA SYMBOL */}
          <View style={styles.monetizationCard}>
            <View style={styles.toggleRow}>
              <Text style={styles.monetizationTitle}>Free to Read</Text>
              <Switch value={isFree} onValueChange={setIsFree} trackColor={{ false: "#333", true: "#6A0DAD" }} thumbColor="#FFD700" />
            </View>
            {!isFree && (
              <View style={styles.priceInputRow}>
                <Text style={styles.currency}>₦</Text>
                <TextInput style={styles.priceValue} placeholder="0.00" placeholderTextColor="#333" keyboardType="numeric" value={price} onChangeText={setPrice} />
              </View>
            )}
          </View>

          {/* Manuscript Content - ACTS ADDED */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MANUSCRIPT CONTENT</Text>
            <View style={styles.modeSelector}>
              {(['full', 'chapters', 'acts'] as ManuscriptMode[]).map((mode) => (
                <TouchableOpacity 
                  key={mode} 
                  onPress={() => setManuscriptMode(mode)} 
                  style={[styles.modeTab, manuscriptMode === mode && styles.activeModeTab]}
                >
                  <Text style={[styles.modeTabText, manuscriptMode === mode && styles.activeModeTabText]}>{mode.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {manuscriptMode === "full" && (
              <TextInput style={styles.fullManuscriptInput} multiline placeholder="Paste full content..." placeholderTextColor="#222" value={fullContent} onChangeText={setFullContent} textAlignVertical="top" />
            )}

            {manuscriptMode === "chapters" && (
              <View>
                {chapters.map((chapter, index) => (
                  <View key={index} style={styles.chapterCard}>
                    <TextInput style={styles.chapterTitleInput} value={chapter.title} onChangeText={(t) => updateEntry('chapter', index, 'title', t)} placeholder="Chapter Title" placeholderTextColor="#555" />
                    <TextInput style={styles.chapterContentInput} multiline value={chapter.content} onChangeText={(t) => updateEntry('chapter', index, 'content', t)} placeholder="Content..." placeholderTextColor="#222" />
                  </View>
                ))}
                <TouchableOpacity onPress={addChapter} style={styles.addBtn}><Text style={styles.addBtnText}>+ ADD CHAPTER</Text></TouchableOpacity>
              </View>
            )}

            {manuscriptMode === "acts" && (
              <View>
                {acts.map((act, index) => (
                  <View key={index} style={styles.chapterCard}>
                    <TextInput style={styles.chapterTitleInput} value={act.title} onChangeText={(t) => updateEntry('act', index, 'title', t)} placeholder="Act Title" placeholderTextColor="#555" />
                    <TextInput style={styles.chapterContentInput} multiline value={act.content} onChangeText={(t) => updateEntry('act', index, 'content', t)} placeholder="Act Content..." placeholderTextColor="#222" />
                  </View>
                ))}
                <TouchableOpacity onPress={addAct} style={styles.addBtn}><Text style={styles.addBtnText}>+ ADD ACT</Text></TouchableOpacity>
              </View>
            )}
          </View>

          {/* LEGAL ACT & ANTI-PIRACY */}
          <View style={styles.legalBox}>
            <View style={styles.toggleRow}>
              <Text style={styles.legalHeading}>PUBLISHING & ANTI-PIRACY ACT</Text>
              <Switch value={agreedToTerms} onValueChange={setAgreedToTerms} trackColor={{ false: "#222", true: "#FFD700" }} />
            </View>
            <Text style={styles.legalText}>
              I solemnly swear that this work is my original intellectual property. I understand that <Text style={{color: '#FFD700'}}>PIRACY IS A CRIME</Text>. 
              Uploading stolen content results in permanent banning, forfeiture of earnings, and potential legal prosecution under intellectual property laws.
            </Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050208" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderColor: "#111" },
  headerTitle: { color: "#FFF", fontWeight: "900", letterSpacing: 2, fontSize: 12 },
  draftBtn: { color: "#888", fontWeight: "800", fontSize: 14 },
  publishBtn: { color: "#FFD700", fontWeight: "900", fontSize: 14 },
  scrollBody: { paddingHorizontal: 20, paddingTop: 20 },
  section: { marginBottom: 35 },
  sectionLabel: { color: "#FFD700", fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginBottom: 15 },
  coverRow: { flexDirection: "row", gap: 15 },
  coverPreview: { width: 90, height: 130, borderRadius: 8, borderWidth: 1, borderColor: "#222", overflow: "hidden", justifyContent: "center", alignItems: "center", borderStyle: 'dashed' },
  fullImage: { width: '100%', height: '100%' },
  writhaBadge: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#FFD700', paddingVertical: 2 },
  writhaBadgeText: { color: '#000', fontSize: 6, fontWeight: '900', textAlign: 'center' },
  coverRight: { flex: 1, justifyContent: 'center' },
  urlInput: { color: "#FFD700", borderBottomWidth: 1, borderBottomColor: "#222", paddingVertical: 5, fontSize: 13 },
  logoToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15 },
  logoToggleText: { color: '#666', fontSize: 12 },
  mainTitleInput: { color: "#FFF", fontSize: 30, fontWeight: "900", marginBottom: 10 },
  authorInput: { color: "#FFD700", fontSize: 18, fontWeight: "600", marginBottom: 10, borderBottomWidth: 1, borderBottomColor: "#1A1A1A", paddingBottom: 5 },
  descriptionInput: { color: "#888", fontSize: 15, lineHeight: 22, marginBottom: 30 },
  genreScroll: { flexDirection: "row" },
  genreChip: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: "#111", marginRight: 8, borderWidth: 1, borderColor: "#222" },
  activeGenreChip: { backgroundColor: "#FFD700", borderColor: "#FFD700" },
  genreText: { color: "#555", fontWeight: "700", fontSize: 11 },
  activeGenreText: { color: "#000" },
  customGenreInput: { color: "#FFD700", borderBottomWidth: 1, borderBottomColor: "#FFD700", marginTop: 15, fontSize: 14, paddingVertical: 5 },
  monetizationCard: { backgroundColor: "#0F071A", borderRadius: 15, padding: 20, borderWidth: 1, borderColor: "#222", marginBottom: 35 },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  monetizationTitle: { color: "#FFF", fontWeight: "700" },
  priceInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15, backgroundColor: '#000', borderRadius: 8, padding: 10 },
  currency: { color: '#FFD700', fontWeight: '900', marginRight: 10, fontSize: 18 },
  priceValue: { color: '#FFF', flex: 1, fontWeight: '700' },
  modeSelector: { flexDirection: 'row', backgroundColor: '#0A0510', borderRadius: 10, padding: 5, marginBottom: 15 },
  modeTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeModeTab: { backgroundColor: '#1A0B2E' },
  modeTabText: { color: '#444', fontSize: 10, fontWeight: '900' },
  activeModeTabText: { color: '#FFD700' },
  fullManuscriptInput: { color: '#BBB', fontSize: 15, lineHeight: 24, minHeight: 300, backgroundColor: '#0A0510', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: '#1A1A1A' },
  chapterCard: { backgroundColor: '#0A0510', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#1A1A1A' },
  chapterTitleInput: { color: '#FFF', fontWeight: '800', fontSize: 16, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#222', paddingBottom: 5 },
  chapterContentInput: { color: '#BBB', fontSize: 15, lineHeight: 24, minHeight: 150 },
  addBtn: { alignItems: 'center', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#FFD700', borderStyle: 'dashed' },
  addBtnText: { color: '#FFD700', fontSize: 11, fontWeight: '900' },
  legalBox: { backgroundColor: '#11051A', padding: 20, borderRadius: 15, borderWidth: 1, borderColor: '#222' },
  legalHeading: { color: '#FFD700', fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  legalText: { color: '#888', fontSize: 12, lineHeight: 18, marginTop: 10 },
});