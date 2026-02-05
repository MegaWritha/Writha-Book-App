import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";
import Colors, { ThemeColors } from "@/constants/colors";
import { getSettings, saveSettings, Settings } from "@/lib/storage";

interface ThemeContextValue {
  isDark: boolean;
  colors: ThemeColors;
  toggleNightMode: () => void;
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useSystemColorScheme();
  const [settings, setSettings] = useState<Settings>({
    nightMode: false,
    fontSize: 18,
    fontFamily: "serif",
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const savedSettings = await getSettings();
      setSettings(savedSettings);
      setLoaded(true);
    })();
  }, []);

  const isDark = settings.nightMode || systemColorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const toggleNightMode = async () => {
    const newSettings = { ...settings, nightMode: !settings.nightMode };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const updateSettings = async (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await saveSettings(updated);
  };

  const value = useMemo(
    () => ({
      isDark,
      colors,
      toggleNightMode,
      settings,
      updateSettings,
    }),
    [isDark, settings]
  );

  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
