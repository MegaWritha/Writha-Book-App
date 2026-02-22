import React, { useEffect, useState } from "react";
import { TouchableOpacity, Text, StyleSheet, View, ActivityIndicator } from "react-native";
import { auth, db } from "@/lib/firebase";
import {
  doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, increment, updateDoc
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

export default function FollowButton({ targetUserId }: { targetUserId: string }) {
  const currentUser = auth.currentUser;
  const currentUserId = currentUser?.uid;
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) return;

    // ✅ FIX: was "followbutton/list/targetUserId" (5 segments - WRONG)
    // Now correctly: "users/uid/following/targetUserId" (4 segments - CORRECT)
    const followRef = doc(db, "users", currentUserId, "following", targetUserId);

    const unsub = onSnapshot(followRef, (snap) => {
      setIsFollowing(snap.exists());
    });

    return () => unsub();
  }, [targetUserId, currentUserId]);

  const toggleFollow = async () => {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) return;
    setLoading(true);

    // ✅ FIX: All paths now use correct 4-segment structure
    const myFollowingRef = doc(db, "users", currentUserId, "following", targetUserId);
    const theirFollowersRef = doc(db, "users", targetUserId, "followers", currentUserId);
    const myProfileRef = doc(db, "users", currentUserId);
    const theirProfileRef = doc(db, "users", targetUserId);

    try {
      if (isFollowing) {
        // UNFOLLOW
        await deleteDoc(myFollowingRef);
        await deleteDoc(theirFollowersRef);

        // Decrement counts
        await updateDoc(myProfileRef, { followingCount: increment(-1) });
        await updateDoc(theirProfileRef, { followersCount: increment(-1) });
      } else {
        // FOLLOW
        await setDoc(myFollowingRef, {
          followedAt: serverTimestamp(),
          uid: targetUserId,
        });
        await setDoc(theirFollowersRef, {
          followedAt: serverTimestamp(),
          uid: currentUserId,
        });

        // Increment counts
        await updateDoc(myProfileRef, { followingCount: increment(1) });
        await updateDoc(theirProfileRef, { followersCount: increment(1) });

        // Send notification
        const notifRef = doc(
          db,
          "users", targetUserId,
          "notifications", `${currentUserId}_follow_${Date.now()}`
        );
        await setDoc(notifRef, {
          type: "follow",
          fromId: currentUserId,
          fromUsername: currentUser?.displayName || "A Scholar",
          fromImage: currentUser?.photoURL || "",
          message: "started following you on Writha.",
          read: false,
          timestamp: serverTimestamp(),
        });
      }
    } catch (e) {
      console.error("Follow error:", e);
    } finally {
      setLoading(false);
    }
  };

  // Don't show button on own profile
  if (currentUserId === targetUserId) return null;

  return (
    <TouchableOpacity
      onPress={toggleFollow}
      activeOpacity={0.8}
      disabled={loading}
      style={[styles.btn, isFollowing ? styles.btnActive : styles.btnInactive]}
    >
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator size="small" color={isFollowing ? "#FFD700" : "#0F071A"} />
        ) : (
          <>
            <Ionicons
              name={isFollowing ? "checkmark-circle" : "person-add"}
              size={18}
              color={isFollowing ? "#FFD700" : "#0F071A"}
            />
            <Text style={[styles.text, isFollowing ? styles.textActive : styles.textInactive]}>
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 140,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  btnInactive: {
    backgroundColor: "#FFD700",
  },
  btnActive: {
    backgroundColor: "#1E1135",
    borderWidth: 1.5,
    borderColor: "#FFD700",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  text: {
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 0.5,
  },
  textInactive: {
    color: "#0F071A",
  },
  textActive: {
    color: "#FFD700",
  },
});