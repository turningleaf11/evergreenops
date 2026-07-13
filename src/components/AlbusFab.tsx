// AlbusFab — the single bottom-right launcher for Albus (the AI companion).
//
// Reuses the existing GlobalCompanion drawer as its backbone: this is just the
// launcher; clicking it opens the drawer via the companion context's setOpen.
//
// The previous floating FAB was retired because it collided with chat
// composers' right-aligned send buttons. That's solved here structurally:
//   • z-40 sits BELOW the Sheet/Dialog layer (z-50), so any open panel — and
//     its composer — simply occludes the FAB rather than fighting it.
//   • it hides while the drawer is open (no redundant control), and
//   • a comfortable corner margin clears content that ends before the edge.

import { useContext } from "react";
import { useLocation } from "react-router-dom";
import { CompanionContext } from "@/contexts/CompanionContext";
import { useAuth } from "@/contexts/AuthContext";
import { AlbusAvatar } from "@/components/AlbusAvatar";
import { cn } from "@/lib/utils";

const HIDDEN_PREFIXES = ["/login", "/signup", "/landing", "/onboarding", "/n/", "/f/", "/submit-lead"];

export function AlbusFab() {
  const companion = useContext(CompanionContext);
  const { isPrimaryAdmin } = useAuth();
  const { pathname } = useLocation();

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
        "fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-card border border-border/60 shadow-lg",
        "flex items-center justify-center transition-transform hover:scale-105 active:scale-95",
      )}
    >
      <AlbusAvatar size="xl" />
    </button>
  );
}
