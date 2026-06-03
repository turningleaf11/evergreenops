// AvatarStack — overlapping circle avatars with "+N" overflow.
// The canonical way to show "who's on this thing" anywhere in the app.
//
// Usage:
//   <AvatarStack people={assignees} max={4} size="md" />
//
// All people pickers, card footers, and detail headers should use this.

import { cn } from "@/lib/utils";

export interface AvatarStackPerson {
  user_id: string;
  full_name: string | null;
  avatar_url?: string | null;
}

interface Props {
  people: AvatarStackPerson[];
  /** How many avatars to show before collapsing to +N. Default: 4. */
  max?: number;
  /** Avatar size: sm (18px) / md (22px) / lg (28px). Default: md. */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { px: 18, text: "text-[8px]"  },
  md: { px: 22, text: "text-[9px]"  },
  lg: { px: 28, text: "text-[10px]" },
} as const;

function initials(name: string | null) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AvatarStack({ people, max = 4, size = "md", className }: Props) {
  if (!people || people.length === 0) return null;
  const { px, text } = SIZES[size];
  const shown = people.slice(0, max);
  const extra = Math.max(0, people.length - max);

  return (
    <div className={cn("flex -space-x-1.5 shrink-0", className)}>
      {shown.map((p) => {
        const title = p.full_name || "Unnamed";
        return p.avatar_url ? (
          <img
            key={p.user_id}
            src={p.avatar_url}
            alt={title}
            title={title}
            className="rounded-full ring-2 ring-background object-cover"
            style={{ width: px, height: px }}
          />
        ) : (
          <div
            key={p.user_id}
            title={title}
            className={cn(
              "rounded-full ring-2 ring-background bg-primary/15 text-primary font-semibold flex items-center justify-center",
              text,
            )}
            style={{ width: px, height: px }}
          >
            {initials(p.full_name)}
          </div>
        );
      })}
      {extra > 0 && (
        <div
          className={cn(
            "rounded-full ring-2 ring-background bg-muted text-muted-foreground font-medium flex items-center justify-center",
            text,
          )}
          style={{ width: px, height: px }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}
