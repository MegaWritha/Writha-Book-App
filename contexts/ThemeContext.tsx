import React, { createContext, useContext, useState, useMemo, ReactNode } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";
import Colors, { ThemeColors } from "@/constants/colors";

interface Settings {
  fontSize: number;
  fontFamily: string;
}

interface ThemeContextValue {
  isDark: boolean;
  colors: any;
  toggleNightMode: () => void;
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useSystemColorScheme();
  const [isDark, setIsDark] = useState(systemColorScheme === "dark");
  const [settings, setSettings] = useState<Settings>({
    fontSize: 18,
    fontFamily: "serif",
  });

  const colors = isDark ? Colors.dark : Colors.light;

  const toggleNightMode = () => setIsDark(!isDark);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const value = useMemo(() => ({
    isDark,
    colors,
    toggleNightMode,
    settings,
    updateSettings,
  }), [isDark, colors, settings]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}