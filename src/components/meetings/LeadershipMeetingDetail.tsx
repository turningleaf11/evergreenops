import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Star, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { SECTION_ORDER, SECTION_META, type AgendaSection } from "@/lib/leadership-agenda";

interface Meeting {
  id: string;
  meeting_date: string;
  meeting_week: string;
  status: string;
  rating: number | null;
  overall_notes: string | null;
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
  title: string;
  assigned_to: string;
  due_date: string | null;
  agenda_item_id: string | null;
}

export function LeadershipMeetingDetail({ meetingId, onBack }: { meetingId: string; onBack: () => void }) {
  const { user, isAdmin } = useAuth();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [mRes, iRes, aRes] = await Promise.all([
      supabase.from("leadership_meetings" as any).select("*").eq("id", meetingId).maybeSingle(),
      supabase.from("meeting_agenda_items" as any).select("*").eq("meeting_id", meetingId).order("sort_order"),
      supabase.from("leadership_meeting_action_items" as any).select("*").eq("meeting_id", meetingId).order("created_at"),
    ]);
    if (mRes.data) setMeeting(mRes.data as any);
    setItems((iRes.data as any) || []);
    setActions((aRes.data as any) || []);
    setLoading(false);
  }, [meetingId]);

  useEffect(() => {
    load();
  }, [load]);

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
    await updateMeeting({ status: "in_progress" });
    await supabase.from("leadership_meetings" as any).update({ started_at: new Date().toISOString() }).eq("id", meetingId);
  };

  const completeMeeting = async () => {
    await updateMeeting({ status: "completed" });
    await supabase.from("leadership_meetings" as any).update({ completed_at: new Date().toISOString() }).eq("id", meetingId);
  };

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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Leadership Meeting</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(meeting.meeting_date), "EEEE, MMM d, yyyy")} · Week of{" "}
              {format(new Date(meeting.meeting_week), "MMM d")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={meeting.status} />
          {meeting.status === "draft" && (
            <Button size="sm" onClick={startMeeting}>Start meeting</Button>
          )}
          {meeting.status === "in_progress" && (
            <Button size="sm" onClick={completeMeeting}>Complete</Button>
          )}
        </div>
      </div>

      {/* Sections */}
      {grouped.map(({ section, items: secItems }) => {
        const meta = SECTION_META[section];
        return (
          <section key={section} className="rounded-xl border border-border/60 bg-card">
            <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">{meta.label}</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">{meta.subtitle}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => addItem(section)} className="text-xs h-7">
                <Plus className="h-3 w-3 mr-1" /> Add Item
              </Button>
            </div>
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
                    canReorderUp={isAdmin && idx > 0}
                    canReorderDown={isAdmin && idx < secItems.length - 1}
                    canDelete={isAdmin}
                    onUpdate={(patch) => updateItem(item.id, patch)}
                    onDelete={() => deleteItem(item.id)}
                    onMoveUp={() => reorder(item.id, "up")}
                    onMoveDown={() => reorder(item.id, "down")}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}

      {/* Conclude / wrap-up */}
      {meeting.status === "completed" || meeting.status === "in_progress" ? (
        <section className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Meeting rating</label>
            <div className="flex items-center gap-1 mt-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => updateMeeting({ rating: n })}
                  className={cn(
                    "h-7 w-7 rounded-md text-xs font-medium transition-colors",
                    (meeting.rating ?? 0) >= n
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/70",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Overall notes</label>
            <Textarea
              className="mt-2 min-h-[80px]"
              placeholder="Wrap-up thoughts, next focus area…"
              defaultValue={meeting.overall_notes ?? ""}
              onBlur={(e) => updateMeeting({ overall_notes: e.target.value })}
            />
          </div>
          {actions.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Action items ({actions.length})
              </label>
              <ul className="mt-2 space-y-1">
                {actions.map((a) => (
                  <li key={a.id} className="text-sm flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>{a.title}</span>
                    {a.due_date && (
                      <span className="text-xs text-muted-foreground">· due {format(new Date(a.due_date), "MMM d")}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : null}
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

function AgendaRow({
  item,
  canReorderUp,
  canReorderDown,
  canDelete,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  item: AgendaItem;
  canReorderUp: boolean;
  canReorderDown: boolean;
  canDelete: boolean;
  onUpdate: (patch: Partial<AgendaItem>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="px-5 py-3 hover:bg-muted/30 transition-colors group">
      <div className="flex items-start gap-3">
        <button
          onClick={() => onUpdate({ status: item.status === "discussed" ? "pending" : "discussed" })}
          className={cn(
            "mt-1 h-3.5 w-3.5 rounded-full border shrink-0 transition-colors",
            item.status === "discussed"
              ? "bg-emerald-500 border-emerald-500"
              : item.status === "tabled"
              ? "bg-amber-500 border-amber-500"
              : "border-muted-foreground/40 hover:border-foreground",
          )}
          title={item.status}
        />
        <div className="flex-1 min-w-0">
          <Input
            defaultValue={item.title}
            onBlur={(e) => e.target.value !== item.title && onUpdate({ title: e.target.value })}
            className="border-0 bg-transparent shadow-none px-0 h-auto py-0 text-sm font-medium focus-visible:ring-0"
          />
          {item.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
          )}
          {expanded && (
            <Textarea
              placeholder="Discussion notes…"
              defaultValue={item.discussion_notes ?? ""}
              onBlur={(e) => e.target.value !== (item.discussion_notes ?? "") && onUpdate({ discussion_notes: e.target.value })}
              className="mt-2 text-xs min-h-[60px]"
            />
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {item.item_type === "auto" && (
            <Badge variant="outline" className="text-[9px] mr-1 h-4 px-1">AUTO</Badge>
          )}
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setExpanded((e) => !e)} title="Notes">
            <Star className="h-3 w-3" />
          </Button>
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
