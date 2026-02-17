import React, { useState } from "react";
import { 
  View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, 
  KeyboardAvoidingView, Platform, ScrollView, StatusBar, ActivityIndicator,
  ImageBackground
} from "react-native";
import { LinearGradient } from "expo-linear-gradient"; 
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import DateTimePicker from '@react-native-community/datetimepicker';
import { doc, getDoc, setDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase"; 
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";

const BACKGROUND_IMAGE = { uri: "https://images.unsplash.com/photo-1535905557558-afc4877a26fc?q=80&w=1974&auto=format&fit=crop" };

const getFriendlyError = (code: string) => {
  switch (code) {
    case 'auth/email-already-in-use': return 'This email is already part of Writha.';
    case 'auth/weak-password': return 'The gatekeeper demands a stronger password (8+ chars).';
    case 'auth/invalid-email': return 'That email address seems to be written in an unknown language.';
    default: return 'Writha is currently unreachable. Try again soon.';
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
    firstName: "", lastName: "", username: "", phone: "",
    email: "", password: "", role: "both",
    genres: [] as string[], birthDate: ""
  });

  const calculateAge = (birthday: Date) => {
    const ageDifMs = Date.now() - birthday.getTime();
    return Math.abs(new Date(ageDifMs).getUTCFullYear() - 1970);
  };

  const validateStep = async () => {
    let newErrors: any = {};
    const usernameRegex = /^[a-z0-9_]{3,15}$/;
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (step === 1) {
      if (!form.firstName.trim()) newErrors.firstName = "First name is required.";
      if (!form.lastName.trim()) newErrors.lastName = "Last name is required.";
      if (!form.birthDate) newErrors.birthDate = "We need your birth date.";
      else if (calculateAge(new Date(form.birthDate)) < 13) newErrors.birthDate = "You must be 13+ to join.";
      if (!usernameRegex.test(form.username)) newErrors.username = "3-15 chars, lowercase, numbers/underscores.";
    } else if (step === 2) {
      if (!emailRegex.test(form.email)) newErrors.email = "Invalid email format.";
      if (!phoneRegex.test(form.phone)) newErrors.phone = "Invalid phone (10-15 digits).";
      if (form.password.length < 8) newErrors.password = "Security: 8+ characters.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (step === 1) {
      setLoading(true);
      try {
        const usernameRef = doc(db, "usernames", form.username.toLowerCase());
        const usernameSnap = await getDoc(usernameRef);
        if (usernameSnap.exists()) {
          newErrors.username = "This username is already taken.";
          setErrors(newErrors);
          setLoading(false);
          return;
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }

    setErrors({});
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep(s => s + 1);
  };

  const handleRegister = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const cleanEmail = form.email.trim().toLowerCase();
      const cleanUsername = form.username.trim().toLowerCase();

      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, form.password);
      const uid = userCredential.user.uid;
      
      // 2. Setup Database Records
      const batch = writeBatch(db);
      const userRef = doc(db, "users", uid);
      const usernameRegistryRef = doc(db, "usernames", cleanUsername);

      batch.set(userRef, {
        profile: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          username: cleanUsername,
          birthDate: form.birthDate,
          phone: form.phone.trim(),
          bio: "", 
          avatarUrl: ""
        },
        preferences: { 
          role: form.role, 
          genres: form.genres 
        },
        wallet: { 
          balance: 0,
          currency: "USD",
          isFrozen: false
        },
        social: { 
          followerCount: 0,
          followingCount: 0
        },
        metadata: { 
          uid, 
          email: cleanEmail, 
          createdAt: serverTimestamp(), 
          isVerified: false 
        }
      });

      batch.set(usernameRegistryRef, { uid });

      // 3. Commit Firestore changes
      await batch.commit();

      // 4. Send Verification (Silent)
      try {
        await sendEmailVerification(userCredential.user);
      } catch (emailErr) {
        console.log("Verification email background error", emailErr);
      }
      
      // 5. Success - Go directly to the app
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");

    } catch (error: any) {
      console.error("Signup Crash Prevention:", error);
      Alert.alert("Registration Failed", getFriendlyError(error.code));
      setLoading(false); // Only stop loading if it failed so user can try again
    }
  };

  const updateForm = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
      updateForm('birthDate', selectedDate.toISOString());
    }
  };

  const allGenres = ["Classics", "Sci-Fi", "Philosophy", "Poetry", "Mystery", "History", "Fantasy", "Romance", "Thriller", "Biography"];

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.container}>
      <LinearGradient colors={["rgba(15, 7, 26, 0.8)", "rgba(30, 17, 53, 0.95)"]} style={styles.overlay}>
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            
            <TouchableOpacity onPress={() => step > 1 ? setStep(s => s - 1) : router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFD700" />
            </TouchableOpacity>
            
            <View style={styles.header}>
              <Text style={styles.welcomeMsg}>WELCOME TO WRITHA</Text>
              <Text style={styles.stepIndicator}>STEP 0{step} / 03</Text>
              <Text style={styles.title}>
                {step === 1 ? "Let's get to\nknow you" : step === 2 ? "Security & \nContact" : "Persona"}
              </Text>
            </View>

            {step === 1 && (
              <View style={styles.formSection}>
                <Text style={styles.label}>LEGAL NAME</Text>
                <View style={styles.row}>
                  <TextInput style={[styles.input, {flex: 1, marginRight: 10}]} placeholder="First" placeholderTextColor="#555" onChangeText={t => updateForm('firstName', t)} value={form.firstName} />
                  <TextInput style={[styles.input, {flex: 1}]} placeholder="Last" placeholderTextColor="#555" onChangeText={t => updateForm('lastName', t)} value={form.lastName} />
                </View>
                {(errors.firstName || errors.lastName) && <Text style={styles.errorText}>{errors.firstName || errors.lastName}</Text>}

                <Text style={styles.label}>BIRTH DATE</Text>
                {Platform.OS === 'web' ? (
                  <input type="date" onChange={(e) => updateForm('birthDate', new Date(e.target.value).toISOString())} style={webDateStyle} />
                ) : (
                  <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
                    <Text style={styles.dateText}>{form.birthDate ? new Date(form.birthDate).toLocaleDateString() : "Select Date"}</Text>
                    <Ionicons name="calendar-outline" size={20} color="#FFD700" />
                  </TouchableOpacity>
                )}
                {showDatePicker && Platform.OS !== 'web' && <DateTimePicker value={date} mode="date" display="spinner" onChange={onDateChange} maximumDate={new Date()} />}
                {errors.birthDate && <Text style={styles.errorText}>{errors.birthDate}</Text>}

                <Text style={styles.label}>USERNAME</Text>
                <TextInput style={styles.input} placeholder="@scholar" placeholderTextColor="#555" autoCapitalize="none" onChangeText={t => updateForm('username', t.toLowerCase())} value={form.username} />
                {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
              </View>
            )}

            {step === 2 && (
              <View style={styles.formSection}>
                <Text style={styles.label}>EMAIL ADDRESS</Text>
                <TextInput style={styles.input} placeholder="scholar@writha.com" placeholderTextColor="#555" keyboardType="email-address" autoCapitalize="none" onChangeText={t => updateForm('email', t)} value={form.email} />
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

                <Text style={styles.label}>PHONE NUMBER</Text>
                <TextInput style={styles.input} placeholder="+1..." placeholderTextColor="#555" keyboardType="phone-pad" onChangeText={t => updateForm('phone', t)} value={form.phone} />
                {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

                <Text style={styles.label}>PASSWORD</Text>
                <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor="#555" secureTextEntry onChangeText={t => updateForm('password', t)} value={form.password} />
                {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              </View>
            )}

            {step === 3 && (
              <View style={styles.formSection}>
                <Text style={styles.label}>I AM HERE TO...</Text>
                <View style={styles.roleContainer}>
                  {['reader', 'writer', 'both'].map((r) => (
                    <TouchableOpacity key={r} style={[styles.roleBtn, form.role === r && styles.roleBtnActive]} onPress={() => updateForm('role', r)}>
                      <Text style={[styles.roleText, form.role === r && styles.roleTextActive]}>{r.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.label}>INTERESTS</Text>
                <View style={styles.genreGrid}>
                  {allGenres.map((g) => (
                    <TouchableOpacity key={g} style={[styles.genreChip, form.genres.includes(g) && styles.genreActive]} onPress={() => {
                      const exists = form.genres.includes(g);
                      updateForm('genres', exists ? form.genres.filter(x => x !== g) : [...form.genres, g]);
                    }}>
                      <Text style={[styles.genreText, form.genres.includes(g) && styles.genreTextActive]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.mainBtn} onPress={step === 3 ? handleRegister : validateStep} disabled={loading}>
              {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>{step === 3 ? "COMPLETE" : "CONTINUE"}</Text>}
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </ImageBackground>
  );
}

const webDateStyle = { backgroundColor: 'rgba(45, 27, 78, 0.8)', color: '#FFF', padding: 15, borderRadius: 12, border: '1px solid #4C1D95', width: '100%', marginBottom: 15, outline: 'none' };

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { flex: 1, padding: 25 },
  scroll: { flexGrow: 1, paddingBottom: 40 },
  backBtn: { marginTop: 40, marginBottom: 20 },
  header: { marginBottom: 30 },
  welcomeMsg: { color: '#A78BFA', fontSize: 10, letterSpacing: 2, fontWeight: 'bold', marginBottom: 5 },
  stepIndicator: { color: '#FFD700', fontWeight: 'bold', fontSize: 12, marginBottom: 10 },
  title: { color: '#FFF', fontSize: 32, fontWeight: '900' },
  formSection: { marginBottom: 10 },
  row: { flexDirection: 'row', marginBottom: 5 },
  label: { color: '#A78BFA', fontSize: 10, fontWeight: 'bold', marginBottom: 8, marginTop: 15 },
  input: { backgroundColor: 'rgba(45, 27, 78, 0.8)', borderRadius: 12, padding: 15, color: '#FFF', fontSize: 16, borderWidth: 1, borderColor: '#4C1D95' },
  errorText: { color: '#FF4D4D', fontSize: 11, marginTop: 5, fontWeight: 'bold' },
  dateBtn: { backgroundColor: 'rgba(45, 27, 78, 0.8)', borderRadius: 12, padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#4C1D95' },
  dateText: { color: '#FFF', fontSize: 16 },
  roleContainer: { flexDirection: 'row', gap: 10, marginBottom: 25 },
  roleBtn: { flex: 1, padding: 15, borderRadius: 10, backgroundColor: 'rgba(45, 27, 78, 0.8)', alignItems: 'center', borderWidth: 1, borderColor: '#4C1D95' },
  roleBtnActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  roleText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  roleTextActive: { color: '#000' },
  genreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  genreChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(45, 27, 78, 0.8)', borderWidth: 1, borderColor: '#4C1D95' },
  genreActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  genreText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  genreTextActive: { color: '#000' },
  mainBtn: { backgroundColor: '#FFD700', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 30 },
  btnText: { color: '#000', fontWeight: '900', fontSize: 16 }
});