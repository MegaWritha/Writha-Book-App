import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Dimensions,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth, db } from "@/lib/firebase";
import {
  collection, query, onSnapshot, where,
  orderBy, limit, doc, getDoc,
} from "firebase/firestore";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#0F071A", ui: "#1E1135", ui2: "#2D1B4D",
  accent: "#FFD700", purple: "#6D28D9", purpleLight: "#A78BFA",
  text: "#E2E8F0", textMuted: "#94A3B8",
  green: "#22C55E", red: "#EF4444", blue: "#38BDF8",
};

export default function AdminDashboard() {
  const router = useRouter();
  const user = auth.currentUser;

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [stats, setStats] = useState({
    totalUsers: 0, totalBooks: 0, pendingBooks: 0,
    totalDiscussions: 0, totalReports: 0, totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  // ── VERIFY ADMIN ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { router.replace("/login" as any); return; }
    const checkAdmin = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists() && snap.data().isAdmin === true) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
        router.replace("/(tabs)" as any);
      }
    };
    checkAdmin();
  }, [user]);

  // ── LOAD STATS ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;

    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snap) => setStats((s) => ({ ...s, totalUsers: snap.size }))
    );

    const unsubBooks = onSnapshot(
      collection(db, "books"),
      (snap) => setStats((s) => ({ ...s, totalBooks: snap.size }))
    );

    const unsubPending = onSnapshot(
      query(collection(db, "books"), where("status", "==", "submitted")),
      (snap) => setStats((s) => ({ ...s, pendingBooks: snap.size }))
    );

    const unsubFeed = onSnapshot(
      collection(db, "feed"),
      (snap) => setStats((s) => ({ ...s, totalDiscussions: snap.size }))
    );

    const unsubReports = onSnapshot(
      collection(db, "reports"),
      (snap) => setStats((s) => ({ ...s, totalReports: snap.size }))
    );

    setLoading(false);

    return () => {
      unsubUsers(); unsubBooks(); unsubPending();
      unsubFeed(); unsubReports();
    };
  }, [isAdmin]);

  if (isAdmin === null || loading) return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={THEME.accent} />
      <Text style={{ color: THEME.textMuted, marginTop: 12 }}>Verifying access...</Text>
    </View>
  );

  if (isAdmin === false) return null;

  const statCards = [
    { label: "Total Users",    value: stats.totalUsers,       icon: "people",            color: THEME.blue },
    { label: "Total Books",    value: stats.totalBooks,        icon: "library",           color: THEME.purple },
    { label: "Pending Review", value: stats.pendingBooks,      icon: "time",              color: THEME.accent,  alert: stats.pendingBooks > 0 },
    { label: "Discussions",    value: stats.totalDiscussions,  icon: "chatbubbles",       color: THEME.green },
    { label: "Reports",        value: stats.totalReports,      icon: "flag",              color: THEME.red,     alert: stats.totalReports > 0 },
  ];

  const menuItems = [
    { label: "Book Approvals",   icon: "checkmark-circle", color: THEME.accent,  route: "/admin/approvals",   badge: stats.pendingBooks },
    { label: "User Management",  icon: "people",           color: THEME.blue,    route: "/admin/users" },
    { label: "Reports",          icon: "flag",             color: THEME.red,     route: "/admin/reports",     badge: stats.totalReports },
    { label: "Ads Manager",      icon: "megaphone",        color: THEME.green,   route: "/admin/ads" },
    { label: "Featured Books",   icon: "star",             color: "#F59E0B",     route: "/admin/featured" },
    { label: "Analytics",        icon: "bar-chart",        color: THEME.purple,  route: "/admin/analytics" },
    { label: "Content Mod",      icon: "shield-checkmark", color: THEME.purpleLight, route: "/admin/moderation" },
    { label: "Announcements",    icon: "notifications",    color: THEME.blue,    route: "/admin/announcements" },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={THEME.accent} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>ADMIN PANEL</Text>
          <Text style={styles.headerSub}>MegaWritha Control Center</Text>
        </View>
        <View style={styles.adminBadge}>
          <MaterialCommunityIcons name="shield-crown" size={20} color={THEME.accent} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* WELCOME */}
        <View style={styles.welcomeCard}>
          <MaterialCommunityIcons name="shield-crown" size={40} color={THEME.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.welcomeTitle}>Welcome, Admin 👑</Text>
            <Text style={styles.welcomeSub}>
              {stats.pendingBooks > 0
                ? `⚠️ ${stats.pendingBooks} book${stats.pendingBooks > 1 ? "s" : ""} awaiting approval`
                : "Everything looks good today ✓"}
            </Text>
          </View>
        </View>

        {/* STAT CARDS */}
        <Text style={styles.sectionLabel}>OVERVIEW</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statScroll}>
          {statCards.map((s) => (
            <View key={s.label} style={[styles.statCard, { borderColor: s.color + "40" }]}>
              {s.alert && <View style={styles.alertDot} />}
              <Ionicons name={s.icon as any} size={22} color={s.color} />
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </ScrollView>

        {/* MENU GRID */}
        <Text style={styles.sectionLabel}>MANAGE</Text>
        <View style={styles.menuGrid}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.menuCard}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.8}
            >
              {item.badge !== undefined && item.badge > 0 && (
                <View style={styles.menuBadge}>
                  <Text style={styles.menuBadgeTxt}>{item.badge}</Text>
                </View>
              )}
              <View style={[styles.menuIconCircle, { backgroundColor: item.color + "20" }]}>
                <Ionicons name={item.icon as any} size={26} color={item.color} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  loader: { flex: 1, backgroundColor: THEME.bg, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: THEME.accent, fontSize: 18, fontWeight: "900", letterSpacing: 3 },
  headerSub: { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  adminBadge: { width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  welcomeCard: { flexDirection: "row", alignItems: "center", gap: 16, margin: 20, backgroundColor: THEME.ui, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: THEME.accent + "30" },
  welcomeTitle: { color: THEME.text, fontSize: 16, fontWeight: "900" },
  welcomeSub: { color: THEME.textMuted, fontSize: 12, marginTop: 4 },
  sectionLabel: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginLeft: 20, marginBottom: 12, marginTop: 8 },
  statScroll: { paddingHorizontal: 20, gap: 12, paddingBottom: 8 },
  statCard: { backgroundColor: THEME.ui, borderRadius: 18, padding: 18, alignItems: "center", minWidth: 100, borderWidth: 1, position: "relative" },
  alertDot: { position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.red },
  statValue: { fontSize: 28, fontWeight: "900", marginTop: 8 },
  statLabel: { color: THEME.textMuted, fontSize: 10, marginTop: 4, textAlign: "center" },
  menuGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 20, gap: 12 },
  menuCard: { width: (width - 52) / 2, backgroundColor: THEME.ui, borderRadius: 20, padding: 20, alignItems: "center", borderWidth: 1, borderColor: THEME.ui2, position: "relative" },
  menuBadge: { position: "absolute", top: 12, right: 12, backgroundColor: THEME.red, borderRadius: 10, minWidth: 20, height: 20, justifyContent: "center", alignItems: "center", paddingHorizontal: 4 },
  menuBadgeTxt: { color: "#fff", fontSize: 9, fontWeight: "900" },
  menuIconCircle: { width: 60, height: 60, borderRadius: 18, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  menuLabel: { color: THEME.text, fontSize: 12, fontWeight: "800", textAlign: "center" },
});