import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Building2, CheckCircle2, Target, User } from "lucide-react";
import { cn } from "@/lib/utils";

export type MentionRef = {
  id: string;
  type: "project" | "task" | "goal" | "person";
  label: string;
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  project: Building2,
  task:    CheckCircle2,
  goal:    Target,
  person:  User,
};
const TYPE_LABELS: Record<string, string> = { project: "Project", task: "Task", goal: "Goal", person: "Person" };
const TYPE_CHIP: Record<string, string> = {
  project: "bg-sky-100/80 text-sky-700 border-sky-200/80 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/50",
  task:    "bg-amber-100/80 text-amber-700 border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50",
  goal:    "bg-emerald-100/80 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/50",
  person:  "bg-violet-100/80 text-violet-700 border-violet-200/80 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800/50",
};
const MENTION_HREF: Record<string, (id: string) => string> = {
  project: (id) => `/projects/${id}`,
  task:    (id) => `/tasks/${id}`,
  goal:    ()   => `/scorecard`,
  person:  (id) => `/people?user=${id}`,
};

// Module-level cache — fetched once per browser session
let sourceCache: MentionRef[] | null = null;
let sourceLoading = false;
let sourceWaiters: Array<(s: MentionRef[]) => void> = [];

async function getMentionSources(): Promise<MentionRef[]> {
  if (sourceCache) return sourceCache;
  if (sourceLoading) return new Promise((r) => sourceWaiters.push(r));
  sourceLoading = true;
  const [proj, tsk, goal, ppl] = await Promise.all([
    supabase.from("projects" as any).select("id, title").order("title").limit(200),
    supabase.from("tasks"    as any).select("id, title").order("title").limit(200),
    supabase.from("goals"    as any).select("id, title").order("title").limit(100),
    supabase.from("profiles" as any).select("user_id, full_name").order("full_name").limit(200),
  ]);
  const sources: MentionRef[] = [
    ...(ppl.data  ?? []).filter((p: any) => p.full_name).map((p: any) => ({ id: p.user_id, type: "person" as const, label: p.full_name })),
    ...(proj.data ?? []).map((p: any) => ({ id: p.id, type: "project" as const, label: p.title || "Untitled" })),
    ...(tsk.data  ?? []).map((t: any) => ({ id: t.id, type: "task"    as const, label: t.title || "Untitled" })),
    ...(goal.data ?? []).map((g: any) => ({ id: g.id, type: "goal"    as const, label: g.title || "Untitled" })),
  ];
  sourceCache = sources;
  sourceLoading = false;
  sourceWaiters.forEach((r) => r(sources));
  sourceWaiters = [];
  return sources;
}

/** Clear the mention source cache — call when a person/project/etc is created/renamed. */
export function clearMentionSourceCache() {
  sourceCache = null;
}

