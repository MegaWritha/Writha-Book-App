import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar, Dimensions,
  ScrollView, Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { auth, db } from "@/lib/firebase";
import {
  doc, getDoc, runTransaction, collection, addDoc, serverTimestamp,
} from "firebase/firestore";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#0F071A",
  ui: "#1E1135",
  ui2: "#2D1B4D",
  accent: "#FFD700",
  accentDim: "rgba(255,215,0,0.1)",
  purple: "#6D28D9",
  purpleLight: "#A78BFA",
  text: "#E2E8F0",
  textMuted: "#94A3B8",
  green: "#22C55E",
  red: "#EF4444",
};

// ── WHAT COLLECTION + LABELS EACH TYPE USES ──────────────────────────────
const TYPE_CONFIG: Record<string, {
  collection: string;
  label: string;
  icon: string;
  successMsg: string;
  successRoute: string;
  libraryCollection: string;
}> = {
  book: {
    collection: "books",
    label: "Book",
    icon: "book-outline",
    successMsg: "The book has been added to your library!",
    successRoute: "/(tabs)",
    libraryCollection: "library",
  },
  research: {
    collection: "research",
    label: "Research",
    icon: "document-text-outline",
    successMsg: "Research paper unlocked! Find it in your library.",
    successRoute: "/(tabs)",
    libraryCollection: "library",
  },
  article: {
    collection: "feed",
    label: "Article",
    icon: "newspaper-outline",
    successMsg: "Article unlocked! You can now read the full piece.",
    successRoute: "/(tabs)",
    libraryCollection: "library",
  },
};

// ── FEATURE ROW ───────────────────────────────────────────────────────────
const FeatureRow = ({ icon, text }: { icon: string; text: string }) => (
  <View style={styles.featureRow}>
    <View style={styles.featureIconCircle}>
      <Ionicons name={icon as any} size={14} color={THEME.accent} />
    </View>
    <Text style={styles.featureTxt}>{text}</Text>
  </View>
);

