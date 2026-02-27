import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  Pressable, ScrollView, Platform, Dimensions,
} from "react-native";
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import { ReaderTheme } from "../types";
import { SpeechVoice } from "../hooks/useReaderSpeech";

const { width } = Dimensions.get("window");

const SPEED_OPTIONS = [
  { label: "0.5×",  val: 0.5,  desc: "Very Slow"  },
  { label: "0.7×",  val: 0.7,  desc: "Slow"        },
  { label: "1.0×",  val: 0.9,  desc: "Normal"      },
  { label: "1.2×",  val: 1.2,  desc: "Fast"        },
  { label: "1.5×",  val: 1.5,  desc: "Very Fast"   },
  { label: "2.0×",  val: 2.0,  desc: "Speed Read"  },
];

const PITCH_OPTIONS = [
  { label: "Low",    val: 0.7 },
  { label: "Normal", val: 1.0 },
  { label: "High",   val: 1.3 },
];

interface Props {
  visible:          boolean;
  onClose:          () => void;
  theme:            ReaderTheme;
  isSpeaking:       boolean;
  speakingPage:     number;
  speechRate:       number;
  speechPitch:      number;
  selectedVoice:    string | undefined;
  availableVoices:  SpeechVoice[];
  totalPages:       number;
  currentPage:      number;
  toggleSpeech:     () => void;
  stopSpeech:       () => void;
  setSpeechRate:    (r: number) => void;
  setSpeechPitch:   (p: number) => void;
  setSelectedVoice: (id: string) => void;
  previewVoice:     (id: string) => void;
}

