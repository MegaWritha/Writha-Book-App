import React, { useEffect, useState, memo } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity,
  Image, SafeAreaView, StatusBar, RefreshControl, Alert, Share
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { db, auth } from "../../lib/firebase";
import {
  collection, query, orderBy, limit, startAfter, onSnapshot,
  getDocs, doc, updateDoc, arrayUnion, arrayRemove, getDoc, deleteDoc
} from "firebase/firestore";

const PAGE_SIZE = 15;
const THEME = {
  bg: "#000000",
  surface: "#080808",
  card: "#111111",
  accent: "#D4AF37", // Writha Gold
  purple: "#8E2DE2", // Writha Purple
  text: "#FFFFFF",
  muted: "#6B7280",
  border: "#1A1A1A",
  red: "#FF4B4B"
};

export default function GlobalFeedTab() {
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  const [posts, setPosts] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // 1. IDENTITY & NOTIFICATION DATA
  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then(snap => snap.exists() && setUserData(snap.data()));
  }, [uid]);

  // 2. THE MASTER QUERY
  useEffect(() => {
    const masterQ = query(
      collection(db, "feed"),
      orderBy("priorityLevel", "desc"),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE)
    );

    const unsub = onSnapshot(masterQ, (snap) => {
      if (snap.empty) {
        const fallbackQ = query(collection(db, "feed"), orderBy("createdAt", "desc"), limit(PAGE_SIZE));
        getDocs(fallbackQ).then(fSnap => {
          setPosts(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          setLastDoc(fSnap.docs[fSnap.docs.length - 1]);
          setLoading(false);
        });
      } else {
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLastDoc(snap.docs[snap.docs.length - 1]);
        setLoading(false);
      }
      setRefreshing(false);
    }, (err) => {
      console.log("Firestore Notice:", err.message);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const loadMore = async () => {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);
    const nextQ = query(collection(db, "feed"), orderBy("createdAt", "desc"), startAfter(lastDoc), limit(PAGE_SIZE));
    const snap = await getDocs(nextQ);
    setPosts(prev => [...prev, ...snap.docs.map(d => ({ id: d.id, ...d.data() }))]);
    setLastDoc(snap.docs[snap.docs.length - 1]);
    setLoadingMore(false);
  };

  const toggleLike = async (post: any) => {
    if (!uid) return;
    const liked = post.likedBy?.includes(uid);
    await updateDoc(doc(db, "feed", post.id), {
      likedBy: liked ? arrayRemove(uid) : arrayUnion(uid),
      likesCount: liked ? Math.max((post.likesCount || 1) - 1, 0) : (post.likesCount || 0) + 1
    });
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={THEME.accent} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.brandSub}>WRITHA ARCHIVE</Text>
          <Text style={styles.brandMain}>Pulse</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.bellBtn} onPress={() => router.push("/notifications" as any)}>
             <Ionicons name="notifications" size={22} color={THEME.accent} />
             {userData?.hasUnread && <View style={styles.notifDot} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.goldHeaderFrame} onPress={() => router.push("/profile")}>
            <Image source={{ uri: userData?.profileImage || `https://ui-avatars.com/api/?name=${userData?.displayName}` }} style={styles.headerAvatar} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard item={item} uid={uid} toggleLike={toggleLike} />}
        onEndReached={loadMore}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="broadcast-off" size={40} color={THEME.border} />
            <Text style={styles.emptyText}>Nothing's here yet</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(true)} tintColor={THEME.accent} />}
      />
    </SafeAreaView>
  );
}

