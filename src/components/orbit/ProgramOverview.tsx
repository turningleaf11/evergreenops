// ProgramOverview — the Orbit Program dept page Overview tab.
//
// Members land directly on their track's role brief: tagline, what it is,
// KPI targets, daily flow steps, success criteria, getting-started checklist,
// training modules, and resources & SOPs filtered to their track.
//
// Admins see program stats + a track switcher to preview any track.

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, FileText, GraduationCap, ListChecks, Search, Sparkles, Target, Users, Loader2, Pencil, Save, X, Plus, Trash2, RotateCcw } from "lucide-react";
import { useMyOrbitMembership } from "@/hooks/useMyOrbitMembership";
import { useTrackContent } from "@/hooks/useTrackContent";
import {
  TRACK_OPTIONS,
  TRACK_ACCENT,
  TRACK_LABEL,
  type OrbitTrack,
  type TrackContent,
} from "./orbit-types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const sb = supabase as any;

interface Doc {
  id: string;
  title: string;
  author_name: string | null;
  updated_at: string;
  tags: string[] | null;
  icon?: string | null;
}

interface ProgramStats {
  total: number;
  active: number;
  on_notice: number;
  graduated: number;
  by_track: Record<string, number>;
}

interface Props {
  departmentId: string;
  deptName: string;
  docs: Doc[];
  openDocPreview: (id: string) => void;
}

const TRAINING_TAGS = new Set(["training", "playbook"]);

function isTrainingDoc(d: Doc) {
  return (d.tags ?? []).some((t) => TRAINING_TAGS.has(t.toLowerCase()));
}

function docMatchesTrack(d: Doc, track: OrbitTrack | null) {
  if (!track) return true;
  return (d.tags ?? []).some((t) => t.toLowerCase() === `track:${track}`);
}

// ── Role Overview section ─────────────────────────────────────────────────────

