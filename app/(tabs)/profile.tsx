import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  Dimensions, StatusBar, ActivityIndicator, Alert, FlatList, Share
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { auth, db } from "@/lib/firebase";
import {
  collection, query, onSnapshot, doc, 
  deleteDoc, where, updateDoc
} from "firebase/firestore";

// IMPORT YOUR UPDATED COMPONENT
import { WeaveCard } from "@/components/WeaveCard";

const { width } = Dimensions.get("window");
// TABS UPDATED TO INCLUDE 'BOOKS READ'
const TABS = ["Posts", "Discussions", "Books Read", "Comments"];

// --- FULL BOOK ACTION GRID (FOR BOOKS READ TAB) ---
const BookActionGrid = ({ item, likedIds }: { item: any, likedIds: string[] }) => {
  const router = useRouter();
  const [stats, setStats] = useState({ likes: 0, comments: 0 });
  const isLiked = likedIds.includes(item.id);

  useEffect(() => {
    const unsubBook = onSnapshot(doc(db, "books", item.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setStats({ likes: data.likesCount || 0, comments: data.commentsCount || 0 });
      }
    });
    return () => unsubBook();
  }, [item.id]);

  return (
    <View style={styles.statGrid}>
      <View style={styles.gridBox}>
        <Ionicons name={isLiked ? "heart" : "heart-outline"} size={20} color={isLiked ? "#FFD700" : "#A78BFA"} />
        <View style={styles.numberFrame}><Text style={styles.gridNum}>{stats.likes}</Text></View>
      </View>
      <View style={styles.gridBox}>
        <Ionicons name="chatbubble-outline" size={18} color="#A78BFA" />
        <View style={styles.numberFrame}><Text style={styles.gridNum}>{stats.comments}</Text></View>
      </View>
    </View>
  );
};

