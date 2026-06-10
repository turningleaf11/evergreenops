/**
 * scorecard-ghl-sync
 *
 * Pulls opportunity data from GHL and writes weekly scorecard entries.
 *
 * ghl_field_key formats supported:
 *
 * Legacy (all-pipeline):
 *   "pipeline_value"          → total monetary value across all open opps
 *   "opportunities_won"       → opps marked won this week (any pipeline)
 *   "opportunities_open"      → all open opps
 *   "revenue_won"             → sum of monetary value for opps won this week
 *
 * Pipeline-aware (preferred):
 *   "{alias}:new_week"        → new opps created this week in that pipeline
 *   "{alias}:won_week"        → opps marked won this week in that pipeline
 *   "{alias}:open"            → all open opps in that pipeline
 *   "{alias}:active"          → non-won/lost opps in that pipeline
 *   "{alias}:stage:{name}"    → opps currently in a specific stage (case-insensitive match)
 *
 * Pipeline aliases:
 *   seller   → Seller Outreach pipeline
 *   realtor  → Realtor Outreach pipeline
 *   listing  → ListingHawk pipeline
 *   main     → Main Wholesale pipeline
 *   portfolio → Portfolio pipeline
 */

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

function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

// ── GHL API helpers ──────────────────────────────────────────────────────────

