import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar,
  ActivityIndicator, ImageBackground, Animated, Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";
import { doc, getDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";

const { width } = Dimensions.get("window");

const BACKGROUND_IMAGE = {
  uri: "https://images.unsplash.com/photo-1535905557558-afc4877a26fc?q=80&w=1974&auto=format&fit=crop",
};

const INTERESTS = [
  { label: "Fiction",     icon: "book-outline"          },
  { label: "Romance",     icon: "heart-outline"         },
  { label: "Mystery",     icon: "search-outline"        },
  { label: "Sci-Fi",      icon: "planet-outline"        },
  { label: "Fantasy",     icon: "sparkles-outline"      },
  { label: "Horror",      icon: "skull-outline"         },
  { label: "History",     icon: "time-outline"          },
  { label: "Self-Help",   icon: "bulb-outline"          },
  { label: "Biography",   icon: "person-outline"        },
  { label: "Poetry",      icon: "pencil-outline"        },
  { label: "Thriller",    icon: "warning-outline"       },
  { label: "Non-Fiction", icon: "newspaper-outline"     },
  { label: "Children",    icon: "happy-outline"         },
  { label: "Comics",      icon: "color-palette-outline" },
  { label: "Religion",    icon: "globe-outline"         },
  { label: "Technology",  icon: "hardware-chip-outline" },
];

const getFriendlyError = (code: string) => {
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password must be at least 8 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/network-request-failed":
      return "No internet connection. Check your network.";
    default:
      return "Something went wrong. Please try again.";
  }
};

const formatDisplayDate = (dateString: string) => {
  if (!dateString) return "Select Date of Birth";
  const d = new Date(dateString);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const getPasswordStrength = (password: string): {
  label: string; color: string; width: string;
} => {
  if (password.length === 0) return { label: "",       color: "transparent", width: "0%"   };
  if (password.length < 6)   return { label: "Weak",   color: "#EF4444",     width: "25%"  };
  if (password.length < 8)   return { label: "Fair",   color: "#F97316",     width: "50%"  };
  if (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password)
  )                           return { label: "Strong", color: "#4ADE80",     width: "100%" };
  return                             { label: "Good",   color: "#FFD700",     width: "75%"  };
};

