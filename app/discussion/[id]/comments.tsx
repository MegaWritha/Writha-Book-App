import React, { useEffect, useState } from "react";
import { 
  View, Text, StyleSheet, FlatList, TextInput, 
  TouchableOpacity, Image, ActivityIndicator, 
  KeyboardAvoidingView, Platform, Alert, Modal, Share, Clipboard
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

// Using @ alias for absolute path safety
import { db, auth } from "@/lib/firebase"; 
import { 
  collection, addDoc, query, orderBy, 
  onSnapshot, serverTimestamp, getDocs, doc, updateDoc, arrayUnion, 
  increment,
  deleteDoc,
  getDoc
} from "firebase/firestore";

export default function DiscussionComments() {
  const { id } = useLocalSearchParams(); 
  const router = useRouter();
  
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<any>(null);

  // New States for Username and Menu
  const [currentUsername, setCurrentUsername] = useState("Writha User");
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedComment, setSelectedComment] = useState<any>(null);
  const [isReplyMenu, setIsReplyMenu] = useState(false); // Track if we are deleting a reply
  const [parentOfSelected, setParentOfSelected] = useState<string | null>(null);

  // --- FETCH CURRENT USER REAL USERNAME ---
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const fetchUsername = async () => {
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setCurrentUsername(userSnap.data().username || userSnap.data().fullName || "Writha User");
        }
      } catch (e) {
        console.error("Username fetch error:", e);
      }
    };
    fetchUsername();
  }, []);

  // --- FETCH COMMENTS & SUB-COMMENTS ---
  useEffect(() => {
    if (!id) {
      setLoading(false); 
      return;
    }

    const q = query(collection(db, "feed", id as string, "comments"), orderBy("createdAt", "desc"));
    
    const unsub = onSnapshot(q, async (snap) => {
      if (snap.empty) {
        setComments([]);
        setLoading(false);
        return;
      }

      try {
        const parentComments = await Promise.all(snap.docs.map(async (d) => {
          const data = d.data();
          const subSnap = await getDocs(query(collection(db, "feed", id as string, "comments", d.id, "replies"), orderBy("createdAt", "asc")));
          const replies = subSnap.docs.map(sd => ({ id: sd.id, ...sd.data() }));
          
          return { id: d.id, ...data, replies };
        }));

        setComments(parentComments);
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error("Snapshot Error:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [id]);

  const handlePost = async () => {
    if (!text.trim() || !id) return;
    const user = auth.currentUser;
    if (!user) return Alert.alert("Join the conversation", "Please log in to comment.");

    const payload = {
      text: text.trim(),
      userId: user.uid,
      userName: currentUsername, // Fixed: Uses fetched username
      userImg: user.photoURL || "https://picsum.photos/200",
      createdAt: serverTimestamp()
    };

    try {
      if (replyTo) {
        await addDoc(collection(db, "feed", id as string, "comments", replyTo.id, "replies"), payload);
      } else {
        await addDoc(collection(db, "feed", id as string, "comments"), payload);
        await updateDoc(doc(db, "feed", id as string), { commentsCount: increment(1) }); 
      }
      setText("");
      setReplyTo(null);
    } catch (e) {
      console.error("Post Error:", e);
    }
  };

  const handleFollow = async (targetUserId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), { following: arrayUnion(targetUserId) });
      Alert.alert("Success", "Following author");
    } catch (e) {
      console.error(e);
    }
  };

  // Updated to handle both Parent Comments and Replies
  const handleDeleteComment = async () => {
    if (!selectedComment) return;
    
    Alert.alert("Delete Comment", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", 
        style: "destructive", 
        onPress: async () => {
          try {
            if (isReplyMenu && parentOfSelected) {
              // Delete a Reply
              await deleteDoc(doc(db, "feed", id as string, "comments", parentOfSelected, "replies", selectedComment.id));
            } else {
              // Delete a Parent Comment
              await deleteDoc(doc(db, "feed", id as string, "comments", selectedComment.id));
              await updateDoc(doc(db, "feed", id as string), {
                commentsCount: increment(-1)
              });
            }
          } catch (e) {
            console.error("Delete Error:", e);
          }
        } 
      }
    ]);
  };

  const handleCopy = (txt: string) => {
    Clipboard.setString(txt);
    Alert.alert("Copied", "Thought copied to clipboard");
    setMenuVisible(false);
  };

  const handleShare = async (txt: string) => {
    try {
      await Share.share({ message: txt });
      setMenuVisible(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : undefined} 
      style={styles.main}
      keyboardVerticalOffset={100}
    >
      {/* --- HEADER --- */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#FFD700" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Comments</Text>
          <Text style={styles.subTitle}>Reader Discussions</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#FFD700" size="large" /></View>
      ) : (
        <FlatList 
          data={comments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{padding: 20, paddingBottom: 150}}
          renderItem={({item}) => (
            <View style={styles.commentContainer}>
              {/* Main Comment */}
              <View style={styles.row}>
                <TouchableOpacity onPress={() => router.push(`/profile/${item.userId}`)}>
                  <Image source={{uri: item.userImg}} style={styles.pfp} />
                </TouchableOpacity>
                <View style={styles.bubble}>
                  <View style={styles.bubbleTop}>
                    <Text style={styles.uName}>{item.userName}</Text>
                    {item.userId !== auth.currentUser?.uid && (
                      <TouchableOpacity onPress={() => handleFollow(item.userId)} style={styles.followBadge}>
                        <Text style={styles.followTxt}>Follow</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.uText}>{item.text}</Text>
                  
                  <View style={styles.actionRow}>
                    <TouchableOpacity onPress={() => setReplyTo(item)} style={styles.action}>
                      <Text style={styles.actionText}>Reply</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      onPress={() => { 
                        setSelectedComment(item); 
                        setIsReplyMenu(false);
                        setParentOfSelected(null);
                        setMenuVisible(true); 
                      }} 
                      style={styles.action}
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color="#A78BFA" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.action}>
                      <Text style={styles.actionText}>Send Request</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Sub-Comments (Replies) */}
              {item.replies?.map((reply: any) => (
                <View key={reply.id} style={styles.replyRow}>
                  <View style={styles.replyLine} />
                  <TouchableOpacity onPress={() => router.push(`/profile/${reply.userId}`)}>
                    <Image source={{uri: reply.userImg}} style={styles.replyPfp} />
                  </TouchableOpacity>
                  <View style={[styles.bubble, {backgroundColor: '#130B21'}]}>
                    <View style={styles.bubbleTop}>
                       <Text style={styles.uName}>{reply.userName}</Text>
                       <TouchableOpacity 
                        onPress={() => { 
                          setSelectedComment(reply); 
                          setIsReplyMenu(true);
                          setParentOfSelected(item.id);
                          setMenuVisible(true); 
                        }}
                       >
                         <Ionicons name="ellipsis-horizontal" size={14} color="#A78BFA" />
                       </TouchableOpacity>
                    </View>
                    <Text style={styles.uText}>{reply.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="comment-text-outline" size={50} color="#333" />
              <Text style={styles.emptyTxt}>Comments empty. Be the first to speak.</Text>
            </View>
          }
        />
      )}

      {/* --- INPUT --- */}
      <View style={styles.inputWrapper}>
        {replyTo && (
          <View style={styles.replyingBar}>
            <Text style={styles.replyingText}>Replying to {replyTo.userName}</Text>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Ionicons name="close-circle" size={18} color="#FFD700" />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
          <TextInput 
            style={styles.input} 
            placeholder="Write a thought..." 
            placeholderTextColor="#6D28D9" 
            value={text} 
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity onPress={handlePost} style={styles.sendBtn}>
            <Ionicons name="paper-plane" size={20} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* --- ACTIONS MENU MODAL --- */}
      <Modal visible={menuVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuContainer}>
            <View style={styles.menuIndicator} />
            
            <TouchableOpacity style={styles.menuItem} onPress={() => handleShare(selectedComment?.text)}>
              <Ionicons name="share-outline" size={20} color="#FFF" />
              <Text style={styles.menuText}>Share Thought</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => handleCopy(selectedComment?.text)}>
              <Ionicons name="copy-outline" size={20} color="#FFF" />
              <Text style={styles.menuText}>Copy Text</Text>
            </TouchableOpacity>

            {selectedComment?.userId === auth.currentUser?.uid && (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={() => setMenuVisible(false)}>
                  <Ionicons name="create-outline" size={20} color="#FFF" />
                  <Text style={styles.menuText}>Edit Comment</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.menuItem} 
                  onPress={() => { 
                    handleDeleteComment(); 
                    setMenuVisible(false); 
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  <Text style={[styles.menuText, {color: '#EF4444'}]}>Delete</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#0F071A" },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginTop: 50, padding: 20, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1E1135' },
  backBtn: { marginRight: 15 },
  title: { color: "#FFF", fontSize: 22, fontWeight: "900" },
  subTitle: { color: '#FFD700', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  commentContainer: { marginBottom: 25 },
  row: { flexDirection: 'row' },
  pfp: { width: 45, height: 45, borderRadius: 22.5, borderWidth: 1.5, borderColor: '#FFD700' },
  bubble: { flex: 1, marginLeft: 12, backgroundColor: '#1E1135', padding: 15, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  bubbleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  uName: { color: '#FFD700', fontWeight: 'bold', fontSize: 13 },
  followBadge: { backgroundColor: '#4C1D95', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  followTxt: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  uText: { color: '#EEE', fontSize: 14, lineHeight: 20 },
  actionRow: { flexDirection: 'row', marginTop: 12, alignItems: 'center' },
  action: { marginRight: 20 },
  actionText: { color: '#A78BFA', fontSize: 11, fontWeight: 'bold' },
  replyRow: { flexDirection: 'row', marginLeft: 45, marginTop: 10 },
  replyLine: { width: 2, backgroundColor: '#333', marginRight: 10, marginBottom: 15 },
  replyPfp: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#A78BFA' },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyTxt: { color: '#444', marginTop: 10, fontStyle: 'italic' },
  inputWrapper: { backgroundColor: '#1E1135', borderTopWidth: 1, borderTopColor: '#4C1D95' },
  replyingBar: { backgroundColor: '#2D1B4D', padding: 8, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 },
  replyingText: { color: '#FFD700', fontSize: 11 },
  inputRow: { flexDirection: 'row', padding: 15, alignItems: 'center', paddingBottom: Platform.OS === 'ios' ? 40 : 15 },
  input: { flex: 1, color: '#FFF', fontSize: 15, maxHeight: 100 },
  sendBtn: { backgroundColor: '#FFD700', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  menuContainer: { backgroundColor: '#1E1135', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, paddingBottom: 40, borderTopWidth: 1, borderTopColor: '#4C1D95' },
  menuIndicator: { width: 40, height: 5, backgroundColor: '#333', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 0.5, borderBottomColor: '#333' },
  menuText: { color: '#FFF', marginLeft: 15, fontSize: 16, fontWeight: '500' },
});