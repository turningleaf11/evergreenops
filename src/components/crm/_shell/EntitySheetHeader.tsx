import { useEffect, useRef, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Standard header for every CRM detail sheet.
 *
 * Layout: [prev/next column?] [title block] ······ [actions slot] [close]
 *
 * Title sizing, padding, and divider are fixed so all sheets read as siblings.
 * When `onTitleChange` is provided, the title becomes inline-editable
 * (click to focus, blur or Enter to save, Esc to cancel).
 */
export function EntitySheetHeader({
  title,
  subtitle,
  onClose,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  actions,
  leading,
  className,
  titleClassName,
  onTitleChange,
  titlePlaceholder = "Untitled",
}: {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  /** Right-aligned actions (buttons, menus). */
  actions?: React.ReactNode;
  /** Optional leading element (icon) next to the title. */
  leading?: React.ReactNode;
  className?: string;
  /** Override the default title typography (e.g. larger size for primary entities). */
  titleClassName?: string;
  /** When provided, title is inline-editable. Called on blur/Enter when value changed. */
  onTitleChange?: (next: string) => void | Promise<void>;
  titlePlaceholder?: string;
}) {
  const showNav = !!(onPrev || onNext);
  const editable = !!onTitleChange;
  const [draft, setDraft] = useState(title);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== title.trim()) {
      void onTitleChange?.(trimmed);
    } else {
      setDraft(title);
    }
  };

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-border/50",
        className,
      )}
    >
      <div className="flex items-start gap-2 min-w-0 flex-1">
        {showNav && (
          <div className="flex flex-col -ml-1 mt-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-6"
              disabled={prevDisabled}
              onClick={onPrev}
              title="Previous"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-6"
              disabled={nextDisabled}
              onClick={onNext}
              title="Next"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {leading && <div className="mt-1 shrink-0">{leading}</div>}
        <div className="min-w-0 flex-1">
          {editable ? (
            editing ? (
              <input
                ref={inputRef}
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  } else if (e.key === "Escape") {
                    setDraft(title);
                    setEditing(false);
                  }
                }}
                placeholder={titlePlaceholder}
                className={cn(
                  "w-full bg-transparent border-0 outline-none p-0 m-0",
                  "text-lg font-semibold leading-tight text-foreground",
                  "focus-visible:ring-0 focus-visible:outline-none",
                  titleClassName,
                )}
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className={cn(
                  "block w-full text-left truncate rounded-sm",
                  "text-lg font-semibold leading-tight text-foreground",
                  "hover:bg-muted/40 -mx-1 px-1 transition-colors",
                  titleClassName,
                )}
                title="Click to rename"
              >
                {title || (
                  <span className="text-muted-foreground/60 italic font-normal">
                    {titlePlaceholder}
                  </span>
                )}
              </button>
            )
          ) : (
            <h2
              className={cn(
                "text-lg font-semibold leading-tight truncate",
                titleClassName,
              )}
            >
              {title}
            </h2>
          )}
          {subtitle && (
            <div className="text-xs text-muted-foreground mt-0.5 min-w-0">{subtitle}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 pr-8">
        {actions}
      </div>
    </div>
  );
}
