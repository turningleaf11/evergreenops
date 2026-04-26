import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * "View first, edit on click" field used in CRM detail sheets.
 *
 * Renders a read-only row with an icon + value (or muted placeholder).
 * Hovering reveals a small pencil. Clicking turns the row into an inline
 * input. Saves on blur or Enter; Esc cancels. Designed to feel like a
 * Notion/Linear inline edit, not a form field.
 */
export function EditableLineField({
  icon,
  value,
  placeholder = "Not set",
  multiline = false,
  type = "text",
  onSave,
  className,
  inputClassName,
  ariaLabel,
}: {
  icon?: React.ReactNode;
  value: string | null | undefined;
  placeholder?: string;
  multiline?: boolean;
  type?: "text" | "email" | "tel";
  onSave: (next: string | null) => void | Promise<void>;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      // Place caret at end
      const el = inputRef.current as any;
      const len = (el.value as string).length;
      try { el.setSelectionRange(len, len); } catch { /* noop */ }
    }
  }, [editing]);

  const commit = async () => {
    const next = draft.trim();
    setEditing(false);
    if ((next || "") === (value || "")) return;
    await onSave(next || null);
  };

  const cancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={cn("flex items-start gap-3 py-2", className)}>
        {icon && <span className="mt-2 text-muted-foreground shrink-0">{icon}</span>}
        {multiline ? (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void commit();
              }
            }}
            rows={4}
            placeholder={placeholder}
            className={cn("text-sm resize-none", inputClassName)}
          />
        ) : (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              } else if (e.key === "Enter") {
                e.preventDefault();
                void commit();
              }
            }}
            placeholder={placeholder}
            className={cn("h-8 text-sm", inputClassName)}
          />
        )}
      </div>
    );
  }

  const empty = !value;
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={ariaLabel ?? "Edit"}
      className={cn(
        "group w-full text-left flex items-start gap-3 px-2 py-2 -mx-2 rounded-md transition-colors",
        "hover:bg-[hsl(var(--muted)/0.6)]",
        className,
      )}
    >
      {icon && (
        <span className="mt-0.5 text-muted-foreground shrink-0">{icon}</span>
      )}
      <span
        className={cn(
          "flex-1 min-w-0 text-sm break-words whitespace-pre-wrap",
          empty ? "italic text-muted-foreground/70" : "text-foreground",
        )}
      >
        {empty ? placeholder : value}
      </span>
      <Pencil className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/70 transition-colors shrink-0 mt-1" />
    </button>
  );
}
