import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link as LinkIcon, X, Building2, CheckCircle2, Target, User } from "lucide-react";
import { cn } from "@/lib/utils";

const sb = supabase as any;

export type LinkedItem = {
  type: "project" | "task" | "goal" | "person";
  id: string;
  label: string;
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  project: Building2,
  task: CheckCircle2,
  goal: Target,
  person: User,
};

const TYPE_CHIP: Record<string, string> = {
  project: "bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-500/20",
  task:    "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/20",
  goal:    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20",
  person:  "bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-violet-500/20",
};

const TYPE_HREF: Record<string, (id: string) => string> = {
  project: (id) => `/projects/${id}`,
  task:    (id) => `/tasks/${id}`,
  goal:    ()   => `/scorecard`,
  person:  (id) => `/people?user=${id}`,
};

// Module-level cache (lightweight)
let cache: LinkedItem[] | null = null;
async function loadSources(): Promise<LinkedItem[]> {
  if (cache) return cache;
  const [proj, tsk, goal, ppl] = await Promise.all([
    sb.from("projects").select("id, title").order("title").limit(300),
    sb.from("tasks").select("id, title").order("title").limit(300),
    sb.from("goals").select("id, title").order("title").limit(150),
    sb.from("profiles").select("user_id, full_name").order("full_name").limit(300),
  ]);
  cache = [
    ...(ppl.data ?? []).filter((p: any) => p.full_name).map((p: any) => ({ type: "person" as const, id: p.user_id, label: p.full_name })),
    ...(proj.data ?? []).map((p: any) => ({ type: "project" as const, id: p.id, label: p.title || "Untitled" })),
    ...(tsk.data ?? []).map((t: any) => ({ type: "task" as const, id: t.id, label: t.title || "Untitled" })),
    ...(goal.data ?? []).map((g: any) => ({ type: "goal" as const, id: g.id, label: g.title || "Untitled" })),
  ];
  return cache;
}

export function LinkedItemChip({ item, onRemove, asLink = false }: { item: LinkedItem; onRemove?: () => void; asLink?: boolean }) {
  const Icon = TYPE_ICONS[item.type];
  const cls = TYPE_CHIP[item.type];
  const content = (
    <>
      <Icon className="h-3 w-3 shrink-0" />
      <span className="max-w-[140px] truncate">{item.label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
          className="ml-0.5 opacity-60 hover:opacity-100"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </>
  );
  const wrapperCls = cn("inline-flex items-center gap-1 rounded-full ring-1 px-2 py-0.5 text-[11px] font-medium", cls);
  if (asLink) {
    return <a href={TYPE_HREF[item.type](item.id)} className={cn(wrapperCls, "hover:opacity-80")}>{content}</a>;
  }
  return <span className={wrapperCls}>{content}</span>;
}

interface PickerProps {
  value: LinkedItem[];
  onChange: (items: LinkedItem[]) => void;
  /** Compact button trigger label */
  label?: string;
}

export function LinkedItemPicker({ value, onChange, label = "Link item" }: PickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<LinkedItem[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const popRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    loadSources().then(setSources);
    setQuery("");
    setHighlighted(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!popRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = sources
    .filter((s) => !value.some((v) => v.type === s.type && v.id === s.id))
    .filter((s) => s.label.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  const pick = (item: LinkedItem) => {
    onChange([...value, item]);
    setQuery("");
    setHighlighted(0);
  };

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <LinkIcon className="h-3 w-3" /> {label}
      </button>

      {open && (
        <div
          ref={popRef}
          className="absolute left-0 top-full mt-1 z-50 w-72 rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
        >
          <div className="p-2 border-b border-border/40">
            <input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }}
              placeholder="Search projects, tasks, goals, people…"
              className="w-full text-xs bg-muted/40 rounded px-2 py-1.5 outline-none"
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (filtered.length === 0) return;
                if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => (h + 1) % filtered.length); }
                if (e.key === "ArrowUp")   { e.preventDefault(); setHighlighted((h) => (h - 1 + filtered.length) % filtered.length); }
                if (e.key === "Enter")     { e.preventDefault(); pick(filtered[highlighted]); }
              }}
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground italic">
                {query ? `No matches for "${query}"` : "Type to search…"}
              </p>
            ) : (
              filtered.map((s, i) => {
                const Icon = TYPE_ICONS[s.type];
                return (
                  <button
                    key={`${s.type}-${s.id}`}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                    className={cn(
                      "w-full text-left px-3 py-2 flex items-center gap-2.5 text-xs transition-colors",
                      i === highlighted ? "bg-accent" : "hover:bg-accent/50",
                    )}
                  >
                    <span className={cn("p-1 rounded-md ring-1 shrink-0", TYPE_CHIP[s.type])}>
                      <Icon className="h-3 w-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-foreground font-medium">{s.label}</span>
                      <span className="text-[10px] text-muted-foreground/60 capitalize">{s.type}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
