import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ActivityIndicator, Alert, ImageBackground, Animated, Modal, Dimensions, ScrollView
} from "react-native";
import LottieView from "lottie-react-native";
import { Ionicons, FontAwesome5, AntDesign } from "@expo/vector-icons";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";

const { width, height } = Dimensions.get("window");

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

  const handleBiometricAuth = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock the Writha Archives",
      fallbackLabel: "Use Password",
      disableDeviceFallback: false,
    });

    if (result.success) {
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

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>Welcome to Writha</Text>}
          </TouchableOpacity>

          {/* SOCIAL LOGIN - NON-FUNCTIONAL PLACEHOLDERS */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialIconBtn} onPress={() => Alert.alert("Coming Soon", "Google login will be available in the next update.")}>
              <AntDesign name="google" size={24} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialIconBtn} onPress={() => Alert.alert("Coming Soon", "Apple ID login will be available in the next update.")}>
              <AntDesign name="apple" size={24} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialIconBtn} onPress={() => Alert.alert("Coming Soon", "X (Twitter) login will be available in the next update.")}>
              <FontAwesome5 name="twitter" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.signupLink} onPress={() => router.push("/signup")}>
            <Text style={styles.signupText}>New writer? <Text style={styles.goldText}>Join the Archives</Text></Text>
          </TouchableOpacity>

          {isBiometricSupported && (
            <TouchableOpacity style={styles.bioBtn} onPress={handleBiometricAuth}>
              <View style={styles.keyholeCircle}>
                <Ionicons name="finger-print" size={32} color="#FFD700" />
              </View>
              <Text style={styles.bioText}>Biometric Unlock</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <Modal visible={loginSuccess} transparent>
        <View style={styles.successOverlay}>
          <Text style={styles.successText}>Welcome back, Writer.</Text>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10, 5, 20, 0.88)' },
  scrollContent: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingVertical: 50 },
  toast: {
    position: 'absolute', top: 0, width: width * 0.85, alignSelf: 'center',
    backgroundColor: 'rgba(30, 17, 53, 0.98)',
    padding: 18, borderRadius: 20, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#FFD700', zIndex: 100, gap: 10,
  },
  toastText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  glassCard: { width: '88%', padding: 35, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,215,0,0.1)' },
  logoText: { color: '#FFD700', fontSize: 32, fontWeight: '900', letterSpacing: 10, marginBottom: 40 },
  inputGroup: { width: '100%', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 18, paddingHorizontal: 20, height: 60, marginBottom: 15, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  input: { flex: 1, color: '#FFF', fontSize: 16 },
  goldBtn: { backgroundColor: '#FFD700', width: '100%', height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  btnText: { fontWeight: '900', letterSpacing: 2, fontSize: 14, color: '#000' },
  
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 30, width: '100%' },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,215,0,0.1)' },
  dividerText: { color: 'rgba(255,215,0,0.4)', fontSize: 10, fontWeight: '900', marginHorizontal: 15, letterSpacing: 1 },
  
  socialRow: { flexDirection: 'row', gap: 20, marginBottom: 20 },
  socialIconBtn: { width: 55, height: 55, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  
  signupLink: { marginTop: 10 },
  signupText: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  goldText: { color: '#FFD700', fontWeight: '900' },

  bioBtn: { marginTop: 30, alignItems: 'center' },
  keyholeCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255, 215, 0, 0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.2)', marginBottom: 8 },
  bioText: { color: '#FFD700', fontSize: 10, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase' },

  successOverlay: { flex: 1, backgroundColor: '#0F071A', justifyContent: 'center', alignItems: 'center' },
  successText: { color: '#FFD700', fontSize: 18, fontWeight: 'bold', letterSpacing: 2 }
});