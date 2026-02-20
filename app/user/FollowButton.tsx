import React, { useEffect, useState } from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";

export default function FollowButton({ targetUserId }: { targetUserId: string }) {
  const currentUser = auth.currentUser?.uid;
  const [isFollowing, setIsFollowing] = useState(false);

  // Use onSnapshot instead of getDoc so the button 
  // updates instantly if you follow on another device
  useEffect(() => {
    if (!currentUser || !targetUserId) return;

    const followRef = doc(db, "users", currentUser, "followbutton", "list", targetUserId);
    
    return onSnapshot(followRef, (doc) => {
      setIsFollowing(doc.exists());
    });
  }, [targetUserId]);

  const toggleFollow = async () => {
    if (!currentUser || !targetUserId) return;

    // PATHS MUST MATCH SOCIALSCREEN
    const myFollowingRef = doc(db, "users", currentUser, "followbutton", "list", targetUserId);
    const theirFollowersRef = doc(db, "users", targetUserId, "followers", "list", currentUser);

    if (isFollowing) {
      await deleteDoc(myFollowingRef);
      await deleteDoc(theirFollowersRef);
    } else {
      // We save minimal info here. The SocialScreen will fetch the full profile.
      await setDoc(myFollowingRef, { 
        followedAt: new Date(),
        uid: targetUserId 
      });
      await setDoc(theirFollowersRef, { 
        followedAt: new Date(),
        uid: currentUser 
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
    backgroundColor: "#FFD700", // Your Theme Gold
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnActive: {
    backgroundColor: "#1E1135", // Darker UI color when following
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