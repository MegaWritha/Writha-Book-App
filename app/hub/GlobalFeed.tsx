import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Dimensions,
  RefreshControl,
  Alert,
  Platform
} from "react-native";
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { db, auth } from "../../lib/firebase";
import {
  collection,
  query,
  onSnapshot,
  limit,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  orderBy
} from "firebase/firestore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const THEME = {
  bg: "#000000",
  ui: "#111111",
  accent: "#D4AF37", // Writha Gold
  purple: "#8E2DE2",
  text: "#FFFFFF",
  textMuted: "#666666",
  cardBg: "#0A0A0A",
  adBg: "#121000", // Darker gold tint for real ads
};

export default function GlobalFeed() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const uid = auth.currentUser?.uid;

  // 1. FETCH REAL-TIME DATA
  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    // We fetch a larger limit to allow the algorithm to sort effectively
    const q = query(collection(db, "feed"), orderBy("createdAt", "desc"), limit(100));

    const unsub = onSnapshot(q, (snap) => {
      const feedData = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      setItems(feedData);
      setLoading(false);
      setRefreshing(false);
    }, (error) => {
      console.error("Feed Error:", error);
      setLoading(false);
      setRefreshing(false);
    });

    return unsub;
  }, [uid]);

  const onRefresh = () => setRefreshing(true);

  // 2. THE WRITHA ALGORITHM (Ranking real data only)
  const rankedFeed = useMemo(() => {
    const now = Date.now();

    const scored = items.map(item => {
      const likes = item.likesCount || 0;
      const comments = item.commentsCount || 0;
      const shares = item.sharesCount || 0;

      // Calculate time decay
      const created = item.createdAt?.toMillis?.() || now;
      const hoursOld = (now - created) / (1000 * 60 * 60);

      // Writha Engagement Weight
      const engagementScore = (likes * 2) + (comments * 3) + (shares * 4);
      
      // Decay formula: Gravity increases as time passes
      const decay = Math.pow(hoursOld + 2, 1.5);
      const score = engagementScore / decay;

      return { ...item, _score: score };
    });

    // Sort by algorithmic score
    return scored.sort((a, b) => b._score - a._score);
  }, [items]);

  // 3. ICON LOGIC
  const renderPostIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case "book": return <FontAwesome5 name="book-open" size={12} color={THEME.accent} />;
      case "group": return <Ionicons name="people" size={14} color={THEME.accent} />;
      case "weave": return <MaterialCommunityIcons name="molecule" size={16} color={THEME.purple} />;
      case "discussion": return <Ionicons name="chatbubble-ellipses" size={14} color={THEME.accent} />;
      case "ad": return <Ionicons name="megaphone" size={14} color={THEME.accent} />;
      case "admin": return <MaterialCommunityIcons name="shield-check" size={14} color={THEME.purple} />;
      default: return <Feather name="feather" size={12} color={THEME.accent} />;
    }
  };

  const toggleLike = async (post: any) => {
    if (!uid) return;
    const ref = doc(db, "feed", post.id);
    const liked = post.likedBy?.includes(uid);

    try {
      await updateDoc(ref, {
        likedBy: liked ? arrayRemove(uid) : arrayUnion(uid),
        likesCount: liked ? Math.max((post.likesCount || 1) - 1, 0) : (post.likesCount || 0) + 1
      });
    } catch (e) {
      console.error("Like Error", e);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={THEME.accent} />
      </View>
    );
  }

  // EMPTY STATE
  if (rankedFeed.length === 0) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="inbox-outline" size={48} color={THEME.textMuted} />
        <Text style={styles.emptyText}>there's nothing here yet</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.accent} />
      }
    >
      {rankedFeed.map((item) => {
        const liked = item.likedBy?.includes(uid);
        const isAd = item.type === "ad";

        return (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.9}
            onPress={() => {
              if (isAd) return Alert.alert("Sponsored Content", "This is a sponsored post.");
              if (item.type === "group") router.push(`/group/${item.id}` as any);
              else if (item.type === "weave" || item.type === "discussion") { 
                router.push(`/weave/${item.id}` as any);
              }
              else if (item.type === "book") router.push(`/library/${item.id}` as any);
            }}
            style={[styles.goldFrame, isAd && { borderColor: THEME.accent, borderWidth: 1 }]}
          >
            <View style={[styles.cardInner, isAd && { backgroundColor: THEME.adBg }]}>

              <View style={styles.cardHeader}>
                <View style={styles.typeBadge}>
                  {renderPostIcon(item.type)}
                  <Text style={styles.typeLabel}>{item.type?.toUpperCase() || "INTELLECT"}</Text>
                </View>
                <TouchableOpacity onPress={() => Alert.alert("Options", "Save or Report?")}>
                  <Ionicons name="ellipsis-horizontal" size={18} color={THEME.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.authorSection}>
                <Image
                  source={{ uri: item.authorPhoto || `https://ui-avatars.com/api/?name=${item.authorName || 'W'}&background=D4AF37&color=000` }}
                  style={styles.authorAvatar}
                />
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.authorName}>{item.authorName}</Text>
                  <Text style={styles.authorTitle}>@{item.authorUsername}</Text>
                </View>
              </View>

              {item.title && <Text style={styles.titleText}>{item.title}</Text>}

              <Text style={styles.excerptText} numberOfLines={6}>
                {item.content || item.excerpt}
              </Text>

              {item.image && <Image source={{ uri: item.image }} style={styles.postImage} />}

              <View style={styles.interactionBar}>
                <TouchableOpacity style={styles.statBtn} onPress={() => toggleLike(item)}>
                  <Ionicons
                    name={liked ? "heart" : "heart-outline"}
                    size={20}
                    color={liked ? "#FF4B4B" : THEME.textMuted}
                  />
                  <Text style={[styles.statText, liked && { color: "#FF4B4B" }]}>{item.likesCount || 0}</Text>
                </TouchableOpacity>

                <View style={styles.statBtn}>
                  <Ionicons name="chatbubble-outline" size={18} color={THEME.textMuted} />
                  <Text style={styles.statText}>{item.commentsCount || 0}</Text>
                </View>

                <TouchableOpacity style={{ marginLeft: 'auto' }}>
                  <Ionicons name="share-social-outline" size={18} color={THEME.accent} />
                </TouchableOpacity>
              </View>

            </View>
          </TouchableOpacity>
        );
      })}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  scrollContent: {
    padding: 15,
    width: Platform.OS === "web" && SCREEN_WIDTH > 600 ? 600 : "100%",
    alignSelf: "center"
  },
  center: {
    flex: 1,
    backgroundColor: THEME.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 40
  },
  emptyText: {
    color: THEME.textMuted,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 15,
    letterSpacing: 0.5
  },
  goldFrame: {
    backgroundColor: THEME.accent,
    padding: 1,
    borderRadius: 20,
    marginBottom: 20
  },
  cardInner: {
    backgroundColor: THEME.cardBg,
    borderRadius: 19,
    padding: 16
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#000",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#222"
  },
  typeLabel: {
    color: THEME.text,
    fontSize: 9,
    fontWeight: "900",
    marginLeft: 6,
    letterSpacing: 1.5
  },
  authorSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#222"
  },
  authorName: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: "800"
  },
  authorTitle: {
    color: THEME.accent,
    fontSize: 10,
    fontWeight: "700"
  },
  titleText: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8
  },
  excerptText: {
    color: "#BBB",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 15
  },
  postImage: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    marginBottom: 15,
    backgroundColor: "#111"
  },
  interactionBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#111",
    paddingTop: 15,
    gap: 15
  },
  statBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  statText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: "700"
  }
});