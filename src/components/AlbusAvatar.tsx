import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";

interface Props {
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
}

const sizeClasses: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-5 w-5 text-xs",
  md: "h-6 w-6 text-sm",
  lg: "h-8 w-8 text-base",
  xl: "h-10 w-10 text-lg",
  "2xl": "h-12 w-12 text-2xl",
};

/**
 * Albus's visual identity. Renders the workspace-configured avatar image when set;
 * otherwise falls back to the wizard emoji on a soft primary background.
 */
export function AlbusAvatar({ size = "md", className }: Props) {
  const { albusAvatarUrl } = useWorkspace();
  const cls = sizeClasses[size];

  if (albusAvatarUrl) {
    return (
      <img
        src={albusAvatarUrl}
        alt="Albus"
        className={cn("rounded-full object-cover shrink-0", cls, className)}
      />
    );
  }
  return (
    <div className={cn("rounded-full bg-primary/10 flex items-center justify-center shrink-0", cls, className)}>
      🧙‍♂️
    </div>
  );
}
