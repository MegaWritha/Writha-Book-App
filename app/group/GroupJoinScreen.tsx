import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Dimensions, StatusBar, ActivityIndicator, Alert, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  doc, updateDoc, arrayUnion, addDoc, collection,
  serverTimestamp, onSnapshot,
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

const THEME = {
  bg: "#000000", surface: "#0A0A0A", accent: "#D4AF37",
  purple: "#8E2DE2", text: "#FFFFFF", textMuted: "#666666",
  border: "#1A1A1A", success: "#22C55E", danger: "#FF3B30",
};

const GROUP_TYPE_META: Record<string, { label: string; color: string }> = {
  critique:   { label: "Literary Critique",  color: "#D4AF37" },
  study:      { label: "Study Circle",       color: "#8E2DE2" },
  discussion: { label: "Open Discussion",    color: "#3B82F6" },
  research:   { label: "Research Weave",     color: "#10B981" },
  reading:    { label: "Reading Group",      color: "#F59E0B" },
  book_club:  { label: "Book Club",          color: "#EC4899" },
};

const ROLE_OPTIONS = [
  { id: "analyst",   label: "Analyst",   icon: "analytics-outline",    desc: "Dissects themes & structure" },
  { id: "narrator",  label: "Narrator",  icon: "mic-outline",           desc: "Covers voice & storytelling" },
  { id: "critic",    label: "Critic",    icon: "eyedrop-outline",       desc: "Evaluates craft & writing" },
  { id: "historian", label: "Historian", icon: "time-outline",          desc: "Provides historical context" },
  { id: "connector", label: "Connector", icon: "git-network-outline",   desc: "Links themes across works" },
  { id: "editor",    label: "Editor",    icon: "create-outline",        desc: "Refines the group output" },
];

