import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  StatusBar, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth } from "@/lib/firebase";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const THEME = {
  bg:          "#0F071A",
  ui:          "#1E1135",
  ui2:         "#2D1B4D",
  accent:      "#FFD700",
  accentDim:   "rgba(255,215,0,0.08)",
  purple:      "#6D28D9",
  purpleLight: "#A78BFA",
  text:        "#E2E8F0",
  textMuted:   "#94A3B8",
  green:       "#22C55E",
  red:         "#EF4444",
};

export default function ChangePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = auth.currentUser;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent]         = useState(false);
  const [showNew, setShowNew]                 = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [loading, setLoading]                 = useState(false);

  // ── PASSWORD STRENGTH ─────────────────────────────────────────────
  const getStrength = (pwd: string) => {
    if (pwd.length === 0) return null;
    let score = 0;
    if (pwd.length >= 8)            score++;
    if (/[A-Z]/.test(pwd))         score++;
    if (/[0-9]/.test(pwd))         score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { label: "Weak",   color: THEME.red,    width: "25%" };
    if (score === 2) return { label: "Fair",   color: "#F59E0B",    width: "50%" };
    if (score === 3) return { label: "Good",   color: THEME.accent, width: "75%" };
    return             { label: "Strong", color: THEME.green,  width: "100%" };
  };

  const strength = getStrength(newPassword);

  // ── VALIDATION ────────────────────────────────────────────────────
  const validate = () => {
    if (!currentPassword) {
      Alert.alert("Missing Field", "Please enter your current password."); return false;
    }
    if (newPassword.length < 8) {
      Alert.alert("Too Short", "New password must be at least 8 characters."); return false;
    }
    if (newPassword === currentPassword) {
      Alert.alert("Same Password", "New password must be different from your current password."); return false;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Mismatch", "New passwords do not match."); return false;
    }
    return true;
  };

  // ── SUBMIT ────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!validate() || !user?.email) return;
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      Alert.alert(
        "Password Updated ✅",
        "Your password has been changed successfully.",
        [{ text: "Done", onPress: () => router.back() }]
      );
    } catch (e: any) {
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        Alert.alert("Wrong Password", "Your current password is incorrect.");
      } else if (e.code === "auth/too-many-requests") {
        Alert.alert("Too Many Attempts", "Please wait a moment and try again.");
      } else if (e.code === "auth/weak-password") {
        Alert.alert("Weak Password", "Please choose a stronger password.");
      } else {
        Alert.alert("Error", e.message || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" />
      <View style={[styles.container, { paddingTop: insets.top }]}>

        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={THEME.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Change Password</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ICON */}
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed" size={36} color={THEME.accent} />
          </View>
          <Text style={styles.subheading}>
            For your security, enter your current password before setting a new one.
          </Text>

          {/* CURRENT PASSWORD */}
          <Text style={styles.fieldLabel}>CURRENT PASSWORD</Text>
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={18} color={THEME.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Enter current password"
              placeholderTextColor={THEME.textMuted}
              secureTextEntry={!showCurrent}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
              <Ionicons
                name={showCurrent ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={THEME.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* NEW PASSWORD */}
          <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
          <View style={styles.inputRow}>
            <Ionicons name="key-outline" size={18} color={THEME.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Enter new password"
              placeholderTextColor={THEME.textMuted}
              secureTextEntry={!showNew}
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowNew(!showNew)}>
              <Ionicons
                name={showNew ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={THEME.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* STRENGTH BAR */}
          {strength && (
            <View style={styles.strengthWrap}>
              <View style={styles.strengthTrack}>
                <View style={[styles.strengthFill, { width: strength.width as any, backgroundColor: strength.color }]} />
              </View>
              <Text style={[styles.strengthLabel, { color: strength.color }]}>
                {strength.label}
              </Text>
            </View>
          )}

          {/* PASSWORD RULES */}
          <View style={styles.rulesBox}>
            {[
              { rule: "At least 8 characters", pass: newPassword.length >= 8 },
              { rule: "One uppercase letter",   pass: /[A-Z]/.test(newPassword) },
              { rule: "One number",             pass: /[0-9]/.test(newPassword) },
              { rule: "One special character",  pass: /[^A-Za-z0-9]/.test(newPassword) },
            ].map((r) => (
              <View key={r.rule} style={styles.ruleRow}>
                <Ionicons
                  name={r.pass ? "checkmark-circle" : "ellipse-outline"}
                  size={14}
                  color={r.pass ? THEME.green : THEME.textMuted}
                />
                <Text style={[styles.ruleTxt, r.pass && { color: THEME.text }]}>
                  {r.rule}
                </Text>
              </View>
            ))}
          </View>

          {/* CONFIRM PASSWORD */}
          <Text style={styles.fieldLabel}>CONFIRM NEW PASSWORD</Text>
          <View style={[
            styles.inputRow,
            confirmPassword.length > 0 && {
              borderColor: confirmPassword === newPassword ? THEME.green : THEME.red,
            },
          ]}>
            <Ionicons name="shield-checkmark-outline" size={18} color={THEME.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Re-enter new password"
              placeholderTextColor={THEME.textMuted}
              secureTextEntry={!showConfirm}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
              <Ionicons
                name={showConfirm ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={THEME.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* MATCH INDICATOR */}
          {confirmPassword.length > 0 && (
            <Text style={[
              styles.matchTxt,
              { color: confirmPassword === newPassword ? THEME.green : THEME.red },
            ]}>
              {confirmPassword === newPassword ? "✓ Passwords match" : "✗ Passwords do not match"}
            </Text>
          )}

          {/* SUBMIT */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleChangePassword}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Ionicons name="lock-closed" size={18} color="#000" />
                <Text style={styles.submitBtnTxt}>UPDATE PASSWORD</Text>
              </>
            )}
          </TouchableOpacity>

          {/* FORGOT PASSWORD */}
          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={() => {
              Alert.alert(
                "Reset Password",
                `A reset link will be sent to ${user?.email}`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Send Link",
                    onPress: async () => {
                      try {
                        await sendPasswordResetEmail(auth, user?.email || "");
                        Alert.alert("Email Sent ✅", "Check your inbox for the reset link.");
                      } catch (e: any) {
                        Alert.alert("Error", e.message);
                      }
                    },
                  },
                ]
              );
            }}
          >
            <Text style={styles.forgotBtnTxt}>Forgot your current password?</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: THEME.bg },
  scroll:        { padding: 20, paddingBottom: 60 },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  backBtn:       { width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  headerTitle:   { color: THEME.text, fontSize: 16, fontWeight: "900" },
  iconCircle:    { width: 80, height: 80, borderRadius: 24, backgroundColor: THEME.accentDim, justifyContent: "center", alignItems: "center", alignSelf: "center", marginTop: 10, marginBottom: 16, borderWidth: 1, borderColor: THEME.accent + "30" },
  subheading:    { color: THEME.textMuted, fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 28 },
  fieldLabel:    { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 10, marginTop: 20 },
  inputRow:      { flexDirection: "row", alignItems: "center", backgroundColor: THEME.ui, borderRadius: 14, paddingHorizontal: 14, height: 52, borderWidth: 1, borderColor: THEME.ui2, gap: 10 },
  input:         { flex: 1, color: THEME.text, fontSize: 14 },
  strengthWrap:  { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  strengthTrack: { flex: 1, height: 4, backgroundColor: THEME.ui2, borderRadius: 2, overflow: "hidden" },
  strengthFill:  { height: "100%", borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: "800", width: 48 },
  rulesBox:      { backgroundColor: THEME.ui, borderRadius: 14, padding: 14, marginTop: 12, borderWidth: 1, borderColor: THEME.ui2, gap: 8 },
  ruleRow:       { flexDirection: "row", alignItems: "center", gap: 8 },
  ruleTxt:       { color: THEME.textMuted, fontSize: 12 },
  matchTxt:      { fontSize: 12, fontWeight: "700", marginTop: 8 },
  submitBtn:     { backgroundColor: THEME.accent, borderRadius: 16, height: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 32 },
  submitBtnTxt:  { color: "#000", fontWeight: "900", fontSize: 14, letterSpacing: 1 },
  forgotBtn:     { alignItems: "center", marginTop: 20 },
  forgotBtnTxt:  { color: THEME.purpleLight, fontSize: 13, fontWeight: "700" },
});