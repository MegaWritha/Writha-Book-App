import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Platform,
  KeyboardAvoidingView
} from "react-native";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth, db } from "../../lib/firebase"; 
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";

const { width, height } = Dimensions.get("window");

type GroupType = "reading" | "research" | "discussion" | "study";

const THEME = {
  bg: "#000000",
  ui: "#0A0A0A",
  surface: "#111111",
  accent: "#D4AF37", // Writha Gold
  purple: "#8E2DE2",
  text: "#FFFFFF",
  textMuted: "#666666",
  danger: "#FF4B4B"
};

export default function Weaves() {
  const router = useRouter();
  const user = auth.currentUser;

  const [groups, setGroups] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<GroupType>("reading");
  const [isPrivate, setIsPrivate] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "groups"),
      where("members", "array-contains", user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Archive fetch error:", error);
    });

    return unsub;
  }, [user]);

  const createGroupWeave = async () => {
    console.log("Button Pressed: Attempting to create group...");
    
    if (!name.trim()) {
      Alert.alert("VOID INPUT", "Please name your Groupweave.");
      return;
    }

    try {
      // 1. Create the document in Firestore
      const docRef = await addDoc(collection(db, "groups"), {
        name: name.trim(),
        type: type,
        privacy: isPrivate ? "private" : "public",
        createdBy: user?.uid, 
        members: [user?.uid],
        createdAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
        weaveLevel: 1
      });

      console.log("SUCCESS: Created group with ID:", docRef.id);

      // 2. Clear state and close modal
      setModalVisible(false);
      setName("");

      // 3. TRY THREE WAYS TO NAVIGATE (One will work depending on your folder setup)
      try {
        // Method A: Dynamic Path
        router.push(`/group/${docRef.id}` as any);
      } catch (navError) {
        // Method B: Object Path (Fallback)
        router.push({
          pathname: "/group/[id]",
          params: { id: docRef.id }
        } as any);
      }

    } catch (e: any) {
      console.error("FIREBASE ERROR:", e);
      Alert.alert("SYNC ERROR", e.message);
    }
  };

  const getIcon = (itemType: string) => {
    switch (itemType) {
      case 'research': return "flask-outline";
      case 'reading': return "book-outline";
      case 'study': return "school-outline";
      default: return "chatbubbles-outline";
    }
  };

  return (
    <View style={styles.container}>
      {/* DECORATIVE LAYER */}
      <View style={styles.loomArt}>
        <View style={[styles.glowCircle, { top: -50, left: -50, backgroundColor: THEME.purple }]} />
        <View style={[styles.glowCircle, { bottom: 100, right: -80, backgroundColor: THEME.accent, opacity: 0.1 }]} />
      </View>

      <View style={styles.header}>
        <View>
          <Text style={styles.brandTag}>INTERNAL ARCHIVE</Text>
          <Text style={styles.title}>Group Weaves</Text>
        </View>
        <TouchableOpacity 
          onPress={() => setModalVisible(true)} 
          style={styles.goldActionBtn}
        >
          <Ionicons name="add-circle-outline" size={32} color={THEME.accent} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsStrip}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{groups.length}</Text>
          <Text style={styles.statLabel}>ACTIVE</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{groups.filter(g => g.privacy === 'private').length}</Text>
          <Text style={styles.statLabel}>PRIVATE</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{groups.reduce((acc, g) => acc + (g.members?.length || 0), 0)}</Text>
          <Text style={styles.statLabel}>SCHOLARS</Text>
        </View>
      </View>

      {groups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="molecule" size={80} color={THEME.accent} />
          <Text style={styles.emptyTitle}>THE ARCHIVE IS SILENT</Text>
          <Text style={styles.emptySub}>
            No Group Weaves found. Tap the gold icon to initiate a collaborative chat thread.
          </Text>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scrollArea} 
          showsVerticalScrollIndicator={false}
        >
          {groups.map(group => (
            <TouchableOpacity
              key={group.id}
              activeOpacity={0.8}
              style={styles.goldBorderWrapper}
              onPress={() => router.push(`/group/${group.id}` as any)}
            >
              <View style={styles.cardInternal}>
                <View style={styles.cardHeader}>
                  <View style={[styles.tag, { borderColor: group.type === 'research' ? THEME.purple : THEME.accent }]}>
                    <Text style={styles.tagText}>{group.type?.toUpperCase()}</Text>
                  </View>
                  <Ionicons name={group.privacy === 'private' ? "lock-closed" : "globe-outline"} size={14} color={THEME.textMuted} />
                </View>

                <View style={styles.cardMain}>
                  <View style={styles.weaveAvatar}>
                    <Text style={styles.weaveAvatarText}>{group.name ? group.name[0] : '?'}</Text>
                  </View>
                  <View style={styles.weaveInfo}>
                    <Text style={styles.weaveName} numberOfLines={1}>{group.name}</Text>
                    <View style={styles.memberStrip}>
                      <Ionicons name="people-outline" size={12} color={THEME.textMuted} />
                      <Text style={styles.memberCount}>{group.members?.length || 1} scholars joined</Text>
                    </View>
                  </View>
                  <View style={styles.lvlBadge}>
                    <Text style={styles.lvlText}>LVL {group.weaveLevel || 1}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* MODAL */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBackdrop}>
          <View style={styles.modalWindow}>
            <View style={styles.modalIndicator} />
            <View style={styles.modalTop}>
              <Text style={styles.modalHeading}>New Group Weave</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color={THEME.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>WEAVE DESIGNATION</Text>
              <TextInput
                placeholder="Ex: Quantum Ethics Discussion"
                placeholderTextColor="#333"
                value={name}
                onChangeText={setName}
                style={styles.goldInput}
              />

              <Text style={styles.inputLabel}>PRIVACY LEVEL</Text>
              <View style={styles.privacyRow}>
                <TouchableOpacity 
                  onPress={() => setIsPrivate(false)}
                  style={[styles.privacyBtn, !isPrivate && styles.privacyActive]}
                >
                  <Ionicons name="globe-outline" size={20} color={!isPrivate ? THEME.bg : THEME.textMuted} />
                  <Text style={[styles.privacyBtnText, !isPrivate && styles.privacyActiveText]}>Public</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => setIsPrivate(true)}
                  style={[styles.privacyBtn, isPrivate && styles.privacyActive]}
                >
                  <Ionicons name="lock-closed-outline" size={20} color={isPrivate ? THEME.bg : THEME.textMuted} />
                  <Text style={[styles.privacyBtnText, isPrivate && styles.privacyActiveText]}>Private</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>RESEARCH FOCUS</Text>
              <View style={styles.typeGrid}>
                {(["reading", "research", "discussion", "study"] as GroupType[]).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeCell, type === t && styles.typeCellActive]}
                    onPress={() => setType(t)}
                  >
                    <Ionicons name={getIcon(t)} size={24} color={type === t ? THEME.bg : THEME.accent} />
                    <Text style={[styles.typeCellText, type === t && styles.typeCellTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.launchButton} onPress={createGroupWeave}>
                <Text style={styles.launchButtonText}>CREATE GROUP</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg, paddingHorizontal: 25 },
  loomArt: { ...StyleSheet.absoluteFillObject, zIndex: -1, overflow: 'hidden' },
  glowCircle: { position: 'absolute', width: 250, height: 250, borderRadius: 125, opacity: 0.15 },
  header: { marginTop: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  brandTag: { color: THEME.purple, fontSize: 10, fontWeight: '900', letterSpacing: 4, marginBottom: 5 },
  title: { fontSize: 36, fontWeight: '900', color: THEME.text, letterSpacing: -1 },
  goldActionBtn: { padding: 5 },
  statsStrip: { flexDirection: 'row', backgroundColor: THEME.surface, borderRadius: 20, padding: 15, marginBottom: 25, borderWidth: 1, borderColor: '#222', alignItems: 'center' },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { color: THEME.accent, fontSize: 18, fontWeight: '900' },
  statLabel: { color: THEME.textMuted, fontSize: 8, fontWeight: '900', marginTop: 2, letterSpacing: 1 },
  statDivider: { width: 1, height: 25, backgroundColor: '#333' },
  scrollArea: { paddingBottom: 100 },
  goldBorderWrapper: { backgroundColor: THEME.accent, padding: 1, borderRadius: 24, marginBottom: 20 },
  cardInternal: { backgroundColor: THEME.ui, borderRadius: 23, padding: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  tag: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { color: THEME.text, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  cardMain: { flexDirection: 'row', alignItems: 'center' },
  weaveAvatar: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', justifyContent: 'center', alignItems: 'center' },
  weaveAvatarText: { color: THEME.accent, fontSize: 22, fontWeight: '900' },
  weaveInfo: { flex: 1, marginLeft: 15 },
  weaveName: { color: THEME.text, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  memberStrip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberCount: { color: THEME.textMuted, fontSize: 11, fontWeight: '600' },
  lvlBadge: { backgroundColor: THEME.purple + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  lvlText: { color: THEME.purple, fontSize: 10, fontWeight: '900' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  emptyTitle: { color: THEME.text, fontSize: 18, fontWeight: '900', marginTop: 20, letterSpacing: 2 },
  emptySub: { color: THEME.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 22, paddingHorizontal: 40 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'flex-end' },
  modalWindow: { backgroundColor: THEME.ui, borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 30, maxHeight: height * 0.85, borderWidth: 1, borderColor: '#222' },
  modalIndicator: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  modalHeading: { color: THEME.text, fontSize: 24, fontWeight: '900' },
  inputLabel: { color: THEME.accent, fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 15 },
  goldInput: { backgroundColor: '#000', borderRadius: 15, padding: 20, color: THEME.text, fontSize: 16, borderWidth: 1, borderColor: '#222', marginBottom: 30 },
  privacyRow: { flexDirection: 'row', gap: 15, marginBottom: 30 },
  privacyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18, borderRadius: 15, backgroundColor: '#000', borderWidth: 1, borderColor: '#222' },
  privacyActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  privacyBtnText: { color: THEME.textMuted, fontWeight: '800', textTransform: 'uppercase', fontSize: 12 },
  privacyActiveText: { color: THEME.bg },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 40 },
  typeCell: { width: '48%', backgroundColor: '#000', padding: 20, borderRadius: 18, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#222' },
  typeCellActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  typeCellText: { color: THEME.textMuted, fontWeight: '900', textTransform: 'uppercase', fontSize: 10 },
  typeCellTextActive: { color: THEME.bg },
  launchButton: { backgroundColor: THEME.purple, padding: 22, borderRadius: 20, alignItems: 'center', shadowColor: THEME.purple, shadowOpacity: 0.5, shadowRadius: 15 },
  launchButtonText: { color: THEME.text, fontWeight: '900', letterSpacing: 3, fontSize: 14 }
});