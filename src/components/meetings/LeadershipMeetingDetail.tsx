import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Star, Loader2, Video,
  ChevronRight, Check, Clock, X, ExternalLink, ListChecks, CheckCircle2, CalendarPlus,
} from "lucide-react";
import { format, differenceInSeconds, startOfWeek, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { SECTION_ORDER, SECTION_META, type AgendaSection, createLeadershipMeetingWithAgenda } from "@/lib/leadership-agenda";

interface Meeting {
  id: string;
  meeting_date: string;
  meeting_week: string;
  status: string;
  rating: number | null;
  overall_notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  workspace_id: string | null;
}

interface AgendaItem {
  id: string;
  meeting_id: string;
  section: AgendaSection;
  item_type: "auto" | "manual";
  title: string;
  description: string | null;
  status: string;
  discussion_notes: string | null;
  reference_type: string | null;
  reference_id: string | null;
  sort_order: number;
}

interface ActionItem {
  id: string;
  meeting_id: string;
  agenda_item_id: string | null;
  title: string;
  assigned_to: string;
  due_date: string | null;
  converted_to_task_id: string | null;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

const REFERENCE_LINKS: Record<string, (id: string) => { label: string; to: string }> = {
  issue: (id) => ({ label: "Issue", to: `/issues?id=${id}` }),
  goal: (id) => ({ label: "Goal", to: `/execution?goal=${id}` }),
  task: (id) => ({ label: "Task", to: `/tasks/${id}` }),
  scorecard_metric: () => ({ label: "Metric", to: `/scorecard` }),
  strategy_item: () => ({ label: "Strategy", to: `/leadership` }),
};

export function LeadershipMeetingDetail({ meetingId, onBack }: { meetingId: string; onBack: () => void }) {
  const { user, isAdmin } = useAuth();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<AgendaSection>>(new Set());
  const [fathomMeeting, setFathomMeeting] = useState<{ id: string; recording_url: string | null } | null>(null);
  const [elapsedTick, setElapsedTick] = useState(0);
  const [creatingNext, setCreatingNext] = useState(false);
  const [nextMeetingId, setNextMeetingId] = useState<string | null>(null);

  // Auto-save shared notes
  const [notesDraft, setNotesDraft] = useState<string>("");
  const notesTimer = useRef<number | null>(null);
  const notesDirty = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [mRes, iRes, aRes, pRes] = await Promise.all([
      supabase.from("leadership_meetings" as any).select("*").eq("id", meetingId).maybeSingle(),
      supabase.from("meeting_agenda_items" as any).select("*").eq("meeting_id", meetingId).order("sort_order"),
      supabase.from("leadership_meeting_action_items" as any).select("*").eq("meeting_id", meetingId).order("created_at"),
      supabase.from("profiles").select("user_id, full_name, avatar_url"),
    ]);
    if (mRes.data) {
      const m = mRes.data as any as Meeting;
      setMeeting(m);
      setNotesDraft(m.overall_notes ?? "");
    }
    setItems((iRes.data as any) || []);
    setActions((aRes.data as any) || []);
    setProfiles((pRes.data as any) || []);
    setLoading(false);
  }, [meetingId]);

  useEffect(() => { load(); }, [load]);

  // Look up Fathom recording for this meeting date
  useEffect(() => {
    if (!meeting) return;
    const date = meeting.meeting_date;
    const start = `${date}T00:00:00`;
    const end = `${date}T23:59:59`;
    supabase
      .from("meetings")
      .select("id, recording_url")
      .gte("started_at", start)
      .lte("started_at", end)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setFathomMeeting((data as any) || null));
  }, [meeting?.meeting_date]);

  // Elapsed-time ticker for in_progress
  useEffect(() => {
    if (meeting?.status !== "in_progress") return;
    const t = window.setInterval(() => setElapsedTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [meeting?.status]);

  // Auto-save shared notes every 30s
  useEffect(() => {
    if (notesTimer.current) window.clearInterval(notesTimer.current);
    notesTimer.current = window.setInterval(() => {
      if (notesDirty.current && meeting) {
        notesDirty.current = false;
        supabase.from("leadership_meetings" as any).update({ overall_notes: notesDraft }).eq("id", meetingId);
      }
    }, 30000);
    return () => {
      if (notesTimer.current) window.clearInterval(notesTimer.current);
    };
  }, [notesDraft, meetingId, meeting]);

  // Flush notes on unmount
  useEffect(() => {
    return () => {
      if (notesDirty.current && meeting) {
        supabase.from("leadership_meetings" as any).update({ overall_notes: notesDraft }).eq("id", meetingId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateMeeting = async (patch: Partial<Meeting>) => {
    setMeeting((m) => (m ? { ...m, ...patch } : m));
    await supabase.from("leadership_meetings" as any).update(patch).eq("id", meetingId);
  };

  const updateItem = async (id: string, patch: Partial<AgendaItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    await supabase.from("meeting_agenda_items" as any).update(patch).eq("id", id);
  };

  const deleteItem = async (id: string) => {
    if (!isAdmin) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("meeting_agenda_items" as any).delete().eq("id", id);
  };

  const reorder = async (id: string, dir: "up" | "down") => {
    if (!isAdmin) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const sectionItems = items.filter((i) => i.section === item.section).sort((a, b) => a.sort_order - b.sort_order);
    const idx = sectionItems.findIndex((i) => i.id === id);
    const swap = dir === "up" ? sectionItems[idx - 1] : sectionItems[idx + 1];
    if (!swap) return;
    const a = item.sort_order;
    const b = swap.sort_order;
    await Promise.all([
      supabase.from("meeting_agenda_items" as any).update({ sort_order: b }).eq("id", item.id),
      supabase.from("meeting_agenda_items" as any).update({ sort_order: a }).eq("id", swap.id),
    ]);
    load();
  };

  const addItem = async (section: AgendaSection) => {
    const sectionItems = items.filter((i) => i.section === section);
    const maxOrder = sectionItems.reduce((m, i) => Math.max(m, i.sort_order), 0);
    const { data, error } = await supabase
      .from("meeting_agenda_items" as any)
      .insert({
        meeting_id: meetingId,
        section,
        item_type: "manual",
        title: "New discussion item",
        sort_order: maxOrder + 10,
        added_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) {
      toast({ title: "Could not add item", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => [...prev, data as any]);
  };

  const startMeeting = async () => {
    const startedAt = new Date().toISOString();
    setMeeting((m) => (m ? { ...m, status: "in_progress", started_at: startedAt } : m));
    await supabase.from("leadership_meetings" as any).update({ status: "in_progress", started_at: startedAt }).eq("id", meetingId);
  };

  const completeMeeting = async () => {
    if (meeting?.rating == null) {
      toast({ title: "Rating required", description: "Please rate this meeting (1–10) before ending.", variant: "destructive" });
      // scroll to conclude section
      document.getElementById("conclude-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    // flush notes
    if (notesDirty.current) {
      await supabase.from("leadership_meetings" as any).update({ overall_notes: notesDraft }).eq("id", meetingId);
      notesDirty.current = false;
    }
    const completedAt = new Date().toISOString();
    setMeeting((m) => (m ? { ...m, status: "completed", completed_at: completedAt } : m));
    await supabase.from("leadership_meetings" as any).update({ status: "completed", completed_at: completedAt }).eq("id", meetingId);
    toast({ title: "Meeting complete", description: "Action items are now in Execution Hub for assignees." });
  };

  const addAction = async (input: { title: string; assigned_to: string; due_date: string | null; convertToTask: boolean; agendaItemId: string | null }) => {
    let convertedTaskId: string | null = null;
    if (input.convertToTask) {
      const { data: task, error: taskErr } = await supabase
        .from("tasks")
        .insert({
          title: input.title,
          description: "From leadership meeting action item",
          assigned_to: input.assigned_to,
          created_by: user?.id ?? null,
          status: "todo",
          priority: "medium",
          due_date: input.due_date,
          workspace_id: meeting?.workspace_id ?? null,
        })
        .select("id")
        .single();
      if (taskErr) {
        toast({ title: "Could not create task", description: taskErr.message, variant: "destructive" });
      } else {
        convertedTaskId = (task as any).id;
      }
    }
    const { data, error } = await supabase
      .from("leadership_meeting_action_items" as any)
      .insert({
        meeting_id: meetingId,
        agenda_item_id: input.agendaItemId,
        title: input.title,
        assigned_to: input.assigned_to,
        due_date: input.due_date,
        converted_to_task_id: convertedTaskId,
      })
      .select()
      .single();
    if (error) {
      toast({ title: "Could not add action item", description: error.message, variant: "destructive" });
      return;
    }
    setActions((prev) => [...prev, data as any]);
  };

  const removeAction = async (id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
    await supabase.from("leadership_meeting_action_items" as any).delete().eq("id", id);
  };

  const scheduleNextMeeting = async () => {
    if (!isAdmin) return;
    setCreatingNext(true);
    try {
      const baseMonday = startOfWeek(new Date(meeting!.meeting_week + "T00:00:00"), { weekStartsOn: 1 });
      const nextThursday = addDays(baseMonday, 7 + 3); // next week's Thursday
      const { id, created } = await createLeadershipMeetingWithAgenda({
        meetingDate: nextThursday,
        createdBy: user?.id ?? null,
        workspaceId: meeting?.workspace_id ?? null,
      });
      setNextMeetingId(id);
      toast({
        title: created ? "Next meeting scheduled" : "Already scheduled",
        description: format(nextThursday, "EEEE, MMM d"),
      });
    } catch (e: any) {
      toast({ title: "Could not schedule", description: e.message, variant: "destructive" });
    } finally {
      setCreatingNext(false);
    }
  };

  const elapsedSec = useMemo(() => {
    if (!meeting?.started_at) return 0;
    const end = meeting.completed_at ? new Date(meeting.completed_at) : new Date();
    return Math.max(0, differenceInSeconds(end, new Date(meeting.started_at)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.started_at, meeting?.completed_at, elapsedTick]);

  if (loading || !meeting) {
    return (
      <div className="p-8 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading meeting…
      </div>
    );
  }

  const grouped = SECTION_ORDER.map((section) => ({
    section,
    items: items.filter((i) => i.section === section).sort((a, b) => a.sort_order - b.sort_order),
  }));

  const discussedCount = items.filter((i) => i.status === "discussed" || i.status === "resolved").length;
  const resolvedCount = items.filter((i) => i.status === "resolved").length;
  const isReadOnly = meeting.status === "completed";
  const profileById = (id: string) => profiles.find((p) => p.user_id === id);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Leadership Meeting</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <p className="text-xs text-muted-foreground">
                {format(new Date(meeting.meeting_date), "EEEE, MMM d, yyyy")} · Week of{" "}
                {format(new Date(meeting.meeting_week), "MMM d")}
              </p>
              {meeting.started_at && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> {fmtElapsed(elapsedSec)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={meeting.status} />
          {meeting.status === "draft" && isAdmin && (
            <Button size="sm" onClick={startMeeting}>Start Meeting</Button>
          )}
          {meeting.status === "in_progress" && (
            <Button size="sm" onClick={completeMeeting}>End Meeting</Button>
          )}
        </div>
      </div>

      {/* Fathom recording link */}
      {fathomMeeting && (
        <a
          href={fathomMeeting.recording_url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center gap-2 rounded-lg border border-border/60 bg-card hover:bg-muted/30 px-3 py-2 text-xs transition-colors",
            !fathomMeeting.recording_url && "pointer-events-none opacity-70",
          )}
        >
          <Video className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium">Fathom Recording Available</span>
          {fathomMeeting.recording_url && (
            <span className="ml-auto inline-flex items-center gap-1 text-primary">
              Open <ExternalLink className="h-3 w-3" />
            </span>
          )}
        </a>
      )}

      {/* Post-meeting summary card */}
      {isReadOnly && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-semibold">Meeting Summary</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <Stat label="Date" value={format(new Date(meeting.meeting_date), "MMM d")} />
            <Stat label="Rating" value={meeting.rating != null ? `${meeting.rating}/10` : "—"} />
            <Stat label="Discussed" value={`${discussedCount} of ${items.length}`} />
            <Stat label="Action items" value={String(actions.length)} />
          </div>
          {isAdmin && (
            <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-muted-foreground">Schedule next week's Thursday meeting?</p>
              {nextMeetingId ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                  <Check className="h-3 w-3" /> Scheduled
                </span>
              ) : (
                <Button size="sm" variant="outline" onClick={scheduleNextMeeting} disabled={creatingNext}>
                  {creatingNext ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CalendarPlus className="h-3 w-3 mr-1" />}
                  Schedule next meeting
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sections */}
      {grouped.map(({ section, items: secItems }) => {
        const meta = SECTION_META[section];
        const isCollapsed = collapsed.has(section);
        const sectionActions = actions.filter((a) => secItems.some((i) => i.id === a.agenda_item_id));
        return (
          <section key={section} className="rounded-xl border border-border/60 bg-card">
            <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between">
              <button
                onClick={() => {
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    next.has(section) ? next.delete(section) : next.add(section);
                    return next;
                  });
                }}
                className="flex items-center gap-2 text-left flex-1 group"
              >
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground transition-transform",
                    !isCollapsed && "rotate-90",
                  )}
                />
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground group-hover:text-primary transition-colors">
                    {meta.label}
                    <span className="ml-2 text-[10px] font-normal text-muted-foreground normal-case tracking-normal">
                      {secItems.length} item{secItems.length === 1 ? "" : "s"}
                      {sectionActions.length > 0 && ` · ${sectionActions.length} action${sectionActions.length === 1 ? "" : "s"}`}
                    </span>
                  </h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{meta.subtitle}</p>
                </div>
              </button>
              {isAdmin && !isReadOnly && (
                <Button size="sm" variant="ghost" onClick={() => addItem(section)} className="text-xs h-7">
                  <Plus className="h-3 w-3 mr-1" /> Add Item
                </Button>
              )}
            </div>
            {!isCollapsed && (
              <div className="divide-y divide-border/40">
                {secItems.length === 0 ? (
                  <div className="px-5 py-6 text-xs text-muted-foreground italic text-center">
                    No items in this section.
                  </div>
                ) : (
                  secItems.map((item, idx) => (
                    <AgendaRow
                      key={item.id}
                      item={item}
                      profiles={profiles}
                      actions={actions.filter((a) => a.agenda_item_id === item.id)}
                      readOnly={isReadOnly}
                      canReorderUp={isAdmin && !isReadOnly && idx > 0}
                      canReorderDown={isAdmin && !isReadOnly && idx < secItems.length - 1}
                      canDelete={isAdmin && !isReadOnly}
                      currentUserId={user?.id ?? null}
                      onUpdate={(patch) => updateItem(item.id, patch)}
                      onDelete={() => deleteItem(item.id)}
                      onMoveUp={() => reorder(item.id, "up")}
                      onMoveDown={() => reorder(item.id, "down")}
                      onAddAction={(input) => addAction({ ...input, agendaItemId: item.id })}
                      onRemoveAction={removeAction}
                      profileById={profileById}
                    />
                  ))
                )}
              </div>
            )}
          </section>
        );
      })}

      {/* Leadership Notes — shared, auto-saved */}
      <section className="rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider">Leadership Notes</h2>
          <span className="text-[10px] text-muted-foreground">Auto-saves every 30s</span>
        </div>
        <Textarea
          value={notesDraft}
          onChange={(e) => {
            setNotesDraft(e.target.value);
            notesDirty.current = true;
          }}
          onBlur={() => {
            if (notesDirty.current) {
              notesDirty.current = false;
              supabase.from("leadership_meetings" as any).update({ overall_notes: notesDraft }).eq("id", meetingId);
            }
          }}
          placeholder="Shared notes — anyone in the meeting can type here…"
          className="min-h-[120px] text-sm"
          disabled={isReadOnly}
        />
      </section>

      {/* Conclude */}
      {meeting.status !== "draft" && (
        <section id="conclude-section" className="rounded-xl border border-border/60 bg-card p-5 space-y-5">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider">Conclude</h2>
          </div>

          {/* All action items summary */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Action Items ({actions.length})
            </label>
            {actions.length === 0 ? (
              <p className="text-xs text-muted-foreground italic mt-2">No action items captured yet.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {actions.map((a) => {
                  const assignee = profileById(a.assigned_to);
                  return (
                    <li key={a.id} className="flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2">
                      <Avatar className="h-5 w-5">
                        {assignee?.avatar_url && <AvatarImage src={assignee.avatar_url} />}
                        <AvatarFallback className="text-[9px]">
                          {(assignee?.full_name || "?").slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm flex-1">{a.title}</span>
                      {a.due_date && (
                        <span className="text-[10px] text-muted-foreground">
                          due {format(new Date(a.due_date), "MMM d")}
                        </span>
                      )}
                      {a.converted_to_task_id ? (
                        <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20">
                          Task created
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px]">Note only</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Rating */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Meeting Rating <span className="text-destructive">*</span>
            </label>
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  disabled={isReadOnly}
                  onClick={() => updateMeeting({ rating: n })}
                  className={cn(
                    "h-8 w-8 rounded-md text-xs font-medium transition-colors disabled:opacity-60",
                    (meeting.rating ?? 0) >= n
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/70",
                  )}
                >
                  {n}
                </button>
              ))}
              {meeting.rating != null && (
                <span className="ml-2 text-xs text-muted-foreground">{meeting.rating}/10</span>
              )}
            </div>
          </div>

          {/* End Meeting button */}
          {meeting.status === "in_progress" && (
            <div className="pt-2 flex justify-end">
              <Button onClick={completeMeeting}>
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> End Meeting
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function fmtElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
    in_progress: { label: "In Progress", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    completed: { label: "Completed", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  };
  const v = map[status] || map.draft;
  return <Badge className={cn("text-[10px] font-medium", v.cls)} variant="outline">{v.label}</Badge>;
}

interface AgendaRowProps {
  item: AgendaItem;
  profiles: Profile[];
  actions: ActionItem[];
  readOnly: boolean;
  canReorderUp: boolean;
  canReorderDown: boolean;
  canDelete: boolean;
  currentUserId: string | null;
  onUpdate: (patch: Partial<AgendaItem>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddAction: (input: { title: string; assigned_to: string; due_date: string | null; convertToTask: boolean }) => Promise<void>;
  onRemoveAction: (id: string) => Promise<void>;
  profileById: (id: string) => Profile | undefined;
}

function AgendaRow({
  item, profiles, actions, readOnly,
  canReorderUp, canReorderDown, canDelete, currentUserId,
  onUpdate, onDelete, onMoveUp, onMoveDown, onAddAction, onRemoveAction, profileById,
}: AgendaRowProps) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [aTitle, setATitle] = useState("");
  const [aAssignee, setAAssignee] = useState<string>(currentUserId ?? "");
  const [aDue, setADue] = useState<Date | undefined>(undefined);
  const [aConvert, setAConvert] = useState(true);
  const [saving, setSaving] = useState(false);

  const ref = item.reference_type && item.reference_id ? REFERENCE_LINKS[item.reference_type]?.(item.reference_id) : null;

  const statusBtn = (val: "discussed" | "resolved" | "tabled", label: string, cls: string) => (
    <button
      disabled={readOnly}
      onClick={() => onUpdate({ status: item.status === val ? "pending" : val })}
      className={cn(
        "text-[10px] font-medium px-2 py-0.5 rounded-md border transition-colors disabled:opacity-60",
        item.status === val ? cls : "border-border/60 text-muted-foreground hover:bg-muted/50",
      )}
    >
      {label}
    </button>
  );

  const submitAction = async () => {
    if (!aTitle.trim() || !aAssignee) return;
    setSaving(true);
    await onAddAction({
      title: aTitle.trim(),
      assigned_to: aAssignee,
      due_date: aDue ? aDue.toISOString().slice(0, 10) : null,
      convertToTask: aConvert,
    });
    setSaving(false);
    setATitle("");
    setADue(undefined);
    setAdding(false);
  };

  return (
    <div className="px-5 py-3 hover:bg-muted/20 transition-colors group">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-1.5 h-2 w-2 rounded-full shrink-0",
            item.status === "resolved" ? "bg-emerald-500" :
            item.status === "discussed" ? "bg-primary" :
            item.status === "tabled" ? "bg-amber-500" : "bg-muted-foreground/30",
          )}
          title={item.status}
        />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              defaultValue={item.title}
              disabled={readOnly}
              onBlur={(e) => e.target.value !== item.title && onUpdate({ title: e.target.value })}
              className="border-0 bg-transparent shadow-none px-0 h-auto py-0 text-sm font-medium focus-visible:ring-0 flex-1 min-w-[200px]"
            />
            {item.item_type === "auto" && (
              <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">AUTO</Badge>
            )}
            {ref && (
              <Link
                to={ref.to}
                className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline shrink-0"
              >
                → View {ref.label}
              </Link>
            )}
          </div>
          {item.description && (
            <p className="text-xs text-muted-foreground">{item.description}</p>
          )}

          {/* Status buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {statusBtn("discussed", "Mark Discussed", "bg-primary/10 text-primary border-primary/30")}
            {statusBtn("resolved", "Mark Resolved", "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30")}
            {statusBtn("tabled", "Table It", "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30")}
            <button
              onClick={() => setNotesOpen((v) => !v)}
              className="text-[10px] font-medium px-2 py-0.5 rounded-md border border-border/60 text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              {notesOpen ? "Hide notes" : (item.discussion_notes ? "Edit notes" : "+ Notes")}
            </button>
            {!readOnly && (
              <button
                onClick={() => setAdding((v) => !v)}
                className="text-[10px] font-medium px-2 py-0.5 rounded-md border border-border/60 text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                + Action Item
              </button>
            )}
          </div>

          {/* Notes */}
          {notesOpen && (
            <Textarea
              placeholder="Discussion notes — anyone can add…"
              defaultValue={item.discussion_notes ?? ""}
              disabled={readOnly}
              onBlur={(e) => e.target.value !== (item.discussion_notes ?? "") && onUpdate({ discussion_notes: e.target.value })}
              className="text-xs min-h-[60px] mt-1"
            />
          )}

          {/* Existing actions on this item */}
          {actions.length > 0 && (
            <ul className="space-y-1 mt-2">
              {actions.map((a) => {
                const assignee = profileById(a.assigned_to);
                return (
                  <li key={a.id} className="flex items-center gap-2 text-xs rounded-md bg-muted/30 px-2 py-1">
                    <Check className="h-3 w-3 text-primary shrink-0" />
                    <span className="flex-1 truncate">{a.title}</span>
                    {assignee && (
                      <span className="text-muted-foreground">{assignee.full_name?.split(" ")[0]}</span>
                    )}
                    {a.due_date && (
                      <span className="text-muted-foreground">{format(new Date(a.due_date), "MMM d")}</span>
                    )}
                    {a.converted_to_task_id && (
                      <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20 h-4 px-1">Task</Badge>
                    )}
                    {!readOnly && (
                      <button onClick={() => onRemoveAction(a.id)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Add action inline form */}
          {adding && !readOnly && (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2 mt-2">
              <Input
                autoFocus
                placeholder="Action item…"
                value={aTitle}
                onChange={(e) => setATitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitAction(); }}
                className="h-8 text-sm"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs justify-start gap-1.5">
                      <Avatar className="h-4 w-4">
                        {profileById(aAssignee)?.avatar_url && <AvatarImage src={profileById(aAssignee)!.avatar_url!} />}
                        <AvatarFallback className="text-[8px]">
                          {(profileById(aAssignee)?.full_name || "?").slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      {profileById(aAssignee)?.full_name?.split(" ")[0] || "Assign"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-1 max-h-64 overflow-y-auto" align="start">
                    {profiles.map((p) => (
                      <button
                        key={p.user_id}
                        onClick={() => setAAssignee(p.user_id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-muted",
                          aAssignee === p.user_id && "bg-muted",
                        )}
                      >
                        <Avatar className="h-5 w-5">
                          {p.avatar_url && <AvatarImage src={p.avatar_url} />}
                          <AvatarFallback className="text-[9px]">{(p.full_name || "?").slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        {p.full_name || "Unnamed"}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      {aDue ? format(aDue, "MMM d") : "Due date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={aDue}
                      onSelect={setADue}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>

                <label className="flex items-center gap-1.5 text-xs text-muted-foreground ml-1">
                  <Switch checked={aConvert} onCheckedChange={setAConvert} className="scale-75" />
                  Convert to Task
                </label>

                <div className="ml-auto flex items-center gap-1.5">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(false)}>Cancel</Button>
                  <Button size="sm" className="h-7 text-xs" onClick={submitAction} disabled={saving || !aTitle.trim()}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {canReorderUp && (
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onMoveUp}>
              <ChevronUp className="h-3 w-3" />
            </Button>
          )}
          {canReorderDown && (
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onMoveDown}>
              <ChevronDown className="h-3 w-3" />
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
