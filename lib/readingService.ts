import { db } from "@/lib/firebase";
import { doc, setDoc, getDocs, collection } from "firebase/firestore";

export async function markBookRead(uid: string, bookId: string) {
  await setDoc(doc(db, "readingHistory", uid, "books", bookId), {
    readAt: Date.now(),
  });
}

export async function getBooksReadCount(uid: string) {
  const snap = await getDocs(collection(db, "readingHistory", uid, "books"));
  return snap.size;
}