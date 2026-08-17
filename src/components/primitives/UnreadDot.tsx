import { cn } from "@/lib/utils";

/** A small filled dot marking unread activity on a task/project — same
    leading-dot convention as Gmail/Slack unread markers. */
export function UnreadDot({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full bg-primary shrink-0", className)}
      title="Unread activity"
    />
  );
}
