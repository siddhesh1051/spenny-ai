"use client";

import { createContext, useContext, useEffect, useState } from "react";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: "dark" | "light" | "system";
  storageKey?: string;
};

type ThemeProviderState = {
  theme: "dark" | "light" | "system";
  setTheme: (theme: "dark" | "light" | "system") => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<"dark" | "light" | "system">(() => {
    try {
      return (
        (localStorage.getItem(storageKey) as "dark" | "light" | "system") ||
        defaultTheme
      );
    } catch (e) {
      // unsupported
      return defaultTheme;
    }
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    if (theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");

      const apply = () => {
        const systemTheme = media.matches ? "dark" : "light";
        root.classList.remove("light", "dark");
        root.classList.add(systemTheme);
      };

      apply();

      const handler = () => apply();
      if (typeof media.addEventListener === "function") {
        media.addEventListener("change", handler);
        return () => media.removeEventListener("change", handler);
      }
      // Safari fallback
      media.addListener(handler);
      return () => media.removeListener(handler);
    }
    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: "dark" | "light" | "system") => {
      try {
        localStorage.setItem(storageKey, theme);
      } catch (e) {
        // unsupported
      }
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
