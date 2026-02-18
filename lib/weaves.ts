// 🔥 FULL STABLE WEAVES SERVICE — SYSTEM CONTRACT
import { db, auth } from "./firebase";
import { 
  doc, collection, setDoc, updateDoc, getDoc, // 👈 Added getDoc
  increment, serverTimestamp, writeBatch 
} from "firebase/firestore";

/**
 * Likes a Weave or Publication.
 * Updates the content's likeCount AND the author's totalLikesReceived.
 */
export const handleLike = async (
  contentId: string, 
  authorId: string, 
  isLiking: boolean, 
  collectionName: 'weaves' | 'publications' | 'books'
) => {
  const user = auth.currentUser;
  if (!user) return;

  const batch = writeBatch(db);
  const contentRef = doc(db, collectionName, contentId);
  const authorRef = doc(db, "users", authorId);
  const userLikeRef = doc(db, collectionName, contentId, "likes", user.uid);

  if (isLiking) {
    batch.set(userLikeRef, { uid: user.uid, createdAt: serverTimestamp() });
    batch.update(contentRef, { likeCount: increment(1) });
    batch.update(authorRef, { totalLikesReceived: increment(1) });
  } else {
    batch.delete(userLikeRef);
    batch.update(contentRef, { likeCount: increment(-1) });
    batch.update(authorRef, { totalLikesReceived: increment(-1) });
  }

  await batch.commit();
};

/**
 * Adds a comment.
 * Updates commentCount on content AND totalCommentsReceived on Author's profile.
 */
export const postComment = async (
  contentId: string, 
  authorId: string, 
  text: string, 
  type: 'weaves' | 'publications' | 'books'
) => {
  const user = auth.currentUser;
  if (!user) return;

  // 1. Get the current user's legal name for the comment
  const userSnap = await getDoc(doc(db, "users", user.uid));
  const fullName = userSnap.data()?.fullName || "A Weaver";

  const batch = writeBatch(db);
  const commentRef = doc(collection(db, "comments"));
  const contentRef = doc(db, type, contentId);
  const authorProfileRef = doc(db, "users", authorId);

  // 2. Set the comment data
  batch.set(commentRef, {
    id: commentRef.id,
    refId: contentId,
    refType: type,
    authorId: user.uid,
    authorName: fullName,
    text: text.trim(),
    createdAt: serverTimestamp()
  });

  // 3. Increment counters across the system
  batch.update(contentRef, { commentCount: increment(1) });
  batch.update(authorProfileRef, { totalCommentsReceived: increment(1) });

  await batch.commit();
};