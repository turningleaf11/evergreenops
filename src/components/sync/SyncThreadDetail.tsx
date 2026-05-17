import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Download, FileText, CheckCircle2, RotateCcw, Trash2, FolderPlus, ExternalLink, ListTodo } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LinkedItemPicker, LinkedItemChip, type LinkedItem } from "./LinkedItemPicker";
import { formatDistanceToNow } from "date-fns";
import { MentionChips, type MentionRef } from "@/components/ceo/MentionInput";
import { ChatInputShell, type ChatSubmitPayload } from "@/components/chat/ChatInputShell";
import { toast } from "sonner";
import { SyncChannel, SyncTag, SyncThread } from "@/hooks/useSync";
import { SyncTagBadge } from "./SyncTagBadge";
import { cn } from "@/lib/utils";

const sb = supabase as any;

type Attachment = { url: string; name: string; type: string; size: number };
type Message = {
  id: string;
  thread_id: string;
  author_id: string | null;
  body: string;
  mentions: MentionRef[];
  attachments: Attachment[];
  created_at: string;
};
type Profile = { user_id: string; full_name: string | null };

function relTime(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ""; }
}
function initials(name: string | null) {
  return (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}
function isImage(att: Attachment) { return att.type.startsWith("image/"); }
function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function AttachmentPreview({ att }: { att: Attachment }) {
  if (isImage(att)) {
    return (
      <a href={att.url} target="_blank" rel="noopener noreferrer" className="block max-w-xs rounded-lg overflow-hidden border border-border/40 hover:border-border">
        <img src={att.url} alt={att.name} className="w-full h-auto max-h-48 object-cover" />
      </a>
    );
  }
  return (
    <a href={att.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/40 hover:border-border bg-card/60 max-w-xs">
      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-foreground truncate flex-1">{att.name}</span>
      <span className="text-[10px] text-muted-foreground/60 shrink-0">{fmtBytes(att.size)}</span>
      <Download className="h-3 w-3 text-muted-foreground/60 shrink-0" />
    </a>
  );
}

interface Props {
  thread: SyncThread;
  channel: SyncChannel | undefined;
  tags: SyncTag[];
  onChanged: () => void;
  onClose?: () => void;
}

export function SyncThreadDetail({ thread, channel, tags, onChanged, onClose }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [authors, setAuthors] = useState<Map<string, Profile>>(new Map());
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const tag = tags.find((t) => t.key === thread.tag);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    (async () => {
      const { data } = await sb
        .from("sync_thread_messages")
        .select("*")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      const msgs = ((data ?? []) as any[]).map((m) => ({
        ...m,
        mentions: Array.isArray(m.mentions) ? m.mentions : [],
        attachments: Array.isArray(m.attachments) ? m.attachments : [],
      })) as Message[];
      setMessages(msgs);

      const ids = Array.from(new Set([
        ...msgs.map((m) => m.author_id).filter(Boolean) as string[],
        thread.author_id,
      ].filter(Boolean) as string[]));
      if (ids.length > 0) {
        const { data: profs } = await sb.from("profiles").select("user_id, full_name").in("user_id", ids);
        if (!cancelled && profs) setAuthors(new Map((profs as Profile[]).map((p) => [p.user_id, p])));
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [thread.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  const fanOut = async (body: string, mentions: MentionRef[]) => {
    if (!user || !channel) return;
    const recipients = new Set<string>();
    channel.members.forEach((m) => { if (m.user_id !== user.id) recipients.add(m.user_id); });
    mentions.filter((m) => m.type === "person").forEach((m) => { if (m.id && m.id !== user.id) recipients.add(m.id); });
    if (recipients.size === 0) return;

    const { data: actorProf } = await sb.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
    const actorName = (actorProf as any)?.full_name || "Someone";
    const preview = body.length > 140 ? body.slice(0, 140) + "…" : body;
    const mentionedYou = (uid: string) => mentions.some((m) => m.type === "person" && m.id === uid);

    const rows = Array.from(recipients).map((uid) => ({
      user_id: uid,
      actor_id: user.id,
      actor_name: actorName,
      type: mentionedYou(uid) ? "sync_mention" : "sync_message",
      entity_type: "sync_thread",
      entity_id: thread.id,
      body: mentionedYou(uid)
        ? `mentioned you on "${thread.title}": ${preview}`
        : `replied on "${thread.title}": ${preview}`,
      url: `/sync/thread/${thread.id}`,
    }));
    await sb.from("notifications").insert(rows);
  };

  const sendViaShell = async (p: ChatSubmitPayload) => {
    const hasContent = p.text || p.mentions.length > 0 || p.attachments.length > 0 || p.gifUrl || p.audioUrl;
    if (!hasContent || !user || sending) return;
    setSending(true);

    // Map ChatInputShell payload onto the sync schema
    const mentions: MentionRef[] = p.mentions.map((m) => ({
      id: m.id,
      type: (m.type === "project" || m.type === "task" || m.type === "goal" || m.type === "person") ? m.type : "person",
      label: m.label,
    }));
    const attachments: Attachment[] = [
      ...p.attachments.map((a) => ({ url: a.url, name: a.name, type: a.type || "application/octet-stream", size: a.size })),
      ...(p.gifUrl ? [{ url: p.gifUrl, name: "gif", type: "image/gif", size: 0 }] : []),
      ...(p.audioUrl ? [{ url: p.audioUrl, name: "voice-note.webm", type: "audio/webm", size: 0 }] : []),
    ];

    const { data, error } = await sb.from("sync_thread_messages").insert({
      thread_id: thread.id,
      author_id: user.id,
      body: p.html,
      mentions,
      attachments,
    }).select().single();
    setSending(false);
    if (error) { toast.error("Failed to send"); return; }
    if (data) {
      const newMsg: Message = {
        ...(data as any),
        mentions: Array.isArray((data as any).mentions) ? (data as any).mentions : [],
        attachments: Array.isArray((data as any).attachments) ? (data as any).attachments : [],
      };
      setMessages((prev) => [...prev, newMsg]);
      fanOut(p.text, newMsg.mentions).catch((e) => console.error("Notify fan-out failed:", e));
      onChanged();
    }
  };

  const toggleResolved = async () => {
    if (!user) return;
    const next = thread.status === "open" ? "resolved" : "open";
    const { error } = await sb.from("sync_threads").update({
      status: next,
      resolved_by: next === "resolved" ? user.id : null,
      resolved_at: next === "resolved" ? new Date().toISOString() : null,
    }).eq("id", thread.id);
    if (error) { toast.error("Couldn't update status"); return; }
    toast.success(next === "resolved" ? "Marked resolved" : "Reopened");
    onChanged();
  };

  const deleteThread = async () => {
    if (!confirm("Delete this thread? This can't be undone.")) return;
    const { error } = await sb.from("sync_threads").delete().eq("id", thread.id);
    if (error) { toast.error("Couldn't delete"); return; }
    toast.success("Deleted");
    onChanged();
    onClose?.();
  };

  const updateLinkedItems = async (next: LinkedItem[]) => {
    const { error } = await sb.from("sync_threads").update({ linked_items: next }).eq("id", thread.id);
    if (error) { toast.error("Couldn't update links"); return; }
    onChanged();
  };

  const promoteToTask = async () => {
    if (!user) return;
    const { data: task, error } = await sb.from("tasks").insert({
      title: thread.title,
      description: thread.body || `Created from Sync thread`,
      status: "todo",
      created_by: user.id,
      assigned_to: user.id,
    }).select("id").single();
    if (error || !task) { toast.error(error?.message || "Couldn't create task"); return; }

    // Add the task to the thread's linked_items so it shows in the header
    const nextLinks: LinkedItem[] = [
      ...(thread.linked_items || []),
      { type: "task", id: task.id, label: thread.title },
    ];
    await sb.from("sync_threads").update({ linked_items: nextLinks }).eq("id", thread.id);
    toast.success("Task created");
    onChanged();
  };

  const convertToProject = async () => {
    if (!user) return;
    if (thread.converted_project_id) {
      navigate(`/projects/${thread.converted_project_id}`);
      return;
    }
    if (!confirm(`Convert "${thread.title}" into a project? You'll be taken to the new project page.`)) return;
    const { data: proj, error } = await sb.from("projects").insert({
      title: thread.title,
      description: thread.body || `Converted from Sync thread`,
      owner_id: user.id,
      created_by: user.id,
    }).select("id").single();
    if (error || !proj) { toast.error(error?.message || "Couldn't create project"); return; }
    await sb.from("sync_threads").update({ converted_project_id: proj.id }).eq("id", thread.id);
    toast.success("Project created");
    onChanged();
    navigate(`/projects/${proj.id}`);
  };

  const author = thread.author_id ? authors.get(thread.author_id) : undefined;
  const canDelete = thread.author_id === user?.id;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/40 bg-card/40 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-foreground">{thread.title}</h2>
              {tag && <SyncTagBadge tag={tag} />}
              {thread.status === "resolved" && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 ring-1 ring-emerald-500/20 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" /> Resolved
                </span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground/70 flex items-center gap-1.5">
              <span>{channel?.displayName}</span>
              <span>·</span>
              <span>started by {author?.full_name || "Unknown"}</span>
              <span>·</span>
              <span>{relTime(thread.created_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {thread.tag === "todo" && (
              <button
                onClick={promoteToTask}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                title="Create a task from this thread"
              >
                <ListTodo className="h-3 w-3" /> Create task
              </button>
            )}
            <button
              onClick={convertToProject}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20"
              title={thread.converted_project_id ? "Open linked project" : "Convert thread to a project"}
            >
              {thread.converted_project_id ? (<><ExternalLink className="h-3 w-3" /> Open project</>) : (<><FolderPlus className="h-3 w-3" /> Convert to project</>)}
            </button>
            <button
              onClick={toggleResolved}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
                thread.status === "open"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                  : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {thread.status === "open" ? (<><CheckCircle2 className="h-3 w-3" /> Resolve</>) : (<><RotateCcw className="h-3 w-3" /> Reopen</>)}
            </button>
            {canDelete && (
              <button
                onClick={deleteThread}
                className="h-7 w-7 rounded-md text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 inline-flex items-center justify-center"
                title="Delete thread"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        {thread.body && (
          <p className="mt-3 text-sm text-foreground whitespace-pre-wrap">{thread.body}</p>
        )}

        {/* Linked items + add */}
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          {(thread.linked_items || []).map((it) => (
            <LinkedItemChip
              key={`${it.type}-${it.id}`}
              item={it}
              onRemove={() => updateLinkedItems((thread.linked_items || []).filter((x) => !(x.type === it.type && x.id === it.id)))}
            />
          ))}
          <LinkedItemPicker
            value={thread.linked_items || []}
            onChange={updateLinkedItems}
            label={(thread.linked_items || []).length === 0 ? "Link a project, task, or person" : "Link more"}
          />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
        {!loaded && <p className="text-xs text-muted-foreground/60">Loading…</p>}
        {loaded && messages.length === 0 && (
          <p className="text-xs text-muted-foreground/60 italic">No replies yet. Be the first to chime in.</p>
        )}
        {messages.map((msg) => {
          const isMine = msg.author_id === user?.id;
          const a = msg.author_id ? authors.get(msg.author_id) : undefined;
          return (
            <div key={msg.id} className={cn("flex gap-2", isMine && "flex-row-reverse")}>
              <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                <AvatarFallback className="text-[10px] bg-muted">{initials(a?.full_name || null)}</AvatarFallback>
              </Avatar>
              <div className={cn("flex-1 min-w-0 space-y-1", isMine && "flex flex-col items-end")}>
                <div className={cn("flex items-center gap-1.5", isMine && "flex-row-reverse")}>
                  <span className="text-[11px] font-medium text-foreground truncate">{a?.full_name || "Unknown"}</span>
                  <span className="text-[10px] text-muted-foreground/50">· {relTime(msg.created_at)}</span>
                </div>
                {msg.body && (
                  <div
                    className={cn(
                      "text-sm px-3 py-1.5 rounded-lg max-w-[85%] break-words prose prose-sm prose-invert max-w-none [&_p]:my-1",
                      isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                    )}
                    dangerouslySetInnerHTML={{ __html: msg.body }}
                  />
                )}
                {msg.mentions.length > 0 && (
                  <div className={cn("flex", isMine && "justify-end")}>
                    <MentionChips mentions={msg.mentions} />
                  </div>
                )}
                {msg.attachments.length > 0 && (
                  <div className={cn("flex flex-wrap gap-1.5 max-w-[85%]", isMine && "justify-end")}>
                    {msg.attachments.map((att, i) => <AttachmentPreview key={i} att={att} />)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer — unified ChatInputShell (rich text, slash, @ mentions, attachments, gif, voice, emoji) */}
      <div className="px-5 py-3 border-t border-border/40 bg-card/40 shrink-0">
        <ChatInputShell
          placeholder="Reply… type / for commands, @ to mention"
          submitting={sending}
          minHeight={64}
          onSubmit={sendViaShell}
        />
      </div>
    </div>
  );
}