// ── Single chip ───────────────────────────────────────────────────────────────
function MentionChip({ mention, onRemove }: { mention: MentionRef; onRemove?: () => void }) {
  const Icon = TYPE_ICONS[mention.type];
  return (
    <span
      className={cn(
        "mention-chip inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md border cursor-pointer transition-opacity hover:opacity-80 shrink-0",
        TYPE_CHIP[mention.type],
      )}
      data-mention-type={mention.type}
      data-mention-id={mention.id}
      data-url={MENTION_HREF[mention.type](mention.id)}
    >
      <Icon className="h-2.5 w-2.5 shrink-0" />
      <span className="max-w-[120px] truncate">{mention.label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 opacity-50 hover:opacity-100 hover:text-destructive transition-opacity"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}

// ── Standalone chips display (for read-only / TodoRow view) ───────────────────
export function MentionChips({
  mentions,
  onRemove,
}: {
  mentions: MentionRef[];
  onRemove?: (id: string) => void;
}) {
  if (!mentions.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {mentions.map((m) => (
        <MentionChip key={m.id} mention={m} onRemove={onRemove ? () => onRemove(m.id) : undefined} />
      ))}
    </div>
  );
}

// ── MentionInput ──────────────────────────────────────────────────────────────
export interface MentionInputProps {
  value: string;
  onChange: (val: string) => void;
  mentions: MentionRef[];
  onMentionsChange: (mentions: MentionRef[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Applied to the outer flex container */
  className?: string;
  /** Applied to the raw <input> element */
  inputClassName?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
}

export function MentionInput({
  value,
  onChange,
  mentions,
  onMentionsChange,
  placeholder,
  disabled,
  className,
  inputClassName,
  onKeyDown,
  autoFocus,
  inputRef: externalRef,
}: MentionInputProps) {
  const localRef = useRef<HTMLInputElement>(null);
  const inputRef = (externalRef ?? localRef) as React.RefObject<HTMLInputElement>;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // null = picker closed; string = active search text after @
  const [query, setQuery] = useState<string | null>(null);
  const [sources, setSources] = useState<MentionRef[]>([]);
  const [atStart, setAtStart] = useState(0);
  const [highlighted, setHighlighted] = useState(0);

  const filtered = query === null
    ? []
    : sources.filter((s) => s.label.toLowerCase().includes(query.toLowerCase())).slice(0, 8);

  const closePicker = useCallback(() => setQuery(null), []);

  const openPicker = useCallback(async (pos: number) => {
    setAtStart(pos);
    setHighlighted(0);
    const srcs = await getMentionSources();
    setSources(srcs);
    setQuery("");
  }, []);

  const selectMention = useCallback(
    (mention: MentionRef) => {
      // Strip out the "@query" text — the mention is tracked separately as a chip
      const cursorPos = inputRef.current?.selectionStart ?? value.length;
      const before = value.slice(0, atStart);
      const after  = value.slice(cursorPos);
      onChange(before + after);
      onMentionsChange([...mentions.filter((m) => m.id !== mention.id), mention]);
      closePicker();
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(before.length, before.length);
        }
      }, 10);
    },
    [value, atStart, mentions, onChange, onMentionsChange, closePicker, inputRef],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      const pos = e.target.selectionStart ?? val.length;
      onChange(val);

      if (query !== null) {
        const textFromAt = val.slice(atStart + 1, pos);
        if (val[atStart] !== "@" || textFromAt.includes(" ")) {
          closePicker();
        } else {
          setQuery(textFromAt);
          setHighlighted(0);
        }
      } else {
        if (val.length > value.length && val[pos - 1] === "@") {
          openPicker(pos - 1);
        }
      }
    },
    [query, atStart, value, onChange, closePicker, openPicker],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (query !== null && filtered.length > 0) {
        if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => (h + 1) % filtered.length); return; }
        if (e.key === "ArrowUp")   { e.preventDefault(); setHighlighted((h) => (h - 1 + filtered.length) % filtered.length); return; }
        if (e.key === "Enter")     { e.preventDefault(); selectMention(filtered[highlighted]); return; }
        if (e.key === "Escape")    { closePicker(); return; }
      }
      onKeyDown?.(e);
    },
    [query, filtered, highlighted, selectMention, closePicker, onKeyDown],
  );

  // Close picker on outside click
  useEffect(() => {
    if (query === null) return;
    const handler = (e: MouseEvent) => {
      if (
        !dropdownRef.current?.contains(e.target as Node) &&
        !containerRef.current?.contains(e.target as Node)
      ) closePicker();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [query, closePicker]);

  return (
    <div className={cn("relative flex-1 min-w-0", className)}>
      {/* Inline chips + input on the same line */}
      <div
        ref={containerRef}
        className="flex flex-wrap items-center gap-1.5 min-h-[28px]"
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        {mentions.map((m) => (
          <MentionChip
            key={m.id}
            mention={m}
            onRemove={() => onMentionsChange(mentions.filter((x) => x.id !== m.id))}
          />
        ))}
        <input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={!value && mentions.length === 0 ? placeholder : undefined}
          disabled={disabled}
          autoFocus={autoFocus}
          className={cn(
            "flex-1 min-w-[80px] bg-transparent border-none outline-none",
            inputClassName,
          )}
        />
      </div>

      {/* @ dropdown */}
      {query !== null && (
        <div
          ref={dropdownRef}
          className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-muted-foreground italic">
              {query ? `No matches for "${query}"` : "Type to search projects, tasks, goals…"}
            </p>
          ) : (
            filtered.map((s, i) => {
              const Icon = TYPE_ICONS[s.type];
              return (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); selectMention(s); }}
                  className={cn(
                    "w-full text-left px-3 py-2 flex items-center gap-2.5 text-xs transition-colors",
                    i === highlighted ? "bg-accent" : "hover:bg-accent/50",
                  )}
                >
                  <span className={cn("p-1 rounded-md border shrink-0", TYPE_CHIP[s.type])}>
                    <Icon className="h-3 w-3" />
                  </span>
                  <div className="min-w-0">
                    <span className="block truncate text-foreground font-medium">{s.label}</span>
                    <span className="text-[10px] text-muted-foreground/60">{TYPE_LABELS[s.type]}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
