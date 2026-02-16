import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Dimensions,
  RefreshControl
} from "react-native";
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from "@expo/vector-icons";
import { db } from "../../lib/firebase"; 
import { collection, query, onSnapshot, orderBy, limit } from "firebase/firestore";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#000000",
  ui: "#111111",
  accent: "#D4AF37", // Writha Gold
  purple: "#8E2DE2",
  text: "#FFFFFF",
  textMuted: "#666666",
  cardBg: "#0A0A0A"
};

export default function GlobalFeed() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- REAL-TIME FEED LISTENER ---
  useEffect(() => {
    // We order by timestamp descending to show newest activity first
    const q = query(
      collection(db, "discover"),
      orderBy("sharedAt", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      const feedData = snap.docs.map(d => ({ 
        id: d.id, 
        ...d.data() 
      }));
      setItems(feedData);
      setLoading(false);
      setRefreshing(false);
    }, (error) => {
      console.error("Advanced Feed Error:", error);
      setLoading(false);
      setRefreshing(false);
    });

    return unsub;
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    // onSnapshot will automatically update, but we trigger refreshing state for UI
  };

  // --- HELPER: RENDER POST ICON BASED ON TYPE ---
  const renderPostIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'book':
        return <FontAwesome5 name="book-reader" size={14} color={THEME.accent} />;
      case 'weave':
        return <MaterialCommunityIcons name="molecule" size={18} color={THEME.purple} />;
      case 're-weave':
        return <Ionicons name="repeat" size={16} color={THEME.accent} />;
      default:
        return <Feather name="feather" size={14} color={THEME.accent} />;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.purple} />
        <Text style={styles.loadingText}>Synchronizing with Writha...</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="planet-outline" size={60} color={THEME.accent} />
        </View>
        <Text style={styles.emptyTitle}>THE FEED IS QUIET</Text>
        <Text style={styles.emptySub}>
          The grand feed awaits its first entry. Once an author publishes or a weave is born, it shall manifest here.
        </Text>
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
      {items.map((item) => (
        <View key={item.id} style={styles.goldFrame}>
          <View style={styles.cardInner}>
            
            {/* TOP HEADER: Type and Time */}
            <View style={styles.cardHeader}>
              <View style={styles.typeBadge}>
                {renderPostIcon(item.type)}
                <Text style={styles.typeLabel}>{item.type?.toUpperCase() || 'ACTIVITY'}</Text>
              </View>
              <Text style={styles.timestamp}>
                {item.sharedAt?.toDate ? "JUST NOW" : "RECENT"}
              </Text>
            </View>

            {/* AUTHOR SECTION */}
            <View style={styles.authorSection}>
              <View style={styles.avatarGlow}>
                <Image 
                  source={{ uri: item.authorPhoto || `https://ui-avatars.com/api/?name=${item.authorName || 'W'}&background=8E2DE2&color=fff` }} 
                  style={styles.authorAvatar} 
                />
              </View>
              <View style={styles.authorInfo}>
                <Text style={styles.authorName}>{item.authorName || "Anonymous Scholar"}</Text>
                <Text style={styles.authorTitle}>Writha Contributor</Text>
              </View>
            </View>

            {/* CONTENT SECTION */}
            <View style={styles.contentBody}>
              <Text style={styles.titleText}>{item.title}</Text>
              <Text style={styles.excerptText} numberOfLines={5}>
                {item.excerpt || item.content || "No excerpt provided for this activity."}
              </Text>
            </View>

            {/* OPTIONAL: IMAGE ATTACHMENT */}
            {item.image && (
              <Image source={{ uri: item.image }} style={styles.postImage} resizeMode="cover" />
            )}

            {/* INTERACTION BAR */}
            <View style={styles.interactionBar}>
              <TouchableOpacity style={styles.statBtn}>
                <Ionicons name="heart-outline" size={20} color={THEME.textMuted} />
                <Text style={styles.statText}>{item.likes || 0}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.statBtn}>
                <Ionicons name="chatbubble-outline" size={18} color={THEME.textMuted} />
                <Text style={styles.statText}>{item.comments || 0}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.statBtn}>
                <Ionicons name="share-social-outline" size={18} color={THEME.accent} />
              </TouchableOpacity>
            </View>

          </View>
        </View>
      ))}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: THEME.bg 
  },
  scrollContent: { 
    padding: 20 
  },
  loadingContainer: { 
    flex: 1, 
    backgroundColor: THEME.bg, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: { 
    color: THEME.accent, 
    marginTop: 15, 
    fontSize: 12, 
    letterSpacing: 2, 
    fontWeight: '700' 
  },
  
  // THE GOLD FRAME
  goldFrame: {
    backgroundColor: THEME.accent,
    padding: 1, // This creates the 1px border effect
    borderRadius: 22,
    marginBottom: 25,
    shadowColor: THEME.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  cardInner: {
    backgroundColor: THEME.cardBg,
    borderRadius: 21,
    padding: 20,
  },

  // CARD COMPONENTS
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.ui,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222'
  },
  typeLabel: {
    color: THEME.text,
    fontSize: 10,
    fontWeight: '900',
    marginLeft: 8,
    letterSpacing: 1.5
  },
  timestamp: {
    color: THEME.textMuted,
    fontSize: 10,
    fontWeight: '700'
  },

  authorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18
  },
  avatarGlow: {
    padding: 2,
    borderRadius: 14,
    backgroundColor: THEME.purple + '40',
  },
  authorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#333'
  },
  authorInfo: {
    marginLeft: 15
  },
  authorName: {
    color: THEME.text,
    fontSize: 15,
    fontWeight: '800'
  },
  authorTitle: {
    color: THEME.purple,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1
  },

  contentBody: {
    marginBottom: 15
  },
  titleText: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
    lineHeight: 24
  },
  excerptText: {
    color: '#BBB',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400'
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 15,
    marginBottom: 15,
    backgroundColor: '#222'
  },

  interactionBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingTop: 15,
    gap: 20
  },
  statBtn: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statText: {
    color: THEME.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6
  },

  // EMPTY STATE
  empty: { 
    flex: 1,
    justifyContent: 'center',
    alignItems: "center", 
    paddingHorizontal: 40,
    marginTop: 80
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: THEME.accent,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.accent + '10',
    marginBottom: 30
  },
  emptyTitle: { 
    fontSize: 18, 
    fontWeight: "900", 
    color: THEME.text, 
    letterSpacing: 4,
    textAlign: 'center'
  },
  emptySub: { 
    color: THEME.textMuted, 
    marginTop: 15, 
    textAlign: "center",
    lineHeight: 24,
    fontSize: 13
  },
});