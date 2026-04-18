import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProjectCtx {
  project?: any;
  tasks?: any[];
  profiles?: { user_id: string; full_name: string | null }[];
  notes?: string;
  linkedDocs?: { id: string; title: string }[];
  goalTitle?: string | null;
  recentComments?: { author: string; content: string; created_at: string }[];
}

function nameOf(uid: string | null | undefined, profiles: any[] = []) {
  if (!uid) return "Unassigned";
  return profiles.find((p) => p.user_id === uid)?.full_name || "Unknown";
}

function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

function buildSystemPrompt(ctx: ProjectCtx): string {
  const p = ctx.project || {};
  const tasks = ctx.tasks || [];
  const profiles = ctx.profiles || [];

  const tasksByStatus: Record<string, any[]> = {};
  for (const t of tasks) {
    const s = t.status || "not_started";
    (tasksByStatus[s] ||= []).push(t);
  }
  const tasksSummary = Object.entries(tasksByStatus)
    .map(([status, list]) =>
      `**${status}** (${list.length}):\n` +
      list.slice(0, 25).map((t) =>
        `- "${t.title}"${t.priority ? ` [${t.priority}]` : ""}${t.due_date ? ` due ${t.due_date}` : ""} — ${nameOf(t.assigned_to, profiles)}`
      ).join("\n")
    )
    .join("\n\n") || "No tasks yet.";

  const team = [
    p.owner_id ? `Lead: ${nameOf(p.owner_id, profiles)}` : null,
    (p.assignees || []).length
      ? `Team: ${(p.assignees || []).map((u: string) => nameOf(u, profiles)).join(", ")}`
      : null,
  ].filter(Boolean).join(" · ") || "No team assigned.";

  const docsSummary = (ctx.linkedDocs || []).slice(0, 10).map((d) => `- ${d.title}`).join("\n") || "None";

  const recent = (ctx.recentComments || []).slice(0, 8)
    .map((c) => `- ${c.author}: ${c.content}`).join("\n") || "No recent discussion.";

  return `You are an AI project partner inside the project workspace at Evergreen Real Estate Ventures.

PROJECT: "${p.title}"
Status: ${p.status} · Priority: ${p.priority || "medium"}${p.due_date ? ` · Due: ${p.due_date}` : ""}
${ctx.goalTitle ? `Linked Goal: ${ctx.goalTitle}` : ""}
${team}

DESCRIPTION:
${p.description || "(no description)"}

NOTES:
${stripHtml(ctx.notes) || "(empty)"}

TASKS (${tasks.length}):
${tasksSummary}

LINKED DOCUMENTS:
${docsSummary}

RECENT DISCUSSION:
${recent}

YOUR JOB
- Help the team plan, sequence, and execute this project.
- Answer questions grounded in the data above.
- When asked to generate tasks or break down work, call the \`propose_tasks\` tool with a clean list. Do NOT also restate them as plain text.
- For status summaries: lead with the punchline, flag risks/blockers, name owners.
- Be concrete and operational. Avoid filler. Use short sections with **bold headers**.
- If asked about something not in the project data, say so plainly.`;
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "propose_tasks",
      description:
        "Propose a list of tasks the user can review and add to this project. Use when the user asks to generate, break down, plan, or extract tasks.",
      parameters: {
        type: "object",
        properties: {
          intro: { type: "string", description: "1-2 sentences introducing the proposed tasks." },
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
              },
              required: ["title"],
              additionalProperties: false,
            },
            minItems: 1,
            maxItems: 25,
          },
        },
        required: ["tasks"],
        additionalProperties: false,
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = buildSystemPrompt(context || {});

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
        tools: TOOLS,
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
    console.error("project-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
