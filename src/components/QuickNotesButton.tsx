// QuickNotesButton — the Quick Notes launcher, now a header-cluster icon
// (moved off the retired right-edge AI rail). Owns its own open state and
// renders the existing NotesQuickPanel slide-over.

import { useState } from "react";
import { StickyNote } from "lucide-react";
import { NotesQuickPanel } from "@/components/QuickPanels";

export function QuickNotesButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Quick Notes"
        aria-label="Quick Notes"
        className="h-9 w-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <StickyNote className="h-4 w-4" />
      </button>
      <NotesQuickPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
