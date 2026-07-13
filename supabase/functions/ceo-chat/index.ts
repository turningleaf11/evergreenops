import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatStrategyContext(ctx: any): string {
  if (!ctx) return "";
  const parts: string[] = [];

  // 1. Vision
  const v = ctx.vision || {};
  const visionLines: string[] = [];
  if (v.coreValues?.length) visionLines.push(`Core Values: ${v.coreValues.join(", ")}`);
  if (v.purpose) visionLines.push(`Purpose: ${v.purpose}`);
  if (v.niche) visionLines.push(`Niche: ${v.niche}`);
  if (v.tenYearTarget) visionLines.push(`10-Year Target: ${v.tenYearTarget}`);
  if (v.threeYearPicture) visionLines.push(`3-Year Picture: ${v.threeYearPicture}`);
  if (v.oneYearPlan) visionLines.push(`1-Year Plan: ${v.oneYearPlan}`);
  if (visionLines.length) parts.push(`VISION (${ctx.currentQuarter} ${ctx.currentYear}):\n${visionLines.join("\n")}`);
  else parts.push(`PERIOD: ${ctx.currentQuarter} ${ctx.currentYear}`);

  // 2. Rocks
  if (ctx.rocks?.length) {
    parts.push(
      `CURRENT ROCKS / GOALS (${ctx.rocks.length}):\n${ctx.rocks
        .map((r: any) => `- ${r.title} — ${r.progress}% (${r.status})`)
        .join("\n")}`
    );
  } else {
    parts.push(`CURRENT ROCKS / GOALS: none set for ${ctx.currentQuarter}.`);
  }

  // 3. Scorecard
  if (ctx.scorecard?.length) {
    parts.push(
      `SCORECARD PULSE (this week):\n${ctx.scorecard
        .map((s: any) => {
          const status = s.actual == null ? "no entry yet" : s.onTrack ? "on track" : "off track";
          const actual = s.actual == null ? "—" : s.actual;
          return `- ${s.name}: target ${s.target}${s.unit ? ` ${s.unit}` : ""}, actual ${actual} (${status})`;
        })
        .join("\n")}`
    );
  }

  // 4. Strategy items
  if (ctx.strategyItems?.length) {
    parts.push(
      `ACTIVE STRATEGY ITEMS (${ctx.strategyItems.length}):\n${ctx.strategyItems
        .slice(0, 15)
        .map((s: any) => `- [${s.status}] ${s.title}${s.description ? ` — ${s.description.slice(0, 140)}` : ""}`)
        .join("\n")}`
    );
  }

  // 5. Open issues
  if (ctx.openIssues?.length) {
    parts.push(
      `OPEN ISSUES (${ctx.openIssues.length}):\n${ctx.openIssues
        .map((i: any) => `- ${i.title} (${i.category}, priority ${i.priority})`)
        .join("\n")}`
    );
  }

  // 6. Team
  if (ctx.team?.length) {
    parts.push(
      `TEAM (${ctx.team.length}):\n${ctx.team
        .slice(0, 30)
        .map((t: any) => `- ${t.name}${t.title ? ` — ${t.title}` : ""}`)
        .join("\n")}`
    );
  }

  // 7. Business memory
  if (ctx.businessMemory?.length) {
    parts.push(
      `BUSINESS MEMORY (${ctx.businessMemory.length} active):\n${ctx.businessMemory
        .map((m: any) => `- [${m.memory_type}] ${m.title}: ${m.content}`)
        .join("\n")}`
    );
  }

  // 8. Delegations
  if (ctx.delegations) {
    const total = Object.values(ctx.delegations.perPerson || {}).reduce(
      (a: number, b: any) => a + Number(b || 0),
      0
    );
    parts.push(
      `DELEGATIONS: ${total} outstanding across ${Object.keys(ctx.delegations.perPerson || {}).length} people, ${ctx.delegations.overdueCount} overdue.`
    );
  }

  return parts.join("\n\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, strategyContext, ceoContext, liveSnapshot, titleOnly } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured in Supabase function secrets");

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

    let systemPrompt: string;

    // What the user is currently looking at — surfaced by pages/peeks so Albus
    // can answer "this task", "this project", etc. in context.
    const ce = ceoContext?.currentEntity;
    const viewingLine = ce?.title
      ? `\nCURRENTLY VIEWING: ${ce.type || "item"} "${ce.title}"${ce.id ? ` (id: ${ce.id})` : ""} — assume "this"/"here" refers to it unless the user says otherwise.`
      : "";

    if (titleOnly) {
      // Lightweight prompt for title generation only
      systemPrompt = `You generate concise 4-5 word conversation titles. Respond with only the title text.`;
    } else if (strategyContext) {
      // Full strategy companion prompt with assembled business context
      const contextBlock = formatStrategyContext(strategyContext);
      const userName = strategyContext.userName || "the CEO";
      const workspaceName = strategyContext.workspaceName || "the company";
      systemPrompt = `You are a strategic thought partner and chief of staff for ${userName}, the CEO of ${workspaceName}. You have deep context about their business, their vision, their team, and their current priorities.

You are not a generic AI assistant. You know this business specifically. You remember past decisions and conversations through the memory context provided.

You are direct, honest, and strategic. You ask good questions. You push back when something doesn't make sense. You help the CEO think clearly, not just tell them what they want to hear.

When you identify a significant decision, insight, or pattern in the conversation, note it clearly so it can be saved to business memory.

CURRENT PAGE: ${ceoContext?.currentPage || "unknown"}${viewingLine}

Current business context:
${contextBlock}${snapshotBlock}${briefingInstruction}`;
    } else {
      // Legacy prompt (kept for backwards compat with any callers not yet updated)
      systemPrompt = `You are a conversational strategy companion for the CEO. Be direct, concise, and helpful.

CURRENT PAGE: ${ceoContext?.currentPage || "unknown"}${viewingLine}
- Objective: ${ceoContext?.currentObjective || "Not set"}
- Constraints: ${(ceoContext?.currentConstraints || []).join(", ") || "None set"}
- Top Priorities: ${(ceoContext?.topPriorities || []).map((p: any) => `${p.text} (${p.status})`).join("; ") || "None"}
- Recent Decisions: ${(ceoContext?.recentDecisions || []).slice(0, 5).map((d: any) => `${d.date}: ${d.text}`).join("; ") || "None"}${snapshotBlock}${briefingInstruction}`;
    }

    const aiMessages = isBriefing
      ? [{ role: "system", content: systemPrompt }, { role: "user", content: "Give me my morning briefing." }]
      : [{ role: "system", content: systemPrompt }, ...messages];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "OpenAI rate limit exceeded. Please wait and try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("OpenAI error:", response.status, t);
      return new Response(JSON.stringify({ error: `OpenAI error (${response.status}): ${t.slice(0, 300)}` }), {
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
