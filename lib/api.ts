import { db } from "./firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

// This stops the 'getBooks is not defined' errors
export async function getBooks() {
  try {
    const querySnapshot = await getDocs(collection(db, "books"));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching books:", error);
    return []; // Returns an empty list so the app doesn't crash
  }
}

// This stops the 'getGroups is not defined' errors
export async function getGroups() {
  try {
    const querySnapshot = await getDocs(collection(db, "groups"));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    return [];
  }
}

// This handles the Wallet/Profile data
export async function getUserData(userId: string) {
  try {
    const q = query(collection(db, "users"), where("uid", "==", userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs[0]?.data() || { balance: 0, bio: "" };
  } catch (error) {
    return { balance: 0, bio: "" };
  }
}