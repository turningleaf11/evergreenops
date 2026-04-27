/**
 * Inline cell editors for CRM data tables.
 *
 * Pattern matches the ContactTypeChip in the contact peek sheet:
 *   - The cell renders normally (no chevron, no border).
 *   - Click anywhere on the cell content to open a popover or turn into an input.
 *   - Save on select / blur / Enter. Esc cancels.
 *   - Click bubbling is stopped so the row's own onClick (open peek) is not triggered.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Wrap any cell content so clicking it opens a popover with custom options. */
export function InlinePopoverCell({
  trigger,
  children,
  align = "start",
  className,
  contentClassName,
  ariaLabel,
}: {
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
  contentClassName?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel ?? "Edit"}
          onClick={(e) => {
            e.stopPropagation();
          }}
          className={cn(
            "text-left -mx-1 px-1 py-0.5 rounded hover:bg-[hsl(var(--muted)/0.6)] transition-colors max-w-full",
            className,
          )}
        >
          {trigger}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className={cn("w-56 p-1", contentClassName)}
        onClick={(e) => e.stopPropagation()}
      >
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}

/** Generic option list used inside an InlinePopoverCell. */
export function InlineOptionList<T extends string>({
  options,
  value,
  onChange,
  close,
  renderDot,
}: {
  options: { value: T; label: string; color?: string }[];
  value: T | null | undefined;
  onChange: (next: T) => void | Promise<void>;
  close: () => void;
  renderDot?: (color?: string) => ReactNode;
}) {
  return (
    <>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={async (e) => {
            e.stopPropagation();
            close();
            if (opt.value !== value) await onChange(opt.value);
          }}
          className={cn(
            "w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted/60",
            opt.value === value && "bg-muted/40",
          )}
        >
          {renderDot ? (
            renderDot(opt.color)
          ) : opt.color ? (
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: `hsl(${opt.color})` }}
            />
          ) : (
            <span className="w-2 shrink-0" />
          )}
          <span className="truncate flex-1">{opt.label}</span>
          {opt.value === value && <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        </button>
      ))}
    </>
  );
}

/** Inline text editor: shows display until clicked, then becomes an input. */
export function InlineTextCell({
  value,
  onSave,
  placeholder = "—",
  type = "text",
  inputClassName,
  className,
  display,
  align = "left",
}: {
  value: string | null | undefined;
  onSave: (next: string | null) => void | Promise<void>;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "url" | "number";
  inputClassName?: string;
  className?: string;
  display?: ReactNode;
  align?: "left" | "right";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(value ?? ""), [value]);
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      try {
        const len = ref.current.value.length;
        ref.current.setSelectionRange(len, len);
      } catch {
        /* noop */
      }
    }
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    const next = draft.trim();
    if ((next || "") === (value || "")) return;
    await onSave(next || null);
  };
  const cancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        ref={ref}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          } else if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          }
        }}
        className={cn("h-7 text-[13px] px-1.5", inputClassName)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      className={cn(
        "text-left -mx-1 px-1 py-0.5 rounded hover:bg-[hsl(var(--muted)/0.6)] transition-colors max-w-full truncate block",
        align === "right" && "text-right",
        className,
      )}
    >
      {display ?? (value ? <span className="truncate">{value}</span> : (
        <span className="italic text-muted-foreground/60">{placeholder}</span>
      ))}
    </button>
  );
}

/** Inline date editor (YYYY-MM-DD); display can be customized. */
export function InlineDateCell({
  value,
  onSave,
  display,
  className,
}: {
  value: string | null | undefined;
  onSave: (next: string | null) => void | Promise<void>;
  display?: ReactNode;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(value ?? ""), [value]);
  useEffect(() => {
    if (editing && ref.current) ref.current.focus();
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    const next = draft || null;
    if ((next || "") === (value || "")) return;
    await onSave(next);
  };

  if (editing) {
    return (
      <Input
        ref={ref}
        type="date"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
            setDraft(value ?? "");
          } else if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          }
        }}
        className="h-7 text-[12px] px-1.5"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      className={cn(
        "text-left -mx-1 px-1 py-0.5 rounded hover:bg-[hsl(var(--muted)/0.6)] transition-colors max-w-full block",
        className,
      )}
    >
      {display ?? (value ? new Date(value).toLocaleDateString() : (
        <span className="italic text-muted-foreground/60">—</span>
      ))}
    </button>
  );
}
