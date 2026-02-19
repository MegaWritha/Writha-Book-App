import { storage, auth } from "./firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

// --- 1. THE MISSING DEFINITION (This fixes the BookCard error) ---
export interface Book {
  id: string;
  title: string;
  author: string;
  cover: string;
  price?: number;
  isPaid: boolean;
  status: 'draft' | 'published';
  reads: number;
  likes: number;
  rating: number;
  userId?: string; // Important for checking who owns the book
}

// --- 2. THE MISSING UTILITY (This fixes the formatNumber error) ---
export const formatNumber = (num: number = 0) => {
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
};

// --- 3. YOUR EXISTING UPLOAD CODE ---
export const uploadToWrithaStorage = async (
  uri: string, 
  path: 'avatars' | 'covers' | 'submissions'
): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error("Auth required");

  const blob: Blob = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () { resolve(xhr.response); };
    xhr.onerror = function (e) { reject(new TypeError("Network request failed")); };
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });

  const fileRef = ref(storage, `${path}/${user.uid}/${Date.now()}`);
  const uploadTask = await uploadBytesResumable(fileRef, blob);
  
  return await getDownloadURL(uploadTask.ref);
};