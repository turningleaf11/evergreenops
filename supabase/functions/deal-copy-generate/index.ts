import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// deal-copy-generate -- drafts the deal's marketing copy (listing description +
// buyer-blast email) from everything on the deal record: facts, financing custom
// fields, the investor highlight/details, price and location. Optionally bilingual
// (EN + ES). Respects address privacy -- never leaks a private street address.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const money = (n: number | null | undefined) =>
  n == null ? null : `$${Number(n).toLocaleString()}`;

function jsonErr(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeParseJson(text: string): any {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* ignore */ } }
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!ANTHROPIC_API_KEY) return jsonErr("ANTHROPIC_API_KEY not configured", 500);

    const { transactionId, spanish = false, kinds = ["description", "email"] } =
      (await req.json()) as {
        transactionId?: string;
        spanish?: boolean;
        kinds?: ("description" | "email")[];
      };
    if (!transactionId) return jsonErr("transactionId required", 400);

    const db = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Pull the whole deal picture server-side so the prompt is complete.
    const [{ data: tx, error: txErr }, { data: det }] = await Promise.all([
      db.from("crm_transactions").select("*").eq("id", transactionId).maybeSingle(),
      db.from("dispo_deal_details").select("*").eq("transaction_id", transactionId).maybeSingle(),
    ]);
    if (txErr) return jsonErr(txErr.message, 500);
    if (!tx) return jsonErr("Deal not found", 404);

    // Map custom-field keys -> labels so financing fields read naturally.
    const { data: cfDefs } = await db
      .from("crm_custom_fields")
      .select("field_key, label, sort_order")
      .eq("entity_type", "deal")
      .eq("workspace_id", tx.workspace_id)
      .order("sort_order");
    const cfValues = (tx.custom_fields ?? {}) as Record<string, unknown>;
    const financingLines = (cfDefs ?? [])
      .map((f: any) => {
        const v = cfValues[f.field_key];
        if (v == null || v === "") return null;
        return `${f.label}: ${v}`;
      })
      .filter(Boolean) as string[];

    const priv = !!tx.address_private;
    const locationLine = priv
      ? [tx.property_city, tx.property_state, tx.property_county_metro].filter(Boolean).join(", ")
      : [tx.property_address, tx.property_city, tx.property_state].filter(Boolean).join(", ");

    const facts: string[] = [
      tx.marketing_title ? `Marketing title: ${tx.marketing_title}` : null,
      `Location: ${locationLine || "n/a"}${priv ? " (street address is PRIVATE -- do not invent or reveal it)" : ""}`,
      tx.property_type ? `Property type: ${tx.property_type}` : null,
      tx.best_exit ? `Best exit strategy: ${tx.best_exit}` : null,
      det?.beds != null ? `Beds: ${det.beds}` : null,
      det?.baths != null ? `Baths: ${det.baths}` : null,
      det?.sqft != null ? `Sq ft: ${det.sqft}` : null,
      det?.year_built != null ? `Year built: ${det.year_built}` : null,
      money(tx.asking_price ?? tx.purchase_price) ? `Price: ${money(tx.asking_price ?? tx.purchase_price)}` : null,
      money(det?.arv) ? `ARV: ${money(det?.arv)}` : null,
      money(det?.repair_estimate) ? `Repair estimate: ${money(det?.repair_estimate)}` : null,
      money(tx.assignment_fee) ? `Assignment fee: ${money(tx.assignment_fee)}` : null,
      ...financingLines,
      det?.investor_highlight ? `Investor highlight (hook): ${det.investor_highlight}` : null,
      det?.investment_details ? `Details/notes: ${det.investment_details}` : null,
    ].filter(Boolean) as string[];

    const wantDescription = kinds.includes("description");
    const wantEmail = kinds.includes("email");

    // Describe the exact JSON shape we want back, keyed by what was requested.
    const shape: Record<string, string> = {};
    if (wantDescription) {
      shape.description_en = "string -- a compelling listing description, 2-4 short paragraphs, plain text";
      if (spanish) shape.description_es = "string -- the Spanish version of the description";
    }
    if (wantEmail) {
      shape.email_subject_en = "string -- punchy subject line for a buyers-list blast";
      shape.email_body_en = "string -- the email body, plain text, personal and direct, with a clear call to action to reply for details/access";
      if (spanish) {
        shape.email_subject_es = "string -- Spanish subject line";
        shape.email_body_es = "string -- Spanish email body";
      }
    }

    const system =
      "You are the in-house disposition copywriter for Evergreen, a real-estate investment firm that markets off-market and creatively-financed deals to a list of cash buyers and investors. " +
      "Write in a grounded, personal, direct voice -- like a real dispo manager emailing their buyer list, not a glossy MLS agent. No hype, no purple prose, no emojis unless they'd genuinely fit. " +
      "Be specific to the numbers and facts given; never invent facts, comps, or an address. If the address is marked private, refer to the area (city/county) only. " +
      (spanish
        ? "Provide both English and a natural Spanish translation (neutral Latin-American Spanish, appropriate for a Florida investor audience) -- translate the meaning, don't do it literally. "
        : "") +
      "Return ONLY a valid JSON object -- no markdown fences, no commentary.";

    const user =
      `DEAL FACTS:\n${facts.join("\n")}\n\n` +
      `Return ONLY a JSON object with exactly these keys:\n` +
      Object.entries(shape).map(([k, v]) => `  "${k}": ${v}`).join("\n") +
      `\n\nDo not include any key not listed above.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("Anthropic error", r.status, t);
      if (r.status === 429) return jsonErr("Rate limited -- try again in a moment.", 429);
      return jsonErr(`AI error ${r.status}`, 500);
    }
    const data = await r.json();
    const raw = data?.content?.[0]?.text || "{}";
    const parsed = safeParseJson(raw);
    if (!parsed) return jsonErr("AI returned invalid JSON", 500);

    return new Response(JSON.stringify({ copy: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("deal-copy-generate error", e);
    return jsonErr(e instanceof Error ? e.message : "unknown", 500);
  }
});
