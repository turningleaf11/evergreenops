// AiToolsRail — the permanent right-edge strip housing AI tools.
//
// Replaces the previous floating Albus FAB + bottom-right QuickPanelsDock.
// Lives in Layout.tsx between <main> and the right edge of the viewport.
// Width is fixed (48px). Icons stacked top→bottom; click opens the matching
// slide-over from the right. This gives every AI tool a predictable home
// and removes the conflict with chat composers' right-aligned send buttons.

import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useCompanion } from "@/contexts/CompanionContext";
import { StickyNote, Sparkles } from "lucide-react";
import { AlbusAvatar } from "@/components/AlbusAvatar";
import { NotesQuickPanel, AiWorkshopQuickPanel } from "@/components/QuickPanels";
import AiProjectPeek from "@/components/ai-workshop/AiProjectPeek";
import { cn } from "@/lib/utils";

export function AiToolsRail() {
  const location = useLocation();
  const companion = useCompanion();
  const [notesOpen, setNotesOpen] = useState(false);
  const [workshopOpen, setWorkshopOpen] = useState(false);
  const [peekProjectId, setPeekProjectId] = useState<string | null>(null);

  // Hide the rail on public/auth/onboarding routes where there's no chrome
  const path = location.pathname;
  if (
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/landing") ||
    path.startsWith("/onboarding") ||
    path.startsWith("/n/") ||
    path.startsWith("/f/") ||
    path.startsWith("/submit-lead")
  ) return null;

  return (
    <>
      <aside className="w-12 shrink-0 border-l border-border/40 bg-card/40 flex flex-col items-center py-3 gap-2">
        {/* Albus */}
        <button
          onClick={() => companion?.setOpen(true)}
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center shadow-sm transition-all hover:scale-105",
            companion?.open && "ring-2 ring-primary/60",
          )}
          title="Albus"
        >
          <AlbusAvatar size="md" />
        </button>

        {/* Quick Notes */}
        <RailButton
          icon={<StickyNote className="h-4 w-4" />}
          label="Quick Notes"
          tone="amber"
          active={notesOpen}
          onClick={() => setNotesOpen(true)}
        />

        {/* AI Workshop */}
        <RailButton
          icon={<Sparkles className="h-4 w-4" />}
          label="AI Workshop"
          tone="primary"
          active={workshopOpen}
          onClick={() => setWorkshopOpen(true)}
        />
      </aside>

      {/* Slide-overs */}
      <NotesQuickPanel open={notesOpen} onOpenChange={setNotesOpen} />
      <AiWorkshopQuickPanel
        open={workshopOpen}
        onOpenChange={setWorkshopOpen}
        peekProjectId={peekProjectId}
        setPeekProjectId={setPeekProjectId}
      />
      <AiProjectPeek
        projectId={peekProjectId}
        onClose={() => setPeekProjectId(null)}
        onChange={() => { /* no parent list to refresh here */ }}
      />
    </>
  );
}

function RailButton({
  icon, label, tone, active, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "amber" | "primary";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "h-10 w-10 rounded-lg inline-flex items-center justify-center transition-all hover:scale-105",
        active && "bg-muted",
        !active && "text-muted-foreground hover:text-foreground hover:bg-muted",
        tone === "amber" && active && "text-amber-500",
        tone === "primary" && active && "text-primary",
      )}
    >
      {icon}
    </button>
  );
}
