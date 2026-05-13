import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Anthropic API ${r.status}: ${t}`);
  }
  const data = await r.json();
  return data.content?.[0]?.text || "";
}

function safeParseJsonArray(text: string): any[] {
  // Strip markdown fences
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.items)) return parsed.items;
    return [];
  } catch {
    // Try to find first [ ... ] block
    const m = cleaned.match(/\[[\s\S]*\]/);
    if (m) {
      try {
        const arr = JSON.parse(m[0]);
        return Array.isArray(arr) ? arr : [];
      } catch { /* ignore */ }
    }
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { thread_id, mode } = await req.json();
    if (!thread_id) throw new Error("thread_id required");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify thread belongs to user (or admin) — we just rely on RLS-readable result
    const { data: thread } = await userClient
      .from("ai_strategy_threads")
      .select("id,workspace_id,created_by,summary")
      .eq("id", thread_id)
      .maybeSingle();
    if (!thread) {
      return new Response(JSON.stringify({ error: "Thread not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: msgs } = await userClient
      .from("ai_strategy_messages")
      .select("id,role,content,created_at")
      .eq("thread_id", thread_id)
      .order("created_at", { ascending: true });
    const messages = msgs || [];

    const results: any = {};

    // --- Memory extraction (last 10 messages) ---
    if (mode === "extract" || mode === "both") {
      const segment = messages.slice(-10);
      const transcript = segment
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n\n");

      const extractSystem = `You analyze conversations between a CEO and their AI strategic partner. Identify only items that would genuinely help the AI in FUTURE conversations. Skip generic statements, pleasantries, and one-off questions. Return strict JSON only — no commentary, no markdown.`;
      const extractUser = `Review this conversation segment and identify any significant:
- Decisions made (type: "decision")
- Strategic insights or realizations (type: "insight")
- Recurring patterns or themes (type: "pattern")
- CEO preferences or working style notes (type: "preference")
- Blockers or constraints mentioned (type: "blocker")

For each, return an object: { "type": "...", "title": "max 5 words", "content": "2-3 sentence summary" }
Return a JSON array. If nothing meaningful, return [].

Conversation:
${transcript}`;

      try {
        const raw = await callAI(extractSystem, extractUser);
        const items = safeParseJsonArray(raw)
          .filter((x) => x && typeof x === "object" && x.type && x.title && x.content)
          .slice(0, 8);

        if (items.length > 0) {
          const lastMsgId = segment[segment.length - 1]?.id;
          const inserts = items.map((i: any) => ({
            workspace_id: thread.workspace_id,
            memory_type: String(i.type).toLowerCase(),
            title: String(i.title).slice(0, 120),
            content: String(i.content).slice(0, 2000),
            source_thread_id: thread_id,
            source_message_id: lastMsgId,
          }));
          const { error: insErr } = await admin.from("ai_business_memory").insert(inserts);
          if (insErr) console.error("memory insert error:", insErr);
          results.extracted = items.length;
        } else {
          results.extracted = 0;
        }
      } catch (e) {
        console.error("Extract failed:", e);
        results.extractError = String(e);
      }
    }

    // --- Thread summary ---
    if (mode === "summary" || mode === "both") {
      const transcript = messages
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n\n");

      const sumSystem = `You are an executive note-taker. Produce a tight 3-5 sentence summary. No headings, no bullets — flowing prose. Focus on what was decided, what was explored, what remains unresolved.`;
      try {
        const summary = (await callAI(sumSystem, `Summarize this conversation:\n\n${transcript}`)).trim();
        if (summary) {
          await admin
            .from("ai_strategy_threads")
            .update({ summary, summary_updated_at: new Date().toISOString() })
            .eq("id", thread_id);
          results.summary = summary;
        }
      } catch (e) {
        console.error("Summary failed:", e);
        results.summaryError = String(e);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-memory-extract error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
