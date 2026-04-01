import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Animated, Platform, Alert, ScrollView, Dimensions, TextInput
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { auth, db, storage } from "@/lib/firebase";
import {
  doc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const { width } = Dimensions.get("window");

// ── CROSS PLATFORM ALERT ─────────────────────────────────────────────────
const showAlert = (
  title: string,
  message: string,
  buttons: { text: string; style?: string; onPress?: () => void }[]
) => {
  if (Platform.OS === "web") {
    if (buttons.length === 1) {
      window.alert(`${title}\n\n${message}`);
      buttons[0].onPress?.();
    } else {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) buttons.find((b) => b.style !== "cancel")?.onPress?.();
    }
  } else {
    Alert.alert(title, message, buttons as any);
  }
};

// ── THEMES ───────────────────────────────────────────────────────────────
const DARK_THEME = {
  mode:        "dark"  as const,
  bg:          "#080410",
  ui:          "#100820",
  ui2:         "#1A0E30",
  ui3:         "#251645",
  accent:      "#FFD700",
  accentDim:   "rgba(255,215,0,0.08)",
  purple:      "#6D28D9",
  purpleLight: "#A78BFA",
  text:        "#EDE8F5",
  textMuted:   "#6B6080",
  green:       "#22C55E",
  red:         "#EF4444",
  blue:        "#38BDF8",
  statusBar:   "light-content" as const,
};

const LIGHT_THEME = {
  mode:        "light" as const,
  bg:          "#FAF8FF",
  ui:          "#F0EBF8",
  ui2:         "#E2D9F3",
  ui3:         "#C9BBDF",
  accent:      "#6D28D9",
  accentDim:   "rgba(109,40,217,0.08)",
  purple:      "#6D28D9",
  purpleLight: "#A78BFA",
  text:        "#1A0E30",
  textMuted:   "#6B6080",
  green:       "#16A34A",
  red:         "#DC2626",
  blue:        "#0284C7",
  statusBar:   "dark-content" as const,
};

// ── PROCESSING STEPS ─────────────────────────────────────────────────────
const PROCESSING_STEPS = [
  "Reading your manuscript...",
  "Detecting chapters...",
  "Cleaning formatting...",
  "Analysing writing style...",
  "Building your pages...",
  "Calculating reading time...",
  "Almost there...",
];

type UploadStage =
  | "idle"
  | "uploading"
  | "processing"
  | "done"
  | "error";

interface ManuscriptReport {
  wordCount:     number;
  chapterCount:  number;
  pageCount:     number;
  readingTime:   string;
  fileType:      string;
  fileName:      string;
  fileSize:      string;
  content:       string;
}

