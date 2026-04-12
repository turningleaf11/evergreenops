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
    const { messages, ceoContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build system prompt from CEO context data
    const systemPrompt = `You are a CEO Strategy Companion for Evergreen Real Estate Ventures.

CURRENT CONTEXT:
- Objective: ${ceoContext?.currentObjective || "Not set"}
- Constraints: ${(ceoContext?.currentConstraints || []).join(", ") || "None set"}
- Top Priorities: ${(ceoContext?.topPriorities || []).map((p: any) => `${p.text} (${p.status})`).join("; ") || "None"}
- Recent Decisions: ${(ceoContext?.recentDecisions || []).slice(0, 5).map((d: any) => `${d.date}: ${d.text}`).join("; ") || "None"}
- Strategic Tensions: ${(ceoContext?.strategicTensions || []).map((t: any) => `${t.tension}: ${t.sideA} vs ${t.sideB}`).join("; ") || "None"}
- Pipeline: ${ceoContext?.pipelineSnapshot?.wholesaleDeals || 0} wholesale, ${ceoContext?.pipelineSnapshot?.portfolioDeals || 0} portfolio, ${ceoContext?.pipelineSnapshot?.closingThisMonth || 0} closing this month
- Top Risks: ${(ceoContext?.topRisks || []).join("; ") || "None identified"}
- Top Leverage: ${(ceoContext?.topLeverage || []).join("; ") || "None identified"}
- Decisions Needed: ${(ceoContext?.decisionsNeeded || []).join("; ") || "None pending"}
- Morning Reset: What matters today: ${ceoContext?.morningReset?.whatMatters || "Not set"} | Ignore: ${ceoContext?.morningReset?.whatToIgnore || "Not set"} | One win: ${ceoContext?.morningReset?.oneWin || "Not set"}

BUSINESS CONTEXT:
- Two acquisition teams: Wholesale (residential 1-4 unit) and Portfolio (multifamily 5+, business acquisitions, JV deals)
- This is a strategy tool, not ops management

RESPONSE FORMAT (always use this structure):
**Actual Problem** — What's really going on
**Root Cause** — Why this is happening
**Options** — 2-4 concrete options
**Recommended Path** — Your recommendation and why
**Next Actions** — Specific next steps

Be direct, strategic, and concise. No fluff. Every sentence should earn its place.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }), {
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
    console.error("ceo-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
