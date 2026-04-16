import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type SidebarMode = "pinned" | "floating";

interface SidebarModeContextValue {
  mode: SidebarMode;
  setMode: (m: SidebarMode) => void;
  toggleMode: () => void;
}

const SidebarModeContext = createContext<SidebarModeContextValue | null>(null);

const STORAGE_KEY = "sidebar-mode";

export function SidebarModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<SidebarMode>(() => {
    if (typeof window === "undefined") return "floating";
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "pinned" ? "pinned" : "floating";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const setMode = (m: SidebarMode) => setModeState(m);
  const toggleMode = () => setModeState((m) => (m === "pinned" ? "floating" : "pinned"));

  return (
    <SidebarModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </SidebarModeContext.Provider>
  );
}

export function useSidebarMode() {
  const ctx = useContext(SidebarModeContext);
  if (!ctx) throw new Error("useSidebarMode must be used within SidebarModeProvider");
  return ctx;
}
