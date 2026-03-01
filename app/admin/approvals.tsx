import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, StatusBar, ScrollView,
  Pressable, Platform, TextInput,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot,
  updateDoc, doc, serverTimestamp, addDoc, getDoc,
} from "firebase/firestore";

const THEME = {
  bg:        "#0F071A",
  ui:        "#1E1135",
  ui2:       "#2D1B4D",
  ui3:       "#3D2660",
  accent:    "#FFD700",
  text:      "#E2E8F0",
  textMuted: "#94A3B8",
  green:     "#22C55E",
  red:       "#EF4444",
  blue:      "#38BDF8",
  purple:    "#A78BFA",
  cyan:      "#00D1FF",
  orange:    "#F97316",
};

// ── CROSS PLATFORM ALERT ──────────────────────────────────────────────────
const showAlert = (
  title: string,
  message: string,
  buttons: { text: string; style?: string; onPress?: () => void }[]
) => {
  if (Platform.OS === "web") {
    const confirmBtn = buttons.find((b) => b.style !== "cancel");
    const cancelBtn  = buttons.find((b) => b.style === "cancel");
    if (buttons.length === 1) {
      window.alert(`${title}\n\n${message}`);
      buttons[0].onPress?.();
    } else {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) confirmBtn?.onPress?.();
      else cancelBtn?.onPress?.();
    }
  } else {
    const { Alert } = require("react-native");
    Alert.alert(title, message, buttons);
  }
};

type ContentType  = "books" | "articles" | "research";
type StatusFilter = "pending" | "published" | "rejected";

const CONTENT_TABS: { key: ContentType; label: string; icon: string; color: string }[] = [
  { key: "books",    label: "Books",    icon: "book-outline",      color: THEME.accent  },
  { key: "articles", label: "Articles", icon: "newspaper-outline", color: THEME.blue    },
  { key: "research", label: "Research", icon: "flask-outline",     color: THEME.cyan    },
];

const STATUS_TABS: { key: StatusFilter; label: string; color: string }[] = [
  { key: "pending",   label: "Pending",   color: THEME.orange },
  { key: "published", label: "Published", color: THEME.green  },
  { key: "rejected",  label: "Rejected",  color: THEME.red    },
];

const formatTime = (ts: any): string => {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  });
};

