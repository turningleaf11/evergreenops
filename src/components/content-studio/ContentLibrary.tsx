import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Trash2 } from "lucide-react";
import { useContentLibrary, type LibraryItem } from "@/hooks/useContentStudio";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUSES: LibraryItem["status"][] = ["draft", "approved", "posted", "archived"];

const STATUS_STYLES: Record<LibraryItem["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  posted: "bg-primary text-primary-foreground",
  archived: "bg-muted/50 text-muted-foreground/60",
};

export function ContentLibrary() {
  const { items, loading, updateStatus, remove, clearArchived } = useContentLibrary();
  const [filter, setFilter] = useState<"all" | LibraryItem["status"]>("all");
  const [search, setSearch] = useState("");

  if (loading) return <div className="text-sm text-muted-foreground">Loading library…</div>;

  const counts = items.reduce((acc, it) => { acc[it.status] = (acc[it.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  const filtered = items.filter((it) => {
    if (filter !== "all" && it.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!it.content.toLowerCase().includes(q) && !it.seed.toLowerCase().includes(q) && !it.brand_name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const cycleStatus = (it: LibraryItem) => {
    const idx = STATUSES.indexOf(it.status);
    updateStatus(it.id, STATUSES[(idx + 1) % STATUSES.length]);
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { num: items.length, label: "Total" },
          { num: counts.approved || 0, label: "Approved" },
          { num: counts.posted || 0, label: "Posted" },
          { num: counts.draft || 0, label: "Drafts" },
        ].map((s) => (
          <Card key={s.label} className="p-4 text-center">
            <div className="text-2xl font-semibold text-primary leading-none">{s.num}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search content…"
          className="flex-1 min-w-[160px] h-9"
        />
        {(["all", ...STATUSES] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border capitalize transition-all",
              filter === f ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {f}
          </button>
        ))}
        {counts.archived > 0 && (
          <button onClick={clearArchived} className="text-xs text-muted-foreground hover:text-destructive underline">
            Clear archived
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <strong className="block text-base mb-1">{items.length === 0 ? "No saved content yet" : "Nothing matches"}</strong>
          <span className="text-sm text-muted-foreground">{items.length === 0 ? "Generate content and hit Save to build your library." : "Try a different filter."}</span>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((it) => (
            <Card key={it.id} className="overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: it.brand_color }} />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{it.platform_label}</span>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {new Date(it.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {it.brand_name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => cycleStatus(it)}
                    className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize transition-colors", STATUS_STYLES[it.status])}
                  >
                    {it.status}
                  </button>
                  <Button size="sm" variant="ghost" onClick={() => remove(it.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{it.content}</div>
                {it.seed && <div className="text-xs text-muted-foreground italic mt-2">Seed: {it.seed}</div>}
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" onClick={() => handleCopy(it.content)}>
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                  {it.canva_url && (
                    <Button size="sm" variant="ghost" asChild>
                      <a href={it.canva_url} target="_blank" rel="noreferrer">Open in Canva →</a>
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
