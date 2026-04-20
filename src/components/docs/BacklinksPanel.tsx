import { Link2, FileText, StickyNote } from "lucide-react";
import { useBacklinks } from "@/hooks/useBacklinks";
import { useMentionPeek } from "@/components/mention-peek/MentionPeekProvider";

interface Props {
  entityId: string | null | undefined;
}

export default function BacklinksPanel({ entityId }: Props) {
  const { backlinks, loading } = useBacklinks(entityId);
  const { openPeek } = useMentionPeek();

  if (!entityId || (!loading && backlinks.length === 0)) return null;

  return (
    <div className="mt-12 pt-6 border-t border-border/60">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground mb-3">
        <Link2 className="h-3 w-3" />
        <span>Linked from</span>
        {!loading && <span className="text-muted-foreground/60">· {backlinks.length}</span>}
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground italic">Searching…</p>
      ) : (
        <div className="space-y-1">
          {backlinks.map((b) => {
            const Icon = b.source === "doc" ? FileText : StickyNote;
            return (
              <button
                key={`${b.source}-${b.id}`}
                onClick={() => openPeek(b.source, b.id)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-md hover:bg-muted/60 transition-colors text-left"
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{b.title}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/60 shrink-0">{b.source}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
