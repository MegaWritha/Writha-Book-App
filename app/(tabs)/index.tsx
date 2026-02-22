import React, { useEffect, useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  TextInput, Dimensions, StatusBar, ActivityIndicator, FlatList, Modal,
  KeyboardAvoidingView, Platform, Switch, Keyboard, Share, Animated,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth, db } from "../../lib/firebase";
import {
  collection, query, onSnapshot, doc, limit,
  orderBy, addDoc, serverTimestamp, updateDoc, increment,
  arrayUnion, arrayRemove, where,
} from "firebase/firestore";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#0F071A",
  ui: "#1E1135",
  ui2: "#2D1B4D",
  accent: "#FFD700",
  accentDim: "rgba(255,215,0,0.1)",
  purple: "#6D28D9",
  purpleLight: "#A78BFA",
  text: "#E2E8F0",
  textMuted: "#94A3B8",
  green: "#22C55E",
  red: "#EF4444",
};

// ── SECTION HEADER ────────────────────────────────────────────────────────
const SectionHeader = ({
  title, subtitle, icon, onSeeAll,
}: {
  title: string; subtitle?: string; icon?: string; onSeeAll?: () => void;
}) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionHeaderLeft}>
      {icon && (
        <View style={styles.sectionIconCircle}>
          <MaterialCommunityIcons name={icon as any} size={16} color={THEME.accent} />
        </View>
      )}
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
    </View>
    {onSeeAll && (
      <TouchableOpacity style={styles.seeAllBtn} onPress={onSeeAll}>
        <Text style={styles.seeAllTxt}>See All</Text>
        <Ionicons name="chevron-forward" size={12} color={THEME.purpleLight} />
      </TouchableOpacity>
    )}
  </View>
);

// ── EMPTY STATE ───────────────────────────────────────────────────────────
const EmptyCard = ({ emoji, text }: { emoji: string; text: string }) => (
  <View style={styles.emptyCard}>
    <Text style={{ fontSize: 28 }}>{emoji}</Text>
    <Text style={styles.emptyCardTxt}>{text}</Text>
  </View>
);

