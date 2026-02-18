import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  // @ts-ignore
  getReactNativePersistence,
  initializeAuth, 
  Auth
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // 👈 Added Storage
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Correct Auth Initialization for React Native + Web
let auth: Auth;
if (Platform.OS !== 'web') {
  try {
    auth = getAuth(app);
  } catch (e) {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
} else {
  auth = getAuth(app);
}

const db = getFirestore(app);
const storage = getStorage(app); // 👈 Exporting Storage now

export { app, auth, db, storage }; // 👈 Added storage here
export default app;