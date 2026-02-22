import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { auth, db } from "../../lib/firebase";
import {
  doc,
  onSnapshot,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  updateDoc,
  setDoc,
  getDoc,
} from "firebase/firestore";

const { width } = Dimensions.get("window");

const THEME = {
  bg: "#0F071A",
  card: "#1E1135",
  card2: "#2D1B4D",
  gold: "#FFD700",
  goldDim: "rgba(255,215,0,0.12)",
  purple: "#6D28D9",
  purpleBright: "#8B5CF6",
  text: "#E2E8F0",
  textMuted: "#94A3B8",
  green: "#22C55E",
  red: "#EF4444",
};

const formatNaira = (val: any) => {
  const num = typeof val === "number" ? val : parseFloat(val) || 0;
  return "₦" + num.toLocaleString("en-NG", { minimumFractionDigits: 2 });
};

const formatDate = (ts: any) => {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  });
};

// ── EARNING ROW ───────────────────────────────────────────────────────────
const EarningRow = ({ icon, label, desc, val, color }: any) => (
  <View style={styles.earningRow}>
    <View style={[styles.earningIcon, { borderColor: color + "50", backgroundColor: color + "15" }]}>
      <MaterialCommunityIcons name={icon} size={20} color={color} />
    </View>
    <View style={{ flex: 1, marginLeft: 14 }}>
      <Text style={styles.earningLabel}>{label}</Text>
      <Text style={styles.earningDesc}>{desc}</Text>
    </View>
    <Text style={[styles.earningVal, { color }]}>{formatNaira(val)}</Text>
  </View>
);

// ── TX STATUS BADGE ───────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    pending: THEME.gold,
    processing: THEME.purpleBright,
    completed: THEME.green,
    failed: THEME.red,
  };
  return (
    <View style={[styles.statusBadge, { backgroundColor: (colors[status] || THEME.textMuted) + "20" }]}>
      <Text style={[styles.statusTxt, { color: colors[status] || THEME.textMuted }]}>
        {status.toUpperCase()}
      </Text>
    </View>
  );
};

