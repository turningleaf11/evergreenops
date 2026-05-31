import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Generates a single AI message for the Vision Setup onboarding flow.
 *
 * Inputs:
 *   - mode: "intro" | "followup" | "summary"
 *   - step: { id, label, prompt, hint }
 *   - userName, workspaceName
 *   - lastAnswer (for followup) â€” the user's reply to the current step
 *   - allAnswers (for summary) â€” all collected answers as a record
 *
 * Returns plain text.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mode, step, userName, workspaceName, lastAnswer, allAnswers } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const systemPrompt = `You are a warm, sharp business coach helping a CEO set up their company's Vision Layer for the first time. You sound like a smart strategist â€” not a survey bot. Speak in 1-3 short sentences. Never use headings or lists. Address the user by first name when natural. Workspace name: ${workspaceName || "their company"}. User name: ${userName || "there"}.`;

    let userPrompt = "";

    if (mode === "intro") {
      // Generate the question for this step
      userPrompt = `We are at step "${step?.id}" of the Vision Setup. The fixed prompt for this step is: "${step?.prompt}". Rewrite this in your own warm, personal voice (1-2 sentences). Do not add extra context or explain why we're asking. End with a clear question.`;
    } else if (mode === "followup") {
      // The user gave a short or vague answer â€” gently ask for more, OR acknowledge and confirm
      userPrompt = `Step: "${step?.id}". Original question: "${step?.prompt}". The user's answer was:

"""${lastAnswer}"""

If the answer is substantive (more than a few words and clearly responsive), reply with a brief acknowledgement (one sentence, warm but not gushing) and tell them we're moving on. Do NOT ask another question. Start with something like "Got it." or "Love that." or "Makes sense."

If the answer is too short, vague, or a non-answer, ask ONE gentle follow-up question to draw out more detail. Do not lecture.`;
    } else if (mode === "summary") {
      const lines = Object.entries(allAnswers || {}).map(([k, v]) => `- ${k}: ${v}`).join("\n");
      userPrompt = `Here's everything ${userName || "the CEO"} just shared in setup:\n\n${lines}\n\nWrite 2-3 warm, encouraging sentences acknowledging what they've built. Mention 1-2 specific things they said. End by saying their HQ is ready.`;
    } else {
      return new Response(JSON.stringify({ error: "invalid mode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: "ai_failed", detail: t }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
