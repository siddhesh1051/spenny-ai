import React, { createContext, useContext, useState } from "react";
import { useColorScheme } from "react-native";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  colorScheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  isDark: boolean;
  colors: typeof darkColors;
}

// Matches the web app — true black background, very subtle card elevation
const darkColors = {
  background: "#000000",
  card: "#0f0f10",           // near-black card, barely elevated
  cardBorder: "#1c1c1e",     // very subtle border
  text: "#fafafa",
  textMuted: "#a1a1aa",      // zinc-400
  textSecondary: "#52525b",  // zinc-600
  primary: "#ffffff",
  primaryFg: "#000000",
  primaryBg: "rgba(255,255,255,0.05)",
  primaryLight: "#d4d4d8",
  border: "#1c1c1e",
  input: "#0a0a0b",          // slightly off-black input bg
  inputBorder: "#2a2a2e",    // just visible border
  destructive: "#ef4444",
  destructiveFg: "#ffffff",
  success: "#22c55e",
  successBg: "rgba(34, 197, 94, 0.12)",
  info: "#60a5fa",
  infoBg: "rgba(96, 165, 250, 0.12)",
  tabBar: "#000000",
  tabBarBorder: "#1c1c1e",
  overlay: "rgba(0,0,0,0.85)",
  skeleton: "#1c1c1e",
  skeletonHighlight: "#2a2a2e",
  micAccent: "#7c3aed",
  micAccentAlt: "#06b6d4",
};

const lightColors = {
  background: "#ffffff",
  card: "#fafafa",
  cardBorder: "#e4e4e7",     // zinc-200
  text: "#09090b",
  textMuted: "#71717a",      // zinc-500
  textSecondary: "#a1a1aa",  // zinc-400
  primary: "#18181b",        // zinc-900
  primaryFg: "#ffffff",
  primaryBg: "rgba(0,0,0,0.05)",
  primaryLight: "#3f3f46",   // zinc-700
  border: "#e4e4e7",
  input: "#ffffff",
  inputBorder: "#d4d4d8",    // zinc-300
  destructive: "#ef4444",
  destructiveFg: "#ffffff",
  success: "#16a34a",
  successBg: "rgba(22, 163, 74, 0.1)",
  info: "#2563eb",
  infoBg: "rgba(37, 99, 235, 0.1)",
  tabBar: "#ffffff",
  tabBarBorder: "#e4e4e7",
  overlay: "rgba(0,0,0,0.5)",
  skeleton: "#e4e4e7",
  skeletonHighlight: "#f4f4f5",
  micAccent: "#7c3aed",
  micAccentAlt: "#06b6d4",
};

const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  colorScheme: "dark",
  setTheme: () => {},
  isDark: true,
  colors: darkColors,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<Theme>("system");

  const colorScheme: "light" | "dark" =
    theme === "system" ? (systemScheme ?? "dark") : theme;

  const isDark = colorScheme === "dark";
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, colorScheme, setTheme, isDark, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
export { darkColors, lightColors };
