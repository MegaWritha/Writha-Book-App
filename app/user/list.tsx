import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, StatusBar
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { db, auth } from "@/lib/firebase";
import {
  collection, onSnapshot, doc, getDoc,
  updateDoc, increment, setDoc, deleteDoc
} from "firebase/firestore";

type UserItem = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  profilePic?: string;
  bio?: string;
  isFollowing?: boolean;
};

export default function UserListScreen() {
  const router = useRouter();
  const { type, uid } = useLocalSearchParams<{ type: string; uid: string }>();
  const currentUser = auth.currentUser;

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  const isFollowers = type === "followers";
  const title = isFollowers ? "Followers" : "Following";

  // Get current user's following list
  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(
      collection(db, "users", currentUser.uid, "following"),
      (snap) => setFollowingIds(snap.docs.map(d => d.id))
    );
    return () => unsub();
  }, [currentUser]);

  // Get followers or following list
  useEffect(() => {
    if (!uid) return;
    const subCol = isFollowers ? "followers" : "following";
    const unsub = onSnapshot(collection(db, "users", uid, subCol), async (snap) => {
      const ids = snap.docs.map(d => d.id);
      const userDetails = await Promise.all(
        ids.map(async (id) => {
          const userSnap = await getDoc(doc(db, "users", id));
          if (userSnap.exists()) return { id, ...userSnap.data() } as UserItem;
          return null;
        })
      );
      setUsers(userDetails.filter(u => u !== null) as UserItem[]);
      setLoading(false);
    });
    return () => unsub();
  }, [uid, type]);

  const handleFollow = async (targetId: string) => {
    if (!currentUser || targetId === currentUser.uid) return;
    const isFollowing = followingIds.includes(targetId);
    const followRef = doc(db, "users", currentUser.uid, "following", targetId);
    const followerRef = doc(db, "users", targetId, "followers", currentUser.uid);

    if (isFollowing) {
      await deleteDoc(followRef);
      await deleteDoc(followerRef);
      await updateDoc(doc(db, "users", currentUser.uid), { followingCount: increment(-1) });
      await updateDoc(doc(db, "users", targetId), { followersCount: increment(-1) });
    } else {
      await setDoc(followRef, { createdAt: new Date() });
      await setDoc(followerRef, { createdAt: new Date() });
      await updateDoc(doc(db, "users", currentUser.uid), { followingCount: increment(1) });
      await updateDoc(doc(db, "users", targetId), { followersCount: increment(1) });
    }
  };

  const renderUser = ({ item }: { item: UserItem }) => {
    const isMe = item.id === currentUser?.uid;
    const isFollowing = followingIds.includes(item.id);

    return (
      <TouchableOpacity
        style={styles.userRow}
        onPress={() => router.push({ pathname: "/user/[id]", params: { id: item.id } })}
        activeOpacity={0.8}
      >
        {/* AVATAR */}
        {item.profilePic ? (
          <Image source={{ uri: item.profilePic }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarLetter}>
              {item.firstName?.[0]?.toUpperCase() || "U"}
            </Text>
          </View>
        )}

        {/* INFO */}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.firstName} {item.lastName}</Text>
          <Text style={styles.userHandle}>@{item.username || "thinker"}</Text>
          {item.bio ? (
            <Text style={styles.userBio} numberOfLines={1}>{item.bio}</Text>
          ) : null}
        </View>

        {/* FOLLOW BUTTON */}
        {!isMe && (
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followingBtn]}
            onPress={() => handleFollow(item.id)}
          >
            <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFD700" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#FFD700" />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons
            name={isFollowers ? "people-outline" : "person-add-outline"}
            size={64}
            color="#2D1B4E"
          />
          <Text style={styles.emptyTitle}>
            {isFollowers ? "No followers yet" : "Not following anyone yet"}
          </Text>
          <Text style={styles.emptySubtext}>
            {isFollowers
              ? "When people follow this account, they'll appear here."
              : "When this account follows people, they'll appear here."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F071A" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1E1135", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#FFF" },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  userRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 12 },
  separator: { height: 1, backgroundColor: "#1E1135" },
  avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: "#FFD700" },
  avatarPlaceholder: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#4C1D95", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#FFD700" },
  avatarLetter: { fontSize: 20, fontWeight: "900", color: "#FFD700" },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: "800", color: "#FFF" },
  userHandle: { color: "#A78BFA", fontSize: 13, marginTop: 2 },
  userBio: { color: "#4C1D95", fontSize: 12, marginTop: 4 },
  followBtn: { backgroundColor: "#FFD700", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  followingBtn: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#4C1D95" },
  followBtnText: { color: "#0F071A", fontWeight: "800", fontSize: 13 },
  followingBtnText: { color: "#A78BFA" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  emptyTitle: { color: "#FFF", fontSize: 18, fontWeight: "800", marginTop: 20, textAlign: "center" },
  emptySubtext: { color: "#4C1D95", fontSize: 14, marginTop: 10, textAlign: "center", lineHeight: 22 },
});