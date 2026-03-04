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
  bg: "#0F071A", ui: "#1E1135", ui2: "#2D1B4D",
  accent: "#FFD700", text: "#E2E8F0", textMuted: "#94A3B8",
  green: "#22C55E", red: "#EF4444", blue: "#38BDF8",
  purple: "#A78BFA", cyan: "#00D1FF", orange: "#F97316",
};

const showAlert = (title: string, message: string, buttons: any[]) => {
  if (Platform.OS === "web") {
    if (buttons.length === 1) {
      window.alert(title + "\n\n" + message);
      buttons[0].onPress?.();
    } else {
      const ok = window.confirm(title + "\n\n" + message);
      if (ok) buttons.find((b: any) => b.style !== "cancel")?.onPress?.();
      else buttons.find((b: any) => b.style === "cancel")?.onPress?.();
    }
  } else {
    const { Alert } = require("react-native");
    Alert.alert(title, message, buttons);
  }
};

type ContentType = "books" | "articles" | "research" | "inquiries";
type StatusFilter = "pending" | "published" | "rejected";
type InquiryStatus = "pending" | "approved" | "declined";

const PLAN_COLORS: Record<string, string> = {
  featured: "#FFD700",
  banner: "#38BDF8",
  launch: "#A78BFA",
};

const CONTENT_TABS = [
  { key: "books",     label: "Books",        icon: "book-outline",      color: "#FFD700" },
  { key: "articles",  label: "Articles",     icon: "newspaper-outline", color: "#38BDF8" },
  { key: "research",  label: "Research",     icon: "flask-outline",     color: "#00D1FF" },
  { key: "inquiries", label: "Ad Inquiries", icon: "megaphone-outline", color: "#F97316" },
];

const STATUS_TABS = [
  { key: "pending",   label: "Pending",   color: "#F97316" },
  { key: "published", label: "Published", color: "#22C55E" },
  { key: "rejected",  label: "Rejected",  color: "#EF4444" },
];

const INQUIRY_TABS = [
  { key: "pending",  label: "Pending",  color: "#F97316" },
  { key: "approved", label: "Approved", color: "#22C55E" },
  { key: "declined", label: "Declined", color: "#EF4444" },
];

const formatTime = (ts: any): string => {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
};

