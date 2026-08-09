// Albus Draft Plan — reads a business plan's working doc (raw notes) plus its
// title/one-liner and existing deliverables, and asks the AI gateway for a
// structured list of proposed deliverables the user can accept item-by-item.
// Modeled on albus-plan-week/index.ts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const { businessPlanId } = await req.json().catch(() => ({}));
    if (!businessPlanId) return json({ error: "businessPlanId is required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Invalid token" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    const safe = async <T,>(label: string, p: Promise<{ data: any; error: any }>): Promise<T[]> => {
      try {
        const { data, error } = await p;
        if (error) { console.warn(`[draft-plan] ${label} skipped:`, error.message); return []; }
        return (data ?? []) as T[];
      } catch (e) {
        console.warn(`[draft-plan] ${label} threw:`, e);
        return [];
      }
    };

    const { data: plan, error: planError } = await admin
      .from("business_plans")
      .select("id, title, one_liner, plan_doc")
      .eq("id", businessPlanId)
      .maybeSingle();
    if (planError || !plan) return json({ error: "Plan not found" }, 404);

    const [deliverablesData, profilesData] = await Promise.all([
      safe<any>("deliverables", admin.from("business_plan_deliverables").select("title").eq("business_plan_id", businessPlanId) as any),
      safe<any>("profiles", admin.from("profiles").select("user_id, full_name").limit(50) as any),
    ]);

    const notes = stripHtml(plan.plan_doc || "");
    const existingList = deliverablesData.map((d: any) => `- ${d.title}`).join("\n");
    const teamMembers = profilesData.map((p: any) => `${p.user_id}:${p.full_name}`).join("\n");

    const systemPrompt = `You are Albus, the chief-of-staff AI for the CEO. You are reading the raw notes the CEO wrote for a venture called "${plan.title}"${plan.one_liner ? ` — ${plan.one_liner}` : ""}.

Your job: read the notes below and propose concrete deliverables — the checklist items this venture needs to actually operate (buy box, scripts, tools, contracts, whatever the notes point at). Each deliverable should be something a person can own and check off, not a vague theme.

Rules:
- Read the notes closely — don't invent things unrelated to what's written.
- Don't repeat anything already in the EXISTING DELIVERABLES list below.
- Give each deliverable a short category (matches how the notes group ideas, or "General" if unclear).
- If the notes mention a rough deadline, set due_date (YYYY-MM-DD). Otherwise null.
- Use a TEAM member's user id for owner_user_id only if the notes name them or their role clearly implies it. Otherwise null.
- Cap at 8 deliverables. Fewer, sharper ones beat a long list.
- If the notes are empty or too thin to draw deliverables from, return an empty array — don't invent content.
- Output strict JSON only matching the schema below. No prose outside JSON.

Schema:
{
  "deliverables": [
    { "title": "...", "category": "...", "due_date": "YYYY-MM-DD or null", "owner_user_id": "uuid or null", "rationale": "One line: why this, from the notes" }
  ]
}

CONTEXT
=======

VENTURE: ${plan.title}
ONE-LINER: ${plan.one_liner || "(not set)"}

NOTES (from the plan's working doc):
${notes || "(empty)"}

EXISTING DELIVERABLES (don't repeat):
${existingList || "(none yet)"}

TEAM:
${teamMembers || "(none)"}

Now produce the JSON.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Output the JSON deliverables list now. No prose, no markdown fences." },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error", response.status, t.slice(0, 500));
      return json({ error: `AI gateway returned ${response.status}`, detail: t.slice(0, 300) }, 200);
    }

    const aiBody = await response.json();
    let content: string = aiBody?.choices?.[0]?.message?.content ?? "{}";
    content = content.trim();
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    }
    const firstBrace = content.indexOf("{");
    const lastBrace = content.lastIndexOf("}");
    if (firstBrace > 0 || lastBrace > 0) {
      content = content.slice(firstBrace, lastBrace + 1);
    }

    let result: any;
    try { result = JSON.parse(content); }
    catch (e) {
      console.error("AI returned malformed JSON", content.slice(0, 500));
      return json({ error: "Albus returned malformed JSON. Try again.", raw: content.slice(0, 300) }, 200);
    }

    result.deliverables = Array.isArray(result.deliverables) ? result.deliverables : [];

    return json({ deliverables: result.deliverables });
  } catch (e: any) {
    console.error("albus-draft-plan error:", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
