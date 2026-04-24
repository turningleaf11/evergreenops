import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTraining } from "@/contexts/TrainingContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Users, Heart, Calendar } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

type Sentiment = "great" | "good" | "neutral" | "concerned" | "critical";
type Health = "green" | "yellow" | "red";

interface Profile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  department_id: string | null;
  title: string | null;
  start_date?: string | null;
  created_at?: string | null;
}

interface OneOnOne {
  employee_id: string;
  meeting_date: string;
  sentiment: Sentiment;
  action_items: Array<{ text: string; completed: boolean }>;
}

interface Row {
  profile: Profile;
  deptName?: string;
  onboardingPct: number;
  onboardingComplete: boolean;
  lastOneOnOne: string | null;
  daysSince: number | null;
  sentiment: Sentiment | null;
  openActionItems: number;
  kudos30: number;
  health: Health;
}

interface Props {
  profiles: Profile[];
  departments: Array<{ id: string; name: string }>;
  onSelect: (p: Profile) => void;
}

const sentimentColor: Record<Sentiment, string> = {
  great: "bg-emerald-500",
  good: "bg-teal-500",
  neutral: "bg-muted-foreground/40",
  concerned: "bg-amber-500",
  critical: "bg-red-500",
};

const sentimentLabel: Record<Sentiment, string> = {
  great: "Great",
  good: "Good",
  neutral: "Neutral",
  concerned: "Concerned",
  critical: "Critical",
};

function computeHealth(r: Omit<Row, "health"> & { accountDays: number | null }): Health {
  const onboardingIncomplete = r.onboardingPct < 100;
  const accountOld = r.accountDays !== null && r.accountDays > 30;

  // RED conditions
  if (onboardingIncomplete && accountOld) return "red";
  if (r.daysSince !== null && r.daysSince > 30) return "red";
  if (r.sentiment === "critical") return "red";

  // YELLOW conditions
  if (r.daysSince !== null && r.daysSince >= 15 && r.daysSince <= 30) return "yellow";
  if (r.sentiment === "concerned") return "yellow";
  if (onboardingIncomplete && !accountOld) return "yellow";

  return "green";
}

