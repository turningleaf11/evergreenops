import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: LucideIcon;
  className?: string;
  /** Wrap in a Card. Defaults to true. */
  card?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Consistent empty state used across the app.
 * Minimal soft icon in a circular tinted halo, single explanatory line, optional CTA.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
  className,
  card = true,
  size = "md",
}: EmptyStateProps) {
  const padding = size === "sm" ? "py-10 px-6" : size === "lg" ? "py-20 px-8" : "py-14 px-6";
  const iconWrap = size === "sm" ? "h-12 w-12" : "h-14 w-14";
  const iconSize = size === "sm" ? "h-5 w-5" : "h-6 w-6";

  const inner = (
    <div className={cn("flex flex-col items-center text-center", padding, className)}>
      <div
        className={cn(
          "rounded-full flex items-center justify-center mb-4 bg-primary/[0.06] ring-1 ring-primary/10",
          iconWrap
        )}
      >
        <Icon className={cn("text-primary/70", iconSize)} strokeWidth={1.5} />
      </div>
      <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1.5 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm" className="mt-5 gap-1.5">
          {ActionIcon && <ActionIcon className="h-3.5 w-3.5" />}
          {actionLabel}
        </Button>
      )}
    </div>
  );

  if (!card) return inner;
  return <Card className="border-dashed bg-card/40">{inner}</Card>;
}

export default EmptyState;
