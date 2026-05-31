// AI helpers for the team inbox.
// Modes:
//   - "summarize": classify a list of thread previews into Action/FYI/Newsletter/Awaiting reply
//   - "suggest_reply": draft a reply for a single thread
import { getGmailContext, gmail } from "../_shared/gmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_API = "https://api.openai.com/v1/chat/completions";

async function callAI(messages: any[], opts: { json?: boolean } = {}) {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY missing");
  const res = await fetch(OPENAI_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway: ${res.status} ${t}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode, threads, threadId } = await req.json();

    if (mode === "summarize") {
      const list = (threads ?? []).slice(0, 30).map((t: any, i: number) =>
        `${i + 1}. From: ${t.from} | Subject: ${t.subject} | Snippet: ${t.snippet}`
      ).join("\n");
      const prompt = `You triage emails for a real estate acquisitions company.
Classify each email thread into exactly ONE of:
  - "deal"            (incoming property/deal/offering: wholesale offers, broker pitches, off-market opportunities, property listings, ARV/comps, dispo)
  - "client"          (existing client / seller / buyer correspondence, contract negotiations)
  - "vendor"          (title companies, lenders, contractors, inspectors, insurance, attorneys)
  - "internal"        (teammates / coworkers / company-internal threads)
  - "action"          (anything that needs YOU to do something not covered above)
  - "awaiting_reply"  (you sent the last message and are waiting on them)
  - "fyi"             (informational, no action)
  - "newsletter"      (newsletters, marketing, automated digests, unsubscribe footers)

Return strict JSON:
{
  "items": [{ "index": 1, "category": "deal", "reason": "short reason", "suggested_label": "Deals" }, ...],
  "summary": "2-3 sentence inbox overview emphasising deals and items needing action"
}

Threads:
${list}`;
      const content = await callAI([
        { role: "system", content: "You are an email triage assistant for a real estate acquisitions company. Always reply with valid JSON only." },
        { role: "user", content: prompt },
      ], { json: true });
      let parsed: any = {};
      try { parsed = JSON.parse(content); } catch { parsed = { error: "parse", raw: content }; }
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "suggest_reply") {
      const { ctx, error } = await getGmailContext(req);
      if (error) return new Response(JSON.stringify(error.body), { status: error.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!threadId) return new Response(JSON.stringify({ error: "threadId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const r = await gmail(ctx, `/threads/${threadId}?format=full`);
      if (!r.ok) return new Response(JSON.stringify({ error: "Thread fetch failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const thread = await r.json();

      const text = (thread.messages ?? []).slice(-3).map((m: any) => {
        const subj = m.payload?.headers?.find((h: any) => h.name?.toLowerCase() === "subject")?.value ?? "";
        const from = m.payload?.headers?.find((h: any) => h.name?.toLowerCase() === "from")?.value ?? "";
        return `From: ${from}\nSubject: ${subj}\n\n${m.snippet ?? ""}`;
      }).join("\n\n---\n\n");

      const reply = await callAI([
        { role: "system", content: "You draft concise, professional email replies. Match the tone of the conversation. Do not include subject or greetings beyond a short salutation. Keep it under 120 words. Return only the reply body in plain text." },
        { role: "user", content: `Conversation so far:\n\n${text}\n\nDraft a reply.` },
      ]);

      const html = reply
        .split(/\n\n+/)
        .map((p: string) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
        .join("");

      return new Response(JSON.stringify({ html, text: reply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown mode" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("email-ai-triage error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
