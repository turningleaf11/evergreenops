import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Loader2, Paperclip, X, Download, ExternalLink, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { MentionInput, MentionChips, type MentionRef } from "@/components/ceo/MentionInput";
import { uploadFile, triggerFileInput } from "@/lib/file-upload";
import { toast } from "sonner";

const sb = supabase as any;

type Attachment = {
  url: string;
  name: string;
  type: string;
  size: number;
};

type Message = {
  id: string;
  strategy_item_id: string;
  department_id: string | null;
  author_id: string | null;
  author_role: string;
  body: string;
  mentions: MentionRef[];
  attachments: Attachment[];
  created_at: string;
};

type Profile = { user_id: string; full_name: string | null; avatar_url: string | null };

interface Props {
  strategyItemId: string;
  /** Optional dept context — when posting from a dept Leadership tab, tag the message with the dept. */
  departmentId?: string;
}

function relTime(iso: string): string {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ""; }
}

function initials(name: string | null) {
  return (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function isImage(att: Attachment) {
  return att.type.startsWith("image/");
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function AttachmentPreview({ att }: { att: Attachment }) {
  if (isImage(att)) {
    return (
      <a href={att.url} target="_blank" rel="noopener noreferrer" className="block max-w-xs rounded-lg overflow-hidden border border-border/40 hover:border-border transition-colors">
        <img src={att.url} alt={att.name} className="w-full h-auto max-h-48 object-cover" />
      </a>
    );
  }
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/40 hover:border-border bg-card/60 transition-colors max-w-xs"
    >
      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-foreground truncate flex-1">{att.name}</span>
      <span className="text-[10px] text-muted-foreground/60 shrink-0">{fmtBytes(att.size)}</span>
      <Download className="h-3 w-3 text-muted-foreground/60 shrink-0" />
    </a>
  );
}

export function DirectiveThread({ strategyItemId, departmentId }: Props) {
  const { user, isPrimaryAdmin, isAdmin } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [input, setInput] = useState("");
  const [inputMentions, setInputMentions] = useState<MentionRef[]>([]);
  const [inputAttachments, setInputAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await sb
        .from("directive_messages")
        .select("*")
        .eq("strategy_item_id", strategyItemId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      const msgs = ((data ?? []) as any[]).map((m) => ({
        ...m,
        mentions: Array.isArray(m.mentions) ? m.mentions : [],
        attachments: Array.isArray(m.attachments) ? m.attachments : [],
      })) as Message[];
      setMessages(msgs);

      const authorIds = Array.from(new Set(msgs.map((m) => m.author_id).filter(Boolean))) as string[];
      if (authorIds.length > 0) {
        const { data: profs } = await sb
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", authorIds);
        if (!cancelled && profs) {
          setProfiles(new Map((profs as Profile[]).map((p) => [p.user_id, p])));
        }
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [strategyItemId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  const fanOutNotifications = async (messageBody: string, mentions: MentionRef[]) => {
    if (!user) return;
    const { data: item } = await sb
      .from("strategy_items")
      .select("title, created_by, assigned_departments")
      .eq("id", strategyItemId)
      .maybeSingle();
    if (!item) return;

    const recipients = new Set<string>();
    // Existing recipients: directive creator + dept leaders of assigned depts
    if (item.created_by && item.created_by !== user.id) {
      recipients.add(item.created_by);
    }
    const deptIds: string[] = item.assigned_departments || [];
    if (deptIds.length > 0) {
      const { data: leaders } = await sb
        .from("profiles")
        .select("user_id")
        .in("department_id", deptIds)
        .eq("is_leader", true);
      (leaders ?? []).forEach((l: any) => {
        if (l.user_id && l.user_id !== user.id) recipients.add(l.user_id);
      });
    }
    // Plus anyone @-mentioned
    mentions.filter((m) => m.type === "person").forEach((m) => {
      if (m.id && m.id !== user.id) recipients.add(m.id);
    });

    if (recipients.size === 0) return;

    const { data: actorProf } = await sb.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
    const actorName = (actorProf as any)?.full_name || "Someone";
    const preview = messageBody.length > 140 ? messageBody.slice(0, 140) + "…" : messageBody;
    const mentionedYou = (uid: string) => mentions.some((m) => m.type === "person" && m.id === uid);

    const rows = Array.from(recipients).map((uid) => ({
      user_id: uid,
      actor_id: user.id,
      actor_name: actorName,
      type: mentionedYou(uid) ? "directive_mention" : "directive_message",
      entity_type: "strategy_item",
      entity_id: strategyItemId,
      body: mentionedYou(uid)
        ? `mentioned you on "${item.title}": ${preview}`
        : `replied on "${item.title}": ${preview}`,
      url: "/ceo",
    }));
    await sb.from("notifications").insert(rows);
  };

  const handleAttach = () => {
    triggerFileInput("*", async (file) => {
      if (file.size > 25 * 1024 * 1024) {
        toast.error("File too large (25 MB max)");
        return;
      }
      setUploading(true);
      const url = await uploadFile(file);
      setUploading(false);
      if (!url) {
        toast.error("Upload failed");
        return;
      }
      setInputAttachments((prev) => [
        ...prev,
        { url, name: file.name, type: file.type || "application/octet-stream", size: file.size },
      ]);
    });
  };

  const removeAttachment = (idx: number) => {
    setInputAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const send = async () => {
    const body = input.trim();
    const hasContent = body || inputMentions.length > 0 || inputAttachments.length > 0;
    if (!hasContent || !user || sending) return;
    setSending(true);
    const role = isPrimaryAdmin ? "ceo" : isAdmin ? "admin" : "leader";
    const { data, error } = await sb.from("directive_messages").insert({
      strategy_item_id: strategyItemId,
      department_id: departmentId || null,
      author_id: user.id,
      author_role: role,
      body,
      mentions: inputMentions,
      attachments: inputAttachments,
    }).select().single();
    setSending(false);
    if (error) {
      console.error("Send failed:", error);
      toast.error("Failed to send message");
      return;
    }
    if (data) {
      const newMsg: Message = {
        ...(data as any),
        mentions: Array.isArray((data as any).mentions) ? (data as any).mentions : [],
        attachments: Array.isArray((data as any).attachments) ? (data as any).attachments : [],
      };
      setMessages((prev) => [...prev, newMsg]);
      setInput("");
      setInputMentions([]);
      setInputAttachments([]);
      fanOutNotifications(body, newMsg.mentions).catch((e) => console.error("Notify fan-out failed:", e));
    }
  };

  if (!loaded) {
    return <p className="text-xs text-muted-foreground/60 py-2">Loading thread…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground/60 italic">No messages yet. Start the conversation.</p>
        )}
        {messages.map((msg) => {
          const isMine = msg.author_id === user?.id;
          const author = msg.author_id ? profiles.get(msg.author_id) : undefined;
          const roleLabel = msg.author_role === "ceo" ? "CEO" : msg.author_role === "admin" ? "Admin" : "Leader";
          return (
            <div key={msg.id} className={cn("flex gap-2", isMine && "flex-row-reverse")}>
              <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                <AvatarFallback className="text-[10px] bg-muted">
                  {initials(author?.full_name || null)}
                </AvatarFallback>
              </Avatar>
              <div className={cn("flex-1 min-w-0 space-y-1", isMine && "flex flex-col items-end")}>
                <div className={cn("flex items-center gap-1.5", isMine && "flex-row-reverse")}>
                  <span className="text-[11px] font-medium text-foreground truncate">{author?.full_name || "Unknown"}</span>
                  <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">{roleLabel}</span>
                  <span className="text-[10px] text-muted-foreground/50">· {relTime(msg.created_at)}</span>
                </div>
                {msg.body && (
                  <div
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-lg max-w-[85%] whitespace-pre-wrap break-words",
                      isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                    )}
                  >
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

      <div className="space-y-2 pt-2 border-t border-border/40">
        {/* Attachment previews (pre-send) */}
        {inputAttachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {inputAttachments.map((att, i) => (
              <div key={i} className="relative group">
                <AttachmentPreview att={att} />
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove"
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
              inputClassName="text-xs"
            />
          </div>
          <button
            onClick={handleAttach}
            disabled={uploading || sending}
            className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center disabled:opacity-40 transition-colors"
            title="Attach file"
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
          </button>
          <button
            onClick={send}
            disabled={sending || (!input.trim() && inputMentions.length === 0 && inputAttachments.length === 0)}
            className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity"
            title="Send"
          >
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          </button>
        </div>
      </div>
    </div>
  );
}
