import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { auth, db } from "../lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

const { width } = Dimensions.get("window");

const THEME = {
  bg:          "#07030F",
  ui:          "#0F0820",
  ui2:         "#170D2E",
  ui3:         "#201540",
  accent:      "#FFD700",
  accentDim:   "rgba(255,215,0,0.08)",
  purple:      "#6D28D9",
  purpleLight: "#A78BFA",
  purpleDim:   "rgba(109,40,217,0.15)",
  text:        "#EDE8F5",
  textMuted:   "#6B5F80",
  green:       "#22C55E",
  red:         "#EF4444",
  blue:        "#38BDF8",
  border:      "#1A1030",
};

const PLANS = [
  {
    id: "featured",
    name: "Featured Author",
    price: "₦15,000",
    period: "per week",
    description: "Get your book featured in the Pulse feed with a dedicated spotlight card.",
    features: [
      "Featured placement in main feed",
      "Gold badge on your profile",
      "Priority support",
      "Analytics dashboard",
    ],
    popular: true,
  },
  {
    id: "banner",
    name: "Banner Campaign",
    price: "₦25,000",
    period: "per week",
    description: "Premium banner placement at the top of the discovery feed.",
    features: [
      "Top-of-feed banner placement",
      "High visibility guaranteed",
      "Click-through analytics",
      "Custom creative support",
    ],
    popular: false,
  },
  {
    id: "launch",
    name: "Book Launch Package",
    price: "₦50,000",
    period: "one-time",
    description: "Complete launch campaign including push notifications and email blast.",
    features: [
      "Push notification to all users",
      "Featured in weekly digest",
      "Social media shoutout",
      "1-week featured placement",
    ],
    popular: false,
  },
];

const STATS = [
  { value: "12K+", label: "Active Readers", icon: "people-outline" },
  { value: "85%", label: "Engagement Rate", icon: "trending-up-outline" },
  { value: "4.8", label: "Avg. Session (min)", icon: "time-outline" },
  { value: "3x", label: "ROI vs Traditional", icon: "rocket-outline" },
];

