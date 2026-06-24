// OrbitProgramOverview — the Orbit program "Overview" tab (admin/director).
//
// A director command center, not a KPI dashboard (Scorecard already does
// company KPIs). Answers "who needs me today": cohort health, a needs-
// attention action queue (strikes, 90-day reviews due, untracked members),
// a light cohort performance pulse, and director resources (how-to-run docs).

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { TRACK_LABEL } from "./orbit-types";
import { differenceInDays } from "date-fns";
import { AlertTriangle, BarChart3, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const sb = supabase as any;

interface Doc { id: string; title: string; tags: string[] | null; icon?: string | null; }

interface Props {
  departmentId: string;
  docs: Doc[];
  openDocPreview: (id: string) => void;
}

interface MemberRow { id: string; user_id: string; track: string; status: string; track_started_at: string; }
interface Snap { member_id: string; snapshot_date: string; calls_made: number; appointments_set: number; conversations: number; deals_closed: number; }

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "amber" | "blue" }) {
  return (
    <div className="rounded-xl bg-card border p-4">
      <p className={cn(
        "text-[10px] font-semibold uppercase tracking-widest",
        tone === "amber" ? "text-amber-700 dark:text-amber-400" : tone === "blue" ? "text-blue-700 dark:text-blue-400" : "text-muted-foreground",
      )}>{label}</p>
      <p className="text-2xl font-bold mt-0.5 text-foreground">{value}</p>
    </div>
  );
}

