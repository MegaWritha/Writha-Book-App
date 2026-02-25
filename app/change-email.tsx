import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, ScrollView, StatusBar, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth } from "@/lib/firebase";
import {
  EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail,
} from "firebase/auth";

const T = {
  bg: "#0F071A", ui: "#1E1135", ui2: "#2D1B4D",
  accent: "#FFD700", text: "#E2E8F0", muted: "#94A3B8",
  red: "#EF4444", green: "#22C55E", blue: "#38BDF8",
};

export default function ChangeEmailScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim());

  const handleChange = async () => {
    if (!isValidEmail) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    if (newEmail.trim() === user?.email) {
      Alert.alert("Same Email", "The new email is the same as your current email.");
      return;
    }
    if (!password.trim()) {
      Alert.alert("Required", "Please enter your current password to confirm.");
      return;
    }

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user!.email!, password);
      await reauthenticateWithCredential(user!, credential);
      await verifyBeforeUpdateEmail(user!, newEmail.trim());
      setSent(true);
    } catch (e: any) {
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        Alert.alert("Wrong Password", "Your current password is incorrect.");
      } else if (e.code === "auth/email-already-in-use") {
        Alert.alert("Email Taken", "This email is already linked to another account.");
      } else {
        Alert.alert("Error", e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={T.accent} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Change Email</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.successScreen}>
          <View style={styles.successIcon}>
            <Ionicons name="mail" size={40} color={T.accent} />
          </View>
          <Text style={styles.successTitle}>Verification Sent!</Text>
          <Text style={styles.successBody}>
            We've sent a verification link to{"\n"}
            <Text style={{ color: T.accent, fontWeight: "700" }}>{newEmail}</Text>
            {"\n\n"}Click the link in that email to confirm your new address. Your email won't change until you verify.
          </Text>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.doneBtnTxt}>BACK TO SETTINGS</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={T.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Email</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.currentBox}>
          <Text style={styles.currentLabel}>CURRENT EMAIL</Text>
          <View style={styles.currentRow}>
            <Ionicons name="mail" size={16} color={T.muted} />
            <Text style={styles.currentEmail}>{user?.email}</Text>
          </View>
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>NEW EMAIL ADDRESS</Text>
          <View style={[
            styles.fieldRow,
            newEmail.length > 0
              ? { borderColor: isValidEmail ? T.green : T.red }
              : { borderColor: T.ui2 },
          ]}>
            <Ionicons name="mail-outline" size={18} color={T.muted} />
            <TextInput
              style={styles.fieldInput}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="Enter new email address"
              placeholderTextColor={T.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {newEmail.length > 0 && (
              <Ionicons
                name={isValidEmail ? "checkmark-circle" : "close-circle"}
                size={18}
                color={isValidEmail ? T.green : T.red}
              />
            )}
          </View>
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>CONFIRM WITH PASSWORD</Text>
          <View style={styles.fieldRow}>
            <Ionicons name="lock-closed-outline" size={18} color={T.muted} />
            <TextInput
              style={styles.fieldInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your current password"
              placeholderTextColor={T.muted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20} color={T.muted}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={T.blue} />
          <Text style={styles.infoTxt}>
            A verification link will be sent to your new email. Your address won't change until you click it.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, (!isValidEmail || !password || loading) && { opacity: 0.5 }]}
          onPress={handleChange}
          disabled={!isValidEmail || !password.trim() || loading}
        >
          {loading
            ? <ActivityIndicator color="#000" />
            : <>
                <Ionicons name="send" size={18} color="#000" />
                <Text style={styles.submitBtnTxt}>SEND VERIFICATION</Text>
              </>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 20,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: T.ui, justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: T.text },
  scroll: { padding: 20, paddingBottom: 60 },
  currentBox: {
    backgroundColor: T.ui, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: T.ui2, marginBottom: 28,
  },
  currentLabel: { color: T.muted, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 8 },
  currentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  currentEmail: { color: T.text, fontSize: 14, fontWeight: "600" },
  fieldWrap: { gap: 8, marginBottom: 16 },
  fieldLabel: { color: T.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  fieldRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: T.ui,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: T.ui2, gap: 10,
  },
  fieldInput: { flex: 1, color: T.text, fontSize: 15 },
  infoBox: {
    flexDirection: "row", gap: 10, backgroundColor: T.blue + "15",
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: T.blue + "30",
    alignItems: "flex-start", marginBottom: 8,
  },
  infoTxt: { color: T.muted, fontSize: 12, flex: 1, lineHeight: 18 },
  submitBtn: {
    backgroundColor: T.accent, borderRadius: 16, padding: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, marginTop: 24,
  },
  submitBtnTxt: { color: "#000", fontWeight: "900", fontSize: 14, letterSpacing: 1 },
  successScreen: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  successIcon: {
    width: 90, height: 90, borderRadius: 26, backgroundColor: T.ui,
    borderWidth: 2, borderColor: T.accent, justifyContent: "center",
    alignItems: "center", marginBottom: 24,
  },
  successTitle: { fontSize: 22, fontWeight: "900", color: T.text, marginBottom: 16 },
  successBody: { color: T.muted, fontSize: 14, textAlign: "center", lineHeight: 22 },
  doneBtn: {
    backgroundColor: T.accent, borderRadius: 16, paddingHorizontal: 32,
    paddingVertical: 16, marginTop: 32,
  },
  doneBtnTxt: { color: "#000", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
});