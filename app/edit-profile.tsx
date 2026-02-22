import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, StatusBar, ActivityIndicator, Image
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";

export default function EditProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [coverPic, setCoverPic] = useState("");

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setFirstName(data.firstName || "");
        setLastName(data.lastName || "");
        setUsername(data.username || "");
        setBio(data.bio || "");
        setWebsite(data.website || "");
        setProfilePic(data.profilePic || "");
        setCoverPic(data.coverPic || "");
      }
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const pickImage = async (field: "profilePic" | "coverPic") => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: field === "coverPic" ? [3, 1] : [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      if (field === "profilePic") setProfilePic(uri);
      else setCoverPic(uri);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!firstName.trim()) {
      Alert.alert("Error", "First name cannot be empty.");
      return;
    }
    if (!username.trim()) {
      Alert.alert("Error", "Username cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim(),
        website: website.trim(),
        profilePic,
        coverPic,
        updatedAt: new Date(),
      });
      Alert.alert("Success", "Profile updated successfully!", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color="#FFD700" />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFD700" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={styles.saveBtn}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color="#0F071A" />
            : <Text style={styles.saveBtnText}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* COVER PHOTO */}
        <View style={styles.coverWrap}>
          {coverPic ? (
            <Image source={{ uri: coverPic }} style={styles.coverImg} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="image-outline" size={32} color="#4C1D95" />
              <Text style={styles.coverPlaceholderText}>Cover Photo</Text>
            </View>
          )}
          <TouchableOpacity style={styles.coverEditBtn} onPress={() => pickImage("coverPic")}>
            <Ionicons name="camera" size={18} color="#FFF" />
            <Text style={styles.coverEditText}>Change Cover</Text>
          </TouchableOpacity>
        </View>

        {/* PROFILE PIC */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            {profilePic ? (
              <Image source={{ uri: profilePic }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarLetter}>
                  {firstName?.[0]?.toUpperCase() || "U"}
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.avatarEditBtn} onPress={() => pickImage("profilePic")}>
              <Ionicons name="camera" size={14} color="#FFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.changePhotoText}>Change Profile Photo</Text>
        </View>

        {/* FORM FIELDS */}
        <View style={styles.form}>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor="#4C1D95"
                autoCapitalize="words"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor="#4C1D95"
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.usernameWrap}>
              <Text style={styles.atSign}>@</Text>
              <TextInput
                style={[styles.input, styles.usernameInput]}
                value={username}
                onChangeText={setUsername}
                placeholder="username"
                placeholderTextColor="#4C1D95"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell the world about yourself..."
              placeholderTextColor="#4C1D95"
              multiline
              maxLength={200}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{bio.length}/200</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Website</Text>
            <TextInput
              style={styles.input}
              value={website}
              onChangeText={setWebsite}
              placeholder="https://yourwebsite.com"
              placeholderTextColor="#4C1D95"
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          {/* EMAIL (READ ONLY) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.readOnlyWrap}>
              <Text style={styles.readOnlyText}>{user?.email}</Text>
              <TouchableOpacity onPress={() => router.push("/change-email")}>
                <Text style={styles.changeLink}>Change</Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F071A" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F071A" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1E1135", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#FFF" },
  saveBtn: { backgroundColor: "#FFD700", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  saveBtnText: { color: "#0F071A", fontWeight: "800", fontSize: 14 },
  coverWrap: { marginHorizontal: 20, height: 160, borderRadius: 16, overflow: "hidden", borderWidth: 2, borderColor: "#4C1D95", marginBottom: 0 },
  coverImg: { width: "100%", height: "100%" },
  coverPlaceholder: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1E1135" },
  coverPlaceholderText: { color: "#4C1D95", marginTop: 8, fontWeight: "600" },
  coverEditBtn: { position: "absolute", bottom: 12, right: 12, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6 },
  coverEditText: { color: "#FFF", fontSize: 13, fontWeight: "600" },
  avatarSection: { alignItems: "center", marginTop: -40, marginBottom: 20 },
  avatarWrap: { position: "relative" },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 4, borderColor: "#0F071A" },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: "#4C1D95", justifyContent: "center", alignItems: "center", borderWidth: 4, borderColor: "#0F071A" },
  avatarLetter: { fontSize: 36, fontWeight: "900", color: "#FFD700" },
  avatarEditBtn: { position: "absolute", bottom: 2, right: 2, backgroundColor: "#FFD700", padding: 8, borderRadius: 16, borderWidth: 3, borderColor: "#0F071A" },
  changePhotoText: { color: "#FFD700", fontWeight: "700", marginTop: 10, fontSize: 13 },
  form: { paddingHorizontal: 20 },
  row: { flexDirection: "row" },
  inputGroup: { marginBottom: 20 },
  label: { color: "#A78BFA", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" },
  input: { backgroundColor: "#1E1135", color: "#FFF", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, borderWidth: 1, borderColor: "#2D1B4E" },
  usernameWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E1135", borderRadius: 12, borderWidth: 1, borderColor: "#2D1B4E", paddingLeft: 16 },
  atSign: { color: "#FFD700", fontWeight: "800", fontSize: 16 },
  usernameInput: { flex: 1, backgroundColor: "transparent", borderWidth: 0, paddingLeft: 4 },
  bioInput: { height: 100, paddingTop: 14 },
  charCount: { color: "#4C1D95", fontSize: 11, textAlign: "right", marginTop: 6 },
  readOnlyWrap: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#1E1135", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: "#2D1B4E" },
  readOnlyText: { color: "#A78BFA", fontSize: 15 },
  changeLink: { color: "#FFD700", fontWeight: "700", fontSize: 13 },
});