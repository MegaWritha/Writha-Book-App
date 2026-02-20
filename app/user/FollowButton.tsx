import React, { useEffect, useState } from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons"; // NEW: Importing icons for a premium look

export default function FollowButton({ targetUserId }: { targetUserId: string }) {
  const currentUser = auth.currentUser;
  const currentUserId = currentUser?.uid;
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!currentUserId || !targetUserId) return;

    const followRef = doc(db, "users", currentUserId, "followbutton", "list", targetUserId);
    
    const unsub = onSnapshot(followRef, (docSnap) => {
      setIsFollowing(docSnap.exists());
    });

    return () => unsub();
  }, [targetUserId, currentUserId]); // Fixed: Added currentUserId to dependencies

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

      // 2. TRIGGER NOTIFICATION FOR THE TARGET USER
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
      activeOpacity={0.8} // Makes the tap animation feel smoother
      style={[styles.btn, isFollowing ? styles.btnActive : styles.btnInactive]}
    >
      <View style={styles.contentContainer}>
        <Ionicons 
          name={isFollowing ? "checkmark-circle" : "person-add"} 
          size={18} 
          color={isFollowing ? "#FFD700" : "#0F071A"} 
        />
        <Text style={[styles.text, isFollowing ? styles.textActive : styles.textInactive]}>
          {isFollowing ? "Following" : "Follow"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25, // Creates a sleek "pill" shape
    alignItems: "center",
    justifyContent: "center",
    minWidth: 140,
    // Adds a fancy shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6, // Shadow for Android
  },
  btnInactive: {
    backgroundColor: "#FFD700", // Bright gold when they need to follow
  },
  btnActive: {
    backgroundColor: "#1E1135", // Sinks into the dark theme when following
    borderWidth: 1.5,
    borderColor: "#FFD700",
  },
  contentContainer: {
    flexDirection: "row", // Places the icon and text side-by-side
    alignItems: "center",
    justifyContent: "center",
    gap: 8, // Adds perfect spacing between the icon and the text
  },
  text: { 
    fontWeight: "900", // Makes the text extra bold and punchy
    fontSize: 15,
    letterSpacing: 0.5,
  },
  textInactive: {
    color: "#0F071A", // Dark text on the gold button
  },
  textActive: {
    color: "#FFD700", // Gold text on the dark button
  }
});