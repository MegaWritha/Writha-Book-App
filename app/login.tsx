import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ActivityIndicator, Alert, ImageBackground, Animated, Modal, Dimensions
} from "react-native";
import LottieView from "lottie-react-native";
import { Ionicons } from "@expo/vector-icons";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication"; // Added back

// --- NEW WEB-SAFE IMPORT ---
import successAnimation from "../assets/images/animations/success.json";

const { width } = Dimensions.get("window");

export default function LoginScreen() {
  const router = useRouter();
  
  // --- STATES ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  
  // Custom Toast State
  const [toastMsg, setToastMsg] = useState("");
  const toastY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    // Check if hardware supports Biometrics (FaceID/Fingerprint)
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setIsBiometricSupported(compatible && enrolled);
    })();
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(toastY, { toValue: 60, duration: 500, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(toastY, { toValue: -100, duration: 500, useNativeDriver: true }),
    ]).start();
  };

  // --- BIOMETRIC AUTH LOGIC ---
  const handleBiometricAuth = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock the Writha Archives",
      fallbackLabel: "Use Password",
      disableDeviceFallback: false,
    });

    if (result.success) {
      // NOTE: In production, you'd usually use the biometric success 
      // to retrieve securely stored credentials via expo-secure-store.
      setLoginSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => router.replace("/(tabs)"), 2000);
    } else {
      showToast("Identity not recognized.");
    }
  };

  const handleLogin = async () => {
    if (!email || !password) return showToast("The archives require credentials.");

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      
      if (!userCredential.user.emailVerified) {
        showToast("Your soul is not yet verified.");
        await signOut(auth);
        setLoading(false);
        return;
      }

      setLoginSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => router.replace("/(tabs)"), 2500);

    } catch (error) {
      showToast("Access denied. Credentials mismatch.");
      setLoading(false);
    }
  };

  return (
    <ImageBackground 
      source={{ uri: "https://images.unsplash.com/photo-1535905557558-afc4877a26fc?q=80&w=1974&auto=format&fit=crop" }} 
      style={styles.container}
    >
      <View style={styles.overlay} />

      <Animated.View style={[styles.toast, { transform: [{ translateY: toastY }] }]}>
        <Ionicons name="alert-circle" size={20} color="#FFD700" />
        <Text style={styles.toastText}>{toastMsg}</Text>
      </Animated.View>

      <View style={styles.glassCard}>
        <Text style={styles.logoText}>WRITHA</Text>
        
        <View style={styles.inputGroup}>
          <Ionicons name="mail-outline" size={18} color="rgba(255,215,0,0.5)" style={{marginRight: 10}} />
          <TextInput 
            style={styles.input} 
            placeholder="Email" 
            placeholderTextColor="#555" 
            onChangeText={setEmail}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="lock-closed-outline" size={18} color="rgba(255,215,0,0.5)" style={{marginRight: 10}} />
          <TextInput 
            style={styles.input} 
            placeholder="Password" 
            secureTextEntry 
            placeholderTextColor="#555" 
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity style={styles.goldBtn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>OPEN ARCHIVE</Text>}
        </TouchableOpacity>

        {/* --- BIOMETRIC KEYHOLE --- */}
        {isBiometricSupported && (
          <TouchableOpacity style={styles.bioBtn} onPress={handleBiometricAuth}>
            <View style={styles.keyholeCircle}>
              <Ionicons name="finger-print" size={32} color="#FFD700" />
            </View>
            <Text style={styles.bioText}>Biometric Unlock</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={loginSuccess} transparent>
        <View style={styles.successOverlay}>
          <LottieView
            source={successAnimation} // Changed from require() to imported variable
            autoPlay
            loop={false}
            style={styles.lottie}
          />
          <Text style={styles.successText}>Welcome back, Writer.</Text>
        </View>
      </Modal>

    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10, 5, 20, 0.88)' },
  
  toast: {
    position: 'absolute', top: 0, width: width * 0.85,
    backgroundColor: 'rgba(30, 17, 53, 0.98)',
    padding: 18, borderRadius: 20, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#FFD700', zIndex: 100, gap: 10,
    shadowColor: "#FFD700", shadowOpacity: 0.2, shadowRadius: 10
  },
  toastText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  glassCard: { width: '88%', padding: 35, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,215,0,0.1)' },
  logoText: { color: '#FFD700', fontSize: 32, fontWeight: '900', letterSpacing: 10, marginBottom: 40 },
  
  inputGroup: { 
    width: '100%', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 18, 
    paddingHorizontal: 20, height: 60, marginBottom: 15, 
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' 
  },
  input: { flex: 1, color: '#FFF', fontSize: 16 },
  
  goldBtn: { backgroundColor: '#FFD700', width: '100%', height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: "#FFD700", shadowOpacity: 0.3, shadowRadius: 10 },
  btnText: { fontWeight: '900', letterSpacing: 2, fontSize: 14 },

  // Biometric Section
  bioBtn: { marginTop: 30, alignItems: 'center' },
  keyholeCircle: { 
    width: 70, height: 70, borderRadius: 35, 
    backgroundColor: 'rgba(255, 215, 0, 0.05)', 
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.2)',
    marginBottom: 8
  },
  bioText: { color: '#FFD700', fontSize: 10, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase' },

  successOverlay: { flex: 1, backgroundColor: '#0F071A', justifyContent: 'center', alignItems: 'center' },
  lottie: { width: 250, height: 250 },
  successText: { color: '#FFD700', fontSize: 18, fontWeight: 'bold', marginTop: 20, letterSpacing: 2 }
});