import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, StatusBar, ActivityIndicator, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, deleteDoc } from "firebase/firestore";
import { signOut, deleteUser } from "firebase/auth";
import { GestureHandlerRootView } from "react-native-gesture-handler";

type SectionItem = {
  icon: string;
  label: string;
  type: "arrow" | "toggle";
  value?: boolean;
  onPress?: () => void;
  onToggle?: (val: boolean) => void;
};

type Section = {
  title: string;
  items: SectionItem[];
};

export default function SettingsScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [profile,        setProfile]        = useState<any>(null);
  const [loading,        setLoading]        = useState(true);
  const [darkMode,       setDarkMode]       = useState(true);
  const [notifications,  setNotifications]  = useState(true);
  const [emailNotifs,    setEmailNotifs]    = useState(false);
  const [privateAccount, setPrivateAccount] = useState(false);
  const [showActivity,   setShowActivity]   = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setDarkMode(data.darkMode ?? true);
        setNotifications(data.notifications ?? true);
        setEmailNotifs(data.emailNotifs ?? false);
        setPrivateAccount(data.privateAccount ?? false);
        setShowActivity(data.showActivity ?? true);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const updateSetting = async (field: string, value: boolean) => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), { [field]: value });
  };

  const handleLogout = async () => {
    const confirmed = Platform.OS === "web"
      ? window.confirm("Are you sure you want to log out?")
      : await new Promise<boolean>((resolve) =>
          Alert.alert("Log Out", "Are you sure you want to log out?", [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Log Out", style: "destructive", onPress: () => resolve(true) },
          ])
        );

    if (!confirmed) return;

    try {
      await signOut(auth);
    } catch (e) {
      if (Platform.OS === "web") {
        window.alert("Could not log out. Please try again.");
      } else {
        Alert.alert("Error", "Could not log out. Please try again.");
      }
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed1 = Platform.OS === "web"
      ? window.confirm("This will permanently delete your account and all your data. This cannot be undone.")
      : await new Promise<boolean>((resolve) =>
          Alert.alert(
            "Delete Account",
            "This will permanently delete your account and all your data. This cannot be undone.",
            [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: "Delete", style: "destructive", onPress: () => resolve(true) },
            ]
          )
        );

    if (!confirmed1) return;

    const confirmed2 = Platform.OS === "web"
      ? window.confirm("Are you absolutely sure? Your weaves, library, followers and all data will be gone forever.")
      : await new Promise<boolean>((resolve) =>
          Alert.alert(
            "Are you absolutely sure?",
            "Your weaves, library, followers and all data will be gone forever.",
            [
              { text: "No, Keep My Account", style: "cancel", onPress: () => resolve(false) },
              { text: "Yes, Delete Everything", style: "destructive", onPress: () => resolve(true) },
            ]
          )
        );

    if (!confirmed2) return;

    try {
      if (!user) return;
      await deleteDoc(doc(db, "users", user.uid));
      await deleteUser(user);
    } catch (e: any) {
      if (e.code === "auth/requires-recent-login") {
        const logoutNow = Platform.OS === "web"
          ? window.confirm("Session expired. Log out and log back in before deleting. Log out now?")
          : await new Promise<boolean>((resolve) =>
              Alert.alert(
                "Session Expired",
                "For security, please log out and log back in before deleting your account.",
                [
                  { text: "Log Out Now", onPress: () => resolve(true) },
                  { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                ]
              )
            );
        if (logoutNow) await signOut(auth);
      } else {
        if (Platform.OS === "web") {
          window.alert("Could not delete account. Please try again.");
        } else {
          Alert.alert("Error", "Could not delete account. Please try again.");
        }
      }
    }
  };

  const sections: Section[] = [
    {
      title: "ACCOUNT",
      items: [
        { icon: "person-outline",      label: "Edit Profile",    type: "arrow", onPress: () => router.push("/edit-profile") },
        { icon: "lock-closed-outline", label: "Change Password", type: "arrow", onPress: () => router.push("/change-password") },
        { icon: "mail-outline",        label: "Change Email",    type: "arrow", onPress: () => router.push("/change-email") },
      ],
    },
    {
      title: "APPEARANCE",
      items: [
        {
          icon: "moon-outline", label: "Dark Mode", type: "toggle", value: darkMode,
          onToggle: (val) => { setDarkMode(val); updateSetting("darkMode", val); },
        },
      ],
    },
    {
      title: "NOTIFICATIONS",
      items: [
        {
          icon: "notifications-outline", label: "Push Notifications", type: "toggle", value: notifications,
          onToggle: (val) => { setNotifications(val); updateSetting("notifications", val); },
        },
        {
          icon: "mail-outline", label: "Email Notifications", type: "toggle", value: emailNotifs,
          onToggle: (val) => { setEmailNotifs(val); updateSetting("emailNotifs", val); },
        },
      ],
    },
    {
      title: "PRIVACY",
      items: [
        {
          icon: "eye-off-outline", label: "Private Account", type: "toggle", value: privateAccount,
          onToggle: (val) => { setPrivateAccount(val); updateSetting("privateAccount", val); },
        },
        {
          icon: "radio-outline", label: "Show Activity Status", type: "toggle", value: showActivity,
          onToggle: (val) => { setShowActivity(val); updateSetting("showActivity", val); },
        },
        { icon: "shield-checkmark-outline", label: "Blocked Users", type: "arrow", onPress: () => router.push("/blocked-users") },
      ],
    },
    {
      title: "SUPPORT",
      items: [
        { icon: "help-circle-outline",   label: "Help & FAQ",       type: "arrow", onPress: () => router.push("/help") },
        { icon: "document-text-outline", label: "Terms of Service", type: "arrow", onPress: () => router.push("/terms") },
        { icon: "lock-open-outline",     label: "Privacy Policy",   type: "arrow", onPress: () => router.push("/privacy-policy") },
      ],
    },
  ];

  if (loading) return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    </GestureHandlerRootView>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#FFD700" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.profilePreview}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>
              {profile?.firstName?.[0]?.toUpperCase() || "U"}
            </Text>
          </View>
          <View>
            <Text style={styles.profileName}>
              {profile?.firstName} {profile?.lastName}
            </Text>
            <Text style={styles.profileUsername}>
              @{profile?.username || "thinker"}
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionCard}>
                {section.items.map((item, index) => (
                  <TouchableOpacity
                    key={item.label}
                    style={[
                      styles.row,
                      index < section.items.length - 1 && styles.rowBorder,
                    ]}
                    onPress={item.type !== "toggle" ? item.onPress : undefined}
                    activeOpacity={item.type === "toggle" ? 1 : 0.7}
                  >
                    <View style={styles.rowLeft}>
                      <View style={styles.iconWrap}>
                        <Ionicons
                          name={item.icon as any}
                          size={18}
                          color="#FFD700"
                        />
                      </View>
                      <Text style={styles.rowLabel}>{item.label}</Text>
                    </View>
                    {item.type === "toggle" && (
                      <Switch
                        value={item.value}
                        onValueChange={item.onToggle}
                        trackColor={{ false: "#1E1135", true: "#4C1D95" }}
                        thumbColor={item.value ? "#FFD700" : "#666"}
                      />
                    )}
                    {item.type === "arrow" && (
                      <Ionicons name="chevron-forward" size={18} color="#4C1D95" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {/* Danger zone rendered directly */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DANGER ZONE</Text>
            <View style={styles.sectionCard}>
              <TouchableOpacity
                style={[styles.row, styles.rowBorder]}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <View style={styles.rowLeft}>
                  <View style={styles.iconDanger}>
                    <Ionicons name="log-out-outline" size={18} color="#FF4444" />
                  </View>
                  <Text style={styles.dangerLabel}>Log Out</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#FF4444" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.row}
                onPress={handleDeleteAccount}
                activeOpacity={0.7}
              >
                <View style={styles.rowLeft}>
                  <View style={styles.iconDanger}>
                    <Ionicons name="trash-outline" size={18} color="#FF4444" />
                  </View>
                  <Text style={styles.dangerLabel}>Delete Account</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#FF4444" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.version}>MegaWritha Limited • Writha v1.0.0</Text>
          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#0F071A" },
  loader:          { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F071A" },
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  backBtn:         { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1E1135", justifyContent: "center", alignItems: "center" },
  headerTitle:     { fontSize: 20, fontWeight: "800", color: "#FFF" },
  profilePreview:  { flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 20, backgroundColor: "#1E1135", padding: 16, borderRadius: 16, gap: 14, borderWidth: 1, borderColor: "#4C1D95" },
  avatarCircle:    { width: 50, height: 50, borderRadius: 25, backgroundColor: "#4C1D95", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#FFD700" },
  avatarLetter:    { fontSize: 22, fontWeight: "900", color: "#FFD700" },
  profileName:     { fontSize: 16, fontWeight: "800", color: "#FFF" },
  profileUsername: { color: "#A78BFA", marginTop: 2, fontSize: 13 },
  section:         { marginHorizontal: 20, marginBottom: 24 },
  sectionTitle:    { fontSize: 11, fontWeight: "800", color: "#4C1D95", letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 },
  sectionCard:     { backgroundColor: "#1E1135", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#2D1B4E" },
  row:             { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 16 },
  rowBorder:       { borderBottomWidth: 1, borderBottomColor: "#2D1B4E" },
  rowLeft:         { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap:        { width: 34, height: 34, borderRadius: 10, backgroundColor: "#2D1B4E", justifyContent: "center", alignItems: "center" },
  iconDanger:      { width: 34, height: 34, borderRadius: 10, backgroundColor: "#2D0A0A", justifyContent: "center", alignItems: "center" },
  rowLabel:        { fontSize: 15, color: "#FFF", fontWeight: "600" },
  dangerLabel:     { fontSize: 15, color: "#FF4444", fontWeight: "600" },
  version:         { textAlign: "center", color: "#2D1B4E", fontSize: 12, marginBottom: 10, fontWeight: "600" },
});