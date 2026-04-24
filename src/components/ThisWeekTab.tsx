import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, Circle, AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import { TeamHealthWidget } from "@/components/ceo/TeamHealthWidget";

interface Metric {
  id: string;
  name: string;
  department_id: string | null;
  owner_id: string | null;
  weekly_target: number;
  unit: string;
  data_source: string;
  ghl_field_key: string | null;
}
interface Entry {
  id: string;
  metric_id: string;
  week_start_date: string;
  actual_value: number | null;
}
interface Profile { user_id: string; full_name: string | null; avatar_url: string | null; }

function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function formatValue(v: number | null | undefined, unit: string): string {
  if (v == null) return "—";
  if (unit === "$") return `$${Number(v).toLocaleString()}`;
  if (unit === "%") return `${v}%`;
  return String(v);
}

export function ThisWeekTab() {
  const { user } = useAuth();
  const { departments } = useDepartments();
  const week = useMemo(() => mondayOf(new Date()), []);

  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [ghlErrors, setGhlErrors] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Weekly priorities
  const [priorities, setPriorities] = useState({ top: "", second: "", third: "" });
  const [savingPri, setSavingPri] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: mData }, { data: pData }] = await Promise.all([
      supabase.from("scorecard_metrics").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("profiles").select("user_id, full_name, avatar_url"),
    ]);
    setMetrics((mData || []) as Metric[]);
    setProfiles(pData || []);
    if (mData && mData.length) {
      const { data: eData } = await supabase
        .from("scorecard_entries")
        .select("id, metric_id, week_start_date, actual_value")
        .in("metric_id", mData.map((m) => m.id))
        .eq("week_start_date", week);
      setEntries(eData || []);

      // Trigger GHL sync if any metric is GHL-sourced and missing for this week
      const ghlMissing = mData.some((m: any) =>
        m.data_source === "ghl" && !(eData || []).find((e: any) => e.metric_id === m.id),
      );
      if (ghlMissing) {
        supabase.functions.invoke("scorecard-ghl-sync").then(({ data, error }) => {
          if (error) {
            // Mark all GHL metrics as errored
            const errored = new Set<string>(
              mData.filter((m: any) => m.data_source === "ghl").map((m: any) => m.id),
            );
            setGhlErrors(errored);
            return;
          }
          if (data?.errors?.length) {
            setGhlErrors(new Set(data.errors.map((e: any) => e.metric_id)));
          }
          if (data?.synced > 0) {
            // Reload entries to pick up newly inserted rows
            supabase
              .from("scorecard_entries")
              .select("id, metric_id, week_start_date, actual_value")
              .in("metric_id", mData.map((m) => m.id))
              .eq("week_start_date", week)
              .then(({ data: refreshed }) => setEntries(refreshed || []));
          }
        });
      }
    } else {
      setEntries([]);
    }
    setLoading(false);
  }, [week]);

  const loadPriorities = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("ceo_weekly_priorities")
      .select("top_priority, second_priority, third_priority")
      .eq("user_id", user.id)
      .eq("week_start_date", week)
      .maybeSingle();
    if (data) {
      setPriorities({
        top: data.top_priority || "",
        second: data.second_priority || "",
        third: data.third_priority || "",
      });
    }
  }, [user, week]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadPriorities(); }, [loadPriorities]);

  const savePriorities = async (next: typeof priorities) => {
    if (!user) return;
    setSavingPri(true);
    await supabase.from("ceo_weekly_priorities").upsert({
      user_id: user.id,
      week_start_date: week,
      top_priority: next.top,
      second_priority: next.second,
      third_priority: next.third,
    }, { onConflict: "user_id,week_start_date" });
    setSavingPri(false);
  };

  const entryFor = (id: string) => entries.find((e) => e.metric_id === id);
  const ownerOf = (id: string | null) => profiles.find((p) => p.user_id === id);
  const deptName = (id: string | null) => departments.find((d) => d.id === id)?.name || "Company-Wide";

  const summary = useMemo(() => {
    let onTrack = 0, total = 0;
    for (const m of metrics) {
      total++;
      const v = entryFor(m.id)?.actual_value;
      if (v != null && v >= Number(m.weekly_target)) onTrack++;
    }
    return { onTrack, total };
  }, [metrics, entries]);

  return (
    <div className="space-y-6">
      {/* SECTION 1 — SCORECARD PULSE */}
      <div className="rounded-2xl border border-border/50 bg-card/80 p-6 elevation-1">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Scorecard Pulse</h2>
            <p className="text-sm text-foreground mt-1">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{summary.onTrack}</span>
              <span className="text-muted-foreground"> of </span>
              <span className="font-semibold tabular-nums">{summary.total}</span>
              <span className="text-muted-foreground"> metrics on track this week</span>
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
        ) : metrics.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No active scorecard metrics yet.
          </div>
        ) : (
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <div className="grid grid-cols-[1.6fr_1fr_auto_auto_auto_auto] gap-3 px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground font-medium border-b border-border/50 bg-muted/30">
              <div>Metric</div>
              <div>Department</div>
              <div className="w-8 text-center">Owner</div>
              <div className="w-20 text-right">Target</div>
              <div className="w-20 text-right">Actual</div>
              <div className="w-14 text-center">Status</div>
            </div>
            {metrics.map((m) => {
              const e = entryFor(m.id);
              const v = e?.actual_value;
              const onTrack = v != null && v >= Number(m.weekly_target);
              const owner = ownerOf(m.owner_id);
              const ghlErr = ghlErrors.has(m.id);
              return (
                <div key={m.id} className="grid grid-cols-[1.6fr_1fr_auto_auto_auto_auto] gap-3 items-center px-4 py-2 border-b border-border/30 last:border-0 text-sm hover:bg-muted/20">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate font-medium">{m.name}</span>
                    {ghlErr && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p className="text-xs">GHL sync unavailable — enter manually</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{deptName(m.department_id)}</div>
                  <div className="w-8 flex justify-center">
                    {owner ? (
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={owner.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">{(owner.full_name || "?").slice(0, 1)}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="h-6 w-6" />
                    )}
                  </div>
                  <div className="w-20 text-right tabular-nums text-muted-foreground">{formatValue(m.weekly_target, m.unit)}</div>
                  <div className="w-20 text-right tabular-nums font-medium">{formatValue(v ?? null, m.unit)}</div>
                  <div className="w-14 flex justify-center">
                    {v == null ? (
                      <Circle className="h-4 w-4 text-muted-foreground/40" strokeWidth={2.5} />
                    ) : onTrack ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Link
            to="/scorecard"
            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
          >
            View full scorecard <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* SECTION 1B — TEAM HEALTH */}
      <TeamHealthWidget />

      {/* SECTION 2 — WEEKLY PRIORITIES */}
      <div className="rounded-2xl border border-border/50 bg-card/80 p-6 elevation-1">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">This Week's Focus</h2>
          {savingPri && <span className="text-[10px] text-muted-foreground/70">Saving…</span>}
        </div>
        <div className="space-y-2 mt-4">
          {([
            { key: "top", label: "1", placeholder: "Top priority for this week..." },
            { key: "second", label: "2", placeholder: "Second priority..." },
            { key: "third", label: "3", placeholder: "Third priority..." },
          ] as const).map((row) => (
            <div key={row.key} className="flex items-center gap-3 group">
              <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                {row.label}
              </span>
              <input
                value={priorities[row.key]}
                onChange={(e) => setPriorities((p) => ({ ...p, [row.key]: e.target.value }))}
                onBlur={(e) => {
                  const next = { ...priorities, [row.key]: e.target.value };
                  savePriorities(next);
                }}
                placeholder={row.placeholder}
                className="flex-1 bg-transparent text-sm text-foreground border-none outline-none placeholder:text-muted-foreground/40 py-1.5 border-b border-transparent focus:border-border/60 transition-colors"
              />
            </div>
          ))}
        </div>
        <p className="text-[11px] italic text-muted-foreground/70 mt-4">Resets each Monday</p>
      </div>
    </div>
  );
}
