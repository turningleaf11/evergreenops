// Background AI enrichment for idea_vault entries.
// Generates a one-sentence summary, assigns a cluster theme, and suggests a time horizon.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLUSTERS = [
  "Growth & Revenue",
  "Operations & Systems",
  "People & Culture",
  "Product & Technology",
  "Real Estate Strategy",
  "Marketing & Brand",
  "Finance & Capital",
  "Other",
];

const HORIZONS = ["this_quarter", "next_quarter", "this_year", "someday"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { ideaId } = await req.json();
    if (!ideaId) {
      return new Response(JSON.stringify({ error: "ideaId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: idea, error: ideaErr } = await supabase
      .from("idea_vault")
      .select("id, title, description, time_horizon, ai_cluster, ai_summary")
      .eq("id", ideaId)
      .maybeSingle();
    if (ideaErr || !idea) {
      return new Response(JSON.stringify({ error: "Idea not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `You are an executive strategist enriching captured ideas. Given an idea title and optional description, produce:
1. A one-sentence summary (max 25 words) capturing the core of the idea.
2. A theme cluster from this list: ${CLUSTERS.join(", ")}. Pick the best fit. If absolutely none fit, propose a new short theme name (2-4 words).
3. A time horizon. Use these rules:
   - urgent or tactical → "this_quarter"
   - strategic but near-term → "next_quarter"
   - large initiative → "this_year"
   - aspirational → "someday"`;

    const userPrompt = `Idea: ${idea.title}${idea.description ? `\n\nDescription: ${idea.description}` : ""}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "enrich_idea",
              description: "Return enrichment fields for the idea",
              parameters: {
                type: "object",
                properties: {
                  ai_summary: { type: "string", description: "One-sentence summary, max 25 words" },
                  ai_cluster: { type: "string", description: "Theme cluster name" },
                  time_horizon: { type: "string", enum: HORIZONS },
                },
                required: ["ai_summary", "ai_cluster", "time_horizon"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "enrich_idea" } },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, txt);
      return new Response(JSON.stringify({ error: "AI call failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "No structured output" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const parsed = JSON.parse(toolCall.function.arguments);

    const update: Record<string, unknown> = {
      ai_summary: parsed.ai_summary || null,
      ai_cluster: parsed.ai_cluster || null,
    };
    // Only set time_horizon if it isn't already set
    if (!idea.time_horizon && parsed.time_horizon && HORIZONS.includes(parsed.time_horizon)) {
      update.time_horizon = parsed.time_horizon;
    }

    const { error: updErr } = await supabase.from("idea_vault").update(update).eq("id", ideaId);
    if (updErr) {
      console.error("Update error:", updErr);
      return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, ...update }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("idea-vault-enrich error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
