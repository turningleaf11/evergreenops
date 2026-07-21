import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, X, Reply, Archive, Trash2, Star, MailOpen, Sparkles, Paperclip, Download } from "lucide-react";
import { toast } from "sonner";
import { LinkToCrm } from "./LinkToCrm";
import { EmailHtmlFrame } from "@/components/email/EmailHtmlFrame";
import { useAuth } from "@/contexts/AuthContext";

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
function extractEmails(headerVal: string | undefined): string[] {
  if (!headerVal) return [];
  return Array.from(headerVal.matchAll(EMAIL_RE)).map((m) => m[0].toLowerCase());
}

interface Attachment {
  filename: string;
  mimeType: string;
  size: number | null;
  attachmentId: string;
}

interface ThreadMessage {
  id: string;
  threadId: string;
  snippet: string;
  labelIds: string[];
  headers: Record<string, string>;
  bodyHtml: string;
  bodyText: string;
  attachments?: Attachment[];
}

interface Props {
  threadId: string;
  onClose: () => void;
  onReply: (opts?: { aiBody?: string; to?: string; subject?: string }) => void;
  onMutated: () => void;
}

export function ThreadDetail({ threadId, onClose, onReply, onMutated }: Props) {
  const { profile } = useAuth() as any;
  const workspaceId = profile?.workspace_id ?? null;
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const participantEmails = useMemo(() => {
    const set = new Set<string>();
    for (const m of messages) {
      extractEmails(m.headers?.from).forEach((e) => set.add(e));
      extractEmails(m.headers?.to).forEach((e) => set.add(e));
      extractEmails(m.headers?.cc).forEach((e) => set.add(e));
    }
    return Array.from(set);
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke(
        `gmail-get-thread?id=${threadId}`,
        { method: "GET" } as any,
      );
      if (!cancelled) {
        if (!error && data?.messages) setMessages(data.messages);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [threadId]);

  const modify = async (action: string) => {
    const { error } = await supabase.functions.invoke("gmail-modify", {
      body: { threadId, action },
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`Marked as ${action}`);
      onMutated();
    }
  };

  const aiSuggest = async () => {
    setAiLoading(true);
    const { data, error } = await supabase.functions.invoke("email-ai-triage", {
      body: { mode: "suggest_reply", threadId },
    });
    setAiLoading(false);
    if (error) { toast.error(error.message); return; }
    const lastFrom = messages[messages.length - 1]?.headers?.from || "";
    const subject = messages[0]?.headers?.subject || "";
    const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
    onReply({ aiBody: data?.html || "", to: lastFrom, subject: replySubject });
  };

  if (loading) {
    return <div className="p-6 text-center text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>;
  }

  const subject = messages[0]?.headers.subject || "(no subject)";

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border/30 p-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold flex-1 min-w-0 truncate">{subject}</h2>
        <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Mark unread" onClick={() => modify("unread")}>
          <MailOpen className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Star" onClick={() => modify("star")}>
          <Star className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Archive" onClick={() => modify("archive")}>
          <Archive className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Trash" onClick={() => modify("trash")}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <LinkToCrm
          threadId={threadId}
          participantEmails={participantEmails}
          subject={subject}
          snippet={messages[0]?.snippet || ""}
          workspaceId={workspaceId}
        />
        <Button variant="outline" size="sm" className="h-7 gap-1" onClick={aiSuggest} disabled={aiLoading} title="AI-drafted reply">
          {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          AI Reply
        </Button>
        <Button variant="outline" size="sm" className="h-7" onClick={() => {
          const lastFrom = messages[messages.length - 1]?.headers?.from || "";
          const subj = messages[0]?.headers?.subject || "";
          const replySubject = /^re:/i.test(subj) ? subj : `Re: ${subj}`;
          onReply({ to: lastFrom, subject: replySubject });
        }}>
          <Reply className="h-3.5 w-3.5 mr-1" /> Reply
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto divide-y divide-border/30">
        {messages.map((m) => (
          <article key={m.id} className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="text-xs">
                <div className="font-medium">{m.headers.from}</div>
                <div className="text-muted-foreground">to {m.headers.to}</div>
              </div>
              <div className="text-[10px] text-muted-foreground">{m.headers.date}</div>
            </div>
            {m.bodyHtml ? (
              <EmailHtmlFrame html={m.bodyHtml} />
            ) : (
              <pre className="text-sm whitespace-pre-wrap font-sans">{m.bodyText || m.snippet}</pre>
            )}
            {m.attachments && m.attachments.length > 0 && (
              <MessageAttachments messageId={m.id} attachments={m.attachments} />
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

const fmtBytes = (n: number | null) =>
  n == null ? "" : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

/**
 * Renders a message's attachments. Images load inline (fetched on demand as a
 * data URI); other files show as a chip you can download. Fetches go through
 * gmail-get-attachment so the access token stays server-side.
 */
function MessageAttachments({ messageId, attachments }: { messageId: string; attachments: Attachment[] }) {
  const [uris, setUris] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const fetchOne = async (a: Attachment): Promise<string | null> => {
    if (uris[a.attachmentId]) return uris[a.attachmentId];
    setBusy(a.attachmentId);
    const { data, error } = await supabase.functions.invoke(
      `gmail-get-attachment?message_id=${messageId}&attachment_id=${a.attachmentId}&mime=${encodeURIComponent(a.mimeType)}`,
      { method: "GET" } as any,
    );
    setBusy(null);
    if (error || !(data as any)?.data_uri) {
      toast.error("Couldn't load attachment");
      return null;
    }
    const uri = (data as any).data_uri as string;
    setUris((prev) => ({ ...prev, [a.attachmentId]: uri }));
    return uri;
  };

  // Auto-load images so they render inline like an email client.
  useEffect(() => {
    attachments
      .filter((a) => a.mimeType.startsWith("image/"))
      .forEach((a) => { void fetchOne(a); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId]);

  const download = async (a: Attachment) => {
    const uri = await fetchOne(a);
    if (!uri) return;
    const link = document.createElement("a");
    link.href = uri;
    link.download = a.filename;
    link.click();
  };

  return (
    <div className="mt-3 space-y-2">
      {attachments.map((a) => {
        const isImage = a.mimeType.startsWith("image/");
        const uri = uris[a.attachmentId];
        if (isImage && uri) {
          return (
            <div key={a.attachmentId} className="space-y-1">
              <img src={uri} alt={a.filename} className="max-w-full rounded-md border border-border/40" />
              <button onClick={() => download(a)} className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <Download className="h-3 w-3" /> {a.filename} · {fmtBytes(a.size)}
              </button>
            </div>
          );
        }
        return (
          <button
            key={a.attachmentId}
            onClick={() => download(a)}
            disabled={busy === a.attachmentId}
            className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5 text-left text-sm hover:bg-muted/60 w-full max-w-sm"
          >
            {busy === a.attachmentId ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <span className="truncate flex-1">{a.filename}</span>
            <span className="text-[11px] text-muted-foreground shrink-0">{fmtBytes(a.size)}</span>
            <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        );
      })}
    </div>
  );
}

