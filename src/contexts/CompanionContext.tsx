import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useCEOContext } from "@/lib/ceo-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface CompanionContextType {
  messages: Message[];
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  send: () => Promise<void>;
}

const CompanionContext = createContext<CompanionContextType | null>(null);

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ceo-chat`;

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

export function CompanionProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { data } = useCEOContext();
  const location = useLocation();
  const greetingSent = useRef(false);

  // Proactive greeting on CEO Dashboard
  useEffect(() => {
    if (!open || (location.pathname !== "/" && location.pathname !== "/ceo") || messages.length > 0 || greetingSent.current || loading) return;
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
          return [{ role: "assistant", content: assistantSoFar }];
        });
      };

      try {
        const liveSnapshot = await fetchLiveSnapshot();

        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: "[MORNING_BRIEFING]" }],
            ceoContext: { ...data, currentPage: location.pathname },
            liveSnapshot,
          }),
        });

        if (!resp.ok) throw new Error("Briefing request failed");
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
              if (content) upsertAssistant(content);
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
              if (content) upsertAssistant(content);
            } catch { /* ignore */ }
          }
        }
      } catch (e) {
        console.error("Briefing error:", e);
        setMessages([{ role: "assistant", content: "Good morning. I had trouble loading your briefing — ask me anything to get started." }]);
      }
      setLoading(false);
    })();
  }, [open, location.pathname, messages.length, loading, data]);

  const send = useCallback(async () => {
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

    try {
      // Filter out the briefing marker from message history sent to AI
      const historyForAI = messages.map(m => ({ role: m.role, content: m.content }));
      
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...historyForAI, userMsg],
          ceoContext: { ...data, currentPage: location.pathname },
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({ error: "Request failed" }));
        if (resp.status === 429) toast.error("Rate limit exceeded. Please wait a moment and try again.");
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
            if (content) upsertAssistant(content);
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
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }

      setLoading(false);
    } catch (e) {
      console.error("Companion error:", e);
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
      setLoading(false);
    }
  }, [input, loading, messages, data, location.pathname]);

  return (
    <CompanionContext.Provider value={{ messages, input, setInput, loading, open, setOpen, send }}>
      {children}
    </CompanionContext.Provider>
  );
}

export function useCompanion() {
  const ctx = useContext(CompanionContext);
  if (!ctx) throw new Error("useCompanion must be used within CompanionProvider");
  return ctx;
}
