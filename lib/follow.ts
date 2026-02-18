import { db, auth } from "./firebase";
import { doc, getDoc, writeBatch, increment, serverTimestamp } from "firebase/firestore";

/**
 * Toggles the follow state.
 * Uses atomic increments to prevent the "NaN" or "Desync" bugs.
 */
export const toggleFollow = async (targetUserId: string, isCurrentlyFollowing: boolean) => {
  const user = auth.currentUser;
  if (!user || user.uid === targetUserId) return;

  const batch = writeBatch(db);

  const myFollowingRef = doc(db, "users", user.uid, "following", targetUserId);
  const theirFollowersRef = doc(db, "users", targetUserId, "followers", user.uid);
  const myProfile = doc(db, "users", user.uid);
  const theirProfile = doc(db, "users", targetUserId);

  if (isCurrentlyFollowing) {
    batch.delete(myFollowingRef);
    batch.delete(theirFollowersRef);
    batch.update(myProfile, { followingCount: increment(-1) });
    batch.update(theirProfile, { followerCount: increment(-1) });
  } else {
    batch.set(myFollowingRef, { timestamp: serverTimestamp() });
    batch.set(theirFollowersRef, { timestamp: serverTimestamp() });
    batch.update(myProfile, { followingCount: increment(1) });
    batch.update(theirProfile, { followerCount: increment(1) });
  }

  await batch.commit();
};