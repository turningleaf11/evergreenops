import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SmilePlus } from "lucide-react";

const EMOJI_OPTIONS = ["👍", "❤️", "🎉", "🔥", "👏", "💡", "😂", "🙌"];

interface ReactionBarProps {
  entityType: string;
  entityId: string;
}

interface ReactionGroup {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

export function ReactionBar({ entityType, entityId }: ReactionBarProps) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<ReactionGroup[]>([]);
  const [open, setOpen] = useState(false);

  const fetchReactions = async () => {
    const { data } = await supabase
      .from("post_reactions")
      .select("emoji, user_id")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);
    if (!data) return;

    const grouped: Record<string, { count: number; hasReacted: boolean }> = {};
    data.forEach((r) => {
      if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, hasReacted: false };
      grouped[r.emoji].count++;
      if (r.user_id === user?.id) grouped[r.emoji].hasReacted = true;
    });
    setReactions(
      Object.entries(grouped).map(([emoji, g]) => ({ emoji, ...g }))
    );
  };

  useEffect(() => { fetchReactions(); }, [entityType, entityId]);

  const toggleReaction = async (emoji: string) => {
    if (!user) return;
    const existing = reactions.find((r) => r.emoji === emoji && r.hasReacted);
    if (existing) {
      await supabase
        .from("post_reactions")
        .delete()
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .eq("user_id", user.id)
        .eq("emoji", emoji);
    } else {
      await supabase.from("post_reactions").insert({
        entity_type: entityType,
        entity_id: entityId,
        user_id: user.id,
        emoji,
      });
    }
    fetchReactions();
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => toggleReaction(r.emoji)}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
            r.hasReacted
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
          }`}
        >
          <span>{r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
            <SmilePlus className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex gap-1">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                onClick={() => toggleReaction(e)}
                className="text-lg hover:scale-125 transition-transform p-1"
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
