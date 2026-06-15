import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";
type Palette = "default" | "midnight" | "warm-sand";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
  palette: Palette;
  setPalette: (palette: Palette) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const PALETTE_CLASSES: Record<Palette, string> = {
  default: "",
  midnight: "theme-midnight",
  "warm-sand": "theme-warm-sand",
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem("app-theme") as Theme | null;
    return stored || "light";
  });

  const [palette, setPaletteState] = useState<Palette>(() => {
    const stored = localStorage.getItem("app-palette") as Palette | null;
    return stored || "default";
  });

  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;

  useEffect(() => {
    const root = document.documentElement;

    // Remove all palette classes first
    root.classList.remove("theme-midnight", "theme-warm-sand");

    if (palette === "midnight") {
      root.classList.add("theme-midnight");
      root.classList.add("dark");
    } else if (palette === "warm-sand") {
      root.classList.add("theme-warm-sand");
      root.classList.remove("dark");
    } else {
      // Default palette — honour light/dark preference
      if (resolvedTheme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }

    window.dispatchEvent(new CustomEvent("theme-changed"));
  }, [resolvedTheme, palette]);

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (palette !== "default") return; // palette overrides system
      const root = document.documentElement;
      if (getSystemTheme() === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
      window.dispatchEvent(new CustomEvent("theme-changed"));
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, palette]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("app-theme", t);
  };

  const setPalette = (p: Palette) => {
    setPaletteState(p);
    localStorage.setItem("app-palette", p);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme, palette, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
