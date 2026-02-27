import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  THEMES, ReaderTheme, FONTS, FontOption,
  SETTINGS_KEY, DEFAULT_SETTINGS, ReaderSettings, debounce,
} from "../types";

export interface UseReaderSettingsReturn {
  // Values
  fontSize:     number;
  lineSpacing:  number;
  alignment:    "left" | "center" | "justify";
  theme:        ReaderTheme;
  fontKey:      string;
  currentFont:  FontOption;
  margins:      number;
  paragraphGap: number;
  loaded:       boolean;

  // Setters
  setFontSize:     (n: number) => void;
  setLineSpacing:  (n: number) => void;
  setAlignment:    (a: "left" | "center" | "justify") => void;
  setTheme:        (t: ReaderTheme) => void;
  setFontKey:      (k: string) => void;
  setMargins:      (n: number) => void;
  setParagraphGap: (n: number) => void;

  // Actions
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  cycleLineSpacing: () => void;
  resetToDefaults:  () => void;
}

const LINE_SPACING_STEPS = [1.4, 1.6, 1.8, 2.0, 2.2, 2.5];
const MARGIN_STEPS       = [16, 20, 26, 32, 40];

export function useReaderSettings(): UseReaderSettingsReturn {
  const [loaded,       setLoaded]          = useState(false);
  const [fontSize,     setFontSizeRaw]     = useState(DEFAULT_SETTINGS.fontSize);
  const [lineSpacing,  setLineSpacingRaw]  = useState(DEFAULT_SETTINGS.lineSpacing);
  const [alignment,    setAlignmentRaw]    = useState<"left" | "center" | "justify">(DEFAULT_SETTINGS.alignment);
  const [theme,        setThemeRaw]        = useState<ReaderTheme>(THEMES[DEFAULT_SETTINGS.themeName]);
  const [fontKey,      setFontKeyRaw]      = useState(DEFAULT_SETTINGS.fontKey);
  const [margins,      setMarginsRaw]      = useState(DEFAULT_SETTINGS.margins);
  const [paragraphGap, setParagraphGapRaw] = useState(DEFAULT_SETTINGS.paragraphGap);

  // Keep a ref of current values so persist() always has latest
  const valuesRef = useRef<ReaderSettings>({
    fontSize, lineSpacing, alignment,
    themeName: theme.name, fontKey,
    margins, paragraphGap,
  });

  // ── LOAD FROM STORAGE ─────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const s: Partial<ReaderSettings> = JSON.parse(raw);

          if (s.fontSize && s.fontSize >= 12 && s.fontSize <= 36) {
            setFontSizeRaw(s.fontSize);
            valuesRef.current.fontSize = s.fontSize;
          }
          if (s.lineSpacing && s.lineSpacing >= 1.0 && s.lineSpacing <= 3.0) {
            setLineSpacingRaw(s.lineSpacing);
            valuesRef.current.lineSpacing = s.lineSpacing;
          }
          if (s.alignment && ["left", "center", "justify"].includes(s.alignment)) {
            setAlignmentRaw(s.alignment as any);
            valuesRef.current.alignment = s.alignment;
          }
          if (s.themeName && THEMES[s.themeName]) {
            setThemeRaw(THEMES[s.themeName]);
            valuesRef.current.themeName = s.themeName;
          }
          if (s.fontKey && FONTS.find((f) => f.key === s.fontKey)) {
            setFontKeyRaw(s.fontKey);
            valuesRef.current.fontKey = s.fontKey;
          }
          if (s.margins && MARGIN_STEPS.includes(s.margins)) {
            setMarginsRaw(s.margins);
            valuesRef.current.margins = s.margins;
          }
          if (s.paragraphGap && s.paragraphGap >= 8 && s.paragraphGap <= 40) {
            setParagraphGapRaw(s.paragraphGap);
            valuesRef.current.paragraphGap = s.paragraphGap;
          }
        } catch {}
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // ── PERSIST (debounced) ───────────────────────────────────────────
  const debouncedPersist = useCallback(
    debounce(() => {
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(valuesRef.current)).catch(() => {});
    }, 600),
    [],
  );

  const persist = useCallback((updates: Partial<ReaderSettings>) => {
    valuesRef.current = { ...valuesRef.current, ...updates };
    debouncedPersist();
  }, [debouncedPersist]);

  // ── SETTERS ───────────────────────────────────────────────────────
  const setFontSize = useCallback((n: number) => {
    const clamped = Math.max(12, Math.min(36, n));
    setFontSizeRaw(clamped);
    persist({ fontSize: clamped });
  }, [persist]);

  const setLineSpacing = useCallback((n: number) => {
    setLineSpacingRaw(n);
    persist({ lineSpacing: n });
  }, [persist]);

  const setAlignment = useCallback((a: "left" | "center" | "justify") => {
    setAlignmentRaw(a);
    persist({ alignment: a });
  }, [persist]);

  const setTheme = useCallback((t: ReaderTheme) => {
    setThemeRaw(t);
    persist({ themeName: t.name });
  }, [persist]);

  const setFontKey = useCallback((k: string) => {
    setFontKeyRaw(k);
    persist({ fontKey: k });
  }, [persist]);

  const setMargins = useCallback((n: number) => {
    setMarginsRaw(n);
    persist({ margins: n });
  }, [persist]);

  const setParagraphGap = useCallback((n: number) => {
    setParagraphGapRaw(n);
    persist({ paragraphGap: n });
  }, [persist]);

  // ── ACTIONS ───────────────────────────────────────────────────────
  const increaseFontSize = useCallback(() => {
    setFontSize(Math.min(36, fontSize + 1));
  }, [fontSize, setFontSize]);

  const decreaseFontSize = useCallback(() => {
    setFontSize(Math.max(12, fontSize - 1));
  }, [fontSize, setFontSize]);

  const cycleLineSpacing = useCallback(() => {
    const currentIdx = LINE_SPACING_STEPS.indexOf(lineSpacing);
    const nextIdx    = currentIdx === -1 || currentIdx === LINE_SPACING_STEPS.length - 1
      ? 0 : currentIdx + 1;
    setLineSpacing(LINE_SPACING_STEPS[nextIdx]);
  }, [lineSpacing, setLineSpacing]);

  const cycleMargins = useCallback(() => {
    const currentIdx = MARGIN_STEPS.indexOf(margins);
    const nextIdx    = currentIdx === -1 || currentIdx === MARGIN_STEPS.length - 1
      ? 0 : currentIdx + 1;
    setMargins(MARGIN_STEPS[nextIdx]);
  }, [margins, setMargins]);

  const resetToDefaults = useCallback(() => {
    setFontSizeRaw(DEFAULT_SETTINGS.fontSize);
    setLineSpacingRaw(DEFAULT_SETTINGS.lineSpacing);
    setAlignmentRaw(DEFAULT_SETTINGS.alignment);
    setThemeRaw(THEMES[DEFAULT_SETTINGS.themeName]);
    setFontKeyRaw(DEFAULT_SETTINGS.fontKey);
    setMarginsRaw(DEFAULT_SETTINGS.margins);
    setParagraphGapRaw(DEFAULT_SETTINGS.paragraphGap);
    valuesRef.current = {
      fontSize:     DEFAULT_SETTINGS.fontSize,
      lineSpacing:  DEFAULT_SETTINGS.lineSpacing,
      alignment:    DEFAULT_SETTINGS.alignment,
      themeName:    DEFAULT_SETTINGS.themeName,
      fontKey:      DEFAULT_SETTINGS.fontKey,
      margins:      DEFAULT_SETTINGS.margins,
      paragraphGap: DEFAULT_SETTINGS.paragraphGap,
    };
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(valuesRef.current)).catch(() => {});
  }, []);

  const currentFont = FONTS.find((f) => f.key === fontKey) || FONTS[0];

  return {
    fontSize, lineSpacing, alignment, theme, fontKey,
    currentFont, margins, paragraphGap, loaded,
    setFontSize, setLineSpacing, setAlignment,
    setTheme, setFontKey, setMargins, setParagraphGap,
    increaseFontSize, decreaseFontSize,
    cycleLineSpacing, resetToDefaults,
  };
}