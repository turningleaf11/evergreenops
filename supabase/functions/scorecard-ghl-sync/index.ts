/**
 * scorecard-ghl-sync v28
 *
 * GHL API v2021-07-28:
 *   GET /opportunities/search?location_id=...&pipeline_id=...&page=N&limit=100
 *   GET /opportunities/search?location_id=...&pipeline_id=...&pipeline_stage_id=...&limit=1
 *     → meta.total gives exact stage count without fetching all records
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

// ── GHL helpers ───────────────────────────────────────────────────────────────

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

/**
 * Fetch opps for a pipeline (used for weekly-filtered metrics: new_week, won_week, open, active).
 * Capped at 30 pages (3000) — sufficient for recent/status-based counts.
 */
async function fetchPipelineOpps(apiKey: string, locationId: string, pipelineId: string): Promise<any[]> {
  const all: any[] = [];
  let page = 1;

  for (let attempt = 0; attempt < 30; attempt++) {
    const params = new URLSearchParams({
      location_id: locationId,
      pipeline_id: pipelineId,
      limit: "100",
      page: String(page),
    });

    const res = await fetch(
      `https://services.leadconnectorhq.com/opportunities/search?${params}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: "2021-07-28",
          Accept: "application/json",
        },
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`GHL opps ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    const batch: any[] = data.opportunities || [];
    all.push(...batch);

    if (batch.length < 100) break;
    page++;
  }

  return all;
}

/**
 * Get exact count of opps in a specific stage using pipeline_stage_id filter.
 * Reads meta.total from response — no need to paginate, works for any pipeline size.
 */
async function fetchStageCount(
  apiKey: string,
  locationId: string,
  pipelineId: string,
  stageId: string,
): Promise<number> {
  const params = new URLSearchParams({
    location_id: locationId,
    pipeline_id: pipelineId,
    pipeline_stage_id: stageId,
    limit: "1",
    page: "1",
  });

  const res = await fetch(
    `https://services.leadconnectorhq.com/opportunities/search?${params}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: "2021-07-28",
        Accept: "application/json",
      },
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`GHL stage count ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  console.log(`  stage ${stageId} meta: ${JSON.stringify(data.meta)}`);

  // meta.total is the exact count without fetching all records
  if (typeof data.meta?.total === "number") return data.meta.total;

  // Fallback: paginate to count (if GHL doesn't return meta.total)
  let count = (data.opportunities || []).length;
  if (count < 1) return count;

  let page = 2;
  for (let attempt = 0; attempt < 200; attempt++) {
    const p = new URLSearchParams({
      location_id: locationId,
      pipeline_id: pipelineId,
      pipeline_stage_id: stageId,
      limit: "100",
      page: String(page),
    });
    const r = await fetch(`https://services.leadconnectorhq.com/opportunities/search?${p}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Version: "2021-07-28", Accept: "application/json" },
    });
    if (!r.ok) break;
    const d = await r.json();
    const batch = d.opportunities || [];
    count += batch.length;
    if (batch.length < 100) break;
    page++;
  }
  return count;
}

// ── Pipeline alias resolution ─────────────────────────────────────────────────

const PIPELINE_ALIASES: Record<string, string[]> = {
  seller:    ["seller outreach", "seller"],
  realtor:   ["realtor outreach", "realtor", "offerrocket", "offer rocket", "agent outreach"],
  listing:   ["listinghawk", "listing hawk"],
  main:      ["main pipeline", "main wholesale", "acquisitions", "wholesale pipeline", "wholesale", "main"],
  portfolio: ["portfolio", "deal inbox", "deals"],
};

function resolvePipeline(alias: string, pipelines: any[]): any | null {
  const terms = PIPELINE_ALIASES[alias.toLowerCase()] ?? [alias.toLowerCase()];
  for (const term of terms) {
    const found = pipelines.find((p) => p.name.toLowerCase().includes(term));
    if (found) return found;
  }
  return null;
}

// ── Non-stage value computation (uses pre-fetched opps batch) ─────────────────

function computeNonStageValue(
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

  const colonIdx = k.indexOf(":");
  if (colonIdx === -1) return 0;

  const pipelineAlias = k.slice(0, colonIdx);
  const rest = k.slice(colonIdx + 1);

  const pipeline = resolvePipeline(pipelineAlias, pipelines);
  if (!pipeline) {
    console.warn(`Could not resolve alias "${pipelineAlias}"`);
    return 0;
  }

  const opps = oppsByPipelineId.get(pipeline.id) ?? [];

  if (rest === "new_week") return opps.filter((o) => inWeek(o.createdAt)).length;
  if (rest === "won_week") return opps.filter((o) => o.status === "won" && inWeek(o.updatedAt)).length;
  if (rest === "open") return opps.filter((o) => (o.status ?? "open") === "open").length;
  if (rest === "active") return opps.filter((o) => o.status !== "won" && o.status !== "lost").length;
  if (rest === "won_value") {
    return opps
      .filter((o) => o.status === "won" && inWeek(o.updatedAt))
      .reduce((s, o) => s + (o.monetaryValue || 0), 0);
  }

  return 0;
}

// ── Main handler ──────────────────────────────────────────────────────────────

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

    let force = false;
    let debug = false;
    try {
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        force = body?.force === true;
        debug = body?.debug === true;
      }
    } catch { /* no body */ }
    const urlParams = new URL(req.url).searchParams;
    if (!force) force = urlParams.get("force") === "true";
    if (!debug) debug = urlParams.get("debug") === "true";

    // Load GHL credentials
    const { data: settings } = await adminClient
      .from("app_settings")
      .select("key, value")
      .in("key", ["GHL_API_KEY", "GHL_LOCATION_ID"]);
    const settingMap: Record<string, string> = {};
    (settings ?? []).forEach((s: any) => { settingMap[s.key] = s.value; });

    const ghlApiKey = settingMap.GHL_API_KEY || Deno.env.get("GHL_API_KEY");
    const locationId = settingMap.GHL_LOCATION_ID || Deno.env.get("GHL_LOCATION_ID");

    if (!ghlApiKey || !locationId) {
      return json({ synced: 0, error: "GHL_API_KEY or GHL_LOCATION_ID not configured" });
    }

    // ── DEBUG mode ───────────────────────────────────────────────────────────
    if (debug) {
      const pipelines = await fetchPipelines(ghlApiKey, locationId);
      const pipelineSamples: Record<string, unknown> = {};
      let totalOpps = 0;
      for (const p of pipelines) {
        try {
          const opps = await fetchPipelineOpps(ghlApiKey, locationId, p.id);
          totalOpps += opps.length;
          // For first stage, also test fetchStageCount to verify meta.total
          let stageTest: unknown = "no stages";
          if (p.stages?.length) {
            try {
              const s = p.stages[0];
              const cnt = await fetchStageCount(ghlApiKey, locationId, p.id, s.id);
              stageTest = { stage: s.name, count: cnt };
            } catch (e: any) {
              stageTest = { error: e.message };
            }
          }
          pipelineSamples[p.name] = {
            count: opps.length,
            // stage name → id map so we can cross-reference with opp.pipelineStageId
            stages: (p.stages ?? []).map((s: any) => s.name),
            stageIds: Object.fromEntries((p.stages ?? []).map((s: any) => [s.name, s.id])),
            stageTest,
            sample: opps.slice(0, 3).map((o: any) => ({
              id: o.id, status: o.status, stageId: o.pipelineStageId, createdAt: o.createdAt,
            })),
          };
        } catch (e: any) {
          pipelineSamples[p.name] = { error: e.message };
        }
      }
      return json({
        totalOpps,
        pipelines: pipelines.map((p: any) => ({ id: p.id, name: p.name, stageCount: (p.stages || []).length })),
        pipelineSamples,
      });
    }

    // ── Normal sync ──────────────────────────────────────────────────────────
    const { data: metrics, error: mErr } = await adminClient
      .from("scorecard_metrics")
      .select("id, ghl_field_key, weekly_target")
      .eq("is_active", true)
      .eq("data_source", "ghl");

    if (mErr) throw mErr;
    if (!metrics?.length) return json({ synced: 0, skipped: 0 });

    const ids = metrics.map((m: any) => m.id);

    if (force) {
      await adminClient
        .from("scorecard_entries")
        .delete()
        .in("metric_id", ids)
        .eq("week_start_date", week);
    }

    const { data: existing } = await adminClient
      .from("scorecard_entries")
      .select("metric_id")
      .in("metric_id", ids)
      .eq("week_start_date", week);

    const have = new Set((existing ?? []).map((e: any) => e.metric_id));
    const needed = metrics.filter((m: any) => !have.has(m.id) && m.ghl_field_key);

    if (!needed.length) return json({ synced: 0, skipped: metrics.length });

    const errors: { metric_id: string; error: string }[] = [];

    // Fetch pipelines (includes stage IDs)
    let pipelines: any[] = [];
    try {
      pipelines = await fetchPipelines(ghlApiKey, locationId);
      console.log(`Fetched ${pipelines.length} pipelines`);
    } catch (e: any) {
      return json({ synced: 0, error: `Pipeline fetch failed: ${e.message}` });
    }

    // Split metrics into stage-snapshot vs batch-computed
    const stageMetrics = needed.filter((m: any) => (m.ghl_field_key as string).includes(":stage:"));
    const batchMetrics = needed.filter((m: any) => !(m.ghl_field_key as string).includes(":stage:"));

    // Pre-fetch opps batches for non-stage metrics
    const oppsByPipelineId = new Map<string, any[]>();

    if (batchMetrics.length > 0) {
      const needsAllPipelines = batchMetrics.some((m: any) => !(m.ghl_field_key as string).includes(":"));
      if (needsAllPipelines) {
        for (const p of pipelines) {
          if (!oppsByPipelineId.has(p.id)) {
            try {
              const opps = await fetchPipelineOpps(ghlApiKey, locationId, p.id);
              oppsByPipelineId.set(p.id, opps);
            } catch (e: any) {
              console.error(`Failed "${p.name}": ${e.message}`);
            }
          }
        }
      } else {
        const aliasSet = new Set<string>();
        for (const m of batchMetrics) {
          const key = (m.ghl_field_key as string).trim().toLowerCase();
          const colonIdx = key.indexOf(":");
          if (colonIdx > 0) aliasSet.add(key.slice(0, colonIdx));
        }
        for (const alias of aliasSet) {
          const pipeline = resolvePipeline(alias, pipelines);
          if (!pipeline) {
            errors.push({ metric_id: `alias:${alias}`, error: `No pipeline matched "${alias}"` });
            continue;
          }
          if (!oppsByPipelineId.has(pipeline.id)) {
            try {
              const opps = await fetchPipelineOpps(ghlApiKey, locationId, pipeline.id);
              oppsByPipelineId.set(pipeline.id, opps);
              console.log(`"${pipeline.name}": ${opps.length} opps fetched`);
            } catch (e: any) {
              errors.push({ metric_id: alias, error: e.message });
            }
          }
        }
      }
    }

    let synced = 0;

    // ── Process stage metrics via direct stage count API ─────────────────────
    for (const m of stageMetrics) {
      const key = (m.ghl_field_key as string).trim();
      // Format: alias:stage:Stage Name
      const stageIdx = key.indexOf(":stage:");
      const pipelineAlias = key.slice(0, stageIdx);
      const stageName = key.slice(stageIdx + 7).trim();

      const pipeline = resolvePipeline(pipelineAlias, pipelines);
      if (!pipeline) {
        errors.push({ metric_id: m.id, error: `No pipeline for alias "${pipelineAlias}"` });
        continue;
      }

      const stage = (pipeline.stages ?? []).find(
        (s: any) => s.name.toLowerCase() === stageName.toLowerCase(),
      );
      if (!stage) {
        const available = (pipeline.stages ?? []).map((s: any) => s.name).join(", ");
        errors.push({
          metric_id: m.id,
          error: `Stage "${stageName}" not in "${pipeline.name}". Available: ${available}`,
        });
        continue;
      }

      try {
        const value = await fetchStageCount(ghlApiKey, locationId, pipeline.id, stage.id);
        console.log(`Stage "${stageName}" in "${pipeline.name}": ${value}`);
        const { error: insErr } = await adminClient.from("scorecard_entries").upsert(
          { metric_id: m.id, week_start_date: week, actual_value: value, entered_by: null, note: "Auto-synced from GHL" },
          { onConflict: "metric_id,week_start_date" },
        );
        if (insErr) errors.push({ metric_id: m.id, error: insErr.message });
        else synced++;
      } catch (e: any) {
        errors.push({ metric_id: m.id, error: e.message });
      }
    }

    // ── Process batch metrics ─────────────────────────────────────────────────
    for (const m of batchMetrics) {
      try {
        const value = computeNonStageValue(m.ghl_field_key as string, pipelines, oppsByPipelineId, weekStart);
        const { error: insErr } = await adminClient.from("scorecard_entries").upsert(
          { metric_id: m.id, week_start_date: week, actual_value: value, entered_by: null, note: "Auto-synced from GHL" },
          { onConflict: "metric_id,week_start_date" },
        );
        if (insErr) errors.push({ metric_id: m.id, error: insErr.message });
        else synced++;
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
