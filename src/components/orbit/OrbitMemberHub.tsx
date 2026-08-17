// OrbitMemberHub — the full-screen, self-contained experience for orbit-only
// members. Replaces the operator cockpit entirely (see Layout.tsx).
//
// Workbook feel, app navigation: a left-rail "binder edge" on desktop, a
// bottom tab bar on mobile. Five pages — Playbook · Scripts · SOPs · Training
// · Pace — all filtered to the member's own track. Data + content reuse the
// existing Orbit building blocks; this is a presentation shell over them.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useMyOrbitMembership } from "@/hooks/useMyOrbitMembership";
import { useTrackContent } from "@/hooks/useTrackContent";
import {
  RoleOverview,
  GettingStartedChecklist,
  TrainingHub,
  isTrainingDoc,
  docMatchesTrack,
  type Doc,
} from "./ProgramOverview";
import { TRACK_LABEL, TRACK_ACCENT, STATUS_LABEL, type OrbitPerformance, type OrbitStrike } from "./orbit-types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookOpen, MessageSquare, ListChecks, GraduationCap, BarChart3, Search, Loader2, AlertTriangle, LogOut, Sparkles } from "lucide-react";
import { differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

const sb = supabase as any;

// Soft (translucent) variant of any color — works with hex or hsl().
const soft = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

// Convert the workspace accent_color setting (a bare hue "175" or a full
// "h s l" string) into a usable CSS color. Locks the member hub to the
// company brand, independent of per-user themes / --primary.
function accentToCss(value: string | null): string {
  if (!value) return "hsl(175 65% 48%)"; // evergreen fallback
  const parts = value.trim().split(/\s+/);
  if (parts.length >= 3) return `hsl(${parts[0]} ${parts[1]}% ${parts[2]}%)`;
  return `hsl(${parts[0] || "175"} 65% 48%)`;
}

type TabKey = "playbook" | "scripts" | "sops" | "training" | "pace";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "playbook", label: "Playbook", icon: BookOpen },
  { key: "scripts", label: "Scripts", icon: MessageSquare },
  { key: "sops", label: "SOPs", icon: ListChecks },
  { key: "training", label: "Training", icon: GraduationCap },
  { key: "pace", label: "Pace", icon: BarChart3 },
];

function isSharedWithDept(item: { visibility: string; shared_with: any }, deptId: string): boolean {
  if (item.visibility === "workspace" || item.visibility === "team") return true;
  if ((item.visibility === "departments" || item.visibility === "department") && item.shared_with) {
    const sw = typeof item.shared_with === "string" ? JSON.parse(item.shared_with) : item.shared_with;
    return (sw.departmentIds || []).includes(deptId);
  }
  return false;
}

function hasTag(d: Doc, tag: string) {
  return (d.tags ?? []).some((t) => t.toLowerCase() === tag);
}

