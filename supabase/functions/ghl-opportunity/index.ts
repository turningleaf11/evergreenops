// ghl-opportunity -- link an OpsHQ deal to its existing GHL opportunity, and on
// close, find + UPDATE that opportunity to Closed-Won (never create). Deals
// already have an opportunity by the time they reach OpsHQ.
//   action 'search': { query } -> matching opportunities to pick from.
//   action 'close':  { transactionId } -> move the linked opp to Closed-Won.
// Routing: assign/double_close -> Dispo - Active Deals; buy_hold -> Portfolio.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const GHL = "https://services.leadconnectorhq.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: settings } = await admin.from("app_settings").select("key, value").in("key", [
      "GHL_API_KEY", "GHL_LOCATION_ID",
      "GHL_DISPO_PIPELINE_ID", "GHL_DISPO_CLOSED_STAGE_ID",
      "GHL_PORTFOLIO_PIPELINE_ID", "GHL_PORTFOLIO_CLOSED_STAGE_ID",
    ]);
    const cfg: Record<string, string> = {};
    (settings ?? []).forEach((s: any) => { cfg[s.key] = s.value; });
    const apiKey = cfg.GHL_API_KEY || Deno.env.get("GHL_API_KEY");
    const locationId = cfg.GHL_LOCATION_ID || Deno.env.get("GHL_LOCATION_ID");
    if (!apiKey || !locationId) return json({ error: "GHL not configured" }, 400);

    const H = { Authorization: `Bearer ${apiKey}`, Version: "2021-07-28", "Content-Type": "application/json", Accept: "application/json" };
    const body = await req.json();

    if (body.action === "search") {
      const q = (body.query || "").toString().trim();
      if (!q) return json({ opportunities: [] });
      const params = new URLSearchParams({ location_id: locationId, q, limit: "20" });
      const r = await fetch(`${GHL}/opportunities/search?${params.toString()}`, { headers: H });
      if (!r.ok) return json({ error: `GHL search ${r.status}: ${(await r.text()).slice(0, 200)}` }, 502);
      const d = await r.json();
      const opportunities = ((d.opportunities as any[]) || []).map((o) => ({
        id: o.id,
        name: o.name,
        monetaryValue: o.monetaryValue ?? null,
        status: o.status ?? null,
        pipelineId: o.pipelineId ?? null,
        stageId: o.pipelineStageId ?? o.stageId ?? null,
        contactId: o.contactId ?? o.contact?.id ?? null,
        contactName: o.contact?.name ?? ([o.contact?.firstName, o.contact?.lastName].filter(Boolean).join(" ") || null),
      }));
      return json({ opportunities });
    }

    if (body.action === "close") {
      const txId = body.transactionId;
      if (!txId) return json({ error: "transactionId required" }, 400);
      const { data: tx } = await admin.from("crm_transactions")
        .select("id, disposition_strategy, ghl_opportunity_id, assignment_fee, purchase_price, estimated_net, closing_date, marketing_title, property_address, property_city")
        .eq("id", txId).maybeSingle();
      if (!tx) return json({ error: "Deal not found" }, 404);
      if (!tx.ghl_opportunity_id) return json({ error: "no_link", message: "No GHL opportunity is linked to this deal." }, 409);

      const portfolio = ["buy_hold", "portfolio"].includes(tx.disposition_strategy ?? "");
      const pipelineId = portfolio ? cfg.GHL_PORTFOLIO_PIPELINE_ID : cfg.GHL_DISPO_PIPELINE_ID;
      const stageId = portfolio ? cfg.GHL_PORTFOLIO_CLOSED_STAGE_ID : cfg.GHL_DISPO_CLOSED_STAGE_ID;
      const monetaryValue = portfolio
        ? (tx.purchase_price ?? undefined)
        : (tx.assignment_fee ?? tx.estimated_net ?? undefined);

      const payload: Record<string, unknown> = { pipelineId, pipelineStageId: stageId, status: "won" };
      if (monetaryValue != null) payload.monetaryValue = Number(monetaryValue);

      const r = await fetch(`${GHL}/opportunities/${tx.ghl_opportunity_id}`, { method: "PUT", headers: H, body: JSON.stringify(payload) });
      if (!r.ok) return json({ error: `GHL update ${r.status}: ${(await r.text()).slice(0, 200)}` }, 502);

      await admin.from("crm_transactions").update({ ghl_synced_at: new Date().toISOString() }).eq("id", txId);

      const label = tx.marketing_title || tx.property_address || tx.property_city || "Deal";
      await admin.from("events").insert({
        type: "ghl_writeback", severity: "success", source: "opshq",
        title: `Closed-Won synced to GHL - ${label}`,
        entity_type: "deal", entity_id: txId, entity_label: label, needs_action: false,
        metadata: { pipeline: portfolio ? "portfolio" : "dispo", monetaryValue },
      }).then(() => {}, () => {});

      return json({ ok: true, pipeline: portfolio ? "portfolio" : "dispo" });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("ghl-opportunity error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
