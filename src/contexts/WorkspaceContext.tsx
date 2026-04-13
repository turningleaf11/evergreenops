import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface WorkspaceState {
  name: string;
  description: string;
  logoUrl: string | null; // data URL or null
}

interface WorkspaceContextValue extends WorkspaceState {
  setName: (name: string) => void;
  setDescription: (desc: string) => void;
  setLogoUrl: (url: string | null) => void;
}

const STORAGE_KEY = "workspace-settings";

function loadWorkspace(): WorkspaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { name: "TeamSpace", description: "Your team's collaborative workspace", logoUrl: null };
}

function saveWorkspace(state: WorkspaceState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>(loadWorkspace);

  const update = useCallback((partial: Partial<WorkspaceState>) => {
    setState((prev) => {
      const next = { ...prev, ...partial };
      saveWorkspace(next);
      return next;
    });
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        ...state,
        setName: (name) => update({ name }),
        setDescription: (description) => update({ description }),
        setLogoUrl: (logoUrl) => update({ logoUrl }),
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
