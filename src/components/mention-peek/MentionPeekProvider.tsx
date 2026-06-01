import { createContext, useCallback, useContext, useState, ReactNode } from "react";

export type PeekType = "person" | "doc" | "note" | "task" | "project" | "goal" | "record" | "issue";

interface PeekState { type: PeekType; id: string; }

interface Ctx {
  active: PeekState | null;
  openPeek: (type: PeekType, id: string) => void;
  closePeek: () => void;
}

const MentionPeekContext = createContext<Ctx | null>(null);

export function MentionPeekProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<PeekState | null>(null);
  const openPeek = useCallback((type: PeekType, id: string) => setActive({ type, id }), []);
  const closePeek = useCallback(() => setActive(null), []);
  return (
    <MentionPeekContext.Provider value={{ active, openPeek, closePeek }}>
      {children}
    </MentionPeekContext.Provider>
  );
}

export function useMentionPeek() {
  const ctx = useContext(MentionPeekContext);
  if (!ctx) throw new Error("useMentionPeek must be used inside MentionPeekProvider");
  return ctx;
}
