import React, { useEffect, useState } from "react";
import { 
  View, Text, StyleSheet, Image, TouchableOpacity, 
  ActivityIndicator, Alert, StatusBar, Dimensions,
  ScrollView // FIXED: Import added
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, runTransaction, onSnapshot } from "firebase/firestore";

const { width } = Dimensions.get("window");

export default function CheckoutScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const user = auth.currentUser;

  const [book, setBook] = useState<any>(null);
  const [userCredits, setUserCredits] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;

    const fetchBook = async () => {
      const docRef = doc(db, "books", id as string);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setBook({ id: snap.id, ...snap.data() });
      } else {
        Alert.alert("Error", "Book not found.");
        router.back();
      }
    };

    const unsubProfile = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        setUserCredits(snap.data().credits || 0);
      }
      setLoading(false);
    });

    fetchBook();
    return () => unsubProfile();
  }, [id, user]);

  const handlePurchase = async () => {
    if (!user || !book) return;
    const cost = book.price || 0;

    if (userCredits < cost) {
      return Alert.alert("Insufficient Credits", "You don't have enough credits to unlock this book.");
    }

    setProcessing(true);

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", user.uid);
        const bookRef = doc(db, "books", book.id);

        const userSnap = await transaction.get(userRef);
        const bookSnap = await transaction.get(bookRef);

        if (!userSnap.exists() || !bookSnap.exists()) throw "Document missing";

        const newBalance = (userSnap.data().credits || 0) - cost;
        const currentPurchasedBy = bookSnap.data().purchasedBy || [];

        transaction.update(userRef, { credits: newBalance });
        transaction.update(bookRef, { 
          purchasedBy: [...currentPurchasedBy, user.uid] 
        });
      });

      Alert.alert("Success!", "The book is now unlocked in your library.");
      // FIXED: Redirects to the root index (Home Screen)
      router.replace("/(tabs)"); 
    } catch (e) {
      console.error(e);
      Alert.alert("Purchase Failed", "Something went wrong with the transaction.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#FFD700" /></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Unlock Book</Text>
        <View style={{width: 28}} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.previewCard}>
          <View style={styles.goldBorder}>
            <Image source={{ uri: book?.cover }} style={styles.coverImg} />
          </View>
          <Text style={styles.bookTitle}>{book?.title}</Text>
          <Text style={styles.bookAuthor}>by {book?.author || "Writha Weaver"}</Text>
          <View style={styles.genreBadge}>
            <Text style={styles.genreTxt}>{book?.genre?.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.priceRow}>
            <Text style={styles.label}>Book Price:</Text>
            <Text style={styles.priceValue}>{book?.price || 0} Credits</Text>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.label}>Your Balance:</Text>
            <Text style={[styles.balanceValue, userCredits < (book?.price || 0) && {color: '#FF4D4D'}]}>
              {userCredits} Credits
            </Text>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          By unlocking this book, it will be permanently added to your personal library.
        </Text>

        <TouchableOpacity 
          style={[styles.purchaseBtn, processing && {opacity: 0.7}]} 
          onPress={handlePurchase}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <MaterialCommunityIcons name="lightning-bolt" size={20} color="#000" />
              <Text style={styles.purchaseBtnTxt}>CONFIRM UNLOCK</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F071A" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F071A" },
  header: { marginTop: 60, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: "#FFD700", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  scrollContent: { padding: 25, alignItems: 'center' },
  previewCard: { alignItems: 'center', marginBottom: 40 },
  goldBorder: { borderWidth: 3, borderColor: '#FFD700', borderRadius: 15, overflow: 'hidden' },
  coverImg: { width: width * 0.5, height: width * 0.75 },
  bookTitle: { color: '#FFF', fontSize: 24, fontWeight: '800', marginTop: 20, textAlign: 'center' },
  bookAuthor: { color: '#A78BFA', fontSize: 14, marginTop: 5 },
  genreBadge: { backgroundColor: '#1E1135', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 20, marginTop: 15, borderWidth: 1, borderColor: '#4C1D95' },
  genreTxt: { color: '#FFD700', fontSize: 10, fontWeight: '900' },
  infoSection: { width: '100%', backgroundColor: '#1E1135', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#444', paddingTop: 15 },
  label: { color: '#888', fontSize: 14 },
  priceValue: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  balanceValue: { color: '#FFD700', fontSize: 18, fontWeight: 'bold' },
  disclaimer: { color: '#666', fontSize: 12, textAlign: 'center', marginTop: 25, lineHeight: 18 },
  purchaseBtn: { backgroundColor: '#FFD700', width: '100%', height: 65, borderRadius: 18, marginTop: 40, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  purchaseBtnTxt: { color: '#000', fontSize: 16, fontWeight: '900', marginLeft: 10, letterSpacing: 1 }
});