const PostCard = memo(({ item, uid, toggleLike }: any) => {
  const router = useRouter();
  const liked = item.likedBy?.includes(uid);
  const isOwner = uid === item.userId || uid === item.authorId;

  // SETTINGS LOGIC: DELETE, HIDE, SHARE
  const handleSettings = () => {
    const options: any[] = [
      { text: "Share Transmission", onPress: onShare },
      { text: "Hide Post", onPress: () => Alert.alert("Hidden", "This post will no longer appear in your pulse.") },
      { text: "Cancel", style: "cancel" as const }
    ];

    if (isOwner) {
      options.splice(1, 0, { 
        text: "Delete Permanent", 
        style: "destructive" as const, 
        onPress: confirmDelete 
      });
    }

    Alert.alert("Archive Settings", "Manage this data stream", options);
  };

  const onShare = async () => {
    try {
      await Share.share({ message: `Check out this Writha post: ${item.title || item.content}` });
    } catch (error) { console.log(error); }
  };

  const confirmDelete = () => {
    Alert.alert("Delete?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => await deleteDoc(doc(db, "feed", item.id)) }
    ]);
  };

  const renderContent = () => {
    switch (item.type) {
      case "book_update":
        return (
          <View>
            <Text style={styles.label}>BOOK UPDATE</Text>
            {item.image && <Image source={{ uri: item.image }} style={styles.postImg} />}
            <Text style={styles.postTitle}>{item.title}</Text>
          </View>
        );
      case "admin":
        return (
          <View style={styles.adminBox}>
            <Text style={[styles.label, { color: THEME.purple }]}>ADMIN ANNOUNCEMENT</Text>
            <Text style={styles.postTitle}>{item.title}</Text>
            <Text style={styles.postText}>{item.content}</Text>
          </View>
        );
      case "research":
        return (
          <View>
            <Text style={[styles.label, { color: '#00D1FF' }]}>RESEARCH DATA</Text>
            <Text style={styles.postTitle}>{item.title}</Text>
            <Text style={styles.postText}>{item.content}</Text>
          </View>
        );
      case "ad":
        return (
           <View>
             <Text style={styles.label}>SPONSORED</Text>
             {item.image && <Image source={{ uri: item.image }} style={styles.postImg} />}
             <Text style={styles.postTitle}>{item.title}</Text>
           </View>
        );
      default:
        return (
          <View>
            {item.title && <Text style={styles.postTitle}>{item.title}</Text>}
            <Text style={styles.postText}>{item.content}</Text>
            {item.image && <Image source={{ uri: item.image }} style={styles.postImg} />}
          </View>
        );
    }
  };

  return (
    <View style={[styles.card, item.isPinned && styles.pinnedCard]}>
      <View style={styles.authorRow}>
        <View style={styles.authorGroup}>
          <View style={styles.avatarGoldFrame}>
            <Image 
              source={{ uri: `https://ui-avatars.com/api/?name=${item.authorName || item.username}&background=8E2DE2&color=D4AF37&bold=true` }} 
              style={styles.avatar} 
            />
          </View>
          <View style={{ marginLeft: 12 }}>
            {/* NAME FIX: Checks every possible name field in your Firebase */}
            <Text style={styles.authorName}>{item.authorName || item.displayName || item.fullName || item.username}</Text>
            <Text style={styles.authorTag}>@{item.username || "writha"}</Text>
          </View>
        </View>
        {/* HITSLOP FIX: Makes the touch area much larger */}
        <TouchableOpacity 
          style={styles.threeDots} 
          onPress={handleSettings}
          hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={THEME.muted} />
        </TouchableOpacity>
      </View>

      {item.isPinned && <View style={styles.pinRow}><Ionicons name="pin" size={12} color={THEME.accent} /><Text style={styles.pinText}>PINNED TO TOP</Text></View>}

      <TouchableOpacity onPress={() => router.push(`/discussion/${item.id}` as any)}>
        {renderContent()}
      </TouchableOpacity>

      <View style={styles.actions}>
        <View style={styles.leftActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(item)}>
            <Ionicons name={liked ? "heart" : "heart-outline"} size={22} color={liked ? THEME.red : THEME.muted} />
            <Text style={[styles.actionTxt, liked && { color: THEME.red }]}>{item.likesCount || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => router.push(`/discussion/${item.id}/comments` as any)}
          >
            <Ionicons name="chatbubble-outline" size={20} color={THEME.muted} />
            <Text style={styles.actionTxt}>{item.commentsCount || 0}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={onShare}><Ionicons name="share-social-outline" size={20} color={THEME.accent} /></TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  header: { paddingHorizontal: 25, paddingTop: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  brandSub: { color: THEME.purple, fontSize: 10, fontWeight: "900", letterSpacing: 4 },
  brandMain: { color: "#FFF", fontSize: 44, fontWeight: "900", letterSpacing: -2, marginTop: -5 },
  bellBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  notifDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.purple, borderWidth: 2, borderColor: '#111' },
  goldHeaderFrame: { padding: 2, borderRadius: 16, borderWidth: 1.5, borderColor: THEME.accent },
  headerAvatar: { width: 34, height: 34, borderRadius: 13 },
  listContainer: { paddingHorizontal: 16, paddingBottom: 100 },
  card: { backgroundColor: THEME.card, borderRadius: 32, padding: 22, marginBottom: 20, borderWidth: 1, borderColor: THEME.border },
  pinnedCard: { borderColor: THEME.accent, backgroundColor: '#0A0A05' },
  authorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  authorGroup: { flexDirection: 'row', alignItems: 'center' },
  avatarGoldFrame: { padding: 2, borderRadius: 14, borderWidth: 1, borderColor: THEME.accent },
  avatar: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#222' },
  authorName: { color: '#FFF', fontSize: 16, fontWeight: "800" },
  authorTag: { color: THEME.accent, fontSize: 11, fontWeight: "700" },
  threeDots: { padding: 10 },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  pinText: { color: THEME.accent, fontSize: 10, fontWeight: "900" },
  label: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 8 },
  adminBox: { borderLeftWidth: 3, borderLeftColor: THEME.purple, paddingLeft: 15 },
  postTitle: { color: "#FFF", fontSize: 20, fontWeight: "900", marginBottom: 8 },
  postText: { color: "#BBB", fontSize: 15, lineHeight: 22, marginBottom: 15 },
  postImg: { width: '100%', height: 230, borderRadius: 22, marginBottom: 15 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#1A1A1A', paddingTop: 18, marginTop: 10 },
  leftActions: { flexDirection: 'row', gap: 25 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionTxt: { color: THEME.muted, fontSize: 14, fontWeight: "800" },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { color: THEME.muted, fontSize: 16, marginTop: 10, fontWeight: "600" }
});