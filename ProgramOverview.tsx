import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTraining } from "@/contexts/TrainingContext";
import { useTrainingProgress } from "@/lib/training-progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  TRACK_OPTIONS,
  TRACK_COLORS,
  TRACK_LABEL,
  TRACK_ACCENT,
  TRACK_CONTENT,
  type OrbitTrack,
  type TrackContent,
} from "./orbit-types";
import {
  Search,
  FileText,
  Plus,
  Download,
  ExternalLink,
  Sparkles,
  GraduationCap,
  CheckCircle2,
  Circle,
  ArrowRight,
  Target,
  TrendingUp,
  CheckSquare,
  PlayCircle,
  BookOpen,
  ListChecks,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyOrbitMembership } from "@/hooks/useMyOrbitMembership";
import { QuickAddCurriculumDialog } from "./QuickAddCurriculumDialog";

const sb = supabase as any;

interface Doc {
  id: string;
  title: string;
  author_name: string | null;
  updated_at: string;
  visibility: string;
  shared_with: any;
  tags: string[] | null;
  icon?: string | null;
}

interface Member {
  id: string;
  status: string;
  track: string;
}

// ─── Resource helpers ────────────────────────────────────────────────────────

const TYPE_PRIORITY = ["sop", "script", "playbook", "training", "resource"] as const;
type ResourceType = (typeof TYPE_PRIORITY)[number] | "other";

const TYPE_META: Record<ResourceType, { label: string; icon: string; color: string }> = {
  sop: { label: "SOP", icon: "📋", color: "bg-blue-500/10 text-blue-700 border-blue-200/50 dark:text-blue-400" },
  script: { label: "Script", icon: "💬", color: "bg-amber-500/10 text-amber-700 border-amber-200/50 dark:text-amber-400" },
  playbook: { label: "Playbook", icon: "🎯", color: "bg-emerald-500/10 text-emerald-700 border-emerald-200/50 dark:text-emerald-400" },
  training: { label: "Training", icon: "🎓", color: "bg-violet-500/10 text-violet-700 border-violet-200/50 dark:text-violet-400" },
  resource: { label: "Resource", icon: "📚", color: "bg-rose-500/10 text-rose-700 border-rose-200/50 dark:text-rose-400" },
  other: { label: "Reference", icon: "📄", color: "bg-muted text-muted-foreground border-border/50" },
};

function detectType(tags: string[] | null): ResourceType {
  if (!tags) return "other";
  for (const t of TYPE_PRIORITY) if (tags.includes(t)) return t;
  return "other";
}

function getDocTracks(tags: string[] | null): OrbitTrack[] {
  if (!tags) return [];
  return tags.filter((t) => t.startsWith("track:")).map((t) => t.replace("track:", "") as OrbitTrack);
}

const typeIcons: Record<string, React.ElementType> = {
  guide: BookOpen,
  playbook: ListChecks,
  checklist: ListChecks,
  video: PlayCircle,
  link: Link2,
};

// ─── Stats hero (admin only) ─────────────────────────────────────────────────

