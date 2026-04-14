import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface WorkspaceState {
  id: string | null;
  name: string;
  description: string;
  logoUrl: string | null;
  accentColor: string | null;
}

interface WorkspaceContextValue extends WorkspaceState {
  setName: (name: string) => void;
  setDescription: (desc: string) => void;
  setLogoUrl: (url: string | null) => void;
  setAccentColor: (hue: string | null) => void;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function applyAccentHue(hue: string) {
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");
  const h = hue;

  root.style.setProperty("--primary", `${h} 65% ${isDark ? "55" : "48"}%`);
  root.style.setProperty("--primary-foreground", "0 0% 100%");
  root.style.setProperty("--ring", `${h} 65% ${isDark ? "55" : "48"}%`);
  root.style.setProperty("--sidebar-primary", `${h} 65% ${isDark ? "55" : "48"}%`);
  root.style.setProperty("--sidebar-primary-foreground", "0 0% 100%");
  root.style.setProperty("--sidebar-ring", `${h} 65% ${isDark ? "55" : "48"}%`);
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
          accentColor: (data as any).accent_color || null,
        });
      }
      setLoading(false);
    };
    fetchWorkspace();
  }, [user]);

  // Apply accent color whenever it changes
  useEffect(() => {
    const hue = state.accentColor || "220";
    applyAccentHue(hue);
  }, [state.accentColor]);

  const persist = useCallback(async (partial: Partial<WorkspaceState>) => {
    setState((prev) => ({ ...prev, ...partial }));
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
