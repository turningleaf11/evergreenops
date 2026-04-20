import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Megaphone, Users, Sparkles } from "lucide-react";

interface Stat {
  icon: React.ElementType;
  value: number | string;
  label: string;
  iconClass: string;
  tileClass: string;
}

export function PulseStrip() {
  const [stats, setStats] = useState<Stat[]>([]);

  useEffect(() => {
    const load = async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

      const [kudosRes, annRes, postRes, peopleRes] = await Promise.all([
        supabase.from("kudos").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
        supabase.from("announcements").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
        supabase.from("posts").select("id", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);

      setStats([
        { icon: Heart,     value: kudosRes.count ?? 0,  label: "kudos this week", iconClass: "text-rose-500",    tileClass: "bg-rose-500/[0.06]" },
        { icon: Megaphone, value: annRes.count ?? 0,    label: "announcements",   iconClass: "text-amber-500",   tileClass: "bg-amber-500/[0.06]" },
        { icon: Sparkles,  value: postRes.count ?? 0,   label: "posts today",     iconClass: "text-sky-500",     tileClass: "bg-sky-500/[0.06]" },
        { icon: Users,     value: peopleRes.count ?? 0, label: "teammates",       iconClass: "text-emerald-500", tileClass: "bg-emerald-500/[0.06]" },
      ]);
    };
    load();
  }, []);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm h-full">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 h-full">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className={`relative flex flex-col justify-between rounded-xl border border-border/40 ${s.tileClass} p-4 transition-all hover:shadow-sm`}
            >
              <div className={`h-9 w-9 rounded-lg bg-background/80 border border-border/40 flex items-center justify-center ${s.iconClass}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-semibold tabular-nums leading-none">{s.value}</div>
                <div className="mt-1 text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</div>
              </div>
            </div>
          );
        })}
        {stats.length === 0 && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/40 bg-muted/20 p-4 h-24 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
