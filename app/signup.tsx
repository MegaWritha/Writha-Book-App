import React, { useState } from "react";
import { 
  View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, 
  KeyboardAvoidingView, Platform, ScrollView, StatusBar, ActivityIndicator 
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import DateTimePicker from '@react-native-community/datetimepicker';
import { collection, query, where, getDocs, setDoc, doc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase"; 
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";

export default function SignupScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [form, setForm] = useState({
    firstName: "", lastName: "", username: "", phone: "",
    email: "", password: "", 
    role: "both",
    genres: [] as string[],
    birthDate: ""
  });

  const validateStep = async () => {
    let newErrors: any = {};
    if (step === 1) {
      if (!form.firstName) newErrors.firstName = "First Name required.";
      if (!form.lastName) newErrors.lastName = "Last Name required.";
      if (!form.birthDate) newErrors.birthDate = "Birth date required.";
      if (form.username.length < 3) newErrors.username = "Username too short.";
    } 
    else if (step === 2) {
      if (!form.email.includes("@")) newErrors.email = "Invalid email.";
      if (form.phone.length < 10) newErrors.phone = "Invalid phone number.";
      if (form.password.length < 8) newErrors.password = "Password must be 8+ chars.";
    }
    
    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setStep(step + 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const user = userCredential.user;
      await sendEmailVerification(user);
      
      // SAVE DATA TO FIRESTORE
      await setDoc(doc(db, "users", user.uid), {
        ...form,
        uid: user.uid,
        createdAt: new Date().toISOString()
      });

      Alert.alert("Welcome to Writha", "Check your email to verify your soul.", [
        { text: "Login", onPress: () => router.replace("/login") }
      ]);
    } catch (error: any) {
      Alert.alert("Registration Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
      setForm({...form, birthDate: selectedDate.toLocaleDateString()});
    }
  };

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
          
          <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          
          <View style={styles.header}>
            <Text style={styles.stepIndicator}>STEP 0{step} / 03</Text>
            <Text style={styles.title}>{step === 1 ? "Identity" : step === 2 ? "Security" : "Persona"}</Text>
          </View>

          {step === 1 && (
            <View style={styles.formSection}>
              <Text style={styles.label}>LEGAL NAME</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, {flex: 1, marginRight: 10}]} placeholder="First" placeholderTextColor="#555" onChangeText={t => setForm({...form, firstName: t})} />
                <TextInput style={[styles.input, {flex: 1}]} placeholder="Last" placeholderTextColor="#555" onChangeText={t => setForm({...form, lastName: t})} />
              </View>

              <Text style={styles.label}>BIRTH DATE</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateText}>{form.birthDate || "Select Date"}</Text>
                <Ionicons name="calendar-outline" size={20} color="#FFD700" />
              </TouchableOpacity>
              {showDatePicker && <DateTimePicker value={date} mode="date" display="spinner" onChange={onDateChange} maximumDate={new Date()} />}

              <Text style={styles.label}>USERNAME</Text>
              <TextInput style={styles.input} placeholder="@writer" placeholderTextColor="#555" onChangeText={t => setForm({...form, username: t})} />
            </View>
          )}

          {step === 2 && (
            <View style={styles.formSection}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <TextInput style={styles.input} placeholder="scholar@writha.com" placeholderTextColor="#555" onChangeText={t => setForm({...form, email: t})} />
              <Text style={styles.label}>PHONE NUMBER</Text>
              <TextInput style={styles.input} placeholder="+234..." placeholderTextColor="#555" keyboardType="phone-pad" onChangeText={t => setForm({...form, phone: t})} />
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor="#555" secureTextEntry onChangeText={t => setForm({...form, password: t})} />
            </View>
          )}

          {step === 3 && (
            <View style={styles.formSection}>
              <Text style={styles.label}>I AM HERE TO...</Text>
              <View style={styles.roleContainer}>
                {['reader', 'writer', 'both'].map((r) => (
                  <TouchableOpacity key={r} style={[styles.roleBtn, form.role === r && styles.roleBtnActive]} onPress={() => setForm({...form, role: r})}>
                    <Text style={[styles.roleText, form.role === r && styles.roleTextActive]}>{r.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>INTERESTS</Text>
              <View style={styles.genreGrid}>
                {allGenres.map((g) => (
                  <TouchableOpacity key={g} style={[styles.genreChip, form.genres.includes(g) && styles.genreActive]} onPress={() => {
                    const exists = form.genres.includes(g);
                    setForm({...form, genres: exists ? form.genres.filter(x => x !== g) : [...form.genres, g]});
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

          <TouchableOpacity style={{marginTop: 30, alignItems: 'center'}} onPress={() => router.replace("/login")}>
            <Text style={{color: '#A78BFA'}}>Already a scholar? <Text style={{color: '#FFD700', fontWeight: 'bold'}}>Login</Text></Text>
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
  formSection: { marginBottom: 30 },
  row: { flexDirection: 'row', marginBottom: 15 },
  label: { color: '#A78BFA', fontSize: 10, fontWeight: 'bold', marginBottom: 8, marginTop: 10 },
  input: { backgroundColor: '#2D1B4E', borderRadius: 12, padding: 15, color: '#FFF', fontSize: 16, borderWidth: 1, borderColor: '#4C1D95', marginBottom: 15 },
  dateBtn: { backgroundColor: '#2D1B4E', borderRadius: 12, padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#4C1D95' },
  dateText: { color: '#FFF', fontSize: 16 },
  roleContainer: { flexDirection: 'row', gap: 10, marginBottom: 25 },
  roleBtn: { flex: 1, padding: 15, borderRadius: 10, backgroundColor: '#2D1B4E', alignItems: 'center', borderWidth: 1, borderColor: '#4C1D95' },
  roleBtnActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  roleText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  roleTextActive: { color: '#000' },
  genreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  genreChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#2D1B4E', borderWidth: 1, borderColor: '#4C1D95' },
  genreActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  genreText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  genreTextActive: { color: '#000' },
  mainBtn: { backgroundColor: '#FFD700', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 20 },
  btnText: { color: '#000', fontWeight: '900', fontSize: 16 }
});