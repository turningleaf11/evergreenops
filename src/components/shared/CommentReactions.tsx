import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SmilePlus } from "lucide-react";
import { cn } from "@/lib/utils";

const EMOJI_OPTIONS = ["👍", "❤️", "🤜", "🔥", "💪", "😂", "🤗", "🚀"];

interface Group {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

interface Props {
  commentId: string;
}

/** Reaction bar for comments — stored in `comment_reactions` table. */
export function CommentReactions({ commentId }: Props) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<Group[]>([]);
  const [open, setOpen] = useState(false);

  const fetchReactions = useCallback(async () => {
    const { data } = await supabase
      .from("comment_reactions" as any)
      .select("emoji, user_id")
      .eq("comment_id", commentId);
    if (!data) return;
    const grouped: Record<string, { count: number; hasReacted: boolean }> = {};
    (data as any[]).forEach((r) => {
      if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, hasReacted: false };
      grouped[r.emoji].count++;
      if (r.user_id === user?.id) grouped[r.emoji].hasReacted = true;
    });
    setReactions(Object.entries(grouped).map(([emoji, g]) => ({ emoji, ...g })));
  }, [commentId, user?.id]);

  useEffect(() => { fetchReactions(); }, [fetchReactions]);

  const toggle = async (emoji: string) => {
    if (!user) return;
    const existing = reactions.find((r) => r.emoji === emoji && r.hasReacted);
    if (existing) {
      await supabase
        .from("comment_reactions" as any)
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", user.id)
        .eq("emoji", emoji);
    } else {
      await supabase.from("comment_reactions" as any).insert({
        comment_id: commentId,
        user_id: user.id,
        emoji,
      } as any);
    }
    fetchReactions();
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => toggle(r.emoji)}
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] border transition-colors",
            r.hasReacted
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
          )}
        >
          <span>{r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
            title="Add reaction"
          >
            <SmilePlus className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1.5" align="start">
          <div className="flex gap-0.5">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                onClick={() => toggle(e)}
                className="text-base hover:scale-125 transition-transform p-1"
              >
                {e}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
