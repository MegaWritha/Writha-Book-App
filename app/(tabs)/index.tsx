import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  TextInput, Dimensions, StatusBar, ActivityIndicator, Alert, FlatList, Modal
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth, db } from "@/lib/firebase";
import {
  collection, query, orderBy, onSnapshot, doc,
  setDoc, deleteDoc, serverTimestamp, increment, where, getDocs, limit, addDoc
} from "firebase/firestore";

const { width } = Dimensions.get("window");

// COMPONENT: BOOK ACTION GRID
const BookActionGrid = ({ item, likedIds, onLike }: { item: any, likedIds: string[], onLike: (id: string) => void }) => {
  const router = useRouter();
  const [stats, setStats] = useState({ likes: 0, comments: 0, weaves: 0 });
  const isLiked = likedIds.includes(item.id);

  useEffect(() => {
    const unsubBook = onSnapshot(doc(db, "books", item.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setStats(prev => ({
          ...prev,
          likes: data.likesCount || 0,
          comments: data.commentsCount || 0
        }));
      }
    });

    const q = query(collection(db, "weaves"), where("bookId", "==", item.id));
    const unsubWeaves = onSnapshot(q, (snap) => {
      setStats(prev => ({ ...prev, weaves: snap.size }));
    });

    return () => { unsubBook(); unsubWeaves(); };
  }, [item.id]);

  return (
    <View style={styles.statGrid}>
      <View style={styles.gridBox}>
        <TouchableOpacity onPress={() => onLike(item.id)}>
          <Ionicons name={isLiked ? "heart" : "heart-outline"} size={22} color={isLiked ? "#FFD700" : "#A78BFA"} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.numberFrame}>
          <Text style={styles.gridNum}>{stats.likes}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.gridBox}>
        <TouchableOpacity onPress={() => router.push({ pathname: "/book/[id]/comments", params: { id: item.id } })}>
          <Ionicons name="chatbubble-outline" size={20} color="#A78BFA" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.numberFrame}>
          <Text style={styles.gridNum}>{stats.comments}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.gridBox}>
        <TouchableOpacity onPress={() => router.push({ pathname: "/weave/create", params: { bookId: item.id, bookTitle: item.title } })}>
          <MaterialCommunityIcons name="fountain-pen-tip" size={20} color="#FFD700" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.numberFrame}>
          <Text style={styles.gridNum}>{stats.weaves}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const firstName = user?.displayName ? user.displayName.split(" ")[0] : "Writha user";

  const [books, setBooks] = useState<any[]>([]);
  const [weaves, setWeaves] = useState<any[]>([]);
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{books: any[], users: any[], weaves: any[]} | null>(null);
  
  // Discussion Modal State
  const [isModalVisible, setModalVisible] = useState(false);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 5000);

    // Fetch Books
    const unsubBooks = onSnapshot(
      query(collection(db, "books"), limit(50)), 
      (snap) => {
        setBooks(snap.docs.map(d => ({ 
          id: d.id, 
          ...d.data(),
          cover: d.data().coverUrl || d.data().cover,
          trendScore: ((d.data().likesCount || 0) * 2) + (d.data().commentsCount || 0) + ((d.data().views || 0) / 10)
        })));
        setLoading(false);
        clearTimeout(timer);
      }
    );

    // Fetch Trending Weaves (Added fallback to handle missing fields)
    const unsubWeaves = onSnapshot(
      query(collection(db, "weaves"), limit(10)),
      (snap) => {
        const weaveData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort manually to avoid empty results if Firebase field is missing
        setWeaves(weaveData.sort((a: any, b: any) => (b.likesCount || 0) - (a.likesCount || 0)));
      }
    );

    // Fetch Random Discussions
    const unsubDiscussions = onSnapshot(
      query(collection(db, "discussions"), limit(20)),
      (snap) => {
        const discData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort manually by date
        setDiscussions(discData.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      }
    );

    if (user) {
      onSnapshot(collection(db, "users", user.uid, "likedBooks"), (snap) => {
        setLikedIds(snap.docs.map(d => d.id));
      });
    }

    return () => { unsubBooks(); unsubWeaves(); unsubDiscussions(); clearTimeout(timer); };
  }, [user]);

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.trim().length === 0) { setSearchResults(null); return; }
    const textLower = text.toLowerCase();
    const bookHits = books.filter(b => b.title?.toLowerCase().includes(textLower) || b.genre?.toLowerCase().includes(textLower));

    try {
      const userQ = query(collection(db, "users"), where("displayName", ">=", text), where("displayName", "<=", text + "\uf8ff"), limit(5));
      const userSnap = await getDocs(userQ);
      const userHits = userSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const weaveQ = query(collection(db, "weaves"), where("title", ">=", text), where("title", "<=", text + "\uf8ff"), limit(5));
      const weaveSnap = await getDocs(weaveQ);
      const weaveHits = weaveSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setSearchResults({ books: bookHits, users: userHits, weaves: weaveHits });
    } catch (e) {
      setSearchResults({ books: bookHits, users: [], weaves: [] });
    }
  };

  const handleLike = async (bookId: string) => {
    if (!user) return Alert.alert("Join Writha", "Sign in to save books.");
    const likeRef = doc(db, "users", user.uid, "likedBooks", bookId);
    const bookRef = doc(db, "books", bookId);
    if (likedIds.includes(bookId)) {
      await deleteDoc(likeRef);
      await setDoc(bookRef, { likesCount: increment(-1) }, { merge: true });
    } else {
      await setDoc(likeRef, { bookId, timestamp: serverTimestamp() });
      await setDoc(bookRef, { likesCount: increment(1) }, { merge: true });
    }
  };

  const createDiscussion = async () => {
    if (!newPost.trim() || !user) return;
    setPosting(true);
    try {
      await addDoc(collection(db, "discussions"), {
        content: newPost,
        userId: user.uid,
        userName: user.displayName || "Writha User",
        userPhoto: user.photoURL || "https://picsum.photos/100",
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
      });
      setNewPost("");
      setModalVisible(false);
    } catch (e) {
      Alert.alert("Error", "Could not post discussion.");
    } finally {
      setPosting(false);
    }
  };

  const renderBookItem = ({ item }: { item: any }) => (
    <View style={styles.bookWrap}>
      <TouchableOpacity onPress={() => router.push({ pathname: "/book/[id]", params: { id: item.id } })} style={styles.goldFrame}>
        <Image source={{ uri: item.cover || "https://picsum.photos/300/500" }} style={styles.cover} />
        <div style={item.premium ? styles.paidTag : styles.freeTag}>
          <Text style={styles.tagText}>{item.premium ? "PAID" : "FREE"}</Text>
        </div>
      </TouchableOpacity>
      <Text style={styles.bTitle} numberOfLines={1}>{item.title}</Text>
      <BookActionGrid item={item} likedIds={likedIds} onLike={handleLike} />
    </View>
  );

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color="#FFD700" /></View>;

  const trendingBooks = [...books].sort((a, b) => b.trendScore - a.trendScore).slice(0, 10);
  const genres = [...new Set(books.map(b => b.genre || "Other"))];

  return (
    <View style={{flex: 1, backgroundColor: "#0F071A"}}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <StatusBar barStyle="light-content" />

        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>WRITHA</Text>
            <Text style={styles.hello}>Hello, {firstName}</Text>
            <Text style={styles.tagline}>Start reading manual & classic books</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/profile")}>
            <Image source={{ uri: user?.photoURL || "https://picsum.photos/100" }} style={styles.pfp} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={20} color="#7C3AED" />
          <TextInput placeholder="Search books, users, weaves..." placeholderTextColor="#6D28D9" style={styles.input} value={searchQuery} onChangeText={handleSearch} />
        </View>

        {/* 1. TRENDING BOOKS */}
        {!searchResults && trendingBooks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={styles.secTitle}>Trending Books</Text>
              <MaterialCommunityIcons name="fire" size={24} color="#FFD700" style={{marginRight: 20}} />
            </View>
            <FlatList horizontal data={trendingBooks} renderItem={renderBookItem} keyExtractor={i => `trend-book-${i.id}`} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }} />
          </View>
        )}

        {/* 2. TRENDING DISCUSSIONS - UPGRADED UI */}
        {!searchResults && discussions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>Trending Discussions</Text>
            <FlatList
              horizontal
              data={discussions}
              keyExtractor={i => `disc-${i.id}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: 20 }}
              renderItem={({item}) => (
                <TouchableOpacity 
                  style={styles.discussionCard} 
                  onPress={() => router.push({ pathname: "/discussion/[id]", params: { id: item.id } } as any)}
                >
                  <View style={styles.discHeader}>
                    <Image source={{ uri: item.userPhoto }} style={styles.discPfp} />
                    <View>
                      <Text style={styles.discUser}>{item.userName}</Text>
                      <Text style={styles.discTime}>Active Community</Text>
                    </View>
                  </View>
                  <Text style={styles.discContent} numberOfLines={3}>{item.content}</Text>
                  <View style={styles.discFooter}>
                    <View style={styles.discStatWrap}>
                       <Ionicons name="heart" size={14} color="#FFD700" />
                       <Text style={styles.discStat}>{item.likesCount || 0}</Text>
                    </View>
                    <View style={styles.discStatWrap}>
                       <Ionicons name="chatbubble" size={12} color="#A78BFA" />
                       <Text style={styles.discStat}>{item.commentsCount || 0}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* 3. TRENDING WEAVES */}
        {!searchResults && weaves.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>Trending Weaves</Text>
            <FlatList
              horizontal
              data={weaves}
              keyExtractor={i => `trend-w-${i.id}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: 20 }}
              renderItem={({item}) => (
                <TouchableOpacity style={styles.weaveCard} onPress={() => router.push(`/weave/${item.id}`)}>
                  <MaterialCommunityIcons name="fountain-pen-tip" size={20} color="#FFD700" style={{marginBottom: 8}} />
                  <Text style={styles.weaveTitle} numberOfLines={2}>{item.title}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* 4. GENRES */}
        {!searchResults && genres.map((genre) => (
          <View style={styles.section} key={genre}>
            <Text style={styles.secTitle}>{genre}</Text>
            <FlatList horizontal data={books.filter(b => (b.genre || "Other") === genre)} renderItem={renderBookItem} keyExtractor={i => i.id} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }} />
          </View>
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="chatbubbles" size={28} color="#000" />
      </TouchableOpacity>

      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Discussion</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity>
            </View>
            <TextInput 
              placeholder="What's on your mind? Start a random discussion..." 
              placeholderTextColor="#666" 
              multiline 
              style={styles.modalInput} 
              value={newPost} 
              onChangeText={setNewPost} 
            />
            <TouchableOpacity style={styles.postBtn} onPress={createDiscussion} disabled={posting}>
              {posting ? <ActivityIndicator color="#000" /> : <Text style={styles.postBtnText}>POST DISCUSSION</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F071A" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F071A" },
  header: { marginTop: 60, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between' },
  logo: { color: "#FFD700", fontSize: 14, fontWeight: "900", letterSpacing: 8 },
  hello: { color: "#FFF", fontSize: 28, fontWeight: "800", marginTop: 5 },
  tagline: { color: "#A78BFA", fontSize: 13 },
  pfp: { width: 45, height: 45, borderRadius: 22.5, borderWidth: 2, borderColor: "#FFD700" },
  searchWrap: { margin: 20, backgroundColor: "#1E1135", height: 55, borderRadius: 15, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderWidth: 1, borderColor: '#4C1D95' },
  input: { flex: 1, marginLeft: 10, color: '#FFF' },
  section: { marginTop: 35 },
  secTitle: { fontSize: 22, fontWeight: "900", color: "#FFD700", marginLeft: 20, marginBottom: 15 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bookWrap: { width: 150, marginRight: 20 },
  goldFrame: { width: '100%', height: 220, borderRadius: 12, borderWidth: 2, borderColor: "#FFD700", overflow: 'hidden' },
  cover: { width: '100%', height: '100%' },
  bTitle: { color: '#FFF', fontWeight: 'bold', marginTop: 10, fontSize: 12 },
  statGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, backgroundColor: '#1E1135', borderRadius: 10, padding: 6, borderWidth: 1, borderColor: '#4C1D95' },
  gridBox: { alignItems: 'center', flex: 1 },
  numberFrame: { backgroundColor: '#0F071A', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 3, borderWidth: 1, borderColor: '#4C1D95' },
  gridNum: { color: '#FFD700', fontSize: 10, fontWeight: '900' },
  paidTag: { position: 'absolute', top: 10, right: 10, backgroundColor: '#FFD700', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  freeTag: { position: 'absolute', top: 10, right: 10, backgroundColor: '#22C55E', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  tagText: { color: '#000', fontSize: 8, fontWeight: '900' },
  
  // Premium Weave Cards
  weaveCard: { backgroundColor: '#1E1135', width: 200, height: 120, padding: 15, borderRadius: 18, marginRight: 15, borderWidth: 1, borderColor: '#4C1D95', justifyContent: 'flex-start' },
  weaveTitle: { color: '#FFF', fontSize: 14, fontWeight: '800', lineHeight: 20 },
  
  // Premium Discussion Cards
  discussionCard: { backgroundColor: '#1E1135', width: 280, padding: 20, borderRadius: 24, marginRight: 15, borderWidth: 1, borderColor: '#4C1D95', shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  discHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  discPfp: { width: 34, height: 34, borderRadius: 17, marginRight: 10, borderWidth: 1, borderColor: '#FFD700' },
  discUser: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  discTime: { color: '#6D28D9', fontSize: 10, fontWeight: 'bold' },
  discContent: { color: '#E9D5FF', fontSize: 13, lineHeight: 20, marginBottom: 15 },
  discFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#2D1B4E', paddingTop: 10 },
  discStatWrap: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  discStat: { color: '#FFD700', fontSize: 12, marginLeft: 5, fontWeight: '800' },

  fab: { position: 'absolute', bottom: 30, right: 25, width: 65, height: 65, borderRadius: 32.5, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center', elevation: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1E1135', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, minHeight: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { color: '#FFD700', fontSize: 18, fontWeight: '900' },
  modalInput: { color: '#FFF', fontSize: 16, textAlignVertical: 'top', height: 150 },
  postBtn: { backgroundColor: '#FFD700', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 20 },
  postBtnText: { color: '#000', fontWeight: '900' }
});