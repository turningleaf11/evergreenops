import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
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
    setState((prev) => {
      const next = { ...prev, ...partial };
      // Async update to DB
      if (prev.id) {
        supabase
          .from("workspaces")
          .update({
            name: next.name,
            description: next.description,
            logo_url: next.logoUrl,
          } as any)
          .eq("id", prev.id)
          .then();
      }
      return next;
    });
  }, []);

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
