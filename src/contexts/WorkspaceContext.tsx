import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uploadFile } from "@/lib/file-upload";

interface WorkspaceState {
  id: string | null;
  name: string;
  description: string;
  logoUrl: string | null;
  accentColor: string | null;
  ceoPageName: string;
  deptLabel: string;
}

interface WorkspaceContextValue extends WorkspaceState {
  setName: (name: string) => void;
  setDescription: (desc: string) => void;
  setLogoUrl: (url: string | null) => void;
  setAccentColor: (hue: string | null) => void;
  setCeoPageName: (name: string) => void;
  setDeptLabel: (label: string) => void;
  uploadLogo: (file: File) => Promise<string | null>;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function parseAccentColor(value: string): { h: number; s: number; l: number } {
  // Full HSL string like "160 54 35" or just a hue like "220"
  const parts = value.trim().split(/\s+/);
  if (parts.length >= 3) {
    return { h: parseFloat(parts[0]), s: parseFloat(parts[1]), l: parseFloat(parts[2]) };
  }
  // Bare hue — use default S/L
  return { h: parseFloat(parts[0]) || 220, s: 65, l: 48 };
}

function applyAccentColor(value: string) {
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");
  const { h, s, l } = parseAccentColor(value);

  // Adjust lightness for dark mode
  const mainL = isDark ? Math.min(l + 10, 65) : l;
  const primary = `${h} ${s}% ${mainL}%`;

  root.style.setProperty("--primary", primary);
  root.style.setProperty("--primary-foreground", "0 0% 100%");
  root.style.setProperty("--ring", primary);
  root.style.setProperty("--sidebar-primary", primary);
  root.style.setProperty("--sidebar-primary-foreground", "0 0% 100%");
  root.style.setProperty("--sidebar-ring", primary);
  root.style.setProperty("--sidebar-accent", `${h} 14% ${isDark ? "12" : "92"}%`);
  root.style.setProperty("--sidebar-accent-foreground", `${h} 15% ${isDark ? "80" : "15"}%`);
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const [state, setState] = useState<WorkspaceState>({
    id: null,
    name: "TeamSpace",
    description: "Your team's collaborative workspace",
    logoUrl: null,
    accentColor: null,
    ceoPageName: "CEO Cockpit",
    deptLabel: "Departments",
    appStyle: "standard",
  });
  const [loading, setLoading] = useState(true);

  // Fetch workspace on mount
  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetchWorkspace = async () => {
      const { data } = await supabase
        .from("workspaces")
        .select("*")
        .limit(1)
        .single();

      if (data) {
        setState({
          id: data.id,
          name: data.name,
          description: data.description || "",
          logoUrl: data.logo_url,
          accentColor: data.accent_color || null,
          ceoPageName: (data as any).ceo_page_name || "CEO Cockpit",
          deptLabel: (data as any).dept_label || "Departments",
          appStyle: (data as any).app_style || "standard",
        });
      }
      setLoading(false);
    };
    fetchWorkspace();
  }, [user]);

  // Apply accent color whenever it changes or theme toggles
  useEffect(() => {
    const color = state.accentColor || "220";
    applyAccentColor(color);

    const onThemeChanged = () => applyAccentColor(stateRef.current.accentColor || "220");
    window.addEventListener("theme-changed", onThemeChanged);
    return () => window.removeEventListener("theme-changed", onThemeChanged);
  }, [state.accentColor]);

  // Apply app style class
  useEffect(() => {
    const root = document.documentElement;
    if (state.appStyle === "crystal") {
      root.classList.add("style-crystal");
    } else {
      root.classList.remove("style-crystal");
    }
  }, [state.appStyle]);

  const persist = useCallback(async (partial: Partial<WorkspaceState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const uploadLogo = useCallback(async (file: File): Promise<string | null> => {
    const url = await uploadFile(file);
    if (url) {
      setState((prev) => ({ ...prev, logoUrl: url }));
    }
    return url;
  }, []);

  // Persist to DB whenever state changes (debounced effect)
  const stateRef = useRef(state);
  stateRef.current = state;

  const saveToDb = useCallback(async (s: WorkspaceState) => {
    if (!s.id || !isAdmin) return;
    await supabase
      .from("workspaces")
      .update({
        name: s.name,
        description: s.description,
        logo_url: s.logoUrl,
        accent_color: s.accentColor,
        ceo_page_name: s.ceoPageName,
        dept_label: s.deptLabel,
        app_style: s.appStyle,
      } as any)
      .eq("id", s.id);
  }, [isAdmin]);

  // Save to DB when state changes (skip initial load)
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!initialLoadDone.current) {
      if (!loading) initialLoadDone.current = true;
      return;
    }
    saveToDb(state);
  }, [state, loading, saveToDb]);

  return (
    <WorkspaceContext.Provider
      value={{
        ...state,
        loading,
        setName: (name) => persist({ name }),
        setDescription: (description) => persist({ description }),
        setLogoUrl: (logoUrl) => persist({ logoUrl }),
        setAccentColor: (accentColor) => persist({ accentColor }),
        setCeoPageName: (ceoPageName) => persist({ ceoPageName }),
        setDeptLabel: (deptLabel) => persist({ deptLabel }),
        setAppStyle: (appStyle) => persist({ appStyle }),
        uploadLogo,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
