import React, { useState } from "react";
import { 
  View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, 
  KeyboardAvoidingView, Platform, ScrollView, StatusBar, Modal, ActivityIndicator 
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import DateTimePicker from '@react-native-community/datetimepicker';
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "@/lib/firebase"; 
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";

export default function SignupScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  // Date Picker State
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Form State
  const [form, setForm] = useState({
    firstName: "", lastName: "", username: "", phone: "",
    email: "", password: "", 
    role: "both", // 'reader', 'writer', 'both'
    genres: [] as string[],
    birthDate: ""
  });

  // --- LOGIC: CHECK UNIQUENESS ---
  const checkUniqueness = async () => {
    // 1. Check Username
    const qUsername = query(collection(db, "users"), where("username", "==", form.username));
    const userSnap = await getDocs(qUsername);
    if (!userSnap.empty) throw new Error("This username is already taken.");

    // 2. Check Phone
    const qPhone = query(collection(db, "users"), where("phone", "==", form.phone));
    const phoneSnap = await getDocs(qPhone);
    if (!phoneSnap.empty) throw new Error("This phone number is already linked to an account.");
  };

  // --- VALIDATION STEPS ---
  const validateStep = async () => {
    let newErrors: any = {};
    setLoading(true);

    try {
      if (step === 1) {
        if (!form.firstName) newErrors.firstName = "First Name required.";
        if (!form.lastName) newErrors.lastName = "Last Name required.";
        if (!form.birthDate) newErrors.birthDate = "Birth date required.";
        if (form.username.length < 3) newErrors.username = "Username too short.";
        
        // If basic checks pass, check database for username
        if (Object.keys(newErrors).length === 0) {
           // Simulate DB check (Uncomment real check below when DB is ready)
           // await checkUniqueness(); 
        }
      } 
      else if (step === 2) {
        if (!form.email.includes("@")) newErrors.email = "Invalid email.";
        if (form.phone.length < 10) newErrors.phone = "Invalid phone number.";
        if (form.password.length < 8) newErrors.password = "Password must be 8+ chars.";
      }
      
      setErrors(newErrors);
      const isValid = Object.keys(newErrors).length === 0;

      if (isValid) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setStep(step + 1);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      // 1. Create User
      const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const user = userCredential.user;

      // 2. Send Verification Email
      await sendEmailVerification(user);

      // 3. Save extra data to Firestore (You would do this in your actual Firebase file)
      // await setDoc(doc(db, "users", user.uid), { ...form, uid: user.uid });

      Alert.alert("Welcome to Writha", "Please check your email to verify your account.", [
        { text: "Login Now", onPress: () => router.replace("/") }
      ]);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        Alert.alert("Account Exists", "This email is already registered.");
      } else {
        Alert.alert("Registration Failed", error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
      // Format: DD/MM/YYYY
      setForm({...form, birthDate: selectedDate.toLocaleDateString()});
    }
  };

  const toggleGenre = (genre: string) => {
    setForm(prev => {
      const exists = prev.genres.includes(genre);
      return { ...prev, genres: exists ? prev.genres.filter(g => g !== genre) : [...prev.genres, genre] };
    });
  };

  // Genre List
  const allGenres = [
    "Classics", "Sci-Fi", "Philosophy", "Poetry", "Mystery", 
    "History", "Fantasy", "Romance", "Thriller", "Biography", 
    "Self-Help", "Psychology", "Art", "Politics", "Religion"
  ];

  return (
    <LinearGradient colors={["#0F071A", "#1E1135"]} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          
          {/* Header */}
          <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          
          <View style={styles.header}>
            <Text style={styles.stepIndicator}>STEP 0{step} / 03</Text>
            <Text style={styles.title}>
              {step === 1 ? "Identity" : step === 2 ? "Security" : "User Persona"}
            </Text>
            <Text style={styles.subtitle}>
              {step === 1 ? "Let's get to know you." : step === 2 ? "Secure your contact details." : "Define your literary path."}
            </Text>
          </View>

          {/* STEP 1: IDENTITY */}
          {step === 1 && (
            <View style={styles.formSection}>
              <View style={styles.row}>
                <View style={{flex: 1, marginRight: 10}}>
                  <Text style={styles.label}>FIRST NAME</Text>
                  <TextInput 
                    style={[styles.input, errors.firstName && styles.errorInput]} 
                    placeholder="Rita" 
                    placeholderTextColor="#555"
                    onChangeText={t => setForm({...form, firstName: t})}
                    selectionColor="#FFD700"
                    cursorColor="#FFD700"
                  />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.label}>LAST NAME</Text>
                  <TextInput 
                    style={[styles.input, errors.lastName && styles.errorInput]} 
                    placeholder="Chioma" 
                    placeholderTextColor="#555"
                    onChangeText={t => setForm({...form, lastName: t})}
                    selectionColor="#FFD700"
                    cursorColor="#FFD700"
                  />
                </View>
              </View>

              <Text style={styles.label}>BIRTH DATE</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateText}>{form.birthDate || "Select Date"}</Text>
                <Ionicons name="calendar-outline" size={20} color="#FFD700" />
              </TouchableOpacity>
              {showDatePicker && (
                 <DateTimePicker 
                   value={date} mode="date" display="default" onChange={onDateChange} maximumDate={new Date()}
                 />
              )}

              <Text style={styles.label}>USERNAME (UNIQUE)</Text>
              <View style={[styles.inputGroup, errors.username && styles.errorInput]}>
                <TextInput 
                  style={{flex: 1, color: '#FFF'}} 
                  placeholder="@writer" 
                  placeholderTextColor="#555"
                  autoCapitalize="none"
                  onChangeText={t => setForm({...form, username: t})}
                  selectionColor="#FFD700"
                  cursorColor="#FFD700"
                />
                <Ionicons name="search" size={18} color="#A78BFA" />
              </View>
            </View>
          )}

          {/* STEP 2: CONTACT & SECURITY */}
          {step === 2 && (
            <View style={styles.formSection}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <TextInput 
                style={[styles.input, errors.email && styles.errorInput]} 
                placeholder="you@example.com" 
                placeholderTextColor="#555"
                keyboardType="email-address"
                autoCapitalize="none"
                onChangeText={t => setForm({...form, email: t})}
                selectionColor="#FFD700"
                cursorColor="#FFD700"
              />

              <Text style={styles.label}>PHONE NUMBER</Text>
              <TextInput 
                style={[styles.input, errors.phone && styles.errorInput]} 
                placeholder="+234..." 
                placeholderTextColor="#555"
                keyboardType="phone-pad"
                onChangeText={t => setForm({...form, phone: t})}
                selectionColor="#FFD700"
                cursorColor="#FFD700"
              />

              <Text style={styles.label}>PASSWORD</Text>
              <TextInput 
                style={[styles.input, errors.password && styles.errorInput]} 
                placeholder="••••••••" 
                placeholderTextColor="#555"
                secureTextEntry
                onChangeText={t => setForm({...form, password: t})}
                selectionColor="#FFD700"
                cursorColor="#FFD700"
              />
            </View>
          )}

          {/* STEP 3: PERSONA */}
          {step === 3 && (
            <View style={styles.formSection}>
              <Text style={styles.label}>I AM HERE TO...</Text>
              <View style={styles.roleContainer}>
                {['reader', 'writer', 'both'].map((r) => (
                  <TouchableOpacity 
                    key={r} 
                    style={[styles.roleBtn, form.role === r && styles.roleBtnActive]}
                    onPress={() => setForm({...form, role: r})}
                  >
                    <Text style={[styles.roleText, form.role === r && styles.roleTextActive]}>
                      {r.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>SELECT YOUR INTERESTS</Text>
              <View style={styles.genreGrid}>
                {allGenres.map((g) => (
                  <TouchableOpacity 
                    key={g} 
                    style={[styles.genreChip, form.genres.includes(g) && styles.genreActive]}
                    onPress={() => toggleGenre(g)}
                  >
                    <Text style={[styles.genreText, form.genres.includes(g) && styles.genreTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.mainBtn} onPress={step === 3 ? handleRegister : validateStep} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : (
               <Text style={styles.btnText}>{step === 3 ? "COMPLETE REGISTRATION" : "CONTINUE"}</Text>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, padding: 25 },
  backBtn: { marginTop: 40, marginBottom: 20 },
  header: { marginBottom: 30 },
  stepIndicator: { color: '#FFD700', fontWeight: 'bold', fontSize: 12, marginBottom: 10 },
  title: { color: '#FFF', fontSize: 32, fontWeight: '900' },
  subtitle: { color: '#A78BFA', fontSize: 16, marginTop: 5 },
  formSection: { marginBottom: 30 },
  row: { flexDirection: 'row', marginBottom: 15 },
  label: { color: '#A78BFA', fontSize: 10, fontWeight: 'bold', marginBottom: 8, marginTop: 10 },
  
  input: { 
    backgroundColor: '#2D1B4E', borderRadius: 12, padding: 15, 
    color: '#FFF', fontSize: 16, borderWidth: 1, borderColor: '#4C1D95' 
  },
  inputGroup: { 
    backgroundColor: '#2D1B4E', borderRadius: 12, padding: 15, 
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#4C1D95'
  },
  errorInput: { borderColor: '#EF4444' },

  // Date Picker
  dateBtn: { 
    backgroundColor: '#2D1B4E', borderRadius: 12, padding: 15, 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: '#4C1D95'
  },
  dateText: { color: '#FFF', fontSize: 16 },

  // Role Buttons
  roleContainer: { flexDirection: 'row', gap: 10, marginBottom: 25 },
  roleBtn: { flex: 1, padding: 15, borderRadius: 10, backgroundColor: '#2D1B4E', alignItems: 'center', borderWidth: 1, borderColor: '#4C1D95' },
  roleBtnActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  roleText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  roleTextActive: { color: '#000' },

  // Genre Chips
  genreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  genreChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#2D1B4E', borderWidth: 1, borderColor: '#4C1D95' },
  genreActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  genreText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  genreTextActive: { color: '#000' },

  mainBtn: { backgroundColor: '#FFD700', padding: 18, borderRadius: 15, alignItems: 'center', shadowColor: "#FFD700", shadowOpacity: 0.3, shadowRadius: 10, marginTop: 20 },
  btnText: { color: '#000', fontWeight: '900', fontSize: 16 }
});