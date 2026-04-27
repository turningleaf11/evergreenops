import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Loader2,
  NotebookPen,
  Mail,
  Phone,
  Send,
  Reply,
  Trash2,
  Paperclip,
  AtSign,
  FileText,
  RefreshCw,
  CheckSquare,
  Square as SquareIcon,
  ExternalLink,
  Pin,
  PinOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { triggerFileInput, uploadFile } from "@/lib/file-upload";
import { InlineEmailComposer } from "./InlineEmailComposer";
import { ActivityComposer, type ActivitySubmitPayload } from "@/components/activity/ActivityComposer";

interface Contact {
  id: string;
  workspace_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
}

interface CrmActivity {
  id: string;
  type: string; // note | email | call | meeting | sms | stage_change | ...
  subject: string | null;
  body: string | null;
  occurred_at: string;
  actor_id: string | null;
  metadata: Record<string, any> | null;
  is_pinned?: boolean | null;
}

interface EntityEvent {
  id: string;
  action: string;
  metadata: Record<string, any> | null;
  actor_id: string | null;
  created_at: string;
}

interface CrmTask {
  id: string;
  title: string;
  due_date: string | null;
  is_complete: boolean;
  assigned_to: string | null;
  deal_id: string | null;
  deal_title?: string | null;
  deal_address?: string | null;
  created_at: string;
}

type FilterId = "all" | "notes" | "emails" | "calls" | "files" | "updates" | "tasks";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "notes", label: "Notes" },
  { id: "emails", label: "Emails" },
  { id: "calls", label: "Calls" },
  { id: "files", label: "Files" },
  { id: "updates", label: "Updates" },
  { id: "tasks", label: "Tasks" },
];

const NOTE_BG = "#FFF7B8"; // warm post-it yellow
const NOTE_BG_SOFT = "#FFFBE0"; // softer composer background
const NOTE_SHADOW = "0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(180,150,40,0.10)";

const TYPE_STYLE: Record<
  string,
  { icon: any; bg: string; fg: string }
> = {
  note: { icon: NotebookPen, bg: "bg-[#FCE588]", fg: "text-amber-800" },
  email: { icon: Mail, bg: "bg-emerald-100", fg: "text-emerald-700" },
  call: { icon: Phone, bg: "bg-orange-100", fg: "text-orange-700" },
  file: { icon: FileText, bg: "bg-violet-100", fg: "text-violet-700" },
  update: { icon: RefreshCw, bg: "bg-muted", fg: "text-muted-foreground" },
};

