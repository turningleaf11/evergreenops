import { useEffect, useState } from "react";
import { Plus, Search, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Item = { id: string; label: string; sublabel?: string | null };

/**
 * Compact picker used in entity detail sidebars to link related records.
 * Shows a "+" trigger that opens a searchable list. Calls onPick with the
 * selected record id; the parent handles the actual linking mutation.
 */
export function LinkRecordPopover({
  kind,
  excludeIds = [],
  onPick,
  onCreate,
  triggerLabel = "Link",
}: {
  kind: "deal" | "lead";
  excludeIds?: string[];
  onPick: (item: Item) => void | Promise<void>;
  /** Optional handler for "+ Create new" footer action. */
  onCreate?: () => void;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      setLoading(true);
      if (kind === "deal") {
        let q = supabase
          .from("deals")
          .select("id,name,stage,status")
          .order("created_at", { ascending: false })
          .limit(25);
        if (query.trim()) q = q.ilike("name", `%${query.trim()}%`);
        const { data } = await q;
        if (!active) return;
        setItems(
          ((data as any[]) || [])
            .filter((d) => !excludeIds.includes(d.id))
            .map((d) => ({ id: d.id, label: d.name || "Untitled deal", sublabel: d.stage })),
        );
      } else {
        let q = supabase
          .from("leads")
          .select("id,address_line1,status")
          .order("created_at", { ascending: false })
          .limit(25);
        if (query.trim()) q = q.ilike("address_line1", `%${query.trim()}%`);
        const { data } = await q;
        if (!active) return;
        setItems(
          ((data as any[]) || [])
            .filter((l) => !excludeIds.includes(l.id))
            .map((l) => ({ id: l.id, label: l.address_line1 || "Untitled lead", sublabel: l.status })),
        );
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [open, query, kind, excludeIds.join(",")]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          title={triggerLabel}
        >
          <Plus className="h-3 w-3" /> {triggerLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${kind}s…`}
              className="h-8 pl-7 text-sm"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="px-3 py-6 text-xs text-muted-foreground text-center">
              No matches.
            </div>
          ) : (
            <ul className="py-1">
              {items.map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-muted/60 flex flex-col gap-0.5"
                    onClick={async () => {
                      await onPick(it);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span className="text-sm font-medium truncate">{it.label}</span>
                    {it.sublabel && (
                      <span className="text-[11px] text-muted-foreground truncate">
                        {it.sublabel}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {onCreate && (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setQuery("");
              onCreate();
            }}
            className="w-full text-left px-3 py-2 text-xs font-medium text-primary border-t hover:bg-muted/60 flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Create new {kind}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
