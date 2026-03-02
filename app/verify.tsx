import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { auth } from "@/lib/firebase";
import { sendEmailVerification, reload, signOut } from "firebase/auth";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// ============ CONSTANTS ============
const POLLING_INTERVAL = 3000;        // Check every 3 seconds
const MAX_POLLING_ATTEMPTS = 40;      // Max 2 minutes of checking
const RESEND_COOLDOWN = 60;           // 60 second cooldown between resends
const EMAIL_CHECK_TIMEOUT = 10000;    // 10 second timeout for reload

type VerificationStatus = "pending" | "verified" | "error" | "idle";

export default function VerifyEmail() {
  // ============ STATE ============
  const [user, setUser] = useState(auth.currentUser);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("pending");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [autoChecking, setAutoChecking] = useState(true);
  const [resendCooldown, setResendCooldown] = useState(0);

  // ============ REFS ============
  const pollingAttemptsRef = useRef(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);

  const router = useRouter();

  // ============ AUTH STATE LISTENER ============
  // FIX #1: Always have current user reference
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        router.replace("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  // ============ APP STATE LISTENER ============
  // FIX #5: Resume verification when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const handleAppStateChange = useCallback(
    (state: AppStateStatus) => {
      if (state === "active" && user && !user.emailVerified) {
        startAutoVerificationCheck();
      }
      appStateRef.current = state;
    },
    [user]
  );

  // ============ EMAIL VERIFICATION WITH TIMEOUT ============
  // FIX #2: Get fresh user reference after reload + timeout protection
  const verifyEmailWithTimeout = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setVerificationStatus("error");
      return false;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn("Email verification check timed out");
        resolve(false);
      }, EMAIL_CHECK_TIMEOUT);

      reload(user)
        .then(() => {
          clearTimeout(timeout);
          // Get FRESH user reference after reload
          const currentUser = auth.currentUser;
          if (currentUser?.emailVerified) {
            resolve(true);
          } else {
            resolve(false);
          }
        })
        .catch((error) => {
          clearTimeout(timeout);
          console.error("Email verification check failed:", error);
          resolve(false);
        });
    });
  }, [user]);

  // ============ MANUAL VERIFICATION CHECK ============
  const checkVerification = useCallback(async () => {
    if (!user) {
      Alert.alert("Error", "No user found. Please log in again.");
      router.replace("/login");
      return;
    }

    setLoading(true);
    setVerificationStatus("idle");

    try {
      const isVerified = await verifyEmailWithTimeout();

      if (isVerified) {
        setVerificationStatus("verified");
        Alert.alert("✓ Verified!", "Welcome to the collective.", [
          {
            text: "Continue",
            onPress: () => router.replace("/(tabs)"),
          },
        ]);
      } else {
        setVerificationStatus("pending");
        Alert.alert(
          "Not Yet Verified",
          "We haven't detected the verification yet.\n\nPlease ensure you:\n• Clicked the link in your email\n• Check your spam/junk folder\n• Wait a moment for servers to sync",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      setVerificationStatus("error");
      Alert.alert("Error", "Could not refresh verification status. Please try again.");
      console.error("Verification check error:", error);
    } finally {
      setLoading(false);
    }
  }, [user, router, verifyEmailWithTimeout]);

  // ============ RESEND EMAIL WITH COOLDOWN ============
  // FIX #6: Add cooldown prevention
  const resendEmail = useCallback(async () => {
    if (!user) {
      Alert.alert("Error", "No user found.");
      return;
    }

    if (resendCooldown > 0) {
      Alert.alert("Please Wait", `You can request another link in ${resendCooldown} seconds.`);
      return;
    }

    setResending(true);

    try {
      await sendEmailVerification(user);
      
      // Start cooldown countdown
      setResendCooldown(RESEND_COOLDOWN);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      cooldownIntervalRef.current = interval;

      Alert.alert(
        "✓ Email Sent",
        "A new verification link has been sent to your inbox.\n\nMake sure to check your spam folder if you don't see it.",
        [{ text: "OK" }]
      );
    } catch (error: any) {
      handleResendError(error);
    } finally {
      setResending(false);
    }
  }, [user, resendCooldown]);

  // ============ ADVANCED ERROR HANDLING ============
  // FIX #4: Handle specific error codes
  const handleResendError = (error: any) => {
    const errorCode = error.code || "";
    const errorMessage = error.message || "Unknown error";

    console.error("Resend error:", errorCode, errorMessage);

    if (errorCode === "auth/too-many-requests") {
      Alert.alert(
        "Too Many Requests",
        "You've requested too many verification emails. Please wait a while before trying again.",
        [{ text: "OK" }]
      );
    } else if (errorCode === "auth/user-not-found") {
      Alert.alert("Account Not Found", "User account not found. Please log in again.");
      router.replace("/login");
    } else if (errorCode === "auth/invalid-user-token") {
      Alert.alert("Session Expired", "Your session has expired. Please log in again.");
      router.replace("/login");
    } else if (errorCode === "auth/user-disabled") {
      Alert.alert("Account Disabled", "Your account has been disabled. Please contact support.");
    } else {
      Alert.alert("Error Sending Email", "Could not send verification email. Please try again.");
    }
  };

  // ============ AUTO-VERIFICATION POLLING ============
  // FIX #3: Automatic checking in background
  const startAutoVerificationCheck = useCallback(async () => {
    if (pollingIntervalRef.current) return; // Already running
    if (!user || user.emailVerified) return;

    setAutoChecking(true);
    pollingAttemptsRef.current = 0;

    pollingIntervalRef.current = setInterval(async () => {
      pollingAttemptsRef.current += 1;

      // Stop polling after max attempts
      if (pollingAttemptsRef.current >= MAX_POLLING_ATTEMPTS) {
        stopAutoVerificationCheck();
        setAutoChecking(false);
        return;
      }

      try {
        const isVerified = await verifyEmailWithTimeout();
        if (isVerified) {
          stopAutoVerificationCheck();
          setVerificationStatus("verified");
          Alert.alert(
            "✓ Email Verified!",
            "Your email has been verified. Continuing to the app...",
            [
              {
                text: "OK",
                onPress: () => router.replace("/(tabs)"),
              },
            ]
          );
        }
      } catch (error) {
        console.error("Auto-check attempt failed:", error);
      }
    }, POLLING_INTERVAL);
  }, [user, router, verifyEmailWithTimeout]);

  const stopAutoVerificationCheck = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setAutoChecking(false);
  }, []);

  // ============ START AUTO-CHECKING ON MOUNT ============
  // FIX #7: Complete cleanup
  useEffect(() => {
    if (user && !user.emailVerified) {
      startAutoVerificationCheck();
    }

    return () => {
      stopAutoVerificationCheck();
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
    };
  }, [user, startAutoVerificationCheck, stopAutoVerificationCheck]);

  // ============ SIGN OUT HANDLER ============
  const handleSignOut = useCallback(async () => {
    Alert.alert(
      "Sign Out?",
      "You'll need to sign in again with a different email.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              stopAutoVerificationCheck();
              await signOut(auth);
              router.replace("/login");
            } catch (error) {
              Alert.alert("Error", "Could not sign out. Please try again.");
            }
          },
        },
      ]
    );
  }, [router, stopAutoVerificationCheck]);

  // ============ LOADING STATE ============
  if (!user) {
    return (
      <LinearGradient colors={["#4A00E0", "#2D0081"]} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </LinearGradient>
    );
  }

  // ============ RENDER ============
  return (
    <LinearGradient colors={["#4A00E0", "#2D0081"]} style={styles.container}>
      <View style={styles.glassCard}>
        {/* Icon with auto-check indicator */}
        <View style={styles.iconContainer}>
          <Ionicons name="mail-open-outline" size={80} color="#FFD700" />
          {autoChecking && (
            <View style={styles.checkingIndicator}>
              <ActivityIndicator size="small" color="#FFD700" />
            </View>
          )}
        </View>

        <Text style={styles.title}>Confirm Your Identity</Text>
        <Text style={styles.subtitle}>
          We've sent a verification link to:{"\n"}
          <Text style={styles.emailText}>{user.email}</Text>
        </Text>

        {/* Auto-checking status */}
        {autoChecking && (
          <View style={styles.statusBanner}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#FFD700" />
            <Text style={styles.statusText}>
              Checking automatically... ({pollingAttemptsRef.current}/{MAX_POLLING_ATTEMPTS})
            </Text>
          </View>
        )}

        {/* Manual verification button */}
        <TouchableOpacity
          style={[styles.goldBtn, loading && styles.btnDisabled]}
          onPress={checkVerification}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.btnText}>I've Verified My Email</Text>
          )}
        </TouchableOpacity>

        {/* Resend button with cooldown */}
        <TouchableOpacity
          style={[
            styles.resendBtn,
            resending && styles.btnDisabled,
            resendCooldown > 0 && styles.btnDisabled,
          ]}
          onPress={resendEmail}
          disabled={resending || resendCooldown > 0}
        >
          {resending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.resendText}>
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Link"}
            </Text>
          )}
        </TouchableOpacity>

        {/* Help section */}
        <View style={styles.helpBox}>
          <Ionicons name="bulb-outline" size={16} color="#FFD700" />
          <Text style={styles.helpText}>
            Didn't receive the email? Check your spam folder or request a new link.
          </Text>
        </View>

        {/* Sign out button */}
        <TouchableOpacity onPress={handleSignOut} style={styles.backBtn}>
          <Text style={styles.backText}>Use a different email</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 25 },
  loadingContainer: { justifyContent: "center", alignItems: "center", gap: 20 },
  loadingText: { color: "#fff", fontSize: 16 },
  glassCard: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 35,
    padding: 35,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
  },
  iconContainer: { position: "relative", alignItems: "center", justifyContent: "center" },
  checkingIndicator: {
    position: "absolute",
    bottom: -5,
    right: -5,
    backgroundColor: "rgba(74, 0, 224, 0.9)",
    borderRadius: 20,
    padding: 8,
    borderWidth: 2,
    borderColor: "rgba(255, 215, 0, 0.5)",
  },
  title: { color: "#fff", fontSize: 24, fontWeight: "bold", marginTop: 20, textAlign: "center" },
  subtitle: { color: "rgba(255,255,255,0.7)", textAlign: "center", marginTop: 15, lineHeight: 22, fontSize: 15 },
  emailText: { color: "#FFD700", fontWeight: "bold" },
  statusBanner: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    borderRadius: 12,
    padding: 12,
    marginTop: 20,
    marginBottom: 20,
    alignItems: "center",
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#FFD700",
  },
  statusText: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600", flex: 1 },
  goldBtn: {
    backgroundColor: "#FFD700",
    width: "100%",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    marginTop: 30,
    elevation: 5,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  btnText: { fontWeight: "bold", color: "#000", fontSize: 16 },
  btnDisabled: { opacity: 0.6 },
  resendBtn: { marginTop: 20, paddingVertical: 12 },
  resendText: { color: "#fff", fontWeight: "600", textDecorationLine: "underline", fontSize: 14 },
  helpBox: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 12,
    marginTop: 30,
    marginBottom: 20,
    alignItems: "flex-start",
    gap: 10,
  },
  helpText: { color: "rgba(255,255,255,0.6)", fontSize: 12, lineHeight: 18, flex: 1 },
  backBtn: { marginTop: 10 },
  backText: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
});