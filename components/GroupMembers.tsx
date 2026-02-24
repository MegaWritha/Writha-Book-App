import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image, Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { db, auth } from "../lib/firebase";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#000000", surface: "#0A0A0A", accent: "#D4AF37",
  purple: "#8E2DE2", text: "#FFFFFF", textMuted: "#666666",
  border: "#1A1A1A",
};

const ROLE_COLORS: Record<string, string> = {
  analyst:   "#D4AF37",
  narrator:  "#3B82F6",
  critic:    "#EC4899",
  historian: "#10B981",
  connector: "#F59E0B",
  editor:    "#8E2DE2",
  member:    "#666666",
};

interface MemberProfile {
  uid: string;
  name: string;
  photo: string | null;
  role: string;
  isOwner: boolean;
  isAI?: boolean;
}

export default function GroupMembers({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupData, setGroupData] = useState<any>(null);

  useEffect(() => {
    if (!groupId) return;

    // Listen to the GROUP DOCUMENT — members are stored as an array here
    const unsub = onSnapshot(doc(db, "groups", groupId), async (snap) => {
      if (!snap.exists()) {
        setLoading(false);
        return;
      }

      const data = snap.data() as any;
      setGroupData(data);

      const memberIds: string[] = data.members || [];
      const memberRoles: Record<string, string> = data.memberRoles || {};
      const ownerId: string = data.createdBy || "";
      const hasAI: boolean = data.hasAI || false;

      // Fetch each member's user profile from /users collection
      const profiles: MemberProfile[] = await Promise.all(
        memberIds.map(async (uid) => {
          try {
            const userSnap = await getDoc(doc(db, "users", uid));
            if (userSnap.exists()) {
              const u = userSnap.data() as any;
              return {
                uid,
                name: u.displayName || u.name || "Scholar",
                photo: u.photoURL || u.photo || null,
                role: memberRoles[uid] || "member",
                isOwner: uid === ownerId,
              };
            }
          } catch (_) {}
          return {
            uid,
            name: "Scholar",
            photo: null,
            role: memberRoles[uid] || "member",
            isOwner: uid === ownerId,
          };
        })
      );

      // Add AI Scholar as a virtual member if enabled
      if (hasAI) {
        profiles.unshift({
          uid: "AI_SCHOLAR",
          name: "AI Scholar",
          photo: null,
          role: "ai",
          isOwner: false,
          isAI: true,
        });
      }

      // Sort: owner first, then AI, then rest
      profiles.sort((a, b) => {
        if (a.isOwner) return -1;
        if (b.isOwner) return 1;
        if (a.isAI) return -1;
        if (b.isAI) return 1;
        return 0;
      });

      setMembers(profiles);
      setLoading(false);
    });

    return unsub;
  }, [groupId]);

  const currentUid = auth.currentUser?.uid;

  const renderMember = ({ item }: { item: MemberProfile }) => {
    const roleColor = item.isAI ? THEME.accent : (ROLE_COLORS[item.role] || THEME.textMuted);
    const isMe = item.uid === currentUid;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          if (!item.isAI) {
            router.push({ pathname: "/user/[id]", params: { id: item.uid } } as any);
          }
        }}
        activeOpacity={item.isAI ? 1 : 0.7}
      >
        {/* Avatar */}
        {item.isAI ? (
          <View style={styles.aiAvatar}>
            <MaterialCommunityIcons name="brain" size={22} color="#000" />
          </View>
        ) : item.photo ? (
          <Image source={{ uri: item.photo }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: roleColor + "30", borderColor: roleColor + "60" }]}>
            <Text style={[styles.avatarLetter, { color: roleColor }]}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.name}</Text>
            {isMe && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>YOU</Text>
              </View>
            )}
            {item.isOwner && (
              <View style={styles.ownerBadge}>
                <Ionicons name="shield-checkmark" size={10} color={THEME.accent} />
                <Text style={styles.ownerText}>OWNER</Text>
              </View>
            )}
          </View>
          <View style={[styles.rolePill, { borderColor: roleColor + "40", backgroundColor: roleColor + "10" }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>
              {item.isAI ? "AI SCHOLAR" : item.role.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Chevron */}
        {!item.isAI && (
          <Ionicons name="chevron-forward" size={16} color="#333" />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={THEME.accent} size="large" />
        <Text style={styles.loadingText}>SUMMONING WEAVERS...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>ACTIVE WEAVERS</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{members.length}</Text>
        </View>
      </View>

      {/* Join requests banner for owner */}
      {groupData?.joinRequests?.length > 0 && groupData?.createdBy === currentUid && (
        <TouchableOpacity style={styles.requestsBanner}>
          <Ionicons name="time-outline" size={16} color={THEME.accent} />
          <Text style={styles.requestsText}>
            {groupData.joinRequests.length} pending join {groupData.joinRequests.length === 1 ? "request" : "requests"}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={THEME.accent} />
        </TouchableOpacity>
      )}

      <FlatList
        data={members}
        keyExtractor={(item) => item.uid}
        renderItem={renderMember}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="molecule" size={40} color="#1A1A1A" />
            <Text style={styles.emptyTitle}>NO WEAVERS YET</Text>
            <Text style={styles.emptySub}>Share this group so others can join the loom.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
  loadingText: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 3 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 },
  title: { color: "#444", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  countBadge: { backgroundColor: THEME.surface, borderWidth: 1, borderColor: THEME.border, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  countText: { color: THEME.accent, fontSize: 11, fontWeight: "900" },

  requestsBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: "#0D0A00", borderWidth: 1,
    borderColor: THEME.accent + "40", padding: 14, borderRadius: 14,
  },
  requestsText: { flex: 1, color: THEME.accent, fontSize: 12, fontWeight: "700" },

  list: { paddingHorizontal: 20, paddingBottom: 40 },

  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: THEME.surface, padding: 16,
    borderRadius: 18, marginBottom: 10,
    borderWidth: 1, borderColor: THEME.border, gap: 14,
  },
  avatar: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, borderColor: "#222", justifyContent: "center", alignItems: "center" },
  avatarLetter: { fontSize: 20, fontWeight: "900" },
  aiAvatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: THEME.accent, justifyContent: "center", alignItems: "center" },

  info: { flex: 1, gap: 6 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  name: { color: THEME.text, fontWeight: "800", fontSize: 15 },
  youBadge: { backgroundColor: "#1A1A1A", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: "#333" },
  youBadgeText: { color: "#666", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  ownerBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#0D0A00", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: THEME.accent + "40" },
  ownerText: { color: THEME.accent, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  rolePill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  roleText: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },

  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { color: "#333", fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  emptySub: { color: "#222", fontSize: 12, textAlign: "center", lineHeight: 18 },
});