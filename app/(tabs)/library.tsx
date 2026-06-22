import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Image, Dimensions, ActivityIndicator, Animated,
  RefreshControl, Alert, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { auth, db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot, orderBy, doc, getDoc,
  setDoc, serverTimestamp,
} from "firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#0A0612",
  ui: "#130D1F",
  ui2: "#1E1535",
  ui3: "#2A1D47",
  accent: "#FFD700",
  accentDim: "rgba(255,215,0,0.1)",
  purple: "#6D28D9",
  purpleLight: "#A78BFA",
  text: "#EDE8F5",
  textMuted: "#7A6E8A",
  green: "#22C55E",
  red: "#EF4444",
  blue: "#38BDF8",
};

type TabType = "reading" | "purchased" | "drafts" | "published" | "submissions" | "stats";

interface BookItem {
  id: string;
  bookId?: string;
  title?: string;
  cover?: string;
  coverUrl?: string;
  progress?: number;
  isOffline?: boolean;
  type?: string;
  status?: string;
  likesCount?: number;
  views?: number;
  authorId?: string;
  lastRead?: any;
  price?: number;
  purchasedAt?: any;
  genre?: string;
  description?: string;
  wordCount?: number;
}

const TABS: { id: TabType; icon: string; label: string }[] = [
  { id: "reading",     icon: "book-open-variant",          label: "Reading"    },
  { id: "purchased",   icon: "shopping",                   label: "Purchased"  },
  { id: "drafts",      icon: "file-document-edit-outline", label: "Drafts"     },
  { id: "published",   icon: "check-decagram",             label: "Live"       },
  { id: "submissions", icon: "file-clock-outline",         label: "Queue"      },
  { id: "stats",       icon: "chart-box-outline",          label: "Stats"      },
];

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft:        { color: THEME.textMuted, label: "DRAFT"         },
  submitted:    { color: THEME.accent,    label: "IN REVIEW"     },
  under_review: { color: THEME.purple,    label: "REVIEWING"     },
  rejected:     { color: THEME.red,       label: "NEEDS CHANGES" },
  published:    { color: THEME.green,     label: "LIVE"          },
};

