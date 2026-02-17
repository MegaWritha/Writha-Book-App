import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  TextInput, Dimensions, StatusBar, ActivityIndicator, Alert, FlatList, Modal,
  KeyboardAvoidingView, Platform
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth, db } from "@/lib/firebase";
import {
  collection, query, onSnapshot, doc,
  serverTimestamp, where, getDocs, limit, addDoc, orderBy
} from "firebase/firestore";

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

const EmptyState = ({ message }: { message: string }) => (
  <View style={styles.emptyBox}>
    <Text style={styles.emptyText}>{message}</Text>
  </View>
);

export default function HomeScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  
  const [displayName, setDisplayName] = useState("Writha User");
  const [books, setBooks] = useState<any[]>([]);
  const [weaves, setWeaves] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!user) return;

    // 1. Username Sync
    const unsubProfile = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) setDisplayName(snap.data().username || "Weaver");
    });

    // 2. Data Streams
    const unsubBooks = onSnapshot(query(collection(db, "books"), limit(10)), (snap) => {
      setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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

  const handleSearch = () => {
    const q = searchQuery.toLowerCase();
    const filtered = books.filter(b => b.title?.toLowerCase().includes(q) || b.genre?.toLowerCase().includes(q));
    setSearchResults(filtered);
  };

  const handleBookEntry = (item: any) => {
    if (item.isPaid && !item.purchasedBy?.includes(user?.uid)) {
      Alert.alert("Premium Content", "Unlock this book to start reading.", [
        { text: "Cancel" },
        { text: "Unlock", onPress: () => router.push({ pathname: "/checkout/[id]", params: { id: item.id } }) }
      ]);
    } else {
      router.push(`/book/${item.id}`);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#FFD700" /></View>;

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" />
      
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logoText}>WRITHA</Text>
          <Text style={styles.welcomeText}>Hello, {displayName}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/profile")}>
          <Image source={{ uri: user?.photoURL || "https://picsum.photos/100" }} style={styles.topAvatar} />
        </TouchableOpacity>
      </View>

      {/* SEARCH */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#7C3AED" />
        <TextInput 
          style={styles.searchField}
          placeholder="Search books, weavers, genres..."
          placeholderTextColor="#6D28D9"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        {searchResults && (
          <TouchableOpacity onPress={() => setSearchResults(null)}>
            <Ionicons name="close-circle" size={22} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 120}}>
        
        {searchResults ? (
          <View style={styles.section}>
            <SectionHeader title="Search Results" />
            <TouchableOpacity style={styles.backBtn} onPress={() => setSearchResults(null)}>
              <Text style={styles.backBtnTxt}>← Back to Feed</Text>
            </TouchableOpacity>
            {searchResults.length === 0 && <EmptyState message="No books found for that search." />}
            {searchResults.map(b => (
              <TouchableOpacity key={b.id} style={styles.searchItem} onPress={() => handleBookEntry(b)}>
                <Image source={{ uri: b.cover }} style={styles.resImg} />
                <View><Text style={styles.resTitle}>{b.title}</Text><Text style={styles.resGenre}>{b.genre}</Text></View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <>
            {/* 1. DISCUSSIONS (Bubble Grid) */}
            <View style={styles.section}>
              <SectionHeader title="Global Feed" icon="earth" />
              {discussions.length === 0 ? <EmptyState message="The weave is quiet... start a discussion!" /> : (
                <View style={styles.bubbleGrid}>
                  {discussions.map((item) => (
                    <View key={item.id} style={styles.bubbleCard}>
                      <View style={styles.bubbleHeader}>
                        <Image source={{ uri: item.userPhoto }} style={styles.bubblePfp} />
                        <Text style={styles.bubbleUser} numberOfLines={1}>{item.userName}</Text>
                      </View>
                      <Text style={styles.bubbleText} numberOfLines={3}>{item.content}</Text>
                      <View style={styles.interactRow}>
                        <TouchableOpacity style={styles.iconBtn}><Ionicons name="heart-outline" size={14} color="#FF4D4D" /><Text style={styles.iconCount}>{item.likesCount || 0}</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn}><Ionicons name="chatbubble-outline" size={14} color="#A78BFA" /><Text style={styles.iconCount}>{item.commentsCount || 0}</Text></TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* 2. TRENDING BOOKS (Gold Border + Under-buttons) */}
            <View style={styles.section}>
              <SectionHeader title="Trending Books" icon="fire" />
              {books.length === 0 ? <EmptyState message="No books have trended yet." /> : (
                <FlatList 
                  horizontal data={books} showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{paddingLeft: 20}}
                  renderItem={({item}) => (
                    <View style={styles.bookWrapper}>
                      <TouchableOpacity onPress={() => handleBookEntry(item)}>
                        <View style={styles.goldBorder}>
                          <Image source={{ uri: item.cover }} style={styles.bookCover} />
                          {item.isPaid && <View style={styles.lockIcon}><Ionicons name="lock-closed" size={12} color="#000" /></View>}
                        </View>
                        <Text style={styles.bookGenreTag}>{item.genre?.toUpperCase() || "GENRE"}</Text>
                        <Text style={styles.bookTitle} numberOfLines={1}>{item.title}</Text>
                      </TouchableOpacity>
                      <View style={styles.bookActionRow}>
                        <TouchableOpacity><Ionicons name="heart-outline" size={16} color="#FF4D4D" /></TouchableOpacity>
                        <TouchableOpacity><Ionicons name="chatbubble-outline" size={16} color="#A78BFA" /></TouchableOpacity>
                        <TouchableOpacity onPress={() => router.push(`/weave/${item.id}`)}><Ionicons name="pencil-outline" size={16} color="#FFD700" /></TouchableOpacity>
                      </View>
                    </View>
                  )}
                />
              )}
            </View>

            {/* 3. ACTIVE WEAVES */}
            <View style={styles.section}>
              <SectionHeader title="Active Weaves" icon="fountain-pen-tip" />
              {weaves.length === 0 ? <EmptyState message="No collaborative weaves active." /> : (
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

            {/* 4. TRENDING GROUPS */}
            <View style={styles.section}>
              <SectionHeader title="Active Groups" icon="account-group" />
              {groups.length === 0 ? <EmptyState message="Join a group to start a community." /> : (
                <FlatList 
                  horizontal data={groups} showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{paddingLeft: 20}}
                  renderItem={({item}) => (
                    <TouchableOpacity style={styles.groupCard} onPress={() => router.push(`/group/${item.id}`)}>
                      <Image source={{ uri: item.image || "https://picsum.photos/200" }} style={styles.groupImg} />
                      <Text style={styles.groupName}>{item.name}</Text>
                      <TouchableOpacity style={styles.weaveActionBtn} onPress={() => router.push(`/weave/${item.id}`)}>
                        <Text style={styles.weaveActionTxt}>WEAVE</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* FAB & MODAL */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <MaterialCommunityIcons name="pencil-plus" size={30} color="#000" />
      </TouchableOpacity>

      <Modal visible={isModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalBody}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share a Thought</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={28} color="#FFF" /></TouchableOpacity>
            </View>
            <TextInput 
              style={styles.bigInput} placeholder="Write something..." placeholderTextColor="#666" 
              multiline value={newPost} onChangeText={setNewPost} autoFocus 
            />
            <TouchableOpacity style={styles.publishBtn}><Text style={styles.publishText}>POST TO FEED</Text></TouchableOpacity>
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
  logoText: { color: "#FFD700", fontWeight: "900", letterSpacing: 6, fontSize: 12 },
  welcomeText: { color: "#FFF", fontSize: 26, fontWeight: "800", marginTop: 4 },
  topAvatar: { width: 45, height: 45, borderRadius: 22.5, borderWidth: 2, borderColor: "#FFD700" },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1135', margin: 20, borderRadius: 16, paddingHorizontal: 15, height: 55, borderWidth: 1, borderColor: '#4C1D95' },
  searchField: { flex: 1, color: '#FFF', marginLeft: 10, fontSize: 15 },
  section: { marginTop: 30 },
  secTitle: { color: "#FFD700", fontSize: 18, fontWeight: "900" },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 20 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingRight: 20 },
  linkText: { color: "#A78BFA", fontSize: 12, fontWeight: 'bold' },
  emptyBox: { padding: 30, alignItems: 'center' },
  emptyText: { color: '#666', fontSize: 13, fontStyle: 'italic' },
  backBtn: { marginLeft: 20, marginBottom: 15 },
  backBtnTxt: { color: '#FFD700', fontWeight: 'bold' },
  bubbleGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 15, justifyContent: 'space-between' },
  bubbleCard: { backgroundColor: '#1E1135', width: '48%', padding: 12, borderRadius: 18, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  bubblePfp: { width: 18, height: 18, borderRadius: 9, marginRight: 6 },
  bubbleUser: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  bubbleText: { color: '#CCC', fontSize: 11, height: 45 },
  interactRow: { flexDirection: 'row', marginTop: 10, borderTopWidth: 0.5, borderTopColor: '#333', paddingTop: 8 },
  iconBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 15 },
  iconCount: { color: '#888', fontSize: 10, marginLeft: 4 },
  bookWrapper: { width: 130, marginRight: 18, marginLeft: 20 },
  goldBorder: { borderRadius: 12, borderWidth: 2, borderColor: '#FFD700', overflow: 'hidden', position: 'relative' },
  bookCover: { width: 130, height: 180 },
  lockIcon: { position: 'absolute', top: 8, right: 8, backgroundColor: '#FFD700', padding: 5, borderRadius: 10 },
  bookGenreTag: { color: '#FFD700', fontSize: 9, fontWeight: '900', marginTop: 8 },
  bookTitle: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  bookActionRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10, backgroundColor: '#1E1135', padding: 8, borderRadius: 10 },
  weaveCard: { backgroundColor: '#1E1135', width: 200, padding: 15, borderRadius: 15, marginRight: 15, borderWidth: 1, borderColor: '#4C1D95' },
  weaveTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold', height: 40 },
  weaveFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  weaveInfo: { color: '#A78BFA', fontSize: 10, marginLeft: 5 },
  groupCard: { alignItems: 'center', marginRight: 20, backgroundColor: '#1E1135', padding: 15, borderRadius: 20 },
  groupImg: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#A78BFA' },
  groupName: { color: '#FFF', marginTop: 8, fontSize: 11, fontWeight: 'bold' },
  weaveActionBtn: { marginTop: 10, backgroundColor: '#FFD700', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 8 },
  weaveActionTxt: { fontSize: 9, fontWeight: '900' },
  fab: { position: 'absolute', bottom: 40, right: 25, backgroundColor: '#FFD700', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalBody: { backgroundColor: '#1E1135', padding: 25, borderTopLeftRadius: 30, borderTopRightRadius: 30, minHeight: 450 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { color: '#FFD700', fontWeight: '900' },
  bigInput: { color: '#FFF', fontSize: 16, height: 200, textAlignVertical: 'top' },
  publishBtn: { backgroundColor: '#FFD700', padding: 18, borderRadius: 15, alignItems: 'center' },
  publishText: { fontWeight: '900' },
  searchItem: { flexDirection: 'row', padding: 15, backgroundColor: '#1E1135', marginHorizontal: 20, borderRadius: 12, marginBottom: 10 },
  resImg: { width: 40, height: 60, borderRadius: 4, marginRight: 15 },
  resTitle: { color: '#FFF', fontWeight: 'bold' },
  resGenre: { color: '#FFD700', fontSize: 10 }
});