const initials = (n: string) =>
  n
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const timeAgo = (d: string) => {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const dayBucket = (d: string): "TODAY" | "YESTERDAY" | "LAST WEEK" | "OLDER" => {
  const now = new Date();
  const date = new Date(d);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const ts = date.getTime();
  if (ts >= startOfToday) return "TODAY";
  if (ts >= startOfToday - 86400000) return "YESTERDAY";
  if (ts >= startOfToday - 7 * 86400000) return "LAST WEEK";
  return "OLDER";
};

/**
 * Top composer (Note / Email / Log Call) for a contact.
 * Mounted ABOVE the tab bar so it's always visible regardless of active tab.
 */
export function ContactComposer({
  contact,
  onPosted,
}: {
  contact: Contact;
  onPosted?: () => void;
}) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"note" | "email" | "call">("note");

  // Note composer (rich)
  const [savingNote, setSavingNote] = useState(false);

  // Call composer
  const [callOutcome, setCallOutcome] = useState("answered");
  const [callDuration, setCallDuration] = useState("");
  const [callBody, setCallBody] = useState("");
  const [savingCall, setSavingCall] = useState(false);

  const submitNote = async (payload: ActivitySubmitPayload) => {
    if (!user) return;
    const { contentHtml, contentText, attachments, gifUrl, audioUrl } = payload;
    if (!contentText.trim() && attachments.length === 0 && !gifUrl && !audioUrl) return;
    setSavingNote(true);

    // Build a body that preserves the rich HTML and appends media references
    const extras: string[] = [];
    attachments.forEach((a) => extras.push(`<p>📎 <a href="${a.url}" target="_blank" rel="noreferrer">${a.name}</a></p>`));
    if (gifUrl) extras.push(`<p><img src="${gifUrl}" alt="gif" /></p>`);
    if (audioUrl) extras.push(`<p>🎙️ <a href="${audioUrl}" target="_blank" rel="noreferrer">Voice note</a></p>`);
    const body = `${contentHtml}${extras.join("")}`;

    const { error } = await supabase.from("crm_activities").insert({
      workspace_id: contact.workspace_id,
      entity_type: "contact",
      entity_id: contact.id,
      type: "note",
      subject: "",
      body,
      actor_id: user.id,
      metadata: {
        rich: true,
        attachments,
        gif_url: gifUrl,
        audio_url: audioUrl,
      } as any,
    });
    setSavingNote(false);
    if (error) {
      toast({ title: "Couldn't save note", description: error.message, variant: "destructive" });
      return;
    }
    onPosted?.();
  };

  const submitCall = async () => {
    if (!user) return;
    setSavingCall(true);
    const outcomeLabel = callOutcome.replace(/_/g, " ");
    const subject = `Call · ${outcomeLabel}${callDuration ? ` · ${callDuration}` : ""}`;
    const { error } = await supabase.from("crm_activities").insert({
      workspace_id: contact.workspace_id,
      entity_type: "contact",
      entity_id: contact.id,
      type: "call",
      subject,
      body: callBody.trim(),
      actor_id: user.id,
    });
    setSavingCall(false);
    if (error) {
      toast({ title: "Couldn't log call", description: error.message, variant: "destructive" });
      return;
    }
    setCallBody("");
    setCallDuration("");
    setCallOutcome("answered");
    onPosted?.();
  };


  return (
    <div className="rounded-xl border border-border/60 bg-background overflow-hidden">
      <div className="flex items-center gap-1 px-2 pt-2 border-b border-border/40">
        {([
          { id: "note", label: "Note", Icon: NotebookPen },
          { id: "email", label: "Email", Icon: Mail },
          { id: "call", label: "Log Call", Icon: Phone },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-md border-b-2 -mb-px transition-colors",
              tab === id
                ? "border-[#3E54D3] text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "note" && (
        <div className="p-3 contact-note-composer">
          <ActivityComposer
            placeholder="Jot a sticky note about this contact…"
            onSubmit={submitNote}
            submitting={savingNote}
          />
        </div>
      )}

      {tab === "email" && (
        <div className="p-3">
          <InlineEmailComposer
            defaultTo={contact.email || ""}
            defaultSubject=""
            onClose={() => setTab("note")}
            onSent={() => {
              setTab("note");
              onPosted?.();
            }}
          />
        </div>
      )}

      {tab === "call" && (
        <div className="p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">Outcome</div>
              <Select value={callOutcome} onValueChange={setCallOutcome}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="answered">Answered</SelectItem>
                  <SelectItem value="no_answer">No Answer</SelectItem>
                  <SelectItem value="left_voicemail">Left Voicemail</SelectItem>
                  <SelectItem value="wrong_number">Wrong Number</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">Duration (optional)</div>
              <Input
                value={callDuration}
                onChange={(e) => setCallDuration(e.target.value)}
                placeholder="e.g. 5m"
                className="h-9 text-sm"
              />
            </div>
          </div>
          <Textarea
            value={callBody}
            onChange={(e) => setCallBody(e.target.value)}
            placeholder="Call notes…"
            rows={3}
            className="text-sm resize-none border-border/50"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={submitCall}
              disabled={savingCall}
              style={{ backgroundColor: "#3E54D3" }}
              className="text-white hover:opacity-90"
            >
              {savingCall && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
              Log Call
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Timeline-only feed for the Activity tab. Composer lives separately above the tab bar.
 *
 * Generalized to support any entity_type stored on crm_activities / entity_activity
 * (contact | deal | lead | transaction | ...). Contact-specific deal & task aggregation
 * only runs when entityType === "contact".
 */
export function ContactActivityTab({
  contact,
  entityType = "contact",
  entityId,
  contactEmail,
}: {
  contact?: Contact;
  entityType?: "contact" | "deal" | "lead" | "transaction" | string;
  entityId?: string;
  contactEmail?: string | null;
}) {
  const resolvedEntityType = entityType;
  const resolvedEntityId = entityId ?? contact?.id ?? "";
  const resolvedEmail = contactEmail ?? contact?.email ?? null;
  const isContactScope = resolvedEntityType === "contact" && !!contact;
  const [filter, setFilter] = useState<FilterId>("all");
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [acts, setActs] = useState<CrmActivity[]>([]);
  const [events, setEvents] = useState<EntityEvent[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(false);


  const fetchAll = useCallback(async () => {
    if (!resolvedEntityId) return;
    setLoading(true);

    const baseQueries: any[] = [
      supabase
        .from("crm_activities")
        .select("id,type,subject,body,occurred_at,actor_id,metadata,is_pinned")
        .eq("entity_type", resolvedEntityType)
        .eq("entity_id", resolvedEntityId)
        .order("occurred_at", { ascending: false })
        .limit(300),
      supabase
        .from("entity_activity")
        .select("id,action,metadata,actor_id,created_at")
        .eq("entity_type", resolvedEntityType)
        .eq("entity_id", resolvedEntityId)
        .order("created_at", { ascending: false })
        .limit(200),
    ];

    if (isContactScope) {
      baseQueries.push(
        supabase
          .from("deals")
          .select("id,title,property_address")
          .or(`primary_contact_id.eq.${resolvedEntityId},source_contact_id.eq.${resolvedEntityId}`),
        supabase
          .from("entity_links")
          .select("source_id, deals:source_id(id,title,property_address)")
          .eq("source_type", "deal")
          .eq("target_type", "contact")
          .eq("target_id", resolvedEntityId),
      );
    }

    const results = await Promise.all(baseQueries);
    const { data: a } = results[0] || {};
    const { data: e } = results[1] || {};
    const { data: dealsLink1 } = results[2] || { data: [] };
    const { data: dealsLink2 } = results[3] || { data: [] };

    let taskRows: CrmTask[] = [];
    if (isContactScope) {
      const dealMap = new Map<string, { title: string | null; address: string | null }>();
      ((dealsLink1 as any[]) || []).forEach((d) =>
        dealMap.set(d.id, { title: d.title, address: d.property_address ?? null }),
      );
      ((dealsLink2 as any[]) || []).forEach((row) => {
        const d = row.deals;
        if (d && !dealMap.has(d.id)) dealMap.set(d.id, { title: d.title, address: d.property_address ?? null });
      });

      if (dealMap.size > 0) {
        const ids = Array.from(dealMap.keys());
        const { data: t } = await supabase
          .from("crm_tasks")
          .select("id,title,due_date,is_complete,assigned_to,deal_id,created_at")
          .in("deal_id", ids)
          .order("due_date", { ascending: true, nullsFirst: false });
        taskRows = ((t as any[]) || []).map((x) => ({
          ...x,
          deal_title: x.deal_id ? dealMap.get(x.deal_id)?.title ?? null : null,
          deal_address: x.deal_id ? dealMap.get(x.deal_id)?.address ?? null : null,
        }));
      }
    }

    setActs((a as CrmActivity[]) || []);
    setEvents((e as EntityEvent[]) || []);
    setTasks(taskRows);

    const ids = new Set<string>();
    ((a as CrmActivity[]) || []).forEach((x) => { if (x.actor_id) ids.add(x.actor_id); });
    ((e as EntityEvent[]) || []).forEach((x) => { if (x.actor_id) ids.add(x.actor_id); });
    taskRows.forEach((x) => { if (x.assigned_to) ids.add(x.assigned_to); });
    if (ids.size) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", Array.from(ids));
      const map: Record<string, string> = {};
      ((profs as any[]) || []).forEach((p) => { map[p.user_id] = p.full_name || "Unknown"; });
      setProfiles(map);
    }
    setLoading(false);
  }, [resolvedEntityId, resolvedEntityType, isContactScope]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Realtime — keep fetchAll in a ref so the channel isn't re-created on every render
  const fetchAllRef = useRef(fetchAll);
  useEffect(() => { fetchAllRef.current = fetchAll; }, [fetchAll]);

  useEffect(() => {
    if (!resolvedEntityId) return;
    const ch = supabase
      .channel(`activity-${resolvedEntityType}-${resolvedEntityId}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_activities", filter: `entity_id=eq.${resolvedEntityId}` }, () => fetchAllRef.current())
      .on("postgres_changes", { event: "*", schema: "public", table: "entity_activity", filter: `entity_id=eq.${resolvedEntityId}` }, () => fetchAllRef.current())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [resolvedEntityId, resolvedEntityType]);

  const deleteActivity = async (id: string) => {
    const { error } = await supabase.from("crm_activities").delete().eq("id", id);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
      return;
    }
    setActs((prev) => prev.filter((x) => x.id !== id));
  };

  const togglePin = async (act: CrmActivity) => {
    const next = !act.is_pinned;
    setActs((prev) => prev.map((x) => (x.id === act.id ? { ...x, is_pinned: next } : x)));
    const { error } = await supabase
      .from("crm_activities")
      .update({ is_pinned: next })
      .eq("id", act.id);
    if (error) {
      toast({ title: "Couldn't update pin", description: error.message, variant: "destructive" });
      setActs((prev) => prev.map((x) => (x.id === act.id ? { ...x, is_pinned: !next } : x)));
    }
  };

  const describeEvent = (e: EntityEvent) => {
    const actor = e.actor_id ? profiles[e.actor_id] || "Someone" : "System";
    const meta = e.metadata || {};
    switch (e.action) {
      case "created": return `${actor} created this contact`;
      case "status_changed": return `${actor} changed status to ${meta.new_status || "—"}`;
      case "stage_changed": return `${actor} moved a deal to ${meta.new_stage || "—"}`;
      case "assigned": return `${actor} assigned ${meta.assignee_name || "someone"}`;
      case "linked": return `${actor} linked a ${meta.target_type || "record"}`;
      case "unlinked": return `${actor} unlinked a ${meta.target_type || "record"}`;
      default: return `${actor} ${e.action.replace(/_/g, " ")}`;
    }
  };

  // Pinned notes (always shown at top when filter shows notes)
  const pinnedNotes = useMemo(() => {
    return acts
      .filter((a) => a.type === "note" && a.is_pinned)
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
  }, [acts]);

  const showPinnedSection = pinnedNotes.length > 0 && (filter === "all" || filter === "notes");

  // Build unified timeline (excluding tasks; tasks render in their own pane)
  const timeline = useMemo(() => {
    type Item =
      | { kind: "note" | "call" | "email" | "file"; at: string; act: CrmActivity }
      | { kind: "update"; at: string; ev: EntityEvent };
    const items: Item[] = [];
    acts.forEach((a) => {
      // Pinned notes are rendered separately at the top — exclude them from the date timeline
      if (a.type === "note" && a.is_pinned && (filter === "all" || filter === "notes")) return;
      if (a.type === "note") items.push({ kind: "note", at: a.occurred_at, act: a });
      else if (a.type === "call") items.push({ kind: "call", at: a.occurred_at, act: a });
      else if (a.type === "email") items.push({ kind: "email", at: a.occurred_at, act: a });
      else if (a.type === "file" || (a.metadata as any)?.file_url) items.push({ kind: "file", at: a.occurred_at, act: a });
    });
    events.forEach((ev) => items.push({ kind: "update", at: ev.created_at, ev }));

    const filtered = items.filter((it) => {
      if (filter === "all") return true;
      if (filter === "notes") return it.kind === "note";
      if (filter === "emails") return it.kind === "email";
      if (filter === "calls") return it.kind === "call";
      if (filter === "files") return it.kind === "file";
      if (filter === "updates") return it.kind === "update";
      return false;
    });

    return filtered.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [acts, events, filter]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof timeline> = { TODAY: [], YESTERDAY: [], "LAST WEEK": [], OLDER: [] };
    timeline.forEach((it) => {
      const b = dayBucket(it.at);
      groups[b].push(it);
    });
    return groups;
  }, [timeline]);

  const showTasks = filter === "tasks";
  const empty = !showTasks && timeline.length === 0 && !showPinnedSection;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* FILTER PILLS */}
      <div className="shrink-0 flex items-center gap-1.5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
              filter === f.id
                ? "bg-[#3E54D3] text-white"
                : "bg-muted/60 text-muted-foreground hover:bg-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* TIMELINE / TASKS */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {loading && acts.length === 0 && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…
          </div>
        )}

        {showTasks ? (
          <TasksPane tasks={tasks} profiles={profiles} />
        ) : empty ? (
          <div className="text-center text-sm text-muted-foreground py-12">
            No activity yet. Add a note or log a call above.
          </div>
        ) : (
          <div className="space-y-6">
            {showPinnedSection && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80 font-semibold mb-2 pl-1 inline-flex items-center gap-1">
                  <Pin className="h-3 w-3" /> Pinned
                </div>
                <div className="space-y-3">
                  {pinnedNotes.map((a) => (
                    <TimelineRow
                      key={`p-${a.id}`}
                      kind="note"
                      act={a}
                      actorName={a.actor_id ? profiles[a.actor_id] || "Someone" : "System"}
                      contactEmail={contact.email}
                      onDelete={() => deleteActivity(a.id)}
                      onRefresh={fetchAll}
                      onTogglePin={() => togglePin(a)}
                    />
                  ))}
                </div>
              </div>
            )}
            {(["TODAY", "YESTERDAY", "LAST WEEK", "OLDER"] as const).map((bucket) => {
              const items = grouped[bucket];
              if (!items || items.length === 0) return null;
              return (
                <div key={bucket}>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80 font-semibold mb-2 pl-1">
                    {bucket}
                  </div>
                  <div className="space-y-3">
                    {items.map((item) =>
                      item.kind === "update" ? (
                        <UpdateRow key={`u-${item.ev.id}`} text={describeEvent(item.ev)} at={item.at} />
                      ) : (
                        <TimelineRow
                          key={`a-${item.act.id}`}
                          kind={item.kind}
                          act={item.act}
                          actorName={item.act.actor_id ? profiles[item.act.actor_id] || "Someone" : "System"}
                          contactEmail={contact.email}
                          onDelete={() => deleteActivity(item.act.id)}
                          onRefresh={fetchAll}
                          onTogglePin={item.kind === "note" ? () => togglePin(item.act) : undefined}
                        />
                      ),
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function UpdateRow({ text, at }: { text: string; at: string }) {
  const cfg = TYPE_STYLE.update;
  const Icon = cfg.icon;
  return (
    <div className="flex items-start gap-3 text-xs">
      <div className={cn("h-7 w-7 shrink-0 rounded-full flex items-center justify-center", cfg.bg)}>
        <Icon className={cn("h-3.5 w-3.5", cfg.fg)} />
      </div>
      <div className="flex-1 text-muted-foreground pt-1">
        {text} · <span>{timeAgo(at)}</span>
      </div>
    </div>
  );
}

function TimelineRow({
  kind,
  act,
  actorName,
  contactEmail,
  onDelete,
  onRefresh,
  onTogglePin,
}: {
  kind: "note" | "email" | "call" | "file";
  act: CrmActivity;
  actorName: string;
  contactEmail: string | null;
  onDelete: () => void;
  onRefresh: () => void;
  onTogglePin?: () => void;
}) {
  const cfg = TYPE_STYLE[kind];
  const Icon = cfg.icon;
  const meta = (act.metadata || {}) as any;
  const threadId: string | undefined = meta.gmail_thread_id;
  const [replyOpen, setReplyOpen] = useState(false);
  const isNote = kind === "note";
  const pinned = !!act.is_pinned;

  const replySubject = (() => {
    const s = act.subject || "";
    return s.toLowerCase().startsWith("re:") ? s : `Re: ${s}`.trim();
  })();

  // Render NOTES as post-it style cards
  if (isNote) {
    return (
      <div
        className="group relative rounded-md p-3 pl-4"
        style={{
          backgroundColor: NOTE_BG,
          boxShadow: NOTE_SHADOW,
          border: "1px solid rgba(180,150,40,0.18)",
        }}
      >
        {pinned && (
          <Pin
            className="absolute -top-1.5 -left-1.5 h-3.5 w-3.5 text-amber-700 rotate-[-20deg] drop-shadow"
            fill="currentColor"
          />
        )}
        <div className="flex items-center gap-2">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="bg-amber-200 text-amber-900 text-[9px]">{initials(actorName)}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-amber-950">{actorName}</span>
          <span className="text-xs text-amber-900/60">· {timeAgo(act.occurred_at)}</span>
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onTogglePin && (
              <button
                onClick={onTogglePin}
                className="p-1 rounded hover:bg-amber-200/60 text-amber-800"
                title={pinned ? "Unpin note" : "Pin note"}
              >
                {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              </button>
            )}
            <button
              onClick={onDelete}
              className="p-1 rounded hover:bg-amber-200/60 text-amber-800 hover:text-destructive"
              title="Delete note"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {act.body && (
          <p className="whitespace-pre-wrap text-sm text-amber-950/90 mt-1 leading-relaxed">{act.body}</p>
        )}
      </div>
    );
  }

  return (
    <div className="group flex gap-3">
      <div className={cn("h-7 w-7 shrink-0 rounded-full flex items-center justify-center mt-0.5", cfg.bg)}>
        <Icon className={cn("h-3.5 w-3.5", cfg.fg)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="bg-muted text-[9px]">{initials(actorName)}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{actorName}</span>
          <span className="text-xs text-muted-foreground">· {timeAgo(act.occurred_at)}</span>
        </div>
        {act.subject && (
          <div className="text-sm font-medium mt-1 truncate">{act.subject}</div>
        )}
        {act.body && (
          <p className="whitespace-pre-wrap text-sm text-foreground/90 mt-0.5">{act.body}</p>
        )}

        <div className="mt-1.5 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
          {kind === "email" && threadId && (
            <button
              onClick={() => setReplyOpen((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Reply className="h-3 w-3" /> Reply
            </button>
          )}
          {kind === "email" && threadId && (
            <Link
              to={`/inbox?thread=${threadId}`}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" /> Open
            </Link>
          )}
          <button
            onClick={onDelete}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </div>

        {replyOpen && threadId && (
          <div className="mt-2">
            <InlineEmailComposer
              defaultTo={contactEmail || ""}
              defaultSubject={replySubject}
              threadId={threadId}
              onClose={() => setReplyOpen(false)}
              onSent={() => {
                setReplyOpen(false);
                onRefresh();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TasksPane({
  tasks,
  profiles,
}: {
  tasks: CrmTask[];
  profiles: Record<string, string>;
}) {
  if (tasks.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-12">
        No deal tasks linked to this contact yet.
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <ul className="space-y-2">
      {tasks.map((t) => {
        const due = t.due_date ? new Date(t.due_date) : null;
        const overdue = !!due && !t.is_complete && due.getTime() < today.getTime();
        const assignee = t.assigned_to ? profiles[t.assigned_to] || "Unassigned" : null;
        const dealLabel = t.deal_address || t.deal_title || "Deal";
        return (
          <li
            key={t.id}
            className="flex items-center gap-3 rounded-lg border border-border/50 bg-card px-3 py-2.5"
          >
            <div className="text-muted-foreground" title="Tasks are managed on the deal record">
              {t.is_complete ? <CheckSquare className="h-4 w-4" /> : <SquareIcon className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className={cn("text-sm font-medium truncate", t.is_complete && "line-through text-muted-foreground")}>
                {t.title}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                →{" "}
                {t.deal_id ? (
                  <Link to={`/crm/deals?deal=${t.deal_id}`} className="hover:text-foreground underline-offset-2 hover:underline">
                    {dealLabel}
                  </Link>
                ) : (
                  <span>{dealLabel}</span>
                )}
              </div>
            </div>
            {due && (
              <div className={cn("text-xs shrink-0", overdue ? "text-red-600 font-medium" : "text-muted-foreground")}>
                {due.toLocaleDateString()}
              </div>
            )}
            {assignee && (
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarFallback className="bg-muted text-[10px]">{initials(assignee)}</AvatarFallback>
              </Avatar>
            )}
            {t.deal_id && (
              <Link
                to={`/crm/deals?deal=${t.deal_id}`}
                className="shrink-0 text-xs text-[#3E54D3] hover:underline whitespace-nowrap"
              >
                Open deal →
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