function RoleOverview({ track, content }: { track: OrbitTrack; content: TrackContent }) {
  const c = content;
  const accent = TRACK_ACCENT[track];

  return (
    <Card className="overflow-hidden border-2" style={{ borderColor: `${accent}40` }}>
      <div className="h-1.5" style={{ background: accent }} />
      <CardContent className="p-6 space-y-6">
        {/* Tagline */}
        <div>
          <Badge
            className="mb-2 text-[10px] uppercase tracking-widest border-0"
            style={{ background: `${accent}20`, color: accent }}
          >
            {TRACK_LABEL[track]} · The Role
          </Badge>
          <p className="text-lg text-foreground/90 leading-snug">{c.tagline}</p>
        </div>

        {/* What it is */}
        <div className="rounded-lg p-4" style={{ background: `${accent}0d` }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: accent }}>
            What it is
          </p>
          <p className="text-sm text-foreground/90 leading-relaxed">{c.what_it_is}</p>
        </div>

        {/* KPI table */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4" style={{ color: accent }} />
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">KPIs</h3>
          </div>
          <div className="rounded-lg border border-border/40 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="text-left px-3 py-2 font-semibold">Metric</th>
                  <th className="text-left px-3 py-2 font-semibold">Target</th>
                  <th className="text-left px-3 py-2 font-semibold">Starting When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {c.kpis.map((k, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-medium text-foreground">{k.metric}</td>
                    <td className="px-3 py-2 font-semibold" style={{ color: accent }}>{k.target}</td>
                    <td className="px-3 py-2 text-muted-foreground">{k.starting_when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Daily flow */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4" style={{ color: accent }} />
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              How It Works · {c.daily_flow.length} steps
            </h3>
          </div>
          <ol className="space-y-3">
            {c.daily_flow.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs text-white"
                  style={{ background: accent }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 pt-0.5">
                  <p className="text-sm font-semibold text-foreground">{step.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Success criteria */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ListChecks className="h-4 w-4" style={{ color: accent }} />
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">What success looks like</h3>
          </div>
          <ul className="space-y-1.5">
            {c.success_criteria.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                <Check className="h-3.5 w-3.5 mt-1 shrink-0" style={{ color: accent }} />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Getting Started checklist (interactive + persisted) ─────────────────────

function GettingStartedChecklist({ track, content, memberId, isOwnView }: { track: OrbitTrack; content: TrackContent; memberId: string | null; isOwnView: boolean }) {
  const c = content;
  const accent = TRACK_ACCENT[track];
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!memberId) { setDoneMap({}); return; }
    const { data } = await sb
      .from("orbit_setup_checklist")
      .select("item_key, done")
      .eq("member_id", memberId);
    const map: Record<string, boolean> = {};
    (data ?? []).forEach((r: any) => { map[r.item_key] = !!r.done; });
    setDoneMap(map);
  }, [memberId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (key: string, label: string, sortOrder: number) => {
    if (!memberId) return;
    const next = !doneMap[key];
    setDoneMap((prev) => ({ ...prev, [key]: next }));
    setSavingKey(key);
    // Upsert by (member_id, item_key)
    const payload = {
      member_id: memberId,
      item_key: key,
      label,
      sort_order: sortOrder,
      done: next,
      done_at: next ? new Date().toISOString() : null,
    };
    await sb.from("orbit_setup_checklist").upsert(payload, { onConflict: "member_id,item_key" });
    setSavingKey(null);
  };

  const doneCount = c.getting_started.filter((i) => doneMap[i.key]).length;
  const total = c.getting_started.length;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" style={{ color: accent }} />
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Getting Started</h3>
          </div>
          <p className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">{doneCount}</span> of {total} done
          </p>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full transition-all"
            style={{ background: accent, width: `${total > 0 ? Math.round((doneCount / total) * 100) : 0}%` }}
          />
        </div>

        {/* Items */}
        <ul className="space-y-1.5">
          {c.getting_started.map((item, i) => {
            const done = !!doneMap[item.key];
            const saving = savingKey === item.key;
            return (
              <li key={item.key}>
                <button
                  onClick={() => isOwnView && toggle(item.key, item.label, i)}
                  disabled={!isOwnView || saving}
                  className={cn(
                    "w-full flex items-center gap-3 px-2 py-1.5 rounded-md transition-colors text-left",
                    isOwnView ? "hover:bg-muted/40 cursor-pointer" : "cursor-default",
                  )}
                >
                  <span
                    className={cn(
                      "h-4 w-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                      done ? "text-white" : "border-muted-foreground/40",
                    )}
                    style={done ? { background: accent, borderColor: accent } : undefined}
                  >
                    {done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                  </span>
                  <span className={cn("text-sm", done && "line-through text-muted-foreground")}>
                    {item.label}
                  </span>
                  {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
                </button>
              </li>
            );
          })}
        </ul>

        {!isOwnView && memberId === null && (
          <p className="text-[11px] italic text-muted-foreground/70">
            (Admins: this preview is read-only. Members see this as an interactive checklist.)
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Training Hub ──────────────────────────────────────────────────────────────

function TrainingHub({ track, docs, openDocPreview }: { track: OrbitTrack; docs: Doc[]; openDocPreview: (id: string) => void }) {
  const accent = TRACK_ACCENT[track];
  const trackDocs = useMemo(
    () => docs.filter((d) => isTrainingDoc(d) && docMatchesTrack(d, track)),
    [docs, track],
  );

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4" style={{ color: accent }} />
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Training Hub</h3>
          <span className="text-[10px] text-muted-foreground/60">· {trackDocs.length}</span>
        </div>
        {trackDocs.length === 0 ? (
          <p className="text-sm text-muted-foreground/60 italic">No training modules tagged track:{track} yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {trackDocs.map((d) => (
              <button
                key={d.id}
                onClick={() => openDocPreview(d.id)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/40 bg-card/40 hover:bg-muted/50 hover:border-border transition-colors text-left"
              >
                <span className="text-base shrink-0">{d.icon || "🎓"}</span>
                <span className="text-sm text-foreground truncate flex-1">{d.title}</span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Resources & SOPs ──────────────────────────────────────────────────────────

const RESOURCE_GROUPS: { label: string; tag: string }[] = [
  { label: "SOPs",       tag: "sop" },
  { label: "Scripts",    tag: "script" },
  { label: "Playbooks",  tag: "playbook" },
  { label: "References", tag: "resource" },
];

function ResourcesAndSops({ track, docs, openDocPreview }: { track: OrbitTrack; docs: Doc[]; openDocPreview: (id: string) => void }) {
  const accent = TRACK_ACCENT[track];
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let r = docs.filter((d) => !isTrainingDoc(d) && docMatchesTrack(d, track));
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((d) =>
        d.title.toLowerCase().includes(q)
        || (d.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    }
    return r;
  }, [docs, track, search]);

  const grouped = useMemo(() => {
    const out: Record<string, Doc[]> = {};
    for (const g of RESOURCE_GROUPS) {
      out[g.tag] = filtered.filter((d) => (d.tags ?? []).some((t) => t.toLowerCase() === g.tag));
    }
    return out;
  }, [filtered]);

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" style={{ color: accent }} />
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Resources & SOPs</h3>
            <span className="text-[10px] text-muted-foreground/60">· {filtered.length}</span>
          </div>
          <div className="relative max-w-xs flex-1">
            <Search className="h-3 w-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-7 text-xs pl-7"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground/60 italic">No docs tagged track:{track} yet.</p>
        ) : (
          <div className="space-y-4">
            {RESOURCE_GROUPS.map((g) => {
              const items = grouped[g.tag] ?? [];
              if (items.length === 0) return null;
              return (
                <div key={g.tag} className="space-y-1.5">
                  <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 px-1">
                    {g.label} · {items.length}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {items.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => openDocPreview(d.id)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/40 bg-card/40 hover:bg-muted/50 hover:border-border transition-colors text-left"
                      >
                        <span className="text-base shrink-0">{d.icon || "📄"}</span>
                        <span className="text-sm text-foreground truncate flex-1">{d.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Admin program stats (only shown to admins) ───────────────────────────────

function ProgramStatsCard({ departmentId }: { departmentId: string }) {
  const [stats, setStats] = useState<ProgramStats | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await sb
        .from("orbit_members")
        .select("track, status")
        .eq("department_id", departmentId);
      const rows = (data ?? []) as { track: string; status: string }[];
      const by_track: Record<string, number> = {};
      let active = 0, on_notice = 0, graduated = 0;
      for (const r of rows) {
        by_track[r.track] = (by_track[r.track] ?? 0) + 1;
        if (r.status === "active") active++;
        if (r.status === "on_notice") on_notice++;
        if (r.status === "graduated") graduated++;
      }
      setStats({ total: rows.length, active, on_notice, graduated, by_track });
    })();
  }, [departmentId]);

  if (!stats) return null;

  return (
    <Card className="bg-card/40">
      <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Total</p>
          <p className="text-xl font-bold text-foreground">{stats.total}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Active</p>
          <p className="text-xl font-bold text-foreground">{stats.active}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300">On Notice</p>
          <p className="text-xl font-bold text-foreground">{stats.on_notice}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-700 dark:text-blue-300">Graduated</p>
          <p className="text-xl font-bold text-foreground">{stats.graduated}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">By Track</p>
          <p className="text-xs text-foreground/90 mt-1">
            {Object.entries(stats.by_track).map(([t, n]) => `${TRACK_LABEL[t as OrbitTrack] ?? t}:${n}`).join(" · ") || "—"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page entry ────────────────────────────────────────────────────────────────

export function ProgramOverview({ departmentId, deptName, docs, openDocPreview }: Props) {
  const { isAdmin } = useAuth();
  const { member, loading: membershipLoading } = useMyOrbitMembership();
  const [adminTrackPreview, setAdminTrackPreview] = useState<OrbitTrack | null>(null);
  const [editing, setEditing] = useState(false);

  // Active track:
  // - Members always see their OWN track (no switcher).
  // - Admins default to dts, but can flip via the track switcher.
  const activeTrack: OrbitTrack | null = isAdmin
    ? adminTrackPreview ?? "dts"
    : (member?.track ?? null);

  const isOwnView = !!member && member.track === activeTrack;
  const trackContent = useTrackContent(activeTrack ?? "dts");

  if (membershipLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your Orbit…
      </div>
    );
  }

  // Not an admin AND not an Orbit member → friendly fallback
  if (!isAdmin && !member) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-2">
          <Users className="h-6 w-6 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-foreground/80">You're not currently in the Orbit Program.</p>
          <p className="text-xs text-muted-foreground/70">Ask an admin to add you to a track to see your role overview.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Title row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {deptName}{activeTrack && (
              <>
                <span className="text-muted-foreground/40 font-normal mx-2">—</span>
                <span style={{ color: TRACK_ACCENT[activeTrack] }}>{trackContent.content.full_name}</span>
              </>
            )}
          </h1>
          {activeTrack && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              {isAdmin && !isOwnView ? "Admin preview · " : "Your role · "}
              {TRACK_LABEL[activeTrack]}
            </p>
          )}
        </div>

        {/* Admin track switcher */}
        {isAdmin && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mr-1">Preview:</span>
            {TRACK_OPTIONS.map((t) => (
              <Button
                key={t.value}
                size="sm"
                variant={activeTrack === t.value ? "default" : "outline"}
                className="h-7 text-[11px]"
                onClick={() => setAdminTrackPreview(t.value)}
                style={activeTrack === t.value ? { background: TRACK_ACCENT[t.value], borderColor: TRACK_ACCENT[t.value] } : undefined}
              >
                {t.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Admin stats */}
      {isAdmin && <ProgramStatsCard departmentId={departmentId} />}

      {activeTrack && (
        <>
          {/* Admin edit toggle */}
          {isAdmin && (
            <div className="flex items-center justify-end gap-2">
              {trackContent.hasOverride && !editing && (
                <button
                  onClick={async () => {
                    if (!confirm("Reset this track's overview to the default content?")) return;
                    await trackContent.resetToDefault();
                    toast.success("Reset to default");
                  }}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted"
                >
                  <RotateCcw className="h-3 w-3" /> Reset to default
                </button>
              )}
              <button
                onClick={() => setEditing((e) => !e)}
                className={cn(
                  "inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md font-medium",
                  editing ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
                )}
              >
                {editing ? <><X className="h-3 w-3" /> Done editing</> : <><Pencil className="h-3 w-3" /> Edit overview</>}
              </button>
            </div>
          )}

          {editing && isAdmin ? (
            <RoleOverviewEditor
              track={activeTrack}
              content={trackContent.content}
              onSave={async (next) => { await trackContent.save(next); toast.success("Saved"); }}
            />
          ) : (
            <RoleOverview track={activeTrack} content={trackContent.content} />
          )}

          <GettingStartedChecklist
            track={activeTrack}
            content={trackContent.content}
            memberId={isOwnView ? (member?.id ?? null) : null}
            isOwnView={isOwnView}
          />
          <TrainingHub track={activeTrack} docs={docs} openDocPreview={openDocPreview} />
          <ResourcesAndSops track={activeTrack} docs={docs} openDocPreview={openDocPreview} />
        </>
      )}
    </div>
  );
}

// ── Admin edit form for the role overview ───────────────────────────────────

function RoleOverviewEditor({
  track, content, onSave,
}: {
  track: OrbitTrack;
  content: TrackContent;
  onSave: (next: Partial<TrackContent>) => Promise<void>;
}) {
  const accent = TRACK_ACCENT[track];
  const [draft, setDraft] = useState<TrackContent>(content);
  const [saving, setSaving] = useState(false);

  // Reset draft if track changes
  useEffect(() => { setDraft(content); }, [track]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        full_name: draft.full_name,
        tagline: draft.tagline,
        what_it_is: draft.what_it_is,
        kpis: draft.kpis,
        daily_flow: draft.daily_flow,
        success_criteria: draft.success_criteria,
        getting_started: draft.getting_started,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <Card className="border-2" style={{ borderColor: `${accent}40` }}>
      <div className="h-1.5" style={{ background: accent }} />
      <CardContent className="p-6 space-y-5">
        <Field label="Full name">
          <Input value={draft.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} />
        </Field>
        <Field label="Tagline">
          <Input value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} />
        </Field>
        <Field label="What it is">
          <textarea
            value={draft.what_it_is}
            onChange={(e) => setDraft({ ...draft, what_it_is: e.target.value })}
            className="w-full min-h-[90px] bg-transparent border border-border/60 rounded-md px-3 py-2 text-sm outline-none"
          />
        </Field>

        <Repeatable
          label="KPIs"
          items={draft.kpis}
          onChange={(kpis) => setDraft({ ...draft, kpis: kpis as TrackContent["kpis"] })}
          emptyValue={{ metric: "", target: "", starting_when: "" }}
          renderRow={(item, set) => (
            <>
              <Input placeholder="Metric" value={(item as any).metric ?? ""} onChange={(e) => set({ metric: e.target.value })} className="flex-1" />
              <Input placeholder="Target" value={(item as any).target ?? ""} onChange={(e) => set({ target: e.target.value })} className="w-32" />
              <Input placeholder="Starting when" value={(item as any).starting_when ?? ""} onChange={(e) => set({ starting_when: e.target.value })} className="w-40" />
            </>
          )}
        />

        <Repeatable
          label="Daily Flow steps"
          items={draft.daily_flow}
          onChange={(daily_flow) => setDraft({ ...draft, daily_flow: daily_flow as TrackContent["daily_flow"] })}
          emptyValue={{ title: "", detail: "" }}
          renderRow={(item, set) => (
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-2">
              <Input placeholder="Step title" value={(item as any).title ?? ""} onChange={(e) => set({ title: e.target.value })} />
              <Input placeholder="Detail" value={(item as any).detail ?? ""} onChange={(e) => set({ detail: e.target.value })} />
            </div>
          )}
        />

        <Repeatable
          label="Success Criteria"
          items={draft.success_criteria}
          onChange={(success_criteria) => setDraft({ ...draft, success_criteria: success_criteria as TrackContent["success_criteria"] })}
          emptyValue=""
          renderRow={(item, set) => (
            <Input className="flex-1" placeholder="What success looks like…" value={String(item ?? "")} onChange={(e) => set(e.target.value)} />
          )}
        />

        <Repeatable
          label="Getting Started checklist"
          items={draft.getting_started}
          onChange={(getting_started) => setDraft({ ...draft, getting_started: getting_started as TrackContent["getting_started"] })}
          emptyValue={{ key: "", label: "" }}
          renderRow={(item, set) => (
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-2">
              <Input placeholder="key_snake_case" value={(item as any).key ?? ""} onChange={(e) => set({ key: e.target.value })} className="font-mono text-xs" />
              <Input placeholder="Label shown to members" value={(item as any).label ?? ""} onChange={(e) => set({ label: e.target.value })} />
            </div>
          )}
        />

        <div className="flex justify-end gap-2 pt-4 border-t border-border/40">
          <Button onClick={save} disabled={saving} style={{ background: accent, borderColor: accent }}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Save className="h-3 w-3 mr-1.5" />}
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Repeatable<T>({
  label, items, onChange, emptyValue, renderRow,
}: {
  label: string;
  items: T[];
  onChange: (next: T[]) => void;
  emptyValue: T;
  renderRow: (item: T, set: (patch: any) => void) => React.ReactNode;
}) {
  const setItem = (idx: number, patch: any) => {
    const next = [...items];
    next[idx] = typeof patch === "object" && !Array.isArray(patch) && patch !== null
      ? { ...(next[idx] as any), ...patch }
      : patch;
    onChange(next);
  };
  const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const addItem = () => onChange([...items, structuredClone(emptyValue)]);

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            {renderRow(item, (patch) => setItem(idx, patch))}
            <button
              onClick={() => removeItem(idx)}
              className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Remove"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          onClick={addItem}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md border border-dashed border-border/60 hover:border-border"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
    </div>
  );
}
