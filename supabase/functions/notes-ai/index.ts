import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Action = "plan" | "tasks" | "summarize" | "expand" | "rewrite";

const SYSTEM_BY_ACTION: Record<Action, string> = {
  plan:
    "You are a pragmatic project planner. Turn the user's notes into a clean, phased plan with milestones and a short rationale. Output well-structured Markdown with headings, bullets, and numbered phases. No preamble.",
  tasks:
    "Extract concrete, actionable tasks from the user's notes. Output ONLY a Markdown checklist (use `- [ ] task title` per line). One task per line. No headings, no preamble, no commentary. Use the imperative voice.",
  summarize:
    "Summarize the user's notes in a tight, high-signal way. Lead with a 1-sentence punchline, then 3–6 bullets of key points, then any decisions or next steps. Output Markdown. No preamble.",
  expand:
    "Expand the user's outline into well-written prose. Preserve their structure and intent. Use Markdown headings/bullets only where they help. No preamble.",
  rewrite:
    "Rewrite the user's text to be clearer, tighter, and more direct while preserving meaning and tone. Output Markdown. No preamble.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, text } = await req.json() as { action: Action; text: string };
    const sys = SYSTEM_BY_ACTION[action];
    if (!sys) {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userText = (text || "").slice(0, 12000).trim() ||
      "(The note is empty — produce a helpful starter based on the action.)";

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userText },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ error: errText || "AI request failed" }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(resp.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
