import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { Book, formatNumber } from "@/lib/storage";
import * as Haptics from "expo-haptics";

interface BookCardProps {
  book: Book;
  size?: "small" | "medium" | "large";
  showAuthor?: boolean;
}

export function BookCard({ book, size = "medium", showAuthor = true }: BookCardProps) {
  const { colors } = useTheme();

  const dimensions = {
    small: { width: 100, height: 150 },
    medium: { width: 140, height: 210 },
    large: { width: 180, height: 270 },
  };

  const { width, height } = dimensions[size];

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/book/${book.id}`);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        { width, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      <View style={[styles.coverContainer, { height, borderRadius: 12 }]}>
        <Image
          source={{ uri: book.cover }}
          style={[styles.cover, { borderRadius: 12 }]}
          contentFit="cover"
          transition={200}
        />
        {book.isPaid && (
          <View style={[styles.priceBadge, { backgroundColor: colors.gold }]}>
            <Text style={styles.priceText}>₦{book.price}</Text>
          </View>
        )}
        {book.status === "draft" && (
          <View style={[styles.draftBadge, { backgroundColor: colors.textMuted }]}>
            <Text style={styles.draftText}>Draft</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text
          style={[styles.title, { color: colors.text, fontSize: size === "small" ? 12 : 14 }]}
          numberOfLines={2}
        >
          {book.title}
        </Text>
        {showAuthor && (
          <Text
            style={[styles.author, { color: colors.textSecondary, fontSize: size === "small" ? 10 : 12 }]}
            numberOfLines={1}
          >
            {book.author}
          </Text>
        )}
        {size !== "small" && (
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Ionicons name="eye-outline" size={12} color={colors.textMuted} />
              <Text style={[styles.statText, { color: colors.textMuted }]}>
                {formatNumber(book.reads)}
              </Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="heart-outline" size={12} color={colors.textMuted} />
              <Text style={[styles.statText, { color: colors.textMuted }]}>
                {formatNumber(book.likes)}
              </Text>
            </View>
            {book.rating > 0 && (
              <View style={styles.stat}>
                <Ionicons name="star" size={12} color={colors.gold} />
                <Text style={[styles.statText, { color: colors.textMuted }]}>
                  {book.rating.toFixed(1)}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: 16,
  },
  coverContainer: {
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  cover: {
    width: "100%",
    height: "100%",
  },
  priceBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priceText: {
    color: "#FFF",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  draftBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  draftText: {
    color: "#FFF",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  info: {
    marginTop: 10,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    lineHeight: 18,
  },
  author: {
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  stats: {
    flexDirection: "row",
    marginTop: 6,
    gap: 10,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  statText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
