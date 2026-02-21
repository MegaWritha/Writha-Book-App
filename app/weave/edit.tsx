import React, { useEffect, useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

export default function EditWeave() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    const fetchWeave = async () => {
      try {
        const snap = await getDoc(doc(db, "weaves", id as string));
        if (snap.exists()) {
          setTitle(snap.data().title);
          setContent(snap.data().content || snap.data().findings);
        }
        setLoading(false);
      } catch (e) {
        Alert.alert("Error", "Could not load weave.");
        router.back();
      }
    };
    fetchWeave();
  }, [id]);

  const handleUpdate = async () => {
    if (!title.trim() || !content.trim()) return Alert.alert("Required", "Fields cannot be empty.");
    setIsSubmitting(true);
    try {
      const weaveRef = doc(db, "weaves", id as string);
      const feedRef = doc(db, "feed", id as string);
      
      const updateData = { title, content, updatedAt: new Date() };
      
      await updateDoc(weaveRef, updateData);
      // Update in global feed as well
      await updateDoc(feedRef, updateData).catch(() => null); 

      Alert.alert("Updated", "Your weave has been modified.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert("Error", "Update failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#FFD700" /></View>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="close" size={28} color="#FFF" /></TouchableOpacity>
        <Text style={styles.headerTitle}>EDIT WEAVE</Text>
        <TouchableOpacity onPress={handleUpdate} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#FFD700" /> : <Text style={styles.saveBtn}>SAVE</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body}>
        <Text style={styles.label}>TITLE</Text>
        <TextInput style={styles.titleInp} value={title} onChangeText={setTitle} placeholderTextColor="#4C1D95" />
        
        <Text style={styles.label}>CONTENT</Text>
        <TextInput style={styles.contentInp} value={content} onChangeText={setContent} multiline placeholderTextColor="#4C1D95" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F071A" },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: "#0F071A" },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#1E1135' },
  headerTitle: { color: '#FFD700', fontWeight: '900', letterSpacing: 2 },
  saveBtn: { color: '#FFD700', fontWeight: 'bold' },
  body: { padding: 20 },
  label: { color: "#6D28D9", fontSize: 10, fontWeight: "900", marginBottom: 10, marginTop: 20 },
  titleInp: { fontSize: 22, color: "#FFF", fontWeight: "bold", borderBottomWidth: 1, borderBottomColor: '#1E1135', paddingBottom: 10 },
  contentInp: { fontSize: 16, color: "#A78BFA", marginTop: 10, lineHeight: 24, minHeight: 300, textAlignVertical: 'top' }
});