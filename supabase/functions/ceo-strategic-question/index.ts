import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getMonday(d: Date): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  return monday.toISOString().split("T")[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { force } = await req.json().catch(() => ({ force: false }));
    const weekStart = getMonday(new Date());

    // Check cache unless forced
    if (!force) {
      const { data: cached } = await admin
        .from("ceo_strategic_questions")
        .select("question")
        .eq("user_id", user.id)
        .eq("week_start_date", weekStart)
        .maybeSingle();
      if (cached?.question) {
        return new Response(JSON.stringify({ question: cached.question, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get profile for workspace
    const { data: profile } = await admin
      .from("profiles")
      .select("workspace_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const workspaceId = profile?.workspace_id;

    // Assemble lightweight context
    const today = new Date().toISOString().split("T")[0];
    const [visionRes, goalsRes, issuesRes, decisionsRes, strategyRes, memoryRes] = await Promise.all([
      admin.from("vision").select("section, content"),
      admin.from("goals").select("title, status, progress, quarter, year").in("status", ["on_track", "at_risk", "off_track"]).limit(15),
      admin.from("issues").select("title, category, priority").eq("status", "open").order("priority").limit(10),
      admin.from("decision_log").select("title, created_at").order("created_at", { ascending: false }).limit(5),
      admin.from("strategy_items" as any).select("title, status, description").neq("status", "resolved").limit(15),
      admin.from("ai_business_memory").select("memory_type, title, content").eq("is_active", true).limit(20),
    ]);

    const ctxParts: string[] = [];
    if (visionRes.data?.length) {
      ctxParts.push("VISION:\n" + visionRes.data.map((v: any) => `- ${v.section}: ${v.content?.text || ""}`).filter((s) => s.length > 10).join("\n"));
    }
    if (goalsRes.data?.length) {
      ctxParts.push("CURRENT ROCKS:\n" + goalsRes.data.map((g: any) => `- ${g.title} (${g.status}, ${g.progress}%)`).join("\n"));
    }
    if (issuesRes.data?.length) {
      ctxParts.push("OPEN ISSUES:\n" + issuesRes.data.map((i: any) => `- ${i.title} [${i.category}, P${i.priority}]`).join("\n"));
    }
    if (strategyRes.data?.length) {
      ctxParts.push("ACTIVE STRATEGY:\n" + strategyRes.data.map((s: any) => `- ${s.title} (${s.status})`).join("\n"));
    }
    if (decisionsRes.data?.length) {
      ctxParts.push("RECENT DECISIONS:\n" + decisionsRes.data.map((d: any) => `- ${d.title}`).join("\n"));
    }
    if (memoryRes.data?.length) {
      ctxParts.push("BUSINESS MEMORY:\n" + memoryRes.data.map((m: any) => `- [${m.memory_type}] ${m.title}: ${m.content}`).join("\n"));
    }

    const contextBlock = ctxParts.join("\n\n") || "No business context available yet.";

    const prompt = `You are a strategic thought partner for the CEO. Based on everything you know about this business â€” their vision, current rocks, scorecard, open issues, and recent decisions â€” what is the single most important strategic question this CEO should be sitting with this week?

Make it specific to their actual situation, not generic. Return only the question itself, nothing else. Maximum 2 sentences.

CURRENT BUSINESS CONTEXT:
${contextBlock}`;

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Generation failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiResp.json();
    const question = (aiJson.choices?.[0]?.message?.content || "").trim();
    if (!question) {
      return new Response(JSON.stringify({ error: "Empty response" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Upsert into cache
    await admin
      .from("ceo_strategic_questions")
      .upsert(
        { user_id: user.id, workspace_id: workspaceId, week_start_date: weekStart, question },
        { onConflict: "user_id,week_start_date" },
      );

    return new Response(JSON.stringify({ question, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ceo-strategic-question error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