async function fetchPipelines(apiKey: string, locationId: string): Promise<any[]> {
  const res = await fetch(
    `https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: "2021-07-28",
        Accept: "application/json",
      },
    },
  );
  if (!res.ok) throw new Error(`GHL pipelines ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.pipelines || [];
}

async function fetchPipelineOpps(apiKey: string, pipelineId: string): Promise<any[]> {
  const all: any[] = [];
  let startAfterId: string | null = null;

  for (let page = 0; page < 20; page++) {
    // cap at 20 pages (2000 opps) as a safety guard
    const body: Record<string, unknown> = { pipelineId, limit: 100 };
    if (startAfterId) body.startAfterId = startAfterId;

    const res = await fetch("https://services.leadconnectorhq.com/opportunities/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Version: "2021-07-28",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`GHL opps ${res.status}`);

    const data = await res.json();
    const batch: any[] = data.opportunities || [];
    all.push(...batch);

    startAfterId = data.meta?.startAfterId ?? null;
    if (batch.length < 100 || !startAfterId) break;
  }

  return all;
}

// ── Pipeline alias resolution ────────────────────────────────────────────────

const PIPELINE_ALIASES: Record<string, string[]> = {
  seller:    ["seller outreach", "seller"],
  realtor:   ["realtor outreach", "realtor", "agent outreach", "offer rocket", "offerrocket"],
  listing:   ["listinghawk", "listing hawk", "listing hawk"],
  main:      ["acquisitions", "main wholesale", "wholesale pipeline", "wholesale", "main pipeline", "main"],
  portfolio: ["portfolio", "deal inbox", "deals"],
};

function resolvePipeline(alias: string, pipelines: any[]): any | null {
  const a = alias.toLowerCase();
  const terms = PIPELINE_ALIASES[a] ?? [a];
  for (const term of terms) {
    const found = pipelines.find((p) => p.name.toLowerCase().includes(term));
    if (found) return found;
  }
  return null;
}

// ── Value computation ────────────────────────────────────────────────────────

function computeValue(
  key: string,
  pipelines: any[],
  oppsByPipelineId: Map<string, any[]>,
  weekStart: Date,
): number {
  const inWeek = (iso: string | null | undefined) =>
    !!iso && new Date(iso) >= weekStart;

  const allOpps = () => {
    const out: any[] = [];
    for (const v of oppsByPipelineId.values()) out.push(...v);
    return out;
  };

  const k = key.trim();

  // ── Legacy / global keys ──
  switch (k.toLowerCase()) {
    case "pipeline_value":
      return allOpps().reduce((s, o) => s + (o.monetaryValue || 0), 0);
    case "opportunities_count":
    case "new_contacts":
    case "leads_count":
      return allOpps().filter((o) => inWeek(o.createdAt)).length;
    case "opportunities_won":
    case "deals_won":
    case "deals_closed":
      return allOpps().filter((o) => o.status === "won" && inWeek(o.updatedAt)).length;
    case "opportunities_lost":
    case "deals_lost":
      return allOpps().filter((o) => o.status === "lost" && inWeek(o.updatedAt)).length;
    case "opportunities_open":
      return allOpps().filter((o) => (o.status ?? "open") === "open").length;
    case "revenue_won":
    case "assignment_fees":
      return allOpps()
        .filter((o) => o.status === "won" && inWeek(o.updatedAt))
        .reduce((s, o) => s + (o.monetaryValue || 0), 0);
  }

  // ── Pipeline-aware keys: {alias}:{metric} or {alias}:stage:{name} ──
  const colonIdx = k.indexOf(":");
  if (colonIdx === -1) return 0;

  const pipelineAlias = k.slice(0, colonIdx);
  const rest = k.slice(colonIdx + 1);

  const pipeline = resolvePipeline(pipelineAlias, pipelines);
  if (!pipeline) {
    console.warn(`scorecard-ghl-sync: could not resolve pipeline alias "${pipelineAlias}"`);
    return 0;
  }

  const opps = oppsByPipelineId.get(pipeline.id) ?? [];

  if (rest === "new_week") {
    return opps.filter((o) => inWeek(o.createdAt)).length;
  }
  if (rest === "won_week") {
    return opps.filter((o) => o.status === "won" && inWeek(o.updatedAt)).length;
  }
  if (rest === "open") {
    return opps.filter((o) => (o.status ?? "open") === "open").length;
  }
  if (rest === "active") {
    return opps.filter((o) => o.status !== "won" && o.status !== "lost").length;
  }
  if (rest === "won_value") {
    return opps
      .filter((o) => o.status === "won" && inWeek(o.updatedAt))
      .reduce((s, o) => s + (o.monetaryValue || 0), 0);
  }
  if (rest.startsWith("stage:")) {
    const stageName = rest.slice(6).trim().toLowerCase();
    const stage = (pipeline.stages ?? []).find(
      (s: any) => s.name.toLowerCase() === stageName,
    );
    if (!stage) {
      console.warn(
        `scorecard-ghl-sync: stage "${stageName}" not found in pipeline "${pipeline.name}"`,
      );
      return 0;
    }
    return opps.filter((o) => o.pipelineStageId === stage.id).length;
  }

  return 0;
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const week = mondayOf(new Date());
    const weekStart = new Date(week);

    // Parse force flag from body or query string
    let force = false;
    try {
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        force = body?.force === true;
      }
    } catch { /* no body */ }
    if (!force) {
      const url = new URL(req.url);
      force = url.searchParams.get("force") === "true";
    }

    // Load GHL credentials from app_settings (primary) or env vars (fallback)
    const { data: settings } = await adminClient
      .from("app_settings")
      .select("key, value")
      .in("key", ["GHL_API_KEY", "GHL_LOCATION_ID"]);
    const settingMap: Record<string, string> = {};
    (settings ?? []).forEach((s: any) => { settingMap[s.key] = s.value; });

    const ghlApiKey = settingMap.GHL_API_KEY || Deno.env.get("GHL_API_KEY");
    const locationId = settingMap.GHL_LOCATION_ID || Deno.env.get("GHL_LOCATION_ID");

    // Load active GHL-sourced metrics
    const { data: metrics, error: mErr } = await adminClient
      .from("scorecard_metrics")
      .select("id, ghl_field_key, weekly_target")
      .eq("is_active", true)
      .eq("data_source", "ghl");

    if (mErr) throw mErr;
    if (!metrics?.length) return json({ synced: 0, skipped: 0 });

    const ids = metrics.map((m: any) => m.id);

    // If force mode, delete all existing entries for this week so we re-fetch fresh
    if (force) {
      await adminClient
        .from("scorecard_entries")
        .delete()
        .in("metric_id", ids)
        .eq("week_start_date", week);
    }

    // Find which metrics are missing an entry this week
    const { data: existing } = await adminClient
      .from("scorecard_entries")
      .select("metric_id")
      .in("metric_id", ids)
      .eq("week_start_date", week);

    const have = new Set((existing ?? []).map((e: any) => e.metric_id));
    const needed = metrics.filter((m: any) => !have.has(m.id) && m.ghl_field_key);

    if (!needed.length) return json({ synced: 0, skipped: metrics.length });

    if (!ghlApiKey || !locationId) {
      return json({ synced: 0, error: "GHL_API_KEY or GHL_LOCATION_ID not configured" });
    }

    const errors: { metric_id: string; error: string }[] = [];

    // Fetch pipeline definitions (includes stage IDs for stage: lookups)
    let pipelines: any[] = [];
    try {
      pipelines = await fetchPipelines(ghlApiKey, locationId);
      console.log(`Fetched ${pipelines.length} pipelines: ${pipelines.map((p: any) => p.name).join(", ")}`);
    } catch (e: any) {
      return json({ synced: 0, error: `Pipeline fetch failed: ${e.message}` });
    }

    // Determine which pipeline aliases are needed
    const neededAliases = new Set<string>();
    for (const m of needed) {
      const key = (m.ghl_field_key as string).trim().toLowerCase();
      const colonIdx = key.indexOf(":");
      if (colonIdx > 0) {
        neededAliases.add(key.slice(0, colonIdx));
      } else {
        neededAliases.add("_all");
      }
    }

    // Fetch opps per pipeline (only the ones we actually need)
    const oppsByPipelineId = new Map<string, any[]>();

    if (neededAliases.has("_all")) {
      // Legacy mode — fetch all pipelines
      for (const pipeline of pipelines) {
        try {
          oppsByPipelineId.set(pipeline.id, await fetchPipelineOpps(ghlApiKey, pipeline.id));
        } catch (e: any) {
          console.error(`Failed to fetch opps for pipeline "${pipeline.name}": ${e.message}`);
        }
      }
    } else {
      for (const alias of neededAliases) {
        const pipeline = resolvePipeline(alias, pipelines);
        if (!pipeline) {
          const names = pipelines.map((p: any) => p.name).join(", ");
          console.warn(`Could not resolve alias "${alias}". Available pipelines: ${names}`);
          errors.push({ metric_id: `alias:${alias}`, error: `No pipeline matched alias "${alias}". Available: ${names}` });
          continue;
        }
        console.log(`Alias "${alias}" → pipeline "${pipeline.name}" (${pipeline.id})`);
        if (!oppsByPipelineId.has(pipeline.id)) {
          try {
            const opps = await fetchPipelineOpps(ghlApiKey, pipeline.id);
            oppsByPipelineId.set(pipeline.id, opps);
            console.log(`Fetched ${opps.length} opps from "${pipeline.name}"`);
          } catch (e: any) {
            errors.push({ metric_id: alias, error: e.message });
          }
        }
      }
    }

    // Compute values and upsert entries
    let synced = 0;
    for (const m of needed) {
      try {
        const value = computeValue(m.ghl_field_key as string, pipelines, oppsByPipelineId, weekStart);
        const { error: insErr } = await adminClient.from("scorecard_entries").upsert(
          {
            metric_id: m.id,
            week_start_date: week,
            actual_value: value,
            entered_by: null,
            note: "Auto-synced from GHL",
          },
          { onConflict: "metric_id,week_start_date" },
        );
        if (insErr) {
          errors.push({ metric_id: m.id, error: insErr.message });
        } else {
          synced++;
        }
      } catch (e: any) {
        errors.push({ metric_id: m.id, error: e.message });
      }
    }

    return json({
      synced,
      skipped: metrics.length - needed.length,
      errors,
      pipelinesFound: pipelines.map((p: any) => p.name),
    });
  } catch (err: any) {
    console.error("scorecard-ghl-sync error:", err);
    return json({ error: err.message, synced: 0 }, 500);
  }
});
