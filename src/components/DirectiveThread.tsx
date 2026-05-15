import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const sb = supabase as any;

type Message = {
  id: string;
  strategy_item_id: string;
  department_id: string | null;
  author_id: string | null;
  author_role: string;
  body: string;
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

export function DirectiveThread({ strategyItemId, departmentId }: Props) {
  const { user, isPrimaryAdmin, isAdmin } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
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
      const msgs = (data ?? []) as Message[];
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

  const send = async () => {
    const body = input.trim();
    if (!body || !user || sending) return;
    setSending(true);
    const role = isPrimaryAdmin ? "ceo" : isAdmin ? "admin" : "leader";
    const { data, error } = await sb.from("directive_messages").insert({
      strategy_item_id: strategyItemId,
      department_id: departmentId || null,
      author_id: user.id,
      author_role: role,
      body,
    }).select().single();
    setSending(false);
    if (error) {
      console.error("Send failed:", error);
      return;
    }
    if (data) {
      setMessages((prev) => [...prev, data as Message]);
      setInput("");
    }
  };

  if (!loaded) {
    return <p className="text-xs text-muted-foreground/60 py-2">Loading thread…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
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
              <div className={cn("flex-1 min-w-0", isMine && "flex flex-col items-end")}>
                <div className={cn("flex items-center gap-1.5 mb-0.5", isMine && "flex-row-reverse")}>
                  <span className="text-[11px] font-medium text-foreground truncate">{author?.full_name || "Unknown"}</span>
                  <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">{roleLabel}</span>
                  <span className="text-[10px] text-muted-foreground/50">· {relTime(msg.created_at)}</span>
                </div>
                <div
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-lg max-w-[85%] whitespace-pre-wrap break-words",
                    isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}
                >
                  {msg.body}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Reply to this directive…"
          disabled={sending}
          className="flex-1 bg-muted/40 rounded-md px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground/50"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity"
          title="Send"
        >
          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}
