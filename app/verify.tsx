import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { auth } from "@/lib/firebase";
import { sendEmailVerification, reload } from "firebase/auth";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function VerifyEmail() {
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const router = useRouter();
  const user = auth.currentUser;

  // Function to check if user has clicked the link in their email
  const checkVerification = async () => {
    setLoading(true);
    try {
      await reload(user!); // Refresh user state from Firebase
      if (user?.emailVerified) {
        Alert.alert("Verified!", "Welcome to the collective.");
        router.replace("/(tabs)");
      } else {
        Alert.alert("Pending", "We haven't detected the verification yet. Please click the link in your inbox.");
      }
    } catch (error) {
      Alert.alert("Error", "Could not refresh status.");
    } finally {
      setLoading(false);
    }
  };

  const resendEmail = async () => {
    setResending(true);
    try {
      await sendEmailVerification(user!);
      Alert.alert("Sent", "A new intellectual handshake has been sent to your inbox.");
    } catch (error: any) {
      Alert.alert("Limit Reached", "Please wait a moment before requesting another link.");
    } finally {
      setResending(false);
    }
  };

  return (
    <LinearGradient colors={["#4A00E0", "#2D0081"]} style={styles.container}>
      <View style={styles.glassCard}>
        <Ionicons name="mail-open-outline" size={80} color="#FFD700" style={{ textAlign: 'center' }} />
        
        <Text style={styles.title}>Confirm Your Identity</Text>
        <Text style={styles.subtitle}>
          We've sent a verification link to:{"\n"}
          <Text style={styles.emailText}>{user?.email}</Text>
        </Text>

        <TouchableOpacity style={styles.goldBtn} onPress={checkVerification} disabled={loading}>
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>I've Verified My Email</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.resendBtn} onPress={resendEmail} disabled={resending}>
          {resending ? <ActivityIndicator color="#fff" /> : <Text style={styles.resendText}>Resend Link</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { auth.signOut(); router.replace("/login"); }} style={styles.backBtn}>
          <Text style={styles.backText}>Use a different email</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 25 },
  glassCard: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 35, padding: 35, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center' },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 20, textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 15, lineHeight: 22, fontSize: 15 },
  emailText: { color: '#FFD700', fontWeight: 'bold' },
  goldBtn: { backgroundColor: '#FFD700', width: '100%', padding: 20, borderRadius: 15, alignItems: 'center', marginTop: 30 },
  btnText: { fontWeight: 'bold', color: '#000', fontSize: 16 },
  resendBtn: { marginTop: 20 },
  resendText: { color: '#fff', fontWeight: '600', textDecorationLine: 'underline' },
  backBtn: { marginTop: 40 },
  backText: { color: 'rgba(255,255,255,0.5)', fontSize: 13 }
});