const StatBox = ({ label, val, color, icon }: any) => (
  <View style={styles.statTile}>
    <View style={[styles.statTileIcon, { backgroundColor: color + "20" }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={[styles.statTileVal, { color }]}>{val}</Text>
    <Text style={styles.statTileLabel}>{label}</Text>
  </View>
);

const BookCard = ({
  item, tab, onPress,
}: {
  item: BookItem; tab: TabType; onPress: () => void;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const statusCfg = STATUS_CONFIG[item.status || ""] || null;

  const handlePressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, friction: 8 }).start();
  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View style={[styles.bookCard, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.coverWrap}>
          <Image
            source={{
              uri: item.coverUrl || item.cover ||
                "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400",
            }}
            style={styles.coverImg}
          />
          {tab === "reading" && (
            <>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${item.progress || 0}%` }]} />
              </View>
              <View style={styles.progressLabel}>
                <Text style={styles.progressLabelTxt}>{item.progress || 0}%</Text>
              </View>
            </>
          )}
          {item.isOffline && (
            <View style={styles.offlineBadge}>
              <Ionicons name="cloud-done" size={12} color={THEME.green} />
            </View>
          )}
          {statusCfg && tab !== "reading" && tab !== "purchased" && (
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + "DD" }]}>
              <Text style={styles.statusBadgeTxt}>{statusCfg.label}</Text>
            </View>
          )}
          {tab === "purchased" && item.price && (
            <View style={styles.purchasedBadge}>
              <Ionicons name="checkmark-circle" size={12} color={THEME.green} />
              <Text style={styles.purchasedBadgeTxt}>OWNED</Text>
            </View>
          )}
        </View>
        <Text style={styles.bookTitle} numberOfLines={1}>
          {item.title || "Untitled"}
        </Text>
        <Text style={styles.bookMeta} numberOfLines={1}>
          {tab === "reading"
            ? `${item.progress || 0}% read`
            : tab === "purchased"
            ? item.genre || "Book"
            : `${(item.views || 0).toLocaleString()} reads`}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

// ── MAIN SCREEN ───────────────────────────────────────────────────────────
export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>("reading");
  const [readingList, setReadingList] = useState<BookItem[]>([]);
  const [purchasedList, setPurchasedList] = useState<BookItem[]>([]);
  const [myWorks, setMyWorks] = useState<BookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    const unsubRead = onSnapshot(
      query(
        collection(db, "users", user.uid, "library"),
        orderBy("lastRead", "desc")
      ),
      async (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as BookItem));
        const enriched = await Promise.allSettled(
          items.map(async (item) => {
            try {
              const bookSnap = await getDoc(doc(db, "books", item.bookId || item.id));
              if (bookSnap.exists()) {
                return { ...item, ...bookSnap.data(), id: item.id, bookId: item.bookId || item.id };
              }
              return item;
            } catch { return item; }
          })
        );
        const all = enriched
          .filter((r) => r.status === "fulfilled")
          .map((r) => (r as any).value as BookItem);
        setReadingList(all.filter((b) => (b.progress || 0) > 0));
        setPurchasedList(all.filter((b) => b.price && b.price > 0));
        setLoading(false);
      },
      () => setLoading(false)
    );

    const unsubWorks = onSnapshot(
      query(collection(db, "books"), where("authorId", "==", user.uid)),
      (snap) => {
        setMyWorks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BookItem)));
      }
    );

    return () => { unsubRead(); unsubWorks(); };
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  };

  const handleBookPress = (item: BookItem) => {
    if (item.status === "submitted" || item.status === "under_review") return;
    if (item.status === "draft") {
      router.replace({ pathname: "/write/[id]", params: { id: item.id } } as any);
    } else {
      router.push({ pathname: "/book/[id]", params: { id: item.bookId || item.id } } as any);
    }
  };

  const handleStartFresh = async () => {
    if (!user) return;
    setCreatingDraft(true);
    try {
      const newId = `draft_${user.uid}_${Date.now()}`;
      await setDoc(doc(db, "books", newId), {
        title: "",
        authorId: user.uid,
        status: "draft",
        mode: "write",
        content: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowWriteModal(false);
      router.push({ pathname: "/write/[id]", params: { id: newId } } as any);
    } catch {
      Alert.alert("Error", "Could not create a new draft. Please try again.");
    } finally {
      setCreatingDraft(false);
    }
  };

  const drafts      = myWorks.filter((w) => w.status === "draft");
  const published   = myWorks.filter((w) => w.status === "published");
  const submissions = myWorks.filter((w) => ["submitted", "under_review", "rejected"].includes(w.status || ""));

  const getCurrentData = (): BookItem[] => {
    switch (activeTab) {
      case "reading":     return readingList;
      case "purchased":   return purchasedList;
      case "drafts":      return drafts;
      case "published":   return published;
      case "submissions": return submissions;
      default: return [];
    }
  };

  const totalReads = myWorks.reduce((a, b) => a + (b.views || 0), 0);
  const totalLikes = myWorks.reduce((a, b) => a + (b.likesCount || 0), 0);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={THEME.accent} size="large" />
        <Text style={{ color: THEME.textMuted, marginTop: 12 }}>Loading library...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0D0818", "#0A0612"]} style={StyleSheet.absoluteFill} />

      {/* HEADER */}
      <View style={[styles.headerBtns, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.publishBtn}
          onPress={() => router.push("/publish" as any)}
        >
          <Ionicons name="cloud-upload-outline" size={16} color={THEME.accent} />
          <Text style={styles.publishBtnTxt}>Publish</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.writeBtn}
          onPress={() => setShowWriteModal(true)}
        >
          <MaterialCommunityIcons name="pencil-plus" size={18} color="#000" />
          <Text style={styles.writeBtnTxt}>Write</Text>
        </TouchableOpacity>
      </View>

      {/* QUICK STATS ROW */}
      <View style={styles.quickStatsRow}>
        <View style={styles.quickStat}>
          <Text style={styles.quickStatVal}>{readingList.length}</Text>
          <Text style={styles.quickStatLbl}>Reading</Text>
        </View>
        <View style={styles.quickStatDivider} />
        <View style={styles.quickStat}>
          <Text style={styles.quickStatVal}>{purchasedList.length}</Text>
          <Text style={styles.quickStatLbl}>Purchased</Text>
        </View>
        <View style={styles.quickStatDivider} />
        <View style={styles.quickStat}>
          <Text style={styles.quickStatVal}>{published.length}</Text>
          <Text style={styles.quickStatLbl}>Published</Text>
        </View>
        <View style={styles.quickStatDivider} />
        <View style={styles.quickStat}>
          <Text style={[styles.quickStatVal, { color: THEME.accent }]}>
            {totalReads.toLocaleString()}
          </Text>
          <Text style={styles.quickStatLbl}>Total Reads</Text>
        </View>
      </View>

      {/* TAB BAR */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabScrollContent}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const badgeCount =
            tab.id === "reading"     ? readingList.length :
            tab.id === "purchased"   ? purchasedList.length :
            tab.id === "drafts"      ? drafts.length :
            tab.id === "published"   ? published.length :
            tab.id === "submissions" ? submissions.length : 0;

          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <MaterialCommunityIcons
                name={tab.icon as any}
                size={16}
                color={isActive ? "#000" : THEME.textMuted}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {badgeCount > 0 && (
                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeTxt, isActive && { color: THEME.accent }]}>
                    {badgeCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* MAIN CONTENT */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.accent} />
        }
      >
        {activeTab === "stats" ? (
          <View style={styles.statsSection}>
            <View style={styles.mainStatCard}>
              <LinearGradient colors={["#2D1B4D", "#1E1135"]} style={styles.mainStatGradient}>
                <Text style={styles.mainStatVal}>{totalReads.toLocaleString()}</Text>
                <Text style={styles.mainStatLabel}>TOTAL PORTFOLIO READS</Text>
                <View style={styles.mainStatDivider} />
                <View style={styles.mainStatRow}>
                  <View style={styles.mainStatItem}>
                    <Text style={styles.mainStatItemVal}>{totalLikes}</Text>
                    <Text style={styles.mainStatItemLbl}>LIKES</Text>
                  </View>
                  <View style={styles.mainStatItem}>
                    <Text style={styles.mainStatItemVal}>{myWorks.length}</Text>
                    <Text style={styles.mainStatItemLbl}>WORKS</Text>
                  </View>
                  <View style={styles.mainStatItem}>
                    <Text style={styles.mainStatItemVal}>{published.length}</Text>
                    <Text style={styles.mainStatItemLbl}>PUBLISHED</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            <Text style={styles.statsSectionTitle}>BREAKDOWN</Text>
            <View style={styles.statsGrid}>
              <StatBox label="PUBLISHED"  val={published.length}     color={THEME.green}     icon="checkmark-circle" />
              <StatBox label="DRAFTS"     val={drafts.length}        color={THEME.textMuted} icon="document-text"    />
              <StatBox label="IN QUEUE"   val={submissions.length}   color={THEME.accent}    icon="time"             />
              <StatBox label="PURCHASED"  val={purchasedList.length} color={THEME.blue}      icon="cart"             />
            </View>

            {published.length > 0 && (
              <>
                <Text style={styles.statsSectionTitle}>BOOK PERFORMANCE</Text>
                {published.map((book) => (
                  <View key={book.id} style={styles.perfCard}>
                    <Image
                      source={{ uri: book.coverUrl || book.cover || "https://picsum.photos/60/80" }}
                      style={styles.perfCover}
                    />
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={styles.perfTitle} numberOfLines={1}>{book.title}</Text>
                      <View style={styles.perfStats}>
                        <View style={styles.perfStat}>
                          <Ionicons name="eye-outline" size={12} color={THEME.textMuted} />
                          <Text style={styles.perfStatTxt}>{(book.views || 0).toLocaleString()}</Text>
                        </View>
                        <View style={styles.perfStat}>
                          <Ionicons name="heart-outline" size={12} color={THEME.textMuted} />
                          <Text style={styles.perfStatTxt}>{book.likesCount || 0}</Text>
                        </View>
                      </View>
                      <View style={styles.perfBar}>
                        <View style={[styles.perfBarFill, {
                          width: `${Math.min(100, ((book.views || 0) / Math.max(1, totalReads)) * 100)}%`,
                        }]} />
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        ) : (
          <>
            {getCurrentData().length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <MaterialCommunityIcons
                    name={TABS.find((t) => t.id === activeTab)?.icon as any}
                    size={36}
                    color={THEME.textMuted}
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {activeTab === "reading"     ? "No books in progress"   :
                   activeTab === "purchased"   ? "No purchased books yet" :
                   activeTab === "drafts"      ? "No drafts yet"          :
                   activeTab === "published"   ? "Nothing published yet"  :
                                                 "No pending submissions" }
                </Text>
                <Text style={styles.emptySub}>
                  {activeTab === "reading"
                    ? "Start reading a book and it'll appear here automatically"
                    : activeTab === "purchased"
                    ? "Purchase paid books and find them all here"
                    : "Head to the studio to start writing"}
                </Text>
                {(activeTab === "drafts" || activeTab === "published") && (
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={() => setShowWriteModal(true)}
                  >
                    <MaterialCommunityIcons name="pencil-plus" size={16} color="#000" />
                    <Text style={styles.emptyActionBtnTxt}>Open Studio</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                {activeTab === "reading" && readingList[0] && (
                  <TouchableOpacity
                    style={styles.continueBanner}
                    onPress={() => router.push(`/book/${readingList[0].bookId || readingList[0].id}` as any)}
                    activeOpacity={0.9}
                  >
                    <Image
                      source={{ uri: readingList[0].coverUrl || readingList[0].cover || "https://picsum.photos/400/200" }}
                      style={styles.continueBannerImg}
                    />
                    <LinearGradient
                      colors={["transparent", "rgba(10,6,18,0.95)"]}
                      style={styles.continueBannerGrad}
                    >
                      <Text style={styles.continueBannerSmall}>CONTINUE READING</Text>
                      <Text style={styles.continueBannerTitle} numberOfLines={1}>
                        {readingList[0].title}
                      </Text>
                      <View style={styles.continueBannerProgress}>
                        <View style={styles.continueBannerProgressTrack}>
                          <View style={[styles.continueBannerProgressFill, {
                            width: `${readingList[0].progress || 0}%`,
                          }]} />
                        </View>
                        <Text style={styles.continueBannerProgressTxt}>
                          {readingList[0].progress || 0}% complete
                        </Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {activeTab === "submissions" && (
                  <View style={styles.reviewInfoBox}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={THEME.accent} />
                    <Text style={styles.reviewInfoTxt}>
                      Works in queue are reviewed within 24–48 hours. You'll be notified on approval or if changes are needed.
                    </Text>
                  </View>
                )}

                {activeTab === "drafts" && (
                  <TouchableOpacity
                    style={styles.goToDraftsBtn}
                    onPress={() => router.push("/drafts" as any)}
                  >
                    <MaterialCommunityIcons name="file-document-edit-outline" size={15} color={THEME.accent} />
                    <Text style={styles.goToDraftsBtnTxt}>Open Drafts Studio</Text>
                    <Ionicons name="chevron-forward" size={14} color={THEME.accent} />
                  </TouchableOpacity>
                )}

                <View style={styles.bookGrid}>
                  {getCurrentData().map((item) => (
                    <BookCard
                      key={item.id}
                      item={item}
                      tab={activeTab}
                      onPress={() => handleBookPress(item)}
                    />
                  ))}
                </View>
              </>
            )}
          </>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* WRITE MODAL */}
      <Modal
        visible={showWriteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWriteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setShowWriteModal(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <MaterialCommunityIcons name="pencil" size={28} color={THEME.accent} />
            </View>
            <Text style={styles.modalTitle}>Ready to write?</Text>
            <Text style={styles.modalSub}>
              Pick up where you left off or start something new.
            </Text>

            <TouchableOpacity
              style={styles.modalOptionA}
              onPress={() => {
                setShowWriteModal(false);
                router.push("/drafts" as any);
              }}
            >
              <View style={styles.modalOptionIcon}>
                <MaterialCommunityIcons name="file-document-edit-outline" size={20} color={THEME.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalOptionTitle}>Continue a Draft</Text>
                <Text style={styles.modalOptionSub}>
                  {drafts.length > 0
                    ? `You have ${drafts.length} unfinished ${drafts.length === 1 ? "draft" : "drafts"}`
                    : "See all your saved drafts"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={THEME.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalOptionB, creatingDraft && { opacity: 0.6 }]}
              onPress={handleStartFresh}
              disabled={creatingDraft}
            >
              <View style={styles.modalOptionIconDark}>
                {creatingDraft ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <MaterialCommunityIcons name="pencil-plus" size={20} color="#000" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalOptionTitleDark}>Start Fresh</Text>
                <Text style={styles.modalOptionSubDark}>Begin a brand new book</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#00000066" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowWriteModal(false)}
            >
              <Text style={styles.modalCancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const CARD_WIDTH = (width - 52) / 2;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  centered: { flex: 1, backgroundColor: THEME.bg, justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: 20, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  headerSmall: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 4 },
  headerTitle: { color: THEME.text, fontSize: 28, fontWeight: "900", marginTop: 4 },
  writeBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: THEME.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  writeBtnTxt: { color: "#000", fontWeight: "900", fontSize: 13 },
  headerBtns: { flexDirection: "row", gap: 8, alignItems: "center", paddingHorizontal: 20, paddingBottom: 12 },
  publishBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: THEME.accentDim, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: THEME.accent + "40" },
  publishBtnTxt: { color: THEME.accent, fontWeight: "900", fontSize: 13 },
  quickStatsRow: { flexDirection: "row", marginHorizontal: 16, backgroundColor: THEME.ui, borderRadius: 18, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: THEME.ui2 },
  quickStat: { flex: 1, alignItems: "center" },
  quickStatVal: { color: THEME.text, fontSize: 18, fontWeight: "900" },
  quickStatLbl: { color: THEME.textMuted, fontSize: 9, fontWeight: "700", marginTop: 3, letterSpacing: 0.5 },
  quickStatDivider: { width: 1, backgroundColor: THEME.ui2 },
  tabScroll: { maxHeight: 60 },
  tabScrollContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  tabItem: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2 },
  tabItemActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  tabLabel: { color: THEME.textMuted, fontSize: 11, fontWeight: "800" },
  tabLabelActive: { color: "#000" },
  tabBadge: { backgroundColor: THEME.ui2, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  tabBadgeActive: { backgroundColor: "rgba(0,0,0,0.2)" },
  tabBadgeTxt: { color: THEME.textMuted, fontSize: 9, fontWeight: "900" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  continueBanner: { height: 160, borderRadius: 20, overflow: "hidden", marginBottom: 20, borderWidth: 1, borderColor: THEME.ui2 },
  continueBannerImg: { ...StyleSheet.absoluteFillObject },
  continueBannerGrad: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", padding: 16 },
  continueBannerSmall: { color: THEME.accent, fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  continueBannerTitle: { color: THEME.text, fontSize: 18, fontWeight: "900", marginTop: 4 },
  continueBannerProgress: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  continueBannerProgressTrack: { flex: 1, height: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2 },
  continueBannerProgressFill: { height: "100%", backgroundColor: THEME.accent, borderRadius: 2 },
  continueBannerProgressTxt: { color: THEME.accent, fontSize: 10, fontWeight: "800" },
  reviewInfoBox: { flexDirection: "row", gap: 10, backgroundColor: THEME.accentDim, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: THEME.accent + "30", alignItems: "flex-start" },
  reviewInfoTxt: { color: THEME.textMuted, fontSize: 12, flex: 1, lineHeight: 18 },
  goToDraftsBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: THEME.accentDim, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: THEME.accent + "30" },
  goToDraftsBtnTxt: { flex: 1, color: THEME.accent, fontWeight: "800", fontSize: 13 },
  bookGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  bookCard: { width: CARD_WIDTH },
  coverWrap: { width: "100%", height: CARD_WIDTH * 1.45, borderRadius: 18, overflow: "hidden", backgroundColor: THEME.ui },
  coverImg: { width: "100%", height: "100%" },
  progressTrack: { position: "absolute", bottom: 0, width: "100%", height: 4, backgroundColor: "rgba(0,0,0,0.4)" },
  progressFill: { height: "100%", backgroundColor: THEME.accent },
  progressLabel: { position: "absolute", bottom: 10, right: 10, backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  progressLabelTxt: { color: THEME.accent, fontSize: 9, fontWeight: "900" },
  offlineBadge: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.7)", padding: 5, borderRadius: 8 },
  statusBadge: { position: "absolute", bottom: 10, left: 8, right: 8, paddingVertical: 5, borderRadius: 10, alignItems: "center" },
  statusBadgeTxt: { color: "#FFF", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  purchasedBadge: { position: "absolute", top: 10, left: 10, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  purchasedBadgeTxt: { color: THEME.green, fontSize: 8, fontWeight: "900" },
  bookTitle: { color: THEME.text, fontWeight: "800", fontSize: 13, marginTop: 10 },
  bookMeta: { color: THEME.textMuted, fontSize: 11, marginTop: 3 },
  emptyState: { paddingVertical: 60, alignItems: "center" },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 24, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: THEME.ui2 },
  emptyTitle: { color: THEME.text, fontSize: 18, fontWeight: "800" },
  emptySub: { color: THEME.textMuted, fontSize: 13, marginTop: 8, textAlign: "center", lineHeight: 20, paddingHorizontal: 24 },
  emptyActionBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: THEME.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 20 },
  emptyActionBtnTxt: { color: "#000", fontWeight: "900", fontSize: 13 },
  statsSection: { gap: 16 },
  mainStatCard: { borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: THEME.ui2 },
  mainStatGradient: { padding: 28, alignItems: "center" },
  mainStatVal: { color: THEME.text, fontSize: 52, fontWeight: "900" },
  mainStatLabel: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginTop: 4 },
  mainStatDivider: { height: 1, backgroundColor: THEME.ui2, width: "100%", marginVertical: 20 },
  mainStatRow: { flexDirection: "row", width: "100%" },
  mainStatItem: { flex: 1, alignItems: "center" },
  mainStatItemVal: { color: THEME.text, fontSize: 22, fontWeight: "900" },
  mainStatItemLbl: { color: THEME.textMuted, fontSize: 9, fontWeight: "800", marginTop: 4, letterSpacing: 1 },
  statsSectionTitle: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statTile: { width: (width - 44) / 2, backgroundColor: THEME.ui, borderRadius: 20, padding: 20, alignItems: "center", borderWidth: 1, borderColor: THEME.ui2 },
  statTileIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  statTileVal: { fontSize: 28, fontWeight: "900" },
  statTileLabel: { color: THEME.textMuted, fontSize: 9, fontWeight: "800", marginTop: 4, letterSpacing: 1 },
  perfCard: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: THEME.ui2 },
  perfCover: { width: 44, height: 60, borderRadius: 8 },
  perfTitle: { color: THEME.text, fontWeight: "800", fontSize: 13 },
  perfStats: { flexDirection: "row", gap: 12, marginTop: 6 },
  perfStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  perfStatTxt: { color: THEME.textMuted, fontSize: 11 },
  perfBar: { height: 3, backgroundColor: THEME.ui2, borderRadius: 2, marginTop: 8, overflow: "hidden" },
  perfBarFill: { height: "100%", backgroundColor: THEME.accent, borderRadius: 2 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: THEME.ui, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderWidth: 1, borderColor: THEME.ui2, gap: 12 },
  modalIconWrap: { width: 56, height: 56, borderRadius: 18, backgroundColor: THEME.accentDim, justifyContent: "center", alignItems: "center", alignSelf: "center", marginBottom: 4 },
  modalTitle: { color: THEME.text, fontSize: 20, fontWeight: "900", textAlign: "center" },
  modalSub: { color: THEME.textMuted, fontSize: 13, textAlign: "center", lineHeight: 20 },
  modalOptionA: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: THEME.ui2, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: THEME.ui3, marginTop: 4 },
  modalOptionB: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: THEME.accent, borderRadius: 18, padding: 16 },
  modalOptionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" },
  modalOptionIconDark: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.15)", justifyContent: "center", alignItems: "center" },
  modalOptionTitle: { color: THEME.text, fontWeight: "800", fontSize: 14 },
  modalOptionSub: { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  modalOptionTitleDark: { color: "#000", fontWeight: "800", fontSize: 14 },
  modalOptionSubDark: { color: "#00000099", fontSize: 11, marginTop: 2 },
  modalCancel: { alignItems: "center", paddingVertical: 12 },
  modalCancelTxt: { color: THEME.textMuted, fontWeight: "700", fontSize: 13 },
});