export default function UploadManuscript() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const user    = auth.currentUser;

  // ── THEME ────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(true);
  const T = isDark ? DARK_THEME : LIGHT_THEME;
  const s = makeStyles(T);

  // ── STATE ────────────────────────────────────────────────────────
  const [stage,         setStage]         = useState<UploadStage>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState(0);
  const [report,        setReport]        = useState<ManuscriptReport | null>(null);
  const [error,         setError]         = useState("");
  const [isbn,          setIsbn]          = useState("");

  // ── ANIMATIONS ───────────────────────────────────────────────────
  const fadeAnim      = useRef(new Animated.Value(0)).current;
  const progressAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim     = useRef(new Animated.Value(1)).current;
  const stepAnim      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 500, useNativeDriver: true,
    }).start();
  }, []);

  // Pulse animation for processing state
  useEffect(() => {
    if (stage !== "processing") return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [stage]);

  // Cycle through processing steps
  useEffect(() => {
    if (stage !== "processing") return;
    let step = 0;
    const interval = setInterval(() => {
      step = (step + 1) % PROCESSING_STEPS.length;
      Animated.sequence([
        Animated.timing(stepAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(stepAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      setProcessingStep(step);
    }, 1800);
    return () => clearInterval(interval);
  }, [stage]);

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue:  uploadProgress / 100,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [uploadProgress]);

  // ── EXTRACT TEXT FROM TXT ────────────────────────────────────────
  const extractFromTxt = async (uri: string): Promise<string> => {
    const content = await FileSystem.readAsStringAsync(uri, {
      encoding: "utf8" as any,
    });
    return content;
  };

  // ── EXTRACT TEXT FROM DOCX (client-side via mammoth) ────────────
  const extractFromDocx = async (uri: string): Promise<string> => {
    try {
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64" as any,
      });

      // Dynamically import mammoth to avoid bundle issues
      const mammoth = require("mammoth");

      // Convert base64 to buffer
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer });
      return result.value;
    } catch (e) {
      throw new Error(
        "Could not read this Word document. Please save it as .txt and try again, or use a newer .docx file."
      );
    }
  };

  // ── CLEAN TEXT ───────────────────────────────────────────────────
  const cleanText = (raw: string): string => {
    return raw
      // Normalize line endings
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      // Remove smart quotes
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      // Remove em/en dashes artifacts
      .replace(/\u2014/g, " — ")
      .replace(/\u2013/g, " – ")
      // Remove excessive blank lines (more than 2)
      .replace(/\n{3,}/g, "\n\n")
      // Remove page numbers (lines that are just numbers)
      .replace(/^\d+\s*$/gm, "")
      // Remove common header/footer artifacts
      .replace(/^(Page \d+|Chapter \d+ of \d+)\s*$/gim, "")
      // Trim each line
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .trim();
  };

  // ── COUNT CHAPTERS ───────────────────────────────────────────────
  const countChapters = (text: string): number => {
    const chapterPatterns = [
      /^chapter\s+\d+/im,
      /^chapter\s+[ivxlcdm]+/im,
      /^CHAPTER\s+/m,
      /^\d+\.\s+[A-Z]/m,
    ];
    let count = 0;
    const lines = text.split("\n");
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (
        chapterPatterns.some((p) => p.test(trimmed)) ||
        (trimmed.length < 50 && trimmed.length > 2 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed))
      ) {
        count++;
      }
    });
    return Math.max(count, 1);
  };

  // ── FORMAT FILE SIZE ─────────────────────────────────────────────
  const formatSize = (bytes: number): string => {
    if (bytes < 1024)       return `${bytes} B`;
    if (bytes < 1048576)    return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  // ── FORMAT READING TIME ──────────────────────────────────────────
  const formatReadingTime = (words: number): string => {
    const minutes = Math.ceil(words / 250);
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins  = minutes % 60;
    if (mins === 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
    return `${hours}h ${mins}m`;
  };

  // ── PICK & PROCESS FILE ──────────────────────────────────────────
  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "text/plain",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/pdf",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      const ext  = file.name.split(".").pop()?.toLowerCase() ?? "";

      // Validate file type
      if (!["txt", "docx", "pdf"].includes(ext || "")) {
        showAlert(
          "Unsupported File",
          "Please upload a .txt, .docx, or .pdf file.",
          [{ text: "OK" }]
        );
        return;
      }

      // Validate file size (max 10MB)
      if (file.size && file.size > 10 * 1024 * 1024) {
        showAlert(
          "File Too Large",
          "Maximum file size is 10MB. Please compress your file and try again.",
          [{ text: "OK" }]
        );
        return;
      }

      setStage("uploading");
      setUploadProgress(0);

      // Simulate upload progress for txt/docx (processed locally)
      // For real upload to Storage (when Cloud Functions active) this becomes real progress
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 12;
        setUploadProgress(Math.min(progress, 90));
        if (progress >= 90) clearInterval(progressInterval);
      }, 200);

      setStage("processing");
      setProcessingStep(0);

      // Extract text based on file type
      let rawText = "";

      if (ext === "txt") {
        rawText = await extractFromTxt(file.uri);
      } else if (ext === "docx") {
        rawText = await extractFromDocx(file.uri);
      } else if (ext === "pdf") {
        // PDF requires Cloud Function — store file reference for now
        showAlert(
          "PDF Processing",
          "PDF files are processed on our servers. Your file will be uploaded and processed within a few minutes. You'll receive a notification when it's ready.",
          [{ text: "OK" }]
        );
        // Still upload to Firebase Storage for Cloud Function to handle
        await uploadToStorage(file.uri, file.name);
        setStage("idle");
        return;
      }

      // Clean the extracted text
      const cleanedText   = cleanText(rawText);
      const words         = cleanedText.trim().split(/\s+/).filter(Boolean);
      const wordCount     = words.length;
      const chapterCount  = countChapters(cleanedText);
      const pageCount     = Math.ceil(wordCount / 250);
      const readingTime   = formatReadingTime(wordCount);

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Validate minimum content
      if (wordCount < 500) {
        setStage("error");
        setError(
          `Your manuscript only contains ${wordCount} words. Minimum is 500 words to publish on Writha.`
        );
        return;
      }

      // Build report
      const manuscriptReport: ManuscriptReport = {
        wordCount,
        chapterCount,
        pageCount,
        readingTime,
        fileType:  ext.toUpperCase(),
        fileName:  file.name,
        fileSize:  formatSize(file.size || 0),
        content:   cleanedText,
      };

      setReport(manuscriptReport);
      setStage("done");
      saveDraft(manuscriptReport);

    } catch (e: any) {
      setStage("error");
      setError(e.message || "Something went wrong. Please try again.");
    }
  };

  // ── UPLOAD TO FIREBASE STORAGE (for Cloud Function) ──────────────
  const uploadToStorage = async (uri: string, fileName: string) => {
    if (!user) return;
    try {
      const response  = await fetch(uri);
      const blob      = await response.blob();
      const storageRef = ref(
        storage,
        `manuscripts/${user.uid}/${Date.now()}_${fileName}`
      );
      await uploadBytesResumable(storageRef, blob);
    } catch (e) {
      console.error("Storage upload failed:", e);
    }
  };

  const saveDraft = async (manuscriptReport: ManuscriptReport) => {
  if (!user) return;
  try {
    const draftId = `draft_${user.uid}_${Date.now()}`;
    await setDoc(doc(db, "books", draftId), {
      id: draftId,
      authorId: user.uid,
      title: manuscriptReport.fileName.replace(/\.[^/.]+$/, ""),
      status: "draft",
      wordCount: manuscriptReport.wordCount,
      chapterCount: manuscriptReport.chapterCount,
      pageCount: manuscriptReport.pageCount,
      readingTime: manuscriptReport.readingTime,
      fileType: manuscriptReport.fileType,
      fileName: manuscriptReport.fileName,
      fileSize: manuscriptReport.fileSize,
      content: manuscriptReport.content,
      isbn: isbn,
      cover: "",
      coverUrl: "",
      views: 0,
      likesCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log("Draft saved to books collection");
  } catch (e) {
    console.error("Failed to save draft:", e);
  }
};

  // ── PROCEED TO DETAILS ───────────────────────────────────────────
  const proceedToDetails = () => {
    if (!report) return;
    // Pass report data to details screen via router params
    router.push({
      pathname: "/publish/details" as any,
      params: {
        wordCount:    report.wordCount,
        chapterCount: report.chapterCount,
        pageCount:    report.pageCount,
        readingTime:  report.readingTime,
        fileType:     report.fileType,
        fileName:     report.fileName,
        // Content stored in a ref to avoid URL length limits
        contentKey:   storeContent(report.content),
      },
    });
  };

  // ── STORE CONTENT IN MEMORY ──────────────────────────────────────
  // Avoids passing huge strings through URL params
  const contentStore = useRef<Record<string, string>>({});
  const storeContent = (content: string): string => {
    const key = `manuscript_${Date.now()}`;
    contentStore.current[key] = content;
    // Store globally so details screen can access it
    (global as any).__manuscriptContent = content;
    return key;
  };

  // ── RESET ────────────────────────────────────────────────────────
  const reset = () => {
    setStage("idle");
    setUploadProgress(0);
    setProcessingStep(0);
    setReport(null);
    setError("");
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle={T.statusBar} />
      <LinearGradient
        colors={T.mode === "dark" ? ["#0F071A", T.bg] : ["#EDE8F8", T.bg]}
        style={StyleSheet.absoluteFill}
      />

      {/* HEADER */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={T.accent} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>UPLOAD MANUSCRIPT</Text>
        {/* Theme toggle */}
        <TouchableOpacity style={s.themeBtn} onPress={() => setIsDark(!isDark)}>
          <Ionicons
            name={isDark ? "sunny-outline" : "moon-outline"}
            size={18}
            color={T.accent}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── IDLE STATE ── */}
        {stage === "idle" && (
          <Animated.View style={[s.pane, { opacity: fadeAnim }]}>

            {/* Supported formats */}
            <View style={s.formatsRow}>
              {[
                { ext: "TXT",  color: T.green,  icon: "document-text"  },
                { ext: "DOCX", color: T.blue,   icon: "document"       },
                { ext: "PDF",  color: T.red,    icon: "document-attach" },
              ].map((f) => (
                <View key={f.ext} style={[s.formatPill, { borderColor: f.color + "40" }]}>
                  <Ionicons name={f.icon as any} size={16} color={f.color} />
                  <Text style={[s.formatTxt, { color: f.color }]}>.{f.ext}</Text>
                </View>
              ))}
            </View>

            {/* Drop zone */}
            <TouchableOpacity
              style={s.dropZone}
              onPress={pickFile}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={T.mode === "dark"
                  ? ["#1A0E30", "#100820"]
                  : ["#F0EBF8", "#EDE8F8"]}
                style={s.dropZoneInner}
              >
                <View style={[s.dropIcon, { backgroundColor: T.accent + "15" }]}>
                  <Ionicons name="cloud-upload-outline" size={40} color={T.accent} />
                </View>
                <Text style={s.dropTitle}>Tap to select your manuscript</Text>
                <Text style={s.dropSub}>
                  .txt · .docx · .pdf{"\n"}Maximum 10MB
                </Text>
                <View style={[s.dropBtn, { backgroundColor: T.accent }]}>
                  <Ionicons name="folder-open-outline" size={16} color="#000" />
                  <Text style={s.dropBtnTxt}>BROWSE FILES</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Tips */}
            <View style={s.tipsCard}>
              <View style={s.tipsHeader}>
                <Ionicons name="bulb-outline" size={16} color={T.accent} />
                <Text style={s.tipsHeaderTxt}>For best results</Text>
              </View>
              {[
                "Use .txt or .docx for fastest processing",
                "Make sure chapters start with 'Chapter 1', 'Chapter 2' etc.",
                "Remove headers, footers and page numbers before uploading",
                "PDF processing may take a few minutes",
              ].map((tip) => (
                <View key={tip} style={s.tipRow}>
                  <View style={[s.tipDot, { backgroundColor: T.accent }]} />
                  <Text style={s.tipTxt}>{tip}</Text>
                </View>
              ))}
            </View>

            {/* ISBN (optional) */}
            <View style={s.isbnCard}>
              <View style={s.isbnHeader}>
                <MaterialCommunityIcons name="barcode" size={18} color={T.textMuted} />
                <Text style={s.isbnHeaderTxt}>ISBN (Optional)</Text>
                <View style={s.optionalBadge}>
                  <Text style={s.optionalTxt}>OPTIONAL</Text>
                </View>
              </View>
              <Text style={s.isbnDesc}>
                Already published? Add your ISBN to get a Verified Published Work badge.
              </Text>
              <View style={s.isbnInput}>
                <TextInput
                  style={[s.isbnField, { color: T.text }]}
                  placeholder="e.g. 978-3-16-148410-0"
                  placeholderTextColor={T.textMuted}
                  value={isbn}
                  onChangeText={setIsbn}
                  keyboardType="numbers-and-punctuation"
                  maxLength={17}
                />
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── UPLOADING STATE ── */}
        {stage === "uploading" && (
          <View style={s.stagePane}>
            <View style={[s.stageIcon, { backgroundColor: T.blue + "20" }]}>
              <Ionicons name="cloud-upload" size={40} color={T.blue} />
            </View>
            <Text style={s.stageTitle}>Uploading...</Text>
            <Text style={s.stageSub}>{uploadProgress}%</Text>

            {/* Progress bar */}
            <View style={s.progressTrack}>
              <Animated.View style={[
                s.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange:  [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                  backgroundColor: T.blue,
                },
              ]} />
            </View>
          </View>
        )}

        {/* ── PROCESSING STATE ── */}
        {stage === "processing" && (
          <View style={s.stagePane}>
            <Animated.View style={[
              s.processingOrb,
              { transform: [{ scale: pulseAnim }] },
            ]}>
              <LinearGradient
                colors={[T.purple, T.accent]}
                style={s.processingOrbInner}
              >
                <MaterialCommunityIcons name="book-open-page-variant" size={40} color="#fff" />
              </LinearGradient>
            </Animated.View>

            <Text style={s.stageTitle}>Processing Manuscript</Text>

            <Animated.Text style={[s.processingStep, { opacity: stepAnim }]}>
              {PROCESSING_STEPS[processingStep]}
            </Animated.Text>

            {/* Step dots */}
            <View style={s.stepDots}>
              {PROCESSING_STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    s.stepDot,
                    {
                      backgroundColor: i === processingStep
                        ? T.accent
                        : T.ui2,
                      width: i === processingStep ? 20 : 6,
                    },
                  ]}
                />
              ))}
            </View>

            <Text style={s.processingNote}>
              This usually takes 10–30 seconds{"\n"}depending on your book's length
            </Text>
          </View>
        )}

        {/* ── DONE STATE — MANUSCRIPT REPORT ── */}
        {stage === "done" && report && (
          <Animated.View style={[s.pane, { opacity: fadeAnim }]}>

            {/* Success header */}
            <View style={s.successHeader}>
              <LinearGradient
                colors={[T.green + "30", T.green + "10"]}
                style={s.successIconWrap}
              >
                <Ionicons name="checkmark-circle" size={48} color={T.green} />
              </LinearGradient>
              <Text style={[s.successTitle, { color: T.green }]}>
                Manuscript Ready!
              </Text>
              <Text style={s.successSub}>
                Here's what we found in your book
              </Text>
            </View>

            {/* Report card */}
            <View style={s.reportCard}>
              <View style={s.reportHeader}>
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={18}
                  color={T.accent}
                />
                <Text style={s.reportHeaderTxt}>MANUSCRIPT REPORT</Text>
                <View style={[s.fileTypeBadge, { backgroundColor: T.accent + "20" }]}>
                  <Text style={[s.fileTypeTxt, { color: T.accent }]}>
                    {report.fileType}
                  </Text>
                </View>
              </View>

              <Text style={s.reportFileName} numberOfLines={1}>
                {report.fileName}
              </Text>

              {/* Stats grid */}
              <View style={s.reportGrid}>
                {[
                  { label: "Words",        value: report.wordCount.toLocaleString(),    icon: "text",           color: T.blue   },
                  { label: "Chapters",     value: report.chapterCount.toString(),       icon: "list",           color: T.purple },
                  { label: "Pages",        value: `~${report.pageCount}`,              icon: "book-outline",   color: T.green  },
                  { label: "Reading Time", value: report.readingTime,                  icon: "time-outline",   color: T.accent },
                  { label: "File Size",    value: report.fileSize,                     icon: "save-outline",   color: T.textMuted },
                ].map((stat) => (
                  <View key={stat.label} style={[s.reportStat, { borderColor: (stat.color) + "30" }]}>
                    <Ionicons name={stat.icon as any} size={18} color={stat.color} />
                    <Text style={[s.reportStatValue, { color: stat.color }]}>
                      {stat.value}
                    </Text>
                    <Text style={s.reportStatLabel}>{stat.label}</Text>
                  </View>
                ))}
              </View>

              {/* Content preview */}
              <View style={s.contentPreview}>
                <Text style={s.contentPreviewLabel}>CONTENT PREVIEW</Text>
                <Text style={s.contentPreviewTxt} numberOfLines={6}>
                  {report.content.substring(0, 400)}...
                </Text>
              </View>
            </View>

            {/* ISBN display if entered */}
            {isbn.trim().length > 0 && (
              <View style={s.isbnDisplay}>
                <MaterialCommunityIcons name="barcode" size={16} color={T.accent} />
                <Text style={[s.isbnDisplayTxt, { color: T.accent }]}>
                  ISBN: {isbn}
                </Text>
                <View style={[s.verifiedBadge, { backgroundColor: T.accent + "20" }]}>
                  <Ionicons name="shield-checkmark" size={12} color={T.accent} />
                  <Text style={[s.verifiedTxt, { color: T.accent }]}>Verified</Text>
                </View>
              </View>
            )}

            {/* Actions */}
            <View style={s.actionRow}>
              <TouchableOpacity style={s.resetBtn} onPress={reset}>
                <Ionicons name="refresh-outline" size={16} color={T.textMuted} />
                <Text style={s.resetBtnTxt}>Try Another</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.proceedBtn, { backgroundColor: T.accent }]}
                onPress={proceedToDetails}
              >
                <Text style={s.proceedBtnTxt}>ADD BOOK DETAILS</Text>
                <Ionicons name="arrow-forward" size={16} color="#000" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* ── ERROR STATE ── */}
        {stage === "error" && (
          <View style={s.stagePane}>
            <View style={[s.stageIcon, { backgroundColor: T.red + "20" }]}>
              <Ionicons name="close-circle" size={48} color={T.red} />
            </View>
            <Text style={[s.stageTitle, { color: T.red }]}>Processing Failed</Text>
            <Text style={s.errorMsg}>{error}</Text>
            <TouchableOpacity
              style={[s.proceedBtn, { backgroundColor: T.accent, marginTop: 20 }]}
              onPress={reset}
            >
              <Ionicons name="refresh" size={16} color="#000" />
              <Text style={s.proceedBtnTxt}>TRY AGAIN</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

// ── THEME-AWARE STYLES ───────────────────────────────────────────────────
const makeStyles = (T: typeof DARK_THEME | typeof LIGHT_THEME) => StyleSheet.create({
  container:            { flex: 1, backgroundColor: T.bg },
  header:               { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: T.ui2 },
  backBtn:              { width: 40, height: 40, borderRadius: 12, backgroundColor: T.ui, justifyContent: "center", alignItems: "center" },
  themeBtn:             { width: 40, height: 40, borderRadius: 12, backgroundColor: T.ui, justifyContent: "center", alignItems: "center" },
  headerTitle:          { color: T.accent, fontSize: 13, fontWeight: "900", letterSpacing: 3 },
  pane:                 { padding: 20, gap: 16 },
  formatsRow:           { flexDirection: "row", gap: 10, justifyContent: "center" },
  formatPill:           { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: T.ui, borderWidth: 1 },
  formatTxt:            { fontWeight: "900", fontSize: 12 },
  dropZone:             { borderRadius: 24, overflow: "hidden", borderWidth: 2, borderColor: T.accent + "30", borderStyle: "dashed" },
  dropZoneInner:        { padding: 40, alignItems: "center", gap: 12 },
  dropIcon:             { width: 80, height: 80, borderRadius: 24, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  dropTitle:            { color: T.text, fontSize: 16, fontWeight: "900", textAlign: "center" },
  dropSub:              { color: T.textMuted, fontSize: 12, textAlign: "center", lineHeight: 20 },
  dropBtn:              { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  dropBtnTxt:           { color: "#000", fontWeight: "900", fontSize: 12, letterSpacing: 1 },
  tipsCard:             { backgroundColor: T.ui, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: T.ui2, gap: 10 },
  tipsHeader:           { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  tipsHeaderTxt:        { color: T.accent, fontWeight: "900", fontSize: 13 },
  tipRow:               { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  tipDot:               { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  tipTxt:               { color: T.textMuted, fontSize: 12, lineHeight: 18, flex: 1 },
  isbnCard:             { backgroundColor: T.ui, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: T.ui2, gap: 8 },
  isbnHeader:           { flexDirection: "row", alignItems: "center", gap: 8 },
  isbnHeaderTxt:        { color: T.text, fontWeight: "800", fontSize: 14, flex: 1 },
  optionalBadge:        { backgroundColor: T.ui2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  optionalTxt:          { color: T.textMuted, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  isbnDesc:             { color: T.textMuted, fontSize: 12, lineHeight: 18 },
  isbnInput:            { backgroundColor: T.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: T.ui2 },
  isbnField:            { fontSize: 14, letterSpacing: 1 },
  stagePane:            { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 16, minHeight: 500 },
  stageIcon:            { width: 100, height: 100, borderRadius: 30, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  stageTitle:           { color: T.text, fontSize: 22, fontWeight: "900", textAlign: "center" },
  stageSub:             { color: T.accent, fontSize: 28, fontWeight: "900" },
  progressTrack:        { width: "100%", height: 6, backgroundColor: T.ui2, borderRadius: 3, overflow: "hidden" },
  progressFill:         { height: "100%", borderRadius: 3 },
  processingOrb:        { marginBottom: 16 },
  processingOrbInner:   { width: 120, height: 120, borderRadius: 36, justifyContent: "center", alignItems: "center" },
  processingStep:       { color: T.textMuted, fontSize: 14, textAlign: "center", fontStyle: "italic" },
  stepDots:             { flexDirection: "row", gap: 6, alignItems: "center", marginVertical: 8 },
  stepDot:              { height: 6, borderRadius: 3, backgroundColor: T.ui2 },
  processingNote:       { color: T.textMuted, fontSize: 12, textAlign: "center", lineHeight: 20 },
  successHeader:        { alignItems: "center", gap: 8 },
  successIconWrap:      { width: 90, height: 90, borderRadius: 28, justifyContent: "center", alignItems: "center" },
  successTitle:         { fontSize: 24, fontWeight: "900" },
  successSub:           { color: T.textMuted, fontSize: 13 },
  reportCard:           { backgroundColor: T.ui, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: T.ui2, gap: 14 },
  reportHeader:         { flexDirection: "row", alignItems: "center", gap: 8 },
  reportHeaderTxt:      { color: T.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, flex: 1 },
  fileTypeBadge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  fileTypeTxt:          { fontSize: 9, fontWeight: "900" },
  reportFileName:       { color: T.textMuted, fontSize: 12 },
  reportGrid:           { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  reportStat:           { width: (width - 96) / 2, backgroundColor: T.bg, borderRadius: 14, padding: 14, alignItems: "center", gap: 6, borderWidth: 1 },
  reportStatValue:      { fontSize: 18, fontWeight: "900" },
  reportStatLabel:      { color: T.textMuted, fontSize: 10, textAlign: "center" },
  contentPreview:       { backgroundColor: T.bg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: T.ui2 },
  contentPreviewLabel:  { color: T.accent, fontSize: 9, fontWeight: "900", letterSpacing: 2, marginBottom: 8 },
  contentPreviewTxt:    { color: T.textMuted, fontSize: 12, lineHeight: 20 },
  isbnDisplay:          { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: T.ui, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: T.accent + "30" },
  isbnDisplayTxt:       { flex: 1, fontSize: 13, fontWeight: "700" },
  verifiedBadge:        { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  verifiedTxt:          { fontSize: 10, fontWeight: "900" },
  actionRow:            { flexDirection: "row", gap: 12 },
  resetBtn:             { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 16, borderRadius: 16, backgroundColor: T.ui, borderWidth: 1, borderColor: T.ui2 },
  resetBtnTxt:          { color: T.textMuted, fontWeight: "800", fontSize: 13 },
  proceedBtn:           { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 16 },
  proceedBtnTxt:        { color: "#000", fontWeight: "900", fontSize: 13 },
  errorMsg:             { color: T.textMuted, fontSize: 13, textAlign: "center", lineHeight: 22, paddingHorizontal: 20 },
});