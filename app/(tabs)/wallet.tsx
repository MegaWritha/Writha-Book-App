import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { auth, db } from "../../lib/firebase";
import { doc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp, query, where, orderBy } from "firebase/firestore";

const THEME = {
  bg: "#05010A",       // Deep Void (Darkest Purple-Black)
  card: "#11061F",     // Subtle Muted Surface
  gold: "#D4AF37",     
  purple: "#6B21A8",   
  text: "#FFFFFF",
  muted: "#5A4F6B",    
  error: "#991B1B",    
};

const formatCurrency = (val: any) => {
  const num = typeof val === 'number' ? val : parseFloat(val) || 0;
  return "₦" + num.toLocaleString("en-NG", { minimumFractionDigits: 2 });
};

export default function WalletScreen() {
  const [activeTab, setActiveTab] = useState<"vault" | "withdrawal" | "intel">("vault");
  const [walletData, setWalletData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Withdrawal & Card States
  const [amount, setAmount] = useState("");
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [isAddingCard, setIsAddingCard] = useState(false);
  
  // Broad Compliance & Card Data
  const [bankDetails, setBankDetails] = useState({ 
    bank: "", accountNo: "", accountName: "", residentialAddress: "", bvn: "" 
  });
  const [cardDetails, setCardDetails] = useState({ 
    number: "", expiry: "", cvv: "", name: "" 
  });

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsubUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setWalletData(data.wallet || {
          balance: 0, royalties: 0, critical: 0, tips: 0, reading: 0, community: 0, curation: 0
        });
        if (data.bankInfo) setBankDetails(data.bankInfo);
        if (data.cardInfo) setCardDetails(data.cardInfo);
      }
      setLoading(false);
    });

    const q = query(collection(db, "payouts"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsubHistory = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubUser(); unsubHistory(); };
  }, []);

  const handleWithdraw = async () => {
    if (!bankDetails.bvn || !bankDetails.residentialAddress) {
        Alert.alert("Compliance Required", "Please complete your full legal profile for anti-fraud verification.");
        return;
    }
    Alert.alert("Verifying Identity", "Securely processing payout request...");
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color={THEME.gold} /></View>;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        <View style={styles.header}>
          <Text style={styles.title}>Writha Earnings</Text>
          <Text style={styles.tagline}>Your intellectual contributions, valued and secured.</Text>
        </View>

        {/* GOLD FRAME BALANCE */}
        <View style={styles.goldFrame}>
          <LinearGradient colors={["#1A0B2E", "#05010A"]} style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>TOTAL LIQUID ASSETS</Text>
            <Text style={styles.balanceAmount}>{formatCurrency(walletData?.balance)}</Text>
            
            <View style={styles.tabBar}>
                {["vault", "withdrawal", "intel"].map((t) => (
                  <Pressable 
                    key={t}
                    onPress={() => setActiveTab(t as any)} 
                    style={[styles.tab, activeTab === t && { backgroundColor: THEME.gold }]}
                  >
                    <Text style={[styles.tabText, activeTab === t && { color: "#000" }]}>{t.toUpperCase()}</Text>
                  </Pressable>
                ))}
            </View>
          </LinearGradient>
        </View>

        {/* VAULT: FULL BROAD CATEGORIES */}
        {activeTab === "vault" && (
          <View>
            <Text style={styles.sectionTitle}>REVENUE BREAKDOWN</Text>
            <EarningRow icon="book-outline" label="Book Royalties" desc="Direct Sales" val={walletData.royalties} color={THEME.gold} />
            <EarningRow icon="feather" label="Critical Rewards" desc="Scholarship Gains" val={walletData.critical} color={THEME.purple} />
            <EarningRow icon="heart-outline" label="Reader Support" desc="Tips & Appreciation" val={walletData.tips} color="#FF3B30" />
            <EarningRow icon="eye-outline" label="Reading Credits" desc="Proofing & Engagement" val={walletData.reading} color="#4CD964" />
            <EarningRow icon="people-outline" label="Community Ops" desc="Group Participation" val={walletData.community} color="#5AC8FA" />
            <EarningRow icon="ribbon-outline" label="Curation Gains" desc="Featured Content" val={walletData.curation} color="#FF9500" />
          </View>
        )}

        {/* WITHDRAWAL: CARDS + BANK + COMPLIANCE */}
        {activeTab === "withdrawal" && (
          <View style={styles.withdrawalBox}>
            
            {/* 1. VISUAL CARD UI */}
            <Text style={styles.sectionHeader}>LINKED SCHOLAR CARD</Text>
            <LinearGradient colors={["#30014D", "#1A0B2E"]} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.cardVisual}>
                <View style={styles.cardHeader}>
                    <MaterialCommunityIcons name="chip" size={36} color={THEME.gold} />
                    <Ionicons name="wifi-outline" size={24} color="#FFF" style={{transform: [{rotate: '90deg'}]}} />
                </View>
                <Text style={styles.cardNumber}>{cardDetails.number || "**** **** **** 0000"}</Text>
                <View style={styles.cardFooter}>
                    <Text style={styles.cardHolder}>{cardDetails.name || "LEGAL NAME"}</Text>
                    <Text style={styles.cardExpiry}>{cardDetails.expiry || "MM/YY"}</Text>
                </View>
            </LinearGradient>

            {isAddingCard ? (
                <View style={styles.formCard}>
                    <TextInput style={styles.input} placeholder="Cardholder Full Name" placeholderTextColor={THEME.muted} value={cardDetails.name} onChangeText={t => setCardDetails({...cardDetails, name: t})} />
                    <TextInput style={styles.input} placeholder="Card Number" placeholderTextColor={THEME.muted} keyboardType="numeric" value={cardDetails.number} onChangeText={t => setCardDetails({...cardDetails, number: t})} />
                    <View style={{flexDirection: 'row', gap: 10}}>
                        <TextInput style={[styles.input, {flex:1}]} placeholder="MM/YY" placeholderTextColor={THEME.muted} value={cardDetails.expiry} onChangeText={t => setCardDetails({...cardDetails, expiry: t})} />
                        <TextInput style={[styles.input, {flex:1}]} placeholder="CVV" placeholderTextColor={THEME.muted} secureTextEntry value={cardDetails.cvv} onChangeText={t => setCardDetails({...cardDetails, cvv: t})} />
                    </View>
                    <Pressable style={styles.saveBtn} onPress={() => setIsAddingCard(false)}><Text style={styles.saveBtnText}>LINK CARD</Text></Pressable>
                </View>
            ) : (
                <Pressable style={styles.ghostBtn} onPress={() => setIsAddingCard(true)}>
                    <Ionicons name="add-circle-outline" size={18} color={THEME.gold} />
                    <Text style={styles.ghostBtnText}>UPDATE CARD DETAILS</Text>
                </Pressable>
            )}

            {/* 2. BANK & COMPLIANCE */}
            <Text style={styles.sectionHeader}>DIRECT PAYOUT (IDENTITY VERIFIED)</Text>
            <View style={styles.bankForm}>
                {!isEditingBank && bankDetails.bank ? (
                    <View style={styles.savedRow}>
                        <View style={{flex:1}}>
                            <Text style={styles.bankTitle}>{bankDetails.bank}</Text>
                            <Text style={styles.bankSubtitle}>{bankDetails.accountNo} • {bankDetails.accountName}</Text>
                        </View>
                        <Pressable onPress={() => setIsEditingBank(true)}><Text style={styles.editText}>UPDATE</Text></Pressable>
                    </View>
                ) : (
                    <View>
                        <TextInput style={styles.input} placeholder="Bank Name" placeholderTextColor={THEME.muted} value={bankDetails.bank} onChangeText={t => setBankDetails({...bankDetails, bank: t})} />
                        <TextInput style={styles.input} placeholder="Account Number" placeholderTextColor={THEME.muted} keyboardType="numeric" value={bankDetails.accountNo} onChangeText={t => setBankDetails({...bankDetails, accountNo: t})} />
                        <TextInput style={styles.input} placeholder="Full Legal Name" placeholderTextColor={THEME.muted} value={bankDetails.accountName} onChangeText={t => setBankDetails({...bankDetails, accountName: t})} />
                        <TextInput style={styles.input} placeholder="Residential Home Address" placeholderTextColor={THEME.muted} value={bankDetails.residentialAddress} onChangeText={t => setBankDetails({...bankDetails, residentialAddress: t})} />
                        <TextInput style={styles.input} placeholder="Verification ID (BVN/NIN)" placeholderTextColor={THEME.muted} keyboardType="numeric" secureTextEntry value={bankDetails.bvn} onChangeText={t => setBankDetails({...bankDetails, bvn: t})} />
                        <Pressable style={styles.saveBtn} onPress={() => setIsEditingBank(false)}><Text style={styles.saveBtnText}>VERIFY & SECURE BANK</Text></Pressable>
                    </View>
                )}
            </View>

            {/* 3. WITHDRAWAL ACTION */}
            <View style={styles.withdrawSection}>
                <Text style={styles.label}>AMOUNT TO WITHDRAW</Text>
                <TextInput style={styles.hugeInput} placeholder="₦0" placeholderTextColor="#150826" keyboardType="numeric" value={amount} onChangeText={setAmount} />
                <Pressable style={styles.actionBtn} onPress={handleWithdraw}>
                    <Text style={styles.actionBtnText}>INITIATE PAYOUT</Text>
                </Pressable>
                <Text style={styles.legalNotice}>By initiating, you confirm the payout destination belongs to you legally.</Text>
            </View>
          </View>
        )}

        {/* INTEL: PAYOUT TRACKING */}
        {activeTab === "intel" && (
          <View>
            <Text style={styles.sectionHeader}>TRANSACTION INTELLIGENCE</Text>
            {history.map((tx) => (
              <View key={tx.id} style={styles.txCard}>
                <View style={{flex:1}}>
                  <Text style={styles.txAmount}>{formatCurrency(tx.amount)}</Text>
                  <Text style={styles.txSub}>{tx.createdAt?.toDate().toLocaleDateString()}</Text>
                </View>
                <Text style={[styles.txStatus, { color: tx.status === 'pending' ? THEME.gold : '#4CD964' }]}>{tx.status.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const EarningRow = ({ icon, label, desc, val, color }: any) => (
  <View style={styles.row}>
    <View style={[styles.rowIcon, { borderColor: color }]}>
      <MaterialCommunityIcons name={icon} size={22} color={color} />
    </View>
    <View style={{ flex: 1, marginLeft: 15 }}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowDesc}>{desc}</Text>
    </View>
    <Text style={styles.rowVal}>{formatCurrency(val)}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg, padding: 25 },
  centered: { flex: 1, backgroundColor: THEME.bg, justifyContent: 'center', alignItems: 'center' },
  header: { marginTop: 40, marginBottom: 25 },
  title: { fontSize: 34, fontWeight: "900", color: "#FFF", letterSpacing: -1 },
  tagline: { color: THEME.purple, fontSize: 13, marginTop: 5, fontWeight: "600" },
  goldFrame: { padding: 2, backgroundColor: THEME.gold, borderRadius: 32, marginBottom: 30 },
  balanceCard: { borderRadius: 30, padding: 25, alignItems: 'center' },
  balanceLabel: { color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  balanceAmount: { fontSize: 48, fontWeight: "900", color: "#FFF", marginVertical: 10 },
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 5, marginTop: 15, width: '100%' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 15 },
  tabText: { color: '#444', fontSize: 10, fontWeight: "900" },

  sectionTitle: { color: THEME.gold, fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 15 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, padding: 20, borderRadius: 25, marginBottom: 12 },
  rowIcon: { width: 45, height: 45, borderRadius: 15, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  rowDesc: { color: THEME.muted, fontSize: 11, marginTop: 2 },
  rowVal: { color: THEME.gold, fontWeight: '900', fontSize: 16 },

  withdrawalBox: { gap: 15 },
  sectionHeader: { color: THEME.gold, fontSize: 9, fontWeight: '900', letterSpacing: 2, marginTop: 10, marginBottom: 10 },
  
  cardVisual: { width: '100%', height: 190, borderRadius: 28, padding: 25, justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardNumber: { color: '#FFF', fontSize: 22, letterSpacing: 3, fontWeight: '700', marginTop: 15 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  cardHolder: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  cardExpiry: { color: THEME.muted, fontSize: 12, fontWeight: '800' },

  ghostBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18, borderRadius: 20, borderStyle: 'dashed', borderWidth: 1, borderColor: THEME.purple },
  ghostBtnText: { color: THEME.gold, fontWeight: '800', fontSize: 12 },

  bankForm: { backgroundColor: THEME.card, padding: 22, borderRadius: 28 },
  savedRow: { flexDirection: 'row', alignItems: 'center' },
  bankTitle: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  bankSubtitle: { color: THEME.muted, fontSize: 12, marginTop: 2 },
  editText: { color: THEME.gold, fontSize: 10, fontWeight: '900' },

  formCard: { backgroundColor: THEME.card, padding: 20, borderRadius: 28 },
  input: { borderBottomWidth: 1, borderBottomColor: '#2A104A', color: '#FFF', padding: 12, marginBottom: 15 },
  saveBtn: { backgroundColor: THEME.purple, padding: 16, borderRadius: 16, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontWeight: '900', fontSize: 11 },

  withdrawSection: { marginTop: 20 },
  label: { color: THEME.gold, fontSize: 10, fontWeight: '900', marginBottom: 10 },
  hugeInput: { color: '#FFF', fontSize: 64, fontWeight: '900', marginBottom: 20 },
  actionBtn: { backgroundColor: THEME.gold, padding: 22, borderRadius: 22, alignItems: 'center' },
  actionBtnText: { color: '#000', fontWeight: '900', letterSpacing: 1 },
  legalNotice: { color: THEME.muted, fontSize: 10, marginTop: 15, textAlign: 'center' },

  txCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, padding: 20, borderRadius: 25, marginBottom: 10 },
  txAmount: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  txSub: { color: THEME.muted, fontSize: 11 },
  txStatus: { fontSize: 10, fontWeight: '900' }
});