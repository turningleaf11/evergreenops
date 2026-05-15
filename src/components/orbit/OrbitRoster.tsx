import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  type OrbitMember, type OrbitTrack, type OrbitStatus,
  TRACK_OPTIONS, STATUS_OPTIONS, TRACK_COLORS, STATUS_COLORS, TRACK_LABEL, STATUS_LABEL,
} from "./orbit-types";
import { Plus, Search, Users, AlertTriangle, ListChecks, TrendingUp, Phone, Calendar, Target, DollarSign } from "lucide-react";
import { differenceInDays, format, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { AddOrbitMemberDialog } from "./AddOrbitMemberDialog";
import { OrbitMemberDetailDrawer } from "./OrbitMemberDetailDrawer";
import { cn } from "@/lib/utils";

const sb = supabase as any;

interface Profile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  email?: string | null;
}

interface MemberRow extends OrbitMember {
  profile?: Profile;
  checklist_total: number;
  checklist_done: number;
  strike_count: number;
}

function initials(name: string | null) {
  return (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// ============== Program Pulse (week-over-week aggregate metrics) ==============
interface PulseData {
  thisWeek: { calls: number; appts: number; qualified: number; deals: number; reporting: number };
  lastWeek: { calls: number; appts: number; qualified: number; deals: number; reporting: number };
  totalActive: number;
}

function trend(curr: number, prev: number): { pct: number; up: boolean } {
  if (prev === 0) return { pct: curr > 0 ? 100 : 0, up: curr >= prev };
  const pct = Math.round(((curr - prev) / prev) * 100);
  return { pct: Math.abs(pct), up: curr >= prev };
}

function ProgramPulse({ memberIds, activeCount }: { memberIds: string[]; activeCount: number }) {
  const [pulse, setPulse] = useState<PulseData | null>(null);

  useEffect(() => {
    if (memberIds.length === 0) { setPulse(null); return; }
    (async () => {
      const today = new Date();
      const thisWeekStart = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const thisWeekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const lastWeek = subWeeks(today, 1);
      const lastWeekStart = format(startOfWeek(lastWeek, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const lastWeekEnd = format(endOfWeek(lastWeek, { weekStartsOn: 1 }), "yyyy-MM-dd");

      const { data } = await sb
        .from("orbit_performance_snapshots")
        .select("member_id, snapshot_date, calls_made, appointments_set, leads_qualified, deals_closed")
        .in("member_id", memberIds)
        .gte("snapshot_date", lastWeekStart)
        .lte("snapshot_date", thisWeekEnd);

      const rows = (data ?? []) as any[];
      const acc = (filter: (d: string) => boolean) => {
        const reporting = new Set<string>();
        const totals = { calls: 0, appts: 0, qualified: 0, deals: 0 };
        rows.filter((r) => filter(r.snapshot_date)).forEach((r) => {
          reporting.add(r.member_id);
          totals.calls += r.calls_made || 0;
          totals.appts += r.appointments_set || 0;
          totals.qualified += r.leads_qualified || 0;
          totals.deals += r.deals_closed || 0;
        });
        return { ...totals, reporting: reporting.size };
      };

      setPulse({
        thisWeek: acc((d) => d >= thisWeekStart && d <= thisWeekEnd),
        lastWeek: acc((d) => d >= lastWeekStart && d <= lastWeekEnd),
        totalActive: activeCount,
      });
    })();
  }, [memberIds.join(","), activeCount]);

  if (!pulse || pulse.totalActive === 0) return null;

  const metrics: Array<{ label: string; icon: React.ElementType; curr: number; prev: number }> = [
    { label: "Calls", icon: Phone, curr: pulse.thisWeek.calls, prev: pulse.lastWeek.calls },
    { label: "Appts", icon: Calendar, curr: pulse.thisWeek.appts, prev: pulse.lastWeek.appts },
    { label: "Qualified", icon: Target, curr: pulse.thisWeek.qualified, prev: pulse.lastWeek.qualified },
    { label: "Deals", icon: DollarSign, curr: pulse.thisWeek.deals, prev: pulse.lastWeek.deals },
  ];

  return (
    <div className="rounded-xl border border-border/40 bg-gradient-to-br from-primary/[0.03] to-transparent p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-primary" />
          <h3 className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Program Pulse · This Week</h3>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {pulse.thisWeek.reporting}/{pulse.totalActive} members reporting
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metrics.map((m) => {
          const t = trend(m.curr, m.prev);
          const Icon = m.icon;
          return (
            <div key={m.label} className="space-y-0.5">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                <Icon className="h-2.5 w-2.5" />
                {m.label}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-foreground">{m.curr}</span>
                {m.prev > 0 && (
                  <span className={cn("text-[10px] font-medium", t.up ? "text-emerald-600" : "text-rose-600")}>
                    {t.up ? "↑" : "↓"} {t.pct}%
                  </span>
                )}
              </div>
              <p className="text-[9px] text-muted-foreground/60">vs {m.prev} last wk</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OrbitRoster({ departmentId }: { departmentId: string }) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrbitStatus | "all">("active");
  const [trackFilter, setTrackFilter] = useState<OrbitTrack | "all">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: ms } = await sb
      .from("orbit_members")
      .select("*")
      .eq("department_id", departmentId)
      .order("created_at", { ascending: false });
    const memberRows = (ms ?? []) as OrbitMember[];

    if (memberRows.length === 0) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const userIds = memberRows.map((m) => m.user_id);
    const memberIds = memberRows.map((m) => m.id);

    const [profilesRes, checklistRes, strikesRes] = await Promise.all([
      sb.from("profiles").select("user_id, full_name, avatar_url, email").in("user_id", userIds),
      sb.from("orbit_setup_checklist").select("member_id, done").in("member_id", memberIds),
      sb.from("orbit_strikes").select("member_id").in("member_id", memberIds),
    ]);

    const profMap = new Map<string, Profile>(((profilesRes.data ?? []) as Profile[]).map((p) => [p.user_id, p]));

    const checklistCount = new Map<string, { total: number; done: number }>();
    ((checklistRes.data ?? []) as any[]).forEach((c) => {
      const cur = checklistCount.get(c.member_id) || { total: 0, done: 0 };
      cur.total += 1;
      if (c.done) cur.done += 1;
      checklistCount.set(c.member_id, cur);
    });

    const strikeCount = new Map<string, number>();
    ((strikesRes.data ?? []) as any[]).forEach((s) => {
      strikeCount.set(s.member_id, (strikeCount.get(s.member_id) || 0) + 1);
    });

    const rows: MemberRow[] = memberRows.map((m) => ({
      ...m,
      profile: profMap.get(m.user_id),
      checklist_total: checklistCount.get(m.id)?.total || 0,
      checklist_done: checklistCount.get(m.id)?.done || 0,
      strike_count: strikeCount.get(m.id) || 0,
    }));
    setMembers(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId]);

  const existingUserIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);

  const filtered = members.filter((m) => {
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (trackFilter !== "all" && m.track !== trackFilter) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return m.profile?.full_name?.toLowerCase().includes(s) || m.profile?.email?.toLowerCase().includes(s);
  });

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: members.length, active: 0, on_notice: 0, graduated: 0, removed: 0 };
    members.forEach((m) => { c[m.status] = (c[m.status] || 0) + 1; });
    return c;
  }, [members]);

  const selectedMember = selectedMemberId ? members.find((m) => m.id === selectedMemberId) : null;

  const memberIds = members.map((m) => m.id);
  const activeCount = members.filter((m) => m.status === "active").length;

  return (
    <div className="space-y-4">
      <ProgramPulse memberIds={memberIds} activeCount={activeCount} />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filters */}
          {(["active", "on_notice", "graduated", "removed", "all"] as const).map((s) => {
            const active = statusFilter === s;
            const label = s === "all" ? "All" : STATUS_LABEL[s];
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {label} <span className="opacity-60">· {statusCounts[s] || 0}</span>
              </button>
            );
          })}
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add member
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members…"
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setTrackFilter("all")}
            className={cn(
              "px-2 py-1 rounded-md text-[10px] font-medium transition-colors",
              trackFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            All tracks
          </button>
          {TRACK_OPTIONS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTrackFilter(trackFilter === t.value ? "all" : t.value)}
              className={cn(
                "px-2 py-1 rounded-md text-[10px] font-medium transition-colors",
                trackFilter === t.value ? "bg-primary text-primary-foreground" : `${TRACK_COLORS[t.value]} hover:opacity-80`
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Loading roster…</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-2">
            <Users className="h-6 w-6 mx-auto text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {members.length === 0 ? "No Orbit members yet" : "No members match your filters"}
            </p>
            {members.length === 0 && (
              <p className="text-xs text-muted-foreground/70">Click "Add member" to start your roster.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((m) => {
            const daysOnTrack = differenceInDays(new Date(), new Date(m.track_started_at));
            const past90 = daysOnTrack >= 90;
            const checklistComplete = m.checklist_total > 0 && m.checklist_done === m.checklist_total;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMemberId(m.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/40 bg-card/60 hover:bg-muted/40 hover:border-border transition-colors text-left"
              >
                <Avatar className="h-9 w-9 shrink-0">
                  {m.profile?.avatar_url && <AvatarImage src={m.profile.avatar_url} />}
                  <AvatarFallback className="text-xs">{initials(m.profile?.full_name || null)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.profile?.full_name || "Unknown"}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="secondary" className={`text-[9px] ${TRACK_COLORS[m.track]}`}>{TRACK_LABEL[m.track]}</Badge>
                    <Badge variant="secondary" className={`text-[9px] ${STATUS_COLORS[m.status]}`}>{STATUS_LABEL[m.status]}</Badge>
                    <span className={`text-[10px] ${past90 ? "text-amber-600 font-medium" : "text-muted-foreground/70"}`}>
                      Day {daysOnTrack}/90{past90 && " · review"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {m.checklist_total > 0 && (
                    <div className={cn("flex items-center gap-1 text-[10px]", checklistComplete ? "text-emerald-600" : "text-muted-foreground")}>
                      <ListChecks className="h-3 w-3" />
                      {m.checklist_done}/{m.checklist_total}
                    </div>
                  )}
                  {m.strike_count > 0 && (
                    <div className={cn(
                      "flex items-center gap-1 text-[10px] font-medium",
                      m.strike_count >= 3 ? "text-destructive" : m.strike_count === 2 ? "text-amber-600" : "text-muted-foreground"
                    )}>
                      <AlertTriangle className="h-3 w-3" />
                      {m.strike_count}/3
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <AddOrbitMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        departmentId={departmentId}
        existingMemberUserIds={existingUserIds}
        onAdded={load}
      />

      <OrbitMemberDetailDrawer
        open={!!selectedMemberId}
        onOpenChange={(o) => !o && setSelectedMemberId(null)}
        memberId={selectedMemberId}
        profile={selectedMember?.profile ?? null}
        onChanged={load}
      />
    </div>
  );
}
