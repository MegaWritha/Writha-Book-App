import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { Group, formatNumber } from "@/lib/storage";
import * as Haptics from "expo-haptics";

interface GroupCardProps {
  group: Group;
}

export function GroupCard({ group }: GroupCardProps) {
  const { colors } = useTheme();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/group/${group.id}`);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <Image
        source={{ uri: group.cover }}
        style={styles.cover}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {group.name}
          </Text>
          {group.isPrivate && (
            <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
          )}
        </View>
        <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
          {group.description}
        </Text>
        <View style={styles.footer}>
          <View style={styles.category}>
            <Text style={[styles.categoryText, { color: colors.primary }]}>
              {group.category}
            </Text>
          </View>
          <View style={styles.members}>
            <Ionicons name="people-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.memberCount, { color: colors.textMuted }]}>
              {formatNumber(group.memberCount)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 12,
  },
  cover: {
    width: 100,
    height: 100,
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  description: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  category: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  members: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  memberCount: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
