import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Heart, Sparkles, Star, Users, Lightbulb, Trophy, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ReactionBar } from "./ReactionBar";
import { ReplyThread } from "./ReplyThread";
import { FeedItemMenu } from "./FeedItemMenu";

const CATEGORY_META: Record<string, { icon: typeof Star; label: string; color: string; emoji: string }> = {
  great_work: { icon: Star, label: "Great Work", color: "from-amber-400 to-orange-500", emoji: "🌟" },
  team_player: { icon: Users, label: "Team Player", color: "from-sky-400 to-blue-500", emoji: "🤝" },
  innovation: { icon: Lightbulb, label: "Innovation", color: "from-violet-400 to-fuchsia-500", emoji: "💡" },
  leadership: { icon: Trophy, label: "Leadership", color: "from-emerald-400 to-teal-500", emoji: "👑" },
};

const CONFETTI_COLORS = [
  "hsl(330 90% 65%)", "hsl(45 95% 60%)", "hsl(200 90% 60%)",
  "hsl(280 85% 65%)", "hsl(150 75% 55%)", "hsl(15 90% 65%)",
];

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
  const [repliesExpanded, setRepliesExpanded] = useState(false);
  const [replyCount, setReplyCount] = useState(0);

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

  const meta = CATEGORY_META[kudo.category] || CATEGORY_META.great_work;
  const Icon = meta.icon;
  const initials = (n: string) => n.split(" ").map((x) => x[0]).slice(0, 2).join("");

  return (
    <div className="kudos-card rounded-2xl p-5 space-y-4">
      {/* Confetti rain */}
      {CONFETTI_COLORS.map((c, i) => (
        <span
          key={i}
          className="kudos-confetti"
          style={{
            background: c,
            left: `${10 + i * 14}%`,
            top: "-6px",
            animationDelay: `${i * 0.35}s`,
            animationDuration: `${2.4 + (i % 3) * 0.4}s`,
          }}
        />
      ))}

      {/* Floating sparkles */}
      <Sparkles className="kudos-sparkle h-4 w-4 text-amber-400" style={{ top: "10%", right: "8%", animationDelay: "0s" }} />
      <Sparkles className="kudos-sparkle h-3 w-3 text-pink-400" style={{ top: "60%", right: "4%", animationDelay: "1.2s" }} />
      <Sparkles className="kudos-sparkle h-3 w-3 text-violet-400" style={{ bottom: "20%", left: "5%", animationDelay: "0.6s" }} />

      <div className="relative flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 shadow-lg shadow-pink-500/40">
            <Heart className="kudos-heart h-4 w-4 text-white fill-white" />
          </span>
          <span className="text-sm font-bold bg-gradient-to-r from-pink-500 via-fuchsia-500 to-amber-500 bg-clip-text text-transparent uppercase tracking-wide">
            Kudos
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(kudo.created_at), { addSuffix: true })}
          </span>
          <FeedItemMenu table="kudos" id={kudo.id} authorId={kudo.from_user_id} label="kudos" onDeleted={onRefresh} />
        </div>
      </div>

      {/* Centerpiece — celebrating WHO */}
      <div className="relative flex items-center justify-center gap-4 py-2">
        <div className="flex flex-col items-center gap-1">
          <Avatar className="h-12 w-12 ring-2 ring-border">
            <AvatarFallback className="text-xs bg-muted">{initials(fromName)}</AvatarFallback>
          </Avatar>
          <span className="text-[10px] text-muted-foreground">{fromName}</span>
        </div>

        <div className="flex flex-col items-center">
          <Heart className="kudos-heart h-5 w-5 text-pink-500 fill-pink-500" />
          <span className="text-[9px] text-muted-foreground mt-0.5">recognized</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="kudos-avatar-ring">
            <Avatar className="h-14 w-14 border-2 border-card">
              <AvatarFallback className={`text-sm font-bold text-white bg-gradient-to-br ${meta.color}`}>
                {initials(toName)}
              </AvatarFallback>
            </Avatar>
          </div>
          <span className="text-xs font-semibold bg-gradient-to-r from-pink-500 to-fuchsia-500 bg-clip-text text-transparent">
            {toName}
          </span>
        </div>
      </div>

      {/* Message */}
      {kudo.message && (
        <blockquote className="relative text-sm text-center italic text-foreground/90 px-4 leading-relaxed">
          <span className="text-2xl text-pink-400/40 absolute -top-1 left-2 font-serif">"</span>
          {kudo.message.replace(/<[^>]*>/g, "").trim()}
          <span className="text-2xl text-pink-400/40 absolute -bottom-3 right-2 font-serif">"</span>
        </blockquote>
      )}

      {/* Category badge */}
      <div className="relative flex justify-center">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${meta.color} shadow-md`}>
          <Icon className="h-3 w-3 fill-white" /> {meta.label}
        </span>
      </div>

      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <ReactionBar entityType="kudos" entityId={kudo.id} />
          </div>
          <button
            onClick={() => setRepliesExpanded(!repliesExpanded)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 px-2 py-1 rounded-md transition-colors shrink-0"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span>Comment{replyCount > 0 ? ` (${replyCount})` : ""}</span>
            {repliesExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
        {repliesExpanded && (
          <div className="mt-3">
            <ReplyThread entityType="kudos" entityId={kudo.id} onCountChange={setReplyCount} />
          </div>
        )}
      </div>
    </div>
  );
}
