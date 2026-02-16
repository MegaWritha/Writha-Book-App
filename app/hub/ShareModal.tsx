import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#000000",
  accent: "#D4AF37", // Writha Gold
  purple: "#8E2DE2",
  text: "#FFFFFF",
  textMuted: "#666666"
};

export default function ShareModal({ visible, onClose, postData }: any) {
  
  const handleReWeave = async () => {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, "discover"), {
        ...postData,
        sharedBy: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || "Scholar",
        authorPhoto: auth.currentUser.photoURL || null,
        sharedAt: serverTimestamp(),
        type: "re-weave",
        originalId: postData.id // Keeps a reference to the source
      });
      onClose();
    } catch (error) {
      console.error("Re-weave failed:", error);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        {/* THE GOLD FRAME WRAPPER */}
        <View style={styles.goldFrame}>
          <View style={styles.innerBox}>
            
            <View style={styles.iconHeader}>
              <MaterialCommunityIcons name="molecule" size={40} color={THEME.purple} />
            </View>

            <Text style={styles.title}>INITIATE RE-WEAVE?</Text>
            <Text style={styles.description}>
              This will broadcast this insight to the Global Archive for all scholars to observe.
            </Text>

            <View style={styles.previewCard}>
               <Text style={styles.previewTitle} numberOfLines={1}>
                 {postData?.title || "Untitled Insight"}
               </Text>
               <Text style={styles.previewType}>SOURCE: {postData?.type?.toUpperCase() || "NOTE"}</Text>
            </View>

            <TouchableOpacity style={styles.confirmBtn} onPress={handleReWeave}>
              <Text style={styles.confirmBtnTxt}>CONFIRM BROADCAST</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnTxt}>ABANDON</Text>
            </TouchableOpacity>

          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.95)', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 25 
  },
  goldFrame: {
    width: '100%',
    backgroundColor: THEME.accent,
    padding: 1, // The 1px Gold Border
    borderRadius: 30,
  },
  innerBox: { 
    backgroundColor: "#0A0A0A", 
    padding: 30, 
    borderRadius: 29, 
    alignItems: 'center' 
  },
  iconHeader: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#111',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222'
  },
  title: { 
    color: THEME.text, 
    fontSize: 20, 
    fontWeight: "900", 
    letterSpacing: 3, 
    marginBottom: 10 
  },
  description: {
    color: THEME.textMuted,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 25
  },
  previewCard: {
    width: '100%',
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 15,
    borderLeftWidth: 3,
    borderLeftColor: THEME.accent,
    marginBottom: 30
  },
  previewTitle: { color: THEME.text, fontWeight: '700', fontSize: 14 },
  previewType: { color: THEME.accent, fontSize: 9, fontWeight: '900', marginTop: 4, letterSpacing: 1 },
  
  confirmBtn: { 
    backgroundColor: THEME.accent, 
    width: '100%', 
    padding: 18, 
    borderRadius: 15, 
    alignItems: 'center' 
  },
  confirmBtnTxt: { color: "#000", fontWeight: "900", letterSpacing: 1 },
  cancelBtn: { marginTop: 20 },
  cancelBtnTxt: { color: "#444", fontWeight: "800", fontSize: 12, letterSpacing: 1 }
});