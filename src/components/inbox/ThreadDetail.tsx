import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, X, Reply, Archive, Trash2, Star, MailOpen, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface ThreadMessage {
  id: string;
  threadId: string;
  snippet: string;
  labelIds: string[];
  headers: Record<string, string>;
  bodyHtml: string;
  bodyText: string;
}

interface Props {
  threadId: string;
  onClose: () => void;
  onReply: (opts?: { aiBody?: string; to?: string; subject?: string }) => void;
  onMutated: () => void;
}

export function ThreadDetail({ threadId, onClose, onReply, onMutated }: Props) {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

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
        <h2 className="text-sm font-semibold flex-1 truncate">{subject}</h2>
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
        <Button variant="outline" size="sm" className="h-7 gap-1" onClick={aiSuggest} disabled={aiLoading} title="AI-drafted reply">
          {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          AI Reply
        </Button>
        <Button variant="outline" size="sm" className="h-7" onClick={() => onReply()}>
          <Reply className="h-3.5 w-3.5 mr-1" /> Reply
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
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
              <div
                className="prose prose-sm max-w-none dark:prose-invert text-sm"
                dangerouslySetInnerHTML={{ __html: m.bodyHtml }}
              />
            ) : (
              <pre className="text-sm whitespace-pre-wrap font-sans">{m.bodyText || m.snippet}</pre>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
