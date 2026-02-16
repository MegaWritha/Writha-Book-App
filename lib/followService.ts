import { db } from "@/lib/firebase";
import { doc, setDoc, deleteDoc, getDocs, collection } from "firebase/firestore";

export async function followUser(currentId: string, targetId: string) {
  await setDoc(doc(db, "following", currentId, "users", targetId), { createdAt: Date.now() });
  await setDoc(doc(db, "followers", targetId, "users", currentId), { createdAt: Date.now() });
}

export async function unfollowUser(currentId: string, targetId: string) {
  await deleteDoc(doc(db, "following", currentId, "users", targetId));
  await deleteDoc(doc(db, "followers", targetId, "users", currentId));
}

export async function getFollowers(uid: string) {
  const snap = await getDocs(collection(db, "followers", uid, "users"));
  return snap.docs.map(d => d.id);
}

export async function getFollowing(uid: string) {
  const snap = await getDocs(collection(db, "following", uid, "users"));
  return snap.docs.map(d => d.id);
}