function initials(name?: string | null) {
  return (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// ── A searchable list of docs (Scripts / SOPs pages) ────────────────────────
function DocPage({
  heading, Icon, accent, docs, emptyHint, onOpen, fallbackIcon,
}: {
  heading: string;
  Icon: any;
  accent: string;
  docs: Doc[];
  emptyHint: string;
  onOpen: (id: string) => void;
  fallbackIcon: string;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    if (!q.trim()) return docs;
    const s = q.toLowerCase();
    return docs.filter((d) => d.title.toLowerCase().includes(s) || (d.tags ?? []).some((t) => t.toLowerCase().includes(s)));
  }, [docs, q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5" style={{ color: accent }} />
        <h2 className="text-lg font-bold tracking-tight">{heading}</h2>
        <span className="text-xs text-muted-foreground/60">· {docs.length}</span>
      </div>

      {docs.length > 4 && (
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${heading.toLowerCase()}…`} className="pl-8 h-9" />
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-1">
            <Icon className="h-6 w-6 mx-auto text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground/70">{q.trim() ? `No matches for "${q}"` : emptyHint}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filtered.map((d) => (
            <button
              key={d.id}
              onClick={() => onOpen(d.id)}
              className="flex items-center gap-3 px-3.5 py-3 rounded-lg border border-border/40 bg-card/40 hover:bg-muted/50 hover:border-border transition-colors text-left"
            >
              <span className="text-lg shrink-0">{d.icon || fallbackIcon}</span>
              <span className="text-sm text-foreground truncate flex-1">{d.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Pace page (member's own KPIs — the accountability layer) ─────────────────
function PacePage({ member, recentPerformance, strikes, accent }: any) {
  const daysOnTrack = differenceInDays(new Date(), new Date(member.track_started_at));
  const daysLeft = Math.max(0, 90 - daysOnTrack);
  const past90 = daysOnTrack >= 90;
  const progress = Math.min(100, (daysOnTrack / 90) * 100);
  const sums = recentPerformance.slice(0, 4).reduce(
    (a: any, p: any) => ({
      calls: a.calls + (p.calls_made || 0),
      appts: a.appts + (p.appointments_set || 0),
      conv: a.conv + (p.conversations || 0),
      deals: a.deals + (p.deals_closed || 0),
    }),
    { calls: 0, appts: 0, conv: 0, deals: 0 },
  );

  const stat = (label: string, value: number, hot = false) => (
    <div className="rounded-lg bg-muted/40 p-3 text-center">
      <p className="text-xl font-bold" style={hot ? { color: accent } : undefined}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5" style={{ color: accent }} />
        <h2 className="text-lg font-bold tracking-tight">My pace</h2>
      </div>

      {strikes.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">You have <strong>{strikes.length}/3 strikes</strong>. Stay locked in.</p>
        </div>
      )}

      <Card>
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Day {daysOnTrack} of 90</span>
            <span className={cn("font-medium", past90 ? "text-amber-600" : "text-muted-foreground")}>
              {past90 ? "Track review due" : `${daysLeft} days left`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full transition-all" style={{ width: `${progress}%`, background: past90 ? "#F59E0B" : accent }} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Last 4 weeks</p>
          {recentPerformance.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {stat("Calls", sums.calls)}
              {stat("Appts", sums.appts)}
              {stat("Conv", sums.conv)}
              {stat("Deals", sums.deals, true)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground/60 italic text-center py-2">
              No performance data yet — your director will start tracking soon.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function OrbitMemberHub() {
  const { profile, signOut } = useAuth();
  const { member: primaryMember, members, recentPerformance: primaryPerformance, strikes: primaryStrikes, loading } = useMyOrbitMembership();
  const [tab, setTab] = useState<TabKey>("playbook");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [previewDoc, setPreviewDoc] = useState<{ id: string; title: string; content: string | null; author_name: string | null } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Someone can hold more than one active track at once (e.g. DTA + DTB) —
  // the workbook shows one at a time, defaulting to the primary (earliest
  // track_started_at), with a switcher when there's more than one active.
  const activeMembers = useMemo(() => members.filter((m) => m.status === "active"), [members]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const member = activeMembers.find((m) => m.id === selectedMemberId) ?? primaryMember;
  const track = member?.track ?? null;

  // Pace data only comes pre-fetched for the primary member from the hook —
  // fetch it separately when the switcher picks a different track.
  const [switchedPace, setSwitchedPace] = useState<{ recentPerformance: OrbitPerformance[]; strikes: OrbitStrike[] } | null>(null);
  useEffect(() => {
    if (!member || member.id === primaryMember?.id) { setSwitchedPace(null); return; }
    let cancelled = false;
    (async () => {
      const [perfRes, strikesRes] = await Promise.all([
        sb.from("orbit_performance_snapshots").select("*").eq("member_id", member.id).order("snapshot_date", { ascending: false }).limit(6),
        sb.from("orbit_strikes").select("*").eq("member_id", member.id).order("strike_number", { ascending: true }),
      ]);
      if (!cancelled) setSwitchedPace({ recentPerformance: perfRes.data ?? [], strikes: strikesRes.data ?? [] });
    })();
    return () => { cancelled = true; };
  }, [member?.id, primaryMember?.id]);
  const recentPerformance = switchedPace?.recentPerformance ?? primaryPerformance;
  const strikes = switchedPace?.strikes ?? primaryStrikes;

  const { content } = useTrackContent(track ?? "dts");
  const { accentColor } = useWorkspace();
  // Lock the hub to the workspace brand color (Settings → Accent Color),
  // independent of per-user themes — Orbit is a company-branded surface.
  const accent = accentToCss(accentColor);

  useEffect(() => {
    if (!primaryMember?.department_id) return;
    (async () => {
      const { data } = await sb.from("documents").select("id, title, author_name, updated_at, visibility, shared_with, tags, icon");
      const all = (data ?? []) as (Doc & { visibility: string; shared_with: any })[];
      setDocs(all.filter((d) => isSharedWithDept(d, primaryMember.department_id)));
    })();
  }, [primaryMember?.department_id]);

  const openDoc = async (docId: string) => {
    const { data } = await sb.from("documents").select("id, title, content, author_name").eq("id", docId).single();
    if (data) { setPreviewDoc(data); setSheetOpen(true); }
  };

  const scripts = useMemo(() => docs.filter((d) => !isTrainingDoc(d) && docMatchesTrack(d, track) && hasTag(d, "script")), [docs, track]);
  const sops = useMemo(() => docs.filter((d) => !isTrainingDoc(d) && docMatchesTrack(d, track) && hasTag(d, "sop")), [docs, track]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your workbook…
      </div>
    );
  }

  if (!member || !track) {
    return (
      <div className="h-screen flex items-center justify-center p-6">
        <Card className="max-w-sm">
          <CardContent className="p-8 text-center space-y-2">
            <Sparkles className="h-6 w-6 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-foreground/80">You're not in an Orbit track yet.</p>
            <p className="text-xs text-muted-foreground/70">Your director will add you to a track to unlock your workbook.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderPage = () => {
    switch (tab) {
      case "playbook":
        return (
          <div className="space-y-5">
            <RoleOverview track={track} content={content} accent={accent} />
            <GettingStartedChecklist track={track} content={content} memberId={member.id} isOwnView accent={accent} />
          </div>
        );
      case "scripts":
        return <DocPage heading="Scripts" Icon={MessageSquare} accent={accent} docs={scripts} fallbackIcon="💬" emptyHint={`No scripts tagged for ${TRACK_LABEL[track]} yet.`} onOpen={openDoc} />;
      case "sops":
        return <DocPage heading="SOPs" Icon={ListChecks} accent={accent} docs={sops} fallbackIcon="📋" emptyHint={`No SOPs tagged for ${TRACK_LABEL[track]} yet.`} onOpen={openDoc} />;
      case "training":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" style={{ color: accent }} />
              <h2 className="text-lg font-bold tracking-tight">Training</h2>
            </div>
            <TrainingHub track={track} docs={docs} openDocPreview={openDoc} accent={accent} />
          </div>
        );
      case "pace":
        return <PacePage member={member} recentPerformance={recentPerformance} strikes={strikes} accent={accent} />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header — workbook cover strip */}
      <header className="shrink-0 border-b border-border/40">
        <div className="h-1" style={{ background: accent }} />
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Orbit · Your track</p>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate" style={{ color: accent }}>
              {content.full_name}
            </h1>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
                <Avatar className="h-9 w-9">
                  {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                  <AvatarFallback className="text-xs" style={{ background: soft(accent, 12), color: accent }}>
                    {initials(profile?.full_name)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="truncate">
                {profile?.full_name || "Member"}
                <span className="block text-[11px] font-normal text-muted-foreground">{STATUS_LABEL[member.status]} · {TRACK_LABEL[track]}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()}>
                <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {activeMembers.length > 1 && (
          <div className="flex items-center gap-1.5 px-4 sm:px-6 pb-3">
            {activeMembers.map((m) => {
              const on = m.id === member.id;
              const trackAccent = TRACK_ACCENT[m.track];
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMemberId(m.id)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide transition-colors"
                  style={on
                    ? { background: soft(trackAccent, 15), color: trackAccent }
                    : { color: "var(--muted-foreground)" }}
                >
                  {TRACK_LABEL[m.track]}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Body — desktop left rail + content */}
      <div className="flex-1 flex min-h-0">
        {/* Desktop binder rail */}
        <nav className="hidden md:flex flex-col w-52 shrink-0 border-r border-border/40 py-3 px-2 gap-0.5">
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
                  on ? "font-medium" : "text-muted-foreground hover:bg-muted/50",
                )}
                style={on ? { background: soft(accent, 10), color: accent } : undefined}
              >
                <t.icon className="h-4 w-4 shrink-0" />
                {t.label}
              </button>
            );
          })}
        </nav>

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 pb-24 md:pb-8">
          <div className="max-w-2xl mx-auto">{renderPage()}</div>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden shrink-0 border-t border-border/40 bg-background/95 backdrop-blur-md grid grid-cols-5">
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex flex-col items-center gap-0.5 py-2.5"
              style={{ color: on ? accent : undefined }}
            >
              <t.icon className={cn("h-5 w-5", !on && "text-muted-foreground")} />
              <span className={cn("text-[10px]", on ? "font-medium" : "text-muted-foreground")}>{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Doc preview */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg pr-8">{previewDoc?.title}</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            {previewDoc?.author_name && <p className="text-xs text-muted-foreground mb-4">By {previewDoc.author_name}</p>}
            {previewDoc?.content ? (
              <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: previewDoc.content }} />
            ) : (
              <p className="text-sm text-muted-foreground italic">No content yet</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