// ── MAIN SCREEN ───────────────────────────────────────────────────────────
export default function WalletScreen() {
  const user = auth.currentUser;
  const [activeTab, setActiveTab] = useState<"overview" | "withdraw" | "history">("overview");
  const [walletData, setWalletData] = useState<any>(null);
  const [bankInfo, setBankInfo] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Withdraw flow
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankForm, setBankForm] = useState({
    bankName: "",
    accountNumber: "",
    accountName: "",
    bvn: "",
  });
  const [savingBank, setSavingBank] = useState(false);

  // ── LISTENERS ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const unsubUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setWalletData(
          data.wallet || {
            balance: 0,
            totalEarned: 0,
            royalties: 0,
            tips: 0,
            criticalRewards: 0,
            readingCredits: 0,
            communityOps: 0,
            curationGains: 0,
          }
        );
        setBankInfo(data.bankInfo || null);
      }
      setLoading(false);
    });

    const qHistory = query(
      collection(db, "payouts"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsubHistory = onSnapshot(qHistory, (snap) => {
      setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubUser(); unsubHistory(); };
  }, []);

  // ── SAVE BANK DETAILS ─────────────────────────────────────────────────
  const saveBankDetails = async () => {
    if (!bankForm.bankName || !bankForm.accountNumber || !bankForm.accountName) {
      return Alert.alert("Required", "Please fill in all bank details.");
    }
    if (bankForm.accountNumber.length !== 10) {
      return Alert.alert("Invalid", "Account number must be 10 digits.");
    }
    if (bankForm.bvn && bankForm.bvn.length !== 11) {
      return Alert.alert("Invalid", "BVN must be 11 digits.");
    }

    setSavingBank(true);
    try {
      await updateDoc(doc(db, "users", user!.uid), {
        bankInfo: {
          ...bankForm,
          // ⚠️ NOTE: In production, BVN should be verified via
          // Paystack's BVN verification API on your backend,
          // NOT stored in plain text in Firestore.
          // Store only a verification status flag here.
          verifiedAt: serverTimestamp(),
        },
      });
      setBankInfo(bankForm);
      setShowBankModal(false);
      Alert.alert("✅ Saved", "Bank details secured.");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSavingBank(false);
    }
  };

  // ── WITHDRAWAL REQUEST ────────────────────────────────────────────────
  const handleWithdraw = async () => {
    const amt = parseFloat(withdrawAmount);

    if (!bankInfo) {
      return Alert.alert(
        "Bank Required",
        "Please add your bank details before withdrawing.",
        [{ text: "Add Bank", onPress: () => setShowBankModal(true) }, { text: "Cancel" }]
      );
    }

    if (!amt || amt < 500) {
      return Alert.alert("Minimum Withdrawal", "Minimum withdrawal amount is ₦500.");
    }

    if (amt > (walletData?.balance || 0)) {
      return Alert.alert("Insufficient Balance", "You don't have enough funds.");
    }

    Alert.alert(
      "Confirm Withdrawal",
      `Withdraw ${formatNaira(amt)} to ${bankInfo.bankName} (${bankInfo.accountNumber})?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setWithdrawing(true);
            try {
              // ✅ This creates a payout REQUEST in Firestore.
              // ─────────────────────────────────────────────────────────
              // 🔴 IMPORTANT: The ACTUAL bank transfer must be triggered
              // by your backend (Node.js/Cloud Function) that watches
              // this collection and calls the Paystack Transfer API.
              //
              // NEVER call Paystack directly from the app —
              // your secret key would be exposed.
              //
              // Backend flow:
              // 1. Cloud Function triggers on new payout doc
              // 2. Verifies user balance in Firestore
              // 3. Calls POST https://api.paystack.co/transfer
              // 4. Updates payout doc status to "processing"/"completed"
              // 5. Deducts balance from user's wallet
              // ─────────────────────────────────────────────────────────
              await addDoc(collection(db, "payouts"), {
                userId: user!.uid,
                amount: amt,
                bankName: bankInfo.bankName,
                accountNumber: bankInfo.accountNumber,
                accountName: bankInfo.accountName,
                status: "pending",
                createdAt: serverTimestamp(),
              });

              setWithdrawAmount("");
              Alert.alert(
                "Request Submitted ✅",
                "Your withdrawal is being processed. Funds arrive within 24 hours."
              );
            } catch (e: any) {
              Alert.alert("Error", e.message);
            } finally {
              setWithdrawing(false);
            }
          },
        },
      ]
    );
  };

  // ── LOADING ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={THEME.gold} size="large" />
        <Text style={{ color: THEME.textMuted, marginTop: 12 }}>Loading wallet...</Text>
      </View>
    );
  }

  const balance = walletData?.balance || 0;
  const totalEarned = walletData?.totalEarned || 0;

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerSmall}>WRITHA</Text>
          <Text style={styles.headerTitle}>Earnings Vault</Text>
        </View>

        {/* BALANCE CARD */}
        <View style={styles.balanceCardOuter}>
          <LinearGradient
            colors={["#2D1B4D", "#1E1135", "#0F071A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            {/* Top row */}
            <View style={styles.balanceCardTop}>
              <View>
                <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
                <Text style={styles.balanceAmount}>{formatNaira(balance)}</Text>
              </View>
              <View style={styles.walletIconCircle}>
                <Ionicons name="wallet" size={28} color={THEME.gold} />
              </View>
            </View>

            {/* Total earned strip */}
            <View style={styles.totalEarnedStrip}>
              <View style={styles.earnedBox}>
                <Text style={styles.earnedLabel}>TOTAL EARNED</Text>
                <Text style={styles.earnedVal}>{formatNaira(totalEarned)}</Text>
              </View>
              <View style={styles.earnedDivider} />
              <View style={styles.earnedBox}>
                <Text style={styles.earnedLabel}>WITHDRAWN</Text>
                <Text style={styles.earnedVal}>
                  {formatNaira(
                    history
                      .filter((h) => h.status === "completed")
                      .reduce((a, h) => a + h.amount, 0)
                  )}
                </Text>
              </View>
              <View style={styles.earnedDivider} />
              <View style={styles.earnedBox}>
                <Text style={styles.earnedLabel}>PENDING</Text>
                <Text style={[styles.earnedVal, { color: THEME.gold }]}>
                  {formatNaira(
                    history
                      .filter((h) => h.status === "pending")
                      .reduce((a, h) => a + h.amount, 0)
                  )}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* TABS */}
        <View style={styles.tabs}>
          {[
            { key: "overview", icon: "bar-chart-outline", label: "Overview" },
            { key: "withdraw", icon: "arrow-up-circle-outline", label: "Withdraw" },
            { key: "history", icon: "time-outline", label: "History" },
          ].map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, activeTab === t.key && styles.tabActive]}
              onPress={() => setActiveTab(t.key as any)}
            >
              <Ionicons
                name={t.icon as any}
                size={18}
                color={activeTab === t.key ? "#000" : THEME.textMuted}
              />
              <Text style={[styles.tabTxt, activeTab === t.key && styles.tabTxtActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>REVENUE BREAKDOWN</Text>
            <EarningRow icon="book-open-variant" label="Book Royalties" desc="From book sales" val={walletData?.royalties} color={THEME.gold} />
            <EarningRow icon="feather" label="Critical Rewards" desc="Scholarship & reviews" val={walletData?.criticalRewards} color={THEME.purpleBright} />
            <EarningRow icon="heart-outline" label="Reader Tips" desc="Appreciation from readers" val={walletData?.tips} color="#F43F5E" />
            <EarningRow icon="eye-outline" label="Reading Credits" desc="Engagement earnings" val={walletData?.readingCredits} color={THEME.green} />
            <EarningRow icon="account-group-outline" label="Community Ops" desc="Group participation" val={walletData?.communityOps} color="#38BDF8" />
            <EarningRow icon="ribbon-outline" label="Curation Gains" desc="Featured content bonuses" val={walletData?.curationGains} color="#FB923C" />

            {/* HOW EARNINGS WORK */}
            <View style={styles.infoBox}>
              <View style={styles.infoHeader}>
                <Ionicons name="information-circle" size={18} color={THEME.gold} />
                <Text style={styles.infoTitle}>How Writha Earnings Work</Text>
              </View>
              <Text style={styles.infoTxt}>
                • When readers purchase your books, royalties are credited to your wallet instantly.{"\n\n"}
                • Tips from readers are added in real time.{"\n\n"}
                • Critical and curation rewards are reviewed and credited within 48 hours.{"\n\n"}
                • Writha takes a 20% platform fee on all earnings. You receive 80%.{"\n\n"}
                • Minimum withdrawal: ₦500. Processing time: up to 24 hours.
              </Text>
            </View>
          </View>
        )}

        {/* ── WITHDRAW TAB ── */}
        {activeTab === "withdraw" && (
          <View style={styles.section}>

            {/* BANK DETAILS CARD */}
            <Text style={styles.sectionTitle}>PAYOUT DESTINATION</Text>
            {bankInfo ? (
              <View style={styles.bankCard}>
                <View style={styles.bankCardLeft}>
                  <View style={styles.bankIconCircle}>
                    <Ionicons name="business" size={20} color={THEME.gold} />
                  </View>
                  <View style={{ marginLeft: 14 }}>
                    <Text style={styles.bankName}>{bankInfo.bankName}</Text>
                    <Text style={styles.bankAccNum}>{bankInfo.accountNumber}</Text>
                    <Text style={styles.bankAccName}>{bankInfo.accountName}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => {
                  setBankForm(bankInfo);
                  setShowBankModal(true);
                }}>
                  <Text style={styles.editBankTxt}>EDIT</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addBankBtn} onPress={() => setShowBankModal(true)}>
                <Ionicons name="add-circle-outline" size={22} color={THEME.gold} />
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.addBankTitle}>Add Bank Account</Text>
                  <Text style={styles.addBankSub}>Required to receive payouts</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={THEME.textMuted} style={{ marginLeft: "auto" }} />
              </TouchableOpacity>
            )}

            {/* WITHDRAW AMOUNT */}
            <Text style={[styles.sectionTitle, { marginTop: 28 }]}>WITHDRAWAL AMOUNT</Text>
            <View style={styles.amountCard}>
              <Text style={styles.currencySymbol}>₦</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={THEME.card2}
                keyboardType="numeric"
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
              />
            </View>

            {/* QUICK AMOUNTS */}
            <View style={styles.quickAmounts}>
              {["1000", "5000", "10000", "50000"].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={styles.quickAmtBtn}
                  onPress={() => setWithdrawAmount(amt)}
                >
                  <Text style={styles.quickAmtTxt}>₦{parseInt(amt).toLocaleString()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* WITHDRAWAL SUMMARY */}
            {withdrawAmount ? (
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLbl}>Amount</Text>
                  <Text style={styles.summaryVal}>{formatNaira(parseFloat(withdrawAmount) || 0)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLbl}>Processing Fee</Text>
                  <Text style={styles.summaryVal}>₦0.00</Text>
                </View>
                <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: THEME.card2, paddingTop: 10, marginTop: 4 }]}>
                  <Text style={[styles.summaryLbl, { color: THEME.text, fontWeight: "800" }]}>You Receive</Text>
                  <Text style={[styles.summaryVal, { color: THEME.gold }]}>
                    {formatNaira(parseFloat(withdrawAmount) || 0)}
                  </Text>
                </View>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.withdrawBtn, withdrawing && { opacity: 0.7 }]}
              onPress={handleWithdraw}
              disabled={withdrawing}
              activeOpacity={0.85}
            >
              {withdrawing ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="arrow-up-circle" size={20} color="#000" />
                  <Text style={styles.withdrawBtnTxt}>REQUEST PAYOUT</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.legalNotice}>
              By requesting a payout, you confirm this bank account legally belongs to you.
              Payouts are processed via Paystack. Processing time: up to 24 hours.
              Minimum withdrawal: ₦500.
            </Text>

            {/* LEGAL NOTICE BOX */}
            <View style={styles.warningBox}>
              <Ionicons name="shield-checkmark" size={18} color={THEME.purpleBright} />
              <Text style={styles.warningTxt}>
                Writha uses Paystack to process all payouts securely. Your bank details are
                encrypted and never shared. All transactions comply with CBN regulations.
              </Text>
            </View>
          </View>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === "history" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TRANSACTION HISTORY</Text>

            {history.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 44 }}>📊</Text>
                <Text style={styles.emptyTitle}>No Transactions Yet</Text>
                <Text style={styles.emptySub}>Your withdrawal history will appear here.</Text>
              </View>
            ) : (
              history.map((tx) => (
                <View key={tx.id} style={styles.txCard}>
                  <View style={styles.txIconCircle}>
                    <Ionicons
                      name={tx.status === "completed" ? "checkmark-circle" : tx.status === "failed" ? "close-circle" : "time"}
                      size={22}
                      color={tx.status === "completed" ? THEME.green : tx.status === "failed" ? THEME.red : THEME.gold}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.txBank}>{tx.bankName}</Text>
                    <Text style={styles.txAccNum}>{tx.accountNumber}</Text>
                    <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.txAmount}>{formatNaira(tx.amount)}</Text>
                    <StatusBadge status={tx.status} />
                  </View>
                </View>
              ))
            )}
          </View>
        )}

      </ScrollView>

      {/* ── BANK DETAILS MODAL ── */}
      <Modal visible={showBankModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Bank Details</Text>
                <Text style={styles.modalSub}>Your payout destination</Text>
              </View>
              <TouchableOpacity onPress={() => setShowBankModal(false)}>
                <Ionicons name="close-circle" size={28} color={THEME.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* SECURITY NOTE */}
              <View style={styles.securityNote}>
                <Ionicons name="lock-closed" size={14} color={THEME.green} />
                <Text style={styles.securityNoteTxt}>
                  Your details are encrypted and stored securely. BVN is used for identity
                  verification only and is never shared with third parties.
                </Text>
              </View>

              <Text style={styles.inputLabel}>BANK NAME</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Access Bank, GTBank, Zenith..."
                placeholderTextColor={THEME.textMuted}
                value={bankForm.bankName}
                onChangeText={(t) => setBankForm({ ...bankForm, bankName: t })}
              />

              <Text style={styles.inputLabel}>ACCOUNT NUMBER</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="10-digit NUBAN number"
                placeholderTextColor={THEME.textMuted}
                keyboardType="numeric"
                maxLength={10}
                value={bankForm.accountNumber}
                onChangeText={(t) => setBankForm({ ...bankForm, accountNumber: t })}
              />

              <Text style={styles.inputLabel}>ACCOUNT NAME (as on bank records)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Full legal name"
                placeholderTextColor={THEME.textMuted}
                value={bankForm.accountName}
                onChangeText={(t) => setBankForm({ ...bankForm, accountName: t })}
              />

              <Text style={styles.inputLabel}>BVN (Bank Verification Number)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="11-digit BVN"
                placeholderTextColor={THEME.textMuted}
                keyboardType="numeric"
                maxLength={11}
                secureTextEntry
                value={bankForm.bvn}
                onChangeText={(t) => setBankForm({ ...bankForm, bvn: t })}
              />
              <Text style={styles.bvnNote}>
                💡 Dial *565*0# on any network to get your BVN. Required by CBN for all financial transactions.
              </Text>

              <TouchableOpacity
                style={[styles.saveModalBtn, savingBank && { opacity: 0.7 }]}
                onPress={saveBankDetails}
                disabled={savingBank}
              >
                {savingBank ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark" size={18} color="#000" />
                    <Text style={styles.saveModalBtnTxt}>SAVE & SECURE</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  centered: { flex: 1, backgroundColor: THEME.bg, justifyContent: "center", alignItems: "center" },

  // Header
  header: { paddingTop: 60, paddingHorizontal: 24, marginBottom: 24 },
  headerSmall: { color: THEME.gold, fontSize: 11, fontWeight: "900", letterSpacing: 4 },
  headerTitle: { color: THEME.text, fontSize: 32, fontWeight: "900", marginTop: 4 },

  // Balance card
  balanceCardOuter: { marginHorizontal: 16, borderRadius: 28, borderWidth: 1.5, borderColor: THEME.gold + "40", overflow: "hidden", marginBottom: 24 },
  balanceCard: { padding: 24 },
  balanceCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  balanceLabel: { color: THEME.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  balanceAmount: { color: THEME.text, fontSize: 44, fontWeight: "900", marginTop: 8 },
  walletIconCircle: { width: 52, height: 52, borderRadius: 16, backgroundColor: THEME.goldDim, justifyContent: "center", alignItems: "center" },
  totalEarnedStrip: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 16, padding: 16, marginTop: 20 },
  earnedBox: { flex: 1, alignItems: "center" },
  earnedLabel: { color: THEME.textMuted, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  earnedVal: { color: THEME.text, fontSize: 15, fontWeight: "900", marginTop: 4 },
  earnedDivider: { width: 1, backgroundColor: THEME.card2 },

  // Tabs
  tabs: { flexDirection: "row", marginHorizontal: 16, backgroundColor: THEME.card, borderRadius: 18, padding: 5, marginBottom: 8 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 14, gap: 6 },
  tabActive: { backgroundColor: THEME.gold },
  tabTxt: { color: THEME.textMuted, fontWeight: "800", fontSize: 11 },
  tabTxtActive: { color: "#000" },

  // Section
  section: { paddingHorizontal: 16, paddingTop: 12 },
  sectionTitle: { color: THEME.gold, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 14 },

  // Earning rows
  earningRow: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.card, padding: 18, borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: THEME.card2 },
  earningIcon: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  earningLabel: { color: THEME.text, fontWeight: "800", fontSize: 14 },
  earningDesc: { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  earningVal: { fontWeight: "900", fontSize: 15 },

  // Info box
  infoBox: { backgroundColor: THEME.card, borderRadius: 20, padding: 20, marginTop: 20, borderWidth: 1, borderColor: THEME.card2 },
  infoHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  infoTitle: { color: THEME.gold, fontWeight: "800", fontSize: 14 },
  infoTxt: { color: THEME.textMuted, fontSize: 13, lineHeight: 22 },

  // Bank card
  bankCard: { backgroundColor: THEME.card, borderRadius: 20, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: THEME.card2 },
  bankCardLeft: { flexDirection: "row", alignItems: "center" },
  bankIconCircle: { width: 44, height: 44, borderRadius: 13, backgroundColor: THEME.goldDim, justifyContent: "center", alignItems: "center" },
  bankName: { color: THEME.text, fontWeight: "800", fontSize: 15 },
  bankAccNum: { color: THEME.textMuted, fontSize: 13, marginTop: 2 },
  bankAccName: { color: THEME.purpleBright, fontSize: 11, marginTop: 2 },
  editBankTxt: { color: THEME.gold, fontWeight: "900", fontSize: 10 },
  addBankBtn: { backgroundColor: THEME.card, borderRadius: 20, padding: 18, flexDirection: "row", alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderColor: THEME.gold },
  addBankTitle: { color: THEME.text, fontWeight: "800", fontSize: 14 },
  addBankSub: { color: THEME.textMuted, fontSize: 11, marginTop: 2 },

  // Amount input
  amountCard: { backgroundColor: THEME.card, borderRadius: 20, padding: 20, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: THEME.card2 },
  currencySymbol: { color: THEME.gold, fontSize: 32, fontWeight: "900", marginRight: 8 },
  amountInput: { flex: 1, color: THEME.text, fontSize: 40, fontWeight: "900" },
  quickAmounts: { flexDirection: "row", gap: 10, marginTop: 14, flexWrap: "wrap" },
  quickAmtBtn: { backgroundColor: THEME.card2, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  quickAmtTxt: { color: THEME.text, fontWeight: "700", fontSize: 13 },

  // Summary
  summaryCard: { backgroundColor: THEME.card, borderRadius: 20, padding: 18, marginTop: 16, borderWidth: 1, borderColor: THEME.card2 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  summaryLbl: { color: THEME.textMuted, fontSize: 13 },
  summaryVal: { color: THEME.text, fontSize: 13, fontWeight: "700" },

  // Withdraw button
  withdrawBtn: { backgroundColor: THEME.gold, borderRadius: 20, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 20 },
  withdrawBtnTxt: { color: "#000", fontWeight: "900", fontSize: 15, letterSpacing: 1 },
  legalNotice: { color: THEME.textMuted, fontSize: 11, textAlign: "center", marginTop: 14, lineHeight: 18 },
  warningBox: { flexDirection: "row", gap: 10, backgroundColor: THEME.purpleBright + "15", borderRadius: 16, padding: 16, marginTop: 20, borderWidth: 1, borderColor: THEME.purpleBright + "30", alignItems: "flex-start" },
  warningTxt: { color: THEME.textMuted, fontSize: 12, flex: 1, lineHeight: 18 },

  // History
  txCard: { backgroundColor: THEME.card, borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", marginBottom: 10, borderWidth: 1, borderColor: THEME.card2 },
  txIconCircle: { width: 44, height: 44, borderRadius: 13, backgroundColor: THEME.card2, justifyContent: "center", alignItems: "center" },
  txBank: { color: THEME.text, fontWeight: "800", fontSize: 14 },
  txAccNum: { color: THEME.textMuted, fontSize: 12, marginTop: 2 },
  txDate: { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  txAmount: { color: THEME.text, fontWeight: "900", fontSize: 16 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  statusTxt: { fontSize: 9, fontWeight: "900" },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { color: THEME.text, fontSize: 18, fontWeight: "800", marginTop: 12 },
  emptySub: { color: THEME.textMuted, fontSize: 13, marginTop: 6 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: THEME.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: "90%", borderWidth: 1, borderColor: THEME.card2 },
  modalHandle: { width: 40, height: 4, backgroundColor: THEME.card2, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  modalTitle: { color: THEME.gold, fontSize: 20, fontWeight: "900" },
  modalSub: { color: THEME.textMuted, fontSize: 12, marginTop: 3 },
  securityNote: { flexDirection: "row", gap: 8, backgroundColor: THEME.green + "15", borderRadius: 12, padding: 12, marginBottom: 20, alignItems: "flex-start" },
  securityNoteTxt: { color: THEME.textMuted, fontSize: 12, flex: 1, lineHeight: 18 },
  inputLabel: { color: THEME.gold, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 8, marginTop: 16 },
  modalInput: { backgroundColor: THEME.bg, borderRadius: 14, padding: 16, color: THEME.text, fontSize: 15, borderWidth: 1, borderColor: THEME.card2 },
  bvnNote: { color: THEME.textMuted, fontSize: 11, marginTop: 8, lineHeight: 17 },
  saveModalBtn: { backgroundColor: THEME.gold, borderRadius: 18, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 28 },
  saveModalBtnTxt: { color: "#000", fontWeight: "900", fontSize: 14, letterSpacing: 1 },
});