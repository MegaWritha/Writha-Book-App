import { db, auth } from "./firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { AppState, AppStateStatus } from "react-native";

export const initPresence = () => {
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  const userRef = doc(db, "users", userId);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === "active") {
      // User is back in the app
      await updateDoc(userRef, {
        isOnline: true,
        lastSeen: serverTimestamp(),
      });
    } else {
      // User left the app or put it in background
      await updateDoc(userRef, {
        isOnline: false,
        lastSeen: serverTimestamp(),
      });
    }
  };

  // Set initial state to online
  updateDoc(userRef, { isOnline: true, lastSeen: serverTimestamp() });

  const subscription = AppState.addEventListener("change", handleAppStateChange);

  return () => {
    subscription.remove();
    // Set to offline when component unmounts
    updateDoc(userRef, { isOnline: false, lastSeen: serverTimestamp() });
  };
};