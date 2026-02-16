import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "expo-router";

export default function EditProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [likes, setLikes] = useState("");

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setFirstName(data.firstName || "");
        setLastName(data.lastName || "");
        setUsername(data.username || "");
        setBio(data.bio || "");
        setLikes((data.likes || []).join(", "));
      }
    };

    loadProfile();
  }, []);

  const handleSave = async () => {
    if (!user) return;

    try {
      await updateDoc(doc(db, "users", user.uid), {
        firstName,
        lastName,
        username,
        bio,
        likes: likes.split(",").map((l) => l.trim()),
        updatedAt: new Date(),
      });

      Alert.alert("Saved", "Your profile has been updated.");
      router.back();
    } catch (e) {
      Alert.alert("Error", "Could not save profile.");
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#4A00E0" />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
      </View>

      <View style={styles.form}>
        <Label text="First Name" />
        <Input value={firstName} onChangeText={setFirstName} />

        <Label text="Last Name" />
        <Input value={lastName} onChangeText={setLastName} />

        <Label text="Username" />
        <Input value={username} onChangeText={setUsername} />

        <Label text="About Me" />
        <TextInput
          style={[styles.input, styles.bio]}
          multiline
          value={bio}
          onChangeText={setBio}
          placeholder="Tell the world who you are…"
        />

        <Label text="Likes / Interests (comma separated)" />
        <Input
          value={likes}
          onChangeText={setLikes}
          placeholder="Poetry, African literature, Philosophy"
        />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveText}>Save Changes</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const Label = ({ text }: { text: string }) => (
  <Text style={styles.label}>{text}</Text>
);

const Input = (props: any) => (
  <TextInput style={styles.input} {...props} />
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F5FB" },

  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#4A00E0" },

  form: {
    padding: 20,
  },
  label: {
    marginTop: 20,
    marginBottom: 6,
    fontWeight: "600",
    color: "#2C005A",
  },
  input: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  bio: {
    height: 120,
    textAlignVertical: "top",
  },
  saveBtn: {
    marginTop: 40,
    backgroundColor: "#4A00E0",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  saveText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 16,
  },
});