export default function GroupJoinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [groupData, setGroupData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [step, setStep] = useState<"preview" | "role" | "done">("preview");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "groups", id), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as any;
        setGroupData(data);
        const uid = auth.currentUser?.uid;
        if (uid && data.members?.includes(uid)) setAlreadyMember(true);
        if (uid && data.joinRequests?.includes(uid)) setRequestSent(true);
      }
      setLoading(false);
    });
    return unsub;
  }, [id]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handlePublicJoin = async () => {
    if (!selectedRole) {
      Alert.alert("CHOOSE A ROLE", "Select your role before entering the weave.");
      return;
    }
    if (!auth.currentUser || !groupData) return;
    setJoining(true);
    try {
      const uid = auth.currentUser.uid;
      await updateDoc(doc(db, "groups", id), {
        members: arrayUnion(uid),
        [`memberRoles.${uid}`]: selectedRole,
      });
      await addDoc(collection(db, "groups", id, "messages"), {
        text: `📖 ${auth.currentUser.displayName || "A new scholar"} joined as ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}.`,
        senderId: "SYSTEM",
        senderName: "THE ARCHIVE",
        createdAt: serverTimestamp(),
        type: "weave-alert",
      });
      setStep("done");
      Animated.spring(successScale, { toValue: 1, useNativeDriver: true, tension: 80 }).start();
    } catch (e) {
      Alert.alert("JOIN FAILED", "The loom rejected the request. Check your connection.");
    } finally {
      setJoining(false);
    }
  };

  const handlePrivateRequest = async () => {
    if (!auth.currentUser || !groupData) return;
    setJoining(true);
    try {
      const uid = auth.currentUser.uid;
      await updateDoc(doc(db, "groups", id), { joinRequests: arrayUnion(uid) });
      await addDoc(collection(db, "notifications"), {
        recipientId: groupData.createdBy,
        type: "join_request",
        groupId: id,
        groupName: groupData.name,
        requesterId: uid,
        requesterName: auth.currentUser.displayName,
        createdAt: serverTimestamp(),
        read: false,
      });
      setRequestSent(true);
    } catch (e) {
      Alert.alert("REQUEST FAILED", "Could not send request. Try again.");
    } finally {
      setJoining(false);
    }
  };

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.14] });
  const typeMeta = GROUP_TYPE_META[groupData?.type] || { label: groupData?.type?.toUpperCase(), color: THEME.accent };
  const memberCount = groupData?.members?.length || 0;
  const isPrivate = groupData?.visibility === "private";

  if (loading) {
    return (
      <View style={styles.stateScreen}>
        <ActivityIndicator size="large" color={THEME.accent} />
        <Text style={styles.stateText}>READING THE LOOM...</Text>
      </View>
    );
  }

  if (!groupData) {
    return (
      <View style={styles.stateScreen}>
        <Text style={styles.errorText}>VOID: WEAVE NOT FOUND</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backAction}>
          <Text style={styles.backActionText}>RETURN</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- DONE STATE ---
  if (step === "done") {
    return (
      <View style={styles.stateScreen}>
        <Animated.View style={[styles.successRing, { transform: [{ scale: successScale }] }]}>
          <View style={styles.successInner}>
            <Ionicons name="checkmark" size={48} color={THEME.accent} />
          </View>
        </Animated.View>
        <Text style={styles.successTitle}>YOU'VE ENTERED{"\n"}THE WEAVE</Text>
        <Text style={styles.successSub}>
          You joined as{" "}
          <Text style={{ color: THEME.accent, fontWeight: "900" }}>
            {selectedRole?.toUpperCase()}
          </Text>
        </Text>
        <TouchableOpacity
          style={styles.enterBtn}
          onPress={() => router.replace(`/groups/${id}`)}
        >
          <Text style={styles.enterBtnText}>ENTER THE LOOM</Text>
          <Ionicons name="arrow-forward" size={18} color="#000" />
        </TouchableOpacity>
      </View>
    );
  }

  // --- ROLE SELECTION ---
  if (step === "role") {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.glowBg} />

        <TouchableOpacity style={styles.topBack} onPress={() => setStep("preview")}>
          <Ionicons name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.roleScroll} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={styles.roleTitle}>CHOOSE YOUR ROLE</Text>
            <Text style={styles.roleSub}>
              Your role determines your contribution to the weave. You can request a change later.
            </Text>

            <View style={styles.rolesGrid}>
              {ROLE_OPTIONS.map((role) => {
                const active = selectedRole === role.id;
                return (
                  <TouchableOpacity
                    key={role.id}
                    style={[styles.roleCard, active && styles.roleCardActive]}
                    onPress={() => setSelectedRole(role.id)}
                  >
                    <View style={[styles.roleIconCircle, active && { backgroundColor: THEME.accent }]}>
                      <Ionicons
                        name={role.icon as any}
                        size={22}
                        color={active ? "#000" : THEME.textMuted}
                      />
                    </View>
                    <Text style={[styles.roleLabel, active && { color: THEME.accent }]}>{role.label}</Text>
                    <Text style={styles.roleDesc}>{role.desc}</Text>
                    {active && (
                      <View style={styles.roleCheck}>
                        <Ionicons name="checkmark-circle" size={18} color={THEME.accent} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.confirmJoinBtn, !selectedRole && { opacity: 0.4 }]}
              onPress={handlePublicJoin}
              disabled={!selectedRole || joining}
            >
              {joining ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Text style={styles.confirmJoinText}>ENTER THE WEAVE</Text>
                  <Ionicons name="arrow-forward" size={18} color="#000" />
                </>
              )}
            </TouchableOpacity>
            <View style={{ height: 60 }} />
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  // --- PREVIEW STATE (default) ---
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background glow */}
      <Animated.View style={[styles.glowBgAnimated, { opacity: glowOpacity }]} />

      <TouchableOpacity style={styles.topBack} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color="#FFF" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Group Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarGoldRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{groupData.name?.charAt(0).toUpperCase()}</Text>
              </View>
            </View>

            {/* Visibility badge */}
            <View style={[styles.visibilityBadge, isPrivate && { backgroundColor: "#1A0A2E", borderColor: THEME.purple }]}>
              <Ionicons
                name={isPrivate ? "lock-closed" : "earth"}
                size={11}
                color={isPrivate ? THEME.purple : THEME.success}
              />
              <Text style={[styles.visibilityText, { color: isPrivate ? THEME.purple : THEME.success }]}>
                {isPrivate ? "PRIVATE" : "PUBLIC"}
              </Text>
            </View>
          </View>

          {/* Name & Type */}
          <Text style={styles.groupName}>{groupData.name}</Text>
          <View style={[styles.typeTag, { borderColor: typeMeta.color + "50" }]}>
            <Text style={[styles.typeTagText, { color: typeMeta.color }]}>#{typeMeta.label?.toUpperCase()}</Text>
          </View>

          {/* Bio */}
          {groupData.bio ? (
            <Text style={styles.bio}>{groupData.bio}</Text>
          ) : null}

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="molecule" size={18} color={THEME.accent} />
              <Text style={styles.statNum}>{memberCount}</Text>
              <Text style={styles.statLabel}>SCHOLARS</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="book-outline" size={18} color={THEME.purple} />
              <Text style={styles.statNum}>{groupData.phases?.length || "—"}</Text>
              <Text style={styles.statLabel}>PHASES</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="layers-outline" size={18} color={THEME.textMuted} />
              <Text style={styles.statNum}>{groupData.type?.toUpperCase() || "—"}</Text>
              <Text style={[styles.statLabel, { fontSize: 7 }]}>TYPE</Text>
            </View>
          </View>

          {/* Book info if present */}
          {groupData.bookTitle && (
            <View style={styles.bookCard}>
              <Ionicons name="book" size={20} color={THEME.accent} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.bookCardLabel}>STUDYING</Text>
                <Text style={styles.bookCardTitle}>{groupData.bookTitle}</Text>
                {groupData.bookAuthor && (
                  <Text style={styles.bookCardAuthor}>by {groupData.bookAuthor}</Text>
                )}
              </View>
            </View>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* --- CTA SECTION --- */}
          {alreadyMember ? (
            <View>
              <View style={styles.alreadyBadge}>
                <Ionicons name="checkmark-circle" size={18} color={THEME.success} />
                <Text style={styles.alreadyText}>YOU ARE ALREADY A MEMBER</Text>
              </View>
              <TouchableOpacity style={styles.enterBtn} onPress={() => router.replace(`/groups/${id}`)}>
                <Text style={styles.enterBtnText}>OPEN THE LOOM</Text>
                <Ionicons name="arrow-forward" size={18} color="#000" />
              </TouchableOpacity>
            </View>

          ) : isPrivate ? (
            <View>
              <View style={styles.privateNotice}>
                <Ionicons name="lock-closed" size={20} color={THEME.purple} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.privateTitle}>PRIVATE WEAVE</Text>
                  <Text style={styles.privateSub}>
                    This group is invite-only. You can request access and the group owner will be notified.
                  </Text>
                </View>
              </View>

              {requestSent ? (
                <View style={styles.requestSentBadge}>
                  <Ionicons name="time-outline" size={16} color={THEME.accent} />
                  <Text style={styles.requestSentText}>REQUEST PENDING — AWAITING APPROVAL</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.requestBtn}
                  onPress={handlePrivateRequest}
                  disabled={joining}
                >
                  {joining ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="paper-plane-outline" size={18} color="#FFF" />
                      <Text style={styles.requestBtnText}>REQUEST TO JOIN</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

          ) : (
            <View>
              <View style={styles.publicNotice}>
                <Ionicons name="earth" size={18} color={THEME.success} />
                <Text style={styles.publicNoticeText}>
                  This is an open weave. Choose a role and enter.
                </Text>
              </View>
              <TouchableOpacity style={styles.joinBtn} onPress={() => setStep("role")}>
                <Text style={styles.joinBtnText}>JOIN THIS WEAVE</Text>
                <Ionicons name="arrow-forward" size={18} color="#000" />
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 60 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  stateScreen: { flex: 1, backgroundColor: THEME.bg, justifyContent: "center", alignItems: "center", padding: 30 },
  stateText: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 3, marginTop: 20 },
  errorText: { color: THEME.purple, fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  backAction: { marginTop: 25, borderWidth: 1, borderColor: "#222", paddingHorizontal: 30, paddingVertical: 12, borderRadius: 12 },
  backActionText: { color: "#FFF", fontWeight: "900", letterSpacing: 2, fontSize: 11 },

  glowBg: { position: "absolute", top: -60, alignSelf: "center", width: 300, height: 300, borderRadius: 150, backgroundColor: THEME.purple, opacity: 0.08 },
  glowBgAnimated: { position: "absolute", top: -80, alignSelf: "center", width: 400, height: 400, borderRadius: 200, backgroundColor: THEME.purple },

  topBack: { position: "absolute", top: Platform.OS === "ios" ? 56 : 40, left: 20, zIndex: 20 },

  scroll: { paddingTop: 110, paddingHorizontal: 24, paddingBottom: 40 },

  avatarSection: { alignItems: "center", marginBottom: 20 },
  avatarGoldRing: { padding: 3, backgroundColor: THEME.accent, borderRadius: 36, marginBottom: 12 },
  avatar: { width: 90, height: 90, borderRadius: 30, backgroundColor: "#0A0A0A", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#000" },
  avatarText: { color: THEME.accent, fontSize: 38, fontWeight: "900" },
  visibilityBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: THEME.success + "40", backgroundColor: "#001A0A" },
  visibilityText: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },

  groupName: { fontSize: 30, fontWeight: "900", color: THEME.text, textAlign: "center", letterSpacing: -0.5 },
  typeTag: { alignSelf: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 5, marginTop: 10 },
  typeTagText: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  bio: { marginTop: 18, color: "#888", textAlign: "center", fontSize: 14, lineHeight: 22 },

  statsRow: { flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 28 },
  statCard: { backgroundColor: THEME.surface, padding: 16, borderRadius: 18, alignItems: "center", minWidth: 90, borderWidth: 1, borderColor: "#1A1A1A", gap: 4 },
  statNum: { color: "#FFF", fontWeight: "900", fontSize: 16, marginTop: 4 },
  statLabel: { color: THEME.textMuted, fontSize: 8, fontWeight: "900", letterSpacing: 1 },

  bookCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#0A0A0A", borderRadius: 18, padding: 18, marginTop: 24, borderWidth: 1, borderColor: THEME.accent + "30" },
  bookCardLabel: { color: THEME.accent, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  bookCardTitle: { color: "#FFF", fontWeight: "800", fontSize: 16, marginTop: 2 },
  bookCardAuthor: { color: "#666", fontSize: 12, marginTop: 2 },

  divider: { height: 1, backgroundColor: "#111", marginVertical: 28 },

  alreadyBadge: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#001A0A", padding: 16, borderRadius: 14, borderWidth: 1, borderColor: "#22C55E30", marginBottom: 16 },
  alreadyText: { color: "#22C55E", fontWeight: "900", fontSize: 11, letterSpacing: 1 },

  privateNotice: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#0D0020", padding: 18, borderRadius: 16, borderWidth: 1, borderColor: THEME.purple + "40", marginBottom: 20 },
  privateTitle: { color: THEME.purple, fontWeight: "900", fontSize: 12, letterSpacing: 1 },
  privateSub: { color: "#666", fontSize: 12, lineHeight: 18, marginTop: 4 },

  requestSentBadge: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#0A0800", borderWidth: 1, borderColor: THEME.accent + "40", padding: 18, borderRadius: 16 },
  requestSentText: { color: THEME.accent, fontWeight: "900", fontSize: 10, letterSpacing: 1 },

  requestBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: THEME.purple, padding: 20, borderRadius: 18 },
  requestBtnText: { color: "#FFF", fontWeight: "900", fontSize: 14, letterSpacing: 1 },

  publicNotice: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 },
  publicNoticeText: { color: "#666", fontSize: 13, flex: 1, lineHeight: 18 },

  joinBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: THEME.accent, padding: 22, borderRadius: 18, shadowColor: THEME.accent, shadowOpacity: 0.25, shadowRadius: 12 },
  joinBtnText: { color: "#000", fontWeight: "900", fontSize: 15, letterSpacing: 1 },

  enterBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: THEME.accent, padding: 22, borderRadius: 18, marginTop: 16 },
  enterBtnText: { color: "#000", fontWeight: "900", fontSize: 15, letterSpacing: 1 },

  // Success screen
  successRing: { width: 130, height: 130, borderRadius: 65, borderWidth: 2, borderColor: THEME.accent + "50", justifyContent: "center", alignItems: "center", marginBottom: 30 },
  successInner: { width: 100, height: 100, borderRadius: 50, backgroundColor: THEME.accent + "15", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: THEME.accent },
  successTitle: { color: "#FFF", fontSize: 28, fontWeight: "900", textAlign: "center", lineHeight: 36, letterSpacing: -0.5 },
  successSub: { color: "#666", fontSize: 14, textAlign: "center", marginTop: 12, marginBottom: 40 },

  // Role selection
  roleScroll: { paddingTop: 100, paddingHorizontal: 24 },
  roleTitle: { color: "#FFF", fontSize: 26, fontWeight: "900", marginBottom: 10 },
  roleSub: { color: "#666", fontSize: 13, lineHeight: 20, marginBottom: 30 },
  rolesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  roleCard: { width: (width - 60) / 2, backgroundColor: THEME.surface, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "#1A1A1A" },
  roleCardActive: { borderColor: THEME.accent, backgroundColor: "#0D0A00" },
  roleIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#111", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  roleLabel: { color: "#FFF", fontWeight: "900", fontSize: 14, marginBottom: 4 },
  roleDesc: { color: "#555", fontSize: 11, lineHeight: 16 },
  roleCheck: { position: "absolute", top: 12, right: 12 },
  confirmJoinBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: THEME.accent, padding: 22, borderRadius: 18, marginTop: 28 },
  confirmJoinText: { color: "#000", fontWeight: "900", fontSize: 15, letterSpacing: 1 },
});