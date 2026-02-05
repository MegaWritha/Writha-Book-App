import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  FlatList,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/contexts/ThemeContext";
import { getGroups, getMessages, saveMessage, getUser, Group, Message, User, generateId } from "@/lib/storage";
import * as Haptics from "expo-haptics";

interface MessageItemProps {
  message: Message;
  isOwnMessage: boolean;
}

function MessageItem({ message, isOwnMessage }: MessageItemProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.messageContainer, isOwnMessage && styles.ownMessageContainer]}>
      {!isOwnMessage && (
        <LinearGradient
          colors={[colors.primary, colors.primaryLight]}
          style={styles.messageAvatar}
        >
          <Text style={styles.messageAvatarText}>
            {message.userName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </Text>
        </LinearGradient>
      )}
      <View
        style={[
          styles.messageBubble,
          {
            backgroundColor: isOwnMessage ? colors.primary : colors.surfaceSecondary,
            borderBottomRightRadius: isOwnMessage ? 4 : 16,
            borderBottomLeftRadius: isOwnMessage ? 16 : 4,
          },
        ]}
      >
        {!isOwnMessage && (
          <Text style={[styles.messageSender, { color: colors.primary }]}>{message.userName}</Text>
        )}
        <Text
          style={[
            styles.messageText,
            { color: isOwnMessage ? "#FFF" : colors.text },
          ]}
        >
          {message.content}
        </Text>
        <Text
          style={[
            styles.messageTime,
            { color: isOwnMessage ? "rgba(255,255,255,0.7)" : colors.textMuted },
          ]}
        >
          {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    </View>
  );
}

export default function GroupChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [inputText, setInputText] = useState("");

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    const [groups, messagesData, userData] = await Promise.all([
      getGroups(),
      getMessages(id),
      getUser(),
    ]);
    const foundGroup = groups.find((g) => g.id === id);
    setGroup(foundGroup || null);
    setMessages(messagesData);
    setUser(userData);
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !user || !id) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newMessage: Message = {
      id: generateId(),
      groupId: id,
      userId: user.id,
      userName: user.name,
      content: inputText.trim(),
      createdAt: new Date().toISOString(),
    };

    await saveMessage(newMessage);
    setMessages([...messages, newMessage]);
    setInputText("");
  };

  const webTopPadding = Platform.OS === "web" ? 67 : 0;

  if (!group) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.loading, { paddingTop: insets.top + webTopPadding }]}>
          <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading group...
          </Text>
        </View>
      </View>
    );
  }

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
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Image source={{ uri: group.cover }} style={styles.headerImage} contentFit="cover" />
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {group.name}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {group.memberCount} members
          </Text>
        </View>
        <Pressable style={styles.headerAction}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.chatContainer}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageItem message={item} isOwnMessage={item.userId === user?.id} />
          )}
          contentContainerStyle={[styles.messagesList, { paddingBottom: 16 }]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No messages yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Start the conversation!
              </Text>
            </View>
          }
        />

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 8,
            },
          ]}
        >
          <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceSecondary }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Type a message..."
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
            <Pressable
              onPress={sendMessage}
              disabled={!inputText.trim()}
              style={[
                styles.sendBtn,
                {
                  backgroundColor: inputText.trim() ? colors.primary : colors.surfaceSecondary,
                },
              ]}
            >
              <Ionicons
                name="send"
                size={18}
                color={inputText.trim() ? "#FFF" : colors.textMuted}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  headerImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  headerAction: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  messageContainer: {
    flexDirection: "row",
    marginBottom: 12,
    maxWidth: "85%",
  },
  ownMessageContainer: {
    alignSelf: "flex-end",
    flexDirection: "row-reverse",
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  messageAvatarText: {
    color: "#FFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    maxWidth: "100%",
  },
  messageSender: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
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
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    maxHeight: 100,
    paddingVertical: 10,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
