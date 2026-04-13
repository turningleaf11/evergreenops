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
    const { messages, ceoContext, liveSnapshot } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const isBriefing = messages?.[0]?.content === "[MORNING_BRIEFING]";

    let snapshotBlock = "";
    if (liveSnapshot) {
      const parts: string[] = [];
      if (liveSnapshot.overdueTasks?.length) {
        parts.push(`OVERDUE TASKS (${liveSnapshot.overdueTasks.length}):\n${liveSnapshot.overdueTasks.map((t: any) => `- ${t.title} (due ${t.due_date}, ${t.priority} priority)`).join("\n")}`);
      }
      if (liveSnapshot.stalledProjects?.length) {
        parts.push(`BLOCKED/AT-RISK PROJECTS (${liveSnapshot.stalledProjects.length}):\n${liveSnapshot.stalledProjects.map((p: any) => `- ${p.title} (${p.status})`).join("\n")}`);
      }
      if (liveSnapshot.openIssues?.length) {
        parts.push(`OPEN ISSUES (${liveSnapshot.openIssues.length}):\n${liveSnapshot.openIssues.map((i: any) => `- ${i.title} (priority ${i.priority})`).join("\n")}`);
      }
      if (liveSnapshot.recentDecisions?.length) {
        parts.push(`RECENT DECISIONS:\n${liveSnapshot.recentDecisions.map((d: any) => `- ${d.title} (${d.created_at?.split("T")[0]})`).join("\n")}`);
      }
      if (liveSnapshot.recentActivity?.length) {
        parts.push(`LAST 24H ACTIVITY (${liveSnapshot.recentActivity.length} events):\n${liveSnapshot.recentActivity.slice(0, 8).map((a: any) => `- ${a.action}: ${a.entity_title || a.entity_type}`).join("\n")}`);
      }
      snapshotBlock = parts.length > 0 ? `\n\nLIVE SNAPSHOT:\n${parts.join("\n\n")}` : "\n\nLIVE SNAPSHOT: Everything looks clear — no overdue tasks, blocked projects, or open issues.";
    }

    let briefingInstruction = "";
    if (isBriefing) {
      briefingInstruction = `\n\nThe user just opened their command center. Greet them with a brief, conversational situational summary based on the live snapshot above. Highlight what needs attention — overdue items, blocked projects, pending decisions. Be concise and natural, like a sharp chief of staff giving a 30-second rundown. End by asking what they want to focus on today. If everything is clear, acknowledge that and ask what's on their mind.`;
    }

    const systemPrompt = `You are a conversational strategy companion for the CEO of Evergreen Real Estate Ventures. You are a thinking partner — not a report generator.

TONE & STYLE:
- Match the user's energy. If they're thinking out loud, think with them. If they ask a specific question, give structured analysis.
- Be direct and concise. No fluff. Every sentence should earn its place.
- When the user shares problems, frustrations, or ideas, help them organize their thinking.
- Suggest what might become a priority, a decision, a task, or a strategy item — but frame it as a suggestion, not a directive. Example: "That sounds like it could be a top priority this week. Want me to frame it up?"
- You can use markdown formatting — headers, bold, lists — when it helps clarity. But don't over-format casual conversation.

CURRENT PAGE: ${ceoContext?.currentPage || "unknown"}

BUSINESS CONTEXT:
- Two acquisition teams: Wholesale (residential 1-4 unit) and Portfolio (multifamily 5+, business acquisitions, JV deals)
- This is a strategy & operations tool, not a CRM

CURRENT STATE:
- Objective: ${ceoContext?.currentObjective || "Not set"}
- Constraints: ${(ceoContext?.currentConstraints || []).join(", ") || "None set"}
- Top Priorities: ${(ceoContext?.topPriorities || []).map((p: any) => `${p.text} (${p.status})`).join("; ") || "None"}
- Recent Decisions: ${(ceoContext?.recentDecisions || []).slice(0, 5).map((d: any) => `${d.date}: ${d.text}`).join("; ") || "None"}
- Strategic Tensions: ${(ceoContext?.strategicTensions || []).map((t: any) => `${t.tension}: ${t.sideA} vs ${t.sideB}`).join("; ") || "None"}
- Pipeline: ${ceoContext?.pipelineSnapshot?.wholesaleDeals || 0} wholesale, ${ceoContext?.pipelineSnapshot?.portfolioDeals || 0} portfolio, ${ceoContext?.pipelineSnapshot?.closingThisMonth || 0} closing this month
- Top Risks: ${(ceoContext?.topRisks || []).join("; ") || "None identified"}
- Top Leverage: ${(ceoContext?.topLeverage || []).join("; ") || "None identified"}
- Decisions Needed: ${(ceoContext?.decisionsNeeded || []).join("; ") || "None pending"}
- Morning Reset: What matters today: ${ceoContext?.morningReset?.whatMatters || "Not set"} | Ignore: ${ceoContext?.morningReset?.whatToIgnore || "Not set"} | One win: ${ceoContext?.morningReset?.oneWin || "Not set"}${snapshotBlock}${briefingInstruction}`;

    // For briefing, don't include the synthetic marker in messages sent to AI
    const aiMessages = isBriefing
      ? [{ role: "system", content: systemPrompt }, { role: "user", content: "Give me my morning briefing." }]
      : [{ role: "system", content: systemPrompt }, ...messages];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
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
