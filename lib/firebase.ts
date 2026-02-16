import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  // @ts-ignore
  getReactNativePersistence,
  initializeAuth, 
  Auth
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyDSgtmZLZTeBI_LzAoz4S4_raVVNFq0o9A",
  authDomain: "writhabookapp.firebaseapp.com",
  projectId: "writhabookapp",
  storageBucket: "writhabookapp.firebasestorage.app",
  messagingSenderId: "284058184843",
  appId: "1:284058184843:web:54ab4980290a573bf3f88e",
};

// Initialize App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with a type-safe check
let auth: Auth;

if (getApps().length === 0) {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} else {
  auth = getAuth(app);
}

const db = getFirestore(app);

export { app, auth, db };
export default app;