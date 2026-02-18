import { storage, auth } from "./firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

export const uploadToWrithaStorage = async (
  uri: string, 
  path: 'avatars' | 'covers' | 'submissions'
): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error("Auth required");

  // Mobile URI to Blob conversion
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