export function PeopleOpsTab({ profiles, departments, onSelect }: Props) {
  const { onboardingSteps } = useTraining();
  const [oneOnOnes, setOneOnOnes] = useState<OneOnOne[]>([]);
  const [kudos, setKudos] = useState<Array<{ to_user_id: string; created_at: string }>>([]);
  const [snapshots, setSnapshots] = useState<Array<{ employee_id: string; onboarding_progress_pct: number; snapshot_date: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const [ooRes, kRes, snapRes] = await Promise.all([
        supabase
          .from("one_on_ones")
          .select("employee_id, meeting_date, sentiment, action_items")
          .order("meeting_date", { ascending: false }),
        supabase
          .from("kudos")
          .select("to_user_id, created_at")
          .gte("created_at", since.toISOString()),
        supabase
          .from("people_health_snapshots")
          .select("employee_id, onboarding_progress_pct, snapshot_date")
          .order("snapshot_date", { ascending: false }),
      ]);
      if (cancelled) return;
      setOneOnOnes((ooRes.data as OneOnOne[]) || []);
      setKudos(kRes.data || []);
      setSnapshots((snapRes.data as any) || []);
      setLoading(false);
    };
    load();

    // Realtime: refresh on any change to underlying tables
    const channel = supabase
      .channel("people-ops-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "one_on_ones" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "kudos" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "people_health_snapshots" }, load)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // Latest onboarding % per employee from snapshots (if any).
  const onboardingByUser = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of snapshots) {
      if (!map.has(s.employee_id)) map.set(s.employee_id, s.onboarding_progress_pct);
    }
    return map;
  }, [snapshots]);

  const totalOnboardingSteps = onboardingSteps.length;

  const rows: Row[] = useMemo(() => {
    return profiles.map((p) => {
      const dept = departments.find((d) => d.id === p.department_id);
      const myOO = oneOnOnes.filter((o) => o.employee_id === p.user_id);
      const last = myOO[0] || null;
      const daysSince = last ? differenceInDays(new Date(), new Date(last.meeting_date)) : null;
      const openActionItems = myOO.reduce((sum, o) => {
        const items = Array.isArray(o.action_items) ? o.action_items : [];
        return sum + items.filter((i) => i && !i.completed).length;
      }, 0);
      const kudos30 = kudos.filter((k) => k.to_user_id === p.user_id).length;

      // Onboarding % — use snapshot if present, else assume complete when no steps defined.
      const snapPct = onboardingByUser.get(p.user_id);
      const onboardingPct = snapPct !== undefined ? snapPct : (totalOnboardingSteps === 0 ? 100 : 100);
      const onboardingComplete = onboardingPct >= 100;

      // Account age: prefer start_date, fall back to created_at.
      const accountDate = p.start_date || p.created_at || null;
      const accountDays = accountDate ? differenceInDays(new Date(), new Date(accountDate)) : null;

      const partial = {
        profile: p,
        deptName: dept?.name,
        onboardingPct,
        onboardingComplete,
        lastOneOnOne: last?.meeting_date ?? null,
        daysSince,
        sentiment: last?.sentiment ?? null,
        openActionItems,
        kudos30,
      };
      return { ...partial, health: computeHealth({ ...partial, accountDays }) };
    });
  }, [profiles, departments, oneOnOnes, kudos, onboardingByUser, totalOnboardingSteps]);

  const summary = useMemo(() => {
    const total = rows.length;
    const greens = rows.filter((r) => r.health === "green").length;
    const reds = rows.filter((r) => r.health === "red").length;
    const withOO = rows.filter((r) => r.daysSince !== null);
    const avgDays = withOO.length
      ? Math.round(withOO.reduce((s, r) => s + (r.daysSince || 0), 0) / withOO.length)
      : null;
    return {
      total,
      greenPct: total ? Math.round((greens / total) * 100) : 0,
      reds,
      avgDays,
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={<Users className="h-4 w-4" />} label="Team members" value={String(summary.total)} />
        <SummaryCard
          icon={<Heart className="h-4 w-4 text-emerald-500" />}
          label="In green health"
          value={`${summary.greenPct}%`}
        />
        <SummaryCard
          icon={<AlertTriangle className={cn("h-4 w-4", summary.reds > 0 ? "text-red-500" : "text-muted-foreground")} />}
          label="Needs attention"
          value={String(summary.reds)}
          alert={summary.reds > 0}
        />
        <SummaryCard
          icon={<Calendar className="h-4 w-4" />}
          label="Avg days since 1:1"
          value={summary.avgDays === null ? "—" : `${summary.avgDays}d`}
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="hidden md:grid grid-cols-[2fr_1.2fr_1.2fr_1.5fr_1fr_0.8fr_0.8fr_1fr] gap-3 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground border-b">
            <div>Person</div>
            <div>Role</div>
            <div>Onboarding</div>
            <div>Last 1:1</div>
            <div>Sentiment</div>
            <div className="text-center">Open</div>
            <div className="text-center">Kudos 30d</div>
            <div className="text-right">Health</div>
          </div>
          <div className="divide-y">
            {loading && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
            )}
            {!loading && rows.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No team members yet.</div>
            )}
            {!loading && rows.map((r) => {
              const initials = (r.profile.full_name || "U")
                .split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
              return (
                <button
                  key={r.profile.user_id}
                  onClick={() => onSelect(r.profile)}
                  className="w-full text-left grid grid-cols-2 md:grid-cols-[2fr_1.2fr_1.2fr_1.5fr_1fr_0.8fr_0.8fr_1fr] gap-3 px-4 py-3 hover:bg-muted/40 transition-colors items-center min-h-[60px]"
                >
                  {/* Person */}
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-8 w-8">
                      {r.profile.avatar_url && <AvatarImage src={r.profile.avatar_url} />}
                      <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.profile.full_name || "Unnamed"}</p>
                      <p className="md:hidden text-xs text-muted-foreground truncate">{r.profile.title || r.deptName}</p>
                    </div>
                  </div>

                  {/* Role */}
                  <div className="hidden md:block min-w-0">
                    <p className="text-sm truncate">{r.profile.title || "—"}</p>
                    {r.deptName && <p className="text-xs text-muted-foreground truncate">{r.deptName}</p>}
                  </div>

                  {/* Onboarding */}
                  <div className="hidden md:block">
                    {r.onboardingComplete ? (
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15">
                        Complete
                      </Badge>
                    ) : (
                      <div className="space-y-1">
                        <Progress value={r.onboardingPct} className="h-1.5" />
                        <p className="text-[10px] text-muted-foreground">{r.onboardingPct}%</p>
                      </div>
                    )}
                  </div>

                  {/* Last 1:1 */}
                  <div className="hidden md:block">
                    {r.lastOneOnOne ? (
                      <div className="text-sm">
                        <span>{format(new Date(r.lastOneOnOne), "MMM d")}</span>
                        <span className={cn(
                          "ml-2 text-xs",
                          r.daysSince! > 30 ? "text-red-500" :
                          r.daysSince! >= 15 ? "text-amber-500" : "text-emerald-600"
                        )}>
                          · {r.daysSince}d ago
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-red-500">Never</span>
                    )}
                  </div>

                  {/* Sentiment */}
                  <div className="hidden md:flex items-center gap-2">
                    {r.sentiment ? (
                      <>
                        <span className={cn("h-2.5 w-2.5 rounded-full", sentimentColor[r.sentiment])} />
                        <span className="text-xs text-muted-foreground">{sentimentLabel[r.sentiment]}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Open action items */}
                  <div className="hidden md:block text-center text-sm">
                    {r.openActionItems > 0 ? (
                      <Badge variant="secondary" className="text-xs">{r.openActionItems}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Kudos */}
                  <div className="hidden md:block text-center text-sm">
                    {r.kudos30 > 0 ? r.kudos30 : <span className="text-muted-foreground">—</span>}
                  </div>

                  {/* Health */}
                  <div className="text-right">
                    <HealthPill health={r.health} />
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ icon, label, value, alert }: { icon: React.ReactNode; label: string; value: string; alert?: boolean }) {
  return (
    <Card className={cn(alert && "border-red-500/40")}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <p className={cn("text-2xl font-semibold mt-1", alert && "text-red-500")}>{value}</p>
      </CardContent>
    </Card>
  );
}

function HealthPill({ health }: { health: Health }) {
  const styles: Record<Health, string> = {
    green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    yellow: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    red: "bg-red-500/10 text-red-700 dark:text-red-400",
  };
  const labels: Record<Health, string> = { green: "Green", yellow: "Yellow", red: "Red" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", styles[health])}>
      <span className={cn("h-1.5 w-1.5 rounded-full mr-1.5",
        health === "green" ? "bg-emerald-500" : health === "yellow" ? "bg-amber-500" : "bg-red-500")} />
      {labels[health]}
    </span>
  );
}
