import React, { useEffect, useState } from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from "firebase/firestore";

export default function FollowButton({ targetUserId }: { targetUserId: string }) {
  const currentUser = auth.currentUser;
  const currentUserId = currentUser?.uid;
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!currentUserId || !targetUserId) return;

    const followRef = doc(db, "users", currentUserId, "followbutton", "list", targetUserId);
    
    return onSnapshot(followRef, (doc) => {
      setIsFollowing(doc.exists());
    });
  }, [targetUserId]);

  const toggleFollow = async () => {
    if (!currentUserId || !targetUserId) return;

    const myFollowingRef = doc(db, "users", currentUserId, "followbutton", "list", targetUserId);
    const theirFollowersRef = doc(db, "users", targetUserId, "followers", "list", currentUserId);

    if (isFollowing) {
      await deleteDoc(myFollowingRef);
      await deleteDoc(theirFollowersRef);
    } else {
      // 1. YOUR ORIGINAL FOLLOW LOGIC
      await setDoc(myFollowingRef, { 
        followedAt: new Date(),
        uid: targetUserId 
      });
      await setDoc(theirFollowersRef, { 
        followedAt: new Date(),
        uid: currentUserId 
      });

      // 2. NEW: TRIGGER NOTIFICATION FOR THE TARGET USER
      // This makes the bell on their Social Screen show a red badge
      const notifId = `${currentUserId}_follow_${Date.now()}`;
      const notifRef = doc(db, "users", targetUserId, "notifications", notifId);

      await setDoc(notifRef, {
        type: "follow",
        fromId: currentUserId,
        fromUsername: currentUser?.displayName || "A Scholar",
        fromImage: currentUser?.photoURL || "https://ui-avatars.com/api/?name=S",
        message: "started following your research.",
        read: false,
        timestamp: serverTimestamp(),
      });
    }
  };

  return (
    <TouchableOpacity 
      onPress={toggleFollow} 
      style={[styles.btn, isFollowing && styles.btnActive]}
    >
      <Text style={[styles.text, isFollowing && styles.textActive]}>
        {isFollowing ? "Following" : "Follow"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#FFD700", 
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnActive: {
    backgroundColor: "#1E1135", 
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  text: { 
    color: "#0F071A", 
    fontWeight: "bold",
    fontSize: 14,
  },
  textActive: {
    color: "#FFD700",
  }
});