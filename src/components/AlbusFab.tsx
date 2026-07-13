// AlbusFab — the single bottom-right launcher for Albus (the AI companion).
//
// Reuses the existing GlobalCompanion drawer as its backbone: this is just the
// launcher; clicking it opens the drawer via the companion context's setOpen.
//
// Albus must be reachable anywhere — including while a peek/detail Sheet is
// open (that's the context-aware use case). So the FAB sits ABOVE the Sheet
// layer (z-[55] > Radix's z-50) and only hides when the Albus drawer itself
// is open (redundant).
//
// The old FAB was retired for colliding with peeks' bottom-right comment
// composers. Solved here: when a modal/peek is open, the FAB lifts above the
// composer bar (bottom-24) instead of sitting on the send button; on plain
// pages it rests at the corner (bottom-6).

import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { CompanionContext } from "@/contexts/CompanionContext";
import { useAuth } from "@/contexts/AuthContext";
import { AlbusAvatar } from "@/components/AlbusAvatar";
import { cn } from "@/lib/utils";

const HIDDEN_PREFIXES = ["/login", "/signup", "/landing", "/onboarding", "/n/", "/f/", "/submit-lead"];

// True while a Radix Dialog/Sheet/AlertDialog (peek, detail panel, confirm) is
// open — those carry a bottom-right composer we must clear.
function useModalOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () =>
      setOpen(!!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] });
    return () => obs.disconnect();
  }, []);
  return open;
}

export function AlbusFab() {
  const companion = useContext(CompanionContext);
  const { isPrimaryAdmin } = useAuth();
  const { pathname } = useLocation();
  const modalOpen = useModalOpen();

  // Albus renders only for the primary admin (GlobalCompanion gates the same
  // way), and never on chrome-less public/auth routes.
  if (!companion || !isPrimaryAdmin) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  if (companion.open) return null;

  return (
    <button
      onClick={() => companion.setOpen(true)}
      title="Albus"
      aria-label="Open Albus"
      className={cn(
        "fixed right-6 z-[55] h-14 w-14 rounded-full bg-card border border-border/60 shadow-lg",
        "flex items-center justify-center transition-all hover:scale-105 active:scale-95",
        // Lift above a peek's composer bar when a panel is open; rest at the corner otherwise.
        modalOpen ? "bottom-24" : "bottom-6",
      )}
    >
      <AlbusAvatar size="xl" />
    </button>
  );
}
