import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Megaphone, Users, Sparkles, CalendarDays } from "lucide-react";
import { format } from "date-fns";

interface Stat {
  icon: React.ElementType;
  value: number | string;
  label: string;
  tone: string;
}

interface PulseStripProps {
  greeting: string;
  subline?: string;
}

function getGreeting(name?: string | null): string {
  const hour = new Date().getHours();
  const first = name?.split(" ")[0] || "there";
  if (hour < 5) return `Still up, ${first}?`;
  if (hour < 12) return `Good morning, ${first}`;
  if (hour < 17) return `Good afternoon, ${first}`;
  if (hour < 21) return `Good evening, ${first}`;
  return `Working late, ${first}?`;
}

export function PulseStrip({ name }: { name?: string | null }) {
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
        { icon: Heart,      value: kudosRes.count ?? 0,  label: "kudos this week",     tone: "text-rose-500" },
        { icon: Megaphone,  value: annRes.count ?? 0,    label: "announcements",       tone: "text-amber-500" },
        { icon: Sparkles,   value: postRes.count ?? 0,   label: "posts today",         tone: "text-sky-500" },
        { icon: Users,      value: peopleRes.count ?? 0, label: "teammates",           tone: "text-emerald-500" },
      ]);
    };
    load();
  }, []);

  const greeting = getGreeting(name);
  const dateStr = format(new Date(), "EEEE, MMMM d");

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-card via-card to-muted/30 p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1.5">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{greeting}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> {dateStr}
          </p>
        </div>

        {stats.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex items-center gap-2.5">
                  <div className={`h-9 w-9 rounded-xl bg-background/60 border flex items-center justify-center ${s.tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="leading-tight">
                    <div className="text-lg font-semibold tabular-nums">{s.value}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