export default function AdvertiseScreen() {
  const router = useRouter();
  const uid = auth.currentUser?.uid;
  
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    bookTitle: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!uid) {
      Alert.alert("Sign In Required", "Please sign in to submit an advertising inquiry.");
      return;
    }

    if (!formData.name.trim() || !formData.email.trim() || !formData.bookTitle.trim()) {
      Alert.alert("Missing Information", "Please fill in all required fields.");
      return;
    }

    if (!selectedPlan) {
      Alert.alert("Select a Plan", "Please choose an advertising plan.");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "advertising_inquiries"), {
        userId: uid,
        planId: selectedPlan,
        planName: PLANS.find(p => p.id === selectedPlan)?.name,
        ...formData,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      // Also create a notification for admin (you)
      await addDoc(collection(db, "admin_notifications"), {
        type: "advertising_inquiry",
        message: `New advertising inquiry: ${formData.bookTitle} - ${PLANS.find(p => p.id === selectedPlan)?.name}`,
        userId: uid,
        read: false,
        createdAt: serverTimestamp(),
      });

      setSubmitted(true);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to submit inquiry. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.successContainer}>
          <LinearGradient
            colors={[THEME.accent, THEME.purple]}
            style={styles.successIconBg}
          >
            <Ionicons name="checkmark" size={48} color="#000" />
          </LinearGradient>
          <Text style={styles.successTitle}>Inquiry Received!</Text>
          <Text style={styles.successText}>
            Thank you for your interest. Our team will review your request and contact you within 24 hours.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Back to Feed</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={THEME.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Advertise on Writha</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={[THEME.purpleDim, "transparent"]}
            style={styles.heroGradient}
          >
            <Text style={styles.heroTitle}>
              Reach <Text style={{ color: THEME.accent }}>Thousands</Text> of Active Readers
            </Text>
            <Text style={styles.heroSubtitle}>
              Promote your book to our engaged community of African literature enthusiasts, researchers, and storytellers.
            </Text>
          </LinearGradient>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {STATS.map((stat, index) => (
            <View key={index} style={styles.statCard}>
              <Ionicons name={stat.icon as any} size={20} color={THEME.accent} />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Why Advertise */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why Writha?</Text>
          <View style={styles.benefitsList}>
            {[
              { icon: "target", text: "Targeted audience of book lovers and researchers" },
              { icon: "analytics", text: "Detailed analytics and performance tracking" },
              { icon: "cash-outline", text: "Flexible budgets starting from ₦15,000" },
              { icon: "flash", text: "Quick campaign setup and approval" },
            ].map((benefit, index) => (
              <View key={index} style={styles.benefitItem}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={benefit.icon as any} size={16} color={THEME.accent} />
                </View>
                <Text style={styles.benefitText}>{benefit.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Pricing Plans */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose Your Plan</Text>
          <Text style={styles.sectionSubtitle}>Select the best option for your goals</Text>
          
          {PLANS.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planCard,
                selectedPlan === plan.id && styles.planCardSelected,
                plan.popular && styles.planCardPopular,
              ]}
              onPress={() => setSelectedPlan(plan.id)}
              activeOpacity={0.8}
            >
              {plan.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                </View>
              )}
              
              <View style={styles.planHeader}>
                <View>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planDescription}>{plan.description}</Text>
                </View>
                <View style={styles.priceContainer}>
                  <Text style={styles.planPrice}>{plan.price}</Text>
                  <Text style={styles.planPeriod}>{plan.period}</Text>
                </View>
              </View>

              <View style={styles.featuresList}>
                {plan.features.map((feature, idx) => (
                  <View key={idx} style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color={THEME.green} />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.selectRadio}>
                <View style={[
                  styles.radioOuter,
                  selectedPlan === plan.id && styles.radioOuterSelected
                ]}>
                  {selectedPlan === plan.id && <View style={styles.radioInner} />}
                </View>
                <Text style={[
                  styles.selectText,
                  selectedPlan === plan.id && styles.selectTextActive
                ]}>
                  {selectedPlan === plan.id ? "Selected" : "Select Plan"}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Inquiry Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Get Started</Text>
          <Text style={styles.sectionSubtitle}>Tell us about your book</Text>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Your Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor={THEME.textMuted}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address *</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={THEME.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Book Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Title of the book you want to promote"
                placeholderTextColor={THEME.textMuted}
                value={formData.bookTitle}
                onChangeText={(text) => setFormData({ ...formData, bookTitle: text })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Additional Information</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell us about your target audience, campaign goals, or any questions..."
                placeholderTextColor={THEME.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={formData.message}
                onChangeText={(text) => setFormData({ ...formData, message: text })}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (!selectedPlan || !formData.name || !formData.email || !formData.bookTitle) && 
                styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={submitting || !selectedPlan || !formData.name || !formData.email || !formData.bookTitle}
            >
              {submitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Submit Inquiry</Text>
                  <Ionicons name="arrow-forward" size={18} color="#000" />
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.termsText}>
              By submitting, you agree to our advertising terms. No payment required now—we'll contact you to finalize details.
            </Text>
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Common Questions</Text>
          {[
            {
              q: "How quickly can my campaign start?",
              a: "Campaigns typically go live within 24-48 hours of approval and payment confirmation."
            },
            {
              q: "Can I target specific reader demographics?",
              a: "Yes! We offer targeting by genre preference, reading habits, and geographic location."
            },
            {
              q: "What payment methods do you accept?",
              a: "We accept bank transfers, mobile money, and card payments. Details provided after inquiry approval."
            },
          ].map((faq, idx) => (
            <View key={idx} style={styles.faqItem}>
              <Text style={styles.faqQuestion}>{faq.q}</Text>
              <Text style={styles.faqAnswer}>{faq.a}</Text>
            </View>
          ))}
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: THEME.ui,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  headerTitle: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: "800",
  },

  // Hero
  heroSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  heroGradient: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  heroTitle: {
    color: THEME.text,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 36,
    marginBottom: 12,
  },
  heroSubtitle: {
    color: THEME.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },

  // Stats
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    minWidth: (width - 52) / 2,
    backgroundColor: THEME.ui,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  statValue: {
    color: THEME.accent,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },

  // Sections
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: THEME.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
  },
  sectionSubtitle: {
    color: THEME.textMuted,
    fontSize: 14,
    marginBottom: 16,
  },

  // Benefits
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: THEME.ui,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  benefitIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: THEME.accentDim,
    justifyContent: "center",
    alignItems: "center",
  },
  benefitText: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },

  // Plans
  planCard: {
    backgroundColor: THEME.ui,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: THEME.border,
    position: "relative",
  },
  planCardSelected: {
    borderColor: THEME.accent,
    backgroundColor: THEME.accentDim,
  },
  planCardPopular: {
    borderColor: THEME.purple,
  },
  popularBadge: {
    position: "absolute",
    top: -12,
    right: 20,
    backgroundColor: THEME.purple,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  popularBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  planName: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  planDescription: {
    color: THEME.textMuted,
    fontSize: 13,
    lineHeight: 18,
    maxWidth: "60%",
  },
  priceContainer: {
    alignItems: "flex-end",
  },
  planPrice: {
    color: THEME.accent,
    fontSize: 22,
    fontWeight: "900",
  },
  planPeriod: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  featuresList: {
    gap: 10,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureText: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: "500",
  },
  selectRadio: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: THEME.textMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  radioOuterSelected: {
    borderColor: THEME.accent,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.accent,
  },
  selectText: {
    color: THEME.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  selectTextActive: {
    color: THEME.accent,
  },

  // Form
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    backgroundColor: THEME.ui,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: THEME.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  textArea: {
    height: 100,
    paddingTop: 14,
  },
  submitButton: {
    backgroundColor: THEME.accent,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "900",
  },
  termsText: {
    color: THEME.textMuted,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 16,
  },

  // FAQ
  faqItem: {
    backgroundColor: THEME.ui,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  faqQuestion: {
    color: THEME.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  faqAnswer: {
    color: THEME.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },

  // Success State
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  successIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  successTitle: {
    color: THEME.text,
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 12,
    textAlign: "center",
  },
  successText: {
    color: THEME.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 32,
  },
  backButton: {
    backgroundColor: THEME.ui,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  backButtonText: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: "700",
  },
});