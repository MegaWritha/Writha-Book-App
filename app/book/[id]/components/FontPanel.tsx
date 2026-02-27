import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  Pressable, ScrollView, Platform, Dimensions, Switch,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { ReaderTheme, FONTS, FontOption } from "../types";

const { width } = Dimensions.get("window");

const MARGIN_OPTIONS     = [16, 20, 26, 32, 40];
const PARA_GAP_OPTIONS   = [10, 14, 18, 22, 28];
const SPACING_OPTIONS    = [1.4, 1.6, 1.8, 2.0, 2.2, 2.5];

interface Props {
  visible:      boolean;
  onClose:      () => void;
  theme:        ReaderTheme;
  fontSize:     number;
  lineSpacing:  number;
  alignment:    "left" | "center" | "justify";
  fontKey:      string;
  currentFont:  FontOption;
  margins:      number;
  paragraphGap: number;
  setFontSize:     (n: number) => void;
  setLineSpacing:  (n: number) => void;
  setAlignment:    (a: "left" | "center" | "justify") => void;
  setFontKey:      (k: string) => void;
  setMargins:      (n: number) => void;
  setParagraphGap: (n: number) => void;
  resetToDefaults: () => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
}

export default function FontPanel({
  visible, onClose, theme, fontSize, lineSpacing, alignment,
  fontKey, currentFont, margins, paragraphGap,
  setFontSize, setLineSpacing, setAlignment, setFontKey,
  setMargins, setParagraphGap, resetToDefaults,
  increaseFontSize, decreaseFontSize,
}: Props) {

  const [activeSection, setActiveSection] = useState<"font" | "spacing" | "layout">("font");

  const T = theme;

  const sectionTabs = [
    { key: "font",    label: "Font",    icon: "format-font" },
    { key: "spacing", label: "Spacing", icon: "format-line-spacing" },
    { key: "layout",  label: "Layout",  icon: "page-layout-body" },
  ] as const;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { backgroundColor: T.ui }]}>
          <View style={s.handle} />

          {/* Header */}
          <View style={s.headerRow}>
            <Text style={[s.title, { color: T.accent }]}>READING STYLE</Text>
            <TouchableOpacity onPress={resetToDefaults} style={[s.resetBtn, { borderColor: T.accent + "40" }]}>
              <Ionicons name="refresh" size={14} color={T.uiText} />
              <Text style={[s.resetTxt, { color: T.uiText }]}>Reset</Text>
            </TouchableOpacity>
          </View>

          {/* Section tabs */}
          <View style={[s.sectionTabRow, { backgroundColor: T.bg }]}>
            {sectionTabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[s.sectionTab, activeSection === tab.key && { backgroundColor: T.accent }]}
                onPress={() => setActiveSection(tab.key)}
              >
                <MaterialCommunityIcons
                  name={tab.icon as any}
                  size={16}
                  color={activeSection === tab.key ? "#000" : T.uiText}
                />
                <Text style={[s.sectionTabTxt, { color: activeSection === tab.key ? "#000" : T.uiText }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>

            {/* ── FONT SECTION ── */}
            {activeSection === "font" && (
              <View style={s.section}>
                {/* Typeface */}
                <Text style={[s.label, { color: T.uiText }]}>TYPEFACE</Text>
                <View style={s.fontGrid}>
                  {FONTS.map((f) => {
                    const active = fontKey === f.key;
                    return (
                      <TouchableOpacity
                        key={f.key}
                        style={[s.fontPill, {
                          backgroundColor: active ? T.accent : T.bg,
                          borderColor:     active ? T.accent : T.accent + "25",
                        }]}
                        onPress={() => setFontKey(f.key)}
                      >
                        <Text style={[s.fontPillName, {
                          color:      active ? "#000" : T.text,
                          fontFamily: f.family as any,
                        }]}>
                          {f.label}
                        </Text>
                        <Text style={[s.fontPillSample, {
                          color:      active ? "#00000070" : T.text + "55",
                          fontFamily: f.family as any,
                        }]}>
                          Aa Bb Cc
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Font size */}
                <Text style={[s.label, { color: T.uiText }]}>SIZE — {fontSize}pt</Text>
                <View style={s.sizeControl}>
                  <TouchableOpacity
                    style={[s.sizeStepBtn, { backgroundColor: T.bg, borderColor: T.accent + "30" }]}
                    onPress={decreaseFontSize}
                  >
                    <Text style={{ color: T.text, fontSize: 18, fontWeight: "900" }}>A−</Text>
                  </TouchableOpacity>

                  {/* Size bar */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                    <View style={s.sizeRow}>
                      {[12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32].map((n) => (
                        <TouchableOpacity
                          key={n}
                          style={[s.sizePill, {
                            backgroundColor: fontSize === n ? T.accent : T.bg,
                            borderColor:     fontSize === n ? T.accent : T.accent + "20",
                          }]}
                          onPress={() => setFontSize(n)}
                        >
                          <Text style={[s.sizePillTxt, { color: fontSize === n ? "#000" : T.text }]}>
                            {n}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>

                  <TouchableOpacity
                    style={[s.sizeStepBtn, { backgroundColor: T.bg, borderColor: T.accent + "30" }]}
                    onPress={increaseFontSize}
                  >
                    <Text style={{ color: T.text, fontSize: 18, fontWeight: "900" }}>A+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── SPACING SECTION ── */}
            {activeSection === "spacing" && (
              <View style={s.section}>
                {/* Line spacing */}
                <Text style={[s.label, { color: T.uiText }]}>LINE SPACING</Text>
                <View style={s.pillRow}>
                  {SPACING_OPTIONS.map((n) => (
                    <TouchableOpacity
                      key={n}
                      style={[s.pill, {
                        backgroundColor: lineSpacing === n ? T.accent : T.bg,
                        borderColor:     lineSpacing === n ? T.accent : T.accent + "20",
                      }]}
                      onPress={() => setLineSpacing(n)}
                    >
                      <Text style={[s.pillTxt, { color: lineSpacing === n ? "#000" : T.text }]}>
                        {n}×
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Paragraph gap */}
                <Text style={[s.label, { color: T.uiText }]}>PARAGRAPH GAP</Text>
                <View style={s.pillRow}>
                  {PARA_GAP_OPTIONS.map((n) => (
                    <TouchableOpacity
                      key={n}
                      style={[s.pill, {
                        backgroundColor: paragraphGap === n ? T.accent : T.bg,
                        borderColor:     paragraphGap === n ? T.accent : T.accent + "20",
                      }]}
                      onPress={() => setParagraphGap(n)}
                    >
                      <Text style={[s.pillTxt, { color: paragraphGap === n ? "#000" : T.text }]}>
                        {n}px
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Alignment */}
                <Text style={[s.label, { color: T.uiText }]}>TEXT ALIGNMENT</Text>
                <View style={s.pillRow}>
                  {(["left", "center", "justify"] as const).map((a) => (
                    <TouchableOpacity
                      key={a}
                      style={[s.pill, {
                        backgroundColor: alignment === a ? T.accent : T.bg,
                        borderColor:     alignment === a ? T.accent : T.accent + "20",
                        flexDirection:   "row",
                        gap:             6,
                        minWidth:        90,
                      }]}
                      onPress={() => setAlignment(a)}
                    >
                      <MaterialCommunityIcons
                        name={`format-align-${a}` as any}
                        size={14}
                        color={alignment === a ? "#000" : T.text}
                      />
                      <Text style={[s.pillTxt, { color: alignment === a ? "#000" : T.text }]}>
                        {a.charAt(0).toUpperCase() + a.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* ── LAYOUT SECTION ── */}
            {activeSection === "layout" && (
              <View style={s.section}>
                {/* Margins */}
                <Text style={[s.label, { color: T.uiText }]}>PAGE MARGINS</Text>
                <View style={s.pillRow}>
                  {MARGIN_OPTIONS.map((n) => (
                    <TouchableOpacity
                      key={n}
                      style={[s.pill, {
                        backgroundColor: margins === n ? T.accent : T.bg,
                        borderColor:     margins === n ? T.accent : T.accent + "20",
                      }]}
                      onPress={() => setMargins(n)}
                    >
                      <Text style={[s.pillTxt, { color: margins === n ? "#000" : T.text }]}>
                        {n === 16 ? "Narrow" : n === 20 ? "Small" : n === 26 ? "Normal" : n === 32 ? "Wide" : "Max"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* ── LIVE PREVIEW ── */}
            <View style={[s.preview, { backgroundColor: T.bg, marginHorizontal: 0 }]}>
              <Text style={[s.previewLabel, { color: T.uiText }]}>PREVIEW</Text>
              <Text style={{
                color:       T.text,
                fontSize,
                lineHeight:  fontSize * lineSpacing,
                fontFamily:  currentFont.family as any,
                textAlign:   alignment,
                paddingHorizontal: margins / 2,
              }}>
                {"    "}The rain had been falling since morning, soft and relentless, the kind that seeps into old books and makes the ink run like memories. She turned the page without looking up.
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity style={[s.done, { backgroundColor: T.accent }]} onPress={onClose}>
            <Text style={s.doneTxt}>DONE</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:       { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet:          { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: Platform.OS === "ios" ? 44 : 28 },
  handle:         { width: 44, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 20 },
  headerRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  title:          { fontSize: 13, fontWeight: "900", letterSpacing: 3 },
  resetBtn:       { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  resetTxt:       { fontSize: 11, fontWeight: "700" },
  sectionTabRow:  { flexDirection: "row", borderRadius: 14, padding: 4, marginBottom: 16, gap: 4 },
  sectionTab:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
  sectionTabTxt:  { fontSize: 11, fontWeight: "800" },
  section:        { gap: 6, paddingBottom: 8 },
  label:          { fontSize: 9, fontWeight: "900", letterSpacing: 2, marginBottom: 8, marginTop: 14 },
  fontGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 },
  fontPill:       { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, minWidth: (width - 80) / 2 - 5, alignItems: "center" },
  fontPillName:   { fontSize: 14, fontWeight: "700" },
  fontPillSample: { fontSize: 11, marginTop: 3 },
  sizeControl:    { flexDirection: "row", alignItems: "center", gap: 8 },
  sizeStepBtn:    { width: 44, height: 44, justifyContent: "center", alignItems: "center", borderRadius: 12, borderWidth: 1 },
  sizeRow:        { flexDirection: "row", gap: 8, paddingHorizontal: 4 },
  sizePill:       { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: "center", minWidth: 40 },
  sizePillTxt:    { fontSize: 11, fontWeight: "700" },
  pillRow:        { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  pill:           { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  pillTxt:        { fontSize: 11, fontWeight: "700" },
  preview:        { borderRadius: 16, padding: 16, marginTop: 16, marginBottom: 8, minHeight: 80 },
  previewLabel:   { fontSize: 8, fontWeight: "900", letterSpacing: 2, marginBottom: 10 },
  done:           { borderRadius: 14, padding: 15, alignItems: "center", marginTop: 12 },
  doneTxt:        { color: "#000", fontWeight: "900", fontSize: 13, letterSpacing: 2 },
});