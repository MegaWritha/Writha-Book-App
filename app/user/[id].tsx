import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, Image, ScrollView, 
  TouchableOpacity, ActivityIndicator 
} from 'react-native'; // ✅ Fixed: ActivityIndicator added to imports
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import FollowButton from './FollowButton'; // ✅ Integrated your component
import { Ionicons } from '@expo/vector-icons';

export default function UserProfile() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [weaves, setWeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    // Fetch Profile Data
    const fetchUser = async () => {
      try {
        const snap = await getDoc(doc(db, "users", id as string));
        if (snap.exists()) setProfile(snap.data());
      } catch (e) { console.error("Profile fetch error:", e); }
    };

    // Real-time Weaves from this user
    const q = query(
      collection(db, "weaves"), 
      where("creatorId", "==", id), 
      where("isPublic", "==", true)
    );
    
    const unsub = onSnapshot(q, (snap) => {
      setWeaves(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    fetchUser();
    return () => unsub();
  }, [id]);

  if (loading) return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color="#FFD700" />
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* HEADER NAV */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#FFD700" />
      </TouchableOpacity>

      <View style={styles.header}>
        <Image source={{ uri: profile?.photoURL || "https://picsum.photos/200" }} style={styles.pfp} />
        <Text style={styles.name}>{profile?.displayName || "Writha Member"}</Text>
        <Text style={styles.bio}>{profile?.bio || "Exploring the depths of literature on Writha."}</Text>
        
        {/* FOLLOW COMPONENT */}
        <View style={styles.followWrap}>
           <FollowButton targetUserId={id as string} />
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{weaves.length}</Text>
          <Text style={styles.statLabel}>WEAVES</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{profile?.tribeCount || 0}</Text>
          <Text style={styles.statLabel}>TRIBE</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Public Research & Findings</Text>
      
      {weaves.length > 0 ? weaves.map(w => (
        <TouchableOpacity key={w.id} style={styles.wCard} onPress={() => router.push(`/weave/${w.id}`)}>
          <View style={styles.wHeader}>
            <Text style={styles.wType}>{w.type?.toUpperCase()}</Text>
            <Text style={styles.wDate}>{new Date(w.createdAt?.seconds * 1000).toLocaleDateString()}</Text>
          </View>
          <Text style={styles.wTitle}>{w.title}</Text>
          <Text style={styles.wSnippet} numberOfLines={2}>{w.content}</Text>
        </TouchableOpacity>
      )) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>This user hasn't published any public weaves yet.</Text>
        </View>
      )}

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F071A" },
  loader: { flex: 1, backgroundColor: "#0F071A", justifyContent: 'center', alignItems: 'center' },
  backBtn: { marginTop: 50, marginLeft: 20 },
  header: { alignItems: 'center', marginTop: 20 },
  pfp: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: '#FFD700' },
  name: { color: '#FFF', fontSize: 24, fontWeight: '900', marginTop: 15 },
  bio: { color: '#A78BFA', textAlign: 'center', paddingHorizontal: 40, marginTop: 8, fontSize: 14, lineHeight: 20 },
  followWrap: { marginTop: 20, width: 150 },
  statsRow: { flexDirection: 'row', justifyContent: 'center', marginVertical: 30, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#1E1135', paddingVertical: 15 },
  statItem: { alignItems: 'center', marginHorizontal: 30 },
  statNum: { color: '#FFD700', fontSize: 20, fontWeight: '800' },
  statLabel: { color: '#FFF', fontSize: 10, letterSpacing: 1, marginTop: 4 },
  sectionTitle: { color: '#FFD700', fontSize: 18, fontWeight: '900', marginLeft: 20, marginBottom: 15 },
  wCard: { backgroundColor: '#1E1135', marginHorizontal: 20, padding: 20, borderRadius: 15, marginBottom: 12, borderWidth: 1, borderColor: '#4C1D95' },
  wHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  wType: { color: '#FFD700', fontSize: 10, fontWeight: 'bold' },
  wDate: { color: '#6D28D9', fontSize: 10 },
  wTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  wSnippet: { color: '#A78BFA', fontSize: 13, marginTop: 5 },
  emptyCard: { margin: 20, padding: 30, backgroundColor: '#1E1135', borderRadius: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: '#4C1D95' },
  emptyText: { color: '#6D28D9', textAlign: 'center', fontStyle: 'italic' }
});