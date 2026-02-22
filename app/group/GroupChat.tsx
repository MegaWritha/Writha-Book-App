import React, { useState, useEffect, useRef } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  Image,
  Modal,
  ScrollView,
  Dimensions,
  Animated,
  StatusBar,
  ActivityIndicator
} from "react-native";
import { db, auth } from "../../lib/firebase";
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  getDoc,
  updateDoc,
  arrayUnion 
} from "firebase/firestore";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

// ---------------- THEME ARCHITECTURE ----------------
const THEME = {
  bg: "#000000",
  surface: "#0A0A0A",
  accent: "#D4AF37", // Writha Gold
  purple: "#8E2DE2",
  myBubble: "#121212",
  theirBubble: "#080808",
  text: "#FFFFFF",
  textMuted: "#666666",
  border: "#1A1A1A",
  error: "#FF4B4B"
};

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  createdAt: any;
  type?: "text" | "weave-alert";
}

interface GroupChatProps {
  groupId: string;
  groupName: string;
  groupType: "research" | "reading" | "study" | "discussion";
}

export default function GroupChat({ groupId, groupName, groupType }: GroupChatProps) {
  // --- States ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  
  // --- Modal & Form States ---
  const [weaveModalVisible, setWeaveModalVisible] = useState(false);
  const [leadResearcher, setLeadResearcher] = useState("");
  const [researchHypothesis, setResearchHypothesis] = useState("");
  const [methodology, setMethodology] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // --- Animation Refs ---
  const scrollY = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  // ---------------- FIREBASE SYNC ----------------
  useEffect(() => {
    if (!groupId) return;

    const q = query(
      collection(db, "groups", groupId, "messages"), 
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgData);
      setLoading(false);
    }, (error) => {
      console.error("Loom sync failed:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [groupId]);

  // ---------------- MESSAGE LOGIC ----------------
  const handleSendMessage = async () => {
    if (!text.trim() || !auth.currentUser) return;

    const newMessage = {
      text: text.trim(),
      senderId: auth.currentUser.uid,
      senderName: auth.currentUser.displayName || "Scholar",
      senderPhoto: auth.currentUser.photoURL || null,
      createdAt: serverTimestamp(),
      type: "text"
    };

    try {
      setText(""); // Optimistic clear
      await addDoc(collection(db, "groups", groupId, "messages"), newMessage);
      // Update last activity in main group doc
      await updateDoc(doc(db, "groups", groupId), {
        lastActivity: serverTimestamp()
      });
    } catch (e) {
      console.error("Message failed to interweave:", e);
    }
  };

  // ---------------- WEAVE BROADCAST LOGIC ----------------
  const initiateGlobalBroadcast = async () => {
    if (!leadResearcher || !researchHypothesis) return;
    setIsBroadcasting(true);

    try {
      // 1. Post to the Global Discover Feed
      await addDoc(collection(db, "feed"), {
        title: groupName,
        type: groupType,
        lead: leadResearcher,
        hypothesis: researchHypothesis,
        methodology: methodology,
        authorId: auth.currentUser?.uid,
        authorName: auth.currentUser?.displayName,
        createdAt: serverTimestamp(),
        sourceGroupId: groupId,
        category: "Collaborative Weave"
      });

      // 2. Alert the group that a broadcast happened
      await addDoc(collection(db, "groups", groupId, "messages"), {
        text: `📜 A GLOBAL WEAVE HAS BEEN INITIATED: ${researchHypothesis.substring(0, 30)}...`,
        senderId: "SYSTEM",
        senderName: "THE ARCHIVE",
        createdAt: serverTimestamp(),
        type: "weave-alert"
      });

      setWeaveModalVisible(false);
      setIsBroadcasting(false);
    } catch (e) {
      console.error("Broadcast failed:", e);
      setIsBroadcasting(false);
    }
  };

  // ---------------- RENDERING COMPONENTS ----------------
  const renderMessage = ({ item, index }: { item: Message, index: number }) => {
    const isMe = item.senderId === auth.currentUser?.uid;
    const isSystem = item.senderId === "SYSTEM";
    const showName = !isMe && !isSystem && (index === 0 || messages[index - 1].senderId !== item.senderId);

    if (isSystem) {
      return (
        <View style={styles.systemAlert}>
          <Text style={styles.systemText}>{item.text}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.msgWrapper, isMe ? styles.myMsg : styles.theirMsg]}>
        {!isMe && (
          <Image 
            source={{ uri: item.senderPhoto || `https://ui-avatars.com/api/?name=${item.senderName}&background=D4AF37&color=000` }} 
            style={styles.smallAvatar} 
          />
        )}
        <View style={styles.messageContent}>
          {showName && <Text style={styles.senderName}>{item.senderName.toUpperCase()}</Text>}
          <View style={[
            styles.bubble, 
            isMe ? styles.myBubbleStyle : styles.theirBubbleStyle
          ]}>
            <Text style={styles.msgText}>{item.text}</Text>
          </View>
          <Text style={[styles.timeText, isMe && { textAlign: 'right' }]}>
            {item.createdAt?.toDate() ? new Date(item.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "..."}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* --- BACKGROUND LOOM ART --- */}
      <View style={styles.loomContainer}>
        <View style={[styles.glow, { top: height * 0.1, left: -50, backgroundColor: THEME.purple }]} />
        <View style={[styles.glow, { bottom: height * 0.2, right: -50, backgroundColor: THEME.accent, opacity: 0.05 }]} />
      </View>

      {/* --- HEADER --- */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTag}>{groupType?.toUpperCase() || "SCHOLARLY"} GROUP</Text>
          <Text style={styles.headerTitle}>{groupName}</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.weaveActionBtn}
          onPress={() => setWeaveModalVisible(true)}
        >
          <MaterialCommunityIcons name="molecule" size={22} color={THEME.accent} />
          <Text style={styles.weaveActionText}>WEAVE</Text>
        </TouchableOpacity>
      </View>

      {/* --- CHAT LIST --- */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      />

      {/* --- INPUT DECK --- */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <View style={styles.inputDeck}>
          <View style={styles.inputFrame}>
            <TouchableOpacity style={styles.plusBtn}>
              <Ionicons name="add" size={24} color={THEME.textMuted} />
            </TouchableOpacity>
            
            <TextInput 
              style={styles.inputField}
              placeholder="Record insight..."
              placeholderTextColor="#333"
              value={text}
              onChangeText={setText}
              multiline
            />

            <TouchableOpacity 
              onPress={handleSendMessage}
              style={[styles.sendBtn, !text.trim() && { opacity: 0.3 }]}
              disabled={!text.trim()}
            >
              <Ionicons name="arrow-up" size={24} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* --- THE COMPREHENSIVE WEAVE FORM MODAL --- */}
      <Modal 
        visible={weaveModalVisible} 
        animationType="slide" 
        transparent
        onRequestClose={() => setWeaveModalVisible(false)}
      >
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
                <Text style={styles.label}>LEAD SCHOLAR / RESEARCHER</Text>
                <TextInput 
                  style={styles.formInput}
                  placeholder="Who is heading this weave?"
                  placeholderTextColor="#222"
                  value={leadResearcher}
                  onChangeText={setLeadResearcher}
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.label}>CORE HYPOTHESIS / DISCOVERY</Text>
                <TextInput 
                  style={[styles.formInput, { height: 100, textAlignVertical: 'top' }]}
                  placeholder="Define the insight being broadcasted..."
                  placeholderTextColor="#222"
                  multiline
                  value={researchHypothesis}
                  onChangeText={setResearchHypothesis}
                />
              </View>

              {groupType === "research" && (
                <View style={styles.formSection}>
                  <Text style={styles.label}>METHODOLOGY (OPTIONAL)</Text>
                  <TextInput 
                    style={[styles.formInput, { height: 80 }]}
                    placeholder="How was this concluded?"
                    placeholderTextColor="#222"
                    multiline
                    value={methodology}
                    onChangeText={setMethodology}
                  />
                </View>
              )}

              <View style={styles.infoCard}>
                <Ionicons name="information-circle-outline" size={18} color={THEME.accent} />
                <Text style={styles.infoCardText}>
                  This action will compile the current group activity and broadcast it to the Global Archive for all scholars to witness.
                </Text>
              </View>

              <TouchableOpacity 
                style={[styles.broadcastBtn, isBroadcasting && { opacity: 0.7 }]}
                onPress={initiateGlobalBroadcast}
                disabled={isBroadcasting}
              >
                {isBroadcasting ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.broadcastBtnText}>CONFIRM BROADCAST</Text>
                )}
              </TouchableOpacity>

              <View style={{ height: 50 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------- STYLESHEET (COMPREHENSIVE) ----------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  loomContainer: { ...StyleSheet.absoluteFillObject, zIndex: -1, overflow: 'hidden' },
  glow: { position: 'absolute', width: 400, height: 400, borderRadius: 200, opacity: 0.08 },
  
  header: { 
    paddingTop: 60, 
    paddingHorizontal: 20, 
    paddingBottom: 20, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#111',
    backgroundColor: 'rgba(0,0,0,0.8)'
  },
  headerInfo: { flex: 1 },
  headerTag: { color: THEME.purple, fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  headerTitle: { color: THEME.text, fontSize: 18, fontWeight: '800' },
  weaveActionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#0F0F0F', 
    paddingVertical: 8, 
    paddingHorizontal: 15, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.accent
  },
  weaveActionText: { color: THEME.accent, fontSize: 11, fontWeight: '900', marginLeft: 6, letterSpacing: 1 },

  scrollContent: { padding: 20, paddingBottom: 40 },
  msgWrapper: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 8, maxWidth: '85%' },
  myMsg: { alignSelf: 'flex-end' },
  theirMsg: { alignSelf: 'flex-start' },
  smallAvatar: { width: 28, height: 28, borderRadius: 8, marginRight: 8, marginBottom: 14, borderWidth: 1, borderColor: '#222' },
  messageContent: { flexShrink: 1 },
  senderName: { color: THEME.accent, fontSize: 9, fontWeight: '900', marginBottom: 4, marginLeft: 4, letterSpacing: 1 },
  bubble: { padding: 16, borderRadius: 22 },
  myBubbleStyle: { backgroundColor: THEME.myBubble, borderBottomRightRadius: 4, borderWidth: 1, borderColor: '#1A1A1A' },
  theirBubbleStyle: { backgroundColor: THEME.theirBubble, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#111' },
  msgText: { color: '#E0E0E0', fontSize: 15, lineHeight: 22 },
  timeText: { color: '#333', fontSize: 8, marginTop: 4, fontWeight: '700' },
  
  systemAlert: { alignSelf: 'center', marginVertical: 20, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#0A0A0A', borderRadius: 10, borderWidth: 1, borderColor: THEME.purple + '40' },
  systemText: { color: THEME.purple, fontSize: 10, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },

  inputDeck: { padding: 15, paddingBottom: Platform.OS === 'ios' ? 40 : 20, backgroundColor: '#000' },
  inputFrame: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#080808', 
    borderRadius: 25, 
    borderWidth: 1, 
    borderColor: '#151515',
    padding: 6
  },
  plusBtn: { padding: 10 },
  inputField: { flex: 1, color: '#FFF', fontSize: 15, paddingHorizontal: 10, maxHeight: 100 },
  sendBtn: { backgroundColor: THEME.accent, width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },

  // --- MODAL SHEET STYLES ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: THEME.surface, borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 30, height: height * 0.8, borderWidth: 1, borderColor: '#222' },
  modalHandle: { width: 40, height: 4, backgroundColor: '#222', borderRadius: 2, alignSelf: 'center', marginBottom: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30 },
  modalSub: { color: THEME.purple, fontSize: 10, fontWeight: '900', letterSpacing: 3 },
  modalTitle: { color: '#FFF', fontSize: 22, fontWeight: '900', marginTop: 5 },
  formSection: { marginBottom: 25 },
  label: { color: THEME.accent, fontSize: 10, fontWeight: '900', marginBottom: 12, letterSpacing: 1 },
  formInput: { backgroundColor: '#000', borderRadius: 15, padding: 18, color: '#FFF', borderWidth: 1, borderColor: '#1A1A1A', fontSize: 15 },
  infoCard: { flexDirection: 'row', backgroundColor: '#0F0F0F', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 30, gap: 10 },
  infoCardText: { color: '#555', fontSize: 11, flex: 1, lineHeight: 16 },
  broadcastBtn: { backgroundColor: THEME.accent, padding: 22, borderRadius: 20, alignItems: 'center', shadowColor: THEME.accent, shadowOpacity: 0.2, shadowRadius: 10 },
  broadcastBtnText: { color: '#000', fontWeight: '900', letterSpacing: 2, fontSize: 14 }
});