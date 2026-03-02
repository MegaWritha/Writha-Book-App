import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  Dimensions, StatusBar, ActivityIndicator, Alert, Share
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { auth, db } from "@/lib/firebase";
import { collection, query, onSnapshot, doc, where, getDoc } from "firebase/firestore";
import FollowButton from "../user/FollowButton";
import { WeaveCard } from "@/components/WeaveCard";

const { width } = Dimensions.get("window");
const TABS = ["Posts", "Discussions", "Books Read"];

const THEME = {
  bg: "#0F071A", ui: "#1E1135", ui2: "#2D1B4D",
  accent: "#FFD700", purple: "#6D28D9", purpleLight: "#A78BFA",
  text: "#E2E8F0", textMuted: "#94A3B8",
};

interface BookItem {
  id: string;
  title: string;
  cover: string;
}

interface BookStats {
  [bookId: string]: { likeCount: number; commentCount: number };
}

// FIX #4: Stats passed as props — no self-subscribing Firestore listener per card
const BookActionGrid = ({
  item,
  likedIds,
  stats,
}: {
  item: BookItem;
  likedIds: string[];
  stats: { likeCount: number; commentCount: number };
}) => {
  const isLiked = likedIds.includes(item.id);
  return (
    <View style={styles.statGrid}>
      <View style={styles.gridBox}>
        <Ionicons name={isLiked ? "heart" : "heart-outline"} size={18} color={isLiked ? THEME.accent : THEME.purpleLight} />
        <Text style={styles.gridNum}>{stats.likeCount}</Text>
      </View>
      <View style={styles.gridBox}>
        <Ionicons name="chatbubble-outline" size={16} color={THEME.purpleLight} />
        <Text style={styles.gridNum}>{stats.commentCount}</Text>
      </View>
    </View>
  );
};

