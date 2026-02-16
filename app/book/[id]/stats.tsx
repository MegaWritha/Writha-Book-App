import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView,
  StatusBar,
  Dimensions
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc,
  orderBy 
} from 'firebase/firestore';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get("window");

// --- INTERFACE FOR DATA ---
interface StatItem {
  id: string;
  name?: string;
  photo?: string;
  title?: string;
  authorName?: string;
  content?: string;
  timestamp?: any;
  isUser: boolean;
}

export default function BookStatsList() {
  const { id, type } = useLocalSearchParams(); 
  const router = useRouter();
  
  const [dataList, setDataList] = useState<StatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookTitle, setBookTitle] = useState("Book Activity");

  useEffect(() => {
    if (!id) return;

    // 1. Fetch Book Title for the sub-header
    const fetchBookInfo = async () => {
      const bookSnap = await getDoc(doc(db, "books", id as string));
      if (bookSnap.exists()) {
        setBookTitle(bookSnap.data().title);
      }
    };
    fetchBookInfo();

    let unsub: () => void;

    // 2. Determine which collection to listen to based on "type"
    if (type === 'likes') {
      const likersRef = collection(db, "books", id as string, "likers");
      const q = query(likersRef, orderBy("timestamp", "desc"));
      
      unsub = onSnapshot(q, (snap) => {
        const users = snap.docs.map(d => ({
          id: d.id,
          name: d.data().name || "Unknown User",
          photo: d.data().photo || "https://picsum.photos/100",
          isUser: true,
          timestamp: d.data().timestamp
        }));
        setDataList(users);
        setLoading(false);
      }, (err) => {
        console.error("Firestore Likes Error:", err);
        setLoading(false);
      });

    } else if (type === 'weaves') {
      const weavesRef = collection(db, "weaves");
      const q = query(weavesRef, where("bookId", "==", id), orderBy("createdAt", "desc"));
      
      unsub = onSnapshot(q, (snap) => {
        const weavesData = snap.docs.map(d => ({
          id: d.id,
          title: d.data().title || "Untitled Weave",
          authorName: d.data().authorName || "Anonymous",
          isUser: false,
          timestamp: d.data().createdAt
        }));
        setDataList(weavesData);
        setLoading(false);
      }, (err) => {
        console.error("Firestore Weaves Error:", err);
        setLoading(false);
      });

    } else if (type === 'comments') {
        const commentsRef = collection(db, "books", id as string, "comments");
        const q = query(commentsRef, orderBy("timestamp", "desc"));
        
        unsub = onSnapshot(q, (snap) => {
          const commentsData = snap.docs.map(d => ({
            id: d.id,
            name: d.data().userName || "User",
            photo: d.data().userPhoto || "https://picsum.photos/100",
            content: d.data().text,
            isUser: true, 
            timestamp: d.data().timestamp
          }));
          setDataList(commentsData);
          setLoading(false);
        }, (err) => {
            console.error("Firestore Comments Error:", err);
            setLoading(false);
        });
    }

    return () => {
      if (unsub) unsub();
    };
  }, [id, type]);

  // --- RENDER COMPONENT FOR EACH LIST ITEM ---
  const renderItem = ({ item }: { item: StatItem }) => {
    return (
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => item.isUser ? router.push(`/user/${item.id}`) : router.push(`/weave/${item.id}`)}
      >
        <View style={styles.cardContent}>
          {item.isUser ? (
            <Image source={{ uri: item.photo }} style={styles.pfp} />
          ) : (
            <View style={styles.weaveIconBox}>
              <MaterialCommunityIcons name="fountain-pen-tip" size={20} color="#FFD700" />
            </View>
          )}

          <View style={styles.textContainer}>
            <Text style={styles.mainText}>
              {item.isUser ? `@${item.name}` : item.title}
            </Text>
            <Text style={styles.subText}>
              {item.isUser 
                ? (item.content ? item.content : "Tapped the heart") 
                : `by ${item.authorName}`}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#4C1D95" />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* HEADER SECTION */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFD700" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{type?.toString().toUpperCase()}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{bookTitle}</Text>
        </View>
      </View>

      {/* CONTENT SECTION */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Fetching {type}...</Text>
        </View>
      ) : (
        <FlatList
          data={dataList}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listPadding}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons 
                name={type === 'likes' ? "heart-dislike-outline" : "document-text-outline"} 
                size={60} 
                color="#4C1D95" 
              />
              <Text style={styles.emptyText}>No {type} found yet.</Text>
              <Text style={styles.emptySubText}>Be the first to interact with this book!</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F071A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1135',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E1135',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  headerTitle: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerSubtitle: {
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    maxWidth: width * 0.7,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#A78BFA',
    marginTop: 10,
    fontSize: 14,
  },
  listPadding: {
    padding: 20,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1135',
    padding: 15,
    borderRadius: 18,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#4C1D95',
    justifyContent: 'space-between',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pfp: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  weaveIconBox: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: '#0F071A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  textContainer: {
    marginLeft: 15,
    flex: 1,
  },
  mainText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  subText: {
    color: '#A78BFA',
    fontSize: 13,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
  },
  emptySubText: {
    color: '#A78BFA',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});