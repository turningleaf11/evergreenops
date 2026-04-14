import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { content } = await req.json();
    if (!content || content.trim().length < 5) {
      return new Response(JSON.stringify({ error: "Content too short" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Fetch context: team + active tasks/projects
    const [profilesRes, tasksRes, projectsRes] = await Promise.all([
      adminClient.from("profiles").select("user_id, full_name, title, department_id"),
      adminClient.from("tasks").select("title, status, assigned_to, priority").neq("status", "done").limit(50),
      adminClient.from("projects").select("title, status, owner_id, priority").neq("status", "done").limit(30),
    ]);

    const teamRoster = (profilesRes.data || []).map(p => `${p.full_name || "Unknown"} (ID: ${p.user_id}, Role: ${p.title || "N/A"})`).join("\n");
    const activeTasks = (tasksRes.data || []).map(t => `- ${t.title} [${t.status}] assigned:${t.assigned_to || "none"}`).join("\n");
    const activeProjects = (projectsRes.data || []).map(p => `- ${p.title} [${p.status}] owner:${p.owner_id || "none"}`).join("\n");

    const systemPrompt = `You are an executive assistant AI for a CEO. You help organize raw notes into actionable items.

Given the CEO's scratch pad notes, extract individual items and categorize each as one of: task, decision, idea, delegation.

Context — Team Roster:
${teamRoster}

Active Tasks:
${activeTasks || "None"}

Active Projects:
${activeProjects || "None"}

For each item, suggest an assignee from the team roster if appropriate (use their user_id UUID), and suggest a priority (low, medium, high). Provide brief reasoning for your categorization and assignment.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Here are my raw notes:\n\n${content}\n\nExtract and organize these into actionable items.` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "triage_items",
              description: "Return extracted and organized items from the CEO's notes",
              parameters: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "The actionable item text, cleaned up" },
                        category: { type: "string", enum: ["task", "decision", "idea", "delegation"] },
                        suggested_assignee_id: { type: "string", description: "UUID of suggested team member, or null", nullable: true },
                        suggested_priority: { type: "string", enum: ["low", "medium", "high"] },
                        reasoning: { type: "string", description: "Brief explanation of categorization and assignment" },
                      },
                      required: ["text", "category", "suggested_priority", "reasoning"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["items"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "triage_items" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI processing failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return structured output" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("ceo-triage error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
