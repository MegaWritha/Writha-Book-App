import React, { useEffect, useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  TextInput, Dimensions, StatusBar, ActivityIndicator, Alert, FlatList, Modal,
  KeyboardAvoidingView, Platform, Switch, Keyboard
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// --- INFRASTRUCTURE IMPORTS ---
import { auth, db } from "../../lib/firebase";
import { 
  collection, query, onSnapshot, doc, limit, 
  orderBy, addDoc, serverTimestamp, updateDoc, increment 
} from "firebase/firestore";
import { useFeedback } from "../../components/FeedbackProvider"; 
import { WrithaButton } from "../../components/WrithaButton";    
import { EmptyState } from "../../components/EmptyState";       
import { submitToGatekeeper } from "../../lib/submissions";     

const { width } = Dimensions.get("window");

const SectionHeader = ({ title, icon, onSeeAll }: { title: string, icon?: string, onSeeAll?: () => void }) => (
  <View style={styles.rowBetween}>
    <View style={styles.titleRow}>
      <Text style={styles.secTitle}>{title}</Text>
      {icon && <MaterialCommunityIcons name={icon as any} size={22} color="#FFD700" style={{marginLeft: 8}} />}
    </View>
    {onSeeAll && <TouchableOpacity onPress={onSeeAll}><Text style={styles.linkText}>See All</Text></TouchableOpacity>}
  </View>
);

export default function HomeScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const { showFeedback } = useFeedback();
  
  const [displayName, setDisplayName] = useState("");
  const [books, setBooks] = useState<any[]>([]);
  const [weaves, setWeaves] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isFabMenuOpen, setFabMenuOpen] = useState(false);
  
  // Post State
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);
  const [publishToWeb, setPublishToWeb] = useState(false);

  // Group books by genre dynamically
  const groupedBooks = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    books.forEach(book => {
      const genre = book.genre || "Other";
      if (!groups[genre]) groups[genre] = [];
      groups[genre].push(book);
    });
    return groups;
  }, [books]);

  useEffect(() => {
    if (!user) return;

    const unsubProfile = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setDisplayName(data.username ?? data.fullName ?? "");
      }
    });

    const unsubBooks = onSnapshot(query(collection(db, "books"), limit(20)), (snap) => {
      const bookList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBooks(bookList);
    });

    const unsubWeaves = onSnapshot(query(collection(db, "weaves"), limit(10)), (snap) => {
      setWeaves(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubGroups = onSnapshot(query(collection(db, "groups"), limit(10)), (snap) => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubDisc = onSnapshot(query(collection(db, "discussions"), orderBy("createdAt", "desc"), limit(15)), (snap) => {
      setDiscussions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));

    return () => { unsubProfile(); unsubBooks(); unsubWeaves(); unsubGroups(); unsubDisc(); };
  }, [user]);

  const handleLikeBook = async (bookId: string) => {
    try {
      const bookRef = doc(db, "books", bookId);
      await updateDoc(bookRef, { likesCount: increment(1) });
      showFeedback("Liked!", "success");
    } catch (e) {
      showFeedback("Error liking book", "error");
    }
  };

  const handlePublishPost = async () => {
    if (!newPost.trim()) return;
    setPosting(true);
    try {
      await addDoc(collection(db, "discussions"), {
        content: newPost,
        userId: user!.uid,
        userName: displayName || "User",
        userPhoto: user?.photoURL || "https://picsum.photos/100",
        likesCount: 0,
        commentsCount: 0,
        publishToWeb: publishToWeb,
        createdAt: serverTimestamp() 
      });
      showFeedback(publishToWeb ? "Published to App & Web!" : "Discussion published!", "success");
      setNewPost("");
      setPublishToWeb(false);
      setModalVisible(false);
    } catch (e) {
      showFeedback("Failed to post", "error");
    } finally {
      setPosting(false);
    }
  };

  const handleSearch = () => {
    const q = searchQuery.toLowerCase();
    const filtered = books.filter(b => b.title?.toLowerCase().includes(q) || b.genre?.toLowerCase().includes(q));
    setSearchResults(filtered);
    Keyboard.dismiss();
  };

  const resetSearch = () => {
    setSearchResults(null);
    setSearchQuery("");
  };

  const openFullResearchForm = () => {
    setFabMenuOpen(false);
    router.push("/create"); 
  };

  const renderBookItem = ({ item }: { item: any }) => (
    <View style={styles.bookWrapper}>
      <TouchableOpacity onPress={() => router.push(`/book/${item.id}`)}>
        <View style={styles.goldBorder}>
          <Image source={{ uri: item.coverUrl || item.cover || "https://picsum.photos/200/300" }} style={styles.bookCover} />
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>{item.price > 0 ? `$${item.price}` : "FREE"}</Text>
          </View>
        </View>
        <Text style={styles.bookTitle} numberOfLines={1}>{item.title}</Text>
      </TouchableOpacity>
      <View style={styles.bookActionRow}>
        <TouchableOpacity style={styles.actionIcon} onPress={() => router.push(`/book/${item.id}`)}>
          <Ionicons name="heart-outline" size={16} color="#e70505" />
          <Text style={styles.actionText}>{item.likesCount || 0}</Text>
        </TouchableOpacity>
        {/* REDIRECTED TO COMMENTS.TSX */}
        <TouchableOpacity style={styles.actionIcon} onPress={() => router.push(`/book/${item.id}/comments`)}>
          <Ionicons name="chatbubble-outline" size={16} color="#A78BFA" />
          <Text style={styles.actionText}>Comments</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionIcon} onPress={() => router.push(`/weave/${item.id}`)}>
          <MaterialCommunityIcons name="pencil-outline" size={16} color="#FFD700" />
          <Text style={styles.actionText}>Weave</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#FFD700" /></View>;

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.logoText}>WRITHA</Text>
          <Text style={styles.taglineText}>Read . Write . Discover</Text>
          <Text style={styles.welcomeText}>Hello{displayName ? `, ${displayName}` : ""}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/profile")}>
          <Image source={{ uri: user?.photoURL || "https://picsum.photos/100" }} style={styles.topAvatar} />
          <View style={styles.initialBadge}>
            <Text style={styles.initialText}>{displayName ? displayName.charAt(0).toUpperCase() : "U"}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#7C3AED" />
        <TextInput 
          style={styles.searchField}
          placeholder="Search for books, users, weaves..."
          placeholderTextColor="#6D28D9"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        {searchResults && (
          <TouchableOpacity onPress={resetSearch}>
            <Ionicons name="close-circle" size={22} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 120}}>
        {searchResults ? (
          <View style={styles.section}>
            <SectionHeader title="Search Results" />
            <TouchableOpacity style={styles.backBtn} onPress={resetSearch}>
              <Text style={styles.backBtnTxt}>← Back to Feed</Text>
            </TouchableOpacity>
            {searchResults.length === 0 && <EmptyState title="No matches" message="No books found." />}
            <FlatList 
              horizontal data={searchResults}
              renderItem={renderBookItem}
              keyExtractor={(item) => `search-${item.id}`}
            />
          </View>
        ) : (
          <>
            {/* 1. TRENDING WEAVES */}
            <View style={styles.section}>
              <SectionHeader title="Trending Weaves" onSeeAll={() => {}} />
              {weaves.length === 0 ? <EmptyState title="No weaves" message="No collaborative weaves active." /> : (
                <FlatList 
                  horizontal data={weaves} showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{paddingLeft: 20}}
                  renderItem={({item}) => (
                    <TouchableOpacity style={styles.weaveCard} onPress={() => router.push(`/weave/${item.id}`)}>
                      <Text style={styles.weaveTitle}>{item.title}</Text>
                      <View style={styles.weaveFooter}>
                        <Ionicons name="people" size={12} color="#FFD700" />
                        <Text style={styles.weaveInfo}>{item.collaborators || 1} Weaving</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>

            {/* 2. TRENDING BOOKS */}
            <View style={styles.section}>
              <SectionHeader title="Trending Books" onSeeAll={() => {}} />
              {books.length === 0 ? <EmptyState title="No books yet" message="Be the first to publish a masterpiece." /> : (
                <FlatList 
                  horizontal data={books} showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{paddingLeft: 20}}
                  renderItem={renderBookItem}
                />
              )}
            </View>

            {/* 3. TRENDING DISCUSSIONS */}
            <View style={styles.section}>
              <SectionHeader title="Trending Discussions" onSeeAll={() => {}} />
              {discussions.length === 0 ? (
                <EmptyState title="Quiet here..." message="The weave is quiet... start a discussion!" />
              ) : (
                <View style={styles.bubbleGrid}>
                  {discussions.map((item) => (
                    <View key={item.id} style={styles.bubbleCard}>
                      <TouchableOpacity onPress={() => router.push(`/create`)}>
                        <View style={styles.bubbleHeader}>
                          <Image source={{ uri: item.userPhoto || "https://picsum.photos/50" }} style={styles.bubblePfp} />
                          <Text style={styles.bubbleUser} numberOfLines={1}>{item.userName}</Text>
                        </View>
                        <Text style={styles.bubbleText} numberOfLines={3}>{item.content}</Text>
                      </TouchableOpacity>
                      <View style={styles.interactRow}>
                        <TouchableOpacity style={styles.iconBtn}><Ionicons name="heart-outline" size={14} color="#FF4D4D" /><Text style={styles.iconCount}>{item.likesCount || 0}</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push(`/create`)}><Ionicons name="chatbubble-outline" size={14} color="#A78BFA" /><Text style={styles.iconCount}>{item.commentsCount || 0}</Text></TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* 4. DYNAMIC GENRE SECTIONS (ROMANCE, SCI-FI, ETC) */}
            {Object.keys(groupedBooks).map((genre) => (
              <View key={genre} style={styles.section}>
                <SectionHeader title={genre} onSeeAll={() => {}} />
                <FlatList 
                  horizontal data={groupedBooks[genre]} showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{paddingLeft: 20}}
                  renderItem={renderBookItem}
                />
              </View>
            ))}
            
            {/* 5. ACTIVE GROUPS */}
            <View style={styles.section}>
              <SectionHeader title="Active Groups" onSeeAll={() => {}} />
              {groups.length === 0 ? <EmptyState title="No groups" message="Join a group to start a community." /> : (
                <FlatList 
                  horizontal data={groups} showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{paddingLeft: 20}}
                  renderItem={({item}) => (
                    <View style={styles.groupCard}>
                      <TouchableOpacity onPress={() => router.push(`/group/${item.id}`)}>
                        <Image source={{ uri: item.image || "https://picsum.photos/200" }} style={styles.groupImg} />
                      </TouchableOpacity>
                      <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
                      <TouchableOpacity style={styles.joinBtn}>
                        <Text style={styles.joinBtnTxt}>Join</Text>
                      </TouchableOpacity>
                      {item.isPublic && <Text style={styles.publicText}>Public</Text>}
                    </View>
                  )}
                />
              )}
            </View>
          </>
        )}
      </ScrollView>

      {isFabMenuOpen && (
        <View style={styles.fabMenu}>
          <TouchableOpacity style={styles.fabMenuItem} onPress={openFullResearchForm}>
            <Text style={styles.fabMenuText}>Full Research / Thesis</Text>
            <View style={styles.fabMiniIcon}><Ionicons name="book" size={18} color="#000" /></View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setFabMenuOpen(false); setModalVisible(true); }}>
            <Text style={styles.fabMenuText}>Random Discussion</Text>
            <View style={styles.fabMiniIcon}><Ionicons name="chatbubbles" size={18} color="#000" /></View>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setFabMenuOpen(!isFabMenuOpen)}>
        <MaterialCommunityIcons name={isFabMenuOpen ? "close" : "pencil-plus"} size={30} color="#000" />
      </TouchableOpacity>

      <Modal visible={isModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalBody}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Random Discussion</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={28} color="#FFF" /></TouchableOpacity>
            </View>
            <TextInput 
              style={styles.bigInput} placeholder="Write something..." placeholderTextColor="#666" 
              multiline value={newPost} onChangeText={setNewPost} autoFocus 
            />
            <View style={styles.webToggleRow}>
              <View>
                <Text style={styles.webToggleTitle}>Publish to Web</Text>
                <Text style={styles.webToggleSub}>Make this post visible on the public website</Text>
              </View>
              <Switch value={publishToWeb} onValueChange={setPublishToWeb} trackColor={{ false: "#333", true: "#4C1D95" }} thumbColor={publishToWeb ? "#FFD700" : "#f4f3f4"} />
            </View>
            <WrithaButton title="POST DISCUSSION" onPress={handlePublishPost} loading={posting} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#0F071A" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F071A" },
  header: { marginTop: 60, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoText: { color: "#FFD700", fontWeight: "900", letterSpacing: 4, fontSize: 18 },
  taglineText: { color: "#A78BFA", fontSize: 10, fontStyle: "italic", marginBottom: 4 },
  welcomeText: { color: "#FFF", fontSize: 22, fontWeight: "800" },
  topAvatar: { width: 45, height: 45, borderRadius: 22.5, borderWidth: 2, borderColor: "#FFD700" },
  initialBadge: { position: 'absolute', bottom: -5, right: -5, backgroundColor: '#4C1D95', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFF' },
  initialText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1135', margin: 20, borderRadius: 16, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: '#4C1D95' },
  searchField: { flex: 1, color: '#FFF', marginLeft: 10, fontSize: 15 },
  section: { marginTop: 25 },
  secTitle: { color: "#FFD700", fontSize: 16, fontWeight: "900", textTransform: "uppercase" },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 20 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingRight: 20 },
  linkText: { color: "#A78BFA", fontSize: 12, fontWeight: 'bold' },
  backBtn: { marginLeft: 20, marginBottom: 15 },
  backBtnTxt: { color: '#FFD700', fontWeight: 'bold' },
  bookWrapper: { width: 140, marginRight: 15, marginLeft: 20 },
  goldBorder: { borderRadius: 12, borderWidth: 2, borderColor: '#FFD700', overflow: 'hidden', position: 'relative' },
  bookCover: { width: '100%', height: 190 },
  priceTag: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#FFD700' },
  priceText: { color: '#FFD700', fontSize: 10, fontWeight: 'bold' },
  bookTitle: { color: '#FFF', fontSize: 13, fontWeight: 'bold', marginTop: 8, textAlign: 'center' },
  bookActionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 5 },
  actionIcon: { alignItems: 'center' },
  actionText: { color: '#A78BFA', fontSize: 9, marginTop: 2 },
  groupCard: { alignItems: 'center', marginRight: 20, width: 80 },
  groupImg: { width: 65, height: 65, borderRadius: 32.5, borderWidth: 2, borderColor: '#A78BFA' },
  groupName: { color: '#FFF', marginTop: 8, fontSize: 11, fontWeight: 'bold', textAlign: 'center' },
  joinBtn: { marginTop: 6, backgroundColor: '#1E1135', borderWidth: 1, borderColor: '#FFD700', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  joinBtnTxt: { color: '#FFD700', fontSize: 10, fontWeight: 'bold' },
  publicText: { color: '#888', fontSize: 9, marginTop: 4, fontStyle: 'italic' },
  weaveCard: { backgroundColor: '#1E1135', width: 200, padding: 15, borderRadius: 15, marginRight: 15, borderWidth: 1, borderColor: '#4C1D95' },
  weaveTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold', height: 40 },
  weaveFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  weaveInfo: { color: '#A78BFA', fontSize: 10, marginLeft: 5 },
  bubbleGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 15, justifyContent: 'space-between' },
  bubbleCard: { backgroundColor: '#1E1135', width: '48%', padding: 12, borderRadius: 18, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  bubblePfp: { width: 18, height: 18, borderRadius: 9, marginRight: 6 },
  bubbleUser: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  bubbleText: { color: '#CCC', fontSize: 11, height: 45 },
  interactRow: { flexDirection: 'row', marginTop: 10, borderTopWidth: 0.5, borderTopColor: '#333', paddingTop: 8 },
  iconBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 15 },
  iconCount: { color: '#888', fontSize: 10, marginLeft: 4 },
  fab: { position: 'absolute', bottom: 30, right: 25, backgroundColor: '#FFD700', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5, zIndex: 100 },
  fabMenu: { position: 'absolute', bottom: 100, right: 25, alignItems: 'flex-end', zIndex: 99 },
  fabMenuItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  fabMenuText: { color: '#FFF', backgroundColor: '#1E1135', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginRight: 10, fontSize: 12, fontWeight: 'bold', overflow: 'hidden' },
  fabMiniIcon: { backgroundColor: '#FFD700', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalBody: { backgroundColor: '#1E1135', padding: 25, borderTopLeftRadius: 30, borderTopRightRadius: 30, minHeight: 450 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { color: '#FFD700', fontWeight: '900', fontSize: 18 },
  bigInput: { color: '#FFF', fontSize: 16, height: 150, textAlignVertical: 'top', backgroundColor: '#0F071A', padding: 15, borderRadius: 12, marginBottom: 20 },
  webToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F071A', padding: 15, borderRadius: 12, marginBottom: 20 },
  webToggleTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  webToggleSub: { color: '#888', fontSize: 10, marginTop: 2 }
});