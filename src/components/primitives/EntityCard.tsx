// EntityCard — the canonical card used in kanbans, grids, and lists across
// the app. Same shell for deals, projects, tasks, goals, leads, issues.
//
// Anatomy (all slots optional except title):
//
//   ┌─────────────────────────────┐
//   │   [hero image — optional]   │
//   ├─────────────────────────────┤
//   │ [StatusPill]        [⋯ menu]│
//   │ Title (1-2 lines, bold)     │
//   │ Description (1-2 lines)     │
//   │                             │
//   │ Assignees:   [avatar stack] │
//   │ 📅 due date    [PriorityPill│
//   │ ─────────────────────────── │
//   │ 💬 6  🔗 2  ☑ 1/3           │
//   └─────────────────────────────┘
//
// Visual rules: white card, soft border, subtle shadow that lifts on hover,
// rounded-xl. The CONTENT does the visual work; the chrome stays quiet.

import { MoreHorizontal, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusPill } from "./StatusPill";
import { PriorityPill } from "./PriorityPill";
import { AvatarStack, type AvatarStackPerson } from "./AvatarStack";
import { MetadataRow, type MetadataItem } from "./MetadataRow";
import type { EntityKind } from "@/lib/statusTone";

interface Props {
  /** Entity kind drives StatusPill coloring. */
  kind: EntityKind;
  status?: string | null;
  priority?: string | null;

  title: string;
  description?: string | null;

  /** Optional hero image. In "card" layout it's a full-width 16:9 hero at the
      top; in "row" layout it's a small square on the far right. */
  coverUrl?: string | null;

  /** Who's on this — used for the avatar stack. */
  assignees?: AvatarStackPerson[];

  /** Pre-formatted due date / date string. */
  dateLabel?: string | null;
  dateIcon?: React.ComponentType<{ className?: string }>;

  /** Bottom metadata strip: comments, attachments, etc. */
  metadata?: MetadataItem[];

  /** Card click handler — usually opens a peek. */
  onClick?: () => void;

  /** Menu (...) click handler. Omit to hide the menu button. */
  onMenuClick?: (e: React.MouseEvent) => void;

  /** Layout mode. "card" (default) is the vertical kanban/grid layout;
      "row" is a horizontal full-width strip used in list views. */
  layout?: "card" | "row";

  className?: string;
}

export function EntityCard({
  kind, status, priority,
  title, description,
  coverUrl,
  assignees,
  dateLabel, dateIcon: DateIcon = Flag,
  metadata,
  onClick, onMenuClick,
  layout = "card",
  className,
}: Props) {
  const hasMetadata = metadata && metadata.length > 0;
  const isRow = layout === "row";

  // ── Row layout — horizontal strip used in list views ──────────────────────
  if (isRow) {
    return (
      <div
        onClick={onClick}
        className={cn(
          "group bg-card rounded-xl border border-border/60 overflow-hidden",
          "shadow-sm hover:shadow-md hover:border-border transition-all",
          onClick && "cursor-pointer",
          "flex items-stretch",
          className,
        )}
      >
        {/* Main content — left side */}
        <div className="flex-1 min-w-0 p-3.5 space-y-1.5">
          {/* Title row: status pill + title (status inline, not on its own row) */}
          <div className="flex items-center gap-2 min-w-0">
            {status && <StatusPill kind={kind} value={status} size="sm" />}
            <h3 className="text-sm font-semibold leading-snug truncate text-foreground flex-1 min-w-0">{title}</h3>
            {onMenuClick && (
              <button
                onClick={(e) => { e.stopPropagation(); onMenuClick(e); }}
                className="text-muted-foreground/60 hover:text-foreground transition-colors -m-1 p-1 rounded-md shrink-0"
                aria-label="More options"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {description && (
            <p className="text-xs text-muted-foreground line-clamp-1 leading-snug">{description}</p>
          )}

          {/* Bottom row: assignees + date + priority + metadata, all inline */}
          {(assignees?.length || dateLabel || priority || hasMetadata) && (
            <div className="flex items-center gap-3 flex-wrap pt-0.5">
              {assignees && assignees.length > 0 && (
                <AvatarStack people={assignees} size="sm" max={4} />
              )}
              {dateLabel && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <DateIcon className="h-3 w-3" />
                  {dateLabel}
                </span>
              )}
              {priority && <PriorityPill value={priority} size="sm" />}
              {hasMetadata && <MetadataRow items={metadata!} className="text-[10px]" />}
            </div>
          )}
        </div>

        {/* Cover thumbnail — far right, fixed square aspect tied to row height */}
        {coverUrl && (
          <div className="aspect-square bg-muted overflow-hidden shrink-0 self-stretch">
            <img
              src={coverUrl}
              alt=""
              className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300"
            />
          </div>
        )}
      </div>
    );
  }

  // ── Card layout — vertical, kanban/grid (default) ─────────────────────────
  return (
    <div
      onClick={onClick}
      className={cn(
        "group bg-card rounded-xl border border-border/60 overflow-hidden",
        "shadow-sm hover:shadow-md hover:border-border transition-all",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {coverUrl && (
        <div className="aspect-[16/9] bg-muted overflow-hidden">
          <img
            src={coverUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        </div>
      )}

      <div className="p-3.5 space-y-2.5">
        {(status || onMenuClick) && (
          <div className="flex items-start justify-between gap-2">
            {status ? <StatusPill kind={kind} value={status} /> : <span />}
            {onMenuClick && (
              <button
                onClick={(e) => { e.stopPropagation(); onMenuClick(e); }}
                className="text-muted-foreground/60 hover:text-foreground transition-colors -m-1 p-1 rounded-md"
                aria-label="More options"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="space-y-1">
          <h3 className="text-sm font-semibold leading-snug line-clamp-2 text-foreground">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">{description}</p>
          )}
        </div>

        {assignees && assignees.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/70">Assignees:</span>
            <AvatarStack people={assignees} size="md" max={4} />
          </div>
        )}

        {(dateLabel || priority) && (
          <div className="flex items-center justify-between gap-2">
            {dateLabel ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <DateIcon className="h-3 w-3" />
                {dateLabel}
              </span>
            ) : <span />}
            {priority && <PriorityPill value={priority} />}
          </div>
        )}

        {hasMetadata && (
          <div className="pt-2 border-t border-border/40">
            <MetadataRow items={metadata!} />
          </div>
        )}
      </div>
    </div>
  );
}
