import React, { useEffect, useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  TextInput, Dimensions, StatusBar, ActivityIndicator, FlatList,
  Keyboard, Share, Animated,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth, db } from "../../lib/firebase";
import {
  collection, query, onSnapshot, doc, limit,
  orderBy, updateDoc, increment,
  arrayUnion, arrayRemove, where,
} from "firebase/firestore";

import CommentsModal from "@/components/CommentsModal";

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

const EmptyCard = ({ emoji, text }: { emoji: string; text: string }) => (
  <View style={styles.emptyCard}>
    <Text style={{ fontSize: 28 }}>{emoji}</Text>
    <Text style={styles.emptyCardTxt}>{text}</Text>
  </View>
);

function FeedCard({
  item,
  onLike,
}: {
  item: any;
  onLike: (id: string, likedBy: string[]) => void;
}) {
  const router = useRouter();
  const user = auth.currentUser;
  const isLiked = item.likedBy?.includes(user?.uid);
  const isArticle = item.type === "article";
  const isResearch = item.type === "research";

  const [showComments, setShowComments] = useState(false);

  const borderColor = isArticle
    ? "#38BDF850"
    : isResearch
    ? THEME.purpleLight + "50"
    : THEME.ui2;

  const navigateToItem = () => {
    if (item.type === "article") {
      router.push(`/article/${item.id}` as any);
    } else if (item.type === "research") {
      router.push(`/research/${item.originalId || item.id}` as any);
    } else {
      router.push(`/discussion/${item.id}` as any);
    }
  };

  return (
    <View style={[styles.feedCard, { borderColor }]}>
      <View style={[
        styles.feedBadge,
        isArticle && { backgroundColor: "#38BDF820" },
        isResearch && { backgroundColor: THEME.purpleLight + "20" },
      ]}>
        <Text style={[
          styles.feedBadgeTxt,
          isArticle && { color: "#38BDF8" },
          isResearch && { color: THEME.purpleLight },
        ]}>
          {isArticle ? "📰 ARTICLE" : isResearch ? "🔬 RESEARCH" : "💬 DISCUSSION"}
        </Text>
      </View>

      <TouchableOpacity onPress={navigateToItem} activeOpacity={0.85}>
        {(isArticle || isResearch) && item.title && (
          <Text style={styles.feedTitle} numberOfLines={2}>{item.title}</Text>
        )}
        <Text style={styles.feedContent} numberOfLines={3}>{item.content}</Text>
      </TouchableOpacity>

      <View style={styles.feedAuthorRow}>
        {item.userPhoto ? (
          <Image source={{ uri: item.userPhoto }} style={styles.feedAvatar} />
        ) : (
          <View style={[styles.feedAvatar, styles.feedAvatarFallback]}>
            <Text style={{ color: THEME.accent, fontWeight: "900", fontSize: 9 }}>
              {(item.userName || "W")[0].toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.feedAuthor} numberOfLines={1}>{item.userName || "Scholar"}</Text>
        <Text style={styles.feedTime}>
          {item.createdAt?.toDate
            ? item.createdAt.toDate().toLocaleDateString("en-NG", { month: "short", day: "numeric" })
            : ""}
        </Text>
      </View>

      <View style={styles.feedActions}>
        <TouchableOpacity
          style={styles.feedActionBtn}
          onPress={() => onLike(item.id, item.likedBy)}
        >
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={13}
            color={isLiked ? THEME.red : THEME.purpleLight}
          />
          <Text style={styles.feedActionTxt}>{item.likesCount || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.feedActionBtn}
          onPress={() => setShowComments(true)}
        >
          <Ionicons name="chatbubble-outline" size={12} color={THEME.purpleLight} />
          <Text style={styles.feedActionTxt}>{item.commentsCount || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.feedActionBtn}
          onPress={() => Share.share({ message: `${item.title || item.content} — Writha` })}
        >
          <Ionicons name="share-social-outline" size={12} color={THEME.accent} />
        </TouchableOpacity>
      </View>

      <CommentsModal
        visible={showComments}
        onClose={() => setShowComments(false)}
        postId={item.id}
        uid={user?.uid || ""}
        userPhoto={user?.photoURL || ""}
        postAuthorId={item.userId || item.authorId || ""}
        collection="feed"
      />
    </View>
  );
}

function FeedFilterTabs({
  discussions, articles, feedItems, onLike,
}: {
  discussions: any[];
  articles: any[];
  feedItems: any[];
  onLike: (id: string, likedBy: string[]) => void;
}) {
  const [activeFilter, setActiveFilter] = useState<
    "all" | "discussions" | "articles" | "research"
  >("all");

  const research = useMemo(
    () => feedItems.filter((f) => f.type === "research"),
    [feedItems]
  );

  const displayed = useMemo(() => {
    if (activeFilter === "discussions") return discussions;
    if (activeFilter === "articles") return articles;
    if (activeFilter === "research") return research;
    return feedItems;
  }, [activeFilter, discussions, articles, research, feedItems]);

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {[
          { key: "all",         label: "All" },
          { key: "discussions", label: "💬 Discussions" },
          { key: "articles",    label: "📰 Articles" },
          { key: "research",    label: "🔬 Research" },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterPill,
              activeFilter === f.key && styles.filterPillActive,
            ]}
            onPress={() => setActiveFilter(f.key as any)}
          >
            <Text style={[
              styles.filterPillTxt,
              activeFilter === f.key && styles.filterPillTxtActive,
            ]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {displayed.length === 0 ? (
        <EmptyCard emoji="💬" text="Nothing here yet." />
      ) : (
        <FlatList
          horizontal
          data={displayed}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
          renderItem={({ item }) => (
            <FeedCard item={item} onLike={onLike} />
          )}
        />
      )}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [displayName, setDisplayName] = useState("");
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [weaves, setWeaves] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);

  const [fabOpen, setFabOpen] = useState(false);
  const fabAnim = useState(new Animated.Value(0))[0];

  const discussions = useMemo(
    () => feedItems.filter((f) => f.type === "discussion" || !f.type),
    [feedItems]
  );
  const articles = useMemo(
    () => feedItems.filter((f) => f.type === "article"),
    [feedItems]
  );

  const groupedBooks = useMemo(() => {
    const map: Record<string, any[]> = {};
    books.forEach((b) => {
      const g = b.genre || "Other";
      if (!map[g]) map[g] = [];
      map[g].push(b);
    });
    return map;
  }, [books]);

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
      query(collection(db, "feed"), orderBy("createdAt", "desc"), limit(20)),
      (snap) => {
        setFeedItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => {
      unsubProfile();
      unsubBooks();
      unsubWeaves();
      unsubGroups();
      unsubFeed();
    };
  }, [user]);

  const toggleFab = () => {
    const toVal = fabOpen ? 0 : 1;
    setFabOpen(!fabOpen);
    Animated.spring(fabAnim, {
      toValue: toVal,
      useNativeDriver: true,
      friction: 6,
    }).start();
  };

  const fabRotate = fabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  const toggleLike = async (col: string, id: string, likedBy: string[] = []) => {
    if (!user) return;
    const isLiked = likedBy.includes(user.uid);
    try {
      await updateDoc(doc(db, col, id), {
        likesCount: increment(isLiked ? -1 : 1),
        likedBy: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });
    } catch (e) { console.error(e); }
  };

  const toggleFeedLike = (id: string, likedBy: string[] = []) => {
    toggleLike("feed", id, likedBy);
  };

  const handleSearch = () => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) { setSearchResults(null); return; }
    const results = [
      ...books
        .filter((b) =>
          b.title?.toLowerCase().includes(q) || b.genre?.toLowerCase().includes(q)
        )
        .map((b) => ({ ...b, _type: "book" })),
      ...weaves
        .filter((w) => w.title?.toLowerCase().includes(q))
        .map((w) => ({ ...w, _type: "weave" })),
      ...feedItems
        .filter((d) =>
          d.content?.toLowerCase().includes(q) || d.title?.toLowerCase().includes(q)
        )
        .map((d) => ({ ...d, _type: d.type || "discussion" })),
    ];
    setSearchResults(results);
    Keyboard.dismiss();
  };

  const BookCard = ({ item }: { item: any }) => {
    const isLiked = item.likedBy?.includes(user?.uid);
    const isPaid = item.price > 0;
    const [showComments, setShowComments] = useState(false);

    return (
      <View style={styles.bookCard}>
        <TouchableOpacity
          onPress={() =>
            isPaid
              ? router.push(`/checkout?id=${item.id}&type=book` as any)
              : router.push(`/book/${item.id}` as any)
          }
          activeOpacity={0.85}
        >
          <View style={styles.bookCoverFrame}>
            <Image
              source={{ uri: item.coverUrl || item.cover || "https://picsum.photos/200/300" }}
              style={styles.bookCover}
            />
            <View style={[styles.pricePill, isPaid && styles.pricePillPaid]}>
              <Text style={styles.priceText}>{isPaid ? `₦${item.price}` : "FREE"}</Text>
            </View>
            {isPaid && (
              <View style={styles.previewBadge}>
                <Ionicons name="eye-outline" size={10} color="#fff" />
                <Text style={styles.previewBadgeTxt}>PREVIEW</Text>
              </View>
            )}
          </View>
          <Text style={styles.bookTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.bookAuthor} numberOfLines={1}>
            {item.authorName || "Writha Author"}
          </Text>
        </TouchableOpacity>
        <View style={styles.bookActions}>
          <TouchableOpacity
            style={styles.bookActionBtn}
            onPress={() => toggleLike("books", item.id, item.likedBy)}
          >
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={15}
              color={isLiked ? THEME.red : THEME.purpleLight}
            />
            <Text style={styles.bookActionTxt}>{item.likesCount || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bookActionBtn}
            onPress={() => setShowComments(true)}
          >
            <Ionicons name="chatbubble-outline" size={14} color={THEME.purpleLight} />
            <Text style={styles.bookActionTxt}>{item.commentsCount || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bookActionBtn, styles.weaveActionBtn]}
            onPress={() =>
              router.push({
                pathname: "/weave/create",
                params: {
                  bookId: item.id,
                  bookTitle: item.title,
                  authorName: item.authorName || item.author || "",
                },
              } as any)
            }
          >
            <MaterialCommunityIcons name="feather" size={13} color="#000" />
            <Text style={styles.weaveActionTxt}>Weave</Text>
          </TouchableOpacity>
        </View>

        <CommentsModal
        visible={showComments}
        onClose={() => setShowComments(false)}
        postId={item.id}
        uid={user?.uid || ""}
        userPhoto={user?.photoURL || ""}
        postAuthorId={item.userId || item.authorId || ""}
        collection="books"
      />
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
        <View style={[
          styles.groupPrivacyTag,
          { backgroundColor: item.isPrivate ? THEME.ui2 : THEME.green + "30" },
        ]}>
          <Ionicons
            name={item.isPrivate ? "lock-closed" : "globe-outline"}
            size={9}
            color={item.isPrivate ? THEME.purpleLight : THEME.green}
          />
        </View>
      </View>
      <Text style={styles.groupName} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.groupMembers}>{item.members?.length || 0} members</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={THEME.accent} />
        <Text style={{ color: THEME.textMuted, marginTop: 12 }}>
          Loading your feed...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.logoText}>WRITHA</Text>
          <Text style={styles.tagline}>Read · Write · Discover</Text>
          <Text style={styles.welcome}>
            Hello,{" "}
            <Text style={{ color: THEME.accent }}>{displayName || "Scholar"}</Text> 👋
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/profile" as any)}
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
          <TouchableOpacity
            onPress={() => { setSearchQuery(""); setSearchResults(null); }}
          >
            <Ionicons name="close-circle" size={18} color={THEME.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
      >
        {searchResults ? (
          <View style={styles.section}>
            <SectionHeader
              title={`${searchResults.length} Results`}
              subtitle={`for "${searchQuery}"`}
            />
            <TouchableOpacity
              style={styles.clearSearchBtn}
              onPress={() => { setSearchResults(null); setSearchQuery(""); }}
            >
              <Ionicons name="arrow-back" size={14} color={THEME.accent} />
              <Text style={styles.clearSearchTxt}>Back to Feed</Text>
            </TouchableOpacity>
            {searchResults.length === 0 ? (
              <EmptyCard emoji="🔍" text="No results found." />
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
                      onPress={() => {
                        if (item._type === "article") {
                          router.push(`/article/${item.id}` as any);
                        } else if (item._type === "research") {
                          router.push(`/research/${item.originalId || item.id}` as any);
                        } else {
                          router.push(`/discussion/${item.id}` as any);
                        }
                      }}
                    >
                      <View style={styles.searchResultTypeBadge}>
                        <Text style={styles.searchResultTypeTxt}>
                          {(item._type || "post").toUpperCase()}
                        </Text>
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
            {books.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="Featured Today" icon="star-four-points" />
                <TouchableOpacity
                  style={styles.featuredBanner}
                  onPress={() => {
                    const f = books[0];
                    router.push(
                      f.price > 0
                        ? (`/book/${f.id}/checkout` as any)
                        : (`/book/${f.id}` as any)
                    );
                  }}
                  activeOpacity={0.9}
                >
                  <Image
                    source={{
                      uri: books[0].coverUrl || books[0].cover || "https://picsum.photos/400/200",
                    }}
                    style={styles.featuredImg}
                    resizeMode="cover"
                  />
                  <View style={styles.featuredOverlay}>
                    <View style={styles.featuredBadge}>
                      <Text style={styles.featuredBadgeTxt}>⭐ FEATURED</Text>
                    </View>
                    <Text style={styles.featuredTitle} numberOfLines={2}>
                      {books[0].title}
                    </Text>
                    <Text style={styles.featuredAuthor}>
                      {books[0].authorName || "Writha Author"}
                    </Text>
                    {books[0].price > 0 && (
                      <View style={styles.featuredPricePill}>
                        <Ionicons name="cart-outline" size={12} color="#000" />
                        <Text style={styles.featuredPriceTxt}>
                          ₦{books[0].price} — Tap to Preview
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.section}>
              <SectionHeader title="Trending Books" icon="fire" onSeeAll={() => {}} />
              {books.length === 0 ? (
                <EmptyCard emoji="📚" text="No books yet. Be the first to publish!" />
              ) : (
                <FlatList
                  horizontal
                  data={books}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
                  renderItem={({ item }) => <BookCard item={item} />}
                  keyExtractor={(item) => item.id}
                />
              )}
            </View>

            <View style={styles.section}>
              <SectionHeader title="Trending Weaves" icon="feather" onSeeAll={() => {}} />
              {weaves.length === 0 ? (
                <EmptyCard emoji="✍️" text="No weaves yet. Start collaborating!" />
              ) : (
                <FlatList
                  horizontal
                  data={weaves}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                  renderItem={({ item }) => <WeaveCard item={item} />}
                  keyExtractor={(item) => item.id}
                />
              )}
            </View>

            <View style={styles.section}>
              <SectionHeader
                title="Trending"
                icon="forum"
                onSeeAll={() => router.push("/createDiscussion" as any)}
              />
              {feedItems.length === 0 ? (
                <EmptyCard emoji="💬" text="No posts yet. Start the first discussion!" />
              ) : (
                <FeedFilterTabs
                  discussions={discussions}
                  articles={articles}
                  feedItems={feedItems}
                  onLike={toggleFeedLike}
                />
              )}
            </View>

            {Object.entries(groupedBooks).map(([genre, genreBooks]) => (
              <View key={genre} style={styles.section}>
                <SectionHeader title={genre} icon="bookshelf" onSeeAll={() => {}} />
                <FlatList
                  horizontal
                  data={genreBooks}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
                  renderItem={({ item }) => <BookCard item={item} />}
                  keyExtractor={(item) => item.id}
                />
              </View>
            ))}

            <View style={styles.section}>
              <SectionHeader
                title="Active Groups"
                icon="account-group"
                onSeeAll={() => router.push("/(tabs)/social" as any)}
              />
              {groups.length === 0 ? (
                <EmptyCard emoji="👥" text="No groups yet. Create one!" />
              ) : (
                <FlatList
                  horizontal
                  data={groups}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
                  renderItem={({ item }) => <GroupCard item={item} />}
                  keyExtractor={(item) => item.id}
                />
              )}
            </View>
          </>
        )}
      </ScrollView>

      {fabOpen && (
        <View style={styles.fabMenu}>
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

          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => { setFabOpen(false); router.push("/createResearch" as any); }}
          >
            <View style={styles.fabMenuLabel}>
              <Text style={styles.fabMenuLabelTxt}>Full Research</Text>
              <Text style={styles.fabMenuLabelSub}>Thesis & scholarly work</Text>
            </View>
            <View style={[styles.fabMenuIcon, { backgroundColor: THEME.purpleLight }]}>
              <Ionicons name="book-outline" size={20} color="#000" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => { setFabOpen(false); router.push("/createDiscussion" as any); }}
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

      <TouchableOpacity style={styles.fab} onPress={toggleFab} activeOpacity={0.85}>
        <Animated.View style={{ transform: [{ rotate: fabRotate }] }}>
          <MaterialCommunityIcons name="pencil-plus" size={28} color="#000" />
        </Animated.View>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  loader: { flex: 1, backgroundColor: THEME.bg, justifyContent: "center", alignItems: "center" },
  header: { paddingTop: 58, paddingHorizontal: 20, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logoText: { color: THEME.accent, fontWeight: "900", letterSpacing: 5, fontSize: 16 },
  tagline: { color: THEME.purpleLight, fontSize: 10, fontStyle: "italic", marginBottom: 4 },
  welcome: { color: THEME.text, fontSize: 22, fontWeight: "800" },
  avatar: { width: 48, height: 48, borderRadius: 15, borderWidth: 2, borderColor: THEME.accent },
  avatarFallback: { backgroundColor: THEME.purple, justifyContent: "center", alignItems: "center" },
  avatarInitial: { color: THEME.accent, fontSize: 20, fontWeight: "900" },
  onlineDot: { position: "absolute", bottom: -2, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: THEME.green, borderWidth: 2, borderColor: THEME.bg },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, marginHorizontal: 16, marginBottom: 8, borderRadius: 16, paddingHorizontal: 14, height: 48, borderWidth: 1, borderColor: THEME.ui2, gap: 10 },
  searchInput: { flex: 1, color: THEME.text, fontSize: 14 },
  section: { marginTop: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 14 },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIconCircle: { width: 30, height: 30, borderRadius: 9, backgroundColor: THEME.accentDim, justifyContent: "center", alignItems: "center" },
  sectionTitle: { color: THEME.text, fontSize: 16, fontWeight: "900" },
  sectionSubtitle: { color: THEME.textMuted, fontSize: 11, marginTop: 1 },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  seeAllTxt: { color: THEME.purpleLight, fontSize: 12, fontWeight: "700" },
  emptyCard: { marginHorizontal: 16, backgroundColor: THEME.ui, borderRadius: 18, padding: 24, alignItems: "center", borderWidth: 1, borderColor: THEME.ui2 },
  emptyCardTxt: { color: THEME.textMuted, fontSize: 13, marginTop: 8, textAlign: "center" },
  featuredBanner: { marginHorizontal: 16, height: 200, borderRadius: 22, overflow: "hidden", borderWidth: 1.5, borderColor: THEME.accent },
  featuredImg: { ...StyleSheet.absoluteFillObject },
  featuredOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,7,26,0.65)", padding: 20, justifyContent: "flex-end" },
  featuredBadge: { backgroundColor: THEME.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start", marginBottom: 8 },
  featuredBadgeTxt: { color: "#000", fontSize: 9, fontWeight: "900" },
  featuredTitle: { color: THEME.text, fontSize: 20, fontWeight: "900", lineHeight: 26 },
  featuredAuthor: { color: THEME.purpleLight, fontSize: 12, marginTop: 4 },
  featuredPricePill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: THEME.accent, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, alignSelf: "flex-start", marginTop: 10 },
  featuredPriceTxt: { color: "#000", fontSize: 11, fontWeight: "900" },
  bookCard: { width: 140 },
  bookCoverFrame: { borderRadius: 14, borderWidth: 2, borderColor: THEME.accent, overflow: "hidden", position: "relative" },
  bookCover: { width: 140, height: 196 },
  pricePill: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.75)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: THEME.accent },
  pricePillPaid: { borderColor: THEME.green },
  previewBadge: { position: "absolute", bottom: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  previewBadgeTxt: { color: "#fff", fontSize: 8, fontWeight: "900" },
  priceText: { color: THEME.accent, fontSize: 9, fontWeight: "900" },
  bookTitle: { color: THEME.text, fontSize: 12, fontWeight: "800", marginTop: 8 },
  bookAuthor: { color: THEME.textMuted, fontSize: 10, marginTop: 2 },
  bookActions: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
  bookActionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  bookActionTxt: { color: THEME.textMuted, fontSize: 10 },
  weaveActionBtn: { backgroundColor: THEME.accent, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  weaveActionTxt: { color: "#000", fontSize: 10, fontWeight: "900" },
  weaveCard: { width: 190, backgroundColor: THEME.ui, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: THEME.ui2 },
  weaveBadge: { backgroundColor: THEME.accentDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start", marginBottom: 10 },
  weaveBadgeTxt: { color: THEME.accent, fontSize: 8, fontWeight: "900" },
  weaveTitle: { color: THEME.text, fontSize: 14, fontWeight: "800", lineHeight: 20 },
  weaveBook: { color: THEME.textMuted, fontSize: 11, marginTop: 6 },
  weaveFooter: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 12 },
  weaveFooterTxt: { color: THEME.textMuted, fontSize: 11 },
  feedCard: { width: 200, backgroundColor: THEME.ui, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: THEME.ui2, justifyContent: "space-between" },
  feedBadge: { backgroundColor: THEME.accentDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start", marginBottom: 8 },
  feedBadgeTxt: { color: THEME.accent, fontSize: 8, fontWeight: "900" },
  feedTitle: { color: THEME.text, fontWeight: "900", fontSize: 12, marginBottom: 6, lineHeight: 17 },
  feedContent: { color: THEME.textMuted, fontSize: 12, lineHeight: 18, flex: 1 },
  feedAuthorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, marginBottom: 8 },
  feedAvatar: { width: 20, height: 20, borderRadius: 6 },
  feedAvatarFallback: { backgroundColor: THEME.purple, justifyContent: "center", alignItems: "center" },
  feedAuthor: { color: THEME.text, fontSize: 10, fontWeight: "700", flex: 1 },
  feedTime: { color: THEME.textMuted, fontSize: 9 },
  feedActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTopWidth: 1, borderTopColor: THEME.ui2 },
  feedActionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  feedActionTxt: { color: THEME.textMuted, fontSize: 10 },
  filterRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 12, paddingBottom: 2 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2 },
  filterPillActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  filterPillTxt: { color: THEME.textMuted, fontSize: 11, fontWeight: "700" },
  filterPillTxtActive: { color: "#000" },
  groupCard: { width: 110, alignItems: "center" },
  groupImgFrame: { position: "relative" },
  groupImg: { width: 80, height: 80, borderRadius: 22, borderWidth: 2, borderColor: THEME.purpleLight },
  groupImgFallback: { backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  groupPrivacyTag: { position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: 6, justifyContent: "center", alignItems: "center" },
  groupName: { color: THEME.text, fontSize: 11, fontWeight: "700", textAlign: "center", marginTop: 8 },
  groupMembers: { color: THEME.textMuted, fontSize: 9, marginTop: 2 },
  clearSearchBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 16, marginBottom: 14 },
  clearSearchTxt: { color: THEME.accent, fontWeight: "700", fontSize: 13 },
  searchResultCard: { width: 170, backgroundColor: THEME.ui, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: THEME.ui2 },
  searchResultTypeBadge: { backgroundColor: THEME.accentDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start", marginBottom: 8 },
  searchResultTypeTxt: { color: THEME.accent, fontSize: 8, fontWeight: "900" },
  searchResultText: { color: THEME.text, fontSize: 13, fontWeight: "700", lineHeight: 19 },
  fab: { position: "absolute", bottom: 32, right: 22, backgroundColor: THEME.accent, width: 60, height: 60, borderRadius: 20, justifyContent: "center", alignItems: "center", elevation: 8, shadowColor: THEME.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, zIndex: 100 },
  fabMenu: { position: "absolute", bottom: 104, right: 22, zIndex: 99, alignItems: "flex-end", gap: 12 },
  fabMenuItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  fabMenuLabel: { backgroundColor: THEME.ui, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: THEME.ui2 },
  fabMenuLabelTxt: { color: THEME.text, fontWeight: "800", fontSize: 13 },
  fabMenuLabelSub: { color: THEME.textMuted, fontSize: 10, marginTop: 1 },
  fabMenuIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" },
});