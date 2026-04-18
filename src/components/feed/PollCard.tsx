import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ReactionBar } from "./ReactionBar";
import { ReplyThread } from "./ReplyThread";
import { FeedItemMenu } from "./FeedItemMenu";

interface PollCardProps {
  poll: {
    id: string;
    title: string;
    description: string | null;
    options: any;
    created_at: string;
    is_active: boolean;
    created_by?: string | null;
  };
  onRefresh?: () => void;
}

export function PollCard({ poll, onRefresh }: PollCardProps) {
  const { user } = useAuth();
  const [votes, setVotes] = useState<{ option_index: number; user_id: string }[]>([]);
  const [myVote, setMyVote] = useState<number | null>(null);

  const options = Array.isArray(poll.options) ? poll.options : [];

  const fetchVotes = async () => {
    const { data } = await supabase
      .from("poll_votes")
      .select("option_index, user_id")
      .eq("poll_id", poll.id);
    if (data) {
      setVotes(data);
      const mine = data.find((v) => v.user_id === user?.id);
      setMyVote(mine ? mine.option_index : null);
    }
  };

  useEffect(() => { fetchVotes(); }, [poll.id]);

  const castVote = async (idx: number) => {
    if (!user || !poll.is_active) return;
    if (myVote !== null) {
      await supabase
        .from("poll_votes")
        .update({ option_index: idx })
        .eq("poll_id", poll.id)
        .eq("user_id", user.id);
    } else {
      await supabase.from("poll_votes").insert({
        poll_id: poll.id,
        user_id: user.id,
        option_index: idx,
      });
    }
    fetchVotes();
  };

  const totalVotes = votes.length;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <Badge variant="secondary" className="text-[10px] gap-1 bg-violet-500/10 text-violet-600 dark:text-violet-400">
          <BarChart3 className="h-3 w-3" />
          Poll
        </Badge>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(poll.created_at), { addSuffix: true })}
          </span>
          <FeedItemMenu table="polls" id={poll.id} authorId={poll.created_by} label="poll" onDeleted={onRefresh} />
        </div>
      </div>

      <h3 className="font-semibold text-sm">{poll.title}</h3>
      {poll.description && <p className="text-xs text-muted-foreground">{poll.description}</p>}

      <div className="space-y-2">
        {options.map((opt: string, idx: number) => {
          const count = votes.filter((v) => v.option_index === idx).length;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isSelected = myVote === idx;

          return (
            <button
              key={idx}
              onClick={() => castVote(idx)}
              disabled={!poll.is_active}
              className={`w-full relative rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
              }`}
            >
              <div
                className="absolute inset-0 rounded-lg bg-primary/10 transition-all"
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex justify-between">
                <span>{opt}</span>
                <span className="text-xs text-muted-foreground">{pct}%</span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</p>

      <ReactionBar entityType="poll" entityId={poll.id} />
      <ReplyThread entityType="poll" entityId={poll.id} />
    </div>
  );
}
