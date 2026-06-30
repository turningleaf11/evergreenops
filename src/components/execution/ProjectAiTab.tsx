import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, User, Loader2, Send, Sparkles, ListChecks, Activity, Route, Check, X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { streamChat } from "@/lib/ai-stream";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/project-chat`;

const sb = supabase as any;

interface ProposedTask {
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "urgent";
}

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  proposedTasks?: ProposedTask[];
  proposedIntro?: string;
  tasksCreated?: boolean;
}

interface Props {
  project: any;
  tasks: any[];
  profiles: { user_id: string; full_name: string | null }[];
  linkedDocs: { id: string; title: string; content?: string }[];
  goalTitle?: string | null;
  onTasksCreated: () => void;
}

const QUICK_ACTIONS = [
  { icon: Route, label: "Plan & sequence", prompt: "Based on this project, propose a phased plan with milestones and a rough sequence of work. Identify dependencies." },
  { icon: ListChecks, label: "Generate tasks", prompt: "Break this project into a clean list of actionable tasks I can add to the project. Use the propose_tasks tool." },
  { icon: Activity, label: "Status & risks", prompt: "Give me a status summary of this project. Lead with the punchline, then flag risks, blockers, and stale items." },
  { icon: Sparkles, label: "What should I focus on next?", prompt: "Looking at the current state of this project, what are the 3 most important things to focus on next and why?" },
];

export default function ProjectAiTab({ project, tasks, profiles, linkedDocs, goalTitle, onTasksCreated }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatingFor, setCreatingFor] = useState<number | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load message history from DB on mount
  useEffect(() => {
    if (!project?.id) return;
    (async () => {
      const { data } = await sb
        .from("project_ai_messages")
        .select("id, role, content, proposed_tasks, tasks_created")
        .eq("project_id", project.id)
        .order("created_at", { ascending: true });
      if (data) {
        setMessages(
          (data as any[]).map((r) => ({
            id: r.id,
            role: r.role,
            content: r.content,
            proposedTasks: r.proposed_tasks ?? undefined,
            tasksCreated: r.tasks_created ?? false,
          }))
        );
      }
      setHistoryLoaded(true);
    })();
  }, [project?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildContext = useCallback(async () => {
    const { data: comments } = await supabase
      .from("comments")
      .select("content, created_at, author_id")
      .eq("entity_type", "project")
      .eq("entity_id", project.id)
      .order("created_at", { ascending: false })
      .limit(8);

    const recentComments = (comments || []).map((c: any) => ({
      author: profiles.find((p) => p.user_id === c.author_id)?.full_name || "Unknown",
      content: (c.content || "").replace(/<[^>]+>/g, " ").slice(0, 300),
      created_at: c.created_at,
    }));

    return { project, tasks, profiles, notes: project.notes_content, linkedDocs: linkedDocs.map((d) => ({ id: d.id, title: d.title })), goalTitle, recentComments };
  }, [project, tasks, profiles, linkedDocs, goalTitle]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;

    // Persist user message
    const { data: userRow } = await sb
      .from("project_ai_messages")
      .insert({ project_id: project.id, role: "user", content: text.trim() })
      .select("id")
      .single();

    const userMsg: Message = { id: userRow?.id, role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    let assistantSoFar = "";
    let assistantProposedTasks: ProposedTask[] | undefined;

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.id) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const context = await buildContext();
      const apiMessages = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));

      await streamChat({
        url: CHAT_URL,
        body: { messages: apiMessages, context },
        onTextDelta: upsert,
        onToolCall: ({ name, args }) => {
          if (name === "propose_tasks" && Array.isArray(args.tasks)) {
            assistantProposedTasks = args.tasks;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              const proposed: ProposedTask[] = args.tasks;
              const intro: string | undefined = args.intro;
              if (last?.role === "assistant" && !last.id) {
                return prev.map((m, i) =>
                  i === prev.length - 1
                    ? { ...m, proposedTasks: proposed, proposedIntro: intro, content: m.content || intro || "Here are tasks I'd propose:" }
                    : m
                );
              }
              return [...prev, { role: "assistant", content: intro || "Here are tasks I'd propose:", proposedTasks: proposed }];
            });
          }
        },
        onDone: async () => {
          // Persist final assistant message
          const { data: aRow } = await sb
            .from("project_ai_messages")
            .insert({
              project_id: project.id,
              role: "assistant",
              content: assistantSoFar,
              proposed_tasks: assistantProposedTasks ?? null,
            })
            .select("id")
            .single();
          // Tag the in-flight message with its DB id so future streaming doesn't re-append
          if (aRow?.id) {
            setMessages((prev) => {
              const idx = prev.findLastIndex((m) => m.role === "assistant" && !m.id);
              if (idx === -1) return prev;
              return prev.map((m, i) => (i === idx ? { ...m, id: aRow.id } : m));
            });
          }
          setLoading(false);
        },
      });
    } catch (e) {
      console.error("project-chat error:", e);
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
      setLoading(false);
    }
  };

  const createProposedTasks = async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg?.proposedTasks?.length) return;
    setCreatingFor(msgIndex);
    try {
      const rows = msg.proposedTasks.map((t) => ({
        title: t.title,
        description: t.description || null,
        priority: t.priority || "medium",
        project_id: project.id,
        created_by: user?.id,
      }));
      const { error } = await supabase.from("tasks").insert(rows as any);
      if (error) throw error;
      toast.success(`Added ${rows.length} task${rows.length === 1 ? "" : "s"} to this project`);
      setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, tasksCreated: true } : m)));
      // Persist tasks_created flag
      if (msg.id) {
        await sb.from("project_ai_messages").update({ tasks_created: true }).eq("id", msg.id);
      }
      onTasksCreated();
    } catch (e: any) {
      toast.error(e.message || "Failed to create tasks");
    } finally {
      setCreatingFor(null);
    }
  };

  const removeProposedTask = (msgIndex: number, taskIndex: number) => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === msgIndex && m.proposedTasks
          ? { ...m, proposedTasks: m.proposedTasks.filter((_, ti) => ti !== taskIndex) }
          : m
      )
    );
  };

  if (!historyLoaded) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading conversation…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
      {/* Quick actions — only shown when no history */}
      {messages.length === 0 && (
        <div className="mb-6">
          <div className="text-center mb-6">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mb-3">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Project AI Partner</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Grounded in this project's tasks, notes, files, and comments.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl mx-auto">
            {QUICK_ACTIONS.map((qa) => {
              const Icon = qa.icon;
              return (
                <button
                  key={qa.label}
                  onClick={() => send(qa.prompt)}
                  className="flex items-center gap-2.5 text-left text-sm px-3.5 py-3 rounded-xl border border-border/60 bg-card hover:bg-accent/40 hover:border-border transition-colors"
                >
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium">{qa.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((msg, i) => (
          <div key={msg.id ?? i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <div className="max-w-[80%] space-y-2">
              <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}>
                {msg.role === "assistant" ? (
                  <div dangerouslySetInnerHTML={{
                    __html: msg.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="block mt-3 mb-1 first:mt-0">$1</strong>')
                      .replace(/\n/g, "<br/>"),
                  }} />
                ) : (
                  msg.content
                )}
              </div>

              {msg.proposedTasks && msg.proposedTasks.length > 0 && (
                <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <ListChecks className="h-3.5 w-3.5" />
                      Proposed tasks ({msg.proposedTasks.length})
                    </div>
                    {msg.tasksCreated && <Badge variant="secondary" className="gap-1 text-[10px]"><Check className="h-3 w-3" /> Added</Badge>}
                  </div>
                  <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
                    {msg.proposedTasks.map((t, ti) => (
                      <div key={ti} className="flex items-start gap-2 text-sm rounded-lg px-2.5 py-1.5 hover:bg-accent/40 group">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{t.title}</div>
                          {t.description && <div className="text-xs text-muted-foreground line-clamp-2">{t.description}</div>}
                        </div>
                        {t.priority && <Badge variant="outline" className="text-[10px] shrink-0">{t.priority}</Badge>}
                        {!msg.tasksCreated && (
                          <button
                            onClick={() => removeProposedTask(i, ti)}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {!msg.tasksCreated && (
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => createProposedTasks(i)}
                        disabled={creatingFor === i || msg.proposedTasks.length === 0}
                        className="h-8 gap-1.5"
                      >
                        {creatingFor === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        Add {msg.proposedTasks.length} task{msg.proposedTasks.length === 1 ? "" : "s"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="h-7 w-7 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-foreground" />
              </div>
            )}
          </div>
        ))}

        {loading && !messages.some((m, i) => m.role === "assistant" && i === messages.length - 1 && !m.id) && (
          <div className="flex gap-2.5">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
            </div>
            <div className="bg-muted rounded-2xl px-4 py-2.5 text-sm text-muted-foreground">Thinking…</div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-4 border border-border/60 rounded-2xl bg-card p-2 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send(input))}
          placeholder="Ask about this project, generate tasks, get a status…"
          className="flex-1 bg-transparent px-3 py-2 text-sm border-none outline-none placeholder:text-muted-foreground/50"
          disabled={loading}
        />
        <Button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          size="sm"
          className="h-9 w-9 p-0 rounded-xl shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
