import { db, auth } from "./firebase";
import { 
  doc, getDoc, setDoc, updateDoc, deleteDoc, 
  writeBatch, increment, serverTimestamp, 
  collection, query, where, getDocs 
} from "firebase/firestore";

export interface FriendRequest {
  fromId: string;
  fromName: string;
  status: 'pending' | 'accepted';
  sentAt: any;
}

/**
 * Sends a friend request to another user's inbox.
 */
export const sendFriendRequest = async (targetUserId: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Auth required");
  if (user.uid === targetUserId) throw new Error("Self-friending is not permitted.");

  // Check if they are already friends
  const friendCheck = await getDoc(doc(db, "users", user.uid, "friends", targetUserId));
  if (friendCheck.exists()) throw new Error("You are already friends.");

  const myDoc = await getDoc(doc(db, "users", user.uid));
  const myName = myDoc.data()?.fullName || "A Weaver";

  const requestRef = doc(db, "users", targetUserId, "friendRequests", user.uid);
  
  await setDoc(requestRef, {
    fromId: user.uid,
    fromName: myName,
    status: "pending",
    sentAt: serverTimestamp(),
  });
};

/**
 * Accepts a request. 
 * Creates bidirectional links and increments 'friendCount' for both users.
 */
export const acceptFriendRequest = async (requestingUserId: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Auth required");

  const batch = writeBatch(db);

  // Connection references
  const myFriendRef = doc(db, "users", user.uid, "friends", requestingUserId);
  const theirFriendRef = doc(db, "users", requestingUserId, "friends", user.uid);
  const requestRef = doc(db, "users", user.uid, "friendRequests", requestingUserId);

  // Profile references for counters
  const myProfileRef = doc(db, "users", user.uid);
  const theirProfileRef = doc(db, "users", requestingUserId);

  batch.set(myFriendRef, { since: serverTimestamp(), uid: requestingUserId });
  batch.set(theirFriendRef, { since: serverTimestamp(), uid: user.uid });
  batch.delete(requestRef);

  // Atomic increments on the Flat Schema
  batch.update(myProfileRef, { friendCount: increment(1) });
  batch.update(theirProfileRef, { friendCount: increment(1) });

  await batch.commit();
};

/**
 * Chat Guard: Determines if the 'Message' button should be active.
 */
export const checkChatPermission = async (targetUserId: string): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) return false;

  // 1. Check Friends (Two-way)
  const isFriend = await getDoc(doc(db, "users", user.uid, "friends", targetUserId));
  if (isFriend.exists()) return true;

  // 2. Check Mutual Following (One-way x2)
  const iFollowThem = await getDoc(doc(db, "users", user.uid, "following", targetUserId));
  const theyFollowMe = await getDoc(doc(db, "users", targetUserId, "following", user.uid));

  return iFollowThem.exists() && theyFollowMe.exists();
};