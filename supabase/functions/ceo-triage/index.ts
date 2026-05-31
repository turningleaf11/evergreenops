import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

type TriageCategory = "task" | "project" | "decision" | "idea" | "delegation";

type TriageItem = {
  text: string;
  category: TriageCategory;
  suggested_assignee_id: string | null;
  suggested_priority: "low" | "medium" | "high";
  reasoning: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractBearerToken(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function cleanJsonText(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizeCategory(value: unknown): TriageCategory {
  const category = typeof value === "string" ? value.toLowerCase() : "task";
  if (["task", "project", "decision", "idea", "delegation"].includes(category)) {
    return category as TriageCategory;
  }
  return "task";
}

function normalizePriority(value: unknown): "low" | "medium" | "high" {
  const priority = typeof value === "string" ? value.toLowerCase() : "medium";
  if (["low", "medium", "high"].includes(priority)) return priority as "low" | "medium" | "high";
  return "medium";
}

function normalizeItems(rawItems: unknown): TriageItem[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((item: any) => ({
      text: typeof item?.text === "string" ? item.text.trim() : "",
      category: normalizeCategory(item?.category),
      suggested_assignee_id:
        typeof item?.suggested_assignee_id === "string" && item.suggested_assignee_id.trim()
          ? item.suggested_assignee_id.trim()
          : null,
      suggested_priority: normalizePriority(item?.suggested_priority),
      reasoning: typeof item?.reasoning === "string" ? item.reasoning.trim() : "Captured from scratchpad.",
    }))
    .filter((item) => item.text.length > 0)
    .slice(0, 25);
}

function parseAiItems(raw: string): TriageItem[] {
  try {
    const parsed = JSON.parse(cleanJsonText(raw));
    return normalizeItems(parsed.items);
  } catch {
    return [];
  }
}

function buildHeuristicItems(content: string): TriageItem[] {
  const lines = content
    .split(/\n|\r|\u2022|- \s+/g)
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((line) => line.length >= 3);

  const sourceLines = lines.length ? lines : [content.trim()].filter(Boolean);

  return sourceLines.slice(0, 12).map((line) => {
    const lower = line.toLowerCase();
    const category: TriageCategory =
      /delegate|assign|follow up with|ask /.test(lower)
        ? "delegation"
        : /decide|decision|approved|chosen|go with/.test(lower)
          ? "decision"
          : /idea|maybe|could|what if/.test(lower)
            ? "idea"
            : /project|launch|build|roll out|rebuild|initiative/.test(lower)
              ? "project"
              : "task";

    const suggested_priority: "low" | "medium" | "high" = /urgent|asap|today|critical|blocked/.test(lower)
      ? "high"
      : /later|someday|backlog/.test(lower)
        ? "low"
        : "medium";

    return {
      text: line,
      category,
      suggested_assignee_id: null,
      suggested_priority,
      reasoning: "Auto-filed from scratchpad text using the fallback triage parser.",
    };
  });
}

function buildSystemPrompt(teamRoster: string, activeTasks: string, activeProjects: string) {
  return `You are an executive assistant AI for a CEO. Organize raw scratchpad notes into actionable items.

Categorize each extracted item as exactly one of:
- task: a specific small unit of work the CEO will do.
- delegation: a task to assign to a teammate.
- project: a multi-step initiative that produces an outcome.
- decision: a documented choice or directional call.
- idea: a raw concept worth capturing for later.

Team roster:
${teamRoster || "No team roster available."}

Active tasks:
${activeTasks || "None"}

Active projects:
${activeProjects || "None"}

Suggest an assignee only when the notes clearly point to someone on the roster. Use their UUID. Suggest priority as low, medium, or high. Return strict JSON only.`;
}

async function generateWithAnthropic(systemPrompt: string, content: string, images: string[]): Promise<TriageItem[]> {
  if (!ANTHROPIC_API_KEY) return [];

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const imageNote = images.length
    ? `\n\nThe scratchpad included ${images.length} image URL(s). If you cannot inspect images directly, only extract items from the text and mention that image content needs manual review.`
    : "";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1400,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Raw scratchpad notes:\n\n${content || "(No typed text.)"}${imageNote}\n\nReturn JSON in this exact shape:\n{\n  "items": [\n    {\n      "text": "string",\n      "category": "task|project|decision|idea|delegation",\n      "suggested_assignee_id": "uuid or null",\n      "suggested_priority": "low|medium|high",\n      "reasoning": "short reason"\n    }\n  ]\n}`,
      },
    ],
  });

  const raw = response.content
    .filter((block: any) => block.type === "text")
    .map((block: any) => block.text)
    .join("\n");

  return parseAiItems(raw);
}

async function generateWithLovable(systemPrompt: string, content: string, images: string[]): Promise<TriageItem[]> {
  if (!OPENAI_API_KEY) return [];

  const userContent: any[] = [];
  if (content.trim()) {
    userContent.push({ type: "text", text: `Raw notes:\n\n${content}\n\nExtract and organize these into actionable items.` });
  }
  for (const imageUrl of images) {
    userContent.push({ type: "image_url", image_url: { url: imageUrl } });
  }
  if (userContent.length === images.length && images.length > 0) {
    userContent.unshift({ type: "text", text: "Read these scratchpad images and extract actionable items." });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent.length === 1 && userContent[0].type === "text" ? userContent[0].text : userContent },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "triage_items",
            description: "Return extracted and organized items from the CEO scratchpad.",
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
    const errText = await response.text();
    throw new Error(`Lovable AI failed (${response.status}): ${errText.slice(0, 500)}`);
  }

  const result = await response.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  return normalizeItems(JSON.parse(toolCall?.function?.arguments || "{}").items);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
      return jsonResponse({ error: "Supabase environment is not configured" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const content = typeof body.content === "string" ? body.content : "";
    const images = Array.isArray(body.images) ? body.images.filter((u: unknown) => typeof u === "string") : [];

    if (content.trim().length < 3 && images.length === 0) {
      return jsonResponse({ error: "Content too short" }, 400);
    }

    const token = extractBearerToken(req);
    if (!token) return jsonResponse({ error: "Missing auth" }, 401);

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    const [profilesRes, tasksRes, projectsRes] = await Promise.all([
      adminClient.from("profiles").select("user_id, full_name, title, department_id").limit(100),
      adminClient.from("tasks").select("title, status, assigned_to, priority").neq("status", "done").limit(50),
      adminClient.from("projects").select("title, status, owner_id, priority").neq("status", "done").limit(30),
    ]);

    const teamRoster = (profilesRes.data || [])
      .map((p: any) => `${p.full_name || "Unknown"} (ID: ${p.user_id}, Role: ${p.title || "N/A"})`)
      .join("\n");
    const activeTasks = (tasksRes.data || [])
      .map((t: any) => `- ${t.title} [${t.status}] assigned:${t.assigned_to || "none"}`)
      .join("\n");
    const activeProjects = (projectsRes.data || [])
      .map((p: any) => `- ${p.title} [${p.status}] owner:${p.owner_id || "none"}`)
      .join("\n");

    const systemPrompt = buildSystemPrompt(teamRoster, activeTasks, activeProjects);
    let source = "fallback";
    let aiError: string | null = null;
    let items: TriageItem[] = [];

    try {
      items = await generateWithAnthropic(systemPrompt, content, images);
      if (items.length > 0) source = "anthropic";
    } catch (err) {
      aiError = err instanceof Error ? err.message : "Anthropic triage failed";
      console.error("Anthropic triage failed", aiError);
    }

    if (items.length === 0 && OPENAI_API_KEY) {
      try {
        items = await generateWithLovable(systemPrompt, content, images);
        if (items.length > 0) source = "openai";
      } catch (err) {
        aiError = err instanceof Error ? err.message : "Lovable triage failed";
        console.error("Lovable triage failed", aiError);
      }
    }

    if (items.length === 0) {
      items = buildHeuristicItems(content || (images.length ? `${images.length} scratchpad image(s) need manual review.` : ""));
    }

    let archiveId: string | null = null;
    const archiveContent = content.trim()
      ? content
      : images.map((u: string) => `<p><img src="${u}" /></p>`).join("");

    if (archiveContent.trim().length > 0) {
      const { data: archiveRow, error: archiveErr } = await adminClient
        .from("ceo_scratch_pad_archive")
        .insert({ user_id: userId, content: archiveContent, triaged_count: items.length })
        .select("id")
        .single();

      if (archiveErr) {
        console.error("Scratchpad archive error", archiveErr.message);
      } else {
        archiveId = archiveRow?.id ?? null;
      }
    }

    let insertedItems: any[] = items;
    if (items.length > 0) {
      const rows = items.map((it) => ({
        user_id: userId,
        text: it.text,
        category: it.category,
        suggested_assignee_id: it.suggested_assignee_id,
        suggested_priority: it.suggested_priority,
        reasoning: it.reasoning,
        source_archive_id: archiveId,
      }));

      const { data: inserted, error: insertErr } = await adminClient
        .from("ceo_triage_pending")
        .insert(rows)
        .select("*");

      if (insertErr) {
        console.error("Triage insert error", insertErr.message);
        return jsonResponse({ error: insertErr.message, items, archive_id: archiveId, source, ai_error: aiError }, 500);
      }

      insertedItems = inserted || items;
    }

    await adminClient
      .from("ceo_scratch_pad")
      .update({ content: "", updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    return jsonResponse({ items: insertedItems, archive_id: archiveId, source, ai_error: aiError });
  } catch (err) {
    console.error("ceo-triage error", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
