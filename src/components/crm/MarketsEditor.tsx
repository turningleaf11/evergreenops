import { useEffect, useMemo, useRef, useState } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface MarketRow {
  id: string;
  name: string;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Simple in-module cache so multiple editors share suggestions across the sheet.
 */
const cache: { ws?: string | null; rows: MarketRow[]; loadedAt: number } = {
  ws: undefined,
  rows: [],
  loadedAt: 0,
};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

async function loadMarkets(workspaceId: string | null | undefined) {
  if (cache.ws === workspaceId && Date.now() - cache.loadedAt < 60_000) return cache.rows;
  if (!workspaceId) {
    cache.ws = workspaceId ?? null;
    cache.rows = [];
    cache.loadedAt = Date.now();
    notify();
    return cache.rows;
  }
  const { data } = await supabase
    .from("crm_markets")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true })
    .limit(500);
  cache.ws = workspaceId;
  cache.rows = (data || []) as MarketRow[];
  cache.loadedAt = Date.now();
  notify();
  return cache.rows;
}

async function ensureMarket(workspaceId: string, name: string, userId: string | null) {
  const cleaned = name.trim();
  if (!cleaned) return null;
  // Match against cache first (case-insensitive)
  const existing = cache.rows.find((r) => norm(r.name) === norm(cleaned));
  if (existing) return existing.name;
  const { data, error } = await supabase
    .from("crm_markets")
    .insert({ workspace_id: workspaceId, name: cleaned, created_by: userId })
    .select("id, name")
    .single();
  if (error) {
    // Conflict on unique norm: re-fetch to recover canonical casing
    const { data: again } = await supabase
      .from("crm_markets")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .ilike("name", cleaned)
      .maybeSingle();
    if (again) {
      if (!cache.rows.some((r) => r.id === (again as any).id)) {
        cache.rows = [...cache.rows, again as MarketRow].sort((a, b) => a.name.localeCompare(b.name));
        notify();
      }
      return (again as any).name as string;
    }
    return null;
  }
  cache.rows = [...cache.rows, data as MarketRow].sort((a, b) => a.name.localeCompare(b.name));
  notify();
  return (data as MarketRow).name;
}

export interface MarketsEditorProps {
  workspaceId: string | null | undefined;
  value: string[];
  onChange: (next: string[]) => void;
  /** Visual style. */
  variant?: "chips" | "chips-azure" | "chips-outline";
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
}

/**
 * Shared markets label editor with workspace-wide autocomplete.
 * - Shows existing markets as chips
 * - Type to filter / select an existing market, or press Enter to create a new one
 * - Case-insensitive dedupe — never produces duplicate labels
 */
