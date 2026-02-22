import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '@/lib/firebase';
import {
  doc, onSnapshot, updateDoc, increment,
  setDoc, deleteDoc, collection
} from 'firebase/firestore';

interface WeaveCardProps {
  item: any;
  onMenuPress: () => void;
}

export const WeaveCard = ({ item, onMenuPress }: WeaveCardProps) => {
  const user = auth.currentUser;
  const [likes, setLikes] = useState(0);
  const [comments, setComments] = useState(0);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    if (!item?.id) return;

    // Listen to weave stats
    const unsubWeave = onSnapshot(doc(db, "weaves", item.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLikes(data.likesCount || 0);
        setComments(data.commentsCount || 0);
      }
    });

    // Check if current user liked this weave
    if (user) {
      const unsubLike = onSnapshot(
        doc(db, "weaves", item.id, "likes", user.uid),
        (snap) => setIsLiked(snap.exists())
      );
      return () => { unsubWeave(); unsubLike(); };
    }

    return () => unsubWeave();
  }, [item?.id, user]);

  const handleLike = async () => {
    if (!user || !item?.id) return;
    const likeRef = doc(db, "weaves", item.id, "likes", user.uid);
    const weaveRef = doc(db, "weaves", item.id);

    if (isLiked) {
      await deleteDoc(likeRef);
      await updateDoc(weaveRef, { likesCount: increment(-1) });
    } else {
      await setDoc(likeRef, { createdAt: new Date() });
      await updateDoc(weaveRef, { likesCount: increment(1) });
    }
  };

  return (
    <View style={styles.weaveCard}>
      <View style={styles.weaveHeader}>
        <Text style={styles.weaveType}>{item.type?.toUpperCase() || 'POST'}</Text>
        <View style={styles.headerRight}>
          {item.isEdited && (
            <Text style={styles.editedTag}>edited</Text>
          )}
          <TouchableOpacity
            onPress={onMenuPress}
            style={styles.moreBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color="#FFD700" />
          </TouchableOpacity>
        </View>
      </View>

      {item.title ? (
        <Text style={styles.weaveTitle}>{item.title}</Text>
      ) : null}

      <Text style={styles.weaveBody}>
        {item.content || item.findings || "No content provided."}
      </Text>

      {/* TAGS */}
      {item.tags && item.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {item.tags.slice(0, 3).map((tag: string) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ACTIONS */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={20}
            color={isLiked ? "#FF4444" : "#A78BFA"}
          />
          <Text style={[styles.actionCount, isLiked && { color: "#FF4444" }]}>
            {likes}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="chatbubble-outline" size={18} color="#A78BFA" />
          <Text style={styles.actionCount}>{comments}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  weaveCard: { backgroundColor: '#1E1135', padding: 22, borderRadius: 20, marginBottom: 18, borderLeftWidth: 5, borderLeftColor: '#FFD700' },
  weaveHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editedTag: { color: '#4C1D95', fontSize: 10, fontStyle: 'italic' },
  moreBtn: { padding: 10 },
  weaveType: { color: '#FFD700', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  weaveTitle: { color: '#FFF', fontSize: 19, fontWeight: 'bold', marginBottom: 8 },
  weaveBody: { color: '#A78BFA', fontSize: 15, lineHeight: 22 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tag: { backgroundColor: '#2D1B4E', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tagText: { color: '#A78BFA', fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 20, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#2D1B4E' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { color: '#A78BFA', fontSize: 13, fontWeight: '700' },
});