import { useState, useRef, useEffect, ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalIcon, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type Option = { value: string; label: string };

interface BaseProps {
  value: any;
  onChange: (next: any) => void;
  className?: string;
  placeholder?: string;
}

const cellBase =
  "w-full h-full min-h-[28px] px-2 -mx-2 rounded-md cursor-pointer hover:bg-muted/60 transition-colors flex items-center";

/* ---------- Text cell ---------- */
export function InlineText({ value, onChange, className, placeholder }: BaseProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(value ?? ""), [value]);
  useEffect(() => { if (editing) ref.current?.select(); }, [editing]);

  const commit = () => {
    setEditing(false);
    if ((draft ?? "") !== (value ?? "")) onChange(draft);
  };

  if (editing) {
    return (
      <Input
        ref={ref}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); }
        }}
        className="h-7 text-sm border-primary/40 shadow-none rounded-md px-2"
      />
    );
  }
  return (
    <div
      className={cn(cellBase, className)}
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
    >
      {value ? <span className="truncate text-sm">{value}</span> : <span className="text-xs text-muted-foreground/60 italic">{placeholder ?? "Empty"}</span>}
    </div>
  );
}

/* ---------- Select / Status / Priority cell ---------- */
interface SelectProps extends BaseProps {
  options: Option[];
  renderDisplay: (value: any, label: string | undefined) => ReactNode;
  renderOption?: (opt: Option) => ReactNode;
  align?: "start" | "center" | "end";
}

export function InlineSelect({ value, onChange, options, renderDisplay, renderOption, className, align = "start" }: SelectProps) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <div className={cn(cellBase, className)}>
          {renderDisplay(value, current?.label)}
        </div>
      </PopoverTrigger>
      <PopoverContent align={align} sideOffset={4} className="w-48 p-1" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-0.5">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={(e) => { e.stopPropagation(); onChange(opt.value); setOpen(false); }}
              className={cn(
                "w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-muted flex items-center gap-2",
                opt.value === value && "bg-muted/50",
              )}
            >
              {renderOption ? renderOption(opt) : <span>{opt.label}</span>}
              {opt.value === value && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---------- Assignee cell ---------- */
interface AssigneeProps extends BaseProps {
  profiles: { user_id: string; full_name: string | null }[];
  renderDisplay: (uid: string | null) => ReactNode;
}

export function InlineAssignee({ value, onChange, profiles, renderDisplay, className }: AssigneeProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = profiles.filter((p) =>
    (p.full_name || "").toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <div className={cn(cellBase, className)}>{renderDisplay(value)}</div>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-56 p-2" onClick={(e) => e.stopPropagation()}>
        <Input
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people…"
          className="h-7 text-xs mb-2"
        />
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }}
            className="w-full text-left px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted"
          >
            Unassigned
          </button>
          {filtered.map((p) => (
            <button
              key={p.user_id}
              onClick={(e) => { e.stopPropagation(); onChange(p.user_id); setOpen(false); }}
              className={cn(
                "w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-muted flex items-center justify-between",
                p.user_id === value && "bg-muted/50",
              )}
            >
              <span className="truncate">{p.full_name || "Unknown"}</span>
              {p.user_id === value && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </button>
          ))}
          {filtered.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">No match</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---------- Date cell ---------- */
export function InlineDate({ value, onChange, className }: BaseProps) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <div className={cn(cellBase, className)}>
          {value ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
              <CalIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{format(date!, "MMM d, yyyy")}</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/60">—</span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-auto p-0" onClick={(e) => e.stopPropagation()}>
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            onChange(d ? format(d, "yyyy-MM-dd") : null);
            setOpen(false);
          }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
        {value && (
          <div className="border-t p-2">
            <button
              onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-1"
            >
              Clear date
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
