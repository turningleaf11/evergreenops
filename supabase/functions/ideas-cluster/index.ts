// AI clustering for the Ideas Backlog. Groups ideas into themes and suggests effort + horizon.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { ideaIds } = await req.json();
    if (!Array.isArray(ideaIds) || ideaIds.length === 0) {
      return new Response(JSON.stringify({ error: "ideaIds required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: ideas } = await supabase.from("ideas").select("id, title, description").in("id", ideaIds);
    if (!ideas || ideas.length === 0) {
      return new Response(JSON.stringify({ updated: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const prompt = `You are an executive strategist. Cluster the following business ideas by theme, estimate effort (xs|s|m|l|xl), and suggest a horizon (e.g. "Q1 2026", "Q2 2026", "Later"). Return strict JSON: {"updates":[{"id":"...","theme":"Lead Gen","effort":"m","horizon":"Q1 2026","priority_score":75}]}.

Ideas:
${ideas.map(i => `- [${i.id}] ${i.title}${i.description ? ` — ${i.description}` : ""}`).join("\n")}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Return only valid JSON. No markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(JSON.stringify({ error: txt }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content || "{}";
    const cleaned = content.replace(/```json\n?|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const updates: Array<{ id: string; theme?: string; effort?: string; horizon?: string; priority_score?: number }> = parsed.updates || [];

    let updated = 0;
    for (const u of updates) {
      const { error } = await supabase.from("ideas").update({
        theme: u.theme || "",
        effort: u.effort || "",
        horizon: u.horizon || "",
        priority_score: u.priority_score ?? 0,
      }).eq("id", u.id);
      if (!error) updated++;
    }

    return new Response(JSON.stringify({ updated, updates }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
