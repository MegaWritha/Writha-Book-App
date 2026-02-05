import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/contexts/ThemeContext";
import { getWallet, WalletData, formatCurrency, Transaction } from "@/lib/storage";
import * as Haptics from "expo-haptics";

export default function WalletScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const walletData = await getWallet();
    setWallet(walletData);
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getTransactionIcon = (type: Transaction["type"]) => {
    switch (type) {
      case "earning":
        return "trending-up";
      case "tip":
        return "heart";
      case "withdrawal":
        return "arrow-down";
      default:
        return "swap-horizontal";
    }
  };

  const getTransactionColor = (type: Transaction["type"]) => {
    switch (type) {
      case "earning":
        return colors.success;
      case "tip":
        return colors.gold;
      case "withdrawal":
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const webTopPadding = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + webTopPadding + 16, paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Text style={[styles.title, { color: colors.text }]}>Wallet</Text>

        <LinearGradient
          colors={isDark ? ["#2D5A4F", "#1A1A1A"] : ["#2D5A4F", "#4A8B7C"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Ionicons name="eye-outline" size={20} color="rgba(255,255,255,0.7)" />
          </View>
          <Text style={styles.balanceAmount}>
            {wallet ? formatCurrency(wallet.balance) : "₦0"}
          </Text>
          <View style={styles.balanceActions}>
            <Pressable
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
              style={styles.balanceBtn}
            >
              <Ionicons name="arrow-up" size={20} color="#FFF" />
              <Text style={styles.balanceBtnText}>Withdraw</Text>
            </Pressable>
            <View style={styles.balanceDivider} />
            <Pressable
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              style={styles.balanceBtn}
            >
              <Ionicons name="stats-chart" size={20} color="#FFF" />
              <Text style={styles.balanceBtnText}>Analytics</Text>
            </Pressable>
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: colors.success + "20" }]}>
              <Ionicons name="trending-up" size={20} color={colors.success} />
            </View>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Earnings</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {wallet ? formatCurrency(wallet.earnings) : "₦0"}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: colors.gold + "20" }]}>
              <Ionicons name="heart" size={20} color={colors.gold} />
            </View>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Tips Received</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {wallet ? formatCurrency(wallet.tips) : "₦0"}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Recent Transactions
            </Text>
            <Pressable>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
            </Pressable>
          </View>

          {wallet?.transactions && wallet.transactions.length > 0 ? (
            wallet.transactions.map((transaction) => (
              <View
                key={transaction.id}
                style={[styles.transactionItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View
                  style={[
                    styles.transactionIcon,
                    { backgroundColor: getTransactionColor(transaction.type) + "20" },
                  ]}
                >
                  <Ionicons
                    name={getTransactionIcon(transaction.type) as any}
                    size={20}
                    color={getTransactionColor(transaction.type)}
                  />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={[styles.transactionDesc, { color: colors.text }]} numberOfLines={1}>
                    {transaction.description}
                  </Text>
                  <Text style={[styles.transactionDate, { color: colors.textMuted }]}>
                    {transaction.createdAt}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.transactionAmount,
                    {
                      color:
                        transaction.type === "withdrawal"
                          ? colors.error
                          : colors.success,
                    },
                  ]}
                >
                  {transaction.type === "withdrawal" ? "-" : "+"}
                  {formatCurrency(transaction.amount)}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No transactions yet
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Start earning by publishing your stories
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.withdrawInfo, { backgroundColor: colors.surfaceSecondary }]}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={[styles.withdrawInfoText, { color: colors.textSecondary }]}>
            Withdraw to Nigerian banks (GTBank, Access, First Bank, etc.) with minimum ₦1,000
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginBottom: 20,
  },
  balanceCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balanceLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  balanceAmount: {
    color: "#FFF",
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    marginTop: 8,
    marginBottom: 24,
  },
  balanceActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  balanceBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  balanceBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  balanceDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  seeAll: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
    marginRight: 12,
  },
  transactionDesc: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  transactionAmount: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
    textAlign: "center",
  },
  withdrawInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 12,
  },
  withdrawInfoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
});