export default function ApprovalsScreen() {
  const router = useRouter();

  const [contentType,   setContentType]   = useState<ContentType>("books");
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>("pending");
  const [items,         setItems]         = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [counts,        setCounts]        = useState<Record<ContentType, number>>({
    books: 0, articles: 0, research: 0,
  });
  const [rejectNote,    setRejectNote]    = useState("");
  const [rejectingId,   setRejectingId]   = useState<string | null>(null);

  // ── PENDING COUNTS ────────────────────────────────────────────────
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    // Books pending in books collection
    unsubs.push(onSnapshot(
      query(collection(db, "books"), where("status", "==", "pending")),
      (snap) => setCounts((c) => ({ ...c, books: snap.size }))
    ));

    // Articles pending in adminQueue
    unsubs.push(onSnapshot(
      query(
        collection(db, "adminQueue"),
        where("type", "==", "article"),
        where("status", "==", "pending")
      ),
      (snap) => setCounts((c) => ({ ...c, articles: snap.size }))
    ));

    // Research pending in adminQueue
    unsubs.push(onSnapshot(
      query(
        collection(db, "adminQueue"),
        where("type", "==", "research"),
        where("status", "==", "pending")
      ),
      (snap) => setCounts((c) => ({ ...c, research: snap.size }))
    ));

    return () => unsubs.forEach((u) => u());
  }, []);

  // ── LOAD ITEMS ────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setItems([]);

    let q;

    if (contentType === "books") {
      // Books live in the books collection
      const statusVal = statusFilter === "pending" ? "pending" : statusFilter;
      q = query(
        collection(db, "books"),
        where("status", "==", statusVal)
      );
    } else {
      // Articles and research live in adminQueue
      q = query(
        collection(db, "adminQueue"),
        where("type",   "==", contentType === "articles" ? "article" : "research"),
        where("status", "==", statusFilter)
      );
    }

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Sort by submittedAt or createdAt descending
      docs.sort((a: any, b: any) => {
        const aTime = a.submittedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
        const bTime = b.submittedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      setItems(docs);
      setLoading(false);
    });

    return () => unsub();
  }, [contentType, statusFilter]);

  // ── APPROVE BOOK ──────────────────────────────────────────────────
  const approveBook = async (item: any) => {
    showAlert(
      "Approve & Publish",
      `Publish "${item.title}"? It will go live immediately.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Publish",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "books", item.id), {
                status:      "published",
                approvedAt:  serverTimestamp(),
                isPublished: true,
              });
              showAlert("Published ✅", `"${item.title}" is now live.`, [{ text: "OK" }]);
            } catch (e: any) {
              showAlert("Error", e.message, [{ text: "OK" }]);
            }
          },
        },
      ]
    );
  };

  // ── REJECT BOOK ───────────────────────────────────────────────────
  const rejectBook = async (item: any) => {
    showAlert(
      "Reject Submission",
      `Reject "${item.title}"? The author will need to resubmit.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "books", item.id), {
                status:      "rejected",
                rejectedAt:  serverTimestamp(),
                isPublished: false,
              });
              showAlert("Rejected", `"${item.title}" has been rejected.`, [{ text: "OK" }]);
            } catch (e: any) {
              showAlert("Error", e.message, [{ text: "OK" }]);
            }
          },
        },
      ]
    );
  };

  // ── APPROVE ARTICLE OR RESEARCH ───────────────────────────────────
  // On approve: update adminQueue status + read full doc from articles/research
  // collection + write to feed collection
  const approveContent = async (item: any) => {
    const typeLabel = item.type === "article" ? "article" : "research";
    showAlert(
      "Approve & Publish",
      `Publish this ${typeLabel}?\n\n"${item.title}"\n\nIt will appear in the feed immediately.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Publish",
          onPress: async () => {
            try {
              // 1. Get the full content from the source collection
              const sourceCollection = item.type === "article" ? "articles" : "research";
              const sourceId         = item.articleId || item.researchId || null;

              let fullData: Record<string, any> = { ...item };

              if (sourceId) {
                const sourceSnap = await getDoc(doc(db, sourceCollection, sourceId));
                if (sourceSnap.exists()) {
                  fullData = { ...sourceSnap.data(), id: sourceSnap.id };
                }
              }

              // 2. Write to feed collection
              const feedPayload: Record<string, any> = {
                type:          item.type,
                status:        "published",
                title:         fullData.title         || item.title        || "",
                subtitle:      fullData.subtitle      || item.subtitle      || "",
                content:       fullData.content       || item.content       || "",
                manualContent: fullData.manualContent || null,
                scriptContent: fullData.scriptContent || null,
                pdfUrl:        fullData.pdfUrl        || null,
                abstract:      fullData.abstract      || null,
                category:      fullData.category      || item.category      || "",
                fieldOfStudy:  fullData.fieldOfStudy  || null,
                institution:   fullData.institution    || null,
                tags:          fullData.tags           || item.tags          || [],
                coverUrl:      fullData.coverUrl       || item.coverUrl      || null,
                isPaid:        fullData.isPaid         || false,
                price:         fullData.price          || 0,
                publishToWeb:  fullData.publishToWeb   || false,
                allowComments: fullData.allowComments !== false,
                userId:        fullData.userId         || item.userId        || "",
                userName:      fullData.userName       || item.userName      || "Scholar",
                userPhoto:     fullData.userPhoto      || item.userPhoto      || "",
                userHandle:    fullData.userHandle     || item.userHandle    || "",
                wordCount:     fullData.wordCount      || null,
                readTime:      fullData.readTime       || null,
                likesCount:    0,
                commentsCount: 0,
                likedBy:       [],
                reactions:     {},
                // Keep reference to original doc
                originalId:    sourceId || item.id,
                approvedAt:    serverTimestamp(),
                createdAt:     fullData.createdAt      || serverTimestamp(),
                publishedAt:   serverTimestamp(),
              };

              await addDoc(collection(db, "feed"), feedPayload);

              // 3. Update adminQueue status to published
              await updateDoc(doc(db, "adminQueue", item.id), {
                status:     "published",
                approvedAt: serverTimestamp(),
              });

              // 4. Update source collection doc status if it exists
              if (sourceId) {
                try {
                  await updateDoc(doc(db, sourceCollection, sourceId), {
                    status:     "published",
                    approvedAt: serverTimestamp(),
                  });
                } catch (_) {}
              }

              showAlert(
                "Published ✅",
                `The ${typeLabel} is now live in the feed.`,
                [{ text: "OK" }]
              );
            } catch (e: any) {
              showAlert("Error", "Could not approve:\n" + e.message, [{ text: "OK" }]);
            }
          },
        },
      ]
    );
  };

  // ── REJECT ARTICLE OR RESEARCH ────────────────────────────────────
  const rejectContent = (item: any) => {
    setRejectingId(item.id);
  };

  const confirmReject = async (item: any) => {
    try {
      const sourceCollection = item.type === "article" ? "articles" : "research";
      const sourceId         = item.articleId || item.researchId || null;

      // Update adminQueue
      await updateDoc(doc(db, "adminQueue", item.id), {
        status:      "rejected",
        rejectedAt:  serverTimestamp(),
        rejectReason: rejectNote.trim() || "Did not meet publication standards.",
      });

      // Update source doc
      if (sourceId) {
        try {
          await updateDoc(doc(db, sourceCollection, sourceId), {
            status:      "rejected",
            rejectedAt:  serverTimestamp(),
            rejectReason: rejectNote.trim() || "Did not meet publication standards.",
          });
        } catch (_) {}
      }

      setRejectingId(null);
      setRejectNote("");
      showAlert("Rejected", `The submission has been rejected.`, [{ text: "OK" }]);
    } catch (e: any) {
      showAlert("Error", e.message, [{ text: "OK" }]);
    }
  };

  // ── RENDER ACTION BUTTONS ─────────────────────────────────────────
  const renderActions = (item: any) => {
    if (statusFilter !== "pending") {
      return (
        <View style={[styles.statusBadge, {
          backgroundColor: statusFilter === "published"
            ? THEME.green + "20" : THEME.red + "20",
        }]}>
          <Ionicons
            name={statusFilter === "published" ? "checkmark-circle" : "close-circle"}
            size={14}
            color={statusFilter === "published" ? THEME.green : THEME.red}
          />
          <Text style={[styles.statusTxt, {
            color: statusFilter === "published" ? THEME.green : THEME.red,
          }]}>
            {statusFilter === "published" ? "Published" : "Rejected"}
          </Text>
          {statusFilter === "published" && item.approvedAt && (
            <Text style={styles.statusDate}>
              {formatTime(item.approvedAt)}
            </Text>
          )}
        </View>
      );
    }

    // Reject reason input
    if (rejectingId === item.id) {
      return (
        <View style={styles.rejectReasonWrap}>
          <Text style={styles.rejectReasonLabel}>REJECTION REASON (optional)</Text>
          <TextInput
            style={styles.rejectReasonInput}
            placeholder="Tell the author why it was rejected..."
            placeholderTextColor={THEME.textMuted}
            value={rejectNote}
            onChangeText={setRejectNote}
            multiline
            maxLength={300}
          />
          <View style={styles.rejectReasonBtns}>
            <TouchableOpacity
              style={styles.rejectCancelBtn}
              onPress={() => { setRejectingId(null); setRejectNote(""); }}
            >
              <Text style={styles.rejectCancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rejectConfirmBtn}
              onPress={() => confirmReject(item)}
            >
              <Ionicons name="close-circle" size={16} color="#fff" />
              <Text style={styles.rejectConfirmTxt}>Confirm Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [styles.rejectBtn, pressed && { opacity: 0.7 }]}
          onPress={() =>
            contentType === "books"
              ? rejectBook(item)
              : rejectContent(item)
          }
        >
          <Ionicons name="close-circle-outline" size={18} color={THEME.red} />
          <Text style={styles.rejectTxt}>Reject</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.approveBtn, pressed && { opacity: 0.7 }]}
          onPress={() =>
            contentType === "books"
              ? approveBook(item)
              : approveContent(item)
          }
        >
          <Ionicons name="checkmark-circle" size={18} color="#000" />
          <Text style={styles.approveTxt}>Approve & Publish</Text>
        </Pressable>
      </View>
    );
  };

  // ── RENDER BOOK CARD ──────────────────────────────────────────────
  const renderBookCard = (item: any) => (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Image
          source={{ uri: item.coverUrl || item.cover || "https://picsum.photos/80/120" }}
          style={styles.bookCover}
        />
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.cardAuthor}>{item.authorName || "Unknown Author"}</Text>
          <View style={styles.metaRow}>
            <View style={styles.genreBadge}>
              <Text style={styles.genreBadgeTxt}>{item.genre || "No genre"}</Text>
            </View>
            <View style={[styles.priceBadge, item.isFree && { backgroundColor: THEME.green + "20" }]}>
              <Text style={[styles.priceBadgeTxt, item.isFree && { color: THEME.green }]}>
                {item.isFree || !item.price ? "FREE" : `₦${item.price?.toLocaleString()}`}
              </Text>
            </View>
          </View>
          <Text style={styles.cardDate}>{formatTime(item.createdAt)}</Text>
        </View>
      </View>
      {item.description ? (
        <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>
      ) : null}
      {renderActions(item)}
    </View>
  );

  // ── RENDER ARTICLE CARD ───────────────────────────────────────────
  const renderArticleCard = (item: any) => (
    <View style={styles.card}>
      {item.coverUrl && (
        <Image
          source={{ uri: item.coverUrl }}
          style={styles.articleCover}
          resizeMode="cover"
        />
      )}
      <View style={styles.articleTypeRow}>
        <View style={[styles.typeBadge, { backgroundColor: THEME.blue + "20" }]}>
          <Ionicons name="newspaper-outline" size={11} color={THEME.blue} />
          <Text style={[styles.typeBadgeTxt, { color: THEME.blue }]}>ARTICLE</Text>
        </View>
        {item.category && (
          <Text style={styles.categoryTxt}>{item.category}</Text>
        )}
        <Text style={styles.cardDate}>{formatTime(item.submittedAt || item.createdAt)}</Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title || "No title"}</Text>
      {item.subtitle && (
        <Text style={styles.cardSubtitle} numberOfLines={1}>{item.subtitle}</Text>
      )}
      <View style={styles.authorRow}>
        {item.userPhoto ? (
          <Image source={{ uri: item.userPhoto }} style={styles.authorAvatar} />
        ) : (
          <View style={[styles.authorAvatar, styles.authorAvatarFallback]}>
            <Text style={styles.authorAvatarTxt}>
              {(item.userName || "W")[0].toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.authorName}>{item.userName || "Scholar"}</Text>
        {item.userHandle && (
          <Text style={styles.authorHandle}>@{item.userHandle}</Text>
        )}
      </View>
      {item.content && (
        <Text style={styles.cardDesc} numberOfLines={4}>{item.content}</Text>
      )}
      {renderActions(item)}
    </View>
  );

  // ── RENDER RESEARCH CARD ──────────────────────────────────────────
  const renderResearchCard = (item: any) => (
    <View style={styles.card}>
      <View style={styles.articleTypeRow}>
        <View style={[styles.typeBadge, { backgroundColor: THEME.cyan + "20" }]}>
          <MaterialCommunityIcons name="flask-outline" size={11} color={THEME.cyan} />
          <Text style={[styles.typeBadgeTxt, { color: THEME.cyan }]}>RESEARCH</Text>
        </View>
        {item.fieldOfStudy && (
          <Text style={[styles.categoryTxt, { color: THEME.cyan }]}>{item.fieldOfStudy}</Text>
        )}
        <Text style={styles.cardDate}>{formatTime(item.submittedAt || item.createdAt)}</Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title || "No title"}</Text>
      {item.institution && (
        <View style={styles.institutionRow}>
          <Ionicons name="business-outline" size={12} color={THEME.textMuted} />
          <Text style={styles.institutionTxt}>{item.institution}</Text>
        </View>
      )}
      <View style={styles.authorRow}>
        {item.userPhoto ? (
          <Image source={{ uri: item.userPhoto }} style={styles.authorAvatar} />
        ) : (
          <View style={[styles.authorAvatar, styles.authorAvatarFallback]}>
            <Text style={styles.authorAvatarTxt}>
              {(item.userName || "W")[0].toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.authorName}>{item.userName || "Scholar"}</Text>
      </View>
      {(item.abstract || item.content) && (
        <View style={styles.abstractBox}>
          <Text style={styles.abstractLabel}>ABSTRACT</Text>
          <Text style={styles.cardDesc} numberOfLines={4}>
            {item.abstract || item.content}
          </Text>
        </View>
      )}
      {renderActions(item)}
    </View>
  );

  // ── RENDER ────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={THEME.accent} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>APPROVALS</Text>
          <Text style={styles.headerSub}>
            {counts.books + counts.articles + counts.research} pending
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* CONTENT TYPE TABS */}
      <View style={styles.contentTabRow}>
        {CONTENT_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.contentTab,
              contentType === tab.key && { backgroundColor: tab.color, borderColor: tab.color },
            ]}
            onPress={() => {
              setContentType(tab.key);
              setStatusFilter("pending");
              setRejectingId(null);
            }}
          >
            <Ionicons
              name={tab.icon as any}
              size={16}
              color={contentType === tab.key ? "#000" : THEME.textMuted}
            />
            <Text style={[
              styles.contentTabTxt,
              contentType === tab.key && styles.contentTabTxtActive,
            ]}>
              {tab.label}
            </Text>
            {counts[tab.key] > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeTxt}>{counts[tab.key]}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* STATUS TABS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statusTabRow}
      >
        {STATUS_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.statusPill,
              statusFilter === tab.key && {
                backgroundColor: tab.color,
                borderColor: tab.color,
              },
            ]}
            onPress={() => { setStatusFilter(tab.key); setRejectingId(null); }}
          >
            <Text style={[
              styles.statusPillTxt,
              statusFilter === tab.key && { color: "#000", fontWeight: "900" },
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* INFO BANNER */}
      {statusFilter === "pending" && (
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle-outline" size={14} color={THEME.orange} />
          <Text style={styles.infoBannerTxt}>
            {contentType === "books"
              ? "Approving a book makes it live in the library immediately."
              : `Approving ${contentType === "articles" ? "an article" : "research"} writes it to the feed immediately.`
            }
          </Text>
        </View>
      )}

      {/* LIST */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={THEME.accent} size="large" />
          <Text style={styles.loadingTxt}>Loading submissions...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 48 }}>
            {contentType === "books" ? "📚"
             : contentType === "articles" ? "📰" : "🔬"}
          </Text>
          <Text style={styles.emptyTxt}>
            No {statusFilter} {contentType}
          </Text>
          <Text style={styles.emptySubTxt}>
            {statusFilter === "pending"
              ? "All caught up! Nothing waiting for review."
              : `No ${contentType} have been ${statusFilter} yet.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            if (contentType === "books")    return renderBookCard(item);
            if (contentType === "articles") return renderArticleCard(item);
            return renderResearchCard(item);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: THEME.bg },
  header:              { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  backBtn:             { width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  headerCenter:        { alignItems: "center" },
  headerTitle:         { color: THEME.accent, fontSize: 14, fontWeight: "900", letterSpacing: 3 },
  headerSub:           { color: THEME.textMuted, fontSize: 11, marginTop: 2 },

  // Content tabs
  contentTabRow:       { flexDirection: "row", padding: 16, gap: 10 },
  contentTab:          { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2, position: "relative" },
  contentTabTxt:       { color: THEME.textMuted, fontSize: 11, fontWeight: "800" },
  contentTabTxtActive: { color: "#000" },
  tabBadge:            { position: "absolute", top: -6, right: -6, backgroundColor: THEME.red, borderRadius: 10, minWidth: 18, height: 18, justifyContent: "center", alignItems: "center", paddingHorizontal: 3 },
  tabBadgeTxt:         { color: "#fff", fontSize: 9, fontWeight: "900" },

  // Status tabs
  statusTabRow:        { paddingHorizontal: 16, gap: 10, paddingBottom: 12, flexDirection: "row" },
  statusPill:          { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2 },
  statusPillTxt:       { color: THEME.textMuted, fontSize: 12, fontWeight: "700" },

  // Info banner
  infoBanner:          { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: THEME.orange + "15", marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: THEME.orange + "30" },
  infoBannerTxt:       { color: THEME.orange, fontSize: 11, flex: 1 },

  // Loading / empty
  loadingWrap:         { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
  loadingTxt:          { color: THEME.textMuted, fontSize: 13 },
  empty:               { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, marginTop: 60 },
  emptyTxt:            { color: THEME.text, fontSize: 16, fontWeight: "800" },
  emptySubTxt:         { color: THEME.textMuted, fontSize: 12, textAlign: "center", paddingHorizontal: 40 },

  // Card shared
  card:                { backgroundColor: THEME.ui, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: THEME.ui2 },
  cardTitle:           { color: THEME.text, fontSize: 16, fontWeight: "900", marginBottom: 6 },
  cardSubtitle:        { color: THEME.textMuted, fontSize: 13, marginBottom: 8 },
  cardDesc:            { color: THEME.textMuted, fontSize: 12, lineHeight: 18, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: THEME.ui2 },
  cardDate:            { color: THEME.textMuted, fontSize: 10 },
  metaRow:             { flexDirection: "row", gap: 8, marginTop: 6, marginBottom: 4 },
  genreBadge:          { backgroundColor: THEME.ui2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  genreBadgeTxt:       { color: THEME.textMuted, fontSize: 10, fontWeight: "700" },
  priceBadge:          { backgroundColor: THEME.accent + "20", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  priceBadgeTxt:       { color: THEME.accent, fontSize: 10, fontWeight: "900" },

  // Book card
  cardRow:             { flexDirection: "row", gap: 14 },
  bookCover:           { width: 70, height: 100, borderRadius: 10, borderWidth: 1, borderColor: THEME.accent + "30" },
  cardInfo:            { flex: 1, gap: 2 },
  cardAuthor:          { color: THEME.textMuted, fontSize: 12, marginBottom: 4 },

  // Article / research card
  articleCover:        { width: "100%", height: 160, borderRadius: 14, marginBottom: 12 },
  articleTypeRow:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  typeBadge:           { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  typeBadgeTxt:        { fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  categoryTxt:         { color: THEME.textMuted, fontSize: 11, fontWeight: "700", flex: 1 },
  authorRow:           { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, marginBottom: 4 },
  authorAvatar:        { width: 28, height: 28, borderRadius: 8 },
  authorAvatarFallback:{ backgroundColor: THEME.ui2, justifyContent: "center", alignItems: "center" },
  authorAvatarTxt:     { color: THEME.accent, fontWeight: "900", fontSize: 11 },
  authorName:          { color: THEME.text, fontWeight: "700", fontSize: 12 },
  authorHandle:        { color: THEME.textMuted, fontSize: 11 },
  institutionRow:      { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  institutionTxt:      { color: THEME.textMuted, fontSize: 12 },
  abstractBox:         { backgroundColor: THEME.ui2 + "80", borderRadius: 12, padding: 12, marginTop: 10 },
  abstractLabel:       { color: THEME.cyan, fontSize: 8, fontWeight: "900", letterSpacing: 2, marginBottom: 6 },

  // Action buttons
  actionRow:           { flexDirection: "row", gap: 12, marginTop: 14 },
  rejectBtn:           { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: THEME.red + "50" },
  rejectTxt:           { color: THEME.red, fontWeight: "800", fontSize: 13 },
  approveBtn:          { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: THEME.accent },
  approveTxt:          { color: "#000", fontWeight: "900", fontSize: 13 },
  statusBadge:         { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, padding: 10, borderRadius: 12, alignSelf: "flex-start" },
  statusTxt:           { fontSize: 12, fontWeight: "800" },
  statusDate:          { color: THEME.textMuted, fontSize: 10, marginLeft: 4 },

  // Reject reason
  rejectReasonWrap:    { marginTop: 14, backgroundColor: THEME.red + "10", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: THEME.red + "30" },
  rejectReasonLabel:   { color: THEME.red, fontSize: 9, fontWeight: "900", letterSpacing: 2, marginBottom: 10 },
  rejectReasonInput:   { backgroundColor: THEME.ui2, borderRadius: 12, padding: 12, color: THEME.text, fontSize: 13, minHeight: 80, textAlignVertical: "top", borderWidth: 1, borderColor: THEME.ui2 },
  rejectReasonBtns:    { flexDirection: "row", gap: 10, marginTop: 12 },
  rejectCancelBtn:     { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: THEME.ui2 },
  rejectCancelTxt:     { color: THEME.textMuted, fontWeight: "700", fontSize: 13 },
  rejectConfirmBtn:    { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: THEME.red },
  rejectConfirmTxt:    { color: "#fff", fontWeight: "900", fontSize: 13 },
});