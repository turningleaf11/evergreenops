import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCEOContext } from "@/lib/ceo-context";
import { Send, Bot, User, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// AI edge function call here — passes CEOContext as system prompt
// TODO: Replace mock with real Lovable AI edge function call
async function getMockResponse(userMessage: string, _context: string): Promise<string> {
  // Simulate delay
  await new Promise((r) => setTimeout(r, 1200));
  
  return `**Actual Problem**
${userMessage}

**Root Cause**
This needs deeper analysis with real-time data. Connect the AI Strategy Companion to Lovable AI for contextual responses.

**Options**
1. Maintain current approach and monitor
2. Adjust strategy based on pipeline data
3. Escalate for team input

**Recommended Path**
Option 2 — Use the data you're already tracking to make an informed adjustment.

**Next Actions**
- Review pipeline snapshot numbers
- Update your current objective if needed
- Log this as a decision once resolved

*— Connect Lovable AI to get real, context-aware strategy responses.*`;
}

function buildSystemContext(data: ReturnType<typeof useCEOContext>["data"]): string {
  return `You are a CEO Strategy Companion for Evergreen Real Estate Ventures.

CURRENT CONTEXT:
- Objective: ${data.currentObjective || "Not set"}
- Constraints: ${data.currentConstraints.join(", ") || "None set"}
- Top Priorities: ${data.topPriorities.map((p) => `${p.text} (${p.status})`).join("; ") || "None"}
- Recent Decisions: ${data.recentDecisions.slice(0, 5).map((d) => `${d.date}: ${d.text}`).join("; ") || "None"}
- Strategic Tensions: ${data.strategicTensions.map((t) => `${t.tension}: ${t.sideA} vs ${t.sideB}`).join("; ") || "None"}
- Pipeline: ${data.pipelineSnapshot.wholesaleDeals} wholesale, ${data.pipelineSnapshot.portfolioDeals} portfolio, ${data.pipelineSnapshot.closingThisMonth} closing this month

BUSINESS CONTEXT:
- Two acquisition teams: Wholesale (residential 1-4 unit) and Portfolio (multifamily 5+, business acquisitions, JV deals)
- This is a strategy tool, not ops management

RESPONSE FORMAT (always use this structure):
**Actual Problem** — What's really going on
**Root Cause** — Why this is happening
**Options** — 2-4 concrete options
**Recommended Path** — Your recommendation and why
**Next Actions** — Specific next steps`;
}

interface CeoAiChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CeoAiChat({ open, onOpenChange }: CeoAiChatProps) {
  const { data } = useCEOContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const systemContext = buildSystemContext(data);
      const response = await getMockResponse(userMsg.content, systemContext);
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-primary" />
            Strategy Companion
          </SheetTitle>
        </SheetHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12 space-y-3">
              <Bot className="h-8 w-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">Ask me anything about your strategy, priorities, or decisions.</p>
              <div className="space-y-1.5">
                {["What should I prioritize this week?", "Help me think through our pipeline strategy", "What risks am I not seeing?"].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); }}
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
                msg.role === "user" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-foreground"
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
              {msg.role === "user" && (
                <div className="h-6 w-6 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5 text-foreground" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-2.5">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              </div>
              <div className="bg-muted rounded-xl px-3.5 py-2.5 text-sm text-muted-foreground">Thinking...</div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Ask your strategy companion..."
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
