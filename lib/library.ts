// 🔥 FULL STABLE LIBRARY SERVICE — SYSTEM CONTRACT
import { db, auth } from "@/lib/firebase";
import { 
  doc, setDoc, updateDoc, deleteDoc, getDoc, 
  serverTimestamp, increment 
} from "firebase/firestore";

/**
 * USER ACTION: Explicitly add an approved book/publication to their personal library.
 */
export const addToLibrary = async (itemId: string, itemTitle: string, authorName: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required.");

  const libraryRef = doc(db, "users", user.uid, "library", itemId);
  
  // Check if already in library to prevent overwrite
  const snap = await getDoc(libraryRef);
  if (snap.exists()) throw new Error("Item is already in your library.");

  await setDoc(libraryRef, {
    itemId: itemId,
    title: itemTitle,
    authorName: authorName,
    status: "reading", // "reading" | "completed"
    progress: 0,
    addedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return true;
};

/**
 * USER ACTION: Update reading progress. 
 * If marked as completed, it atomically increments the 'booksRead' counter on their profile.
 */
export const updateReadingProgress = async (itemId: string, progressPercentage: number, isCompleted: boolean = false) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required.");

  const libraryRef = doc(db, "users", user.uid, "library", itemId);
  const librarySnap = await getDoc(libraryRef);

  if (!librarySnap.exists()) throw new Error("Item not found in library.");
  const currentData = librarySnap.data();

  const updates: any = {
    progress: progressPercentage,
    updatedAt: serverTimestamp(),
  };

  // If newly completed, update status and increment profile counter
  if (isCompleted && currentData.status !== "completed") {
    updates.status = "completed";
    updates.completedAt = serverTimestamp();
    
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      booksRead: increment(1) // Atomic Counter
    });
  }

  await updateDoc(libraryRef, updates);
};

/**
 * USER ACTION: Remove an item from the library.
 */
export const removeFromLibrary = async (itemId: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required.");

  const libraryRef = doc(db, "users", user.uid, "library", itemId);
  await deleteDoc(libraryRef);
};

/**
 * UTILITY: Check if an item is in the user's library (useful for UI button toggles).
 */
export const checkLibraryStatus = async (itemId: string) => {
  const user = auth.currentUser;
  if (!user) return false;

  const libraryRef = doc(db, "users", user.uid, "library", itemId);
  const snap = await getDoc(libraryRef);
  
  return snap.exists();
};