import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  /** Wrap in a Card. Defaults to true. */
  card?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Sibling to EmptyState — same halo/Card shell, but destructive-tinted icon
 * and a Retry CTA front and center, since "try again" is virtually always
 * the right action for a failed fetch (unlike EmptyState's varied actions).
 */
export function ErrorState({
  title = "Something went wrong",
  description = "Try again — if it keeps happening, the issue is probably on our end, not yours.",
  onRetry,
  retryLabel = "Try again",
  className,
  card = true,
  size = "md",
}: ErrorStateProps) {
  const padding = size === "sm" ? "py-10 px-6" : size === "lg" ? "py-20 px-8" : "py-14 px-6";
  const iconWrap = size === "sm" ? "h-12 w-12" : "h-14 w-14";
  const iconSize = size === "sm" ? "h-5 w-5" : "h-6 w-6";

  const inner = (
    <div className={cn("flex flex-col items-center text-center", padding, className)}>
      <div
        className={cn(
          "rounded-full flex items-center justify-center mb-4 bg-destructive/[0.08] ring-1 ring-destructive/15",
          iconWrap,
        )}
      >
        <AlertTriangle className={cn("text-destructive/80", iconSize)} strokeWidth={1.5} />
      </div>
      <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1.5 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {onRetry && (
        <Button onClick={onRetry} size="sm" variant="outline" className="mt-5 gap-1.5">
          <RotateCw className="h-3.5 w-3.5" />
          {retryLabel}
        </Button>
      )}
    </div>
  );

  if (!card) return inner;
  return <Card className="border-dashed bg-card/40">{inner}</Card>;
}

export default ErrorState;
