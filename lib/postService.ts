import { db } from "@/lib/firebase";
import { addDoc, collection, query, where, orderBy, getDocs } from "firebase/firestore";

export async function createPost(userId: string, content: string) {
  await addDoc(collection(db, "posts"), {
    userId,
    content,
    createdAt: Date.now(),
  });
}

export async function getUserPosts(userId: string) {
  const q = query(
    collection(db, "posts"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}