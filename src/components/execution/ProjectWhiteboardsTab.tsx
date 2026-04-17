import { PenLine } from "lucide-react";

export default function ProjectWhiteboardsTab() {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
      <PenLine className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
      <p className="text-sm font-medium">Whiteboards coming soon</p>
      <p className="text-xs text-muted-foreground mt-1">
        Built-in canvas + Miro/Figma embeds — shipping in Phase 2.
      </p>
    </div>
  );
}
