import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable, RefreshControl,
  Image, Dimensions, TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { auth, db } from "@/lib/firebase";
import { 
  collection, query, where, onSnapshot, orderBy 
} from "firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

interface BookItem {
  id: string;
  bookId?: string;
  title?: string;
  cover?: string;
  progress?: number;
  isOffline?: boolean;
  type?: "book" | "weave" | "research";
  status?: "draft" | "submitted" | "under_review" | "published" | "rejected" | "library";
  likesCount?: number;
  views?: number;
  authorId?: string;
  lastRead?: any;
}

// Restored Tab Types
type TabType = "reading" | "drafts" | "published" | "submissions" | "stats";

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>("reading");
  const [readingList, setReadingList] = useState<BookItem[]>([]);
  const [myWorks, setMyWorks] = useState<BookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    // BROAD READING LIST TRACKING
    const unsubRead = onSnapshot(
      query(collection(db, "users", user.uid, "library"), orderBy("lastRead", "desc")),
      (snap) => {
        const books = snap.docs.map(d => ({ id: d.id, ...d.data() } as BookItem));
        setReadingList(books.filter(b => (b.progress && b.progress > 0) || b.isOffline === true));
        setLoading(false);
      }
    );

    // PUBLISHING & SUBMISSION TRACKING (Uses manuscripts collection)
    const unsubWorks = onSnapshot(
      query(collection(db, "manuscripts"), where("authorId", "==", user.uid)),
      (snap) => {
        setMyWorks(snap.docs.map(d => ({ id: d.id, ...d.data() } as BookItem)));
      }
    );

    return () => { unsubRead(); unsubWorks(); };
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "#6B7280";
      case "submitted": return "#D4AF37";
      case "under_review": return "#8E2DE2";
      case "rejected": return "#EF4444";
      case "published": return "#10B981";
      default: return "#6D28D9";
    }
  };

  const renderBook = (item: BookItem) => (
    <Pressable
      key={item.id}
      style={styles.bookCard}
      onPress={() => {
        if (item.status === "submitted" || item.status === "under_review") {
          Alert.alert("Manuscript Locked", "This work is currently being reviewed.");
        } else if (item.status === "draft") {
          // Fixed router path for TypeScript
          router.push({ pathname: "/write", params: { id: item.id } });
        } else {
          router.push({ pathname: "/book/[id]", params: { id: item.bookId || item.id } });
        }
      }}
    >
      <View style={styles.coverWrapper}>
        <Image
          source={{ uri: item.cover || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c" }}
          style={styles.coverImg}
        />

        {item.isOffline && (
          <View style={styles.offlineBadge}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#4CD964" />
          </View>
        )}

        {activeTab === "reading" && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${item.progress || 0}%` }]} />
          </View>
        )}

        {item.status && activeTab !== "reading" && (
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>
              {item.status === "submitted" ? "AWAITING APPROVAL" : item.status.replace("_", " ").toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.bookTitle} numberOfLines={1}>
        {item.title || "Untitled Manuscript"}
      </Text>

      <Text style={styles.bookMeta}>
        {activeTab === "reading" 
          ? `${item.progress || 0}% Completed` 
          : `${item.views || 0} Reads • ${item.likesCount || 0} Likes`}
      </Text>
    </Pressable>
  );

  // Broad Filtering Logic
  const drafts = myWorks.filter(w => w.status === "draft");
  const published = myWorks.filter(w => w.status === "published");
  const submissions = myWorks.filter(w => ["submitted", "under_review", "rejected"].includes(w.status as string));

  const currentData = 
    activeTab === "reading" ? readingList : 
    activeTab === "drafts" ? drafts :
    activeTab === "published" ? published : 
    activeTab === "submissions" ? submissions : [];

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#D4AF37" /></View>;

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#080212", "#05010A"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.libraryTitle}>WRITHA LIBRARY</Text>
        <Text style={styles.subTitle}>Creative Command & Submission Tracker</Text>
      </View>

      <View style={styles.tabBar}>
        {[
          { id: "reading", icon: "book-open-variant", label: "Reading" },
          { id: "drafts", icon: "file-document-edit-outline", label: "Drafts" },
          { id: "published", icon: "check-decagram", label: "Live" },
          { id: "submissions", icon: "file-clock-outline", label: "Queue" },
          { id: "stats", icon: "chart-box-outline", label: "Stats" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id as TabType)}
            style={[styles.tabItem, activeTab === tab.id && styles.activeTab]}
          >
            <MaterialCommunityIcons
              name={tab.icon as any}
              size={22}
              color={activeTab === tab.id ? "#000" : "#D4AF37"}
            />
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.activeTabLabel]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}
      >
        {activeTab === "stats" ? (
          <View style={styles.statsPanel}>
            <Text style={styles.panelTitle}>AUTHOR PERFORMANCE</Text>
            <View style={styles.mainStatCard}>
               <Text style={styles.mainStatVal}>{myWorks.reduce((acc, b) => acc + (b.views || 0), 0)}</Text>
               <Text style={styles.mainStatLabel}>TOTAL PORTFOLIO READS</Text>
            </View>

            <View style={styles.statsGrid}>
               <StatBox label="APPROVED" val={published.length} color="#10B981" />
               <StatBox label="DRAFTS" val={drafts.length} color="#6B7280" />
               <StatBox label="IN QUEUE" val={submissions.length} color="#D4AF37" />
               <StatBox label="LIKES" val={myWorks.reduce((acc, b) => acc + (b.likesCount || 0), 0)} color="#EF4444" />
            </View>
          </View>
        ) : (
          <View style={styles.bookGrid}>
            {currentData.length > 0 ? (
              currentData.map(renderBook)
            ) : (
              <View style={styles.emptyBox}>
                <Ionicons name="book-outline" size={50} color="#1A0B2E" />
                <Text style={styles.emptyText}>No items found in this category.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => router.push("/write")}>
        <LinearGradient colors={["#D4AF37", "#B8860B"]} style={styles.fabGradient}>
          <Ionicons name="add" size={32} color="#000" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const StatBox = ({ label, val, color }: any) => (
  <View style={styles.statTile}>
    <Text style={[styles.statTileVal, { color }]}>{val}</Text>
    <Text style={styles.statTileLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#05010A" },
  centered: { flex: 1, backgroundColor: "#05010A", justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 25, marginBottom: 20 },
  libraryTitle: { color: "#FFF", fontSize: 30, fontWeight: "900", letterSpacing: -1 },
  subTitle: { color: "#D4AF37", fontSize: 11, fontWeight: "700", marginTop: 4, opacity: 0.8 },
  tabBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 25 },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: "center", backgroundColor: "#12081F", marginHorizontal: 4, borderRadius: 18, borderWidth: 1, borderColor: "rgba(212,175,55,0.1)" },
  activeTab: { backgroundColor: "#D4AF37", borderColor: "#D4AF37" },
  tabLabel: { fontSize: 8, marginTop: 4, color: "#D4AF37", fontWeight: "800" },
  activeTabLabel: { color: "#000" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 150 },
  bookGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  bookCard: { width: (width - 60) / 2, marginBottom: 25 },
  coverWrapper: { width: "100%", height: 250, borderRadius: 24, overflow: "hidden", backgroundColor: "#12081F" },
  coverImg: { width: "100%", height: "100%" },
  offlineBadge: { position: "absolute", top: 12, right: 12, backgroundColor: "rgba(0,0,0,0.7)", padding: 6, borderRadius: 10 },
  progressTrack: { position: "absolute", bottom: 0, width: "100%", height: 5, backgroundColor: "rgba(255,255,255,0.1)" },
  progressFill: { height: "100%", backgroundColor: "#D4AF37" },
  statusBadge: { position: "absolute", bottom: 15, left: 10, right: 10, paddingVertical: 6, borderRadius: 12, alignItems: 'center' },
  statusText: { color: "#FFF", fontSize: 8, fontWeight: "900" },
  bookTitle: { color: "#FFF", fontWeight: "800", marginTop: 12, fontSize: 15 },
  bookMeta: { color: "#665B73", fontSize: 11, fontWeight: "600", marginTop: 2 },
  emptyBox: { width: "100%", marginTop: 100, alignItems: "center", opacity: 0.5 },
  emptyText: { color: "#665B73", fontWeight: "700", marginTop: 15 },
  statsPanel: { gap: 20 },
  panelTitle: { color: "#D4AF37", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  mainStatCard: { backgroundColor: "#12081F", padding: 35, borderRadius: 32, alignItems: 'center', borderWidth: 1, borderColor: "rgba(212,175,55,0.1)" },
  mainStatVal: { color: "#FFF", fontSize: 48, fontWeight: "900" },
  mainStatLabel: { color: "#D4AF37", fontSize: 10, fontWeight: "800", marginTop: 5 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  statTile: { width: (width - 55) / 2, backgroundColor: "#12081F", padding: 22, borderRadius: 28, alignItems: 'center' },
  statTileVal: { fontSize: 24, fontWeight: "900" },
  statTileLabel: { color: "#665B73", fontSize: 9, fontWeight: "800", marginTop: 4 },
  fab: { position: "absolute", bottom: 40, right: 25, width: 70, height: 70, borderRadius: 24, overflow: 'hidden', elevation: 10 },
  fabGradient: { flex: 1, justifyContent: "center", alignItems: "center" }
});