export default function ProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  
  const [allWeaves, setAllWeaves] = useState<any[]>([]);
  const [libraryBooks, setLibraryBooks] = useState<any[]>([]);
  const [userComments, setUserComments] = useState<any[]>([]);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("Posts");

  useEffect(() => {
    if (!user) return;

    // 1. Profile Data
    const unsubProfile = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) setProfile(snap.data());
    });

    // 2. Weaves - FETCH ALL WITHOUT ORDERBY (To ensure they show up)
    const qW = query(collection(db, "weaves"), where("userId", "==", user.uid));
    const unsubWeaves = onSnapshot(qW, (snap) => {
      setAllWeaves(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));

    // 3. Books Read (Library)
    const unsubLikes = onSnapshot(collection(db, "users", user.uid, "likedBooks"), async (snap) => {
      const ids = snap.docs.map(d => d.id);
      setLikedIds(ids);
      const bookDetails = await Promise.all(ids.map(async (id) => {
        try {
          const res = await fetch(`https://gutendex.com/books/${id}`);
          const b = await res.json();
          return { id: id, title: b.title, cover: `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg` };
        } catch { return null; }
      }));
      setLibraryBooks(bookDetails.filter(b => b !== null));
    });

    // 4. Comments
    const qC = query(collection(db, "comments"), where("userId", "==", user.uid));
    const unsubComments = onSnapshot(qC, (snap) => {
      setUserComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubProfile(); unsubWeaves(); unsubLikes(); unsubComments(); };
  }, [user]);

  const handleMoreOptions = (item: any) => {
    Alert.alert("WEAVE OPTIONS", "Manage your thread", [
      { text: "Share", onPress: () => Share.share({ message: item.content || item.findings }) },
      { text: "Edit", onPress: () => router.push({ pathname: "/weave/edit", params: { id: item.id } }) },
      { text: "Delete", style: "destructive", onPress: async () => await deleteDoc(doc(db, "weaves", item.id)) },
      { text: "Cancel", style: "cancel" }
    ]);
  };

  const pickImage = async (field: "profilePic" | "coverPic") => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: field === "coverPic" ? [3, 1] : [1, 1], quality: 0.7 });
    if (!result.canceled) await updateDoc(doc(db, "users", user!.uid), { [field]: result.assets[0].uri });
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color="#FFD700" /></View>;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" />
      
      {/* HEADER WITH ALL BUTTONS */}
      <View style={styles.headerWrapper}>
        <View style={styles.goldBannerFrame}>
           {profile?.coverPic ? (
             <Image source={{ uri: profile.coverPic }} style={styles.coverImgFull} />
           ) : (
             <LinearGradient colors={["#8B5CF6", "#4C1D95", "#0F071A"]} style={styles.coverImgFull} />
           )}
        </View>
        <TouchableOpacity style={styles.coverCamera} onPress={() => pickImage("coverPic")}>
          <Ionicons name="camera" size={20} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push("/settings")}>
          <Ionicons name="settings-outline" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.avatarWrap}>
          <View style={styles.premiumAvatarBorder}>
            <Image source={{ uri: profile?.profilePic || `https://ui-avatars.com/api/?name=${profile?.firstName}` }} style={styles.avatar} />
            <TouchableOpacity style={styles.avatarCamera} onPress={() => pickImage("profilePic")}>
              <Ionicons name="camera" size={14} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.identity}>
        <Text style={styles.name}>{profile?.firstName} {profile?.lastName}</Text>
        <Text style={styles.username}>@{profile?.username || "thinker"}</Text>
        <Text style={styles.bio}>{profile?.bio || "A silent observer of great works."}</Text>
        <TouchableOpacity style={styles.editBtn} onPress={() => router.push("/edit-profile")}>
          <Text style={styles.editText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* STATS SECTION - WEAVES NOW LINKS TO POSTS TAB */}
      <View style={styles.stats}>
        <TouchableOpacity style={styles.statBox} onPress={() => router.push({ pathname: "/user/list", params: { type: 'followers', uid: user?.uid } })}>
          <Text style={styles.statValue}>{profile?.followersCount || 0}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statBox} onPress={() => router.push({ pathname: "/user/list", params: { type: 'following', uid: user?.uid } })}>
          <Text style={styles.statValue}>{profile?.followingCount || 0}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statBox} onPress={() => setActiveTab("Posts")}>
          <Text style={styles.statValue}>{allWeaves.length}</Text>
          <Text style={styles.statLabel}>Weaves</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statBox} onPress={() => setActiveTab("Books Read")}>
          <Text style={styles.statValue}>{profile?.booksRead || 0}</Text>
          <Text style={styles.statLabel}>Book Read</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && styles.activeTab]}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.feed}>
        {/* POSTS TAB */}
        {activeTab === "Posts" && (
            allWeaves.filter(w => w.type !== 'discussion').length > 0 ? (
                allWeaves.filter(w => w.type !== 'discussion').map(item => (
                    <WeaveCard key={item.id} item={item} onMenuPress={() => handleMoreOptions(item)} />
                ))
            ) : <Text style={styles.emptyText}>No weaves found in your posts.</Text>
        )}

        {/* DISCUSSIONS TAB */}
        {activeTab === "Discussions" && (
            allWeaves.filter(w => w.type === 'discussion').length > 0 ? (
                allWeaves.filter(w => w.type === 'discussion').map(item => (
                    <WeaveCard key={item.id} item={item} onMenuPress={() => handleMoreOptions(item)} />
                ))
            ) : <Text style={styles.emptyText}>No random discussions yet.</Text>
        )}

        {/* BOOKS READ TAB */}
        {activeTab === "Books Read" && (
            libraryBooks.length > 0 ? (
                <FlatList 
                    horizontal 
                    data={libraryBooks} 
                    renderItem={({item}) => (
                        <View style={styles.bookWrap}>
                            <TouchableOpacity onPress={() => router.push({ pathname: "/book/[id]", params: { id: item.id } })} style={styles.goldFrame}>
                                <Image source={{ uri: item.cover }} style={styles.coverImg} />
                            </TouchableOpacity>
                            <Text style={styles.bTitle} numberOfLines={1}>{item.title}</Text>
                            <BookActionGrid item={item} likedIds={likedIds} />
                        </View>
                    )} 
                    showsHorizontalScrollIndicator={false}
                />
            ) : <Text style={styles.emptyText}>No books read yet.</Text>
        )}

        {/* COMMENTS TAB */}
        {activeTab === "Comments" && (
            userComments.length > 0 ? (
                userComments.map(c => (
                    <View key={c.id} style={styles.commentItem}>
                        <Text style={styles.commentText}>{c.text || c.content}</Text>
                    </View>
                ))
            ) : <Text style={styles.emptyText}>No comments found on your profile.</Text>
        )}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F071A" },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F071A' },
  headerWrapper: { height: 230 },
  goldBannerFrame: { marginHorizontal: 15, marginTop: 15, borderRadius: 15, borderWidth: 3, borderColor: '#FFD700', overflow: 'hidden', height: 180 },
  coverImgFull: { height: '100%', width: "100%" },
  coverCamera: { position: "absolute", top: 35, left: 35, backgroundColor: "rgba(0,0,0,0.6)", padding: 8, borderRadius: 20, borderWidth: 1, borderColor: '#FFD700' },
  settingsBtn: { position: "absolute", top: 35, right: 35, backgroundColor: "rgba(0,0,0,0.5)", padding: 8, borderRadius: 20 },
  avatarWrap: { position: "absolute", bottom: -45, width: "100%", alignItems: "center" },
  premiumAvatarBorder: { borderWidth: 5, borderColor: "#0F071A", borderRadius: 60 },
  avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: "#FFF", backgroundColor: "#1E1135" },
  avatarCamera: { position: "absolute", bottom: 5, right: 5, backgroundColor: "#FFD700", padding: 8, borderRadius: 20, borderWidth: 3, borderColor: '#0F071A' },
  identity: { marginTop: 55, alignItems: "center", paddingHorizontal: 25 },
  name: { fontSize: 26, fontWeight: "800", color: "#FFF" },
  username: { color: "#FFD700", marginTop: 4, fontWeight: "600" },
  bio: { marginTop: 12, textAlign: "center", color: "#A78BFA", lineHeight: 22 },
  editBtn: { marginTop: 20, paddingHorizontal: 40, paddingVertical: 12, borderRadius: 25, borderWidth: 1, borderColor: "#4C1D95" },
  editText: { color: "#FFF", fontWeight: "700" },
  stats: { flexDirection: "row", margin: 20, backgroundColor: "#1E1135", borderRadius: 20, paddingVertical: 20 },
  statBox: { flex: 1, alignItems: "center" },
  statValue: { fontWeight: "800", color: "#FFF", fontSize: 18 },
  statLabel: { fontSize: 9, color: "#A78BFA", marginTop: 4, textTransform: 'uppercase' },
  tabs: { flexDirection: "row", justifyContent: "space-around", borderBottomWidth: 1, borderBottomColor: "#1E1135" },
  tab: { paddingVertical: 18 },
  activeTab: { borderBottomWidth: 3, borderBottomColor: "#FFD700" },
  tabText: { color: "#4C1D95", fontWeight: "bold" },
  activeTabText: { color: "#FFD700" },
  feed: { padding: 20 },
  emptyText: { color: '#4C1D95', textAlign: 'center', marginTop: 40, fontStyle: 'italic', fontSize: 16 },
  bookWrap: { width: 140, marginRight: 20 },
  goldFrame: { width: '100%', height: 200, borderRadius: 12, borderWidth: 2, borderColor: "#FFD700", overflow: 'hidden' },
  coverImg: { width: '100%', height: '100%' },
  bTitle: { color: '#FFF', fontWeight: 'bold', marginTop: 8, fontSize: 11 },
  statGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, backgroundColor: '#1E1135', borderRadius: 8, padding: 5 },
  gridBox: { alignItems: 'center', flex: 1, flexDirection: 'row', justifyContent: 'center' },
  numberFrame: { backgroundColor: '#0F071A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, marginLeft: 4 },
  gridNum: { color: '#FFD700', fontSize: 10, fontWeight: '900' },
  commentItem: { backgroundColor: '#1E1135', padding: 15, borderRadius: 10, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#FFD700' },
  commentText: { color: '#FFF' }
});