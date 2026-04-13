import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useStrategyFlow } from "@/lib/strategy-flow";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/leadership-chat`;

async function streamChat({
  messages,
  context,
  onDelta,
  onDone,
}: {
  messages: Message[];
  context: any;
  onDelta: (deltaText: string) => void;
  onDone: () => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, context }),
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({ error: "Request failed" }));
    if (resp.status === 429) toast.error("Rate limit exceeded. Please wait and try again.");
    else if (resp.status === 402) toast.error("AI credits exhausted. Add funds in Settings → Workspace → Usage.");
    throw new Error(errorData.error || "Failed to get response");
  }

  if (!resp.body) throw new Error("No response body");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") { streamDone = true; break; }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {}
    }
  }

  onDone();
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
}

export function LeadershipAiChat({ open, onOpenChange, departmentId }: Props) {
  const { getItemsForDepartment, translations, proposals } = useStrategyFlow();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const dept = departments.find((d) => d.id === departmentId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    const context = {
      departmentName: dept?.name,
      departmentId,
      strategyItems: getItemsForDepartment(departmentId),
      translations: translations.filter((t) => t.departmentId === departmentId),
      proposals: proposals.filter((p) => p.departmentId === departmentId),
    };

    try {
      await streamChat({
        messages: [...messages, userMsg],
        context,
        onDelta: upsertAssistant,
        onDone: () => setLoading(false),
      });
    } catch (e) {
      console.error("Chat error:", e);
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
      setLoading(false);
    }
  };

  const suggestions = [
    "How should I translate the latest strategy item for my team?",
    "What blockers should I escalate?",
    "Help me prepare structured feedback for the CEO",
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-primary" />
            Leadership AI — {dept?.name}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12 space-y-3">
              <Bot className="h-8 w-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">I help with translation, problem-solving, and execution improvement.</p>
              <div className="space-y-1.5">
                {suggestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="block w-full text-left text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-primary" />
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
                ) : msg.content}
              </div>
              {msg.role === "user" && (
                <div className="h-6 w-6 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5 text-foreground" />
                </div>
              )}
            </div>
          ))}

          {loading && !messages.some((m, i) => m.role === "assistant" && i === messages.length - 1) && (
            <div className="flex gap-2.5">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              </div>
              <div className="bg-muted rounded-xl px-3.5 py-2.5 text-sm text-muted-foreground">Thinking...</div>
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
              placeholder="Ask about execution, strategy translation..."
              className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm border-none outline-none placeholder:text-muted-foreground/50"
              disabled={loading}
            />
            <button
              onClick={send}
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
