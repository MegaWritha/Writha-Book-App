import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  Pressable, ScrollView, Platform, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ReaderTheme, Bookmark } from "../types";
import { BOOKMARK_COLORS } from "../hooks/useBookmarks";

interface Props {
  visible:             boolean;
  onClose:             () => void;
  theme:               ReaderTheme;
  bookmarks:           Bookmark[];
  currentPage:         number;
  totalPages:          number;
  onNavigate:          (page: number) => void;
  onDelete:            (page: number) => void;
  onClearAll:          () => void;
  onColorChange:       (page: number, color: string) => void;
}

export default function BookmarksPanel({
  visible, onClose, theme, bookmarks, currentPage,
  totalPages, onNavigate, onDelete, onClearAll, onColorChange,
}: Props) {

  const [expandedPage, setExpandedPage] = useState<number | null>(null);
  const T = theme;

  const sorted = [...bookmarks].sort((a, b) => a.page - b.page);

  const handleClearAll = () => {
    Alert.alert(
      "Clear All Bookmarks",
      "Remove all bookmarks for this book? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear All", style: "destructive", onPress: onClearAll },
      ]
    );
  };

  const formatTimeAgo = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)   return "Just now";
    if (mins  < 60)  return `${mins}m ago`;
    if (hours < 24)  return `${hours}h ago`;
    if (days  < 7)   return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString("en-NG", {
      day: "numeric", month: "short",
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { backgroundColor: T.ui }]}>
          <View style={s.handle} />

          {/* Header */}
          <View style={s.headerRow}>
            <View style={s.headerLeft}>
              <Ionicons name="bookmarks" size={18} color={T.accent} />
              <Text style={[s.title, { color: T.accent }]}>BOOKMARKS</Text>
              {bookmarks.length > 0 && (
                <View style={[s.countBadge, { backgroundColor: T.accent }]}>
                  <Text style={s.countTxt}>{bookmarks.length}</Text>
                </View>
              )}
            </View>
            {bookmarks.length > 0 && (
              <TouchableOpacity onPress={handleClearAll}>
                <Text style={[s.clearTxt, { color: T.uiText }]}>Clear all</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Empty state */}
          {bookmarks.length === 0 ? (
            <View style={s.empty}>
              <View style={[s.emptyIconCircle, { backgroundColor: T.bg }]}>
                <Ionicons name="bookmark-outline" size={40} color={T.uiText} />
              </View>
              <Text style={[s.emptyTitle, { color: T.text }]}>No bookmarks yet</Text>
              <Text style={[s.emptyDesc, { color: T.uiText }]}>
                Tap the bookmark icon while reading to save your place.
                You can add colours to organise them.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: 400 }}
              showsVerticalScrollIndicator={false}
            >
              {sorted.map((bm) => {
                const isCurrent  = bm.page === currentPage;
                const isExpanded = expandedPage === bm.page;
                const progress   = totalPages > 1
                  ? Math.round((bm.page / (totalPages - 1)) * 100)
                  : 0;

                return (
                  <View key={bm.page}>
                    <TouchableOpacity
                      style={[s.bookmarkRow, {
                        backgroundColor: isCurrent ? bm.color + "15" : "transparent",
                        borderColor:     isCurrent ? bm.color + "60" : T.accent + "15",
                      }]}
                      onPress={() => {
                        onNavigate(bm.page);
                        onClose();
                      }}
                      onLongPress={() => setExpandedPage(isExpanded ? null : bm.page)}
                      activeOpacity={0.75}
                    >
                      {/* Colour indicator */}
                      <View style={[s.colorBar, { backgroundColor: bm.color }]} />

                      {/* Page badge */}
                      <View style={[s.pageBadge, { backgroundColor: bm.color + "20", borderColor: bm.color + "40" }]}>
                        <Text style={[s.pageNum, { color: bm.color }]}>{bm.page + 1}</Text>
                      </View>

                      {/* Content */}
                      <View style={s.bookmarkContent}>
                        <Text style={[s.bookmarkLabel, { color: T.text }]} numberOfLines={2}>
                          {bm.label}
                        </Text>
                        <View style={s.bookmarkMeta}>
                          <Text style={[s.bookmarkTime, { color: T.uiText }]}>
                            {formatTimeAgo(bm.timestamp)}
                          </Text>
                          <Text style={[s.bookmarkProgress, { color: T.uiText }]}>
                            {progress}% through
                          </Text>
                        </View>
                      </View>

                      {/* Actions */}
                      <View style={s.bookmarkActions}>
                        {isCurrent && (
                          <View style={[s.currentDot, { backgroundColor: bm.color }]} />
                        )}
                        <TouchableOpacity
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          onPress={() => onDelete(bm.page)}
                        >
                          <Ionicons name="trash-outline" size={16} color={T.uiText} />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>

                    {/* Expanded colour picker */}
                    {isExpanded && (
                      <View style={[s.colorPicker, { backgroundColor: T.bg }]}>
                        <Text style={[s.colorPickerLabel, { color: T.uiText }]}>
                          BOOKMARK COLOUR
                        </Text>
                        <View style={s.colorRow}>
                          {BOOKMARK_COLORS.map((color) => (
                            <TouchableOpacity
                              key={color}
                              style={[s.colorDot, {
                                backgroundColor: color,
                                borderWidth:     bm.color === color ? 3 : 0,
                                borderColor:     "#fff",
                                transform:       [{ scale: bm.color === color ? 1.2 : 1 }],
                              }]}
                              onPress={() => {
                                onColorChange(bm.page, color);
                                setExpandedPage(null);
                              }}
                            />
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}

              <View style={{ height: 8 }} />
            </ScrollView>
          )}

          {/* Progress overview */}
          {bookmarks.length > 0 && (
            <View style={[s.overview, { backgroundColor: T.bg }]}>
              <Text style={[s.overviewTxt, { color: T.uiText }]}>
                {bookmarks.length} bookmark{bookmarks.length > 1 ? "s" : ""} across{" "}
                {Math.round((bookmarks.length / Math.max(1, totalPages)) * 100)}% of this book
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.doneBtn, { backgroundColor: T.accent }]}
            onPress={onClose}
          >
            <Text style={s.doneBtnTxt}>CLOSE</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:         { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" },
  sheet:            { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: Platform.OS === "ios" ? 44 : 28 },
  handle:           { width: 44, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 20 },
  headerRow:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  headerLeft:       { flexDirection: "row", alignItems: "center", gap: 10 },
  title:            { fontSize: 13, fontWeight: "900", letterSpacing: 3 },
  countBadge:       { width: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  countTxt:         { color: "#000", fontSize: 9, fontWeight: "900" },
  clearTxt:         { fontSize: 12, fontWeight: "700" },
  empty:            { alignItems: "center", paddingVertical: 32, gap: 12, paddingHorizontal: 16 },
  emptyIconCircle:  { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center" },
  emptyTitle:       { fontSize: 16, fontWeight: "900" },
  emptyDesc:        { fontSize: 13, textAlign: "center", lineHeight: 20 },
  bookmarkRow:      { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, marginBottom: 8, borderWidth: 1 },
  colorBar:         { width: 4, height: "100%", borderRadius: 2, minHeight: 40 },
  pageBadge:        { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  pageNum:          { fontSize: 13, fontWeight: "900" },
  bookmarkContent:  { flex: 1, gap: 4 },
  bookmarkLabel:    { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  bookmarkMeta:     { flexDirection: "row", gap: 10 },
  bookmarkTime:     { fontSize: 10 },
  bookmarkProgress: { fontSize: 10 },
  bookmarkActions:  { alignItems: "center", gap: 8 },
  currentDot:       { width: 8, height: 8, borderRadius: 4 },
  colorPicker:      { marginBottom: 8, padding: 12, borderRadius: 12 },
  colorPickerLabel: { fontSize: 8, fontWeight: "900", letterSpacing: 2, marginBottom: 10 },
  colorRow:         { flexDirection: "row", gap: 12, alignItems: "center" },
  colorDot:         { width: 28, height: 28, borderRadius: 14 },
  overview:         { padding: 12, borderRadius: 12, marginTop: 8, marginBottom: 12, alignItems: "center" },
  overviewTxt:      { fontSize: 11, fontWeight: "600" },
  doneBtn:          { borderRadius: 14, padding: 15, alignItems: "center" },
  doneBtnTxt:       { color: "#000", fontWeight: "900", fontSize: 13, letterSpacing: 2 },
});