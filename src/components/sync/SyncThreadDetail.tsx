import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Loader2, Paperclip, X, Download, FileText, CheckCircle2, RotateCcw, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { MentionInput, MentionChips, type MentionRef } from "@/components/ceo/MentionInput";
import { uploadFile, triggerFileInput } from "@/lib/file-upload";
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [authors, setAuthors] = useState<Map<string, Profile>>(new Map());
  const [input, setInput] = useState("");
  const [inputMentions, setInputMentions] = useState<MentionRef[]>([]);
  const [inputAttachments, setInputAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  const handleAttach = () => {
    triggerFileInput("*", async (file) => {
      if (file.size > 25 * 1024 * 1024) { toast.error("File too large (25 MB max)"); return; }
      setUploading(true);
      const url = await uploadFile(file);
      setUploading(false);
      if (!url) { toast.error("Upload failed"); return; }
      setInputAttachments((prev) => [...prev, { url, name: file.name, type: file.type || "application/octet-stream", size: file.size }]);
    });
  };

  const send = async () => {
    const body = input.trim();
    const hasContent = body || inputMentions.length > 0 || inputAttachments.length > 0;
    if (!hasContent || !user || sending) return;
    setSending(true);
    const { data, error } = await sb.from("sync_thread_messages").insert({
      thread_id: thread.id,
      author_id: user.id,
      body,
      mentions: inputMentions,
      attachments: inputAttachments,
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
      setInput(""); setInputMentions([]); setInputAttachments([]);
      fanOut(body, newMsg.mentions).catch((e) => console.error("Notify fan-out failed:", e));
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

  const author = thread.author_id ? authors.get(thread.author_id) : undefined;
  const canDelete = thread.author_id === user?.id;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/40 bg-card/40">
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
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
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
                  <div className={cn(
                    "text-sm px-3 py-1.5 rounded-lg max-w-[85%] whitespace-pre-wrap break-words",
                    isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}>
                    {msg.body}
                  </div>
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

      {/* Composer */}
      <div className="px-5 py-3 border-t border-border/40 bg-card/40 space-y-2">
        {inputAttachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {inputAttachments.map((att, i) => (
              <div key={i} className="relative group">
                <AttachmentPreview att={att} />
                <button
                  type="button"
                  onClick={() => setInputAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0 bg-muted/40 rounded-md px-2.5 py-1.5">
            <MentionInput
              value={input}
              onChange={setInput}
              mentions={inputMentions}
              onMentionsChange={setInputMentions}
              placeholder="Reply… type @ to mention a person, project, task, or goal"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              inputClassName="text-sm"
            />
          </div>
          <button
            onClick={handleAttach}
            disabled={uploading || sending}
            className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center disabled:opacity-40"
            title="Attach"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={send}
            disabled={sending || (!input.trim() && inputMentions.length === 0 && inputAttachments.length === 0)}
            className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
            title="Send"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
