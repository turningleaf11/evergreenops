import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { content, images } = await req.json();
    if ((!content || content.trim().length < 5) && (!images || images.length === 0)) {
      return new Response(JSON.stringify({ error: "Content too short" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Identify user from JWT
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

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

Given the CEO's scratch pad notes (which may include text and/or images of handwritten notes), extract individual items and categorize each as one of: task, project, decision, idea, delegation.

Use these definitions:
- task: a specific small unit of work the CEO will do.
- delegation: a task to be assigned to a teammate.
- project: a multi-step initiative that will produce an outcome (more than a single task). Anything described with words like "build", "launch", "rebuild", "roll out" usually goes here.
- decision: a documented choice or directional call.
- idea: a raw concept worth capturing for later evaluation (not yet committed work).

Context — Team Roster:
${teamRoster}

Active Tasks:
${activeTasks || "None"}

Active Projects:
${activeProjects || "None"}

For each item, suggest an assignee from the team roster if appropriate (use their user_id UUID), and suggest a priority (low, medium, high). Provide brief reasoning for your categorization and assignment.`;

    const userContent: any[] = [];
    if (content && content.trim().length > 0) {
      userContent.push({ type: "text", text: `Here are my raw notes:\n\n${content}\n\nExtract and organize these into actionable items.` });
    }
    if (images && images.length > 0) {
      for (const imageUrl of images) {
        userContent.push({ type: "image_url", image_url: { url: imageUrl } });
      }
      if (userContent.length === images.length) {
        userContent.unshift({ type: "text", text: "Here are images of my handwritten notes. Read them carefully and extract all items into actionable items." });
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent.length === 1 && userContent[0].type === "text" ? userContent[0].text : userContent },
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
                        text: { type: "string" },
                        category: { type: "string", enum: ["task", "project", "decision", "idea", "delegation"] },
                        suggested_assignee_id: { type: "string", nullable: true },
                        suggested_priority: { type: "string", enum: ["low", "medium", "high"] },
                        reasoning: { type: "string" },
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
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
    const items = (parsed.items || []) as Array<any>;

    // Archive the scratch pad content
    let archiveId: string | null = null;
    const padHtml: string = (content || "");
    const hasImages = images && images.length > 0;
    if (padHtml.trim().length > 0 || hasImages) {
      // If only images were sent and content is empty, embed image tags so the archive is visually complete
      let archiveContent = padHtml;
      if (!archiveContent && hasImages) {
        archiveContent = images.map((u: string) => `<p><img src="${u}" /></p>`).join("");
      }
      const { data: archiveRow, error: archiveErr } = await adminClient
        .from("ceo_scratch_pad_archive")
        .insert({ user_id: userId, content: archiveContent, triaged_count: items.length })
        .select("id")
        .single();
      if (archiveErr) console.error("Archive error:", archiveErr);
      else archiveId = archiveRow?.id ?? null;
    }

    // Persist pending triage items
    let insertedItems: any[] = items;
    if (items.length > 0) {
      const rows = items.map((it) => ({
        user_id: userId,
        text: it.text,
        category: it.category,
        suggested_assignee_id: it.suggested_assignee_id || null,
        suggested_priority: it.suggested_priority || "medium",
        reasoning: it.reasoning || "",
        source_archive_id: archiveId,
      }));
      const { data: inserted, error: insErr } = await adminClient
        .from("ceo_triage_pending")
        .insert(rows)
        .select("*");
      if (insErr) {
        console.error("Triage insert error:", insErr);
      } else if (inserted) {
        insertedItems = inserted;
      }
    }

    // Clear the live scratch pad
    await adminClient.from("ceo_scratch_pad").update({ content: "", updated_at: new Date().toISOString() }).eq("user_id", userId);

    return new Response(JSON.stringify({ items: insertedItems, archive_id: archiveId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("ceo-triage error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
