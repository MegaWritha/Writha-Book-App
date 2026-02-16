import React, { useState, useEffect } from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { doc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";

export default function FollowButton({ targetUserId }: { targetUserId: string }) {
  const [isFollowing, setIsFollowing] = useState(false);
  const me = auth.currentUser?.uid;

  useEffect(() => {
    if (!me) return;
    return onSnapshot(doc(db, "users", me, "following", targetUserId), (doc) => setIsFollowing(doc.exists()));
  }, [targetUserId]);

  const toggle = async () => {
    if (!me) return;
    const ref = doc(db, "users", me, "following", targetUserId);
    isFollowing ? await deleteDoc(ref) : await setDoc(ref, { active: true });
  };

  return (
    <TouchableOpacity style={[styles.btn, isFollowing ? styles.active : styles.inactive]} onPress={toggle}>
      <Text style={styles.txt}>{isFollowing ? "Following" : "Follow"}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { paddingHorizontal: 25, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  active: { borderWidth: 1, borderColor: "#333" },
  inactive: { backgroundColor: "#8E2DE2" },
  txt: { color: "#FFF", fontWeight: "bold" }
});