function ProgramStats({ departmentId, deptName }: { departmentId: string; deptName: string }) {
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("orbit_members").select("id, status, track").eq("department_id", departmentId);
      setMembers((data ?? []) as Member[]);
    })();
  }, [departmentId]);

  const stats = useMemo(() => {
    const total = members.length;
    const active = members.filter((m) => m.status === "active").length;
    const onNotice = members.filter((m) => m.status === "on_notice").length;
    const graduated = members.filter((m) => m.status === "graduated").length;
    return { total, active, onNotice, graduated };
  }, [members]);

  return (
    <div className="rounded-2xl border border-primary/20 p-5 bg-gradient-to-br from-primary/[0.05] via-primary/[0.02] to-transparent">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-3.5 w-3.5 text-primary/80" />
        <span className="text-[10px] uppercase tracking-widest font-semibold text-primary/80">Program</span>
      </div>
      <h2 className="text-lg font-bold tracking-tight">{deptName}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Active</p>
          <p className="text-2xl font-bold text-foreground mt-0.5">{stats.active}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">On Notice</p>
          <p className="text-2xl font-bold text-amber-600 mt-0.5">{stats.onNotice}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Graduated</p>
          <p className="text-2xl font-bold text-blue-600 mt-0.5">{stats.graduated}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Total</p>
          <p className="text-2xl font-bold text-muted-foreground mt-0.5">{stats.total}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Track overview (role brief) ─────────────────────────────────────────────

function TrackOverview({ track }: { track: OrbitTrack }) {
  const content: TrackContent | undefined = TRACK_CONTENT[track];
  const accent = TRACK_ACCENT[track] ?? "hsl(var(--primary))";
  const label = TRACK_LABEL[track];

  if (!content) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Role overview coming soon for this track.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div
        className="rounded-2xl p-5 border"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 8%, transparent), color-mix(in srgb, ${accent} 3%, transparent))`,
          borderColor: `color-mix(in srgb, ${accent} 25%, transparent)`,
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="rounded-xl p-2.5 shrink-0"
            style={{ background: `color-mix(in srgb, ${accent} 15%, transparent)` }}
          >
            <Target className="h-5 w-5" style={{ color: accent }} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: accent }}
              >
                {label}
              </span>
            </div>
            <p className="text-base font-semibold leading-snug">{content.tagline}</p>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{content.whatItIs}</p>
          </div>
        </div>

        {/* Four pillars (DTA) */}
        {content.pillars && (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {content.pillars.map((p) => (
              <div
                key={p.label}
                className="rounded-xl p-3 text-center border"
                style={{
                  background: `color-mix(in srgb, ${accent} 10%, transparent)`,
                  borderColor: `color-mix(in srgb, ${accent} 20%, transparent)`,
                }}
              >
                <div className="text-xl mb-1">{p.icon}</div>
                <p className="text-xs font-semibold">{p.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KPIs + Deal flow — side by side on wider screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* KPIs */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> KPIs
          </h3>
          <div className="space-y-2">
            {content.kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="flex items-center justify-between p-3 rounded-xl border bg-card"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{kpi.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.startingWhen}</p>
                </div>
                <div
                  className="ml-3 shrink-0 rounded-lg px-3 py-1.5 text-center min-w-[72px]"
                  style={{
                    background: `color-mix(in srgb, ${accent} 12%, transparent)`,
                    color: accent,
                  }}
                >
                  <p className="text-sm font-bold leading-none">{kpi.target}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deal flow */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <ArrowRight className="h-3.5 w-3.5" /> Where you fit
          </h3>
          <div className="rounded-xl border bg-card p-4 space-y-1.5">
            {content.flow.map((step, i) => (
              <div key={i} className="flex items-center gap-2.5">
                {step.isHighlight ? (
                  <div
                    className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold"
                    style={{
                      background: `color-mix(in srgb, ${accent} 15%, transparent)`,
                      color: accent,
                      border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
                    }}
                  >
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ background: accent }} />
                    {step.label}
                  </div>
                ) : (
                  <>
                    <div className="h-1.5 w-1.5 rounded-full bg-border shrink-0 ml-1.5" />
                    <p className="text-sm text-muted-foreground flex-1">{step.label}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily flow */}
      <div className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Daily flow
        </h3>
        <div className="space-y-2">
          {content.dailySteps.map((step) => (
            <div key={step.step} className="flex gap-3 p-3 rounded-xl border bg-card">
              <div
                className="h-7 w-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold"
                style={{
                  background: `color-mix(in srgb, ${accent} 12%, transparent)`,
                  color: accent,
                }}
              >
                {step.step}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Success criteria */}
      <div className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <CheckSquare className="h-3.5 w-3.5" /> What success looks like
        </h3>
        <div className="rounded-xl border bg-card p-4">
          <div className="space-y-2">
            {content.successCriteria.map((c, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm">
                <CheckCircle2
                  className="h-4 w-4 shrink-0 mt-0.5"
                  style={{ color: accent }}
                />
                <span>{c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Getting started checklist */}
      <div className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Getting started checklist
        </h3>
        <div className="rounded-xl border bg-card divide-y divide-border/60">
          {content.gettingStarted.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div
                className="h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center"
                style={{ borderColor: `color-mix(in srgb, ${accent} 40%, transparent)` }}
              >
                <span className="text-[10px] font-bold" style={{ color: accent }}>
                  {i + 1}
                </span>
              </div>
              <p className="text-sm">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Training Hub section ─────────────────────────────────────────────────────

function TrainingHub({ track }: { track: OrbitTrack }) {
  const { modules } = useTraining();
  const { isStepComplete, markStepComplete, markStepIncomplete, getModuleProgress, isModuleComplete } =
    useTrainingProgress();

  const trackLabel = TRACK_LABEL[track].toLowerCase();

  // Filter modules relevant to this track: either no roleIds (universal) or matching track label/value
  const relevantModules = modules.filter(
    (m) =>
      m.roleIds.length === 0 ||
      m.roleIds.some((r) => r === track || r === trackLabel || trackLabel.includes(r))
  );

  if (relevantModules.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center space-y-2">
        <GraduationCap className="h-6 w-6 mx-auto text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No training modules assigned to this track yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Accordion type="multiple" className="space-y-2">
        {relevantModules.map((mod) => {
          const Icon = typeIcons[mod.type] || FileText;
          const complete = isModuleComplete(mod.id, mod.steps.length);
          const progress = getModuleProgress(mod.id, mod.steps.length);
          const StatusIcon = complete ? CheckCircle2 : Circle;

          return (
            <AccordionItem
              key={mod.id}
              value={mod.id}
              className="border rounded-xl overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                <div className="flex items-center gap-3 w-full mr-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{mod.title}</p>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{mod.category}</Badge>
                      <StatusIcon
                        className={`h-3.5 w-3.5 shrink-0 ${complete ? "text-green-500" : "text-muted-foreground/40"}`}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{mod.description}</p>
                  </div>
                  <div className="w-16 shrink-0">
                    <Progress value={progress} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground text-right mt-0.5">{progress}%</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3 pt-2">
                  {mod.steps.map((step) => {
                    const checked = isStepComplete(mod.id, step.id);
                    return (
                      <div key={step.id} className="flex gap-3">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(val) =>
                            val
                              ? markStepComplete(mod.id, step.id)
                              : markStepIncomplete(mod.id, step.id)
                          }
                          className="mt-0.5 shrink-0"
                        />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <p className={`text-sm font-medium ${checked ? "line-through text-muted-foreground" : ""}`}>
                            {step.title}
                          </p>
                          {step.content && (
                            <p className="text-xs text-muted-foreground whitespace-pre-line">{step.content}</p>
                          )}
                          {step.videoUrl && (
                            <div className="mt-2 rounded-lg overflow-hidden border aspect-video max-w-lg">
                              <iframe
                                src={step.videoUrl}
                                className="w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                title={step.title}
                              />
                            </div>
                          )}
                          {step.externalUrl && (
                            <a
                              href={step.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {step.externalLabel || "Open link"}
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

// ─── Curriculum (docs) ───────────────────────────────────────────────────────

function Curriculum({
  departmentId,
  docs,
  openDocPreview,
  activeTrack,
  isAdmin,
}: {
  departmentId: string;
  docs: Doc[];
  openDocPreview: (id: string) => void;
  activeTrack: OrbitTrack;
  isAdmin: boolean;
}) {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = docs.filter((d) => {
    if (search.trim()) {
      const s = search.toLowerCase();
      if (!d.title.toLowerCase().includes(s) && !(d.tags ?? []).some((t) => t.toLowerCase().includes(s))) {
        return false;
      }
    }
    const tracks = getDocTracks(d.tags);
    return tracks.includes(activeTrack) || tracks.length === 0;
  });

  const groups: Record<ResourceType, Doc[]> = {
    sop: [],
    script: [],
    playbook: [],
    training: [],
    resource: [],
    other: [],
  };
  filtered.forEach((d) => {
    groups[detectType(d.tags)].push(d);
  });
  const orderedGroups = ([...TYPE_PRIORITY, "other"] as ResourceType[]).filter((g) => groups[g].length > 0);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold flex items-center gap-2 tracking-tight">
            <GraduationCap className="h-4 w-4 text-primary" />
            Resources & SOPs
            <span className="text-xs font-normal text-muted-foreground/60">
              ({filtered.length} {filtered.length === 1 ? "doc" : "docs"})
            </span>
          </h2>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="h-7 text-xs gap-1.5">
              <Plus className="h-3 w-3" /> Add
            </Button>
          )}
        </div>
        <div className="relative w-56">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search resources…"
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {orderedGroups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-2">
            <GraduationCap className="h-6 w-6 mx-auto text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {docs.length === 0 ? "No resources yet" : "No resources for this track yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {orderedGroups.map((type) => {
            const meta = TYPE_META[type];
            return (
              <div key={type} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">{meta.icon}</span>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/80">
                    {meta.label}s
                  </h3>
                  <span className="text-[10px] text-muted-foreground/50">· {groups[type].length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {groups[type].map((d) => {
                    const tracks = getDocTracks(d.tags);
                    return (
                      <button
                        key={d.id}
                        onClick={() => openDocPreview(d.id)}
                        className={cn(
                          "group flex items-start gap-2.5 p-3 rounded-xl border transition-all text-left hover:shadow-sm hover:-translate-y-px",
                          meta.color
                        )}
                      >
                        <span className="text-lg leading-none mt-0.5">{d.icon || "📄"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{d.title}</p>
                          {tracks.length > 0 && (
                            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                              {tracks.map((t) => (
                                <Badge
                                  key={t}
                                  variant="secondary"
                                  className={`text-[9px] px-1.5 py-0 h-4 ${TRACK_COLORS[t]}`}
                                >
                                  {TRACK_LABEL[t]}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <QuickAddCurriculumDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        departmentId={departmentId}
        onCreated={() => window.location.reload()}
      />
    </section>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
  accent,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
        {accent && <div className="h-0.5 flex-1 rounded-full" style={{ background: `color-mix(in srgb, ${accent} 30%, transparent)` }} />}
      </div>
      {children}
    </section>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

interface ProgramOverviewProps {
  departmentId: string;
  deptName: string;
  docs: Doc[];
  openDocPreview: (id: string) => void;
}

export function ProgramOverview({ departmentId, deptName, docs, openDocPreview }: ProgramOverviewProps) {
  const { isAdmin } = useAuth();
  const { member } = useMyOrbitMembership();

  // Determine active track: member's own track first, admin defaults to first available
  const defaultTrack: OrbitTrack = member?.track ?? "dts";
  const [activeTrack, setActiveTrack] = useState<OrbitTrack>(defaultTrack);

  // Snap to member's track once it loads
  useEffect(() => {
    if (member?.track) setActiveTrack(member.track);
  }, [member?.track]);

  const accent = TRACK_ACCENT[activeTrack];
  const trackLabel = TRACK_LABEL[activeTrack];

  // Filter docs for active track
  const trackDocs = docs.filter((d) => {
    const tracks = getDocTracks(d.tags);
    return tracks.includes(activeTrack) || tracks.length === 0;
  });

  return (
    <div className="space-y-8">
      {/* Admin-only program stats */}
      {isAdmin && <ProgramStats departmentId={departmentId} deptName={deptName} />}

      {/* Track selector — admin sees all; members only see their own */}
      {isAdmin ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">View track</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {TRACK_OPTIONS.map((t) => (
              <button
                key={t.value}
                onClick={() => setActiveTrack(t.value)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  activeTrack === t.value
                    ? "bg-primary text-primary-foreground"
                    : `${TRACK_COLORS[t.value]} hover:opacity-80`
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Member view: show their track name as the heading */
        <div
          className="rounded-xl px-4 py-2.5 border flex items-center gap-2"
          style={{
            background: `color-mix(in srgb, ${accent} 8%, transparent)`,
            borderColor: `color-mix(in srgb, ${accent} 25%, transparent)`,
          }}
        >
          <div className="h-2 w-2 rounded-full" style={{ background: accent }} />
          <span className="text-sm font-semibold" style={{ color: accent }}>
            {trackLabel} Track
          </span>
        </div>
      )}

      {/* Role overview */}
      <Section title="Role Overview" icon={Target} accent={accent}>
        <TrackOverview track={activeTrack} />
      </Section>

      {/* Training hub */}
      <Section title="Training Hub" icon={GraduationCap} accent={accent}>
        <TrainingHub track={activeTrack} />
      </Section>

      {/* Resources & SOPs */}
      <Curriculum
        departmentId={departmentId}
        docs={trackDocs}
        openDocPreview={openDocPreview}
        activeTrack={activeTrack}
        isAdmin={isAdmin}
      />
    </div>
  );
}
