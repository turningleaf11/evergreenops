import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTraining } from "@/contexts/TrainingContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertTriangle, ArrowRight, Heart } from "lucide-react";
import { differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

type Sentiment = "great" | "good" | "neutral" | "concerned" | "critical";
type Health = "green" | "yellow" | "red";

interface Profile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  start_date: string | null;
  created_at: string | null;
}
interface OneOnOne {
  employee_id: string;
  meeting_date: string;
  sentiment: Sentiment;
}

function computeHealth(args: {
  daysSince: number | null;
  sentiment: Sentiment | null;
  onboardingPct: number;
  accountDays: number | null;
}): Health {
  const onboardingIncomplete = args.onboardingPct < 100;
  const accountOld = args.accountDays !== null && args.accountDays > 30;
  if (onboardingIncomplete && accountOld) return "red";
  if (args.daysSince !== null && args.daysSince > 30) return "red";
  if (args.sentiment === "critical") return "red";
  if (args.daysSince !== null && args.daysSince >= 15 && args.daysSince <= 30) return "yellow";
  if (args.sentiment === "concerned") return "yellow";
  if (onboardingIncomplete && !accountOld) return "yellow";
  return "green";
}

export function TeamHealthWidget() {
  const { onboardingSteps } = useTraining();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [oneOnOnes, setOneOnOnes] = useState<OneOnOne[]>([]);
  const [snapshots, setSnapshots] = useState<Array<{ employee_id: string; onboarding_progress_pct: number; snapshot_date: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [pRes, ooRes, snapRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, start_date, created_at"),
        supabase
          .from("one_on_ones")
          .select("employee_id, meeting_date, sentiment")
          .order("meeting_date", { ascending: false }),
        supabase
          .from("people_health_snapshots")
          .select("employee_id, onboarding_progress_pct, snapshot_date")
          .order("snapshot_date", { ascending: false }),
      ]);
      if (cancelled) return;
      setProfiles((pRes.data as Profile[]) || []);
      setOneOnOnes((ooRes.data as OneOnOne[]) || []);
      setSnapshots((snapRes.data as any) || []);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel("team-health-widget")
      .on("postgres_changes", { event: "*", schema: "public", table: "one_on_ones" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "people_health_snapshots" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const rows = useMemo(() => {
    const onboardingByUser = new Map<string, number>();
    for (const s of snapshots) {
      if (!onboardingByUser.has(s.employee_id)) onboardingByUser.set(s.employee_id, s.onboarding_progress_pct);
    }
    const totalSteps = onboardingSteps.length;
    return profiles.map((p) => {
      const myOO = oneOnOnes.filter((o) => o.employee_id === p.user_id);
      const last = myOO[0] || null;
      const daysSince = last ? differenceInDays(new Date(), new Date(last.meeting_date)) : null;
      const onboardingPct = onboardingByUser.get(p.user_id) ?? (totalSteps === 0 ? 100 : 100);
      const accountDate = p.start_date || p.created_at || null;
      const accountDays = accountDate ? differenceInDays(new Date(), new Date(accountDate)) : null;
      const health = computeHealth({
        daysSince,
        sentiment: last?.sentiment ?? null,
        onboardingPct,
        accountDays,
      });
      return { profile: p, health };
    });
  }, [profiles, oneOnOnes, snapshots, onboardingSteps]);

  const reds = rows.filter((r) => r.health === "red").length;

  const dotClass = (h: Health) =>
    h === "green" ? "bg-emerald-500" : h === "yellow" ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 p-6 elevation-1">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Heart className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Team Health</h2>
        </div>
        <Link
          to="/people?tab=people-ops"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View People Ops <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {reds > 0 && (
        <Link
          to="/people?tab=people-ops"
          className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-700 dark:text-red-400 hover:bg-red-500/10 transition-colors mb-3"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">
            {reds} team member{reds === 1 ? "" : "s"} need{reds === 1 ? "s" : ""} attention
          </span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No team members yet.</p>
      ) : (
        <div className="space-y-1">
          {rows.map(({ profile, health }) => {
            const initials = (profile.full_name || "U")
              .split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
            return (
              <Link
                key={profile.user_id}
                to="/people?tab=people-ops"
                className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors"
              >
                <Avatar className="h-6 w-6">
                  {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
                  <AvatarFallback className="text-[10px] bg-muted">{initials}</AvatarFallback>
                </Avatar>
                <span className="text-sm flex-1 truncate">{profile.full_name || "Unnamed"}</span>
                <span
                  className={cn("h-2 w-2 rounded-full shrink-0", dotClass(health))}
                  title={health}
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
