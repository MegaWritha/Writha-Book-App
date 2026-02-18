// 🔥 FULL STABLE SUBMISSIONS SERVICE — SYSTEM CONTRACT
import { db, auth } from "@/lib/firebase";
import { 
  collection, doc, getDoc, setDoc, updateDoc, 
  serverTimestamp, writeBatch, increment 
} from "firebase/firestore";

export type SubmissionType = "BOOK" | "RESEARCH" | "WEAVE" | "DISCUSSION" | "GROUP_WEAVE";

export interface SubmissionPayload {
  title: string;
  content: any; // Can be text, JSON from editor, or file URL
  type: SubmissionType;
  refDraftId?: string; // If submitting from an existing draft
  isWebIndexable?: boolean;
}

/**
 * USER ACTION: Submit content to the Gatekeeper
 */
export const submitToGatekeeper = async (payload: SubmissionPayload) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required.");

  // 1. Verify Identity Contract (Real Name)
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) throw new Error("User profile corrupted or missing.");
  const userData = userSnap.data();

  // 2. Create Pending Document
  const submissionRef = doc(collection(db, "submissions"));
  
  await setDoc(submissionRef, {
    id: submissionRef.id,
    authorId: user.uid,
    authorName: userData.fullName, // Enforced Legal Name
    type: payload.type,
    title: payload.title,
    content: payload.content,
    refDraftId: payload.refDraftId || null,
    
    // Safety & State Contract
    isWebIndexable: payload.isWebIndexable || false,
    legalAffirmation: true,
    status: "pending",
    
    // Timestamps & Metrics
    commentCount: 0,
    likeCount: 0,
    viewCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return submissionRef.id;
};

/**
 * ADMIN ACTION: Approve a submission and route it to the correct public collection.
 * This uses a Batch Write to guarantee data integrity.
 */
export const approveSubmission = async (submissionId: string, authorId: string, type: SubmissionType) => {
  const batch = writeBatch(db);
  
  // References
  const submissionRef = doc(db, "submissions", submissionId);
  const userRef = doc(db, "users", authorId);
  
  // Determine Destination Collection based on Type
  let destinationCollection = "feed"; // Default fallback
  if (type === "BOOK") destinationCollection = "books";
  if (type === "RESEARCH") destinationCollection = "publications";
  if (type === "WEAVE") destinationCollection = "weaves";
  if (type === "GROUP_WEAVE") destinationCollection = "groupWeaves";

  const publishedRef = doc(db, destinationCollection, submissionId);
  const submissionSnap = await getDoc(submissionRef);
  
  if (!submissionSnap.exists()) throw new Error("Submission not found.");
  const submissionData = submissionSnap.data();

  // 1. Copy data to Public Collection
  batch.set(publishedRef, {
    ...submissionData,
    status: "approved",
    publishedAt: serverTimestamp(),
  });

  // 2. Mark Submission as Approved
  batch.update(submissionRef, { 
    status: "approved",
    updatedAt: serverTimestamp() 
  });

  // 3. Update User Counters Atomically (Author Badge Logic)
  const userUpdates: any = { updatedAt: serverTimestamp() };
  
  if (type === "BOOK") {
    userUpdates.isAuthor = true; // Unlock Author Badge
    userUpdates.booksPublished = increment(1);
  }
  if (type === "RESEARCH") {
    userUpdates.researchPublished = increment(1);
  }
  if (type === "WEAVE" || type === "GROUP_WEAVE") {
    userUpdates.weaveCount = increment(1);
  }

  batch.update(userRef, userUpdates);

  // 4. Commit all changes simultaneously
  await batch.commit();
};

/**
 * ADMIN ACTION: Reject a submission with a reason.
 */
export const rejectSubmission = async (submissionId: string, reason: string) => {
  const submissionRef = doc(db, "submissions", submissionId);
  await updateDoc(submissionRef, {
    status: "rejected",
    rejectionReason: reason,
    updatedAt: serverTimestamp()
  });
};