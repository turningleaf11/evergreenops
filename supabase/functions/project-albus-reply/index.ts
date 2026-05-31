// project-albus-reply
//
// Triggered when a user @mentions Albus in a project's comment thread.
// Pulls the project context (project row, linked goal, open tasks, recent
// comments) and asks the AI gateway for a response. Inserts the answer as
// a new comment with agent_name='Albus' so the UI can render it as an AI
// reply attributed to Albus.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const { project_id, user_text } = await req.json();
    if (!project_id || !user_text) return json({ error: "project_id and user_text are required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Invalid token" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // Pull project + context
    const safe = async <T,>(p: Promise<{ data: any }>): Promise<T[]> => {
      try { const { data } = await p; return (data ?? []) as T[]; }
      catch { return []; }
    };

    const { data: project } = await admin.from("projects").select("*").eq("id", project_id).maybeSingle();
    if (!project) return json({ error: "Project not found" }, 404);

    const [tasks, comments, goal, owner] = await Promise.all([
      safe<any>(admin.from("tasks").select("title, status, priority, due_date").eq("project_id", project_id).limit(50) as any),
      safe<any>(admin.from("comments").select("content, agent_name, author_id, created_at").eq("entity_type", "project").eq("entity_id", project_id).order("created_at", { ascending: true }).limit(30) as any),
      project.goal_id
        ? admin.from("goals").select("title, quarter, year, progress").eq("id", project.goal_id).maybeSingle().then((r: any) => r.data)
        : Promise.resolve(null),
      project.owner_id
        ? admin.from("profiles").select("full_name").eq("user_id", project.owner_id).maybeSingle().then((r: any) => r.data)
        : Promise.resolve(null),
    ]);

    const taskBrief = tasks.length === 0
      ? "(no tasks yet)"
      : tasks.map((t: any) => `- [${t.status}/${t.priority}] ${t.title}${t.due_date ? ` (due ${t.due_date})` : ""}`).join("\n");

    const commentTranscript = comments.length === 0
      ? "(no prior conversation)"
      : comments.slice(-15).map((c: any) => {
          const who = c.agent_name ? `Albus` : `User`;
          // Strip HTML
          const text = String(c.content || "").replace(/<[^>]*>/g, "").trim().slice(0, 400);
          return `${who}: ${text}`;
        }).join("\n");

    const goalLine = goal
      ? `Linked goal: ${goal.title} (${goal.quarter} ${goal.year}) â€” ${goal.progress ?? 0}% complete`
      : "Linked goal: none";

    const notes = (project.notes_content || "").replace(/<[^>]*>/g, "").trim().slice(0, 2000);

    const systemPrompt = `You are Albus, an embedded AI assistant inside a single project's comment thread. You see this project's data: title, description, owner, status, priority, due date, notes, the linked goal, the open tasks, and the prior conversation.

Behave like a sharp chief of staff inside this conversation:
- Be specific. Reference the project's actual data when relevant.
- If asked to scope/plan, propose 3-6 concrete tasks with clear titles.
- If asked to suggest tasks, output a short list and offer to add them.
- If asked a factual question about the project, answer directly from context.
- Keep responses concise (3-8 sentences) unless asked for a detailed plan.
- Output plain text. Do NOT prefix your reply with "Albus:" â€” your name is shown automatically.

PROJECT
=======
Title: ${project.title}
Status: ${project.status} Â· Priority: ${project.priority}${project.due_date ? ` Â· Due: ${project.due_date}` : ""}
Owner: ${owner?.full_name || "(unassigned)"}
${goalLine}
Description: ${project.description || "(none)"}

NOTES
${notes || "(empty)"}

TASKS
${taskBrief}

RECENT CONVERSATION
${commentTranscript}`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: user_text },
        ],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI gateway error", aiRes.status, txt.slice(0, 300));
      return json({ error: `AI gateway returned ${aiRes.status}` }, 200);
    }

    const aiBody = await aiRes.json();
    const replyText: string = (aiBody?.choices?.[0]?.message?.content ?? "").trim();
    if (!replyText) return json({ error: "Albus had no response" }, 200);

    // Insert as a comment with agent_name='Albus'. author_id = the user who triggered Albus
    // (RLS requires auth.uid() = author_id) â€” the agent_name field marks it as an Albus reply
    // so the UI can render it as such.
    const replyHtml = `<p>${replyText.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br/>")}</p>`;
    const { data: inserted, error } = await admin.from("comments").insert({
      entity_type: "project",
      entity_id: project_id,
      author_id: user.id,
      agent_name: "Albus",
      content: replyText,
      content_html: replyHtml,
    }).select().single();

    if (error) {
      console.error("Failed to insert Albus reply:", error);
      return json({ error: error.message }, 200);
    }

    return json({ ok: true, comment_id: inserted?.id, reply: replyText });
  } catch (e: any) {
    console.error("project-albus-reply error:", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
