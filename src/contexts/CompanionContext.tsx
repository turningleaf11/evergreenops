import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useCEOContext } from "@/lib/ceo-context";
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

export function CompanionProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { data } = useCEOContext();
  const location = useLocation();

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
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg],
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
