import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ImageBackground, Animated, Dimensions,
  ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons, FontAwesome5, AntDesign } from "@expo/vector-icons";
import { auth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

const SAVED_EMAIL_KEY = "writha_saved_email";
const SAVED_PASS_KEY  = "writha_saved_pass";

export default function LoginScreen() {
  const router = useRouter();

  const [email,              setEmail]              = useState("");
  const [password,           setPassword]           = useState("");
  const [showPassword,       setShowPassword]       = useState(false);
  const [loading,            setLoading]            = useState(false);
  const [loginSuccess,       setLoginSuccess]       = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [resetLoading,       setResetLoading]       = useState(false);

  // Toast
  const [toastMsg,  setToastMsg]  = useState("");
  const [toastType, setToastType] = useState<"error" | "success">("error");
  const toastY = useRef(new Animated.Value(-120)).current;

  // Success overlay fade
  const successOpacity = useRef(new Animated.Value(0)).current;

  // ── Check biometric support + load saved credentials ─────────────────────
  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled   = await LocalAuthentication.isEnrolledAsync();
      setIsBiometricSupported(compatible && enrolled);

      // Pre-fill email if previously saved
      const savedEmail = await AsyncStorage.getItem(SAVED_EMAIL_KEY);
      if (savedEmail) setEmail(savedEmail);
    })();
  }, []);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = (msg: string, type: "error" | "success" = "error") => {
    setToastMsg(msg);
    setToastType(type);
    Haptics.notificationAsync(
      type === "error"
        ? Haptics.NotificationFeedbackType.Error
        : Haptics.NotificationFeedbackType.Success
    );
    Animated.sequence([
      Animated.timing(toastY, { toValue: 60, duration: 400, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(toastY, { toValue: -120, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  // ── Map Firebase error codes to human readable messages ──────────────────
  const getErrorMessage = (code: string): string => {
    switch (code) {
      case "auth/user-not-found":
      case "auth/invalid-credential":
        return "No account found with this email.";
      case "auth/wrong-password":
        return "Incorrect password. Please try again.";
      case "auth/too-many-requests":
        return "Too many attempts. Try again later or reset your password.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/network-request-failed":
        return "No internet connection. Check your network.";
      case "auth/user-disabled":
        return "This account has been disabled.";
      default:
        return "Login failed. Please try again.";
    }
  };

  // ── Forgot password ───────────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      showToast("Enter your email first, then tap forgot password.");
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      showToast("Reset link sent! Check your inbox.", "success");
    } catch (error: any) {
      showToast(getErrorMessage(error.code));
    } finally {
      setResetLoading(false);
    }
  };

  // ── Show success and navigate ─────────────────────────────────────────────
  const handleSuccess = () => {
    setLoginSuccess(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.timing(successOpacity, {
      toValue: 1, duration: 400, useNativeDriver: true,
    }).start();
    setTimeout(() => router.replace("/(tabs)"), 2200);
  };

  // ── Main login ────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email.trim()) { showToast("Please enter your email."); return; }
    if (!password)     { showToast("Please enter your password."); return; }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth, email.trim(), password
      );

      if (!userCredential.user.emailVerified) {
        showToast("Please verify your email before logging in.");
        await signOut(auth);
        setLoading(false);
        return;
      }

      // Save credentials for biometric re-auth next time
      await AsyncStorage.setItem(SAVED_EMAIL_KEY, email.trim());
      await AsyncStorage.setItem(SAVED_PASS_KEY,  password);

      handleSuccess();
    } catch (error: any) {
      showToast(getErrorMessage(error.code));
      setLoading(false);
    }
  };

  // ── Biometric — re-authenticates with saved credentials ──────────────────
  const handleBiometricAuth = async () => {
    const savedEmail = await AsyncStorage.getItem(SAVED_EMAIL_KEY);
    const savedPass  = await AsyncStorage.getItem(SAVED_PASS_KEY);

    if (!savedEmail || !savedPass) {
      showToast("Log in with your password first to enable biometrics.");
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage:         "Unlock Writha",
      fallbackLabel:         "Use Password",
      disableDeviceFallback: false,
    });

    if (result.success) {
      setLoading(true);
      try {
        const userCredential = await signInWithEmailAndPassword(
          auth, savedEmail, savedPass
        );
        if (!userCredential.user.emailVerified) {
          showToast("Please verify your email before logging in.");
          await signOut(auth);
          setLoading(false);
          return;
        }
        handleSuccess();
      } catch (error: any) {
        showToast("Session expired. Please log in with your password.");
        setLoading(false);
      }
    } else {
      showToast("Biometric authentication failed.");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ImageBackground
      source={{ uri: "https://images.unsplash.com/photo-1535905557558-afc4877a26fc?q=80&w=1974&auto=format&fit=crop" }}
      style={s.container}
    >
      <View style={s.overlay} />

      {/* Toast */}
      <Animated.View
        style={[
          s.toast,
          { transform: [{ translateY: toastY }] },
          { borderColor: toastType === "success" ? "#4ADE80" : "#FFD700" },
        ]}
      >
        <Ionicons
          name={toastType === "success" ? "checkmark-circle" : "alert-circle"}
          size={20}
          color={toastType === "success" ? "#4ADE80" : "#FFD700"}
        />
        <Text style={s.toastText}>{toastMsg}</Text>
      </Animated.View>

      {/* FIX: KeyboardAvoidingView prevents keyboard covering inputs */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.card}>

            {/* Logo */}
            <Text style={s.logoText}>WRITHA</Text>
            <Text style={s.welcomeText}>Welcome back, User</Text>
            <Text style={s.subText}>Sign in to continue your story</Text>

            {/* Email */}
            <View style={s.inputGroup}>
              <Ionicons
                name="mail-outline" size={18}
                color="rgba(255,215,0,0.5)"
                style={s.inputIcon}
              />
              <TextInput
                style={s.input}
                placeholder="Email Address"
                placeholderTextColor="rgba(255,255,255,0.25)"
                onChangeText={setEmail}
                value={email}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>

            {/* Password */}
            <View style={s.inputGroup}>
              <Ionicons
                name="lock-closed-outline" size={18}
                color="rgba(255,215,0,0.5)"
                style={s.inputIcon}
              />
              <TextInput
                style={s.input}
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.25)"
                secureTextEntry={!showPassword}
                onChangeText={setPassword}
                value={password}
                autoComplete="password"
              />
              {/* FIX: show/hide password toggle */}
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={s.eyeBtn}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="rgba(255,255,255,0.35)"
                />
              </TouchableOpacity>
            </View>

            {/* FIX: Forgot password */}
            <TouchableOpacity
              style={s.forgotRow}
              onPress={handleForgotPassword}
              disabled={resetLoading}
            >
              {resetLoading
                ? <ActivityIndicator size="small" color="#FFD700" />
                : <Text style={s.forgotText}>Forgot Password?</Text>
              }
            </TouchableOpacity>

            {/* Login button */}
            <TouchableOpacity
              style={[s.goldBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#000" />
                : <Text style={s.btnText}>Sign In</Text>
              }
            </TouchableOpacity>

            {/* Divider */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>OR CONTINUE WITH</Text>
              <View style={s.dividerLine} />
            </View>

            {/* FIX: Social buttons — no alert popups, styled as coming soon */}
            <View style={s.socialRow}>
              <TouchableOpacity style={s.socialBtn} disabled>
                <AntDesign name="google" size={22} color="rgba(255,255,255,0.3)" />
                <Text style={s.socialBtnTxt}>Google</Text>
                <View style={s.soonBadge}>
                  <Text style={s.soonTxt}>SOON</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={s.socialBtn} disabled>
                <AntDesign name="apple" size={22} color="rgba(255,255,255,0.3)" />
                <Text style={s.socialBtnTxt}>Apple</Text>
                <View style={s.soonBadge}>
                  <Text style={s.soonTxt}>SOON</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Signup link — FIX: updated text */}
            <TouchableOpacity
              style={s.signupLink}
              onPress={() => router.push("/signup")}
            >
              <Text style={s.signupText}>
                New here?{"  "}
                <Text style={s.goldText}>Sign Up</Text>
              </Text>
            </TouchableOpacity>

            {/* Biometric */}
            {isBiometricSupported && (
              <TouchableOpacity style={s.bioBtn} onPress={handleBiometricAuth}>
                <View style={s.bioBtnInner}>
                  <Ionicons name="finger-print" size={30} color="#FFD700" />
                </View>
                <Text style={s.bioText}>BIOMETRIC LOGIN</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success overlay */}
      {loginSuccess && (
        <Animated.View style={[s.successOverlay, { opacity: successOpacity }]}>
          <Text style={s.successTitle}>Welcome back,</Text>
          <Text style={s.successSub}>Writer.</Text>
        </Animated.View>
      )}
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  overlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,5,20,0.88)" },

  scrollContent: {
    flexGrow: 1, justifyContent: "center",
    alignItems: "center", paddingVertical: 50,
  },

  // Toast
  toast: {
    position: "absolute", top: 0, alignSelf: "center",
    width: width * 0.88,
    backgroundColor: "rgba(30,17,53,0.98)",
    padding: 16, borderRadius: 18,
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, zIndex: 100,
    marginTop: 4,
  },
  toastText: { color: "#FFF", fontSize: 13, fontWeight: "700", marginLeft: 10, flex: 1 },

  // Card
  card: {
    width: "88%", padding: 32,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,215,0,0.1)",
  },

  // Header
  logoText:    { color: "#FFD700", fontSize: 30, fontWeight: "900", letterSpacing: 10, marginBottom: 12 },
  welcomeText: { color: "#FFF", fontSize: 20, fontWeight: "800", marginBottom: 4 },
  subText:     { color: "rgba(255,255,255,0.35)", fontSize: 13, marginBottom: 32 },

  // Inputs
  inputGroup: {
    width: "100%", backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 16, paddingHorizontal: 16,
    height: 58, marginBottom: 14,
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  inputIcon: { marginRight: 10 },
  input:     { flex: 1, color: "#FFF", fontSize: 15 },
  eyeBtn:    { padding: 6 },

  // Forgot password
  forgotRow: { alignSelf: "flex-end", marginBottom: 20, marginTop: -4 },
  forgotText:{ color: "#FFD700", fontSize: 12, fontWeight: "700" },

  // Login button
  goldBtn: {
    backgroundColor: "#FFD700", width: "100%",
    height: 58, borderRadius: 16,
    justifyContent: "center", alignItems: "center",
  },
  btnText: { fontWeight: "900", letterSpacing: 2, fontSize: 14, color: "#000" },

  // Divider
  dividerRow:  { flexDirection: "row", alignItems: "center", marginVertical: 28, width: "100%" },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,215,0,0.1)" },
  dividerText: { color: "rgba(255,215,0,0.4)", fontSize: 9, fontWeight: "900", marginHorizontal: 14, letterSpacing: 1 },

  // Social — FIX: gap replaced with marginRight
  socialRow: { flexDirection: "row", width: "100%", marginBottom: 24 },
  socialBtn: {
    flex: 1, height: 52, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    justifyContent: "center", alignItems: "center",
    marginRight: 10, position: "relative",
  },
  socialBtnTxt: { color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: "700", marginTop: 4 },
  soonBadge:    { position: "absolute", top: 6, right: 6, backgroundColor: "rgba(255,215,0,0.15)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  soonTxt:      { color: "#FFD700", fontSize: 7, fontWeight: "900" },

  // Signup
  signupLink: { marginTop: 4 },
  signupText: { color: "rgba(255,255,255,0.45)", fontSize: 13 },
  goldText:   { color: "#FFD700", fontWeight: "900" },

  // Biometric
  bioBtn:     { marginTop: 28, alignItems: "center" },
  bioBtnInner:{ width: 66, height: 66, borderRadius: 33, backgroundColor: "rgba(255,215,0,0.06)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,215,0,0.2)", marginBottom: 8 },
  bioText:    { color: "rgba(255,215,0,0.6)", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },

  // Success
  successOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#0F071A", justifyContent: "center", alignItems: "center" },
  successTitle:   { color: "rgba(255,255,255,0.5)", fontSize: 16, fontWeight: "300", letterSpacing: 4 },
  successSub:     { color: "#FFD700", fontSize: 42, fontWeight: "900", letterSpacing: 6, marginTop: 4 },
});