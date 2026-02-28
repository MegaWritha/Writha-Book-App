import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, StatusBar, ActivityIndicator, Platform,
  Alert, ScrollView, Switch,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { db, auth } from "@/lib/firebase";
import {
  collection, addDoc, onSnapshot, deleteDoc,
  doc, serverTimestamp, orderBy, query,
} from "firebase/firestore";

const THEME = {
  bg: "#0F071A", ui: "#1E1135", ui2: "#2D1B4D",
  accent: "#FFD700", purple: "#6D28D9", purpleLight: "#A78BFA",
  text: "#E2E8F0", textMuted: "#94A3B8",
  green: "#22C55E", red: "#EF4444", blue: "#38BDF8",
  orange: "#F97316",
};

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

const ANNOUNCEMENT_TYPES = [
  { key: "general",     label: "General",     icon: "megaphone",           color: THEME.blue   },
  { key: "maintenance", label: "Maintenance", icon: "construct",           color: THEME.orange },
  { key: "feature",     label: "New Feature", icon: "sparkles",            color: THEME.green  },
  { key: "warning",     label: "Warning",     icon: "warning",             color: THEME.red    },
  { key: "promo",       label: "Promotion",   icon: "gift",                color: THEME.accent },
  { key: "contest",     label: "Contest",     icon: "trophy",              color: THEME.purple },
];

