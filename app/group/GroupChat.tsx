import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Image, Modal, ScrollView,
  Dimensions, Animated, ActivityIndicator,
} from "react-native";
import { db, auth } from "../../lib/firebase";
import {
  collection, addDoc, query, orderBy, onSnapshot,
  serverTimestamp, doc, updateDoc,
} from "firebase/firestore";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

const THEME = {
  bg: "#000000", surface: "#0A0A0A", accent: "#D4AF37",
  purple: "#8E2DE2", text: "#FFFFFF", textMuted: "#666666",
  border: "#1A1A1A",
};

// ---- AI message helper ----
async function getAIResponse(prompt: string, groupContext: string): Promise<string> {
  // Replace with your actual AI endpoint / cloud function
  return `[AI Scholar] Regarding "${prompt.substring(0, 30)}..." — This is an interesting point worth exploring in the context of ${groupContext}.`;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  createdAt: any;
  type?: "text" | "weave-alert" | "ai";
  replyTo?: { id: string; text: string; senderName: string } | null;
}

interface GroupChatProps {
  groupId: string;
  groupData: any;
}

export default function GroupChat({ groupId, groupData }: GroupChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [aiThinking, setAiThinking] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [weaveModalVisible, setWeaveModalVisible] = useState(false);
  const [technicalMode, setTechnicalMode] = useState(false);

  // Technical mode fields (adapt per group type)
  const [hypothesis, setHypothesis] = useState("");
  const [methodology, setMethodology] = useState("");
  const [leadScholar, setLeadScholar] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const technicalPanelAnim = useRef(new Animated.Value(0)).current;

  const groupName = groupData?.name || "Group";
  const groupType = groupData?.type || "discussion";
  const hasAI = groupData?.hasAI || false;

  useEffect(() => {
    if (!groupId) return;
    const q = query(collection(db, "groups", groupId, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Message[]);
      setLoading(false);
    });
    return unsub;
  }, [groupId]);

  const toggleTechnicalMode = () => {
    const toValue = technicalMode ? 0 : 1;
    setTechnicalMode(!technicalMode);
    Animated.spring(technicalPanelAnim, { toValue, useNativeDriver: false, tension: 80 }).start();
  };

  const sendMessage = async () => {
    if (!text.trim() || !auth.currentUser) return;
    const msgText = text.trim();
    setText("");
    setReplyTo(null);

    try {
      await addDoc(collection(db, "groups", groupId, "messages"), {
        text: msgText,
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || "Scholar",
        senderPhoto: auth.currentUser.photoURL || null,
        createdAt: serverTimestamp(),
        type: "text",
        replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderName: replyTo.senderName } : null,
      });
      await updateDoc(doc(db, "groups", groupId), { lastActivity: serverTimestamp() });

      // If AI is in the group, check if it should respond
      if (hasAI && (msgText.toLowerCase().includes("@ai") || msgText.toLowerCase().includes("@scholar"))) {
        setAiThinking(true);
        const aiReply = await getAIResponse(msgText, groupName);
        await addDoc(collection(db, "groups", groupId, "messages"), {
          text: aiReply,
          senderId: "AI_SCHOLAR",
          senderName: "AI Scholar",
          senderPhoto: null,
          createdAt: serverTimestamp(),
          type: "ai",
        });
        setAiThinking(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const initiateWeave = async () => {
    if (!hypothesis || !leadScholar) return;
    setIsBroadcasting(true);
    try {
      await addDoc(collection(db, "feed"), {
        title: groupName,
        type: groupType,
        lead: leadScholar,
        hypothesis,
        methodology,
        authorId: auth.currentUser?.uid,
        authorName: auth.currentUser?.displayName,
        createdAt: serverTimestamp(),
        sourceGroupId: groupId,
        category: "Collaborative Weave",
      });
      await addDoc(collection(db, "groups", groupId, "messages"), {
        text: `📜 GLOBAL WEAVE BROADCAST: "${hypothesis.substring(0, 50)}..."`,
        senderId: "SYSTEM",
        senderName: "THE ARCHIVE",
        createdAt: serverTimestamp(),
        type: "weave-alert",
      });
      setWeaveModalVisible(false);
      setHypothesis("");
      setMethodology("");
      setLeadScholar("");
    } catch (e) {
      console.error(e);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const technicalPanelHeight = technicalPanelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 220],
  });

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.senderId === auth.currentUser?.uid;
    const isSystem = item.senderId === "SYSTEM";
    const isAI = item.senderId === "AI_SCHOLAR";
    const showName = !isMe && !isSystem && !isAI &&
      (index === 0 || messages[index - 1].senderId !== item.senderId);

    if (isSystem) {
      return (
        <View style={styles.systemAlert}>
          <Text style={styles.systemText}>{item.text}</Text>
        </View>
      );
    }

    if (isAI) {
      return (
        <View style={styles.aiMsgWrapper}>
          <View style={styles.aiAvatar}>
            <MaterialCommunityIcons name="brain" size={16} color="#000" />
          </View>
          <View style={styles.aiContent}>
            <Text style={styles.aiLabel}>AI SCHOLAR</Text>
            <View style={styles.aiBubble}>
              <Text style={styles.aiText}>{item.text}</Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => setReplyTo(item)}
        style={[styles.msgWrapper, isMe ? styles.myMsg : styles.theirMsg]}
      >
        {!isMe && (
          <Image
            source={{ uri: item.senderPhoto || `https://ui-avatars.com/api/?name=${item.senderName}&background=D4AF37&color=000` }}
            style={styles.avatar}
          />
        )}
        <View style={styles.msgContent}>
          {showName && <Text style={styles.senderName}>{item.senderName.toUpperCase()}</Text>}
          {item.replyTo && (
            <View style={styles.replyPreview}>
              <Text style={styles.replyName}>{item.replyTo.senderName}</Text>
              <Text style={styles.replyText} numberOfLines={1}>{item.replyTo.text}</Text>
            </View>
          )}
          <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
            <Text style={styles.msgText}>{item.text}</Text>
          </View>
          <Text style={[styles.timeText, isMe && { textAlign: "right" }]}>
            {item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "..."}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Background Glow */}
      <View style={styles.glowLeft} />
      <View style={styles.glowRight} />

      {/* Technical Mode Panel */}
      <Animated.View style={[styles.techPanel, { height: technicalPanelHeight, overflow: "hidden" }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.techScroll}>
          {["Critique", "Analysis", "Theme", "Context", "Evidence", "Summary"].map((field) => (
            <TouchableOpacity key={field} style={styles.techChip}>
              <Text style={styles.techChipText}>{field.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={styles.techHint}>Tap a field to add structured content to the weave output</Text>
        <TouchableOpacity style={styles.techBroadcastBtn} onPress={() => setWeaveModalVisible(true)}>
          <MaterialCommunityIcons name="broadcast" size={16} color="#000" />
          <Text style={styles.techBroadcastText}>COMPILE & BROADCAST</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={THEME.accent} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            aiThinking ? (
              <View style={styles.aiThinking}>
                <MaterialCommunityIcons name="brain" size={14} color={THEME.accent} />
                <Text style={styles.aiThinkingText}>AI Scholar is thinking...</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Reply Preview Bar */}
      {replyTo && (
        <View style={styles.replyBar}>
          <View style={styles.replyBarContent}>
            <Text style={styles.replyBarName}>{replyTo.senderName}</Text>
            <Text style={styles.replyBarText} numberOfLines={1}>{replyTo.text}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Ionicons name="close" size={18} color="#666" />
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
        <View style={styles.inputDeck}>
          {/* Technical Mode Toggle */}
          <TouchableOpacity
            style={[styles.techToggle, technicalMode && styles.techToggleActive]}
            onPress={toggleTechnicalMode}
          >
            <MaterialCommunityIcons name="flask-outline" size={18} color={technicalMode ? "#000" : THEME.textMuted} />
          </TouchableOpacity>

          <View style={styles.inputFrame}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder={hasAI ? "Type @ai to summon AI Scholar..." : "Record your insight..."}
              placeholderTextColor="#333"
              value={text}
              onChangeText={setText}
              multiline
            />
            <TouchableOpacity
              onPress={sendMessage}
              style={[styles.sendBtn, !text.trim() && { opacity: 0.3 }]}
              disabled={!text.trim()}
            >
              <Ionicons name="arrow-up" size={22} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Broadcast Modal */}
      <Modal visible={weaveModalVisible} animationType="slide" transparent onRequestClose={() => setWeaveModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalSub}>INTELLECTUAL BROADCAST</Text>
                <Text style={styles.modalTitle}>INITIATE GROUP WEAVE</Text>
              </View>
              <TouchableOpacity onPress={() => setWeaveModalVisible(false)}>
                <Ionicons name="close-circle-outline" size={32} color={THEME.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formSection}>
                <Text style={styles.fieldLabel}>LEAD SCHOLAR</Text>
                <TextInput style={styles.formInput} placeholder="Who is heading this weave?" placeholderTextColor="#222" value={leadScholar} onChangeText={setLeadScholar} />
              </View>
              <View style={styles.formSection}>
                <Text style={styles.fieldLabel}>CORE HYPOTHESIS / DISCOVERY</Text>
                <TextInput style={[styles.formInput, { height: 100, textAlignVertical: "top" }]} placeholder="Define the insight being broadcast..." placeholderTextColor="#222" multiline value={hypothesis} onChangeText={setHypothesis} />
              </View>
              <View style={styles.formSection}>
                <Text style={styles.fieldLabel}>METHODOLOGY (OPTIONAL)</Text>
                <TextInput style={[styles.formInput, { height: 80, textAlignVertical: "top" }]} placeholder="How was this concluded?" placeholderTextColor="#222" multiline value={methodology} onChangeText={setMethodology} />
              </View>
              <View style={styles.infoCard}>
                <Ionicons name="information-circle-outline" size={18} color={THEME.accent} />
                <Text style={styles.infoText}>This compiles group activity and broadcasts it to the Global Archive.</Text>
              </View>
              <TouchableOpacity style={[styles.broadcastBtn, isBroadcasting && { opacity: 0.6 }]} onPress={initiateWeave} disabled={isBroadcasting}>
                {isBroadcasting ? <ActivityIndicator color="#000" /> : <Text style={styles.broadcastBtnText}>CONFIRM BROADCAST</Text>}
              </TouchableOpacity>
              <View style={{ height: 60 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  glowLeft: { position: "absolute", top: 100, left: -60, width: 300, height: 300, borderRadius: 150, backgroundColor: THEME.purple, opacity: 0.06 },
  glowRight: { position: "absolute", bottom: 200, right: -60, width: 300, height: 300, borderRadius: 150, backgroundColor: THEME.accent, opacity: 0.04 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: 20, paddingBottom: 20 },

  techPanel: { backgroundColor: "#080808", borderBottomWidth: 1, borderColor: "#111", paddingHorizontal: 16, paddingTop: 12 },
  techScroll: { marginBottom: 8 },
  techChip: { backgroundColor: "#111", borderWidth: 1, borderColor: THEME.purple + "60", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  techChipText: { color: THEME.purple, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  techHint: { color: "#333", fontSize: 10, marginBottom: 10 },
  techBroadcastBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: THEME.accent, padding: 12, borderRadius: 14, marginBottom: 12 },
  techBroadcastText: { color: "#000", fontWeight: "900", fontSize: 11, letterSpacing: 1 },

  msgWrapper: { flexDirection: "row", alignItems: "flex-end", marginVertical: 6, maxWidth: "85%" },
  myMsg: { alignSelf: "flex-end" },
  theirMsg: { alignSelf: "flex-start" },
  avatar: { width: 28, height: 28, borderRadius: 8, marginRight: 8, marginBottom: 14, borderWidth: 1, borderColor: "#222" },
  msgContent: { flexShrink: 1 },
  senderName: { color: THEME.accent, fontSize: 9, fontWeight: "900", marginBottom: 4, marginLeft: 4, letterSpacing: 1 },
  replyPreview: { backgroundColor: "#0A0A0A", borderLeftWidth: 2, borderColor: THEME.accent, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 4 },
  replyName: { color: THEME.accent, fontSize: 9, fontWeight: "900" },
  replyText: { color: "#555", fontSize: 11, marginTop: 2 },
  bubble: { padding: 14, borderRadius: 20 },
  myBubble: { backgroundColor: "#121212", borderBottomRightRadius: 4, borderWidth: 1, borderColor: "#1A1A1A" },
  theirBubble: { backgroundColor: "#080808", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "#111" },
  msgText: { color: "#E0E0E0", fontSize: 15, lineHeight: 22 },
  timeText: { color: "#333", fontSize: 8, marginTop: 4, fontWeight: "700" },

  systemAlert: { alignSelf: "center", marginVertical: 16, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: "#0A0A0A", borderRadius: 10, borderWidth: 1, borderColor: THEME.purple + "40" },
  systemText: { color: THEME.purple, fontSize: 10, fontWeight: "900", textAlign: "center", letterSpacing: 1 },

  aiMsgWrapper: { flexDirection: "row", alignItems: "flex-end", marginVertical: 8, alignSelf: "flex-start", maxWidth: "85%" },
  aiAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: THEME.accent, justifyContent: "center", alignItems: "center", marginRight: 8, marginBottom: 14 },
  aiContent: { flexShrink: 1 },
  aiLabel: { color: THEME.accent, fontSize: 9, fontWeight: "900", letterSpacing: 1, marginBottom: 4, marginLeft: 4 },
  aiBubble: { padding: 14, borderRadius: 20, borderBottomLeftRadius: 4, backgroundColor: "#0A0800", borderWidth: 1, borderColor: THEME.accent + "30" },
  aiText: { color: "#C8A800", fontSize: 14, lineHeight: 20 },
  aiThinking: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, marginHorizontal: 20 },
  aiThinkingText: { color: "#444", fontSize: 11, fontStyle: "italic" },

  replyBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#0A0A0A", borderTopWidth: 1, borderColor: "#111", paddingHorizontal: 16, paddingVertical: 10 },
  replyBarContent: { flex: 1, borderLeftWidth: 2, borderColor: THEME.accent, paddingLeft: 10 },
  replyBarName: { color: THEME.accent, fontSize: 10, fontWeight: "900" },
  replyBarText: { color: "#555", fontSize: 12, marginTop: 2 },

  inputDeck: { paddingHorizontal: 12, paddingBottom: Platform.OS === "ios" ? 36 : 16, paddingTop: 10, backgroundColor: "#000", flexDirection: "row", alignItems: "flex-end", gap: 8 },
  techToggle: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#0A0A0A", borderWidth: 1, borderColor: "#1A1A1A", justifyContent: "center", alignItems: "center" },
  techToggleActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  inputFrame: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#080808", borderRadius: 25, borderWidth: 1, borderColor: "#151515", paddingHorizontal: 6, paddingVertical: 6 },
  input: { flex: 1, color: "#FFF", fontSize: 15, paddingHorizontal: 10, maxHeight: 100 },
  sendBtn: { backgroundColor: THEME.accent, width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.96)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: THEME.surface, borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 30, height: height * 0.8, borderWidth: 1, borderColor: "#222" },
  modalHandle: { width: 40, height: 4, backgroundColor: "#222", borderRadius: 2, alignSelf: "center", marginBottom: 25 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
  modalSub: { color: THEME.purple, fontSize: 10, fontWeight: "900", letterSpacing: 3 },
  modalTitle: { color: "#FFF", fontSize: 22, fontWeight: "900", marginTop: 4 },
  formSection: { marginBottom: 22 },
  fieldLabel: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 1, marginBottom: 10 },
  formInput: { backgroundColor: "#000", borderRadius: 14, padding: 16, color: "#FFF", borderWidth: 1, borderColor: "#1A1A1A", fontSize: 14 },
  infoCard: { flexDirection: "row", backgroundColor: "#0F0F0F", padding: 14, borderRadius: 12, alignItems: "center", gap: 10, marginBottom: 24 },
  infoText: { color: "#555", fontSize: 11, flex: 1, lineHeight: 16 },
  broadcastBtn: { backgroundColor: THEME.accent, padding: 20, borderRadius: 18, alignItems: "center" },
  broadcastBtnText: { color: "#000", fontWeight: "900", letterSpacing: 2, fontSize: 14 },
});