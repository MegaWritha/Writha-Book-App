import { db, auth } from "./firebase";
import { doc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";

export const trackReadingProgress = async (book: any, progress: number = 0) => {
  if (!auth.currentUser) return;

  const libraryRef = doc(db, "users", auth.currentUser.uid, "library", book.id);
  await setDoc(libraryRef, {
    bookId: book.id,
    title: book.title,
    authorName: book.authorName,
    cover: book.cover,
    status: "reading",
    progress: progress,
    lastAccessed: serverTimestamp(),
  }, { merge: true });
};