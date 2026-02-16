import { db } from './firebase'; 
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";

// --- For the Write Screen ---
export const publishStory = async (title: string, content: string, userId: string) => {
  try {
    const docRef = await addDoc(collection(db, "books"), {
      title,
      content,
      authorId: userId,
      createdAt: serverTimestamp(),
      reads: 0,
      likes: 0,
      genre: "Educational" // Change this as needed
    });
    return docRef.id;
  } catch (e) {
    console.error("Error adding document: ", e);
    throw e;
  }
};

// --- For Creating a Group ---
export const createGroup = async (name: string, description: string, adminId: string) => {
  try {
    const groupRef = await addDoc(collection(db, "groups"), {
      name,
      description,
      adminId,
      members: [adminId],
      createdAt: serverTimestamp(),
    });
    return groupRef.id;
  } catch (e) {
    console.error("Error creating group: ", e);
    throw e;
  }
};