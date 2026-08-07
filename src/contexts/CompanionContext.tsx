import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useCEOContext } from "@/lib/ceo-context";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { assembleStrategyContext, type AssembledStrategyContext } from "@/lib/strategy-context";
import { setAlbusDockOpen } from "@/lib/albus-dock";
import { streamChat } from "@/lib/ai-stream";
import { toast } from "sonner";
import type { SaveDestination } from "@/components/companion/SaveToAppDialog";

export interface ProposedTask {
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "urgent";
}

export interface Message {
  /** ai_strategy_messages row id (null while streaming, set after persistence) */
  id: string | null;
  role: "user" | "assistant";
  content: string;
  saved_to_type?: SaveDestination | null;
  saved_to_id?: string | null;
  /** propose_tasks tool call — only fires when the active entity is a project. */
  proposedTasks?: ProposedTask[];
  proposedIntro?: string;
  tasksCreated?: boolean;
}

export interface ThreadSummary {
  id: string;
  title: string;
  thread_type: string;
  status: string;
  last_message_at: string;
  created_at: string;
}

/** What the user is currently looking at — set by pages/peeks so Albus has context. */
export interface ActiveEntity {
  type: string;   // "project" | "task" | "goal" | "deal" | ...
  id: string;
  title: string;
}

interface CompanionContextType {
  messages: Message[];
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  activeEntity: ActiveEntity | null;
  setActiveEntity: (e: ActiveEntity | null) => void;
  send: (textOverride?: string) => Promise<void>;
  // Thread management
  threads: ThreadSummary[];
  activeThreadId: string | null;
  threadsLoading: boolean;
  selectThread: (id: string) => Promise<void>;
  newThread: () => void;
  renameThread: (id: string, title: string) => Promise<void>;
  archiveThread: (id: string) => Promise<void>;
  refreshThreads: () => Promise<void>;
  /** Mark a message as saved (updates local state) */
  markMessageSaved: (messageId: string, dest: SaveDestination, savedId: string) => void;
  /** Create the tasks a propose_tasks tool call proposed on a given message, scoped to the active project. */
  createProposedTasks: (messageIndex: number) => Promise<void>;
  /** Drop one proposed task from a message's list before it's created. */
  removeProposedTask: (messageIndex: number, taskIndex: number) => void;
  creatingTasksFor: number | null;
}

export const CompanionContext = createContext<CompanionContextType | null>(null);

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ceo-chat`;
const EXTRACT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-memory-extract`;

async function fetchLiveSnapshot() {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString();

  const [tasksRes, projectsRes, decisionsRes, issuesRes, activityRes] = await Promise.all([
    supabase.from("tasks").select("id,title,status,due_date,priority").lt("due_date", today).neq("status", "done").limit(20),
    supabase.from("projects").select("id,title,status,priority").in("status", ["blocked", "at_risk"]).limit(20),
    supabase.from("decision_log").select("id,title,created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("issues").select("id,title,status,priority").eq("status", "open").order("priority", { ascending: true }).limit(10),
    supabase.from("activity_events").select("id,action,entity_type,entity_title,created_at").gte("created_at", yesterday).order("created_at", { ascending: false }).limit(15),
  ]);

  return {
    overdueTasks: tasksRes.data || [],
    stalledProjects: projectsRes.data || [],
    recentDecisions: decisionsRes.data || [],
    openIssues: issuesRes.data || [],
    recentActivity: activityRes.data || [],
  };
}

/** Generate a 4-5 word title from the first user message via the AI gateway (non-streaming). */
async function generateThreadTitle(firstMessage: string): Promise<string> {
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `Summarize this opening message as a concise 4-5 word conversation title. Reply with only the title, no quotes, no punctuation at the end.\n\nMessage: "${firstMessage}"`,
          },
        ],
        ceoContext: {},
        titleOnly: true,
      }),
    });
    if (!resp.ok || !resp.body) throw new Error("title gen failed");
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let title = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n")) !== -1) {
        let line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const j = line.slice(6).trim();
        if (j === "[DONE]") break;
        try {
          const p = JSON.parse(j);
          const c = p.choices?.[0]?.delta?.content as string | undefined;
          if (c) title += c;
        } catch { /* ignore */ }
      }
    }
    title = title.trim().replace(/^["']|["']$/g, "").replace(/\.$/, "");
    const words = title.split(/\s+/).slice(0, 6).join(" ");
    return words || firstMessage.slice(0, 40);
  } catch {
    return firstMessage.slice(0, 40);
  }
}