// FIX #7: onError fallback works on both iOS and Android (defaultSource is iOS-only)
const BookCoverImage = ({ uri, title }: { uri: string; title: string }) => {
  const [src, setSrc] = useState(uri);
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&size=200&background=1E1135&color=FFD700`;
  return <Image source={{ uri: src }} style={styles.bookCover} onError={() => setSrc(fallback)} />;
};

export default function ScholarProfileScreen() {
  const params = useLocalSearchParams();
  const id = (params.id || params.uid) as string;
  const router = useRouter();

  // ✅ FIX: Wait for Firebase auth to confirm who is logged in before computing isMe
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // ✅ FIX: All three conditions must be true — never show Edit button by accident
  const isMe = authReady && !!currentUser && !!id && id === currentUser.uid;

  const [profile, setProfile] = useState<any>(null);
  const [allWeaves, setAllWeaves] = useState<any[]>([]);
  const [libraryBooks, setLibraryBooks] = useState<BookItem[]>([]);
  const [bookStats, setBookStats] = useState<BookStats>({});
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Posts");
  const [profileError, setProfileError] = useState(false);

  // FIX #5: prevent setState on unmounted component
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // FIX #4: one centralized subscription for all book stats
  const subscribeToBookStats = useCallback((bookIds: string[]) => {
    if (!bookIds.length) return () => {};
    const unsubs = bookIds.map((bookId) =>
      onSnapshot(doc(db, "books", bookId), (snap) => {
        if (!isMounted.current) return;
        if (snap.exists()) {
          const d = snap.data();
          setBookStats((prev) => ({
            ...prev,
            [bookId]: {
              likeCount: d.likeCount || 0,       // FIX #3: matches weaves.ts field name
              commentCount: d.commentCount || 0, // FIX #3: matches weaves.ts field name
            },
          }));
        }
      })
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => {
    if (!id) {
      setProfileError(true);
      setLoading(false);
      return;
    }

    let unsubProfile: any, unsubWeaves: any, unsubLikes: any;
    let unsubBookStats: (() => void) | undefined;

    const init = async () => {
      try {
        const profileSnap = await getDoc(doc(db, "users", id));
        if (!profileSnap.exists()) {
          if (isMounted.current) { setProfileError(true); setLoading(false); }
          return;
        }

        if (isMounted.current) setProfile(profileSnap.data());

        unsubProfile = onSnapshot(doc(db, "users", id), (snap) => {
          if (snap.exists() && isMounted.current) setProfile(snap.data());
        });

        const qW = query(collection(db, "weaves"), where("userId", "==", id));
        unsubWeaves = onSnapshot(
          qW,
          (snap) => {
            if (!isMounted.current) return;
            setAllWeaves(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setLoading(false);
          },
          () => { if (isMounted.current) setLoading(false); }
        );

        unsubLikes = onSnapshot(
          collection(db, "users", id, "likedBooks"),
          async (snap) => {
            const ids = snap.docs.map((d) => d.id);
            if (!isMounted.current) return;
            setLikedIds(ids);

            unsubBookStats?.();

            // FIX #6: use formats["image/jpeg"] from API for reliable cover URL
            const results = await Promise.allSettled(
              ids.map(async (bookId) => {
                try {
                  const res = await fetch(`https://gutendex.com/books/${bookId}`);
                  if (!res.ok) return null;
                  const b = await res.json();
                  const cover =
                    b.formats?.["image/jpeg"] ||
                    `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.cover.medium.jpg`;
                  return { id: bookId, title: b.title, cover };
                } catch {
                  return null;
                }
              })
            );

            if (!isMounted.current) return; // FIX #5: guard after async gap

            const validBooks = results
              .filter((r) => r.status === "fulfilled" && r.value !== null)
              .map((r) => (r as any).value);

            setLibraryBooks(validBooks);
            unsubBookStats = subscribeToBookStats(validBooks.map((b: BookItem) => b.id));
          }
        );
      } catch (e) {
        console.error("Profile load error:", e);
        if (isMounted.current) { setProfileError(true); setLoading(false); }
      }
    };

    init();
    return () => {
      unsubProfile?.();
      unsubWeaves?.();
      unsubLikes?.();
      unsubBookStats?.();
    };
  }, [id, subscribeToBookStats]);

  const handleMoreOptions = (item: any) => {
    Alert.alert("SCHOLAR WEAVE", "Actions", [
      { text: "Share", onPress: () => Share.share({ message: item.content || item.findings || item.title }) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const getDisplayName = () => {
    if (!profile) return "Scholar";
    if (profile.displayName) return profile.displayName;
    if (profile.firstName || profile.lastName)
      return `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
    if (profile.name) return profile.name;
    return "Writha Scholar";
  };

  const getUsername = () => profile?.username || profile?.handle || "scholar";

  const getAvatar = () =>
    profile?.profilePic || profile?.photoURL || profile?.photo ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(getDisplayName())}&background=1E1135&color=FFD700`;

  if (profileError) {
    return (
      <View style={styles.errorScreen}>
        <Ionicons name="person-circle-outline" size={64} color={THEME.purpleLight} />
        <Text style={styles.errorTitle}>Profile Not Found</Text>
        <Text style={styles.errorSub}>This scholar may have deleted their account.</Text>
        <TouchableOpacity style={styles.errorBackBtn} onPress={() => router.back()}>
          <Text style={styles.errorBackTxt}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading || !authReady) {
    // ✅ FIX: also wait for auth before rendering — avoids Edit button flash
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={THEME.accent} />
        <Text style={{ color: THEME.textMuted, marginTop: 12 }}>Loading profile...</Text>
      </View>
    );
  }

  const posts = allWeaves.filter((w) => w.type !== "discussion");
  const discussions = allWeaves.filter((w) => w.type === "discussion");
  // FIX #9: prefer stored count on profile doc to avoid flicker
  const weavesCount = profile?.weavesCount ?? allWeaves.length;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" />

      <View style={styles.headerWrapper}>
        <View style={styles.coverFrame}>
          {profile?.coverPic ? (
            <Image source={{ uri: profile.coverPic }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient colors={["#8B5CF6", "#4C1D95", "#0F071A"]} style={StyleSheet.absoluteFill} />
          )}
          <View style={styles.coverOverlay} />
        </View>

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => Share.share({ message: `Check out ${getDisplayName()} on Writha!` })}
        >
          <Ionicons name="share-outline" size={22} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.avatarWrap}>
          <View style={styles.avatarBorder}>
            <Image source={{ uri: getAvatar() }} style={styles.avatar} />
          </View>
          {/* FIX #8: strict boolean check */}
          {profile?.isOnline === true && <View style={styles.onlineDot} />}
        </View>
      </View>

      <View style={styles.identity}>
        <Text style={styles.name}>{getDisplayName()}</Text>
        <Text style={styles.username}>@{getUsername()}</Text>
        {profile?.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : (
          <Text style={[styles.bio, { fontStyle: "italic", opacity: 0.5 }]}>A silent observer of great works.</Text>
        )}
        {profile?.genres && profile.genres.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsRow}>
            {profile.genres.map((g: string) => (
              <View key={g} style={styles.genreTag}>
                <Text style={styles.genreTagTxt}>{g}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* ✅ FIX: authReady guard ensures isMe is never wrong due to auth timing */}
        <View style={styles.actionRow}>
          {isMe ? (
            <TouchableOpacity style={styles.editBtn} onPress={() => router.push("/edit-profile" as any)}>
              <Ionicons name="pencil" size={16} color={THEME.accent} />
              <Text style={styles.editBtnTxt}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.otherActions}>
              <FollowButton targetUserId={id} />
              <TouchableOpacity style={styles.msgBtn} onPress={() => router.push(`/chat/${id}` as any)}>
                <Ionicons name="chatbubble-ellipses" size={18} color="#000" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <View style={styles.statsRow}>
        {[
          { label: "Followers", value: profile?.followersCount || 0 },
          { label: "Following", value: profile?.followingCount || 0 },
          { label: "Weaves", value: weavesCount },
          { label: "Books", value: libraryBooks.length },
        ].map((s, i) => (
          <View key={s.label} style={[styles.statBox, i < 3 && styles.statBorder]}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && styles.activeTab]}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
            {tab === "Posts" && posts.length > 0 && <View style={styles.tabBadge}><Text style={styles.tabBadgeTxt}>{posts.length}</Text></View>}
            {tab === "Discussions" && discussions.length > 0 && <View style={styles.tabBadge}><Text style={styles.tabBadgeTxt}>{discussions.length}</Text></View>}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.feed}>

        {activeTab === "Posts" && (
          posts.length > 0
            ? posts.map((item) => <WeaveCard key={item.id} item={item} onMenuPress={() => handleMoreOptions(item)} />)
            : <View style={styles.emptyState}>
                <Text style={{ fontSize: 40 }}>✍️</Text>
                <Text style={styles.emptyTitle}>No Posts Yet</Text>
                <Text style={styles.emptySub}>{isMe ? "Share your first weave!" : "This scholar hasn't posted yet."}</Text>
              </View>
        )}

        {activeTab === "Discussions" && (
          discussions.length > 0
            ? discussions.map((item) => <WeaveCard key={item.id} item={item} onMenuPress={() => handleMoreOptions(item)} />)
            : <View style={styles.emptyState}>
                <Text style={{ fontSize: 40 }}>💬</Text>
                <Text style={styles.emptyTitle}>No Discussions Yet</Text>
                <Text style={styles.emptySub}>{isMe ? "Start an intellectual discussion!" : "No discussions from this scholar."}</Text>
              </View>
        )}

        {/* FIX #1: horizontal ScrollView instead of FlatList nested inside ScrollView */}
        {activeTab === "Books Read" && (
          libraryBooks.length > 0
            ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
                {libraryBooks.map((item) => (
                  <View key={item.id} style={styles.bookWrap}>
                    <TouchableOpacity style={styles.bookCoverFrame} onPress={() => router.push(`/book/${item.id}` as any)} activeOpacity={0.85}>
                      <BookCoverImage uri={item.cover} title={item.title} />
                    </TouchableOpacity>
                    <Text style={styles.bookTitle} numberOfLines={2}>{item.title}</Text>
                    <BookActionGrid
                      item={item}
                      likedIds={likedIds}
                      stats={bookStats[item.id] ?? { likeCount: 0, commentCount: 0 }}
                    />
                  </View>
                ))}
              </ScrollView>
            )
            : <View style={styles.emptyState}>
                <Text style={{ fontSize: 40 }}>📚</Text>
                <Text style={styles.emptyTitle}>No Books Yet</Text>
                <Text style={styles.emptySub}>{isMe ? "Like books to add them to your library!" : "No books in this scholar's library."}</Text>
              </View>
        )}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: THEME.bg },
  errorScreen: { flex: 1, backgroundColor: THEME.bg, justifyContent: "center", alignItems: "center", padding: 30 },
  errorTitle: { color: THEME.text, fontSize: 22, fontWeight: "800", marginTop: 16 },
  errorSub: { color: THEME.textMuted, fontSize: 14, marginTop: 8, textAlign: "center" },
  errorBackBtn: { marginTop: 24, paddingHorizontal: 28, paddingVertical: 12, backgroundColor: THEME.ui, borderRadius: 14 },
  errorBackTxt: { color: THEME.accent, fontWeight: "800" },
  headerWrapper: { height: 240, position: "relative" },
  coverFrame: { position: "absolute", top: 0, left: 0, right: 0, height: 190, overflow: "hidden" },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,7,26,0.35)" },
  backBtn: { position: "absolute", top: 52, left: 20, backgroundColor: "rgba(0,0,0,0.5)", padding: 8, borderRadius: 12, zIndex: 10 },
  shareBtn: { position: "absolute", top: 52, right: 20, backgroundColor: "rgba(0,0,0,0.5)", padding: 8, borderRadius: 12, zIndex: 10 },
  avatarWrap: { position: "absolute", bottom: -10, alignSelf: "center", zIndex: 5 },
  avatarBorder: { borderWidth: 4, borderColor: THEME.bg, borderRadius: 60, backgroundColor: THEME.ui },
  avatar: { width: 108, height: 108, borderRadius: 54, borderWidth: 2, borderColor: THEME.accent },
  onlineDot: { position: "absolute", bottom: 4, right: 4, width: 16, height: 16, borderRadius: 8, backgroundColor: "#22C55E", borderWidth: 3, borderColor: THEME.bg },
  identity: { marginTop: 22, alignItems: "center", paddingHorizontal: 24 },
  name: { fontSize: 24, fontWeight: "900", color: THEME.text, textAlign: "center" },
  username: { color: THEME.accent, marginTop: 4, fontWeight: "700", fontSize: 14 },
  bio: { marginTop: 10, textAlign: "center", color: THEME.purpleLight, lineHeight: 22, fontSize: 14 },
  tagsRow: { marginTop: 12 },
  genreTag: { backgroundColor: THEME.ui2, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, marginRight: 8, borderWidth: 1, borderColor: THEME.purple },
  genreTagTxt: { color: THEME.purpleLight, fontSize: 11, fontWeight: "700" },
  actionRow: { marginTop: 20, marginBottom: 4 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, borderColor: THEME.accent },
  editBtnTxt: { color: THEME.accent, fontWeight: "800", fontSize: 14 },
  otherActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  msgBtn: { backgroundColor: THEME.accent, width: 46, height: 46, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  statsRow: { flexDirection: "row", marginHorizontal: 20, marginTop: 24, backgroundColor: THEME.ui, borderRadius: 20, paddingVertical: 18, borderWidth: 1, borderColor: THEME.ui2 },
  statBox: { flex: 1, alignItems: "center" },
  statBorder: { borderRightWidth: 1, borderRightColor: THEME.ui2 },
  statValue: { color: THEME.text, fontWeight: "900", fontSize: 20 },
  statLabel: { color: THEME.textMuted, fontSize: 8, fontWeight: "900", letterSpacing: 1, marginTop: 4 },
  tabs: { flexDirection: "row", marginTop: 20, borderBottomWidth: 1, borderBottomColor: THEME.ui },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 6 },
  activeTab: { borderBottomWidth: 2.5, borderBottomColor: THEME.accent },
  tabText: { color: THEME.textMuted, fontWeight: "700", fontSize: 12 },
  activeTabText: { color: THEME.accent },
  tabBadge: { backgroundColor: THEME.ui2, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  tabBadgeTxt: { color: THEME.accent, fontSize: 9, fontWeight: "900" },
  feed: { paddingHorizontal: 20, paddingTop: 16 },
  emptyState: { alignItems: "center", paddingVertical: 50 },
  emptyTitle: { color: THEME.text, fontSize: 18, fontWeight: "800", marginTop: 12 },
  emptySub: { color: THEME.textMuted, fontSize: 13, marginTop: 6, textAlign: "center" },
  bookWrap: { width: 140, marginRight: 16 },
  bookCoverFrame: { width: 140, height: 200, borderRadius: 14, borderWidth: 2, borderColor: THEME.accent, overflow: "hidden" },
  bookCover: { width: "100%", height: "100%" },
  bookTitle: { color: THEME.text, fontWeight: "700", marginTop: 8, fontSize: 11, lineHeight: 16 },
  statGrid: { flexDirection: "row", justifyContent: "space-around", marginTop: 8, backgroundColor: THEME.ui, borderRadius: 8, padding: 6 },
  gridBox: { flexDirection: "row", alignItems: "center", gap: 4 },
  gridNum: { color: THEME.accent, fontSize: 11, fontWeight: "900" },
});