// ── MAIN SCREEN ───────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [displayName, setDisplayName] = useState("");
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [weaves, setWeaves] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);

  // FAB
  const [fabOpen, setFabOpen] = useState(false);
  const fabAnim = useState(new Animated.Value(0))[0];

  // Discussion modal
  const [showDiscModal, setShowDiscModal] = useState(false);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);
  const [publishToWeb, setPublishToWeb] = useState(false);

  const groupedBooks = useMemo(() => {
    const map: Record<string, any[]> = {};
    books.forEach((b) => {
      const g = b.genre || "Other";
      if (!map[g]) map[g] = [];
      map[g].push(b);
    });
    return map;
  }, [books]);

  // ── LISTENERS ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const unsubProfile = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setDisplayName(d.displayName || d.username || d.firstName || "Scholar");
        setUserPhoto(d.photoURL || d.profilePic || null);
      }
    });

    const unsubBooks = onSnapshot(
      query(collection(db, "books"), where("status", "==", "published"), limit(20)),
      (snap) => setBooks(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsubWeaves = onSnapshot(
      query(collection(db, "weaves"), orderBy("createdAt", "desc"), limit(10)),
      (snap) => setWeaves(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsubGroups = onSnapshot(
      query(collection(db, "groups"), limit(10)),
      (snap) => setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsubFeed = onSnapshot(
      query(collection(db, "feed"), orderBy("createdAt", "desc"), limit(15)),
      (snap) => {
        setDiscussions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => {
      unsubProfile(); unsubBooks(); unsubWeaves(); unsubGroups(); unsubFeed();
    };
  }, [user]);

  // ── FAB ANIMATION ─────────────────────────────────────────────────────
  const toggleFab = () => {
    const toVal = fabOpen ? 0 : 1;
    setFabOpen(!fabOpen);
    Animated.spring(fabAnim, { toValue: toVal, useNativeDriver: true, friction: 6 }).start();
  };

  const fabRotate = fabAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] });

  // ── ACTIONS ───────────────────────────────────────────────────────────
  const toggleLike = async (col: string, id: string, likedBy: string[] = []) => {
    if (!user) return;
    const isLiked = likedBy.includes(user.uid);
    const ref = doc(db, col, id);
    try {
      await updateDoc(ref, {
        likesCount: increment(isLiked ? -1 : 1),
        likedBy: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });
    } catch (e) { console.error(e); }
  };

  const publishDiscussion = async () => {
    if (!newPost.trim()) return;
    setPosting(true);
    try {
      await addDoc(collection(db, "feed"), {
        content: newPost,
        userId: user!.uid,
        userName: displayName || "Scholar",
        userPhoto: user?.photoURL || "",
        likesCount: 0,
        commentsCount: 0,
        likedBy: [],
        type: "discussion",
        publishToWeb,
        createdAt: serverTimestamp(),
      });
      setNewPost("");
      setPublishToWeb(false);
      setShowDiscModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setPosting(false);
    }
  };

  const handleSearch = () => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) { setSearchResults(null); return; }
    const results = [
      ...books.filter((b) => b.title?.toLowerCase().includes(q) || b.genre?.toLowerCase().includes(q)).map((b) => ({ ...b, _type: "book" })),
      ...weaves.filter((w) => w.title?.toLowerCase().includes(q)).map((w) => ({ ...w, _type: "weave" })),
      ...discussions.filter((d) => d.content?.toLowerCase().includes(q)).map((d) => ({ ...d, _type: "discussion" })),
    ];
    setSearchResults(results);
    Keyboard.dismiss();
  };

  // ── SUB COMPONENTS ─────────────────────────────────────────────────────

  const BookCard = ({ item }: { item: any }) => {
    const isLiked = item.likedBy?.includes(user?.uid);
    return (
      <View style={styles.bookCard}>
        <TouchableOpacity onPress={() => router.push(`/book/${item.id}` as any)} activeOpacity={0.85}>
          <View style={styles.bookCoverFrame}>
            <Image
              source={{ uri: item.coverUrl || item.cover || "https://picsum.photos/200/300" }}
              style={styles.bookCover}
            />
            <View style={styles.pricePill}>
              <Text style={styles.priceText}>{item.price > 0 ? `₦${item.price}` : "FREE"}</Text>
            </View>
          </View>
          <Text style={styles.bookTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.bookAuthor} numberOfLines={1}>{item.authorName || "Writha Author"}</Text>
        </TouchableOpacity>
        <View style={styles.bookActions}>
          <TouchableOpacity style={styles.bookActionBtn} onPress={() => toggleLike("books", item.id, item.likedBy)}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={15} color={isLiked ? THEME.red : THEME.purpleLight} />
            <Text style={styles.bookActionTxt}>{item.likesCount || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bookActionBtn} onPress={() => router.push(`/book/${item.id}` as any)}>
            <Ionicons name="chatbubble-outline" size={14} color={THEME.purpleLight} />
            <Text style={styles.bookActionTxt}>{item.commentsCount || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bookActionBtn, styles.weaveActionBtn]}
            onPress={() => router.push({ pathname: "/weave/create", params: { bookId: item.id, bookTitle: item.title } } as any)}
          >
            <MaterialCommunityIcons name="feather" size={13} color="#000" />
            <Text style={styles.weaveActionTxt}>Weave</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const WeaveCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.weaveCard}
      onPress={() => router.push(`/weave/${item.id}` as any)}
      activeOpacity={0.85}
    >
      <View style={styles.weaveBadge}>
        <Text style={styles.weaveBadgeTxt}>{(item.type || "WEAVE").toUpperCase()}</Text>
      </View>
      <Text style={styles.weaveTitle} numberOfLines={2}>{item.title}</Text>
      {item.bookTitle && (
        <Text style={styles.weaveBook} numberOfLines={1}>📖 {item.bookTitle}</Text>
      )}
      <View style={styles.weaveFooter}>
        <Ionicons name="people" size={12} color={THEME.accent} />
        <Text style={styles.weaveFooterTxt}>{item.collaborators || 1} weaving</Text>
      </View>
    </TouchableOpacity>
  );

  const DiscussionCard = ({ item }: { item: any }) => {
    const isLiked = item.likedBy?.includes(user?.uid);
    return (
      <View style={styles.discCard}>
        <TouchableOpacity onPress={() => router.push(`/discussion/${item.id}/comments` as any)}>
          <View style={styles.discHeader}>
            {item.userPhoto ? (
              <Image source={{ uri: item.userPhoto }} style={styles.discAvatar} />
            ) : (
              <View style={[styles.discAvatar, styles.discAvatarFallback]}>
                <Text style={{ color: THEME.accent, fontWeight: "900", fontSize: 12 }}>
                  {(item.userName || "W")[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.discUser} numberOfLines={1}>{item.userName || "Scholar"}</Text>
              <Text style={styles.discTime}>
                {item.createdAt?.toDate
                  ? item.createdAt.toDate().toLocaleDateString("en-NG", { month: "short", day: "numeric" })
                  : ""}
              </Text>
            </View>
          </View>
          <Text style={styles.discContent} numberOfLines={4}>{item.content}</Text>
        </TouchableOpacity>
        <View style={styles.discActions}>
          <TouchableOpacity style={styles.discActionBtn} onPress={() => toggleLike("feed", item.id, item.likedBy)}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={14} color={isLiked ? THEME.red : THEME.purpleLight} />
            <Text style={styles.discActionTxt}>{item.likesCount || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.discActionBtn}
            onPress={() => router.push(`/discussion/${item.id}/comments` as any)}
          >
            <Ionicons name="chatbubble-outline" size={13} color={THEME.purpleLight} />
            <Text style={styles.discActionTxt}>{item.commentsCount || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.discActionBtn}
            onPress={() => Share.share({ message: `"${item.content}" — Writha` })}
          >
            <Ionicons name="share-social-outline" size={13} color={THEME.accent} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const GroupCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => router.push(`/group/${item.id}` as any)}
      activeOpacity={0.85}
    >
      <View style={styles.groupImgFrame}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.groupImg} />
        ) : (
          <View style={[styles.groupImg, styles.groupImgFallback]}>
            <Ionicons name="people" size={26} color={THEME.accent} />
          </View>
        )}
        <View style={[styles.groupPrivacyTag, { backgroundColor: item.isPrivate ? THEME.ui2 : THEME.green + "30" }]}>
          <Ionicons name={item.isPrivate ? "lock-closed" : "globe-outline"} size={9} color={item.isPrivate ? THEME.purpleLight : THEME.green} />
        </View>
      </View>
      <Text style={styles.groupName} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.groupMembers}>{item.members?.length || 0} members</Text>
    </TouchableOpacity>
  );

  // ── LOADING ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={THEME.accent} />
        <Text style={{ color: THEME.textMuted, marginTop: 12 }}>Loading your feed...</Text>
      </View>
    );
  }

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logoText}>WRITHA</Text>
          <Text style={styles.tagline}>Read · Write · Discover</Text>
          <Text style={styles.welcome}>
            Hello, <Text style={{ color: THEME.accent }}>{displayName || "Scholar"}</Text> 👋
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push(`/profile/${user?.uid}` as any)}
          activeOpacity={0.85}
        >
          {userPhoto ? (
            <Image source={{ uri: userPhoto }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>
                {displayName ? displayName[0].toUpperCase() : "W"}
              </Text>
            </View>
          )}
          <View style={styles.onlineDot} />
        </TouchableOpacity>
      </View>

      {/* SEARCH BAR */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={THEME.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search books, weaves, discussions..."
          placeholderTextColor={THEME.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(""); setSearchResults(null); }}>
            <Ionicons name="close-circle" size={18} color={THEME.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>

        {/* SEARCH RESULTS */}
        {searchResults ? (
          <View style={styles.section}>
            <SectionHeader title={`${searchResults.length} Results`} subtitle={`for "${searchQuery}"`} />
            <TouchableOpacity style={styles.clearSearchBtn} onPress={() => { setSearchResults(null); setSearchQuery(""); }}>
              <Ionicons name="arrow-back" size={14} color={THEME.accent} />
              <Text style={styles.clearSearchTxt}>Back to Feed</Text>
            </TouchableOpacity>
            {searchResults.length === 0 ? (
              <EmptyCard emoji="🔍" text="No results found. Try different keywords." />
            ) : (
              <FlatList
                horizontal
                data={searchResults}
                keyExtractor={(item, i) => `search-${item.id}-${i}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                renderItem={({ item }) => {
                  if (item._type === "book") return <BookCard item={item} />;
                  return (
                    <TouchableOpacity
                      style={styles.searchResultCard}
                      onPress={() => router.push(`/${item._type === "weave" ? "weave" : "discussion"}/${item.id}${item._type === "discussion" ? "/comments" : ""}` as any)}
                    >
                      <View style={styles.searchResultTypeBadge}>
                        <Text style={styles.searchResultTypeTxt}>{item._type.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.searchResultText} numberOfLines={3}>
                        {item.title || item.content}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        ) : (
          <>
            {/* ── 1. FEATURED BANNER ── */}
            {books.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="Featured Today" icon="star-four-points" />
                <TouchableOpacity
                  style={styles.featuredBanner}
                  onPress={() => router.push(`/book/${books[0].id}` as any)}
                  activeOpacity={0.9}
                >
                  <Image
                    source={{ uri: books[0].coverUrl || books[0].cover || "https://picsum.photos/400/200" }}
                    style={styles.featuredImg}
                    resizeMode="cover"
                  />
                  <View style={styles.featuredOverlay}>
                    <View style={styles.featuredBadge}>
                      <Text style={styles.featuredBadgeTxt}>⭐ FEATURED</Text>
                    </View>
                    <Text style={styles.featuredTitle} numberOfLines={2}>{books[0].title}</Text>
                    <Text style={styles.featuredAuthor}>{books[0].authorName || "Writha Author"}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* ── 2. TRENDING BOOKS ── */}
            <View style={styles.section}>
              <SectionHeader title="Trending Books" icon="fire" onSeeAll={() => {}} />
              {books.length === 0 ? (
                <EmptyCard emoji="📚" text="No books yet. Be the first to publish!" />
              ) : (
                <FlatList
                  horizontal data={books} showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
                  renderItem={({ item }) => <BookCard item={item} />}
                  keyExtractor={(item) => item.id}
                />
              )}
            </View>

            {/* ── 3. TRENDING WEAVES ── */}
            <View style={styles.section}>
              <SectionHeader title="Trending Weaves" icon="feather" onSeeAll={() => {}} />
              {weaves.length === 0 ? (
                <EmptyCard emoji="✍️" text="No weaves yet. Start collaborating!" />
              ) : (
                <FlatList
                  horizontal data={weaves} showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                  renderItem={({ item }) => <WeaveCard item={item} />}
                  keyExtractor={(item) => item.id}
                />
              )}
            </View>

            {/* ── 4. TRENDING DISCUSSIONS ── */}
            <View style={styles.section}>
              <SectionHeader title="Trending Discussions" icon="forum" onSeeAll={() => {}} />
              {discussions.length === 0 ? (
                <EmptyCard emoji="💬" text="Start the first discussion!" />
              ) : (
                <View style={styles.discGrid}>
                  {discussions.slice(0, 6).map((item) => (
                    <DiscussionCard key={item.id} item={item} />
                  ))}
                </View>
              )}
            </View>

            {/* ── 5. GENRE SECTIONS ── */}
            {Object.entries(groupedBooks).map(([genre, genreBooks]) => (
              <View key={genre} style={styles.section}>
                <SectionHeader title={genre} icon="bookshelf" onSeeAll={() => {}} />
                <FlatList
                  horizontal data={genreBooks} showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
                  renderItem={({ item }) => <BookCard item={item} />}
                  keyExtractor={(item) => item.id}
                />
              </View>
            ))}

            {/* ── 6. ACTIVE GROUPS ── */}
            <View style={styles.section}>
              <SectionHeader title="Active Groups" icon="account-group" onSeeAll={() => router.push("/(tabs)/social" as any)} />
              {groups.length === 0 ? (
                <EmptyCard emoji="👥" text="No groups yet. Create one!" />
              ) : (
                <FlatList
                  horizontal data={groups} showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
                  renderItem={({ item }) => <GroupCard item={item} />}
                  keyExtractor={(item) => item.id}
                />
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* ── FAB MENU ── */}
      {fabOpen && (
        <View style={styles.fabMenu}>
          {/* ARTICLE */}
          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => { setFabOpen(false); router.push("/createArticle" as any); }}
          >
            <View style={styles.fabMenuLabel}>
              <Text style={styles.fabMenuLabelTxt}>Write Article</Text>
              <Text style={styles.fabMenuLabelSub}>Long-form publishing</Text>
            </View>
            <View style={[styles.fabMenuIcon, { backgroundColor: "#38BDF8" }]}>
              <Ionicons name="newspaper-outline" size={20} color="#000" />
            </View>
          </TouchableOpacity>

          {/* RESEARCH */}
          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => { setFabOpen(false); router.push("/create" as any); }}
          >
            <View style={styles.fabMenuLabel}>
              <Text style={styles.fabMenuLabelTxt}>Full Research</Text>
              <Text style={styles.fabMenuLabelSub}>Thesis & scholarly work</Text>
            </View>
            <View style={[styles.fabMenuIcon, { backgroundColor: THEME.purpleLight }]}>
              <Ionicons name="book-outline" size={20} color="#000" />
            </View>
          </TouchableOpacity>

          {/* DISCUSSION */}
          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => { setFabOpen(false); setShowDiscModal(true); }}
          >
            <View style={styles.fabMenuLabel}>
              <Text style={styles.fabMenuLabelTxt}>Discussion</Text>
              <Text style={styles.fabMenuLabelSub}>Share a thought or idea</Text>
            </View>
            <View style={[styles.fabMenuIcon, { backgroundColor: THEME.accent }]}>
              <Ionicons name="chatbubbles-outline" size={20} color="#000" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* FAB BUTTON */}
      <TouchableOpacity style={styles.fab} onPress={toggleFab} activeOpacity={0.85}>
        <Animated.View style={{ transform: [{ rotate: fabRotate }] }}>
          <MaterialCommunityIcons name="pencil-plus" size={28} color="#000" />
        </Animated.View>
      </TouchableOpacity>

      {/* ── DISCUSSION MODAL ── */}
      <Modal visible={showDiscModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>New Discussion</Text>
                <Text style={styles.modalSub}>Share a thought with the Writha community</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDiscModal(false)}>
                <Ionicons name="close-circle" size={28} color={THEME.textMuted} />
              </TouchableOpacity>
            </View>

            {/* USER INFO */}
            <View style={styles.modalUserRow}>
              {userPhoto ? (
                <Image source={{ uri: userPhoto }} style={styles.modalAvatar} />
              ) : (
                <View style={[styles.modalAvatar, styles.modalAvatarFallback]}>
                  <Text style={{ color: THEME.accent, fontWeight: "900" }}>
                    {displayName ? displayName[0].toUpperCase() : "W"}
                  </Text>
                </View>
              )}
              <Text style={styles.modalUsername}>{displayName || "Scholar"}</Text>
            </View>

            <TextInput
              style={styles.discInput}
              placeholder="What's on your mind? Start a scholarly debate..."
              placeholderTextColor={THEME.textMuted}
              multiline
              value={newPost}
              onChangeText={setNewPost}
              autoFocus
              maxLength={1000}
            />

            <Text style={styles.charCount}>{newPost.length}/1000</Text>

            <View style={styles.webToggleRow}>
              <View>
                <Text style={styles.webToggleTitle}>Publish to Web</Text>
                <Text style={styles.webToggleSub}>Visible on Writha's public website</Text>
              </View>
              <Switch
                value={publishToWeb}
                onValueChange={setPublishToWeb}
                trackColor={{ false: THEME.ui2, true: THEME.purple }}
                thumbColor={publishToWeb ? THEME.accent : THEME.textMuted}
              />
            </View>

            <TouchableOpacity
              style={[styles.postBtn, (!newPost.trim() || posting) && { opacity: 0.6 }]}
              onPress={publishDiscussion}
              disabled={!newPost.trim() || posting}
            >
              {posting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#000" />
                  <Text style={styles.postBtnTxt}>POST DISCUSSION</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  loader: { flex: 1, backgroundColor: THEME.bg, justifyContent: "center", alignItems: "center" },

  // Header
  header: { paddingTop: 58, paddingHorizontal: 20, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logoText: { color: THEME.accent, fontWeight: "900", letterSpacing: 5, fontSize: 16 },
  tagline: { color: THEME.purpleLight, fontSize: 10, fontStyle: "italic", marginBottom: 4 },
  welcome: { color: THEME.text, fontSize: 22, fontWeight: "800" },
  avatar: { width: 48, height: 48, borderRadius: 15, borderWidth: 2, borderColor: THEME.accent },
  avatarFallback: { backgroundColor: THEME.purple, justifyContent: "center", alignItems: "center" },
  avatarInitial: { color: THEME.accent, fontSize: 20, fontWeight: "900" },
  onlineDot: { position: "absolute", bottom: -2, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: THEME.green, borderWidth: 2, borderColor: THEME.bg },

  // Search
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, marginHorizontal: 16, marginBottom: 8, borderRadius: 16, paddingHorizontal: 14, height: 48, borderWidth: 1, borderColor: THEME.ui2, gap: 10 },
  searchInput: { flex: 1, color: THEME.text, fontSize: 14 },

  // Section
  section: { marginTop: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 14 },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIconCircle: { width: 30, height: 30, borderRadius: 9, backgroundColor: THEME.accentDim, justifyContent: "center", alignItems: "center" },
  sectionTitle: { color: THEME.text, fontSize: 16, fontWeight: "900" },
  sectionSubtitle: { color: THEME.textMuted, fontSize: 11, marginTop: 1 },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  seeAllTxt: { color: THEME.purpleLight, fontSize: 12, fontWeight: "700" },

  // Empty
  emptyCard: { marginHorizontal: 16, backgroundColor: THEME.ui, borderRadius: 18, padding: 24, alignItems: "center", borderWidth: 1, borderColor: THEME.ui2 },
  emptyCardTxt: { color: THEME.textMuted, fontSize: 13, marginTop: 8, textAlign: "center" },

  // Featured banner
  featuredBanner: { marginHorizontal: 16, height: 180, borderRadius: 22, overflow: "hidden", borderWidth: 1.5, borderColor: THEME.accent },
  featuredImg: { ...StyleSheet.absoluteFillObject },
  featuredOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,7,26,0.65)", padding: 20, justifyContent: "flex-end" },
  featuredBadge: { backgroundColor: THEME.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start", marginBottom: 8 },
  featuredBadgeTxt: { color: "#000", fontSize: 9, fontWeight: "900" },
  featuredTitle: { color: THEME.text, fontSize: 20, fontWeight: "900", lineHeight: 26 },
  featuredAuthor: { color: THEME.purpleLight, fontSize: 12, marginTop: 4 },

  // Book cards
  bookCard: { width: 140 },
  bookCoverFrame: { borderRadius: 14, borderWidth: 2, borderColor: THEME.accent, overflow: "hidden", position: "relative" },
  bookCover: { width: 140, height: 196 },
  pricePill: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.75)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: THEME.accent },
  priceText: { color: THEME.accent, fontSize: 9, fontWeight: "900" },
  bookTitle: { color: THEME.text, fontSize: 12, fontWeight: "800", marginTop: 8 },
  bookAuthor: { color: THEME.textMuted, fontSize: 10, marginTop: 2 },
  bookActions: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
  bookActionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  bookActionTxt: { color: THEME.textMuted, fontSize: 10 },
  weaveActionBtn: { backgroundColor: THEME.accent, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  weaveActionTxt: { color: "#000", fontSize: 10, fontWeight: "900" },

  // Weave cards
  weaveCard: { width: 190, backgroundColor: THEME.ui, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: THEME.ui2 },
  weaveBadge: { backgroundColor: THEME.accentDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start", marginBottom: 10 },
  weaveBadgeTxt: { color: THEME.accent, fontSize: 8, fontWeight: "900" },
  weaveTitle: { color: THEME.text, fontSize: 14, fontWeight: "800", lineHeight: 20 },
  weaveBook: { color: THEME.textMuted, fontSize: 11, marginTop: 6 },
  weaveFooter: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 12 },
  weaveFooterTxt: { color: THEME.textMuted, fontSize: 11 },

  // Discussion grid
  discGrid: { paddingHorizontal: 16, flexDirection: "row", flexWrap: "wrap", gap: 12 },
  discCard: { width: (width - 44) / 2, backgroundColor: THEME.ui, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: THEME.ui2 },
  discHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  discAvatar: { width: 26, height: 26, borderRadius: 8 },
  discAvatarFallback: { backgroundColor: THEME.purple, justifyContent: "center", alignItems: "center" },
  discUser: { color: THEME.text, fontSize: 11, fontWeight: "800" },
  discTime: { color: THEME.textMuted, fontSize: 9, marginTop: 1 },
  discContent: { color: THEME.textMuted, fontSize: 12, lineHeight: 18 },
  discActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: THEME.ui2 },
  discActionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  discActionTxt: { color: THEME.textMuted, fontSize: 10 },

  // Groups
  groupCard: { width: 110, alignItems: "center" },
  groupImgFrame: { position: "relative" },
  groupImg: { width: 80, height: 80, borderRadius: 22, borderWidth: 2, borderColor: THEME.purpleLight },
  groupImgFallback: { backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  groupPrivacyTag: { position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: 6, justifyContent: "center", alignItems: "center" },
  groupName: { color: THEME.text, fontSize: 11, fontWeight: "700", textAlign: "center", marginTop: 8 },
  groupMembers: { color: THEME.textMuted, fontSize: 9, marginTop: 2 },

  // Search results
  clearSearchBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 16, marginBottom: 14 },
  clearSearchTxt: { color: THEME.accent, fontWeight: "700", fontSize: 13 },
  searchResultCard: { width: 170, backgroundColor: THEME.ui, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: THEME.ui2, justifyContent: "center" },
  searchResultTypeBadge: { backgroundColor: THEME.accentDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start", marginBottom: 8 },
  searchResultTypeTxt: { color: THEME.accent, fontSize: 8, fontWeight: "900" },
  searchResultText: { color: THEME.text, fontSize: 13, fontWeight: "700", lineHeight: 19 },

  // FAB
  fab: { position: "absolute", bottom: 32, right: 22, backgroundColor: THEME.accent, width: 60, height: 60, borderRadius: 20, justifyContent: "center", alignItems: "center", elevation: 8, shadowColor: THEME.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, zIndex: 100 },
  fabMenu: { position: "absolute", bottom: 104, right: 22, zIndex: 99, alignItems: "flex-end", gap: 12 },
  fabMenuItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  fabMenuLabel: { backgroundColor: THEME.ui, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: THEME.ui2 },
  fabMenuLabelTxt: { color: THEME.text, fontWeight: "800", fontSize: 13 },
  fabMenuLabelSub: { color: THEME.textMuted, fontSize: 10, marginTop: 1 },
  fabMenuIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" },

  // Discussion modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: THEME.ui, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, minHeight: 480, borderWidth: 1, borderColor: THEME.ui2 },
  modalHandle: { width: 40, height: 4, backgroundColor: THEME.ui2, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  modalTitle: { color: THEME.accent, fontSize: 20, fontWeight: "900" },
  modalSub: { color: THEME.textMuted, fontSize: 12, marginTop: 3 },
  modalUserRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  modalAvatar: { width: 36, height: 36, borderRadius: 11 },
  modalAvatarFallback: { backgroundColor: THEME.purple, justifyContent: "center", alignItems: "center" },
  modalUsername: { color: THEME.text, fontWeight: "800", fontSize: 14 },
  discInput: { backgroundColor: THEME.bg, color: THEME.text, borderRadius: 16, padding: 16, minHeight: 140, textAlignVertical: "top", fontSize: 15, lineHeight: 22, borderWidth: 1, borderColor: THEME.ui2 },
  charCount: { color: THEME.textMuted, fontSize: 11, textAlign: "right", marginTop: 6, marginBottom: 16 },
  webToggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: THEME.bg, padding: 14, borderRadius: 14, marginBottom: 20, borderWidth: 1, borderColor: THEME.ui2 },
  webToggleTitle: { color: THEME.text, fontWeight: "800", fontSize: 14 },
  webToggleSub: { color: THEME.textMuted, fontSize: 10, marginTop: 2 },
  postBtn: { backgroundColor: THEME.accent, borderRadius: 18, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  postBtnTxt: { color: "#000", fontWeight: "900", fontSize: 14, letterSpacing: 1 },
});