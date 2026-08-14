"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

interface UseThemeToggleReturn {
  currentTheme: Theme;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
  isLight: boolean;
  isDark: boolean;
  isSystem: boolean;
  mounted: boolean;
}

/**
 * Custom hook for theme management
 * Wraps next-themes useTheme with additional utilities
 */
export function useThemeToggle(): UseThemeToggleReturn {
  const { theme, setTheme: setNextTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // `theme` is undefined until next-themes has read storage; fall back to the
  // provider's default rather than to "light", which would tick the wrong row
  // for that first frame.
  const currentTheme = (theme || "system") as Theme;

  const setTheme = (newTheme: Theme) => {
    setNextTheme(newTheme);
  };

  const cycleTheme = () => {
    const themes: Theme[] = ["light", "dark", "system"];
    const currentIndex = themes.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  return {
    currentTheme,
    setTheme,
    cycleTheme,
    isLight: currentTheme === "light",
    isDark: currentTheme === "dark",
    isSystem: currentTheme === "system",
    mounted,
  };
}