export function MarketsEditor({
  workspaceId,
  value,
  onChange,
  variant = "chips-azure",
  placeholder = "Add a market…",
  emptyLabel = "Add markets",
  className,
}: MarketsEditorProps) {
  const { user } = useAuth();
  const [allMarkets, setAllMarkets] = useState<MarketRow[]>(cache.rows);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Subscribe to shared cache so chips/suggestions stay in sync across instances
  useEffect(() => {
    const update = () => setAllMarkets([...cache.rows]);
    listeners.add(update);
    void loadMarkets(workspaceId).then(update);
    return () => {
      listeners.delete(update);
    };
  }, [workspaceId]);

  const selectedSet = useMemo(() => new Set(value.map(norm)), [value]);

  const suggestions = useMemo(() => {
    const q = norm(draft);
    return allMarkets
      .filter((m) => !selectedSet.has(norm(m.name)))
      .filter((m) => (q ? norm(m.name).includes(q) : true))
      .slice(0, 8);
  }, [allMarkets, selectedSet, draft]);

  const exactExists = useMemo(() => {
    const q = norm(draft);
    if (!q) return false;
    return allMarkets.some((m) => norm(m.name) === q) || selectedSet.has(q);
  }, [allMarkets, selectedSet, draft]);

  const closeDropdown = () => {
    setAdding(false);
    setDraft("");
    setHighlight(0);
  };

  const pickExisting = (name: string) => {
    if (selectedSet.has(norm(name))) {
      closeDropdown();
      return;
    }
    onChange([...value, name]);
    closeDropdown();
  };

  const createNew = async () => {
    const cleaned = draft.trim();
    if (!cleaned || !workspaceId) {
      closeDropdown();
      return;
    }
    if (selectedSet.has(norm(cleaned))) {
      closeDropdown();
      return;
    }
    const canonical = await ensureMarket(workspaceId, cleaned, user?.id ?? null);
    if (canonical) onChange([...value, canonical]);
    closeDropdown();
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const sug = suggestions[highlight];
      if (sug) pickExisting(sug.name);
      else void createNew();
      return;
    }
    if (e.key === "Escape") {
      closeDropdown();
      return;
    }
    if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  // Click outside to close
  useEffect(() => {
    if (!adding) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        // Treat blur as commit if there's a draft, otherwise just close
        const cleaned = draft.trim();
        if (cleaned) {
          // If exact match in suggestions, pick it; else create
          const exact = allMarkets.find((m) => norm(m.name) === norm(cleaned));
          if (exact && !selectedSet.has(norm(exact.name))) {
            pickExisting(exact.name);
            return;
          }
          if (!exactExists) void createNew();
          else closeDropdown();
        } else {
          closeDropdown();
        }
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adding, draft, allMarkets, selectedSet, exactExists]);

  const remove = (m: string) => {
    onChange(value.filter((x) => norm(x) !== norm(m)));
  };

  const chipCls =
    variant === "chips-azure"
      ? "bg-brand-azure text-white"
      : variant === "chips-outline"
      ? "bg-brand-azure/15 text-brand-azure font-semibold"
      : "bg-muted text-foreground";

  return (
    <div ref={wrapRef} className={cn("relative flex flex-wrap items-center gap-1.5", className)}>
      {value.length === 0 && !adding && (
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="text-sm italic text-muted-foreground/70 hover:text-foreground"
        >
          {emptyLabel}
        </button>
      )}

      {value.map((m) => (
        <span
          key={m}
          className={cn("inline-flex items-center gap-1 rounded-full text-xs", chipCls)}
          style={{ padding: "3px 10px" }}
        >
          {m}
          <button
            type="button"
            onClick={() => remove(m)}
            className="opacity-70 hover:opacity-100"
            aria-label={`Remove ${m}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      {adding ? (
        <div className="relative">
          <Input
            ref={inputRef}
            autoFocus
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={onKey}
            placeholder={placeholder}
            className="h-7 text-xs w-44"
          />
          {(suggestions.length > 0 || (draft.trim() && !exactExists)) && (
            <div className="absolute z-50 left-0 top-full mt-1 w-56 rounded-md border bg-popover shadow-md py-1 max-h-60 overflow-auto">
              {suggestions.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickExisting(s.name);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 text-sm",
                    highlight === i ? "bg-accent" : "hover:bg-accent/50",
                  )}
                >
                  {s.name}
                </button>
              ))}
              {draft.trim() && !exactExists && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void createNew();
                  }}
                  onMouseEnter={() => setHighlight(suggestions.length)}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 text-sm border-t border-border/40 inline-flex items-center gap-1.5",
                    highlight === suggestions.length ? "bg-accent" : "hover:bg-accent/50",
                  )}
                >
                  <Plus className="h-3 w-3" />
                  Create "<span className="font-medium">{draft.trim()}</span>"
                </button>
              )}
              {suggestions.length === 0 && !draft.trim() && (
                <div className="px-2.5 py-1.5 text-xs text-muted-foreground">Start typing…</div>
              )}
            </div>
          )}
        </div>
      ) : value.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
        >
          + Add
        </button>
      ) : null}
    </div>
  );
}
