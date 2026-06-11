import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Props {
  name?: string | null;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}

/**
 * Drop-in avatar that shows the profile photo when available and falls
 * back to initials. Use this instead of raw <Avatar> + <AvatarFallback>
 * so photos render consistently across the whole app.
 */
export function UserAvatar({ name, avatarUrl, className, fallbackClassName }: Props) {
  const initials = (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("");

  return (
    <Avatar className={className}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name ?? ""} />}
      <AvatarFallback className={cn(fallbackClassName)}>{initials}</AvatarFallback>
    </Avatar>
  );
}
