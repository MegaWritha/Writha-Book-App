import React, { useState, useRef } from "react";
import { 
  View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, 
  KeyboardAvoidingView, Platform, ScrollView, Dimensions, StatusBar 
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");

export default function SignupScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  // Form State
  const [form, setForm] = useState({
    name: "", username: "", email: "", password: "", genres: [] as string[]
  });

  // Password Strength Logic
  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length > 7) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score; // 0 to 4
  };
  const passStrength = getPasswordStrength(form.password);

  const validateStep = () => {
    let newErrors: any = {};
    if (step === 1) {
      if (!form.name.includes(" ")) newErrors.name = "Please enter your full name.";
      if (form.username.length < 3) newErrors.username = "Username too short.";
    } 
    if (step === 2) {
      if (!form.email.includes("@")) newErrors.email = "Invalid email format.";
      if (form.password.length < 8) newErrors.password = "Password must be 8+ chars.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setStep(step + 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const toggleGenre = (genre: string) => {
    setForm(prev => {
      const exists = prev.genres.includes(genre);
      Haptics.selectionAsync();
      return { 
        ...prev, 
        genres: exists ? prev.genres.filter(g => g !== genre) : [...prev.genres, genre] 
      };
    });
  };

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
              {step === 1 ? "Who are you?" : step === 2 ? "Secure Access" : "Your Taste"}
            </Text>
            <Text style={styles.subtitle}>
              {step === 1 ? "Let's start with your identity." : step === 2 ? "Protect your digital library." : "What do you love to read?"}
            </Text>
          </View>

          {/* STEP 1: IDENTITY */}
          {step === 1 && (
            <View style={styles.formSection}>
              <View style={[styles.inputGroup, errors.name && styles.errorBorder]}>
                <Text style={styles.label}>FULL NAME</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="e.g. Oscar Wilde" 
                  placeholderTextColor="#666"
                  onChangeText={t => setForm({...form, name: t})}
                  value={form.name}
                  selectionColor="#FFD700"
                  cursorColor="#FFD700"
                />
              </View>
              {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

              <View style={[styles.inputGroup, errors.username && styles.errorBorder]}>
                <Text style={styles.label}>USERNAME</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="@writer" 
                  placeholderTextColor="#666"
                  onChangeText={t => setForm({...form, username: t})}
                  value={form.username}
                  autoCapitalize="none"
                  selectionColor="#FFD700"
                  cursorColor="#FFD700"
                />
              </View>
            </View>
          )}

          {/* STEP 2: SECURITY */}
          {step === 2 && (
            <View style={styles.formSection}>
              <View style={[styles.inputGroup, errors.email && styles.errorBorder]}>
                <Text style={styles.label}>EMAIL</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="you@example.com" 
                  placeholderTextColor="#666"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onChangeText={t => setForm({...form, email: t})}
                  selectionColor="#FFD700"
                  cursorColor="#FFD700"
                />
              </View>

              <View style={[styles.inputGroup, errors.password && styles.errorBorder]}>
                <Text style={styles.label}>PASSWORD</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="••••••••" 
                  placeholderTextColor="#666"
                  secureTextEntry
                  onChangeText={t => setForm({...form, password: t})}
                  selectionColor="#FFD700"
                  cursorColor="#FFD700"
                />
              </View>
              
              {/* Strength Meter */}
              <View style={styles.strengthContainer}>
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} style={[styles.strengthBar, { 
                    backgroundColor: i <= passStrength 
                      ? (passStrength < 3 ? "#F59E0B" : "#10B981") 
                      : "#333" 
                  }]} />
                ))}
                <Text style={styles.strengthText}>
                  {passStrength === 0 ? "" : passStrength < 3 ? "Weak" : "Strong"}
                </Text>
              </View>
            </View>
          )}

          {/* STEP 3: PREFERENCES (Genres) */}
          {step === 3 && (
            <View style={styles.formSection}>
              <View style={styles.genreGrid}>
                {["Classics", "Sci-Fi", "Philosophy", "Poetry", "Mystery", "History"].map((g) => (
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

          <TouchableOpacity style={styles.mainBtn} onPress={step === 3 ? () => Alert.alert("Success", "Account Created!") : handleNext}>
            <Text style={styles.btnText}>{step === 3 ? "COMPLETE REGISTRATION" : "CONTINUE"}</Text>
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
  inputGroup: { backgroundColor: '#2D1B4E', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#4C1D95' },
  label: { color: '#A78BFA', fontSize: 10, fontWeight: 'bold', marginBottom: 5 },
  input: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  errorBorder: { borderColor: '#EF4444' },
  errorText: { color: '#EF4444', fontSize: 12, marginTop: -10, marginBottom: 15, marginLeft: 5 },
  
  // Password Strength
  strengthContainer: { flexDirection: 'row', alignItems: 'center', marginTop: -5, gap: 5 },
  strengthBar: { height: 4, width: 30, borderRadius: 2, backgroundColor: '#333' },
  strengthText: { color: '#CCC', fontSize: 10, marginLeft: 10 },

  // Genre Chips
  genreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  genreChip: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, backgroundColor: '#2D1B4E', borderWidth: 1, borderColor: '#4C1D95' },
  genreActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  genreText: { color: '#FFF', fontWeight: 'bold' },
  genreTextActive: { color: '#000' },

  mainBtn: { backgroundColor: '#FFD700', padding: 18, borderRadius: 15, alignItems: 'center', shadowColor: "#FFD700", shadowOpacity: 0.3, shadowRadius: 10, marginTop: 10 },
  btnText: { color: '#000', fontWeight: '900', fontSize: 16 }
});