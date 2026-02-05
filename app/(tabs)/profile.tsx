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
import { getUser, getBooks, User, Book, formatNumber } from "@/lib/storage";
import { BookCard } from "@/components/BookCard";
import * as Haptics from "expo-haptics";

export default function ProfileScreen() {
  const { colors, isDark, toggleNightMode, settings, updateSettings } = useTheme();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null>(null);
  const [myBooks, setMyBooks] = useState<Book[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const [userData, booksData] = await Promise.all([getUser(), getBooks()]);
    setUser(userData);
    setMyBooks(booksData.filter((b) => b.authorId === userData.id && b.status === "published"));
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const webTopPadding = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + webTopPadding, paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toggleNightMode();
            }}
            style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary }]}
          >
            <Ionicons name={isDark ? "sunny" : "moon"} size={20} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary }]}
          >
            <Ionicons name="settings-outline" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.profileSection}>
          <LinearGradient
            colors={[colors.primary, colors.primaryLight]}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>
              {user?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2) || "U"}
            </Text>
          </LinearGradient>
          <Text style={[styles.name, { color: colors.text }]}>{user?.name || "User"}</Text>
          <Text style={[styles.handle, { color: colors.textSecondary }]}>@{user?.name?.toLowerCase().replace(/\s+/g, "_") || "user"}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatNumber(user?.followers || 0)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Followers</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatNumber(user?.following || 0)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Following</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {user?.booksRead || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Books Read</Text>
            </View>
          </View>

          <Pressable
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            style={[styles.editBtn, { borderColor: colors.primary }]}
          >
            <Text style={[styles.editBtnText, { color: colors.primary }]}>Edit Profile</Text>
          </Pressable>
        </View>

        <View style={[styles.bioSection, { backgroundColor: colors.surfaceSecondary }]}>
          <Text style={[styles.bioTitle, { color: colors.text }]}>About</Text>
          <Text style={[styles.bioText, { color: colors.textSecondary }]}>
            {user?.bio || "No bio yet"}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Reading Interests</Text>
          <View style={styles.interestsRow}>
            {user?.interests?.map((interest, index) => (
              <View
                key={index}
                style={[styles.interestChip, { backgroundColor: colors.primaryLight + "30" }]}
              >
                <Text style={[styles.interestText, { color: colors.primary }]}>{interest}</Text>
              </View>
            ))}
          </View>
        </View>

        {user?.badges && user.badges.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Badges</Text>
            <View style={styles.badgesRow}>
              {user.badges.map((badge, index) => (
                <View
                  key={index}
                  style={[styles.badgeItem, { backgroundColor: colors.gold + "20" }]}
                >
                  <Ionicons
                    name={
                      badge === "Top Writer"
                        ? "ribbon"
                        : badge === "Storyteller"
                        ? "book"
                        : "star"
                    }
                    size={24}
                    color={colors.gold}
                  />
                  <Text style={[styles.badgeText, { color: colors.text }]}>{badge}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {myBooks.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Published Works</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.booksRow}
            >
              {myBooks.map((book) => (
                <BookCard key={book.id} book={book} size="small" showAuthor={false} />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Reading Settings</Text>
          <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="text" size={20} color={colors.text} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>Font Size</Text>
              </View>
              <View style={styles.fontSizeControl}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    updateSettings({ fontSize: Math.max(14, settings.fontSize - 2) });
                  }}
                  style={[styles.fontSizeBtn, { backgroundColor: colors.surfaceSecondary }]}
                >
                  <Ionicons name="remove" size={16} color={colors.text} />
                </Pressable>
                <Text style={[styles.fontSizeValue, { color: colors.text }]}>{settings.fontSize}</Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    updateSettings({ fontSize: Math.min(28, settings.fontSize + 2) });
                  }}
                  style={[styles.fontSizeBtn, { backgroundColor: colors.surfaceSecondary }]}
                >
                  <Ionicons name="add" size={16} color={colors.text} />
                </Pressable>
              </View>
            </View>
            <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggleNightMode();
              }}
              style={styles.settingItem}
            >
              <View style={styles.settingInfo}>
                <Ionicons name={settings.nightMode ? "moon" : "sunny"} size={20} color={colors.text} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>Night Mode</Text>
              </View>
              <View
                style={[
                  styles.toggle,
                  { backgroundColor: settings.nightMode ? colors.primary : colors.surfaceSecondary },
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    { transform: [{ translateX: settings.nightMode ? 18 : 2 }] },
                  ]}
                />
              </View>
            </Pressable>
          </View>
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
  headerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  profileSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: {
    color: "#FFF",
    fontSize: 36,
    fontFamily: "Inter_700Bold",
  },
  name: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  handle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  stat: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  statValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  editBtn: {
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  editBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  bioSection: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  bioTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  bioText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 16,
  },
  interestsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  interestChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  interestText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  badgeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  booksRow: {
    paddingRight: 20,
  },
  settingsCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  settingDivider: {
    height: 1,
  },
  fontSizeControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fontSizeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  fontSizeValue: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    minWidth: 24,
    textAlign: "center",
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFF",
  },
});
