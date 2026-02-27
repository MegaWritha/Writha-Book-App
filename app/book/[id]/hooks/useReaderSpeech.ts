import { useState, useEffect, useCallback, useRef } from "react";
import * as Speech from "expo-speech";
import { Paragraph } from "../types";

export interface SpeechVoice {
  identifier: string;
  name:       string;
  language:   string;
  quality?:   string;
}

export interface UseReaderSpeechReturn {
  isSpeaking:       boolean;
  speakingPage:     number;
  speechRate:       number;
  speechPitch:      number;
  selectedVoice:    string | undefined;
  availableVoices:  SpeechVoice[];
  showVoicePanel:   boolean;
  setSpeechRate:    (r: number) => void;
  setSpeechPitch:   (p: number) => void;
  setSelectedVoice: (id: string) => void;
  setShowVoicePanel:(v: boolean) => void;
  toggleSpeech:     () => void;
  stopSpeech:       () => void;
  previewVoice:     (identifier: string) => void;
  speakSelection:   (text: string) => void;
}

export function useReaderSpeech(
  pages:       Paragraph[][],
  currentPage: number,
): UseReaderSpeechReturn {
  const [isSpeaking,      setIsSpeaking]     = useState(false);
  const [speakingPage,    setSpeakingPage]    = useState(0);
  const [speechRate,      setSpeechRateRaw]   = useState(0.9);
  const [speechPitch,     setSpeechPitchRaw]  = useState(1.0);
  const [selectedVoice,   setSelectedVoiceRaw] = useState<string | undefined>(undefined);
  const [availableVoices, setAvailableVoices] = useState<SpeechVoice[]>([]);
  const [showVoicePanel,  setShowVoicePanel]  = useState(false);

  const isSpeakingRef     = useRef(false);
  const pagesRef          = useRef(pages);
  const speechRateRef     = useRef(speechRate);
  const speechPitchRef    = useRef(speechPitch);
  const selectedVoiceRef  = useRef(selectedVoice);
  const currentPageRef    = useRef(currentPage);

  // Keep refs in sync
  pagesRef.current        = pages;
  speechRateRef.current   = speechRate;
  speechPitchRef.current  = speechPitch;
  selectedVoiceRef.current = selectedVoice;
  currentPageRef.current  = currentPage;

  // ── LOAD VOICES ──────────────────────────────────────────────────
  useEffect(() => {
    Speech.getAvailableVoicesAsync()
      .then((voices) => {
        // Filter English voices and sort by quality
        const english = voices
          .filter((v) => v.language?.startsWith("en") || !v.language)
          .map((v) => ({
            identifier: v.identifier,
            name:       v.name       || v.identifier,
            language:   v.language   || "en",
            quality:    (v as any).quality,
          }))
          .sort((a, b) => {
            // Prefer enhanced/premium voices
            const aScore = a.quality?.includes("Enhanced") || a.quality?.includes("Premium") ? 1 : 0;
            const bScore = b.quality?.includes("Enhanced") || b.quality?.includes("Premium") ? 1 : 0;
            return bScore - aScore;
          });

        setAvailableVoices(english);

        // Auto-select best available voice
        if (english.length > 0 && !selectedVoiceRef.current) {
          setSelectedVoiceRaw(english[0].identifier);
        }
      })
      .catch(() => {});
  }, []);

  // ── SPEAK PAGE CHAIN ─────────────────────────────────────────────
  // Reads page by page continuously until stopped
  const speakPageRef = useRef<(pageIndex: number) => void>(undefined!);

  speakPageRef.current = (pageIndex: number) => {
    if (!isSpeakingRef.current) return;
    if (pageIndex >= pagesRef.current.length) {
      // Finished the whole book
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      setSpeakingPage(0);
      return;
    }

    setSpeakingPage(pageIndex);

    // Extract readable text — body and dialogue only, skip headings
    const text = pagesRef.current[pageIndex]
      .filter((p) => p.type === "body" || p.type === "dialogue" || p.type === "sub_heading")
      .map((p) => {
        // Clean up text for speech
        return p.text
          .replace(/[""\u201C\u201D]/g, "") // remove curly quotes
          .replace(/[—–]/g, ", ")           // dashes become pauses
          .replace(/\s+/g, " ")             // normalise whitespace
          .trim();
      })
      .filter((t) => t.length > 0)
      .join(". ");

    if (!text) {
      // Empty page, skip to next
      speakPageRef.current?.(pageIndex + 1);
      return;
    }

    Speech.speak(text, {
      voice:   selectedVoiceRef.current,
      rate:    speechRateRef.current,
      pitch:   speechPitchRef.current,
      onStart: () => setSpeakingPage(pageIndex),
      onDone:  () => speakPageRef.current?.(pageIndex + 1),
      onError: () => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
      },
    });
  };

  // ── TOGGLE SPEECH ────────────────────────────────────────────────
  const toggleSpeech = useCallback(() => {
    if (isSpeakingRef.current) {
      isSpeakingRef.current = false;
      Speech.stop();
      setIsSpeaking(false);
    } else {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      speakPageRef.current?.(currentPageRef.current);
    }
  }, []);

  // ── STOP SPEECH ──────────────────────────────────────────────────
  const stopSpeech = useCallback(() => {
    isSpeakingRef.current = false;
    Speech.stop();
    setIsSpeaking(false);
  }, []);

  // ── PREVIEW VOICE ────────────────────────────────────────────────
  const previewVoice = useCallback((identifier: string) => {
    Speech.stop();
    Speech.speak(
      "The stars were endless that night, and she read until the last page turned to silence.",
      {
        voice: identifier,
        rate:  speechRateRef.current,
        pitch: speechPitchRef.current,
      }
    );
  }, []);

  // ── SPEAK SELECTION ──────────────────────────────────────────────
  // For reading a highlighted/selected passage aloud
  const speakSelection = useCallback((text: string) => {
    Speech.stop();
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    Speech.speak(text, {
      voice: selectedVoiceRef.current,
      rate:  speechRateRef.current,
      pitch: speechPitchRef.current,
    });
  }, []);

  // ── SETTERS ──────────────────────────────────────────────────────
  const setSpeechRate = useCallback((r: number) => {
    setSpeechRateRaw(r);
    speechRateRef.current = r;
    // If currently speaking, restart current page with new rate
    if (isSpeakingRef.current) {
      Speech.stop();
      setTimeout(() => speakPageRef.current?.(speakingPage), 100);
    }
  }, [speakingPage]);

  const setSpeechPitch = useCallback((p: number) => {
    setSpeechPitchRaw(p);
    speechPitchRef.current = p;
  }, []);

  const setSelectedVoice = useCallback((id: string) => {
    setSelectedVoiceRaw(id);
    selectedVoiceRef.current = id;
    // If speaking, restart with new voice
    if (isSpeakingRef.current) {
      Speech.stop();
      setTimeout(() => speakPageRef.current?.(speakingPage), 100);
    }
  }, [speakingPage]);

  // ── STOP ON UNMOUNT ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      isSpeakingRef.current = false;
      Speech.stop();
    };
  }, []);

  return {
    isSpeaking, speakingPage, speechRate, speechPitch,
    selectedVoice, availableVoices, showVoicePanel,
    setSpeechRate, setSpeechPitch, setSelectedVoice,
    setShowVoicePanel, toggleSpeech, stopSpeech,
    previewVoice, speakSelection,
  };
}