/** Fire-and-forget background memory extraction + (optional) summary */
async function triggerMemoryExtraction(threadId: string, mode: "extract" | "summary" | "both") {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return;
    await fetch(EXTRACT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ thread_id: threadId, mode }),
    });
  } catch (e) {
    console.warn("memory extraction failed:", e);
  }
}

export function CompanionProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeEntity, setActiveEntity] = useState<ActiveEntity | null>(null);
  const { data } = useCEOContext();
  const { user, profile, isPrimaryAdmin } = useAuth();
  const location = useLocation();
  const greetingSent = useRef(false);

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threadsLoading, setThreadsLoading] = useState(false);

  const refreshThreads = useCallback(async () => {
    if (!user?.id) return;
    setThreadsLoading(true);
    const { data: rows, error } = await supabase
      .from("ai_strategy_threads")
      .select("id,title,thread_type,status,last_message_at,created_at")
      .eq("status", "active")
      .order("last_message_at", { ascending: false })
      .limit(100);
    if (!error && rows) setThreads(rows as ThreadSummary[]);
    setThreadsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (open && isPrimaryAdmin) refreshThreads();
  }, [open, isPrimaryAdmin, refreshThreads]);

  // Drive the dock store/CSS var so sheets shift left + go non-modal while open.
  useEffect(() => { setAlbusDockOpen(open); }, [open]);

  const selectThread = useCallback(async (id: string) => {
    setActiveThreadId(id);
    greetingSent.current = true;
    const { data: rows } = await (supabase as any)
      .from("ai_strategy_messages")
      .select("id,role,content,saved_to_type,saved_to_id,proposed_tasks,tasks_created")
      .eq("thread_id", id)
      .order("created_at", { ascending: true });
    setMessages(
      (rows || []).map((r: any) => ({
        id: r.id,
        role: r.role as "user" | "assistant",
        content: r.content,
        saved_to_type: r.saved_to_type ?? null,
        saved_to_id: r.saved_to_id ?? null,
        proposedTasks: r.proposed_tasks ?? undefined,
        tasksCreated: r.tasks_created ?? false,
      })),
    );
  }, []);

  const newThread = useCallback(() => {
    setActiveThreadId(null);
    setMessages([]);
    greetingSent.current = false;
  }, []);

  const renameThread = useCallback(async (id: string, title: string) => {
    const trimmed = title.trim() || "Untitled";
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, title: trimmed } : t)));
    await supabase.from("ai_strategy_threads").update({ title: trimmed }).eq("id", id);
  }, []);

  const archiveThread = useCallback(async (id: string) => {
    await supabase.from("ai_strategy_threads").update({ status: "archived" }).eq("id", id);
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (activeThreadId === id) {
      setActiveThreadId(null);
      setMessages([]);
    }
    toast.success("Conversation archived");
  }, [activeThreadId]);

  const markMessageSaved = useCallback((messageId: string, dest: SaveDestination, savedId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, saved_to_type: dest, saved_to_id: savedId } : m)),
    );
  }, []);

  const [creatingTasksFor, setCreatingTasksFor] = useState<number | null>(null);

  // Create the tasks a propose_tasks tool call proposed, scoped to whichever
  // project is active (this only fires when currentEntity.type === "project").
  const createProposedTasks = useCallback(async (messageIndex: number) => {
    const msg = messages[messageIndex];
    if (!msg?.proposedTasks?.length || !activeEntity || activeEntity.type !== "project" || !user?.id) return;
    setCreatingTasksFor(messageIndex);
    try {
      const rows = msg.proposedTasks.map((t) => ({
        title: t.title,
        description: t.description || null,
        priority: t.priority || "medium",
        project_id: activeEntity.id,
        created_by: user.id,
      }));
      const { error } = await supabase.from("tasks").insert(rows as any);
      if (error) throw error;
      toast.success(`Added ${rows.length} task${rows.length === 1 ? "" : "s"} to ${activeEntity.title}`);
      setMessages((prev) => prev.map((m, i) => (i === messageIndex ? { ...m, tasksCreated: true } : m)));
      if (msg.id) await (supabase as any).from("ai_strategy_messages").update({ tasks_created: true }).eq("id", msg.id);
      // Let the project page (if open) know to refetch its task list.
      window.dispatchEvent(new CustomEvent("albus-tasks-created", { detail: { projectId: activeEntity.id } }));
    } catch (e: any) {
      toast.error(e.message || "Failed to create tasks");
    } finally {
      setCreatingTasksFor(null);
    }
  }, [messages, activeEntity, user?.id]);

  const removeProposedTask = useCallback((messageIndex: number, taskIndex: number) => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === messageIndex && m.proposedTasks
          ? { ...m, proposedTasks: m.proposedTasks.filter((_, ti) => ti !== taskIndex) }
          : m,
      ),
    );
  }, []);

  // Proactive greeting — only when no active thread
  useEffect(() => {
    if (!open || activeThreadId) return;
    if ((location.pathname !== "/" && location.pathname !== "/ceo")) return;
    if (messages.length > 0 || greetingSent.current || loading) return;
    greetingSent.current = true;

    (async () => {
      setLoading(true);
      let assistantSoFar = "";
      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [{ id: null, role: "assistant", content: assistantSoFar }];
        });
      };

      try {
        const [liveSnapshot, strategyContext] = await Promise.all([
          fetchLiveSnapshot(),
          assembleStrategyContext({
            userName: profile?.full_name || user?.email || "the CEO",
            workspaceId: profile?.workspace_id ?? null,
          }),
        ]);
        await streamChat({
          url: CHAT_URL,
          body: {
            messages: [{ role: "user", content: "[MORNING_BRIEFING]" }],
            ceoContext: { ...data, currentPage: location.pathname, currentEntity: activeEntity },
            strategyContext,
            liveSnapshot,
          },
          onTextDelta: upsertAssistant,
        });
      } catch (e) {
        console.error("Briefing error:", e);
        setMessages([{ id: null, role: "assistant", content: "Good morning. I had trouble loading your briefing — ask me anything to get started." }]);
      }
      setLoading(false);
    })();
  }, [open, location.pathname, messages.length, loading, data, activeThreadId, profile?.full_name, profile?.workspace_id, user?.email, activeEntity]);

  const send = useCallback(async (textOverride?: string) => {
    const raw = textOverride ?? input;
    if (!raw.trim() || loading || !user?.id) return;
    const userText = raw.trim();
    const userMsg: Message = { id: null, role: "user", content: userText };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    let threadId = activeThreadId;
    let isFirstMessage = false;

    try {
      if (!threadId) {
        const { data: created, error: tErr } = await supabase
          .from("ai_strategy_threads")
          .insert({
            created_by: user.id,
            workspace_id: profile?.workspace_id ?? null,
            thread_type: "strategy",
            title: "New conversation",
          })
          .select("id,title,thread_type,status,last_message_at,created_at")
          .single();
        if (tErr || !created) throw tErr || new Error("Could not create thread");
        threadId = created.id;
        setActiveThreadId(threadId);
        setThreads((prev) => [created as ThreadSummary, ...prev]);
        isFirstMessage = true;
      }

      let strategyContext: AssembledStrategyContext | null = null;
      try {
        strategyContext = await assembleStrategyContext({
          userName: profile?.full_name || user.email || "the CEO",
          workspaceId: profile?.workspace_id ?? null,
        });
      } catch (ctxErr) {
        console.error("Strategy context assembly failed:", ctxErr);
      }

      // Persist user message and capture id
      const { data: insertedUser } = await supabase
        .from("ai_strategy_messages")
        .insert({
          thread_id: threadId,
          role: "user",
          content: userText,
          context_snapshot: strategyContext as any,
        })
        .select("id")
        .single();
      if (insertedUser?.id) {
        setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 && m.role === "user" && m.id === null ? { ...m, id: insertedUser.id } : m)));
      }

      const history = [...messages, userMsg].slice(-10).map((m) => ({ role: m.role, content: m.content }));

      let assistantSoFar = "";
      let assistantProposedTasks: ProposedTask[] | undefined;
      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && !last.id) {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { id: null, role: "assistant", content: assistantSoFar }];
        });
      };

      await streamChat({
        url: CHAT_URL,
        body: {
          messages: history,
          ceoContext: { ...data, currentPage: location.pathname, currentEntity: activeEntity },
          strategyContext,
        },
        onTextDelta: upsertAssistant,
        onToolCall: ({ name, args }) => {
          if (name !== "propose_tasks" || !Array.isArray(args?.tasks)) return;
          assistantProposedTasks = args.tasks;
          const intro: string | undefined = args.intro;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && !last.id) {
              return prev.map((m, i) =>
                i === prev.length - 1
                  ? { ...m, proposedTasks: args.tasks, proposedIntro: intro, content: m.content || intro || "Here are tasks I'd propose:" }
                  : m,
              );
            }
            return [...prev, { id: null, role: "assistant", content: intro || "Here are tasks I'd propose:", proposedTasks: args.tasks }];
          });
        },
      });

      if (assistantSoFar.trim() || assistantProposedTasks) {
        const { data: insertedAssistant } = await (supabase as any)
          .from("ai_strategy_messages")
          .insert({
            thread_id: threadId,
            role: "assistant",
            content: assistantSoFar || "Here are tasks I'd propose:",
            proposed_tasks: assistantProposedTasks ?? null,
          })
          .select("id")
          .single();
        if (insertedAssistant?.id) {
          setMessages((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1 && m.role === "assistant" && m.id === null
                ? { ...m, id: insertedAssistant.id }
                : m,
            ),
          );
        }
      }
      await supabase
        .from("ai_strategy_threads")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", threadId);

      if (isFirstMessage) {
        generateThreadTitle(userText).then(async (title) => {
          if (!title) return;
          await supabase.from("ai_strategy_threads").update({ title }).eq("id", threadId!);
          setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, title } : t)));
        });
      }

      setThreads((prev) => {
        const moved = prev.find((t) => t.id === threadId);
        const rest = prev.filter((t) => t.id !== threadId);
        const updated = moved ? { ...moved, last_message_at: new Date().toISOString() } : null;
        return updated ? [updated, ...rest] : prev;
      });

      // ---- Background: memory extraction & rolling summary ----
      // Total persisted messages = previous count + this user msg (+1) + maybe assistant (+1)
      const totalAfter = (messages.length + 2);
      const shouldExtract = totalAfter > 0 && totalAfter % 5 === 0;
      const shouldSummarize = totalAfter >= 20 && totalAfter % 10 === 0;
      if (shouldExtract || shouldSummarize) {
        const mode = shouldExtract && shouldSummarize ? "both" : shouldExtract ? "extract" : "summary";
        triggerMemoryExtraction(threadId!, mode);
      }
    } catch (e) {
      console.error("Companion error:", e);
      const detail = e instanceof Error ? e.message : "Unknown error";
      setMessages((prev) => [...prev, { id: null, role: "assistant", content: `Albus error: ${detail}` }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, data, location.pathname, activeThreadId, user?.id, user?.email, profile?.workspace_id, profile?.full_name, activeEntity]);

  return (
    <CompanionContext.Provider
      value={{
        messages,
        input,
        setInput,
        loading,
        open,
        setOpen,
        activeEntity,
        setActiveEntity,
        send,
        threads,
        activeThreadId,
        threadsLoading,
        selectThread,
        newThread,
        renameThread,
        archiveThread,
        refreshThreads,
        markMessageSaved,
        createProposedTasks,
        removeProposedTask,
        creatingTasksFor,
      }}
    >
      {children}
    </CompanionContext.Provider>
  );
}

export function useCompanion() {
  const ctx = useContext(CompanionContext);
  if (!ctx) throw new Error("useCompanion must be used within CompanionProvider");
  return ctx;
}

/**
 * Report the entity a surface is showing to Albus while it's mounted/open, so
 * he knows what you're looking at. Clears on unmount. Safe to call with null.
 * Usage: useReportActiveEntity(open && row ? { type: "task", id, title: row.title } : null)
 */
export function useReportActiveEntity(entity: ActiveEntity | null) {
  const ctx = useContext(CompanionContext);
  const key = entity ? `${entity.type}:${entity.id}:${entity.title}` : null;
  useEffect(() => {
    ctx?.setActiveEntity(entity);
    return () => ctx?.setActiveEntity(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, key]);
}
