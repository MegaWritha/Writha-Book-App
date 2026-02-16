import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
// Database imports
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";

export default function UserFeeds() {
  const [activeTab, setActiveTab] = useState('Comments');
  const [loading, setLoading] = useState(true);
  const [userContent, setUserContent] = useState<any[]>([]);
  const router = useRouter();
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    // Mapping tab to the specific Firestore collection
    const collectionName = activeTab.toLowerCase(); 
    const q = query(
      collection(db, collectionName),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserContent(data);
      setLoading(false);
    }, (error) => {
      console.error("Database Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeTab]);

  const renderItem = ({ item }: any) => {
    // These layouts now pull from YOUR Firestore fields
    if (activeTab === 'Comments') return (
      <View style={styles.feedCard}>
        <Text style={styles.bookTitle}>{item.bookName || "Untitled Journey"}</Text>
        <Text style={styles.feedText}>{item.commentText}</Text>
        <Text style={styles.feedDate}>{new Date(item.createdAt?.seconds * 1000).toLocaleDateString()}</Text>
      </View>
    );

    if (activeTab === 'Discussions') return (
      <TouchableOpacity style={styles.feedCard}>
        <View style={styles.row}>
          <Text style={styles.bookTitle}>{item.topicTitle}</Text>
          <Ionicons name="chatbubble-ellipses" size={20} color="#4A00E0" />
        </View>
        <Text style={styles.feedDate}>Joined: {new Date(item.createdAt?.seconds * 1000).toLocaleDateString()}</Text>
      </TouchableOpacity>
    );

    return (
      <View style={styles.readlistCard}>
        <Ionicons name="book" size={40} color="#4A00E0" />
        <View style={styles.listInfo}>
          <Text style={styles.bookTitle}>{item.bookTitle}</Text>
          <Text style={styles.feedDate}>Added to library</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#4A00E0", "#8E2DE2"]} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Feeds</Text>
        <Text style={styles.subMessage}>Welcome to Writha, your journey awaits.</Text>
      </LinearGradient>

      <View style={styles.tabBar}>
        {['Comments', 'Discussions', 'Readlist'].map((tab) => (
          <TouchableOpacity 
            key={tab} 
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => {
              setLoading(true);
              setActiveTab(tab);
            }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4A00E0" />
        </View>
      ) : (
        <FlatList
          data={userContent}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>You haven't added any {activeTab} yet.</Text>
              <Text style={styles.emptySub}>We can't wait to meet your thoughts.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 40, paddingTop: 60, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  backBtn: { marginBottom: 15 },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  subMessage: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 5 },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', margin: 20, borderRadius: 15, padding: 5, elevation: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  activeTab: { backgroundColor: '#4A00E0' },
  tabText: { color: '#888', fontWeight: 'bold' },
  activeTabText: { color: '#fff' },
  listContent: { padding: 20 },
  feedCard: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 15, elevation: 2 },
  bookTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  feedText: { color: '#666', marginTop: 8 },
  feedDate: { color: '#AAA', fontSize: 11, marginTop: 10, textTransform: 'uppercase' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#4A00E0', fontSize: 18, fontWeight: 'bold' },
  emptySub: { color: '#888', marginTop: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  readlistCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 20, marginBottom: 15 },
  listInfo: { flex: 1, marginLeft: 15 }
});