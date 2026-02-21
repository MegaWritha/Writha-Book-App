import React, { useState } from 'react';
import { 
  View, Text, TextInput, Switch, TouchableOpacity, StyleSheet, 
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

export default function CreateWeave() {
  const { bookId, bookTitle, type: initialType } = useLocalSearchParams();
  const router = useRouter();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wasPublished, setWasPublished] = useState(false); 
  const [title, setTitle] = useState("");
  const [type, setType] = useState(initialType?.toString() || "Discussion");
  const [isPublic, setIsPublic] = useState(true);
  const [content, setContent] = useState("");
  const [rating, setRating] = useState("");    
  const [sources, setSources] = useState("");  
  const [findings, setFindings] = useState(""); 

  const weaveTypes = ["Critique", "Research", "Discussion", "Findings", "Theory"];

  const handlePublish = async () => {
    if (!title.trim()) return Alert.alert("Required", "Please provide a title for your weave.");
    
    if (type === "Critique" && !rating.trim()) return Alert.alert("Incomplete", "Please add a rating for your critique.");
    if (type === "Research" && !sources.trim()) return Alert.alert("Incomplete", "Research requires source citations.");
    if (!content.trim() && type !== "Findings") return Alert.alert("Empty", "You haven't written the body of your weave.");

    setIsSubmitting(true); 

    try {
      const user = auth.currentUser;
      const weaveData = {
        bookId: bookId || "global",
        bookTitle: bookTitle || "General Thought",
        title,
        type,
        content,
        rating: type === "Critique" ? rating : null,
        sources: type === "Research" ? sources : null,
        findings: type === "Findings" ? findings : null,
        isPublic,
        userId: user?.uid, 
        userName: user?.displayName || "Writha Member",
        userPhoto: user?.photoURL || "https://picsum.photos/100",
        createdAt: serverTimestamp(),
      };

      // 1. Save to weaves
      const docRef = await addDoc(collection(db, "weaves"), weaveData);

      // 2. Mirror to global_feed immediately
      if (isPublic) {
        await setDoc(doc(db, "feed", docRef.id), {
          ...weaveData,
          likesCount: 0,
          likedBy: [],
        });
      }

      // ✅ SUCCESS UI TRIGGER
      setIsSubmitting(false);
      setWasPublished(true); 

      // Delay navigation so you actually see the green button
      setTimeout(() => {
        router.back();
      }, 1800);

    } catch (e) {
      console.error("Publish Error:", e);
      setIsSubmitting(false);
      setWasPublished(false);
      Alert.alert("Error", "Check your connection or Firebase permissions.");
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="close" size={28} color="#FFF" /></TouchableOpacity>
          <Text style={styles.headerTitle}>WEAVE SUITE</Text>
          <View style={{width: 28}} />
        </View>

        <Text style={styles.label}>TARGET WORK</Text>
        <Text style={styles.bookTitle}>{bookTitle || "Writha Global Feed"}</Text>
        
        <TextInput 
          style={styles.mainTitleInp} 
          placeholder="Give your thought a name..." 
          placeholderTextColor="#4C1D95" 
          value={title} 
          onChangeText={setTitle} 
        />

        <Text style={styles.label}>INTELLECTUAL CATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          {weaveTypes.map(t => (
            <TouchableOpacity key={t} onPress={() => setType(t)} style={[styles.catBtn, type === t && styles.activeCat]}>
              <Text style={[styles.catTxt, type === t && {color: '#000'}]}>{t.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ... (Critique, Research, Findings sections remain exactly the same) */}
        {type === "Critique" && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>CRITICAL RATING</Text>
            <TextInput style={styles.cardInp} placeholder="e.g. 9.2/10" placeholderTextColor="#6D28D9" value={rating} onChangeText={setRating} />
          </View>
        )}
        {type === "Research" && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>SOURCES & EVIDENCE</Text>
            <TextInput style={styles.cardInp} placeholder="Citations or URLs..." placeholderTextColor="#6D28D9" value={sources} onChangeText={setSources} />
          </View>
        )}
        {type === "Findings" && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>KEY DISCOVERIES</Text>
            <TextInput style={[styles.cardInp, {height: 80}]} placeholder="What did you uncover?" multiline value={findings} onChangeText={setFindings} />
          </View>
        )}

        <Text style={styles.label}>{type === "Critique" ? "THE REVIEW" : "THE THOUGHT"}</Text>
        <TextInput 
          style={styles.editor} 
          placeholder="Start weaving..." 
          placeholderTextColor="#4C1D95" 
          multiline 
          value={content} 
          onChangeText={setContent} 
        />

        <View style={styles.privacyBox}>
          <View style={{flex: 1, marginRight: 10}}>
            <Text style={styles.privTitle}>Post to Global Feed</Text>
            <Text style={styles.privSub}>{isPublic ? "Public Intellectual Contribution" : "Stored in Private Library"}</Text>
          </View>
          <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ false: '#1E1135', true: '#FFD700' }} thumbColor="#FFF" />
        </View>

        {/* REINFORCED BUTTON LOGIC */}
        <TouchableOpacity 
          style={[
            styles.pubBtn, 
            wasPublished ? { backgroundColor: '#22C55E' } : (isSubmitting ? { opacity: 0.7 } : {})
          ]} 
          onPress={handlePublish}
          disabled={isSubmitting || wasPublished}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#000" />
          ) : wasPublished ? (
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Ionicons name="checkmark-done" size={24} color="#000" style={{marginRight: 10}} />
              <Text style={styles.pubTxt}>PUBLISHED</Text>
            </View>
          ) : (
            <Text style={styles.pubTxt}>PUBLISH WEAVE</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F071A", padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 30 },
  headerTitle: { color: '#FFD700', fontWeight: '900', letterSpacing: 3, fontSize: 14 },
  label: { color: "#6D28D9", fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginBottom: 10, marginTop: 25 },
  bookTitle: { color: "#FFF", fontSize: 18, fontWeight: "300", fontStyle: 'italic' },
  mainTitleInp: { fontSize: 28, color: "#FFF", fontWeight: "bold", marginTop: 15, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1E1135' },
  catScroll: { flexDirection: 'row', marginTop: 5 },
  catBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 5, borderWidth: 1, borderColor: '#1E1135', marginRight: 10 },
  activeCat: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  catTxt: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  card: { backgroundColor: '#1E1135', padding: 20, borderRadius: 12, marginTop: 20, borderLeftWidth: 4, borderLeftColor: '#FFD700' },
  cardLabel: { color: '#A78BFA', fontSize: 10, fontWeight: 'bold', marginBottom: 5 },
  cardInp: { color: '#FFF', fontSize: 16 },
  editor: { backgroundColor: '#1E1135', color: '#FFF', padding: 20, borderRadius: 12, minHeight: 250, textAlignVertical: 'top', marginTop: 10, fontSize: 16, lineHeight: 24 },
  privacyBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 30, backgroundColor: '#1E1135', padding: 20, borderRadius: 12 },
  privTitle: { color: '#FFF', fontWeight: 'bold' },
  privSub: { color: '#6D28D9', fontSize: 11, marginTop: 2 },
  pubBtn: { backgroundColor: '#FFD700', padding: 22, borderRadius: 12, alignItems: 'center', marginTop: 40 },
  pubTxt: { fontWeight: '900', letterSpacing: 2, color: '#000' }
});