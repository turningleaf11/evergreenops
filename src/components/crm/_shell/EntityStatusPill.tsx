import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { resolveStatus, type RegistryKind } from "./statusRegistry";

/**
 * Single, unified status pill used by every CRM detail sheet's identity strip
 * and inline labeling. Three visual styles are available; default is `solid`
 * (filled tinted background) which matches the existing Contact "type" pill
 * — the most common form in the app today.
 */
export function EntityStatusPill({
  kind,
  value,
  variant = "solid",
  className,
}: {
  kind: RegistryKind;
  value: string | null | undefined;
  variant?: "solid" | "outline";
  className?: string;
}) {
  const { color, label } = resolveStatus(kind, value);
  if (!value) return null;

  if (variant === "outline") {
    return (
      <Badge
        variant="outline"
        className={cn("text-[10px] capitalize border", className)}
        style={{
          borderColor: `hsl(${color})`,
          color: `hsl(${color})`,
        }}
      >
        {label}
      </Badge>
    );
  }

  return (
    <Badge
      className={cn("text-[10px] border-transparent capitalize", className)}
      style={{
        backgroundColor: `hsl(${color} / 0.15)`,
        color: `hsl(${color})`,
      }}
    >
      {label}
    </Badge>
  );
}
