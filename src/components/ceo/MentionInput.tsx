import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type MentionRef = {
  id: string;
  type: "project" | "task" | "goal";
  label: string;
};

const TYPE_LABELS: Record<string, string> = { project: "Project", task: "Task", goal: "Goal" };
const TYPE_COLORS: Record<string, string> = {
  project: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  task:    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  goal:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
};
const MENTION_HREF: Record<string, (id: string) => string> = {
  project: (id) => `/projects/${id}`,
  task:    (id) => `/tasks/${id}`,
  goal:    ()   => `/scorecard`,
};

// Module-level cache so sources are fetched once per browser session
let sourceCache: MentionRef[] | null = null;
let sourceLoading = false;
let sourceWaiters: Array<(s: MentionRef[]) => void> = [];

async function getMentionSources(): Promise<MentionRef[]> {
  if (sourceCache) return sourceCache;
  if (sourceLoading) return new Promise((r) => sourceWaiters.push(r));
  sourceLoading = true;
  const [proj, tsk, goal] = await Promise.all([
    supabase.from("projects" as any).select("id, title").order("title").limit(200),
    supabase.from("tasks"    as any).select("id, title").order("title").limit(200),
    supabase.from("goals"    as any).select("id, title").order("title").limit(100),
  ]);
  const sources: MentionRef[] = [
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

// ── MentionChips (standalone display component) ──────────────────────────────
export function MentionChips({
  mentions,
  onRemove,
}: {
  mentions: MentionRef[];
  onRemove?: (id: string) => void;
}) {
  if (!mentions.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {mentions.map((m) => (
        <span
          key={m.id}
          className="mention-chip inline-flex items-center gap-1 text-[10px] font-medium rounded cursor-pointer transition-opacity hover:opacity-80"
          data-mention-type={m.type}
          data-mention-id={m.id}
          data-url={MENTION_HREF[m.type](m.id)}
        >
          <span className={cn("px-1.5 py-0.5 rounded", TYPE_COLORS[m.type])}>
            {TYPE_LABELS[m.type][0]} · {m.label}
          </span>
          {onRemove && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(m.id); }}
              className="text-muted-foreground/60 hover:text-destructive pr-0.5"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

// ── MentionInput ─────────────────────────────────────────────────────────────
export interface MentionInputProps {
  value: string;
  onChange: (val: string) => void;
  mentions: MentionRef[];
  onMentionsChange: (mentions: MentionRef[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
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
  onKeyDown,
  autoFocus,
  inputRef: externalRef,
}: MentionInputProps) {
  const localRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef ?? localRef;
  const dropdownRef = useRef<HTMLDivElement>(null);

  // query = null means picker closed; string = active search text after @
  const [query, setQuery] = useState<string | null>(null);
  const [sources, setSources] = useState<MentionRef[]>([]);
  const [atStart, setAtStart] = useState(0);
  const [highlighted, setHighlighted] = useState(0);

  const filtered = query === null
    ? []
    : sources
        .filter((s) => s.label.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8);

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
      const cursorPos = inputRef.current?.selectionStart ?? value.length;
      const before = value.slice(0, atStart);
      const after  = value.slice(cursorPos);
      const newVal = `${before}@${mention.label}${after}`;
      onChange(newVal);
      onMentionsChange([...mentions.filter((m) => m.id !== mention.id), mention]);
      closePicker();
      setTimeout(() => {
        if (inputRef.current) {
          const pos = before.length + 1 + mention.label.length;
          inputRef.current.focus();
          inputRef.current.setSelectionRange(pos, pos);
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
        // Close if the @ was deleted or user typed a space
        if (val[atStart] !== "@" || textFromAt.includes(" ")) {
          closePicker();
        } else {
          setQuery(textFromAt);
          setHighlighted(0);
        }
      } else {
        // Detect freshly typed @
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
        if (e.key === "ArrowDown")  { e.preventDefault(); setHighlighted((h) => (h + 1) % filtered.length); return; }
        if (e.key === "ArrowUp")    { e.preventDefault(); setHighlighted((h) => (h - 1 + filtered.length) % filtered.length); return; }
        if (e.key === "Enter")      { e.preventDefault(); selectMention(filtered[highlighted]); return; }
        if (e.key === "Escape")     { closePicker(); return; }
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
        !inputRef.current?.contains(e.target as Node)
      ) closePicker();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [query, closePicker, inputRef]);

  return (
    <div className="flex-1 min-w-0">
      <div className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={className}
        />

        {/* @ mention dropdown */}
        {query !== null && (
          <div
            ref={dropdownRef}
            className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
          >
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {query ? "No matches" : "Type to search projects, tasks, goals…"}
              </p>
            ) : (
              filtered.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); selectMention(s); }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs transition-colors",
                    i === highlighted ? "bg-accent" : "hover:bg-accent/50",
                  )}
                >
                  <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0", TYPE_COLORS[s.type])}>
                    {TYPE_LABELS[s.type]}
                  </span>
                  <span className="truncate text-foreground">{s.label}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Mention chips */}
      <MentionChips
        mentions={mentions}
        onRemove={(id) => onMentionsChange(mentions.filter((m) => m.id !== id))}
      />
    </div>
  );
}
