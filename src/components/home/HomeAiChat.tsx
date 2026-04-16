import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ReactMarkdown from "react-markdown";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function HomeAiChat() {
  const { isAdmin } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const fn = isAdmin ? "ceo-chat" : "leadership-chat";
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { messages: newMessages },
      });
      if (error) throw error;
      const reply = data?.reply || data?.message || data?.content || "I couldn't generate a response.";
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch (e: any) {
      setMessages([...newMessages, { role: "assistant", content: `Sorry, I ran into an error: ${e.message || "unknown"}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <h2 className="text-base font-semibold">AI Companion</h2>
        </div>

        {messages.length > 0 && (
          <div ref={scrollRef} className="max-h-72 overflow-y-auto px-4 py-2 space-y-3">
            {messages.slice(-6).map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-foreground"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>*]:my-1">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted/60 rounded-2xl px-3 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="px-4 pb-4 pt-2">
          <div className="flex items-end gap-2 bg-muted/30 rounded-xl p-2 border border-border/40 focus-within:border-primary/40 transition-colors">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="What are you working on?"
              className="min-h-[40px] max-h-32 resize-none border-0 bg-transparent focus-visible:ring-0 p-1 text-sm"
              rows={1}
            />
            <Button
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={send}
              disabled={!input.trim() || loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