// ── MAIN SCREEN ───────────────────────────────────────────────────────────
export default function CheckoutScreen() {
  // ✅ Accepts: id, type (book | research | article)
  const { id, type = "book" } = useLocalSearchParams<{ id: string; type: string }>();
  const router = useRouter();
  const user = auth.currentUser;

  const config = TYPE_CONFIG[type] || TYPE_CONFIG.book;

  const [item, setItem] = useState<any>(null);
  const [userWallet, setUserWallet] = useState<any>(null);
  const [alreadyOwned, setAlreadyOwned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payMethod, setPayMethod] = useState<"wallet" | "paystack">("wallet");

  interface ItemData {
    id: string;
    [key: string]: any;
    purchasedBy?: string[];
  }

  // Pulse animation for the confirm button
  const pulseAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ── FETCH ITEM + USER ────────────────────────────────────────────────
  useEffect(() => {
    if (!id || !user) return;

    const load = async () => {
      try {
        // Fetch the item (book, research, article)
        const itemSnap = await getDoc(doc(db, config.collection, id));
        if (!itemSnap.exists()) {
          Alert.alert("Not Found", `This ${config.label.toLowerCase()} could not be found.`);
          router.back();
          return;
        }
        const itemData: ItemData = { id: itemSnap.id, ...itemSnap.data() };
        setItem(itemData);

        // Fetch user profile
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setUserWallet(userData.wallet || { balance: 0 });

          // Check if already owned
          const librarySnap = await getDoc(
            doc(db, "users", user.uid, config.libraryCollection, id)
          );
          if (librarySnap.exists()) setAlreadyOwned(true);

          // Also check purchasedBy array (legacy support)
          if (itemData.purchasedBy?.includes(user.uid)) setAlreadyOwned(true);
        }
      } catch (e) {
        console.error(e);
        Alert.alert("Error", "Failed to load checkout details.");
        router.back();
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, user, type]);

  // ── WALLET PURCHASE ──────────────────────────────────────────────────
  const handleWalletPurchase = async () => {
    if (!user || !item) return;
    const cost = item.price || 0;
    const balance = userWallet?.balance || 0;

    if (balance < cost) {
      Alert.alert(
        "Insufficient Balance",
        `You need ₦${cost.toLocaleString()} but only have ₦${balance.toLocaleString()} in your wallet.`,
        [
          { text: "Top Up Wallet", onPress: () => router.push("/(tabs)/wallet" as any) },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    setProcessing(true);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", user.uid);
        const itemRef = doc(db, config.collection, id);
        const libraryRef = doc(db, "users", user.uid, config.libraryCollection, id);

        const [userSnap, itemSnap] = await Promise.all([
          transaction.get(userRef),
          transaction.get(itemRef),
        ]);

        if (!userSnap.exists() || !itemSnap.exists()) throw new Error("Document missing");

        const currentBalance = userSnap.data().wallet?.balance || 0;
        if (currentBalance < cost) throw new Error("Insufficient balance");

        // Deduct from buyer's wallet
        transaction.update(userRef, {
          "wallet.balance": currentBalance - cost,
        });

        // Add to purchasedBy on item
        const purchasedBy = itemSnap.data().purchasedBy || [];
        transaction.update(itemRef, {
          purchasedBy: [...new Set([...purchasedBy, user.uid])],
          purchasesCount: (itemSnap.data().purchasesCount || 0) + 1,
        });

        // Add to user's library subcollection
        transaction.set(libraryRef, {
          itemId: id,
          type,
          title: item.title,
          coverUrl: item.coverUrl || item.cover || null,
          price: cost,
          purchasedAt: serverTimestamp(),
        });
      });

      // Log to purchases collection for author payout tracking
      await addDoc(collection(db, "purchases"), {
        buyerId: user.uid,
        sellerId: item.userId || item.authorId,
        itemId: id,
        itemType: type,
        itemTitle: item.title,
        amount: item.price,
        paymentMethod: "wallet",
        createdAt: serverTimestamp(),
      });

      // Credit author's wallet (80% after 20% platform fee)
      if (item.userId || item.authorId) {
        const authorId = item.userId || item.authorId;
        const authorEarning = item.price * 0.8;
        const authorRef = doc(db, "users", authorId);
        const authorSnap = await getDoc(authorRef);
        if (authorSnap.exists()) {
          const currentRoyalties = authorSnap.data().wallet?.royalties || 0;
          const currentBalance = authorSnap.data().wallet?.balance || 0;
          await runTransaction(db, async (t) => {
            t.update(authorRef, {
              "wallet.royalties": currentRoyalties + authorEarning,
              "wallet.balance": currentBalance + authorEarning,
              "wallet.totalEarned": (authorSnap.data().wallet?.totalEarned || 0) + authorEarning,
            });
          });
        }
      }

      setAlreadyOwned(true);
      Alert.alert("Unlocked! 🎉", config.successMsg, [
        { text: "Start Reading", onPress: () => router.replace(`/${type === "book" ? "book" : "discussion"}/${id}` as any) },
        { text: "Go Home", onPress: () => router.replace("/(tabs)" as any) },
      ]);
    } catch (e: any) {
      Alert.alert("Purchase Failed", e.message || "Something went wrong.");
    } finally {
      setProcessing(false);
    }
  };

  // ── PAYSTACK (Placeholder — wire up when backend ready) ───────────────
  const handlePaystackPurchase = () => {
    Alert.alert(
      "Paystack Payment",
      "Card payments are coming soon! Use your Writha wallet for now.",
      [{ text: "Use Wallet Instead", onPress: () => setPayMethod("wallet") }]
    );
    // TODO: When backend is ready:
    // 1. Call your backend to create a Paystack payment intent
    // 2. Open Paystack checkout
    // 3. On success callback, call handleWalletPurchase flow
  };

  const handleConfirm = () => {
    if (payMethod === "wallet") {
      handleWalletPurchase();
    } else {
      handlePaystackPurchase();
    }
  };

  // ── LOADING ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={THEME.accent} />
        <Text style={{ color: THEME.textMuted, marginTop: 12 }}>Loading checkout...</Text>
      </View>
    );
  }

  const cost = item?.price || 0;
  const balance = userWallet?.balance || 0;
  const canAfford = balance >= cost;

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={THEME.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerSmall}>WRITHA</Text>
          <Text style={styles.headerTitle}>Checkout</Text>
        </View>
        <View style={styles.headerBadge}>
          <Ionicons name={config.icon as any} size={14} color={THEME.accent} />
          <Text style={styles.headerBadgeTxt}>{config.label.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ITEM PREVIEW CARD */}
        <LinearGradient
          colors={["#2D1B4D", "#1E1135", "#0F071A"]}
          style={styles.previewCard}
        >
          {/* Cover */}
          <View style={styles.coverWrap}>
            {item?.coverUrl || item?.cover ? (
              <Image
                source={{ uri: item.coverUrl || item.cover }}
                style={styles.coverImg}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.coverFallback}>
                <Ionicons name={config.icon as any} size={48} color={THEME.purpleLight} />
              </View>
            )}
            {/* Price badge */}
            <View style={styles.priceBadge}>
              <Text style={styles.priceBadgeTxt}>₦{cost.toLocaleString()}</Text>
            </View>
          </View>

          {/* Item info */}
          <Text style={styles.itemTitle} numberOfLines={2}>{item?.title}</Text>
          <Text style={styles.itemAuthor}>
            by {item?.authorName || item?.author || "Writha Author"}
          </Text>

          {/* Tags row */}
          <View style={styles.tagsRow}>
            {item?.genre && (
              <View style={styles.tag}>
                <Text style={styles.tagTxt}>{item.genre.toUpperCase()}</Text>
              </View>
            )}
            {item?.category && (
              <View style={styles.tag}>
                <Text style={styles.tagTxt}>{item.category.toUpperCase()}</Text>
              </View>
            )}
            {item?.fieldOfStudy && (
              <View style={styles.tag}>
                <Text style={styles.tagTxt}>{item.fieldOfStudy.toUpperCase()}</Text>
              </View>
            )}
          </View>

          {/* Abstract/description preview */}
          {(item?.abstract || item?.description) && (
            <Text style={styles.itemPreview} numberOfLines={3}>
              {item.abstract || item.description}
            </Text>
          )}
        </LinearGradient>

        {/* WHAT YOU GET */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WHAT YOU GET</Text>
          {type === "book" && (
            <>
              <FeatureRow icon="book-outline" text="Full book added to your personal library" />
              <FeatureRow icon="phone-portrait-outline" text="Read on any device, anytime" />
              <FeatureRow icon="bookmark-outline" text="Save highlights and annotations" />
              <FeatureRow icon="chatbubble-outline" text="Leave reviews and comments" />
              <FeatureRow icon="arrow-down-circle-outline" text="Access forever — no expiry" />
            </>
          )}
          {type === "research" && (
            <>
              <FeatureRow icon="document-text-outline" text="Full research paper access" />
              <FeatureRow icon="download-outline" text="Download PDF for offline reading" />
              <FeatureRow icon="chatbubble-outline" text="Join the research discussion" />
              <FeatureRow icon="ribbon-outline" text="Cite and reference the work" />
              <FeatureRow icon="arrow-down-circle-outline" text="Permanent access — no expiry" />
            </>
          )}
          {type === "article" && (
            <>
              <FeatureRow icon="newspaper-outline" text="Full article content unlocked" />
              <FeatureRow icon="chatbubble-outline" text="Comment and discuss the article" />
              <FeatureRow icon="share-outline" text="Share with your network" />
              <FeatureRow icon="arrow-down-circle-outline" text="Permanent access — no expiry" />
            </>
          )}
        </View>

        {/* PAYMENT METHOD */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PAYMENT METHOD</Text>

          {/* Wallet option */}
          <TouchableOpacity
            style={[styles.payMethodCard, payMethod === "wallet" && styles.payMethodCardActive]}
            onPress={() => setPayMethod("wallet")}
          >
            <View style={styles.payMethodLeft}>
              <View style={[styles.payMethodIcon, { backgroundColor: THEME.accent + "20" }]}>
                <Ionicons name="wallet-outline" size={22} color={THEME.accent} />
              </View>
              <View>
                <Text style={styles.payMethodTitle}>Writha Wallet</Text>
                <Text style={[
                  styles.payMethodBalance,
                  !canAfford && { color: THEME.red },
                ]}>
                  Balance: ₦{balance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
            <View style={[styles.radioCircle, payMethod === "wallet" && styles.radioCircleActive]}>
              {payMethod === "wallet" && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>

          {/* Paystack option */}
          <TouchableOpacity
            style={[styles.payMethodCard, payMethod === "paystack" && styles.payMethodCardActive]}
            onPress={() => setPayMethod("paystack")}
          >
            <View style={styles.payMethodLeft}>
              <View style={[styles.payMethodIcon, { backgroundColor: "#00C3F7" + "20" }]}>
                <MaterialCommunityIcons name="credit-card-outline" size={22} color="#00C3F7" />
              </View>
              <View>
                <Text style={styles.payMethodTitle}>Card / Bank Transfer</Text>
                <Text style={styles.payMethodBalance}>Powered by Paystack · Coming Soon</Text>
              </View>
            </View>
            <View style={[styles.radioCircle, payMethod === "paystack" && styles.radioCircleActive]}>
              {payMethod === "paystack" && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>

          {/* Low balance warning */}
          {payMethod === "wallet" && !canAfford && (
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={16} color={THEME.red} />
              <View style={{ flex: 1 }}>
                <Text style={styles.warningTitle}>Insufficient Balance</Text>
                <Text style={styles.warningTxt}>
                  You need ₦{(cost - balance).toLocaleString()} more.{" "}
                  <Text
                    style={{ color: THEME.accent, fontWeight: "800" }}
                    onPress={() => router.push("/(tabs)/wallet" as any)}
                  >
                    Top up your wallet →
                  </Text>
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ORDER SUMMARY */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ORDER SUMMARY</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLbl}>{config.label} Price</Text>
              <Text style={styles.summaryVal}>₦{cost.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLbl}>Platform Fee</Text>
              <Text style={[styles.summaryVal, { color: THEME.green }]}>₦0.00</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLbl, { color: THEME.text, fontWeight: "800" }]}>
                Total
              </Text>
              <Text style={[styles.summaryVal, { color: THEME.accent, fontSize: 20 }]}>
                ₦{cost.toLocaleString()}
              </Text>
            </View>
            {payMethod === "wallet" && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLbl}>Wallet After</Text>
                <Text style={[styles.summaryVal, !canAfford && { color: THEME.red }]}>
                  ₦{Math.max(0, balance - cost).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ALREADY OWNED */}
        {alreadyOwned && (
          <View style={styles.ownedBanner}>
            <Ionicons name="checkmark-circle" size={20} color={THEME.green} />
            <Text style={styles.ownedTxt}>
              You already own this {config.label.toLowerCase()}!{" "}
              <Text
                style={{ color: THEME.accent, fontWeight: "800" }}
                onPress={() => router.replace(`/${type === "book" ? "book" : "discussion"}/${id}` as any)}
              >
                Open it →
              </Text>
            </Text>
          </View>
        )}

        {/* LEGAL */}
        <Text style={styles.legalNotice}>
          By confirming this purchase, you agree to Writha's Terms of Service.
          All sales are final. Purchases are tied to your Writha account.
        </Text>
      </ScrollView>

      {/* BOTTOM CTA */}
      {!alreadyOwned && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarLeft}>
            <Text style={styles.bottomBarPrice}>₦{cost.toLocaleString()}</Text>
            <Text style={styles.bottomBarLbl}>
              {payMethod === "wallet" ? "Wallet payment" : "Card payment"}
            </Text>
          </View>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                (processing || (payMethod === "wallet" && !canAfford)) && { opacity: 0.6 },
              ]}
              onPress={handleConfirm}
              disabled={processing || (payMethod === "wallet" && !canAfford)}
              activeOpacity={0.85}
            >
              {processing ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <MaterialCommunityIcons name="lightning-bolt" size={20} color="#000" />
                  <Text style={styles.confirmBtnTxt}>CONFIRM PURCHASE</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: THEME.bg },

  // Header
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  backBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center" },
  headerSmall: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 4 },
  headerTitle: { color: THEME.text, fontSize: 22, fontWeight: "900" },
  headerBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: THEME.accentDim, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: THEME.accent + "40" },
  headerBadgeTxt: { color: THEME.accent, fontSize: 10, fontWeight: "900" },

  // Preview card
  previewCard: { margin: 16, borderRadius: 24, padding: 24, alignItems: "center", borderWidth: 1, borderColor: THEME.ui2 },
  coverWrap: { position: "relative", marginBottom: 16 },
  coverImg: { width: width * 0.45, height: width * 0.62, borderRadius: 16, borderWidth: 2, borderColor: THEME.accent },
  coverFallback: { width: width * 0.45, height: width * 0.62, borderRadius: 16, backgroundColor: THEME.ui, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: THEME.ui2 },
  priceBadge: { position: "absolute", bottom: -10, right: -10, backgroundColor: THEME.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 2, borderColor: THEME.bg },
  priceBadgeTxt: { color: "#000", fontWeight: "900", fontSize: 14 },
  itemTitle: { color: THEME.text, fontSize: 20, fontWeight: "900", textAlign: "center", marginTop: 8 },
  itemAuthor: { color: THEME.purpleLight, fontSize: 13, marginTop: 6 },
  tagsRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap", justifyContent: "center" },
  tag: { backgroundColor: THEME.ui2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagTxt: { color: THEME.purpleLight, fontSize: 9, fontWeight: "900" },
  itemPreview: { color: THEME.textMuted, fontSize: 12, lineHeight: 19, textAlign: "center", marginTop: 12 },

  // Section
  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionTitle: { color: THEME.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 14 },

  // Features
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  featureIconCircle: { width: 30, height: 30, borderRadius: 9, backgroundColor: THEME.accentDim, justifyContent: "center", alignItems: "center" },
  featureTxt: { color: THEME.text, fontSize: 13, fontWeight: "600" },

  // Payment methods
  payMethodCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: THEME.ui, borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: THEME.ui2 },
  payMethodCardActive: { borderColor: THEME.accent },
  payMethodLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  payMethodIcon: { width: 44, height: 44, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  payMethodTitle: { color: THEME.text, fontWeight: "800", fontSize: 14 },
  payMethodBalance: { color: THEME.textMuted, fontSize: 12, marginTop: 2 },
  radioCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: THEME.ui2, justifyContent: "center", alignItems: "center" },
  radioCircleActive: { borderColor: THEME.accent },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: THEME.accent },

  // Warning
  warningBox: { flexDirection: "row", gap: 10, backgroundColor: THEME.red + "15", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: THEME.red + "40", alignItems: "flex-start", marginTop: 4 },
  warningTitle: { color: THEME.red, fontWeight: "800", fontSize: 13, marginBottom: 2 },
  warningTxt: { color: THEME.textMuted, fontSize: 12, lineHeight: 18 },

  // Summary
  summaryCard: { backgroundColor: THEME.ui, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: THEME.ui2 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  summaryLbl: { color: THEME.textMuted, fontSize: 13 },
  summaryVal: { color: THEME.text, fontSize: 14, fontWeight: "700" },
  summaryDivider: { height: 1, backgroundColor: THEME.ui2, marginVertical: 4 },

  // Owned
  ownedBanner: { flexDirection: "row", gap: 10, backgroundColor: THEME.green + "15", borderRadius: 14, padding: 14, marginHorizontal: 16, marginTop: 16, borderWidth: 1, borderColor: THEME.green + "40", alignItems: "center" },
  ownedTxt: { color: THEME.text, fontSize: 13, flex: 1, lineHeight: 19 },

  // Legal
  legalNotice: { color: THEME.textMuted, fontSize: 11, textAlign: "center", marginHorizontal: 24, marginTop: 20, lineHeight: 18 },

  // Bottom bar
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: THEME.ui, borderTopWidth: 1, borderTopColor: THEME.ui2, paddingHorizontal: 20, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bottomBarLeft: {},
  bottomBarPrice: { color: THEME.accent, fontSize: 22, fontWeight: "900" },
  bottomBarLbl: { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  confirmBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: THEME.accent, paddingHorizontal: 24, paddingVertical: 16, borderRadius: 18 },
  confirmBtnTxt: { color: "#000", fontWeight: "900", fontSize: 14, letterSpacing: 1 },
});