export default function AnnouncementsScreen() {
  const router = useRouter();
  const user   = auth.currentUser;

  const [loading,       setLoading]       = useState(true);
  const [sending,       setSending]       = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [activeTab,     setActiveTab]     = useState<"create" | "history">("create");

  // ── FORM STATE ───────────────────────────────────────────────────
  const [title,       setTitle]       = useState("");
  const [message,     setMessage]     = useState("");
  const [type,        setType]        = useState("general");
  const [pinned,      setPinned]      = useState(false);
  const [targetAll,   setTargetAll]   = useState(true);

  // ── LOAD ANNOUNCEMENTS ───────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "announcements"), orderBy("createdAt", "desc")),
      (snap) => {
        setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  // ── SEND ANNOUNCEMENT ────────────────────────────────────────────
  const handleSend = async () => {
    if (!title.trim()) {
      showAlert("Title Required", "Add a title for your announcement.", [{ text: "OK" }]);
      return;
    }
    if (!message.trim()) {
      showAlert("Message Required", "Write a message for your announcement.", [{ text: "OK" }]);
      return;
    }

    showAlert(
      "Send Announcement",
      `Send "${title}" to ${targetAll ? "all users" : "active users"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Now",
          onPress: async () => {
            setSending(true);
            try {
              await addDoc(collection(db, "announcements"), {
                title:       title.trim(),
                message:     message.trim(),
                type,
                pinned,
                targetAll,
                sentBy:      user?.uid,
                sentByName:  user?.displayName || "Admin",
                createdAt:   serverTimestamp(),
                readBy:      [],
                isActive:    true,
              });

              showAlert(
                "Sent ✅",
                `Your announcement has been published to the app.`,
                [{ text: "OK" }]
              );

              // Reset form
              setTitle("");
              setMessage("");
              setType("general");
              setPinned(false);
              setActiveTab("history");
            } catch (e: any) {
              showAlert("Error", e.message, [{ text: "OK" }]);
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  // ── DELETE ANNOUNCEMENT ──────────────────────────────────────────
  const handleDelete = (item: any) => {
    showAlert(
      "Delete Announcement",
      `Delete "${item.title}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "announcements", item.id));
            } catch (e: any) {
              showAlert("Error", e.message, [{ text: "OK" }]);
            }
          },
        },
      ]
    );
  };

  const selectedType = ANNOUNCEMENT_TYPES.find((t) => t.key === type);

  const formatDate = (ts: any): string => {
    if (!ts?.toDate) return "";
    return ts.toDate().toLocaleDateString("en-NG", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={THEME.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ANNOUNCEMENTS</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* TABS */}
      <View style={styles.tabRow}>
        {(["create", "history"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Ionicons
              name={tab === "create" ? "megaphone-outline" : "time-outline"}
              size={14}
              color={activeTab === tab ? "#000" : THEME.textMuted}
            />
            <Text style={[styles.tabTxt, activeTab === tab && styles.tabTxtActive]}>
              {tab === "create" ? "New Announcement" : `History (${announcements.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── CREATE TAB ── */}
      {activeTab === "create" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Preview card */}
          <View style={[styles.previewCard, { borderColor: (selectedType?.color || THEME.accent) + "40" }]}>
            <View style={styles.previewHeader}>
              <View style={[styles.previewIcon, { backgroundColor: (selectedType?.color || THEME.accent) + "20" }]}>
                <Ionicons
                  name={(selectedType?.icon || "megaphone") as any}
                  size={18}
                  color={selectedType?.color || THEME.accent}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.previewTitle, { color: selectedType?.color || THEME.accent }]}>
                  {title || "Announcement title"}
                </Text>
                {pinned && (
                  <View style={styles.pinnedBadge}>
                    <Ionicons name="pin" size={10} color={THEME.accent} />
                    <Text style={styles.pinnedTxt}>PINNED</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.previewMessage}>
              {message || "Your message will appear here..."}
            </Text>
          </View>

          {/* Type selector */}
          <Text style={styles.fieldLabel}>ANNOUNCEMENT TYPE</Text>
          <View style={styles.typeGrid}>
            {ANNOUNCEMENT_TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typePill, {
                  backgroundColor: type === t.key ? t.color : THEME.ui,
                  borderColor:     type === t.key ? t.color : THEME.ui2,
                }]}
                onPress={() => setType(t.key)}
              >
                <Ionicons
                  name={t.icon as any}
                  size={14}
                  color={type === t.key ? "#000" : THEME.textMuted}
                />
                <Text style={[styles.typePillTxt, { color: type === t.key ? "#000" : THEME.textMuted }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Title */}
          <Text style={styles.fieldLabel}>TITLE *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. New feature launched!"
            placeholderTextColor={THEME.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
          />
          <Text style={styles.charCount}>{title.length}/80</Text>

          {/* Message */}
          <Text style={styles.fieldLabel}>MESSAGE *</Text>
          <TextInput
            style={[styles.input, styles.messageInput]}
            placeholder="Write your announcement message..."
            placeholderTextColor={THEME.textMuted}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{message.length}/500</Text>

          {/* Options */}
          <View style={styles.optionsCard}>
            <View style={styles.optionRow}>
              <View style={styles.optionLeft}>
                <Ionicons name="pin-outline" size={18} color={THEME.accent} />
                <View>
                  <Text style={styles.optionTitle}>Pin Announcement</Text>
                  <Text style={styles.optionSub}>Show at top of notifications</Text>
                </View>
              </View>
              <Switch
                value={pinned}
                onValueChange={setPinned}
                trackColor={{ false: THEME.ui2, true: THEME.accent }}
                thumbColor={pinned ? "#000" : THEME.textMuted}
              />
            </View>

            <View style={[styles.optionRow, { borderTopWidth: 1, borderTopColor: THEME.ui2, marginTop: 12, paddingTop: 12 }]}>
              <View style={styles.optionLeft}>
                <Ionicons name="people-outline" size={18} color={THEME.blue} />
                <View>
                  <Text style={styles.optionTitle}>Send to All Users</Text>
                  <Text style={styles.optionSub}>
                    {targetAll ? "Everyone will see this" : "Active users only"}
                  </Text>
                </View>
              </View>
              <Switch
                value={targetAll}
                onValueChange={setTargetAll}
                trackColor={{ false: THEME.ui2, true: THEME.blue }}
                thumbColor={targetAll ? "#000" : THEME.textMuted}
              />
            </View>
          </View>

          {/* Send button */}
          <TouchableOpacity
            style={[styles.sendBtn, sending && { opacity: 0.6 }]}
            onPress={handleSend}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#000" />
                <Text style={styles.sendBtnTxt}>SEND ANNOUNCEMENT</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === "history" && (
        loading ? (
          <ActivityIndicator color={THEME.accent} style={{ marginTop: 40 }} />
        ) : announcements.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>📢</Text>
            <Text style={styles.emptyTitle}>No announcements yet</Text>
            <Text style={styles.emptyDesc}>
              Create your first announcement to reach all users.
            </Text>
          </View>
        ) : (
          <FlatList
            data={announcements}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item }) => {
              const aType = ANNOUNCEMENT_TYPES.find((t) => t.key === item.type);
              return (
                <View style={[styles.historyCard, {
                  borderColor: (aType?.color || THEME.accent) + "30",
                }]}>
                  <View style={styles.historyHeader}>
                    <View style={[styles.historyIcon, { backgroundColor: (aType?.color || THEME.accent) + "20" }]}>
                      <Ionicons
                        name={(aType?.icon || "megaphone") as any}
                        size={16}
                        color={aType?.color || THEME.accent}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.historyTitleRow}>
                        <Text style={styles.historyTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        {item.pinned && (
                          <Ionicons name="pin" size={12} color={THEME.accent} />
                        )}
                      </View>
                      <Text style={styles.historyDate}>{formatDate(item.createdAt)}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDelete(item)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={THEME.red} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.historyMessage} numberOfLines={3}>
                    {item.message}
                  </Text>
                  <View style={styles.historyFooter}>
                    <View style={[styles.typeBadge, {
                      backgroundColor: (aType?.color || THEME.accent) + "15",
                      borderColor:     (aType?.color || THEME.accent) + "30",
                    }]}>
                      <Text style={[styles.typeBadgeTxt, { color: aType?.color || THEME.accent }]}>
                        {aType?.label || "General"}
                      </Text>
                    </View>
                    <Text style={styles.sentBy}>
                      by {item.sentByName || "Admin"}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: THEME.bg },
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: THEME.ui2 },
  backBtn:         { width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  headerTitle:     { color: THEME.accent, fontSize: 14, fontWeight: "900", letterSpacing: 3 },
  tabRow:          { flexDirection: "row", margin: 16, backgroundColor: THEME.ui, borderRadius: 14, padding: 4, gap: 4 },
  tab:             { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
  tabActive:       { backgroundColor: THEME.accent },
  tabTxt:          { color: THEME.textMuted, fontSize: 11, fontWeight: "800" },
  tabTxtActive:    { color: "#000" },
  fieldLabel:      { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  input:           { backgroundColor: THEME.ui, borderRadius: 14, padding: 14, color: THEME.text, fontSize: 14, borderWidth: 1, borderColor: THEME.ui2 },
  messageInput:    { minHeight: 120, textAlignVertical: "top", lineHeight: 22 },
  charCount:       { color: THEME.textMuted, fontSize: 10, textAlign: "right" },
  previewCard:     { backgroundColor: THEME.ui, borderRadius: 20, padding: 16, borderWidth: 1 },
  previewHeader:   { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  previewIcon:     { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  previewTitle:    { fontSize: 14, fontWeight: "900" },
  previewMessage:  { color: THEME.textMuted, fontSize: 13, lineHeight: 20 },
  pinnedBadge:     { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  pinnedTxt:       { color: THEME.accent, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  typeGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typePill:        { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  typePillTxt:     { fontSize: 11, fontWeight: "800" },
  optionsCard:     { backgroundColor: THEME.ui, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: THEME.ui2 },
  optionRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  optionLeft:      { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  optionTitle:     { color: THEME.text, fontWeight: "800", fontSize: 13 },
  optionSub:       { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  sendBtn:         { backgroundColor: THEME.accent, borderRadius: 16, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  sendBtnTxt:      { color: "#000", fontWeight: "900", fontSize: 14, letterSpacing: 1 },
  historyCard:     { backgroundColor: THEME.ui, borderRadius: 18, padding: 16, borderWidth: 1 },
  historyHeader:   { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  historyIcon:     { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  historyTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  historyTitle:    { color: THEME.text, fontSize: 13, fontWeight: "900", flex: 1 },
  historyDate:     { color: THEME.textMuted, fontSize: 10, marginTop: 2 },
  historyMessage:  { color: THEME.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 10 },
  historyFooter:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  typeBadge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  typeBadgeTxt:    { fontSize: 9, fontWeight: "900" },
  sentBy:          { color: THEME.textMuted, fontSize: 10 },
  empty:           { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, marginTop: 80 },
  emptyTitle:      { color: THEME.text, fontSize: 16, fontWeight: "900" },
  emptyDesc:       { color: THEME.textMuted, fontSize: 13, textAlign: "center", paddingHorizontal: 32 },
});