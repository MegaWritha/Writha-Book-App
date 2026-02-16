import { db } from "@/lib/firebase";
import { 
  doc, runTransaction, serverTimestamp, getDoc 
} from "firebase/firestore";
import { useState, useEffect } from "react";

export const useSocial = (currentUserId: string, targetUserId: string) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  // 1. Check if the current user is already following the target
  useEffect(() => {
    const checkStatus = async () => {
      if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
        setLoading(false);
        return;
      }
      try {
        const followDoc = await getDoc(
          doc(db, "users", currentUserId, "following", targetUserId)
        );
        setIsFollowing(followDoc.exists());
      } catch (e) {
        console.error("Error checking follow status:", e);
      } finally {
        setLoading(false);
      }
    };
    checkStatus();
  }, [currentUserId, targetUserId]);

  // 2. The Atomic Toggle Function
  const toggleFollow = async () => {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) return;

    try {
      await runTransaction(db, async (transaction) => {
        const currentUserRef = doc(db, "users", currentUserId);
        const targetUserRef = doc(db, "users", targetUserId);
        const followingRef = doc(db, "users", currentUserId, "following", targetUserId);
        const followerRef = doc(db, "users", targetUserId, "followers", currentUserId);

        // Fetch current counts inside the transaction for absolute accuracy
        const currentUserSnap = await transaction.get(currentUserRef);
        const targetUserSnap = await transaction.get(targetUserRef);

        if (!currentUserSnap.exists() || !targetUserSnap.exists()) {
          throw "User does not exist!";
        }

        const currentFollowingCount = currentUserSnap.data().followingCount || 0;
        const currentFollowersCount = targetUserSnap.data().followersCount || 0;

        if (!isFollowing) {
          // FOLLOW LOGIC
          transaction.set(followingRef, { createdAt: serverTimestamp() });
          transaction.set(followerRef, { createdAt: serverTimestamp() });
          transaction.update(currentUserRef, { followingCount: currentFollowingCount + 1 });
          transaction.update(targetUserRef, { followersCount: currentFollowersCount + 1 });
        } else {
          // UNFOLLOW LOGIC
          transaction.delete(followingRef);
          transaction.delete(followerRef);
          transaction.update(currentUserRef, { followingCount: Math.max(0, currentFollowingCount - 1) });
          transaction.update(targetUserRef, { followersCount: Math.max(0, currentFollowersCount - 1) });
        }
      });

      setIsFollowing(!isFollowing);
    } catch (e) {
      console.error("Social Transaction Failed:", e);
      throw e; // Re-throw so the UI can handle the error if needed
    }
  };

  return { isFollowing, toggleFollow, loading };
};