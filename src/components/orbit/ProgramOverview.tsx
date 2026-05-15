import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TRACK_OPTIONS, TRACK_COLORS, TRACK_LABEL, type OrbitTrack } from "./orbit-types";
import { Search, FileText, Pin, Paperclip, Plus, Download, ExternalLink, Trash2, LayoutGrid, Sparkles, GraduationCap, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyOrbitMembership } from "@/hooks/useMyOrbitMembership";
import { useAuth } from "@/contexts/AuthContext";
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

interface ResourcesProps {
  departmentId: string;
  docs: Doc[];
  openDocPreview: (id: string) => void;
}

// Resource type detection from tags
const TYPE_PRIORITY = ["sop", "script", "playbook", "training", "resource"] as const;
type ResourceType = (typeof TYPE_PRIORITY)[number] | "other";

const TYPE_META: Record<ResourceType, { label: string; icon: string; color: string }> = {
  sop:       { label: "SOP",       icon: "📋", color: "bg-blue-500/10 text-blue-700 border-blue-200/50" },
  script:    { label: "Script",    icon: "💬", color: "bg-amber-500/10 text-amber-700 border-amber-200/50" },
  playbook:  { label: "Playbook",  icon: "🎯", color: "bg-emerald-500/10 text-emerald-700 border-emerald-200/50" },
  training:  { label: "Training",  icon: "🎓", color: "bg-violet-500/10 text-violet-700 border-violet-200/50" },
  resource:  { label: "Resource",  icon: "📚", color: "bg-rose-500/10 text-rose-700 border-rose-200/50" },
  other:     { label: "Reference", icon: "📄", color: "bg-muted text-muted-foreground border-border/50" },
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

// ============== Stats hero ==============
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

// ============== Curriculum (track-first resource view) ==============
function Curriculum({ departmentId, docs, openDocPreview }: ResourcesProps) {
  const { isAdmin } = useAuth();
  const { member } = useMyOrbitMembership();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  // Default to the user's track if they're an Orbit member; otherwise show All
  const [activeTrack, setActiveTrack] = useState<OrbitTrack | "all">(member?.track || "all");

  // If the user's membership loads after mount, snap to their track once
  useEffect(() => {
    if (member?.track && activeTrack === "all") {
      setActiveTrack(member.track);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.track]);

  // Which tracks have any content?
  const tracksWithContent = useMemo(() => {
    const set = new Set<OrbitTrack>();
    docs.forEach((d) => getDocTracks(d.tags).forEach((t) => set.add(t)));
    return TRACK_OPTIONS.filter((t) => set.has(t.value));
  }, [docs]);

  const filtered = docs.filter((d) => {
    if (search.trim()) {
      const s = search.toLowerCase();
      if (!d.title.toLowerCase().includes(s) && !(d.tags ?? []).some((t) => t.toLowerCase().includes(s))) {
        return false;
      }
    }
    if (activeTrack !== "all") {
      const tracks = getDocTracks(d.tags);
      if (!tracks.includes(activeTrack)) return false;
    }
    return true;
  });

  // Group by type within active filter
  const groups: Record<ResourceType, Doc[]> = { sop: [], script: [], playbook: [], training: [], resource: [], other: [] };
  filtered.forEach((d) => { groups[detectType(d.tags)].push(d); });
  const orderedGroups = ([...TYPE_PRIORITY, "other"] as ResourceType[]).filter((g) => groups[g].length > 0);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold flex items-center gap-2 tracking-tight">
            <GraduationCap className="h-4 w-4 text-primary" />
            Curriculum
            <span className="text-xs font-normal text-muted-foreground/60">({docs.length} {docs.length === 1 ? "doc" : "docs"})</span>
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
            placeholder="Search curriculum…"
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Track tabs */}
      <div className="flex items-center gap-1.5 flex-wrap border-b border-border/40 pb-2">
        <button
          onClick={() => setActiveTrack("all")}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
            activeTrack === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          All tracks
        </button>
        {tracksWithContent.map((t) => (
          <button
            key={t.value}
            onClick={() => setActiveTrack(t.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              activeTrack === t.value ? "bg-primary text-primary-foreground" : `${TRACK_COLORS[t.value]} hover:opacity-80`
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {orderedGroups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-2">
            <GraduationCap className="h-6 w-6 mx-auto text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {docs.length === 0 ? "No curriculum yet" : "No matches in this track"}
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
                                <Badge key={t} variant="secondary" className={`text-[9px] px-1.5 py-0 h-4 ${TRACK_COLORS[t]}`}>
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

// ============== Public exports ==============
interface ProgramOverviewProps {
  departmentId: string;
  deptName: string;
  docs: Doc[];
  openDocPreview: (id: string) => void;
}

export function ProgramOverview({ departmentId, deptName, docs, openDocPreview }: ProgramOverviewProps) {
  return (
    <div className="space-y-6">
      <ProgramStats departmentId={departmentId} deptName={deptName} />
      <Curriculum departmentId={departmentId} docs={docs} openDocPreview={openDocPreview} />
    </div>
  );
}
