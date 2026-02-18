import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  ImageBackground
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";
import { doc, getDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";

const BACKGROUND_IMAGE = {
  uri: "https://images.unsplash.com/photo-1535905557558-afc4877a26fc?q=80&w=1974&auto=format&fit=crop"
};

const getFriendlyError = (code: string) => {
  switch (code) {
    case "auth/email-already-in-use":
      return "This email is already part of Writha.";
    case "auth/weak-password":
      return "Password must be at least 8 characters.";
    case "auth/invalid-email":
      return "Invalid email format.";
    default:
      return "Something went wrong. Try again.";
  }
};

export default function SignupScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    phone: "",
    email: "",
    password: "",
    genres: [] as string[],
    birthDate: ""
  });

  const calculateAge = (birthday: Date) => {
    const ageDifMs = Date.now() - birthday.getTime();
    return Math.abs(new Date(ageDifMs).getUTCFullYear() - 1970);
  };

  const updateForm = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const validateStep = async () => {
    let newErrors: any = {};
    const usernameRegex = /^[a-z0-9_]{3,15}$/;
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (step === 1) {
      if (!form.firstName.trim()) newErrors.firstName = "First name required.";
      if (!form.lastName.trim()) newErrors.lastName = "Last name required.";
      if (!form.birthDate) newErrors.birthDate = "Birth date required.";
      else if (calculateAge(new Date(form.birthDate)) < 13)
        newErrors.birthDate = "Must be 13+.";
      if (!usernameRegex.test(form.username))
        newErrors.username = "3-15 lowercase letters/numbers.";
    }

    if (step === 2) {
      if (!emailRegex.test(form.email)) newErrors.email = "Invalid email.";
      if (!phoneRegex.test(form.phone)) newErrors.phone = "Invalid phone.";
      if (form.password.length < 8)
        newErrors.password = "Min 8 characters.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (step === 1) {
      setLoading(true);
      const usernameRef = doc(db, "usernames", form.username.toLowerCase());
      const usernameSnap = await getDoc(usernameRef);
      if (usernameSnap.exists()) {
        setErrors({ username: "Username already taken." });
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    setErrors({});
    setStep(s => s + 1);
  };

  const handleRegister = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const cleanEmail = form.email.trim().toLowerCase();
      const cleanUsername = form.username.trim().toLowerCase();

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        form.password
      );

      const uid = userCredential.user.uid;

      const batch = writeBatch(db);
      const userRef = doc(db, "users", uid);
      const usernameRegistryRef = doc(db, "usernames", cleanUsername);

      batch.set(userRef, {
        uid,
        fullName: `${form.firstName.trim()} ${form.lastName.trim()}`,
        username: cleanUsername,
        email: cleanEmail,
        phone: form.phone.trim(),
        birthDate: form.birthDate,

        role: "user",
        isAuthor: false,
        profileCompleted: true,
        isVerified: false,

        followerCount: 0,
        followingCount: 0,
        friendCount: 0,

        booksPublished: 0,
        researchPublished: 0,
        weaveCount: 0,
        booksRead: 0,

        totalLikesReceived: 0,
        totalCommentsReceived: 0,

        walletBalance: 0,
        walletPending: 0,
        walletTotalEarned: 0,

        institution: "",
        bio: "",
        photoURL: "",
        interests: form.genres || [],

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(usernameRegistryRef, {
        uid,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      try {
        await sendEmailVerification(userCredential.user);
      } catch {}

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      }

      router.replace("/(tabs)");
    } catch (error: any) {
      Alert.alert("Registration Failed", getFriendlyError(error.code));
      setLoading(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
      updateForm("birthDate", selectedDate.toISOString());
    }
  };

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.container}>
      <LinearGradient
        colors={["rgba(15, 7, 26, 0.8)", "rgba(30, 17, 53, 0.95)"]}
        style={styles.overlay}
      >
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.welcomeMsg}>WELCOME TO WRITHA</Text>
              <Text style={styles.stepIndicator}>
                STEP 0{step} / 02
              </Text>
              <Text style={styles.title}>
                {step === 1 ? "Let's get to know you" : "Security & Contact"}
              </Text>
            </View>

            {step === 1 && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="First Name"
                  placeholderTextColor="#999"
                  value={form.firstName}
                  onChangeText={(t) => updateForm("firstName", t)}
                />
                {errors.firstName && (
                  <Text style={styles.error}>{errors.firstName}</Text>
                )}

                <TextInput
                  style={styles.input}
                  placeholder="Last Name"
                  placeholderTextColor="#999"
                  value={form.lastName}
                  onChangeText={(t) => updateForm("lastName", t)}
                />
                {errors.lastName && (
                  <Text style={styles.error}>{errors.lastName}</Text>
                )}

                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  value={form.username}
                  onChangeText={(t) => updateForm("username", t)}
                />
                {errors.username && (
                  <Text style={styles.error}>{errors.username}</Text>
                )}

                <TouchableOpacity
                  style={styles.dateBtn}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={{ color: form.birthDate ? "#FFF" : "#999" }}>
                    {form.birthDate
                      ? new Date(form.birthDate).toDateString()
                      : "Select Birth Date"}
                  </Text>
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    onChange={onDateChange}
                  />
                )}
              </>
            )}

            {step === 2 && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={form.email}
                  onChangeText={(t) => updateForm("email", t)}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Phone"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                  value={form.phone}
                  onChangeText={(t) => updateForm("phone", t)}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#999"
                  secureTextEntry
                  value={form.password}
                  onChangeText={(t) => updateForm("password", t)}
                />
              </>
            )}

            <TouchableOpacity
              style={styles.mainBtn}
              onPress={step === 2 ? handleRegister : validateStep}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.btnText}>
                  {step === 2 ? "COMPLETE" : "CONTINUE"}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { flex: 1, padding: 25 },
  scroll: { flexGrow: 1, paddingBottom: 40 },
  header: { marginTop: 60, marginBottom: 30 },
  welcomeMsg: {
    color: "#A78BFA",
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "bold",
    marginBottom: 5
  },
  stepIndicator: {
    color: "#FFD700",
    fontWeight: "bold",
    fontSize: 12,
    marginBottom: 10
  },
  title: {
    color: "#FFF",
    fontSize: 28,
    fontWeight: "900"
  },
  input: {
    backgroundColor: "rgba(45, 27, 78, 0.8)",
    color: "#FFF",
    padding: 15,
    borderRadius: 12,
    marginBottom: 12
  },
  dateBtn: {
    backgroundColor: "rgba(45, 27, 78, 0.8)",
    padding: 15,
    borderRadius: 12,
    marginBottom: 12
  },
  error: {
    color: "#FF6B6B",
    marginBottom: 10,
    fontSize: 12
  },
  mainBtn: {
    backgroundColor: "#FFD700",
    padding: 18,
    borderRadius: 15,
    alignItems: "center",
    marginTop: 20
  },
  btnText: {
    color: "#000",
    fontWeight: "900",
    fontSize: 16
  }
});