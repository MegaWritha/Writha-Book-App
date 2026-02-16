import React, { useEffect, useState, useMemo } from 'react';
import { 
  View, Text, StyleSheet, Image, TouchableOpacity, 
  ScrollView, ActivityIndicator, Dimensions, StatusBar, Alert 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, where } from "firebase/firestore";

const { width } = Dimensions.get('window');

export default function BookIndex() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const bookId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);

  // --- STATE ---
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ weaves: 0 });
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!bookId) return;

    const unsubBook = onSnapshot(doc(db, "books", bookId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setBook({ 
          id: snap.id, 
          ...data,
          displayTitle: data.title || "Untitled Manuscript",
          displayAuthor: data.authorName || data.author || "Writha Author",
          cover: data.coverUrl || data.cover || data.image || null,
          description: data.description || data.summary || data.synopsis || "No description provided for this manuscript."
        });
        setLoading(false);
      } else {
        setLoading(false);
        Alert.alert("Archive Error", "This manuscript could not be found.");
        router.back();
      }
    });

    const qWeaves = query(collection(db, "weaves"), where("bookId", "==", bookId));
    const unsubStats = onSnapshot(qWeaves, (snap) => {
      setStats({ weaves: snap.size });
    });

    return () => {
      unsubBook();
      unsubStats();
    };
  }, [bookId]);

  // --- ACTIONS ---
  const toggleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    // Future: Update user's "library" collection in Firestore here
  };

  const handleDownload = async () => {
    setDownloading(true);
    // Simulate background download
    setTimeout(() => {
      setDownloading(false);
      Alert.alert("Success", "Manuscript archived for offline reading.");
    }, 2000);
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color="#FFD700" size="large" /></View>
  );

  const displayReads = book?.readsCount || 0;
  const activeReaders = displayReads > 0 ? Math.floor(displayReads / 8) + 1 : 0;

  return (
    <ScrollView style={styles.container} bounces={false} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" />
      
      {/* HERO SECTION */}
      <View style={styles.hero}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>

        {/* TOP RIGHT ACTIONS */}
        <View style={styles.topRightActions}>
          <TouchableOpacity style={styles.actionCircle} onPress={toggleBookmark}>
            <Ionicons 
              name={isBookmarked ? "bookmark" : "bookmark-outline"} 
              size={22} 
              color={isBookmarked ? "#FFD700" : "#FFF"} 
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCircle} onPress={handleDownload}>
            {downloading ? (
              <ActivityIndicator size="small" color="#FFD700" />
            ) : (
              <Feather name="download" size={20} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
        
        {book?.cover ? (
          <Image source={{ uri: book.cover }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={[styles.cover, styles.placeholderCover]}>
            <MaterialCommunityIcons name="book-open-variant" size={80} color="#FFD700" />
          </View>
        )}

        {book?.premium && (
          <View style={styles.premiumBadge}><Text style={styles.premiumText}>PREMIUM</Text></View>
        )}
      </View>

      {/* CONTENT SECTION */}
      <View style={styles.details}>
        <Text style={styles.title}>{book?.displayTitle}</Text>
        <Text style={styles.author}>{book?.displayAuthor}</Text>
        
        {book?.genre && <Text style={styles.genreTag}>{book.genre.toUpperCase()}</Text>}

        {/* STATS GRID */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{activeReaders}</Text>
            <Text style={styles.statLab}>Active Now</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{displayReads}</Text>
            <Text style={styles.statLab}>Total Reads</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{stats.weaves}</Text>
            <Text style={styles.statLab}>Weaves</Text>
          </View>
        </View>

        <Text style={styles.desc}>{book?.description}</Text>

        {/* PRIMARY ACTIONS */}
        <TouchableOpacity 
          style={styles.readBtn} 
          onPress={() => router.push({ pathname: "/book/[id]/reader", params: { id: bookId } })}
        >
          <Text style={styles.readTxt}>START READING</Text>
        </TouchableOpacity>

        {/* SECONDARY NAVIGATION */}
        <View style={styles.secondaryActions}>
          <TouchableOpacity style={styles.actionItem} onPress={() => router.push({ pathname: "/book/[id]/findings", params: { id: bookId } })}>
            <MaterialCommunityIcons name="book-open-variant" size={24} color="#FFD700" />
            <Text style={styles.actionText}>FINDINGS</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={() => router.push({ pathname: "/book/[id]/dictionary", params: { id: bookId } })}>
            <MaterialCommunityIcons name="translate" size={24} color="#FFD700" />
            <Text style={styles.actionText}>DICTIONARY</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.commBtn} onPress={() => router.push({ pathname: "/book/[id]/comments", params: { id: bookId } })}>
          <Text style={styles.commTxt}>JOIN THE DISCUSSION</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F071A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F071A' },
  hero: { height: 450, backgroundColor: '#1E1135', justifyContent: 'center', alignItems: 'center' },
  back: { position: 'absolute', top: 55, left: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 5 },
  topRightActions: { position: 'absolute', top: 55, right: 20, zIndex: 10, flexDirection: 'row' },
  actionCircle: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8, marginLeft: 10, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  cover: { width: 220, height: 320, borderRadius: 15, borderWidth: 3, borderColor: '#FFD700' },
  placeholderCover: { backgroundColor: '#1E1135', justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed' },
  premiumBadge: { position: 'absolute', bottom: 60, right: 30, backgroundColor: '#FFD700', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  premiumText: { color: '#000', fontWeight: '900', fontSize: 10 },
  details: { padding: 30, backgroundColor: '#0F071A', borderTopLeftRadius: 35, borderTopRightRadius: 35, marginTop: -40, minHeight: 500 },
  title: { color: '#FFF', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  author: { color: '#A78BFA', fontSize: 16, textAlign: 'center', marginTop: 8, fontWeight: '700', letterSpacing: 1 },
  genreTag: { color: '#FFD700', fontSize: 10, fontWeight: '900', textAlign: 'center', marginTop: 12, letterSpacing: 2 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 30, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#1E1135', paddingVertical: 20 },
  stat: { alignItems: 'center' },
  statVal: { color: '#FFF', fontWeight: '900', fontSize: 20 },
  statLab: { color: '#6D28D9', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 4 },
  desc: { color: '#A78BFA', textAlign: 'center', lineHeight: 24, marginBottom: 35, fontSize: 15 },
  readBtn: { backgroundColor: '#FFD700', padding: 22, borderRadius: 18, alignItems: 'center' },
  readTxt: { fontWeight: '900', letterSpacing: 2, color: '#000', fontSize: 16 },
  secondaryActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  actionItem: { flex: 0.48, backgroundColor: '#1E1135', padding: 15, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#4C1D95' },
  actionText: { color: '#FFF', fontSize: 10, fontWeight: 'bold', marginTop: 8 },
  commBtn: { padding: 20, alignItems: 'center', marginTop: 15 },
  commTxt: { color: '#A78BFA', fontWeight: 'bold', fontSize: 14, textDecorationLine: 'underline' }
});