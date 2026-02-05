import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { GenreChip } from "@/components/GenreChip";
import { getBooks, saveBooks, Book, generateId } from "@/lib/storage";
import * as Haptics from "expo-haptics";

const GENRES = [
  "African Mythology",
  "Romance",
  "Education",
  "Science Fiction",
  "Poetry",
  "Historical",
  "Fantasy",
  "Drama",
];

export default function WriteScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0 && description.trim().length > 0 && selectedGenre;

  const handleSave = async (publish: boolean) => {
    if (!canSave) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);

    try {
      const books = await getBooks();
      const newBook: Book = {
        id: generateId(),
        title: title.trim(),
        author: "Amara Okonkwo",
        authorId: "user_1",
        cover: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400",
        genre: selectedGenre,
        description: description.trim(),
        chapters: [],
        isPaid: false,
        price: 0,
        rating: 0,
        reads: 0,
        likes: 0,
        status: publish ? "published" : "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: tags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0),
      };

      await saveBooks([...books, newBook]);
      router.back();
    } catch (error) {
      console.error("Error saving book:", error);
    } finally {
      setSaving(false);
    }
  };

  const webTopPadding = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + webTopPadding,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.headerBtn}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>New Book</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => handleSave(false)}
            disabled={!canSave || saving}
            style={[
              styles.saveBtn,
              { borderColor: canSave ? colors.primary : colors.border },
            ]}
          >
            <Text
              style={[
                styles.saveBtnText,
                { color: canSave ? colors.primary : colors.textMuted },
              ]}
            >
              Draft
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Book Title</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.surfaceSecondary, color: colors.text },
            ]}
            placeholder="Enter your book title"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Description</Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              { backgroundColor: colors.surfaceSecondary, color: colors.text },
            ]}
            placeholder="What is your book about?"
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={[styles.charCount, { color: colors.textMuted }]}>
            {description.length}/500
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Genre</Text>
          <View style={styles.genresGrid}>
            {GENRES.map((genre) => (
              <GenreChip
                key={genre}
                label={genre}
                selected={selectedGenre === genre}
                onPress={() => setSelectedGenre(genre)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Tags</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.surfaceSecondary, color: colors.text },
            ]}
            placeholder="fantasy, adventure, magic (comma separated)"
            placeholderTextColor={colors.textMuted}
            value={tags}
            onChangeText={setTags}
          />
        </View>

        <View style={[styles.tipCard, { backgroundColor: colors.surfaceSecondary }]}>
          <Ionicons name="bulb-outline" size={24} color={colors.gold} />
          <View style={styles.tipContent}>
            <Text style={[styles.tipTitle, { color: colors.text }]}>Writing Tips</Text>
            <Text style={[styles.tipText, { color: colors.textSecondary }]}>
              Start with a compelling hook. Your first chapter should grab readers and make them want more.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 16,
          },
        ]}
      >
        <Pressable
          onPress={() => handleSave(true)}
          disabled={!canSave || saving}
          style={[
            styles.publishBtn,
            { backgroundColor: canSave ? colors.primary : colors.surfaceSecondary },
          ]}
        >
          {saving ? (
            <Text style={[styles.publishBtnText, { color: canSave ? "#FFF" : colors.textMuted }]}>
              Saving...
            </Text>
          ) : (
            <>
              <Ionicons name="rocket-outline" size={20} color={canSave ? "#FFF" : colors.textMuted} />
              <Text style={[styles.publishBtnText, { color: canSave ? "#FFF" : colors.textMuted }]}>
                Create & Add Chapters
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginLeft: 8,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 10,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  textArea: {
    minHeight: 120,
    paddingTop: 14,
  },
  charCount: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
    marginTop: 6,
  },
  genresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tipCard: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 16,
    gap: 12,
    marginTop: 8,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  publishBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
  },
  publishBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
