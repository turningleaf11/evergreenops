import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface WorkspaceState {
  id: string | null;
  name: string;
  description: string;
  logoUrl: string | null;
}

interface WorkspaceContextValue extends WorkspaceState {
  setName: (name: string) => void;
  setDescription: (desc: string) => void;
  setLogoUrl: (url: string | null) => void;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const [state, setState] = useState<WorkspaceState>({
    id: null,
    name: "TeamSpace",
    description: "Your team's collaborative workspace",
    logoUrl: null,
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
        });
      }
      setLoading(false);
    };
    fetchWorkspace();
  }, [user]);

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
      .update({ name: s.name, description: s.description, logo_url: s.logoUrl })
      .eq("id", s.id);
  }, [isAdmin]);

  return (
    <WorkspaceContext.Provider
      value={{
        ...state,
        loading,
        setName: (name) => persist({ name }),
        setDescription: (description) => persist({ description }),
        setLogoUrl: (logoUrl) => persist({ logoUrl }),
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
