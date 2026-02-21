import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Alert
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { WrithaButton } from "../components/WrithaButton";
import { useFeedback } from "../components/FeedbackProvider";

type CreateMode = "DISCUSSION" | "RESEARCH";
type ResearchMethod = "PDF" | "MANUAL" | "SCRIPT";

export default function CreateHub() {
  const router = useRouter();
  const { showFeedback } = useFeedback();
  const user = auth.currentUser;

  if (!user) return null;

  const [mode, setMode] = useState<CreateMode>("DISCUSSION");
  const [researchMethod, setResearchMethod] = useState<ResearchMethod>("MANUAL");
  const [loading, setLoading] = useState(false);
  const [publishToWeb, setPublishToWeb] = useState(false);

  // ---------------- DISCUSSION ----------------
  const [discussionContent, setDiscussionContent] = useState("");

  // ---------------- RESEARCH COMMON ----------------
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [category, setCategory] = useState("Research Paper");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [institution, setInstitution] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState("");

  // ---------------- RESEARCH SPECIFIC ----------------
  const [manualContent, setManualContent] = useState("");
  const [scriptContent, setScriptContent] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfSize, setPdfSize] = useState<number | null>(null);

  // ====================================================
  // DISCUSSION POST (WITH FEED SYNC)
  // ====================================================
  const handlePostDiscussion = async () => {
    if (!discussionContent.trim()) {
      showFeedback("Discussion cannot be empty.", "error");
      return;
    }

    setLoading(true);

    try {
      const discussionPayload = {
        content: discussionContent.trim(),
        userId: user.uid,
        authorName: user.displayName || "Writer",
        authorUsername: user.email?.split('@')[0] || "member",
        authorPhoto: user.photoURL || "",
        likesCount: 0,
        commentsCount: 0,
        publishToWeb,
        type: "discussion",
        createdAt: serverTimestamp()
      };

      // 1. Write to specific Discussions folder
      const discDoc = await addDoc(collection(db, "discussions"), discussionPayload);

      // 2. Write to Global Feed (Bulletin Board)
      await addDoc(collection(db, "feed"), {
        ...discussionPayload,
        originalId: discDoc.id,
      });

      showFeedback("Discussion posted!", "success");
      router.back();
    } catch (e) {
      console.error(e);
      showFeedback("Failed to post discussion.", "error");
    } finally {
      setLoading(false);
    }
  };

  // ====================================================
  // RESEARCH VALIDATION
  // ====================================================
  const validateResearch = () => {
    if (!title.trim()) return "Title is required.";
    if (!abstract.trim()) return "Abstract is required.";
    if (!fieldOfStudy.trim()) return "Field of Study is required.";

    if (isPaid) {
      if (!price || parseFloat(price) <= 0)
        return "Enter a valid price for paid research.";
    }

    if (researchMethod === "MANUAL") {
      if (manualContent.trim().length < 300)
        return "Manual research must be at least 300 characters.";
    }

    if (researchMethod === "SCRIPT") {
      if (!scriptContent.trim())
        return "Script content cannot be empty.";
    }

    if (researchMethod === "PDF") {
      if (!pdfUrl) return "PDF upload required.";
    }

    return null;
  };

  // ====================================================
  // RESEARCH SUBMIT (WITH FEED SYNC & PRICE DATA)
  // ====================================================
  const handleSubmitResearch = async (status: "draft" | "pending") => {
    const error = validateResearch();
    if (error) {
      showFeedback(error, "error");
      return;
    }

    setLoading(true);

    try {
      const parsedPrice = isPaid ? parseFloat(price) : 0;
      
      const researchPayload = {
        userId: user.uid,
        authorName: user.displayName || "Scholar",
        authorUsername: user.email?.split('@')[0] || "scholar",
        authorPhoto: user.photoURL || "",
        title: title.trim(),
        abstract: abstract.trim(),
        category,
        fieldOfStudy: fieldOfStudy.trim(),
        institution: institution.trim(),
        isPaid,
        price: parsedPrice,
        publishToWeb,
        type: "book", // Icon type for Feed
        fileType: researchMethod.toLowerCase(),
        status,
        likesCount: 0,
        downloadsCount: 0,
        viewsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // 1. Write Full Data to Research folder
      const resDoc = await addDoc(collection(db, "research"), {
        ...researchPayload,
        manualContent: researchMethod === "MANUAL" ? manualContent : null,
        scriptContent: researchMethod === "SCRIPT" ? scriptContent : null,
        pdfUrl: researchMethod === "PDF" ? pdfUrl : null,
        pdfSize: researchMethod === "PDF" ? pdfSize : null,
        adminReviewedAt: null,
        adminFeedback: null,
        approvedBy: null,
      });

      // 2. Write Signal to Global Feed (Only if not a draft)
      if (status === "pending") {
        await addDoc(collection(db, "feed"), {
          id: resDoc.id, // Match the research ID
          title: researchPayload.title,
          content: researchPayload.abstract, // Summary for the feed
          authorName: researchPayload.authorName,
          authorUsername: researchPayload.authorUsername,
          authorPhoto: researchPayload.authorPhoto,
          type: "book",
          isPaid: researchPayload.isPaid,
          price: researchPayload.price,
          createdAt: serverTimestamp(),
          likesCount: 0,
          commentsCount: 0
        });
      }

      showFeedback(
        status === "pending"
          ? "Submitted for approval!"
          : "Draft saved successfully!",
        "success"
      );

      router.back();
    } catch (e) {
      console.error(e);
      showFeedback("Submission failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#FFD700" />
        </TouchableOpacity>

        <View style={styles.tabSwitch}>
          {["DISCUSSION", "RESEARCH"].map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setMode(m as CreateMode)}
              style={[styles.tab, mode === m && styles.activeTab]}
            >
              <Text style={[styles.tabText, mode === m && styles.activeTabText]}>
                {m}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          {mode === "DISCUSSION" ? (
            <>
              <TextInput
                style={styles.discInput}
                placeholder="What's on your mind?"
                placeholderTextColor="#666"
                multiline
                maxLength={2000}
                value={discussionContent}
                onChangeText={setDiscussionContent}
              />
              <WebToggle value={publishToWeb} onValueChange={setPublishToWeb} />
              <WrithaButton title="POST NOW" onPress={handlePostDiscussion} loading={loading} />
            </>
          ) : (
            <>
              <View style={styles.methodRow}>
                {["PDF", "MANUAL", "SCRIPT"].map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setResearchMethod(m as ResearchMethod)}
                    style={[styles.methodBtn, researchMethod === m && styles.activeMethod]}
                  >
                    <Text style={[styles.methodText, researchMethod === m && styles.activeMethodText]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Project Title"
                placeholderTextColor="#666"
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                style={[styles.input, { height: 100 }]}
                placeholder="Abstract"
                placeholderTextColor="#666"
                multiline
                value={abstract}
                onChangeText={setAbstract}
              />
              <TextInput
                style={styles.input}
                placeholder="Field of Study"
                placeholderTextColor="#666"
                value={fieldOfStudy}
                onChangeText={setFieldOfStudy}
              />
              <TextInput
                style={styles.input}
                placeholder="Institution (Optional)"
                placeholderTextColor="#666"
                value={institution}
                onChangeText={setInstitution}
              />

              <View style={styles.toggleRow}>
                <Text style={styles.toggleTitle}>Sell this research?</Text>
                <Switch value={isPaid} onValueChange={setIsPaid} />
              </View>

              {isPaid && (
                <TextInput
                  style={styles.input}
                  placeholder="Price"
                  keyboardType="numeric"
                  placeholderTextColor="#666"
                  value={price}
                  onChangeText={setPrice}
                />
              )}

              {researchMethod === "MANUAL" && (
                <TextInput
                  style={styles.richInput}
                  placeholder="Write your research..."
                  placeholderTextColor="#444"
                  multiline
                  value={manualContent}
                  onChangeText={setManualContent}
                />
              )}

              {researchMethod === "SCRIPT" && (
                <TextInput
                  style={styles.richInput}
                  placeholder="Paste script content..."
                  placeholderTextColor="#444"
                  multiline
                  value={scriptContent}
                  onChangeText={setScriptContent}
                />
              )}

              {researchMethod === "PDF" && (
                <TouchableOpacity
                  style={styles.uploadBox}
                  onPress={() => Alert.alert("PDF Upload", "Connect this to Firebase Storage.")}
                >
                  <Text style={styles.uploadText}>Tap to upload PDF (20MB max)</Text>
                </TouchableOpacity>
              )}

              <WebToggle value={publishToWeb} onValueChange={setPublishToWeb} />
              <WrithaButton title="SUBMIT FOR APPROVAL" onPress={() => handleSubmitResearch("pending")} loading={loading} />
              <TouchableOpacity onPress={() => handleSubmitResearch("draft")} style={styles.draftBtn}>
                <Text style={styles.draftBtnText}>Save as Draft</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const WebToggle = ({ value, onValueChange }: any) => (
  <View style={styles.toggleRow}>
    <Text style={styles.toggleTitle}>Publish to Web</Text>
    <Switch value={value} onValueChange={onValueChange} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F071A" },
  header: { marginTop: 60, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20 },
  tabSwitch: { flexDirection: "row", backgroundColor: "#1E1135", borderRadius: 20, padding: 4 },
  tab: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 18 },
  activeTab: { backgroundColor: "#FFD700" },
  tabText: { color: "#A78BFA", fontWeight: "bold" },
  activeTabText: { color: "#000" },
  scroll: { padding: 20 },
  discInput: { color: "#FFF", fontSize: 18, minHeight: 200, textAlignVertical: "top" },
  input: { backgroundColor: "#1E1135", color: "#FFF", padding: 15, borderRadius: 12, marginBottom: 15 },
  richInput: { backgroundColor: "#1E1135", color: "#FFF", padding: 15, borderRadius: 12, minHeight: 300, textAlignVertical: "top", marginBottom: 15 },
  methodRow: { flexDirection: "row", marginBottom: 20, justifyContent: "space-between" },
  methodBtn: { flex: 1, alignItems: "center", padding: 10, borderBottomWidth: 2, borderBottomColor: "#333" },
  activeMethod: { borderBottomColor: "#FFD700" },
  methodText: { color: "#666", fontWeight: "bold" },
  activeMethodText: { color: "#FFD700" },
  uploadBox: { height: 120, borderWidth: 2, borderColor: "#4C1D95", borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 20 },
  uploadText: { color: "#A78BFA" },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 15 },
  toggleTitle: { color: "#FFF", fontWeight: "bold" },
  draftBtn: { marginTop: 10, alignItems: "center" },
  draftBtnText: { color: "#A78BFA", fontWeight: "bold" }
});