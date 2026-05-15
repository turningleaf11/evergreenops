import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCEOContext } from "@/lib/ceo-context";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ceo-chat`;

async function streamChat({
  messages,
  ceoContext,
  onDelta,
  onDone,
}: {
  messages: Message[];
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
    if (resp.status === 429) toast.error("Rate limit. Wait a moment and try again.");
    else if (resp.status === 402) toast.error("AI credits exhausted.");
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

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  scratchpadText: string;
  scratchpadImages: string[];
  onTriageNow: () => void;
}

const STARTER_PROMPTS = [
  "Help me think through this",
  "What should I prioritize from this dump?",
  "What am I missing here?",
  "Pull out what really matters",
];

export function ScratchPadDiscussSheet({ open, onOpenChange, scratchpadText, scratchpadImages, onTriageNow }: Props) {
  const { data: ceoContext } = useCEOContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset conversation when sheet opens with fresh content
  useEffect(() => {
    if (open) {
      setMessages([]);
      setInput("");
    }
  }, [open]);

  const buildContextPreamble = (): Message => {
    const imageNote = scratchpadImages.length > 0
      ? `\n\nThe user also attached ${scratchpadImages.length} image(s) (likely handwritten notes, whiteboards, or screenshots).`
      : "";
    return {
      role: "system",
      content: `The CEO just dumped the following into their scratchpad. Help them think through it as their chief of staff — surface what matters, push back where useful, ask clarifying questions, and help them decide what should become a task, project, goal, idea, or directive. Don't auto-triage yet — that happens separately when they're ready.\n\n--- SCRATCHPAD DUMP ---\n${scratchpadText || "(no text — only images)"}${imageNote}\n--- END DUMP ---`,
    };
  };

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || loading) return;
    const userMsg: Message = { role: "user", content: text };

    // First send: include the scratchpad context preamble
    const preamble = messages.length === 0 ? [buildContextPreamble()] : [];
    const conversation: Message[] = [...preamble, ...messages, userMsg];

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    let acc = "";
    const upsert = (chunk: string) => {
      acc += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m));
        }
        return [...prev, { role: "assistant", content: acc }];
      });
    };

    try {
      await streamChat({
        messages: conversation,
        ceoContext,
        onDelta: upsert,
        onDone: () => setLoading(false),
      });
    } catch (e) {
      console.error("Discuss error:", e);
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Try again." }]);
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <span className="text-base">🧙‍♂️</span>
            Talk it through with Albus
          </SheetTitle>
        </SheetHeader>

        {/* Dump preview */}
        <div className="px-5 py-3 border-b border-border bg-muted/30 max-h-32 overflow-y-auto">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Your dump</p>
          <p className="text-xs text-foreground whitespace-pre-wrap line-clamp-4">
            {scratchpadText || "(images only)"}
          </p>
          {scratchpadImages.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-1">+ {scratchpadImages.length} image(s)</p>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8 space-y-3">
              <span className="text-3xl block">🧙‍♂️</span>
              <p className="text-sm text-muted-foreground">I've got your dump. What do you want to think through first?</p>
              <div className="space-y-1.5 pt-2">
                {STARTER_PROMPTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="block w-full text-left text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.filter((m) => m.role !== "system").map((msg, i) => (
            <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-sm">
                  🧙‍♂️
                </div>
              )}
              <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{
                    __html: msg.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="block mt-3 mb-1 first:mt-0">$1</strong>')
                      .replace(/\n/g, "<br/>")
                  }} />
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {loading && !messages.some((m, i) => m.role === "assistant" && i === messages.length - 1) && (
            <div className="flex gap-2.5">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm">🧙‍♂️</div>
              <div className="bg-muted rounded-xl px-3.5 py-2.5 text-sm text-muted-foreground">Thinking...</div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input + triage CTA */}
        <div className="border-t border-border px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Ask Albus anything about this..."
              className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm border-none outline-none placeholder:text-muted-foreground/50"
              disabled={loading}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity"
              title="Send"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button
            onClick={() => { onOpenChange(false); onTriageNow(); }}
            variant="default"
            className="w-full gap-1.5"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Ready — triage this dump now
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
