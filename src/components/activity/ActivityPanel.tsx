import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Activity, Filter, MessageSquare, Reply, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { ActivityComposer, type ActivitySubmitPayload } from "./ActivityComposer";
import { AttachmentChips, type CommentAttachment } from "@/components/shared/RichCommentInput";
import { CommentReactions } from "@/components/shared/CommentReactions";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

interface Comment {
  id: string;
  entity_type: string;
  entity_id: string;
  author_id: string;
  content: string;
  content_html: string | null;
  parent_id: string | null;
  created_at: string;
  attachments: CommentAttachment[];
  mentions: string[];
  gif_url: string | null;
  audio_url: string | null;
}

interface ActivityEvent {
  id: string;
  entity_type: string;
  entity_id: string;
  actor_id: string | null;
  action: string;
  metadata: Record<string, any>;
  created_at: string;
}

interface CrmActivity {
  id: string;
  type: string;
  subject: string | null;
  body: string | null;
  occurred_at: string;
  actor_id: string | null;
  metadata: Record<string, any> | null;
}

type FilterMode = "all" | "comments" | "activity";

const CRM_ENTITY_TYPES = new Set(["contact", "deal", "lead", "company"]);

interface Props {
  entityType: string;
  entityId: string;
  hideHeader?: boolean;
  defaultFilter?: FilterMode;
}

