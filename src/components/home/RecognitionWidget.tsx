import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Button } from "@/components/ui/button";
import { Heart, ArrowRight, Plus, Sparkles, Star, Users, Lightbulb, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface RecognitionWidgetProps {
  onGiveKudos?: () => void;
}

const CATEGORY_META: Record<string, { icon: typeof Star; label: string; color: string }> = {
  great_work: { icon: Star, label: "Great Work", color: "from-amber-400 to-orange-500" },
  team_player: { icon: Users, label: "Team Player", color: "from-sky-400 to-blue-500" },
  innovation: { icon: Lightbulb, label: "Innovation", color: "from-violet-400 to-fuchsia-500" },
  leadership: { icon: Trophy, label: "Leadership", color: "from-emerald-400 to-teal-500" },
};

const CONFETTI_COLORS = [
  "hsl(330 90% 65%)", "hsl(45 95% 60%)", "hsl(200 90% 60%)",
  "hsl(280 85% 65%)", "hsl(150 75% 55%)", "hsl(15 90% 65%)",
];

export function RecognitionWidget({ onGiveKudos }: RecognitionWidgetProps) {
  const [items, setItems] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const load = async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [kudosRes, profRes] = await Promise.all([
        supabase
          .from("kudos")
          .select("id, from_user_id, to_user_id, message, category, created_at")
          .gte("created_at", sevenDaysAgo)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase.from("profiles").select("user_id, full_name, avatar_url"),
      ]);
      if (kudosRes.data) setItems(kudosRes.data);
      if (profRes.data) {
        const map: Record<string, string> = {};
        const urlMap: Record<string, string | null> = {};
        profRes.data.forEach((p: any) => { map[p.user_id] = p.full_name || "Teammate"; urlMap[p.user_id] = p.avatar_url || null; });
        setProfiles(map);
        setAvatarUrls(urlMap);
      }
    };
    load();
  }, []);

  const initials = (name: string) => name.split(" ").map((n) => n[0]).slice(0, 2).join("");

  return (
    <div className="kudos-card rounded-2xl p-4 space-y-3">
      {/* Floating sparkles */}
      <Sparkles className="kudos-sparkle h-3 w-3 text-amber-400" style={{ top: "8%", right: "12%", animationDelay: "0s" }} />
      <Sparkles className="kudos-sparkle h-2.5 w-2.5 text-pink-400" style={{ top: "55%", right: "6%", animationDelay: "1.2s" }} />
      <Sparkles className="kudos-sparkle h-2 w-2 text-violet-400" style={{ bottom: "15%", left: "8%", animationDelay: "0.6s" }} />

      <div className="relative flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 shadow-lg shadow-pink-500/30">
            <Heart className="kudos-heart h-3.5 w-3.5 text-white fill-white" />
          </span>
          <span className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-amber-500 bg-clip-text text-transparent">
            Recognition
          </span>
        </h2>
        <Link to="/feed" className="text-xs text-primary hover:underline flex items-center gap-1">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <Button
        size="sm"
        className="relative w-full h-9 text-xs gap-1.5 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-amber-500 hover:opacity-90 text-white border-0 shadow-md shadow-pink-500/20"
        onClick={onGiveKudos}
      >
        <Sparkles className="h-3.5 w-3.5" /> Give Kudos
      </Button>

      {items.length === 0 ? (
        <div className="relative py-4 text-center">
          <Heart className="kudos-heart h-7 w-7 text-pink-400/60 mx-auto mb-1.5" />
          <p className="text-xs text-muted-foreground">No kudos this week — be the first 💛</p>
        </div>
      ) : (
        <div className="relative space-y-2.5">
          {items.map((k, idx) => {
            const fromName = profiles[k.from_user_id] || "Someone";
            const toName = profiles[k.to_user_id] || "a teammate";
            const meta = CATEGORY_META[k.category] || CATEGORY_META.great_work;
            const Icon = meta.icon;
            return (
              <div
                key={k.id}
                className="relative flex items-start gap-2.5 rounded-xl bg-card/60 backdrop-blur-sm border border-border/50 p-2.5 hover:bg-card/80 transition-colors"
              >
                <div className="relative shrink-0">
                  <div className="kudos-avatar-ring">
                    <UserAvatar name={fromName} avatarUrl={avatarUrls[k.from_user_id]} className={`h-8 w-8 border-2 border-card`} fallbackClassName={`text-[10px] text-white bg-gradient-to-br ${meta.color}`} />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center ring-2 ring-card">
                    <Icon className="h-2 w-2 text-white fill-white" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-snug">
                    <span className="font-semibold">{fromName}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span className="font-semibold bg-gradient-to-r from-pink-500 to-fuchsia-500 bg-clip-text text-transparent">{toName}</span>
                  </p>
                  {k.message && (
                    <p className="text-xs text-foreground/80 italic mt-0.5 line-clamp-2">
                      "{k.message.replace(/<[^>]*>/g, "").trim()}"
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    {formatDistanceToNow(new Date(k.created_at), { addSuffix: true })}
                  </p>
                </div>
                {/* Confetti per item */}
                {idx === 0 && (
                  <>
                    {CONFETTI_COLORS.slice(0, 4).map((c, i) => (
                      <span
                        key={i}
                        className="kudos-confetti"
                        style={{
                          background: c,
                          left: `${20 + i * 18}%`,
                          top: "-4px",
                          animationDelay: `${i * 0.4}s`,
                        }}
                      />
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
