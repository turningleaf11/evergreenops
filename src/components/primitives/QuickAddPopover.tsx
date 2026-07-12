// QuickAddPopover — the ONE "add a task / subtask / feature / step" affordance
// used across the app. It is NOT a floating popover (that pattern was disliked
// for the jump-cut and the extra click) — it's an inline transform: a resting
// "+ Add" button that becomes an in-place input row on click. Enter saves and
// keeps the row open for rapid multi-add; Escape or an empty blur closes it
// back to the button. Keep the button — it's the resting state, not removed.
//
// One implementation, many surfaces: upgrade here, every list gets it.
// Ported from autumn-design-system/src/components/primitives/QuickAddPopover.tsx.
// (Name kept for API compatibility with existing call sites.)

import { useState, useRef } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onAdd: (value: string) => void;
  /** Resting button label. Default: "Add". */
  triggerLabel?: string;
  placeholder?: string;
  /** Kept for API compatibility; unused in the inline pattern. */
  submitLabel?: string;
  className?: string;
}

export function QuickAddPopover({
  onAdd,
  triggerLabel = "Add",
  placeholder = "Name…",
  className,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onAdd(v);
    setValue("");
    inputRef.current?.focus(); // keep the row open to add the next one
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-dashed border-border/70 text-sm text-muted-foreground",
          "hover:text-foreground hover:border-border hover:bg-accent/40 transition-colors",
          className,
        )}
      >
        <Plus className="h-3.5 w-3.5" /> {triggerLabel}
      </button>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-2 h-8 min-w-[240px] px-2.5 rounded-md border border-border bg-background", className)}>
      <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <input
        ref={inputRef}
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); submit(); }
          else if (e.key === "Escape") { setValue(""); setEditing(false); }
        }}
        onBlur={() => { if (!value.trim()) setEditing(false); }}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
      />
    </div>
  );
}
