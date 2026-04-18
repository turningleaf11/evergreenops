import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ReactionBar } from "./ReactionBar";
import { ReplyThread } from "./ReplyThread";
import { FeedItemMenu } from "./FeedItemMenu";

const CATEGORY_LABELS: Record<string, string> = {
  great_work: "🌟 Great Work",
  team_player: "🤝 Team Player",
  innovation: "💡 Innovation",
  leadership: "👑 Leadership",
};

interface KudosCardProps {
  kudo: {
    id: string;
    from_user_id: string;
    to_user_id: string;
    message: string;
    category: string;
    created_at: string;
  };
  onRefresh?: () => void;
}

export function KudosCard({ kudo, onRefresh }: KudosCardProps) {
  const [fromName, setFromName] = useState("");
  const [toName, setToName] = useState("");

  useEffect(() => {
    const fetchNames = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", [kudo.from_user_id, kudo.to_user_id]);
      if (data) {
        setFromName(data.find((p) => p.user_id === kudo.from_user_id)?.full_name || "Someone");
        setToName(data.find((p) => p.user_id === kudo.to_user_id)?.full_name || "Someone");
      }
    };
    fetchNames();
  }, [kudo.from_user_id, kudo.to_user_id]);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 border-l-4 border-l-pink-400">
      <div className="flex items-start justify-between gap-2">
        <Badge variant="secondary" className="text-[10px] gap-1 bg-pink-500/10 text-pink-600 dark:text-pink-400">
          <Heart className="h-3 w-3" />
          Kudos
        </Badge>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(kudo.created_at), { addSuffix: true })}
          </span>
          <FeedItemMenu table="kudos" id={kudo.id} authorId={kudo.from_user_id} label="kudos" onDeleted={onRefresh} />
        </div>
      </div>

      <div>
        <p className="text-sm">
          <span className="font-medium">{fromName}</span>
          {" → "}
          <span className="font-medium">{toName}</span>
        </p>
        {kudo.message && <p className="text-sm text-muted-foreground mt-1">{kudo.message}</p>}
      </div>

      <Badge variant="outline" className="text-[10px]">
        {CATEGORY_LABELS[kudo.category] || kudo.category}
      </Badge>

      <ReactionBar entityType="kudos" entityId={kudo.id} />
      <ReplyThread entityType="kudos" entityId={kudo.id} />
    </div>
  );
}
