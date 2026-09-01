"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [, setMounted] = useState(false);

  // Apply theme class to documentElement
  const applyTheme = useCallback((t: Theme) => {
    if (typeof window === "undefined") return;

    let target: "light" | "dark" = "light";
    if (t === "system") {
      target = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      target = t;
    }

    setResolvedTheme(target);
    const root = document.documentElement;
    if (target === "dark") {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
    }
  }, []);

  useEffect(() => {
    const saved = (localStorage.getItem("theme") as Theme) || "system";
    setThemeState(saved);
    applyTheme(saved);
    setMounted(true);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const currentSaved = (localStorage.getItem("theme") as Theme) || "system";
      if (currentSaved === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [applyTheme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem("theme", t);
    } catch {
      // localStorage not accessible
    }
    applyTheme(t);
  };

  const toggleTheme = () => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: "light" as Theme,
      resolvedTheme: "light" as const,
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
}
