import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCEOContext } from "@/lib/ceo-context";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AlbusAvatar } from "@/components/AlbusAvatar";
import { format } from "date-fns";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Briefing {
  bullets: string[];
  focus: string;
  generated_at: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ceo-chat`;
const sb = supabase as any;

async function streamChat({
  messages,
  ceoContext,
  onDelta,
  onDone,
}: {
  messages: Array<{ role: string; content: string }>;
  ceoContext: any;
  onDelta: (deltaText: string) => void;
  onDone: () => void;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages, ceoContext }),
  });
  if (!resp.ok) {
    if (resp.status === 429) toast.error("Rate limit. Wait a moment.");
    throw new Error(`Request failed: ${resp.status}`);
  }
  if (!resp.body) throw new Error("No response body");
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let done = false;
  while (!done) {
    const { done: streamDone, value } = await reader.read();
    if (streamDone) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { done = true; break; }
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        buf = line + "\n" + buf;
        break;
      }
    }
  }
  onDone();
}

function formatBriefingAsMessage(briefing: Briefing, firstName: string): string {
  const greeting = `**Good morning, ${firstName}.**\n\n*${format(new Date(briefing.generated_at), "EEEE, MMMM d")}*\n\n`;
  const bullets = briefing.bullets.length > 0
    ? "Here's where things stand:\n" + briefing.bullets.map((b) => `→ ${b}`).join("\n") + "\n\n"
    : "";
  const focus = briefing.focus ? `**${briefing.focus}**\n\nWhat do you want to dig into?` : "What do you want to dig into?";
  return greeting + bullets + focus;
}

const FOLLOW_UPS = [
  "Why is that the focus?",
  "What's most at risk?",
  "Who's waiting on me?",
  "Help me plan my day",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  briefing: Briefing | null;
  firstName: string;
}

export function BriefingChatSheet({ open, onOpenChange, briefing, firstName }: Props) {
  const { data: ceoContext } = useCEOContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Seed with the briefing the first time the sheet opens with a new briefing
  useEffect(() => {
    if (open && briefing) {
      setMessages([{ role: "assistant", content: formatBriefingAsMessage(briefing, firstName) }]);
      setInput("");
    }
  }, [open, briefing?.generated_at, firstName]);

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || loading) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    let acc = "";
    const upsert = (chunk: string) => {
      acc += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.content === acc.slice(0, last.content.length) && prev.length > 1 && acc.startsWith(last.content)) {
          // continuing the last streaming message — replace
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m));
        }
        // start a new assistant message
        return [...prev.slice(0, -1), prev[prev.length - 1], { role: "assistant", content: acc }];
      });
    };

    // Build full conversation for the chat function — include the briefing as the first message
    const conversation = messages.map((m) => ({ role: m.role, content: m.content })).concat([{ role: "user", content: text }]);

    try {
      // Add a placeholder assistant message we'll fill via streaming
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      await streamChat({
        messages: conversation,
        ceoContext,
        onDelta: (chunk) => {
          acc += chunk;
          setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m)));
        },
        onDone: () => setLoading(false),
      });
    } catch (e) {
      console.error("Briefing chat error:", e);
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong — try again." }]);
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <AlbusAvatar size="md" />
            Today's briefing
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && <AlbusAvatar size="md" className="mt-0.5" />}
              <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{
                    __html: msg.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="block mt-2 mb-1 first:mt-0">$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em>$1</em>')
                      .replace(/\n/g, "<br/>")
                  }} />
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {loading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-2.5">
              <AlbusAvatar size="md" />
              <div className="bg-muted rounded-xl px-3.5 py-2.5 text-sm text-muted-foreground">Thinking...</div>
            </div>
          )}

          {/* Suggested follow-ups (only show after briefing, before any user message) */}
          {messages.length === 1 && messages[0].role === "assistant" && (
            <div className="space-y-1.5 pt-2">
              {FOLLOW_UPS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="block w-full text-left text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Ask Albus anything about today..."
              className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm border-none outline-none placeholder:text-muted-foreground/50"
              disabled={loading}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