export default function ApprovalsScreen() {
  const router = useRouter();
  const [contentType, setContentType] = useState<ContentType>("books");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [inquiryStatus, setInquiryStatus] = useState<InquiryStatus>("pending");
  const [items, setItems] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<ContentType, number>>({ books: 0, articles: 0, research: 0, inquiries: 0 });
  const [rejectNote, setRejectNote] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineNote, setDeclineNote] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    unsubs.push(onSnapshot(query(collection(db, "books"), where("status", "==", "pending")), (snap) => setCounts((c) => ({ ...c, books: snap.size }))));
    unsubs.push(onSnapshot(query(collection(db, "adminQueue"), where("type", "==", "article"), where("status", "==", "pending")), (snap) => setCounts((c) => ({ ...c, articles: snap.size }))));
    unsubs.push(onSnapshot(query(collection(db, "adminQueue"), where("type", "==", "research"), where("status", "==", "pending")), (snap) => setCounts((c) => ({ ...c, research: snap.size }))));
    unsubs.push(onSnapshot(query(collection(db, "advertising_inquiries"), where("status", "==", "pending")), (snap) => setCounts((c) => ({ ...c, inquiries: snap.size }))));
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => {
    if (contentType === "inquiries") return;
    setLoading(true);
    setItems([]);
    let q: any;
    if (contentType === "books") {
      q = query(collection(db, "books"), where("status", "==", statusFilter));
    } else {
      q = query(collection(db, "adminQueue"), where("type", "==", contentType === "articles" ? "article" : "research"), where("status", "==", statusFilter));
    }
    const unsub = onSnapshot(q, (snap: any) => {
      const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      docs.sort((a: any, b: any) => (b.submittedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0) - (a.submittedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0));
      setItems(docs);
      setLoading(false);
    });
    return () => unsub();
  }, [contentType, statusFilter]);

  useEffect(() => {
    if (contentType !== "inquiries") return;
    setLoading(true);
    const q = query(collection(db, "advertising_inquiries"), where("status", "==", inquiryStatus));
    const unsub = onSnapshot(q, (snap: any) => {
      const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      docs.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setInquiries(docs);
      setLoading(false);
    });
    return () => unsub();
  }, [contentType, inquiryStatus]);

  const approveInquiry = async (item: any) => {
    setProcessingId(item.id);
    try {
      await updateDoc(doc(db, "advertising_inquiries", item.id), { status: "approved", approvedAt: serverTimestamp() });
      if (item.userId) {
        await addDoc(collection(db, "users", item.userId, "notifications"), {
          type: "review",
          message: "Your advertising inquiry for " + item.bookTitle + " has been approved! We will contact you at " + item.email + " with payment details within 24 hours.",
          read: false, createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, "users", item.userId), { hasUnread: true });
      }
      showAlert("Approved", "Contact " + item.name + " at " + item.email + " to finalize.", [{ text: "OK" }]);
    } catch (e: any) {
      showAlert("Error", e.message, [{ text: "OK" }]);
    } finally {
      setProcessingId(null);
    }
  };

  const confirmDecline = async (item: any) => {
    setProcessingId(item.id);
    try {
      const reason = declineNote.trim() || "We are unable to accommodate your request at this time.";
      await updateDoc(doc(db, "advertising_inquiries", item.id), { status: "declined", declinedAt: serverTimestamp(), declineReason: reason });
      if (item.userId) {
        await addDoc(collection(db, "users", item.userId, "notifications"), {
          type: "review",
          message: "Your advertising inquiry for " + item.bookTitle + " was not approved. " + reason,
          read: false, createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, "users", item.userId), { hasUnread: true });
      }
      setDecliningId(null);
      setDeclineNote("");
      showAlert("Declined", "The inquiry has been declined and the user notified.", [{ text: "OK" }]);
    } catch (e: any) {
      showAlert("Error", e.message, [{ text: "OK" }]);
    } finally {
      setProcessingId(null);
    }
  };

  const approveBook = (item: any) => {
    showAlert("Approve", "Publish " + item.title + "? It will go live immediately.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Publish", onPress: async () => {
          try {
            await updateDoc(doc(db, "books", item.id), { status: "published", approvedAt: serverTimestamp(), isPublished: true });
            const uid = item.authorId || item.userId;
            if (uid) {
              await addDoc(collection(db, "users", uid, "notifications"), { type: "book_approved", message: "Your book " + item.title + " is now live!", read: false, createdAt: serverTimestamp() });
              await updateDoc(doc(db, "users", uid), { hasUnread: true });
            }
            showAlert("Published", item.title + " is now live.", [{ text: "OK" }]);
          } catch (e: any) { showAlert("Error", e.message, [{ text: "OK" }]); }
        },
      },
    ]);
  };

  const rejectBook = (item: any) => {
    showAlert("Reject", "Reject " + item.title + "?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject", style: "destructive", onPress: async () => {
          try {
            await updateDoc(doc(db, "books", item.id), { status: "rejected", rejectedAt: serverTimestamp(), isPublished: false });
            const uid = item.authorId || item.userId;
            if (uid) {
              await addDoc(collection(db, "users", uid, "notifications"), { type: "book_rejected", message: "Your book " + item.title + " needs revisions before resubmission.", read: false, createdAt: serverTimestamp() });
              await updateDoc(doc(db, "users", uid), { hasUnread: true });
            }
            showAlert("Rejected", item.title + " has been rejected.", [{ text: "OK" }]);
          } catch (e: any) { showAlert("Error", e.message, [{ text: "OK" }]); }
        },
      },
    ]);
  };

  const approveContent = (item: any) => {
    const label = item.type === "article" ? "article" : "research";
    showAlert("Approve", "Publish this " + label + "?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Publish", onPress: async () => {
          try {
            const srcCol = item.type === "article" ? "articles" : "research";
            const srcId = item.articleId || item.researchId || null;
            let full: any = { ...item };
            if (srcId) {
              const snap = await getDoc(doc(db, srcCol, srcId));
              if (snap.exists()) full = { ...snap.data(), id: snap.id };
            }
            await addDoc(collection(db, "feed"), {
              type: item.type, status: "published",
              title: full.title || item.title || "",
              content: full.content || item.content || "",
              category: full.category || item.category || "",
              fieldOfStudy: full.fieldOfStudy || null,
              institution: full.institution || null,
              tags: full.tags || item.tags || [],
              coverUrl: full.coverUrl || item.coverUrl || null,
              isPaid: full.isPaid || false,
              price: full.price || 0,
              userId: full.userId || item.userId || "",
              userName: full.userName || item.userName || "Scholar",
              userPhoto: full.userPhoto || item.userPhoto || "",
              userHandle: full.userHandle || item.userHandle || "",
              wordCount: full.wordCount || null,
              readTime: full.readTime || null,
              likesCount: 0, commentsCount: 0, likedBy: [], reactions: {},
              originalId: srcId || item.id,
              approvedAt: serverTimestamp(),
              createdAt: full.createdAt || serverTimestamp(),
              publishedAt: serverTimestamp(),
            });
            await updateDoc(doc(db, "adminQueue", item.id), { status: "published", approvedAt: serverTimestamp() });
            if (srcId) {
              try { await updateDoc(doc(db, srcCol, srcId), { status: "published", approvedAt: serverTimestamp() }); } catch (_) {}
            }
            if (item.userId) {
              await addDoc(collection(db, "users", item.userId, "notifications"), { type: "book_approved", message: "Your " + label + " " + item.title + " is now live in the feed!", read: false, createdAt: serverTimestamp() });
              await updateDoc(doc(db, "users", item.userId), { hasUnread: true });
            }
            showAlert("Published", "The " + label + " is now live.", [{ text: "OK" }]);
          } catch (e: any) { showAlert("Error", e.message, [{ text: "OK" }]); }
        },
      },
    ]);
  };

  const rejectContent = (item: any) => setRejectingId(item.id);

  const confirmReject = async (item: any) => {
    try {
      const srcCol = item.type === "article" ? "articles" : "research";
      const srcId = item.articleId || item.researchId || null;
      const reason = rejectNote.trim() || "Did not meet publication standards.";
      await updateDoc(doc(db, "adminQueue", item.id), { status: "rejected", rejectedAt: serverTimestamp(), rejectReason: reason });
      if (srcId) { try { await updateDoc(doc(db, srcCol, srcId), { status: "rejected", rejectedAt: serverTimestamp(), rejectReason: reason }); } catch (_) {} }
      if (item.userId) {
        await addDoc(collection(db, "users", item.userId, "notifications"), { type: "book_rejected", message: "Your submission " + item.title + " was not approved. " + reason, read: false, createdAt: serverTimestamp() });
        await updateDoc(doc(db, "users", item.userId), { hasUnread: true });
      }
      setRejectingId(null);
      setRejectNote("");
      showAlert("Rejected", "Submission has been rejected.", [{ text: "OK" }]);
    } catch (e: any) { showAlert("Error", e.message, [{ text: "OK" }]); }
  };

  const renderActions = (item: any) => {
    if (statusFilter !== "pending") {
      return (
        <View style={[styles.statusBadge, { backgroundColor: statusFilter === "published" ? THEME.green + "20" : THEME.red + "20" }]}>
          <Ionicons name={statusFilter === "published" ? "checkmark-circle" : "close-circle"} size={14} color={statusFilter === "published" ? THEME.green : THEME.red} />
          <Text style={[styles.statusTxt, { color: statusFilter === "published" ? THEME.green : THEME.red }]}>{statusFilter === "published" ? "Published" : "Rejected"}</Text>
          {statusFilter === "published" && item.approvedAt && <Text style={styles.statusDate}>{formatTime(item.approvedAt)}</Text>}
        </View>
      );
    }
    if (rejectingId === item.id) {
      return (
        <View style={styles.reasonWrap}>
          <Text style={styles.reasonLabel}>REJECTION REASON (optional)</Text>
          <TextInput style={styles.reasonInput} placeholder="Tell the author why..." placeholderTextColor={THEME.textMuted} value={rejectNote} onChangeText={setRejectNote} multiline maxLength={300} />
          <View style={styles.reasonBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setRejectingId(null); setRejectNote(""); }}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => confirmReject(item)}>
              <Text style={styles.confirmTxt}>Confirm Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.actionRow}>
        <Pressable style={({ pressed }) => [styles.rejectBtn, pressed && { opacity: 0.7 }]} onPress={() => contentType === "books" ? rejectBook(item) : rejectContent(item)}>
          <Ionicons name="close-circle-outline" size={18} color={THEME.red} />
          <Text style={styles.rejectTxt}>Reject</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.approveBtn, pressed && { opacity: 0.7 }]} onPress={() => contentType === "books" ? approveBook(item) : approveContent(item)}>
          <Ionicons name="checkmark-circle" size={18} color="#000" />
          <Text style={styles.approveTxt}>Approve & Publish</Text>
        </Pressable>
      </View>
    );
  };

  const renderInquiryCard = (item: any) => {
    const planColor = PLAN_COLORS[item.planId] || THEME.orange;
    const isProcessing = processingId === item.id;
    return (
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={[styles.planBadge, { backgroundColor: planColor + "20", borderColor: planColor + "40" }]}>
            <Ionicons name="megaphone-outline" size={11} color={planColor} />
            <Text style={[styles.planBadgeTxt, { color: planColor }]}>{item.planName || (item.planId || "INQUIRY").toUpperCase()}</Text>
          </View>
          <Text style={styles.cardDate}>{formatTime(item.createdAt)}</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>{"Book: " + (item.bookTitle || "Untitled")}</Text>
        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={13} color={THEME.textMuted} />
            <Text style={styles.infoTxt}>{item.name || "Unknown"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={13} color={THEME.textMuted} />
            <Text style={styles.infoTxt} numberOfLines={1}>{item.email || "No email"}</Text>
          </View>
        </View>
        {item.message ? (
          <View style={styles.msgBox}>
            <Text style={styles.msgLabel}>MESSAGE</Text>
            <Text style={styles.msgTxt} numberOfLines={4}>{item.message}</Text>
          </View>
        ) : null}
        {inquiryStatus === "pending" ? (
          decliningId === item.id ? (
            <View style={styles.reasonWrap}>
              <Text style={styles.reasonLabel}>DECLINE REASON (optional)</Text>
              <TextInput style={styles.reasonInput} placeholder="Explain why (user will see this)..." placeholderTextColor={THEME.textMuted} value={declineNote} onChangeText={setDeclineNote} multiline maxLength={300} />
              <View style={styles.reasonBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setDecliningId(null); setDeclineNote(""); }}>
                  <Text style={styles.cancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.confirmBtn, isProcessing && { opacity: 0.6 }]} onPress={() => confirmDecline(item)} disabled={isProcessing}>
                  {isProcessing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.confirmTxt}>Confirm Decline</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.actionRow}>
              <Pressable style={({ pressed }) => [styles.rejectBtn, pressed && { opacity: 0.7 }]} onPress={() => setDecliningId(item.id)}>
                <Ionicons name="close-circle-outline" size={18} color={THEME.red} />
                <Text style={styles.rejectTxt}>Decline</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.approveBtn, { backgroundColor: THEME.orange }, (pressed || isProcessing) && { opacity: 0.7 }]} onPress={() => approveInquiry(item)} disabled={isProcessing}>
                {isProcessing ? <ActivityIndicator size="small" color="#000" /> : <><Ionicons name="checkmark-circle" size={18} color="#000" /><Text style={styles.approveTxt}>Approve & Notify</Text></>}
              </Pressable>
            </View>
          )
        ) : (
          <View style={[styles.statusBadge, { backgroundColor: inquiryStatus === "approved" ? THEME.green + "20" : THEME.red + "20" }]}>
            <Ionicons name={inquiryStatus === "approved" ? "checkmark-circle" : "close-circle"} size={14} color={inquiryStatus === "approved" ? THEME.green : THEME.red} />
            <Text style={[styles.statusTxt, { color: inquiryStatus === "approved" ? THEME.green : THEME.red }]}>{inquiryStatus === "approved" ? "Approved" : "Declined"}</Text>
            <Text style={styles.statusDate}>{formatTime(item.approvedAt || item.declinedAt)}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderBookCard = (item: any) => (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Image source={{ uri: item.coverUrl || item.cover || "https://picsum.photos/80/120" }} style={styles.bookCover} />
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.cardAuthor}>{item.authorName || "Unknown"}</Text>
          <View style={styles.metaRow}>
            <View style={styles.genreBadge}><Text style={styles.genreTxt}>{item.genre || "No genre"}</Text></View>
            <View style={[styles.priceBadge, item.isFree && { backgroundColor: THEME.green + "20" }]}>
              <Text style={[styles.priceTxt, item.isFree && { color: THEME.green }]}>{item.isFree || !item.price ? "FREE" : "N" + item.price?.toLocaleString()}</Text>
            </View>
          </View>
          <Text style={styles.cardDate}>{formatTime(item.createdAt)}</Text>
        </View>
      </View>
      {item.description ? <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text> : null}
      {renderActions(item)}
    </View>
  );

  const renderArticleCard = (item: any) => (
    <View style={styles.card}>
      {item.coverUrl && <Image source={{ uri: item.coverUrl }} style={styles.articleCover} resizeMode="cover" />}
      <View style={styles.typeRow}>
        <View style={[styles.typeBadge, { backgroundColor: THEME.blue + "20" }]}>
          <Ionicons name="newspaper-outline" size={11} color={THEME.blue} />
          <Text style={[styles.typeTxt, { color: THEME.blue }]}>ARTICLE</Text>
        </View>
        {item.category && <Text style={styles.catTxt}>{item.category}</Text>}
        <Text style={styles.cardDate}>{formatTime(item.submittedAt || item.createdAt)}</Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title || "No title"}</Text>
      {item.subtitle && <Text style={styles.cardSub} numberOfLines={1}>{item.subtitle}</Text>}
      <View style={styles.authorRow}>
        {item.userPhoto ? <Image source={{ uri: item.userPhoto }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarTxt}>{(item.userName || "W")[0].toUpperCase()}</Text></View>}
        <Text style={styles.authorName}>{item.userName || "Scholar"}</Text>
        {item.userHandle && <Text style={styles.authorHandle}>{"@" + item.userHandle}</Text>}
      </View>
      {item.content && <Text style={styles.cardDesc} numberOfLines={4}>{item.content}</Text>}
      {renderActions(item)}
    </View>
  );

  const renderResearchCard = (item: any) => (
    <View style={styles.card}>
      <View style={styles.typeRow}>
        <View style={[styles.typeBadge, { backgroundColor: THEME.cyan + "20" }]}>
          <MaterialCommunityIcons name="flask-outline" size={11} color={THEME.cyan} />
          <Text style={[styles.typeTxt, { color: THEME.cyan }]}>RESEARCH</Text>
        </View>
        {item.fieldOfStudy && <Text style={[styles.catTxt, { color: THEME.cyan }]}>{item.fieldOfStudy}</Text>}
        <Text style={styles.cardDate}>{formatTime(item.submittedAt || item.createdAt)}</Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title || "No title"}</Text>
      {item.institution && <View style={styles.authorRow}><Ionicons name="business-outline" size={12} color={THEME.textMuted} /><Text style={styles.authorHandle}>{item.institution}</Text></View>}
      <View style={styles.authorRow}>
        {item.userPhoto ? <Image source={{ uri: item.userPhoto }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarTxt}>{(item.userName || "W")[0].toUpperCase()}</Text></View>}
        <Text style={styles.authorName}>{item.userName || "Scholar"}</Text>
      </View>
      {(item.abstract || item.content) && <View style={styles.abstractBox}><Text style={styles.abstractLabel}>ABSTRACT</Text><Text style={styles.cardDesc} numberOfLines={4}>{item.abstract || item.content}</Text></View>}
      {renderActions(item)}
    </View>
  );

  const totalPending = counts.books + counts.articles + counts.research + counts.inquiries;
  const activeTabs = contentType === "inquiries" ? INQUIRY_TABS : STATUS_TABS;
  const activeFilter = contentType === "inquiries" ? inquiryStatus : statusFilter;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={THEME.accent} />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.headerTitle}>APPROVALS</Text>
          <Text style={styles.headerSub}>{totalPending} pending</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {CONTENT_TABS.map((tab) => (
          <TouchableOpacity key={tab.key} style={[styles.tab, contentType === tab.key && { backgroundColor: tab.color, borderColor: tab.color }]}
            onPress={() => { setContentType(tab.key as ContentType); setStatusFilter("pending"); setInquiryStatus("pending"); setRejectingId(null); setDecliningId(null); }}>
            <Ionicons name={tab.icon as any} size={15} color={contentType === tab.key ? "#000" : THEME.textMuted} />
            <Text style={[styles.tabTxt, contentType === tab.key && { color: "#000" }]}>{tab.label}</Text>
            {counts[tab.key as ContentType] > 0 && <View style={styles.tabBadge}><Text style={styles.tabBadgeTxt}>{counts[tab.key as ContentType]}</Text></View>}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {activeTabs.map((tab) => (
          <TouchableOpacity key={tab.key} style={[styles.filterPill, activeFilter === tab.key && { backgroundColor: tab.color, borderColor: tab.color }]}
            onPress={() => { if (contentType === "inquiries") { setInquiryStatus(tab.key as InquiryStatus); setDecliningId(null); } else { setStatusFilter(tab.key as StatusFilter); setRejectingId(null); } }}>
            <Text style={[styles.filterTxt, activeFilter === tab.key && { color: "#000", fontWeight: "900" }]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {contentType !== "inquiries" && statusFilter === "pending" && (
        <View style={styles.banner}>
          <Ionicons name="information-circle-outline" size={14} color={THEME.orange} />
          <Text style={styles.bannerTxt}>{contentType === "books" ? "Approving a book makes it live in the library immediately." : "Approving " + (contentType === "articles" ? "an article" : "research") + " writes it to the feed immediately."}</Text>
        </View>
      )}
      {contentType === "inquiries" && inquiryStatus === "pending" && (
        <View style={styles.banner}>
          <Ionicons name="megaphone-outline" size={14} color={THEME.orange} />
          <Text style={styles.bannerTxt}>Approving notifies the user in-app. Contact them at their email to finalize payment.</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={THEME.accent} size="large" /><Text style={styles.loadTxt}>Loading...</Text></View>
      ) : contentType === "inquiries" ? (
        inquiries.length === 0 ? (
          <View style={styles.center}><Text style={{ fontSize: 48 }}>📢</Text><Text style={styles.emptyTxt}>No {inquiryStatus} inquiries</Text></View>
        ) : (
          <FlatList data={inquiries} keyExtractor={(item) => item.id} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} renderItem={({ item }) => renderInquiryCard(item)} />
        )
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>{contentType === "books" ? "📚" : contentType === "articles" ? "📰" : "🔬"}</Text>
          <Text style={styles.emptyTxt}>No {statusFilter} {contentType}</Text>
          <Text style={styles.emptySubTxt}>{statusFilter === "pending" ? "All caught up!" : "No " + contentType + " " + statusFilter + " yet."}</Text>
        </View>
      ) : (
        <FlatList data={items} keyExtractor={(item) => item.id} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            if (contentType === "books") return renderBookCard(item);
            if (contentType === "articles") return renderArticleCard(item);
            return renderResearchCard(item);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: THEME.accent, fontSize: 14, fontWeight: "900", letterSpacing: 3 },
  headerSub: { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  tabRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, flexDirection: "row" },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2, position: "relative" },
  tabTxt: { color: THEME.textMuted, fontSize: 11, fontWeight: "800" },
  tabBadge: { position: "absolute", top: -6, right: -6, backgroundColor: THEME.red, borderRadius: 10, minWidth: 18, height: 18, justifyContent: "center", alignItems: "center", paddingHorizontal: 3 },
  tabBadgeTxt: { color: "#fff", fontSize: 9, fontWeight: "900" },
  filterRow: { paddingHorizontal: 16, gap: 10, paddingBottom: 12, flexDirection: "row" },
  filterPill: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: THEME.ui, borderWidth: 1, borderColor: THEME.ui2 },
  filterTxt: { color: THEME.textMuted, fontSize: 12, fontWeight: "700" },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: THEME.orange + "15", marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: THEME.orange + "30" },
  bannerTxt: { color: THEME.orange, fontSize: 11, flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadTxt: { color: THEME.textMuted, fontSize: 13 },
  emptyTxt: { color: THEME.text, fontSize: 16, fontWeight: "800" },
  emptySubTxt: { color: THEME.textMuted, fontSize: 12, textAlign: "center", paddingHorizontal: 40 },
  listContent: { padding: 16, gap: 16, paddingBottom: 40 },
  card: { backgroundColor: THEME.ui, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: THEME.ui2 },
  cardTitle: { color: THEME.text, fontSize: 16, fontWeight: "900", marginBottom: 6 },
  cardSub: { color: THEME.textMuted, fontSize: 13, marginBottom: 8 },
  cardDesc: { color: THEME.textMuted, fontSize: 12, lineHeight: 18, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: THEME.ui2 },
  cardDate: { color: THEME.textMuted, fontSize: 10 },
  cardRow: { flexDirection: "row", gap: 14 },
  cardInfo: { flex: 1, gap: 2 },
  cardAuthor: { color: THEME.textMuted, fontSize: 12, marginBottom: 4 },
  bookCover: { width: 70, height: 100, borderRadius: 10, borderWidth: 1, borderColor: THEME.accent + "30" },
  metaRow: { flexDirection: "row", gap: 8, marginTop: 6, marginBottom: 4 },
  genreBadge: { backgroundColor: THEME.ui2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  genreTxt: { color: THEME.textMuted, fontSize: 10, fontWeight: "700" },
  priceBadge: { backgroundColor: THEME.accent + "20", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  priceTxt: { color: THEME.accent, fontSize: 10, fontWeight: "900" },
  articleCover: { width: "100%", height: 160, borderRadius: 14, marginBottom: 12 },
  typeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  typeBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  typeTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  catTxt: { color: THEME.textMuted, fontSize: 11, fontWeight: "700", flex: 1 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, marginBottom: 4 },
  avatar: { width: 28, height: 28, borderRadius: 8 },
  avatarFallback: { backgroundColor: THEME.ui2, justifyContent: "center", alignItems: "center" },
  avatarTxt: { color: THEME.accent, fontWeight: "900", fontSize: 11 },
  authorName: { color: THEME.text, fontWeight: "700", fontSize: 12 },
  authorHandle: { color: THEME.textMuted, fontSize: 11 },
  abstractBox: { backgroundColor: THEME.ui2, borderRadius: 12, padding: 12, marginTop: 10 },
  abstractLabel: { color: THEME.cyan, fontSize: 8, fontWeight: "900", letterSpacing: 2, marginBottom: 6 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  planBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  planBadgeTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  infoBox: { backgroundColor: THEME.ui2, borderRadius: 12, padding: 12, gap: 6, marginBottom: 10, marginTop: 6 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoTxt: { color: THEME.text, fontSize: 13, flex: 1 },
  msgBox: { backgroundColor: THEME.ui2, borderRadius: 12, padding: 12, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: THEME.orange },
  msgLabel: { color: THEME.orange, fontSize: 8, fontWeight: "900", letterSpacing: 2, marginBottom: 6 },
  msgTxt: { color: THEME.textMuted, fontSize: 13, lineHeight: 20 },
  actionRow: { flexDirection: "row", gap: 12, marginTop: 14 },
  rejectBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: THEME.red + "50" },
  rejectTxt: { color: THEME.red, fontWeight: "800", fontSize: 13 },
  approveBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: THEME.accent },
  approveTxt: { color: "#000", fontWeight: "900", fontSize: 13 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, padding: 10, borderRadius: 12, alignSelf: "flex-start" },
  statusTxt: { fontSize: 12, fontWeight: "800" },
  statusDate: { color: THEME.textMuted, fontSize: 10, marginLeft: 4 },
  reasonWrap: { marginTop: 14, backgroundColor: THEME.red + "10", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: THEME.red + "30" },
  reasonLabel: { color: THEME.red, fontSize: 9, fontWeight: "900", letterSpacing: 2, marginBottom: 10 },
  reasonInput: { backgroundColor: THEME.ui2, borderRadius: 12, padding: 12, color: THEME.text, fontSize: 13, minHeight: 80, textAlignVertical: "top", borderWidth: 1, borderColor: THEME.ui2 },
  reasonBtns: { flexDirection: "row", gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: THEME.ui2 },
  cancelTxt: { color: THEME.textMuted, fontWeight: "700", fontSize: 13 },
  confirmBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: THEME.red },
  confirmTxt: { color: "#fff", fontWeight: "900", fontSize: 13 },
});