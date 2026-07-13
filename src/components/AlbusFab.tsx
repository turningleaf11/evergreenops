// AlbusFab — the single launcher for Albus (the AI companion).
//
// Reuses the existing GlobalCompanion drawer as its backbone: this is just the
// launcher; clicking it opens the drawer via the companion context's setOpen.
//
// Placement (Monday-style): normally rests in the bottom-right corner. When a
// right-anchored peek/detail panel is open, the FAB parks just to the LEFT of
// that panel's edge — clear of the panel content and its bottom-right composer,
// rather than floating on top of it. Sits above the Sheet layer (z-[55]) so
// it's always reachable, and hides only when the Albus drawer itself is open.

import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { CompanionContext } from "@/contexts/CompanionContext";
import { useAuth } from "@/contexts/AuthContext";
import { AlbusAvatar } from "@/components/AlbusAvatar";
import { cn } from "@/lib/utils";

const HIDDEN_PREFIXES = ["/login", "/signup", "/landing", "/onboarding", "/n/", "/f/", "/submit-lead"];
const GAP = 12; // px between the FAB and the open panel's left edge

// Returns the left edge (px) of an open right-anchored panel to sit beside, or
// null when there's none (rest at the corner). Tracks the slide-in for ~500ms
// after any relevant change so the FAB follows the panel to its settled spot.
function useBesidePanelLeft(): number | null {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    let raf = 0;
    let until = 0;
    const measure = () => {
      const el = document.querySelector('[role="dialog"][data-state="open"]') as HTMLElement | null;
      if (!el) { setLeft(null); return; }
      const r = el.getBoundingClientRect();
      // Only "sit beside" a right-anchored panel that doesn't span the full width.
      const isRightPanel = r.right >= window.innerWidth - 4 && r.left > 40 && r.width < window.innerWidth - 40;
      setLeft(isRightPanel ? Math.round(r.left) : null);
    };
    const track = () => {
      measure();
      if (performance.now() < until) raf = requestAnimationFrame(track);
    };
    const kick = () => { until = performance.now() + 500; cancelAnimationFrame(raf); raf = requestAnimationFrame(track); };
    kick();
    const obs = new MutationObserver(kick);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] });
    window.addEventListener("resize", kick);
    return () => { obs.disconnect(); cancelAnimationFrame(raf); window.removeEventListener("resize", kick); };
  }, []);
  return left;
}

export function AlbusFab() {
  const companion = useContext(CompanionContext);
  const { isPrimaryAdmin } = useAuth();
  const { pathname } = useLocation();
  const besideLeft = useBesidePanelLeft();

  // Albus renders only for the primary admin (GlobalCompanion gates the same
  // way), and never on chrome-less public/auth routes.
  if (!companion || !isPrimaryAdmin) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  if (companion.open) return null;

  const beside = besideLeft != null;

  return (
    <button
      onClick={() => companion.setOpen(true)}
      title="Albus"
      aria-label="Open Albus"
      style={beside ? { right: Math.round(window.innerWidth - besideLeft! + GAP) } : undefined}
      className={cn(
        "fixed bottom-6 z-[55] h-14 w-14 rounded-full bg-card border border-border/60 shadow-lg",
        "flex items-center justify-center transition-all hover:scale-105 active:scale-95",
        !beside && "right-6",
      )}
    >
      <AlbusAvatar size="xl" />
    </button>
  );
}
