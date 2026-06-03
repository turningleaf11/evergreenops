// MetadataRow — the icon+count strip that lives at the bottom of an
// EntityCard. References used patterns like:
//
//     💬 6   🔗 2   📎 3   ☑ 2/3
//
// Always icon + bare number (or fraction). No "Comments" / "Links" labels —
// the icon is the label. That density is what reads as "designed."

import { cn } from "@/lib/utils";

export interface MetadataItem {
  icon: React.ComponentType<{ className?: string }>;
  /** Display value — usually a number, but also "2/3" or "—". */
  value: React.ReactNode;
  /** Hover tooltip; falls back to no title. */
  label?: string;
}

interface Props {
  items: MetadataItem[];
  className?: string;
  /** Hide items where value is 0 or "0". Defaults to true. */
  hideZeros?: boolean;
}

export function MetadataRow({ items, className, hideZeros = true }: Props) {
  const visible = hideZeros
    ? items.filter((i) => i.value !== 0 && i.value !== "0" && i.value !== null && i.value !== undefined)
    : items;

  if (visible.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-3 text-[11px] text-muted-foreground", className)}>
      {visible.map((item, i) => {
        const Icon = item.icon;
        return (
          <span key={i} className="inline-flex items-center gap-1" title={item.label}>
            <Icon className="h-3 w-3" />
            <span>{item.value}</span>
          </span>
        );
      })}
    </div>
  );
}