export default function VoicePanel({
  visible, onClose, theme,
  isSpeaking, speakingPage, speechRate, speechPitch,
  selectedVoice, availableVoices, totalPages, currentPage,
  toggleSpeech, stopSpeech, setSpeechRate, setSpeechPitch,
  setSelectedVoice, previewVoice,
}: Props) {

  const [activeTab, setActiveTab] = useState<"playback" | "voice">("playback");
  const T = theme;

  // Progress percentage while speaking
  const speakProgress = totalPages > 1
    ? Math.round((speakingPage / (totalPages - 1)) * 100)
    : 0;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { backgroundColor: T.ui }]}>
          <View style={s.handle} />

          {/* Header */}
          <View style={s.headerRow}>
            <View style={s.headerLeft}>
              <FontAwesome5
                name="headphones-alt"
                size={18}
                color={T.accent}
              />
              <Text style={[s.title, { color: T.accent }]}>VOICE READER</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={T.uiText} />
            </TouchableOpacity>
          </View>

          {/* Now playing bar */}
          {isSpeaking && (
            <View style={[s.nowPlaying, { backgroundColor: T.accent + "15", borderColor: T.accent + "30" }]}>
              <View style={s.nowPlayingLeft}>
                {/* Animated equalizer bars */}
                {[1, 2, 3, 4].map((i) => (
                  <View
                    key={i}
                    style={[s.eqBar, {
                      backgroundColor: T.accent,
                      height: 8 + (i % 3) * 6,
                    }]}
                  />
                ))}
              </View>
              <View style={s.nowPlayingInfo}>
                <Text style={[s.nowPlayingTxt, { color: T.text }]}>
                  Reading page {speakingPage + 1} of {totalPages}
                </Text>
                <View style={[s.progressBar, { backgroundColor: T.ui2 }]}>
                  <View style={[s.progressFill, {
                    backgroundColor: T.accent,
                    width: `${speakProgress}%`,
                  }]} />
                </View>
              </View>
            </View>
          )}

          {/* Main play button */}
          <TouchableOpacity
            style={[s.playBtn, {
              backgroundColor: isSpeaking ? "#EF4444" : T.accent,
              shadowColor:     isSpeaking ? "#EF4444" : T.accent,
            }]}
            onPress={toggleSpeech}
            activeOpacity={0.85}
          >
            <FontAwesome5
              name={isSpeaking ? "stop" : "play"}
              size={20}
              color="#000"
            />
            <Text style={s.playBtnTxt}>
              {isSpeaking
                ? "STOP READING"
                : currentPage === 0
                ? "START FROM BEGINNING"
                : `RESUME FROM PAGE ${currentPage + 1}`}
            </Text>
          </TouchableOpacity>

          {/* Tab switcher */}
          <View style={[s.tabRow, { backgroundColor: T.bg }]}>
            {(["playback", "voice"] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[s.tab, activeTab === tab && { backgroundColor: T.accent }]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[s.tabTxt, { color: activeTab === tab ? "#000" : T.uiText }]}>
                  {tab === "playback" ? "⚙️  Playback" : "🎙️  Voice"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>

            {/* ── PLAYBACK TAB ── */}
            {activeTab === "playback" && (
              <View style={s.tabContent}>
                {/* Speed */}
                <Text style={[s.label, { color: T.uiText }]}>READING SPEED</Text>
                <View style={s.optionGrid}>
                  {SPEED_OPTIONS.map((sp) => {
                    const active = Math.abs(speechRate - sp.val) < 0.05;
                    return (
                      <TouchableOpacity
                        key={sp.val}
                        style={[s.optionPill, {
                          backgroundColor: active ? T.accent : T.bg,
                          borderColor:     active ? T.accent : T.accent + "25",
                        }]}
                        onPress={() => setSpeechRate(sp.val)}
                      >
                        <Text style={[s.optionPillMain, { color: active ? "#000" : T.text }]}>
                          {sp.label}
                        </Text>
                        <Text style={[s.optionPillSub, { color: active ? "#00000080" : T.uiText }]}>
                          {sp.desc}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Pitch */}
                <Text style={[s.label, { color: T.uiText }]}>VOICE PITCH</Text>
                <View style={s.pillRow}>
                  {PITCH_OPTIONS.map((p) => {
                    const active = Math.abs(speechPitch - p.val) < 0.05;
                    return (
                      <TouchableOpacity
                        key={p.val}
                        style={[s.pill, {
                          backgroundColor: active ? T.accent : T.bg,
                          borderColor:     active ? T.accent : T.accent + "25",
                          flex: 1,
                        }]}
                        onPress={() => setSpeechPitch(p.val)}
                      >
                        <Text style={[s.pillTxt, { color: active ? "#000" : T.text }]}>
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── VOICE TAB ── */}
            {activeTab === "voice" && (
              <View style={s.tabContent}>
                {availableVoices.length === 0 ? (
                  <View style={s.noVoices}>
                    <Ionicons name="mic-off-outline" size={32} color={T.uiText} />
                    <Text style={[s.noVoicesTxt, { color: T.uiText }]}>
                      No voices available on this device
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={[s.label, { color: T.uiText }]}>
                      SELECT VOICE  ·  {availableVoices.length} AVAILABLE
                    </Text>
                    {availableVoices.slice(0, 25).map((v) => {
                      const active = selectedVoice === v.identifier;
                      const isEnhanced = v.quality?.includes("Enhanced") || v.quality?.includes("Premium");
                      return (
                        <TouchableOpacity
                          key={v.identifier}
                          style={[s.voiceRow, {
                            backgroundColor: active ? T.accent + "18" : "transparent",
                            borderColor:     active ? T.accent + "50" : T.accent + "12",
                          }]}
                          onPress={() => setSelectedVoice(v.identifier)}
                        >
                          {/* Radio */}
                          <View style={[s.radio, {
                            borderColor:     T.accent,
                            backgroundColor: active ? T.accent : "transparent",
                          }]}>
                            {active && <View style={s.radioDot} />}
                          </View>

                          {/* Voice info */}
                          <View style={{ flex: 1 }}>
                            <View style={s.voiceNameRow}>
                              <Text style={[s.voiceName, { color: T.text }]} numberOfLines={1}>
                                {v.name}
                              </Text>
                              {isEnhanced && (
                                <View style={[s.enhancedBadge, { backgroundColor: T.accent + "25" }]}>
                                  <Text style={[s.enhancedTxt, { color: T.accent }]}>HD</Text>
                                </View>
                              )}
                            </View>
                            <Text style={[s.voiceLang, { color: T.uiText }]}>
                              {v.language}
                            </Text>
                          </View>

                          {/* Preview button */}
                          <TouchableOpacity
                            style={[s.previewBtn, { borderColor: T.accent + "40" }]}
                            onPress={() => previewVoice(v.identifier)}
                          >
                            <Ionicons name="play-circle-outline" size={14} color={T.accent} />
                            <Text style={[s.previewBtnTxt, { color: T.accent }]}>Try</Text>
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[s.doneBtn, { backgroundColor: T.accent }]}
            onPress={onClose}
          >
            <Text style={s.doneBtnTxt}>DONE</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:        { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" },
  sheet:           { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: Platform.OS === "ios" ? 44 : 28 },
  handle:          { width: 44, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 20 },
  headerRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  headerLeft:      { flexDirection: "row", alignItems: "center", gap: 10 },
  title:           { fontSize: 13, fontWeight: "900", letterSpacing: 3 },
  closeBtn:        { width: 32, height: 32, justifyContent: "center", alignItems: "center" },
  nowPlaying:      { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 14 },
  nowPlayingLeft:  { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 24 },
  eqBar:           { width: 4, borderRadius: 2 },
  nowPlayingInfo:  { flex: 1, gap: 6 },
  nowPlayingTxt:   { fontSize: 12, fontWeight: "700" },
  progressBar:     { height: 3, borderRadius: 2, overflow: "hidden" },
  progressFill:    { height: "100%", borderRadius: 2 },
  playBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, padding: 16, borderRadius: 16, marginBottom: 16, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  playBtnTxt:      { color: "#000", fontWeight: "900", fontSize: 14, letterSpacing: 0.5 },
  tabRow:          { flexDirection: "row", borderRadius: 14, padding: 4, marginBottom: 4, gap: 4 },
  tab:             { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  tabTxt:          { fontSize: 12, fontWeight: "800" },
  tabContent:      { paddingTop: 8, paddingBottom: 4 },
  label:           { fontSize: 9, fontWeight: "900", letterSpacing: 2, marginBottom: 10, marginTop: 14 },
  optionGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionPill:      { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, alignItems: "center", minWidth: (width - 80) / 3 - 6 },
  optionPillMain:  { fontSize: 14, fontWeight: "900" },
  optionPillSub:   { fontSize: 9, marginTop: 2, fontWeight: "600" },
  pillRow:         { flexDirection: "row", gap: 8 },
  pill:            { paddingVertical: 10, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  pillTxt:         { fontSize: 12, fontWeight: "700" },
  noVoices:        { alignItems: "center", paddingVertical: 32, gap: 12 },
  noVoicesTxt:     { fontSize: 13, textAlign: "center" },
  voiceRow:        { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, marginBottom: 8, borderWidth: 1 },
  radio:           { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  radioDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: "#000" },
  voiceNameRow:    { flexDirection: "row", alignItems: "center", gap: 6 },
  voiceName:       { fontSize: 13, fontWeight: "700", flex: 1 },
  enhancedBadge:   { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  enhancedTxt:     { fontSize: 8, fontWeight: "900" },
  voiceLang:       { fontSize: 10, marginTop: 2 },
  previewBtn:      { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  previewBtnTxt:   { fontSize: 10, fontWeight: "700" },
  doneBtn:         { borderRadius: 14, padding: 15, alignItems: "center", marginTop: 12 },
  doneBtnTxt:      { color: "#000", fontWeight: "900", fontSize: 13, letterSpacing: 2 },
});