export default function ActivityPanel({ entityType, entityId, hideHeader = false, defaultFilter = "all" }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<FilterMode>(defaultFilter);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [crmActs, setCrmActs] = useState<CrmActivity[]>([]);
  const isCrmEntity = CRM_ENTITY_TYPES.has(entityType);

  const fetchAll = useCallback(async () => {
    const queries: any[] = [
      supabase.from("comments").select("*").eq("entity_type", entityType).eq("entity_id", entityId).order("created_at", { ascending: true }),
      supabase.from("entity_activity").select("*").eq("entity_type", entityType).eq("entity_id", entityId).order("created_at", { ascending: true }).limit(100),
    ];
    if (isCrmEntity) {
      queries.push(
        supabase.from("crm_activities")
          .select("id,type,subject,body,occurred_at,actor_id,metadata")
          .eq("entity_type", entityType)
          .eq("entity_id", entityId)
          .order("occurred_at", { ascending: true })
          .limit(200)
      );
    }
    const results = await Promise.all(queries);
    const c = results[0].data;
    const e = results[1].data;
    const ca = isCrmEntity ? results[2].data : [];

    const normalizedC = ((c as any[]) || []).map((x) => ({
      ...x,
      attachments: Array.isArray(x.attachments) ? x.attachments : [],
      mentions: Array.isArray(x.mentions) ? x.mentions : [],
    })) as Comment[];
    setComments(normalizedC);
    setEvents((e as ActivityEvent[]) || []);
    setCrmActs((ca as CrmActivity[]) || []);

    const ids = new Set<string>();
    normalizedC.forEach((c) => ids.add(c.author_id));
    ((e as ActivityEvent[]) || []).forEach((ev) => { if (ev.actor_id) ids.add(ev.actor_id); });
    ((ca as CrmActivity[]) || []).forEach((a) => { if (a.actor_id) ids.add(a.actor_id); });
    if (ids.size > 0) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", Array.from(ids));
      if (profs) {
        const map: Record<string, string> = {};
        profs.forEach((p) => { map[p.user_id] = p.full_name || "Unknown"; });
        setProfiles(map);
      }
    }
  }, [entityType, entityId, isCrmEntity]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime subscription
  useEffect(() => {
    const ch = supabase
      .channel(`activity-${entityType}-${entityId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `entity_id=eq.${entityId}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "entity_activity", filter: `entity_id=eq.${entityId}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_activities", filter: `entity_id=eq.${entityId}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [entityType, entityId, fetchAll]);

  const handleSubmit = async (payload: ActivitySubmitPayload, parentId: string | null = null) => {
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from("comments").insert({
      entity_type: entityType,
      entity_id: entityId,
      author_id: user.id,
      content: payload.contentText,
      content_html: payload.contentHtml,
      parent_id: parentId,
      attachments: payload.attachments as any,
      mentions: payload.mentions as any,
      gif_url: payload.gifUrl,
      audio_url: payload.audioUrl,
    } as any);
    if (error) toast.error(error.message);
    else {
      if (parentId) setReplyTo(null);
      fetchAll();
    }
    setSubmitting(false);
  };

  const deleteComment = async (id: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else fetchAll();
  };

  // Merge & sort the stream
  const stream = useMemo(() => {
    const topComments = comments.filter((c) => !c.parent_id).map((c) => ({ kind: "comment" as const, at: c.created_at, comment: c }));
    const evs = events.map((e) => ({ kind: "event" as const, at: e.created_at, event: e }));
    const crm = crmActs.map((a) => ({ kind: "crm" as const, at: a.occurred_at, crm: a }));
    let merged: Array<typeof topComments[number] | typeof evs[number] | typeof crm[number]> = [];
    if (filter === "comments") merged = topComments;
    else if (filter === "activity") merged = [...evs, ...crm];
    else merged = [...topComments, ...evs, ...crm];
    return merged.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [comments, events, crmActs, filter]);

  const repliesFor = (id: string) => comments.filter((c) => c.parent_id === id);

  const initials = (n: string) => n.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const timeAgo = (d: string) => {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const describeEvent = (e: ActivityEvent) => {
    const actor = e.actor_id ? profiles[e.actor_id] || "Someone" : "System";
    const meta = e.metadata || {};
    switch (e.action) {
      case "created": return `${actor} created this ${entityType}`;
      case "status_changed": return `${actor} changed status to ${meta.new_status || "—"}`;
      case "stage_changed": return `${actor} moved to stage ${meta.new_stage || "—"}`;
      case "assigned": return `${actor} assigned ${meta.assignee_name || "someone"}`;
      case "priority_changed": return `${actor} set priority to ${meta.new_priority || "—"}`;
      case "buy_box_set": return `${actor} marked buy box: ${meta.value || "—"}`;
      case "converted_to_deal": return `${actor} converted lead to deal`;
      case "file_uploaded": return `${actor} uploaded ${meta.name || "a file"}`;
      case "checklist_item_completed": return `${actor} completed "${meta.label || "an item"}"`;
      case "closed": return `${actor} marked this closed`;
      case "commented": return `${actor} commented`;
      default: return `${actor} ${e.action.replace(/_/g, " ")}`;
    }
  };

  const CommentCard = ({ c, isReply = false }: { c: Comment; isReply?: boolean }) => {
    const name = profiles[c.author_id] || "Unknown";
    const isAuthor = user?.id === c.author_id;
    const isHtml = c.content_html && /<[a-z][\s\S]*>/i.test(c.content_html);
    return (
      <div className={cn("flex gap-3", isReply && "ml-10")}>
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="bg-primary/10 text-[10px] text-primary">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
          </div>
          {isHtml ? (
            <div className="mt-0.5 text-sm text-foreground/90 prose prose-sm max-w-none prose-mention" dangerouslySetInnerHTML={{ __html: c.content_html! }} />
          ) : (
            c.content && <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground/90">{c.content}</p>
          )}
          {c.gif_url && <img src={c.gif_url} alt="gif" className="mt-1 max-h-40 rounded-md" />}
          {c.audio_url && (
            <audio controls className="mt-1 h-8 max-w-[260px]">
              <source src={c.audio_url} type="audio/webm" />
            </audio>
          )}
          <AttachmentChips attachments={c.attachments || []} />
          <div className="mt-1.5 flex items-center gap-3">
            <CommentReactions commentId={c.id} />
            {!isReply && (
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
              >
                <Reply className="h-3 w-3" /> Reply
              </button>
            )}
            {isAuthor && (
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => deleteComment(c.id)}
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            )}
          </div>
          {replyTo === c.id && (
            <div className="mt-2">
              <ActivityComposer
                placeholder="Write a reply…"
                autoFocus
                submitting={submitting}
                onSubmit={(p) => handleSubmit(p, c.id)}
              />
            </div>
          )}
          {repliesFor(c.id).map((r) => (
            <div key={r.id} className="mt-3">
              <CommentCard c={r} isReply />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const EventRow = ({ e }: { e: ActivityEvent }) => (
    <div className="flex items-start gap-2 text-xs text-muted-foreground py-0.5">
      <div className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0 ml-2" />
      <span className="flex-1">{describeEvent(e)}</span>
      <span className="shrink-0">{timeAgo(e.created_at)}</span>
    </div>
  );

  const describeCrm = (a: CrmActivity) => {
    const actor = a.actor_id ? profiles[a.actor_id] || "Someone" : "System";
    const subj = a.subject?.trim();
    switch (a.type) {
      case "email": return `${actor} sent email${subj ? `: "${subj}"` : ""}`;
      case "call": return `${actor} logged a call${subj ? ` — ${subj}` : ""}`;
      case "meeting": return `${actor} logged a meeting${subj ? ` — ${subj}` : ""}`;
      case "note": return `${actor} added a note${subj ? `: ${subj}` : ""}`;
      case "stage_change": return `${actor} ${subj || "changed stage"}`;
      case "sms": return `${actor} sent SMS${subj ? `: ${subj}` : ""}`;
      default: return `${actor} ${a.type.replace(/_/g, " ")}${subj ? ` — ${subj}` : ""}`;
    }
  };

  const CrmRow = ({ a }: { a: CrmActivity }) => (
    <div className="flex items-start gap-2 text-xs text-muted-foreground py-0.5">
      <div className="mt-1.5 h-1 w-1 rounded-full bg-primary/50 shrink-0 ml-2" />
      <span className="flex-1">{describeCrm(a)}</span>
      <span className="shrink-0">{timeAgo(a.occurred_at)}</span>
    </div>
  );

  const Header = (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Activity</h3>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Filter">
            <Filter className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
            <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="comments">Comments only</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="activity">Activity only</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const StreamBody = (
    <div className="space-y-4">
      {stream.length === 0 && (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      )}
      {stream.map((item) =>
        item.kind === "comment"
          ? <CommentCard key={`c-${item.comment.id}`} c={item.comment} />
          : <EventRow key={`e-${item.event.id}`} e={item.event} />
      )}
    </div>
  );

  if (hideHeader) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">{Header}</div>
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="pb-2">{StreamBody}</div>
        </div>
        <div className="shrink-0 border-t pt-3 mt-3 bg-background">
          <ActivityComposer submitting={submitting} onSubmit={(p) => handleSubmit(p)} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Header}
      {StreamBody}
      <div className="border-t pt-3">
        <ActivityComposer submitting={submitting} onSubmit={(p) => handleSubmit(p)} />
      </div>
    </div>
  );
}