export default function SignupScreen() {
  const router = useRouter();

  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});

  const [date,           setDate]           = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPassword,   setShowPassword]   = useState(false);

  // Success overlay
  const [signupSuccess,  setSignupSuccess]  = useState(false);
  const successOpacity = useRef(new Animated.Value(0)).current;

  // Toast
  const [toastMsg,  setToastMsg]  = useState("");
  const [toastType, setToastType] = useState<"error" | "success">("error");
  const toastY = useRef(new Animated.Value(-120)).current;

  const [form, setForm] = useState({
    firstName: "",
    lastName:  "",
    username:  "",
    phone:     "",
    email:     "",
    password:  "",
    interests: [] as string[],
    birthDate: "",
  });

  const updateForm = (key: string, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const showToast = (msg: string, type: "error" | "success" = "error") => {
    setToastMsg(msg);
    setToastType(type);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(
        type === "error"
          ? Haptics.NotificationFeedbackType.Error
          : Haptics.NotificationFeedbackType.Success
      );
    }
    Animated.sequence([
      Animated.timing(toastY, { toValue: 60,   duration: 400, useNativeDriver: true }),
      Animated.delay(2800),
      Animated.timing(toastY, { toValue: -120, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  const calculateAge = (birthday: Date) => {
    const diff = Date.now() - birthday.getTime();
    return Math.abs(new Date(diff).getUTCFullYear() - 1970);
  };

  const toggleInterest = (label: string) => {
    const current = form.interests;
    if (current.includes(label)) {
      updateForm("interests", current.filter((i) => i !== label));
    } else {
      if (current.length >= 8) {
        showToast("You can select up to 8 interests.");
        return;
      }
      updateForm("interests", [...current, label]);
    }
  };

  const validateStep = async () => {
    const newErrors: Record<string, string> = {};
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    const phoneRegex    = /^\+?[0-9]{7,15}$/;
    const emailRegex    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (step === 1) {
      if (!form.firstName.trim()) newErrors.firstName = "First name is required.";
      if (!form.lastName.trim())  newErrors.lastName  = "Last name is required.";
      if (!usernameRegex.test(form.username))
        newErrors.username = "3–20 characters, letters, numbers or underscores only.";
      if (!form.birthDate)
        newErrors.birthDate = "Please select your date of birth.";
      else if (calculateAge(new Date(form.birthDate)) < 13)
        newErrors.birthDate = "You must be at least 13 years old to join.";
    }

    if (step === 2) {
      if (!emailRegex.test(form.email))
        newErrors.email = "Please enter a valid email address.";
      if (!phoneRegex.test(form.phone))
        newErrors.phone = "Please enter a valid phone number.";
      if (form.password.length < 8)
        newErrors.password = "Password must be at least 8 characters.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (step === 1) {
      setLoading(true);
      const snap = await getDoc(
        doc(db, "usernames", form.username.trim().toLowerCase())
      );
      if (snap.exists()) {
        setErrors({ username: "This username is already taken." });
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    setErrors({});
    setStep((s) => s + 1);
  };

  const handleRegister = async () => {
    if (loading) return;

    const newErrors: Record<string, string> = {};
    const phoneRegex = /^\+?[0-9]{7,15}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email))
      newErrors.email = "Please enter a valid email address.";
    if (!phoneRegex.test(form.phone))
      newErrors.phone = "Please enter a valid phone number.";
    if (form.password.length < 8)
      newErrors.password = "Password must be at least 8 characters.";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const cleanEmail    = form.email.trim().toLowerCase();
      const cleanUsername = form.username.trim().toLowerCase();

      const userCredential = await createUserWithEmailAndPassword(
        auth, cleanEmail, form.password
      );
      const uid = userCredential.user.uid;

      const batch       = writeBatch(db);
      const userRef     = doc(db, "users",     uid);
      const usernameRef = doc(db, "usernames", cleanUsername);

      batch.set(userRef, {
        uid,
        firstName:             form.firstName.trim(),
        lastName:              form.lastName.trim(),
        fullName:              `${form.firstName.trim()} ${form.lastName.trim()}`,
        username:              cleanUsername,
        email:                 cleanEmail,
        phone:                 form.phone.trim(),
        birthDate:             form.birthDate,
        role:                  "user",
        isAuthor:              false,
        profileCompleted:      true,
        isVerified:            false,
        isOnline:              false,
        followersCount:        0,
        followingCount:        0,
        followerCount:         0,
        friendCount:           0,
        booksPublished:        0,
        researchPublished:     0,
        weaveCount:            0,
        booksRead:             0,
        totalLikesReceived:    0,
        totalCommentsReceived: 0,
        walletBalance:         0,
        walletPending:         0,
        walletTotalEarned:     0,
        institution:           "",
        bio:                   "",
        profilePic:            "",
        photoURL:              "",
        coverPic:              "",
        darkMode:              true,
        notifications:         true,
        emailNotifs:           false,
        privateAccount:        false,
        showActivity:          true,
        interests:             form.interests,
        createdAt:             serverTimestamp(),
        updatedAt:             serverTimestamp(),
      });

      batch.set(usernameRef, { uid, createdAt: serverTimestamp() });
      await batch.commit();

      try {
        await sendEmailVerification(userCredential.user);
      } catch {}

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Show success overlay then navigate
      setSignupSuccess(true);
      Animated.timing(successOpacity, {
        toValue: 1, duration: 400, useNativeDriver: true,
      }).start();
      setTimeout(() => router.replace("/(tabs)"), 2400);

    } catch (error: any) {
      showToast(getFriendlyError(error.code));
      setLoading(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (event.type === "set" && selectedDate) {
      setDate(selectedDate);
      updateForm("birthDate", selectedDate.toISOString());
    } else if (event.type === "dismissed") {
      setShowDatePicker(false);
    }
  };

  const strength = getPasswordStrength(form.password);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={s.container}>
      <View style={s.overlay} />

      {/* Toast */}
      <Animated.View
        style={[
          s.toast,
          { transform: [{ translateY: toastY }] },
          { borderColor: toastType === "success" ? "#4ADE80" : "#FFD700" },
        ]}
      >
        <Ionicons
          name={toastType === "success" ? "checkmark-circle" : "alert-circle"}
          size={18}
          color={toastType === "success" ? "#4ADE80" : "#FFD700"}
        />
        <Text style={s.toastText}>{toastMsg}</Text>
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={s.header}>
            <Text style={s.appName}>WRITHA</Text>
            <Text style={s.stepLabel}>STEP 0{step} / 02</Text>
            <Text style={s.title}>
              {step === 1 ? "Create your account" : "Almost there"}
            </Text>
            <Text style={s.subtitle}>
              {step === 1
                ? "Join millions of readers and storytellers"
                : "Set up your login details and interests"}
            </Text>
          </View>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <>
              {/* First name */}
              <View style={s.inputGroup}>
                <Ionicons name="person-outline" size={17} color="rgba(255,215,0,0.45)" style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="First Name"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={form.firstName}
                  onChangeText={(t) => updateForm("firstName", t)}
                />
              </View>
              {errors.firstName && <Text style={s.error}>{errors.firstName}</Text>}

              {/* Last name */}
              <View style={s.inputGroup}>
                <Ionicons name="person-outline" size={17} color="rgba(255,215,0,0.45)" style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="Last Name"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={form.lastName}
                  onChangeText={(t) => updateForm("lastName", t)}
                />
              </View>
              {errors.lastName && <Text style={s.error}>{errors.lastName}</Text>}

              {/* Username */}
              <View style={s.inputGroup}>
                <Text style={s.atSign}>@</Text>
                <TextInput
                  style={s.input}
                  placeholder="Username"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  autoCapitalize="none"
                  value={form.username}
                  onChangeText={(t) => updateForm("username", t)}
                />
              </View>
              {errors.username && <Text style={s.error}>{errors.username}</Text>}

              {/* Date of birth */}
              {Platform.OS === "web" ? (
                <input
                  type="date"
                  style={{
                    backgroundColor: "rgba(0,0,0,0.45)", color: "#FFF",
                    padding: "15px", borderRadius: "12px", marginBottom: "12px",
                    border: "1px solid rgba(255,255,255,0.07)", outline: "none",
                    width: "100%", fontSize: "15px", fontFamily: "inherit",
                  }}
                  value={form.birthDate ? new Date(form.birthDate).toISOString().split("T")[0] : ""}
                  onChange={(e) => {
                    if (e.target.value)
                      updateForm("birthDate", new Date(e.target.value).toISOString());
                  }}
                />
              ) : (
                <TouchableOpacity
                  style={s.inputGroup}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={17} color="rgba(255,215,0,0.45)" style={s.inputIcon} />
                  <Text style={{ color: form.birthDate ? "#FFF" : "rgba(255,255,255,0.25)", fontSize: 15 }}>
                    {formatDisplayDate(form.birthDate)}
                  </Text>
                </TouchableOpacity>
              )}
              {errors.birthDate && <Text style={s.error}>{errors.birthDate}</Text>}

              {showDatePicker && Platform.OS !== "web" && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  maximumDate={new Date()}
                  onChange={onDateChange}
                />
              )}
              {showDatePicker && Platform.OS === "ios" && (
                <TouchableOpacity
                  style={{ alignSelf: "flex-end", marginBottom: 12 }}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={{ color: "#FFD700", fontWeight: "bold" }}>Done</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <>
              {/* Email */}
              <View style={s.inputGroup}>
                <Ionicons name="mail-outline" size={17} color="rgba(255,215,0,0.45)" style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="Email Address"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  value={form.email}
                  onChangeText={(t) => {
                    updateForm("email", t);
                    if (errors.email) setErrors((e) => ({ ...e, email: "" }));
                  }}
                />
              </View>
              {errors.email && <Text style={s.error}>{errors.email}</Text>}

              {/* Phone */}
              <View style={s.inputGroup}>
                <Ionicons name="call-outline" size={17} color="rgba(255,215,0,0.45)" style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="Phone (e.g. +2348012345678)"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  keyboardType="phone-pad"
                  value={form.phone}
                  onChangeText={(t) => {
                    updateForm("phone", t);
                    if (errors.phone) setErrors((e) => ({ ...e, phone: "" }));
                  }}
                />
              </View>
              {errors.phone && <Text style={s.error}>{errors.phone}</Text>}

              {/* Password */}
              <View style={s.inputGroup}>
                <Ionicons name="lock-closed-outline" size={17} color="rgba(255,215,0,0.45)" style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="Password"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  value={form.password}
                  onChangeText={(t) => {
                    updateForm("password", t);
                    if (errors.password) setErrors((e) => ({ ...e, password: "" }));
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={s.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={19}
                    color="rgba(255,255,255,0.35)"
                  />
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={s.error}>{errors.password}</Text>}

              {/* Password strength */}
              {form.password.length > 0 && (
                <View style={s.strengthRow}>
                  <View style={s.strengthTrack}>
                    <View style={[s.strengthFill, {
                      width: strength.width as any,
                      backgroundColor: strength.color,
                    }]} />
                  </View>
                  <Text style={[s.strengthLabel, { color: strength.color }]}>
                    {strength.label}
                  </Text>
                </View>
              )}

              {/* Interests */}
              <Text style={s.interestTitle}>What are you into?</Text>
              <Text style={s.interestSub}>
                Pick up to 8 — we'll personalise your experience
              </Text>
              <View style={s.interestGrid}>
                {INTERESTS.map((item) => {
                  const selected = form.interests.includes(item.label);
                  return (
                    <TouchableOpacity
                      key={item.label}
                      style={[s.interestPill, selected && s.interestPillActive]}
                      onPress={() => toggleInterest(item.label)}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={14}
                        color={selected ? "#000" : "rgba(255,215,0,0.7)"}
                        style={{ marginRight: 5 }}
                      />
                      <Text style={[
                        s.interestPillTxt,
                        selected && s.interestPillTxtActive,
                      ]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Main action button */}
          <TouchableOpacity
            style={[s.mainBtn, loading && { opacity: 0.7 }]}
            onPress={step === 2 ? handleRegister : validateStep}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={s.btnText}>
                  {step === 2 ? "CREATE ACCOUNT" : "CONTINUE"}
                </Text>
            }
          </TouchableOpacity>

          {/* Back button */}
          {step === 2 && (
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => { setStep(1); setErrors({}); }}
            >
              <Ionicons name="arrow-back-outline" size={16} color="rgba(255,255,255,0.4)" />
              <Text style={s.backBtnTxt}>Back to previous step</Text>
            </TouchableOpacity>
          )}

          {/* Already have an account */}
          <TouchableOpacity
            style={s.loginLink}
            onPress={() => router.push("/login")}
          >
            <Text style={s.loginLinkTxt}>
              Already have an account?{"  "}
              <Text style={s.goldTxt}>Sign In</Text>
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success overlay — mirrors login */}
      {signupSuccess && (
        <Animated.View style={[s.successOverlay, { opacity: successOpacity }]}>
          <Text style={s.successTitle}>Welcome to Writha,</Text>
          <Text style={s.successSub}>Writer.</Text>
          <Text style={s.successNote}>Check your email to verify your account.</Text>
        </Animated.View>
      )}

    </ImageBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  overlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,5,20,0.88)" },

  scroll: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 48,
  },

  // Toast
  toast: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    width: width * 0.88,
    backgroundColor: "rgba(30,17,53,0.98)",
    padding: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    zIndex: 100,
    marginTop: 4,
  },
  toastText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 10,
    flex: 1,
  },

  // Header
  header: {
    marginBottom: 28,
  },
  appName: {
    color: "#FFD700",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 6,
    marginBottom: 14,
  },
  stepLabel: {
    color: "rgba(255,215,0,0.45)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 3,
    marginBottom: 10,
  },
  title: {
    color: "#FFF",
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 6,
  },
  subtitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
  },

  // Inputs
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    marginBottom: 12,
    paddingHorizontal: 16,
    height: 58,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    color: "#FFF",
    fontSize: 15,
  },
  atSign: {
    color: "rgba(255,215,0,0.45)",
    fontSize: 17,
    fontWeight: "800",
    marginRight: 10,
  },
  eyeBtn: { padding: 6 },
  error: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: -6,
    marginBottom: 10,
    marginLeft: 4,
  },

  // Password strength
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    marginTop: -4,
  },
  strengthTrack: {
    flex: 1,
    height: 4,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginRight: 10,
  },
  strengthFill: {
    height: "100%",
    borderRadius: 4,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: "700",
    minWidth: 44,
    textAlign: "right",
  },

  // Interests
  interestTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
    marginTop: 8,
  },
  interestSub: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    marginBottom: 16,
  },
  interestGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 28,
    marginHorizontal: -4,
  },
  interestPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.25)",
    backgroundColor: "rgba(255,215,0,0.05)",
    margin: 4,
  },
  interestPillActive: {
    backgroundColor: "#FFD700",
    borderColor: "#FFD700",
  },
  interestPillTxt: {
    color: "rgba(255,215,0,0.8)",
    fontSize: 12,
    fontWeight: "600",
  },
  interestPillTxtActive: {
    color: "#000",
    fontWeight: "800",
  },

  // Buttons
  mainBtn: {
    backgroundColor: "#FFD700",
    borderRadius: 16,
    height: 58,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#FFD700",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  btnText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    paddingVertical: 8,
  },
  backBtnTxt: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 13,
    marginLeft: 6,
  },
  loginLink: {
    alignItems: "center",
    paddingVertical: 8,
  },
  loginLinkTxt: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
  },
  goldTxt: {
    color: "#FFD700",
    fontWeight: "900",
  },

  // Success overlay — matches login screen pattern
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0F071A",
    justifyContent: "center",
    alignItems: "center",
  },
  successTitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 16,
    fontWeight: "300",
    letterSpacing: 4,
  },
  successSub: {
    color: "#FFD700",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 6,
    marginTop: 4,
  },
  successNote: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 13,
    marginTop: 16,
    letterSpacing: 0.5,
  },
});