export function OrbitProgramOverview({ departmentId, docs, openDocPreview }: Props) {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [strikeCount, setStrikeCount] = useState<Record<string, number>>({});
  const [snapshots, setSnapshots] = useState<Snap[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: mem } = await sb.from("orbit_members")
        .select("id, user_id, track, status, track_started_at")
        .eq("department_id", departmentId);
      const memRows = (mem ?? []) as MemberRow[];
      const memberIds = memRows.map((m) => m.id);
      const userIds = memRows.map((m) => m.user_id);

      const [profRes, strikeRes, snapRes] = await Promise.all([
        userIds.length ? sb.from("profiles").select("user_id, full_name").in("user_id", userIds) : Promise.resolve({ data: [] }),
        memberIds.length ? sb.from("orbit_strikes").select("member_id").in("member_id", memberIds) : Promise.resolve({ data: [] }),
        memberIds.length ? sb.from("orbit_performance_snapshots")
          .select("member_id, snapshot_date, calls_made, appointments_set, conversations, deals_closed")
          .in("member_id", memberIds).order("snapshot_date", { ascending: false }) : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;

      const nameMap: Record<string, string> = {};
      (profRes.data ?? []).forEach((p: any) => { nameMap[p.user_id] = p.full_name || "Unnamed"; });
      const sc: Record<string, number> = {};
      (strikeRes.data ?? []).forEach((s: any) => { sc[s.member_id] = (sc[s.member_id] ?? 0) + 1; });

      setMembers(memRows);
      setNames(nameMap);
      setStrikeCount(sc);
      setSnapshots((snapRes.data ?? []) as Snap[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [departmentId]);

  const health = useMemo(() => {
    let active = 0, on_notice = 0, graduated = 0;
    const byTrack: Record<string, number> = {};
    for (const m of members) {
      if (m.status === "active") active++;
      if (m.status === "on_notice") on_notice++;
      if (m.status === "graduated") graduated++;
      if (m.status === "active" || m.status === "on_notice") byTrack[m.track] = (byTrack[m.track] ?? 0) + 1;
    }
    return { total: members.length, active, on_notice, graduated, byTrack };
  }, [members]);

  // Most recent snapshot date per member (snapshots are ordered desc).
  const lastSnap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of snapshots) if (!map[s.member_id]) map[s.member_id] = s.snapshot_date;
    return map;
  }, [snapshots]);

  const attention = useMemo(() => {
    const items: { name: string; track: string; type: string; detail: string; severity: "high" | "med" }[] = [];
    for (const m of members) {
      if (m.status === "graduated" || m.status === "removed") continue;
      const name = names[m.user_id] || "Member";
      const days = differenceInDays(new Date(), new Date(m.track_started_at));
      const strikes = strikeCount[m.id] ?? 0;

      if (m.status === "on_notice") {
        items.push({ name, track: m.track, type: "On notice", detail: strikes ? `${strikes}/3 strikes` : "Needs review", severity: "high" });
      } else if (strikes > 0) {
        items.push({ name, track: m.track, type: `${strikes}/3 strikes`, detail: "Stay close", severity: strikes >= 2 ? "high" : "med" });
      }
      if (m.status === "active" && days >= 90) {
        items.push({ name, track: m.track, type: "90-day review due", detail: `Day ${days}`, severity: "med" });
      }
      const last = lastSnap[m.id];
      if (m.status === "active" && (!last || differenceInDays(new Date(), new Date(last)) > 14)) {
        items.push({ name, track: m.track, type: "No recent performance", detail: last ? `Last ${last}` : "Never tracked", severity: "med" });
      }
    }
    return items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));
  }, [members, names, strikeCount, lastSnap]);

  const pulse = useMemo(() => {
    const dates = Array.from(new Set(snapshots.map((s) => s.snapshot_date))).slice(0, 4);
    const set = new Set(dates);
    return snapshots.filter((s) => set.has(s.snapshot_date)).reduce(
      (a, s) => ({ calls: a.calls + (s.calls_made || 0), appts: a.appts + (s.appointments_set || 0), conv: a.conv + (s.conversations || 0), deals: a.deals + (s.deals_closed || 0) }),
      { calls: 0, appts: 0, conv: 0, deals: 0 },
    );
  }, [snapshots]);

  const directorDocs = useMemo(
    () => docs.filter((d) => (d.tags ?? []).some((t) => ["director", "sop", "playbook"].includes(t.toLowerCase()))),
    [docs],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading program overview…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cohort health */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <StatCard label="Active" value={health.active} />
        <StatCard label="On notice" value={health.on_notice} tone="amber" />
        <StatCard label="Graduated" value={health.graduated} tone="blue" />
        <StatCard label="Total" value={health.total} />
        <div className="rounded-xl bg-card border p-4 col-span-2 sm:col-span-4 lg:col-span-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">By track</p>
          <p className="text-xs text-foreground/90 mt-1 leading-relaxed">
            {Object.entries(health.byTrack).map(([t, n]) => `${TRACK_LABEL[t as keyof typeof TRACK_LABEL] ?? t}: ${n}`).join(" · ") || "—"}
          </p>
        </div>
      </div>

      {/* Needs attention */}
      <section className="space-y-2.5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h3 className="text-lg font-bold tracking-tight">Needs attention</h3>
          <span className="text-xs text-muted-foreground/60">· {attention.length}</span>
        </div>
        {attention.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Everyone's on track — nothing needs you right now.</CardContent></Card>
        ) : (
          <div className="space-y-1.5">
            {attention.map((a, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/40 px-3 py-2.5">
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", a.severity === "high" ? "bg-destructive" : "bg-amber-500")} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {a.name} <span className="text-muted-foreground font-normal">· {TRACK_LABEL[a.track as keyof typeof TRACK_LABEL] ?? a.track}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{a.type} · {a.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Cohort pulse */}
      <section className="space-y-2.5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-lg font-bold tracking-tight">Cohort pulse</h3>
          <span className="text-xs text-muted-foreground/60">· last 4 weeks</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Calls" value={pulse.calls} />
          <StatCard label="Appts" value={pulse.appts} />
          <StatCard label="Conv" value={pulse.conv} />
          <StatCard label="Deals" value={pulse.deals} />
        </div>
      </section>

      {/* Director resources */}
      <section className="space-y-2.5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-lg font-bold tracking-tight">Director resources</h3>
          <span className="text-xs text-muted-foreground/60">· {directorDocs.length}</span>
        </div>
        {directorDocs.length === 0 ? (
          <Card><CardContent className="p-5 text-sm text-muted-foreground/70 italic">
            Tag Wiki docs with <code className="text-foreground">director</code> (or <code className="text-foreground">sop</code> / <code className="text-foreground">playbook</code>) to surface how-to-run-the-program guides here.
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {directorDocs.map((d) => (
              <button key={d.id} onClick={() => openDocPreview(d.id)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/40 bg-card/40 hover:bg-muted/50 hover:border-border transition-colors text-left">
                <span className="text-base shrink-0">{d.icon || "📄"}</span>
                <span className="text-sm text-foreground truncate flex-1">{d.title}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
