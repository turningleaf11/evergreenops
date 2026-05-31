import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const strategyItemsSummary = (context?.strategyItems || [])
      .map((si: any) => `- [${si.type}] "${si.title}" (${si.status}): ${si.description}`)
      .join("\n");

    const translationsSummary = (context?.translations || [])
      .map((t: any) => `- For "${t.strategyItemId}": Meaning: ${t.meaning} | Changes: ${t.immediateChanges} | Priorities: ${t.priorities?.join(", ")}`)
      .join("\n");

    const proposalsSummary = (context?.proposals || [])
      .map((p: any) => `- [${p.type}] "${p.title}" (${p.status}): ${p.reasoning}`)
      .join("\n");

    const systemPrompt = `You are a Leadership AI Companion for the ${context?.departmentName || "department"} at Evergreen Real Estate Ventures.

YOUR ROLE: Help department leaders translate strategy into execution, diagnose problems, improve team performance, and prepare structured feedback for the CEO.

CURRENT DEPARTMENT CONTEXT:
Strategy items assigned to this department:
${strategyItemsSummary || "None"}

Translations completed:
${translationsSummary || "None"}

Upward proposals submitted:
${proposalsSummary || "None"}

BUSINESS CONTEXT:
- Two acquisition teams: Wholesale (residential 1-4 unit) and Portfolio (multifamily 5+, business acquisitions, JV deals)
- Strategy flows from CEO â†’ Leadership â†’ Operations
- Leadership must acknowledge, translate, and execute strategy items
- All upward feedback must be structured

RESPONSE FORMAT (always use this structure):
**What Is Actually Happening** â€” Objective assessment of the situation
**Signal vs Noise** â€” What matters vs what's distraction
**Root Cause** â€” The underlying issue
**Options** â€” 2-3 concrete paths forward
**Recommended Action** â€” Your recommendation with reasoning
**Immediate Next Steps** â€” What to do right now

Focus on translation, problem-solving, and execution improvement. Be direct and practical. Every recommendation must be actionable.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("leadership-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
