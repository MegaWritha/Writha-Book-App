import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Paragraph, ReaderTheme } from "../types";

interface Props {
  paragraph:   Paragraph;
  uniqueKey:   string;
  theme:       ReaderTheme;
  fontSize:    number;
  lineSpacing: number;
  alignment:   "left" | "center" | "justify";
  fontFamily:  string | undefined;
  paragraphGap: number;
  isHighlighted?: boolean;
  highlightColor?: string;
  isSpeaking?: boolean;
}

const ParagraphRenderer = memo(function ParagraphRenderer({
  paragraph: p,
  uniqueKey,
  theme,
  fontSize,
  lineSpacing,
  alignment,
  fontFamily,
  paragraphGap,
  isHighlighted,
  highlightColor,
  isSpeaking,
}: Props) {

  // ── CHAPTER HEADING ─────────────────────────────────────────────
  if (p.type === "chapter") {
    return (
      <View key={uniqueKey} style={s.chapterWrapper}>
        {/* Top ornamental line */}
        <View style={s.chapterLineRow}>
          <View style={[s.chapterLineSide, { backgroundColor: theme.accent + "30" }]} />
          <Text style={[s.chapterDiamond, { color: theme.accent + "60" }]}>◆</Text>
          <View style={[s.chapterLineSide, { backgroundColor: theme.accent + "30" }]} />
        </View>

        {/* Chapter title */}
        <Text style={[s.chapterHeading, {
          color:       theme.accent,
          fontFamily:  fontFamily as any,
          letterSpacing: p.text.length < 15 ? 8 : p.text.length < 30 ? 5 : 3,
          fontSize:    fontSize + 2,
          textShadowColor: theme.accent + "30",
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 12,
        }]}>
          {p.text.toUpperCase()}
        </Text>

        {/* Bottom accent divider */}
        <View style={s.chapterDividerRow}>
          <View style={[s.chapterDividerDot, { backgroundColor: theme.accent + "40" }]} />
          <View style={[s.chapterDividerLine, { backgroundColor: theme.accent }]} />
          <View style={[s.chapterDividerDot, { backgroundColor: theme.accent + "40" }]} />
        </View>

        <View style={{ height: 24 }} />
      </View>
    );
  }

  // ── SUB HEADING ─────────────────────────────────────────────────
  if (p.type === "sub_heading") {
    return (
      <View key={uniqueKey} style={[s.subHeadingWrapper, { marginVertical: paragraphGap }]}>
        <Text style={[s.subHeading, {
          color:      theme.accent,
          fontFamily: fontFamily as any,
          fontSize:   fontSize + 1,
        }]}>
          {p.text}
        </Text>
        <View style={[s.subHeadingUnderline, { backgroundColor: theme.accent + "40" }]} />
      </View>
    );
  }

  // ── SECTION BREAK ───────────────────────────────────────────────
  if (p.type === "section_break") {
    return (
      <View key={uniqueKey} style={s.sectionBreak}>
        <View style={[s.sectionBreakLine, { backgroundColor: theme.accent + "20" }]} />
        <View style={s.sectionBreakDots}>
          {["◆", "✦", "◆"].map((sym, i) => (
            <Text key={i} style={[s.sectionBreakSym, {
              color:   i === 1 ? theme.accent : theme.accent + "50",
              fontSize: i === 1 ? 12 : 8,
            }]}>
              {sym}
            </Text>
          ))}
        </View>
        <View style={[s.sectionBreakLine, { backgroundColor: theme.accent + "20" }]} />
      </View>
    );
  }

  // ── DIALOGUE ────────────────────────────────────────────────────
  if (p.type === "dialogue") {
    return (
      <View
        key={uniqueKey}
        style={[
          s.dialogueWrapper,
          {
            borderLeftColor: isSpeaking
              ? theme.accent
              : isHighlighted
              ? highlightColor || theme.accent
              : theme.accent + "30",
            backgroundColor: isHighlighted
              ? (highlightColor || theme.accent) + "15"
              : isSpeaking
              ? theme.accent + "08"
              : "transparent",
            marginBottom: paragraphGap,
          },
        ]}
      >
        <Text style={[s.dialogueText, {
          color:      theme.text,
          fontSize,
          lineHeight: fontSize * lineSpacing,
          fontFamily: fontFamily as any,
          textAlign:  "left", // dialogue always left aligned
        }]}>
          {p.text}
        </Text>
      </View>
    );
  }

  // ── BODY ────────────────────────────────────────────────────────
  return (
    <Text
      key={uniqueKey}
      style={[
        s.body,
        {
          color:           theme.text,
          fontSize,
          textAlign:       alignment,
          lineHeight:      fontSize * lineSpacing,
          fontFamily:      fontFamily as any,
          marginBottom:    paragraphGap,
          backgroundColor: isHighlighted
            ? (highlightColor || theme.accent) + "25"
            : isSpeaking
            ? theme.accent + "12"
            : "transparent",
          borderRadius: isHighlighted || isSpeaking ? 4 : 0,
          paddingHorizontal: isHighlighted || isSpeaking ? 4 : 0,
        },
      ]}
      selectable
    >
      {/* First-line indent using em spaces */}
      {"    "}{p.text}
    </Text>
  );
}, (prev, next) => {
  // Custom comparison — only re-render if these change
  return (
    prev.paragraph.text    === next.paragraph.text    &&
    prev.paragraph.type    === next.paragraph.type    &&
    prev.theme.name        === next.theme.name        &&
    prev.fontSize          === next.fontSize          &&
    prev.lineSpacing       === next.lineSpacing        &&
    prev.alignment         === next.alignment          &&
    prev.fontFamily        === next.fontFamily         &&
    prev.paragraphGap      === next.paragraphGap       &&
    prev.isHighlighted     === next.isHighlighted      &&
    prev.highlightColor    === next.highlightColor     &&
    prev.isSpeaking        === next.isSpeaking
  );
});

export default ParagraphRenderer;

const s = StyleSheet.create({
  // Chapter
  chapterWrapper:     { marginTop: 40, marginBottom: 8, alignItems: "center", paddingHorizontal: 16 },
  chapterLineRow:     { flexDirection: "row", alignItems: "center", width: "70%", marginBottom: 20 },
  chapterLineSide:    { flex: 1, height: 1 },
  chapterDiamond:     { marginHorizontal: 10, fontSize: 10 },
  chapterHeading:     { fontWeight: "900", textAlign: "center", textTransform: "uppercase" },
  chapterDividerRow:  { flexDirection: "row", alignItems: "center", marginTop: 16, gap: 6 },
  chapterDividerLine: { width: 40, height: 2, borderRadius: 1 },
  chapterDividerDot:  { width: 5, height: 5, borderRadius: 3 },

  // Sub heading
  subHeadingWrapper:  { alignItems: "center" },
  subHeading:         { fontWeight: "800", textAlign: "center", letterSpacing: 1.5 },
  subHeadingUnderline:{ height: 1, width: 40, marginTop: 6 },

  // Section break
  sectionBreak:       { alignItems: "center", marginVertical: 32, gap: 10 },
  sectionBreakLine:   { width: "30%", height: 1 },
  sectionBreakDots:   { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionBreakSym:    { fontWeight: "900" },

  // Dialogue
  dialogueWrapper:    { borderLeftWidth: 3, paddingLeft: 14, marginLeft: 4 },
  dialogueText:       { fontStyle: "italic" },

  // Body
  body:               {},
});