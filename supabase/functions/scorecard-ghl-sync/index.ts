/**
 * scorecard-ghl-sync v38
 *
 * GHL API v2021-07-28:
 *   GET /opportunities/search?location_id=...&pipeline_id=...&page=N&limit=100
 *
 * Stage counting strategy:
 *   - Small/medium pipelines (<2900 total opps): fetch all, filter client-side by
 *     pipelineStageId — most accurate, immune to API-side filter quirks.
 *   - Large pipelines (≥2900 opps, e.g. Seller Outreach 17k): fall back to
 *     pipeline_stage_id filter + meta.total.
 *
 * Calls metrics (orbit_call_events, no GHL API needed for team/cara/total):
 *   calls:total_week          - all users (legacy key, still supported)
 *   calls:total_week:team     - human reps only (excludes Cara) — displayed as "Total"
 *   calls:total_week:cara     - Cara VA only
 *   calls:connection_rate_week:team  - connection % for human reps this week
 *   calls:connection_rate_week:cara  - connection % for Cara this week
 *
 * Calls channel breakdown (needs a GHL contact lookup per distinct caller —
 * see fetchContactChannel/mapWithConcurrency):
 *   calls:total_week:realtor|broker|wholesaler|seller       - raw count
 *   calls:connected_week:realtor|broker|wholesaler|seller   - raw connected
 *     count, NOT a rate (unlike calls:connection_rate_week:team/cara above —
 *     Autumn wants channel-level "Connected" tracked as a headcount target,
 *     e.g. "connect with 20 brokers this week", confirmed 2026-08-07).
 *   Realtor/Broker/Wholesaler classified by contact tag; Seller by GHL's
 *   native `type === "seller_lead"` field (not a tag, not a custom field).
 *
 * Dispo pipeline metrics (Dispo Active Deals, hardcoded pipeline ID):
 *   dispo:active     - open deal count (all non-won, non-lost)
 *   dispo:won_count  - all-time closed-won count
 *   dispo:win_rate   - won ÷ (won + lost) × 100
 *   dispo:revenue    - sum of monetaryValue for all won deals
 *
 * Deal-sent metrics (contact-tag join, Portfolio + SFR pipelines, this week only):
 *   dealsent:realtor     - new opps this week whose contact is tagged "realtor"
 *   dealsent:broker      - new opps this week whose contact is tagged "broker"
 *   dealsent:wholesaler  - new opps this week whose contact is tagged "wholesaler"
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Constants ─────────────────────────────────────────────────────────────────

/** Cara's GHL user ID — tracked separately from the human rep team. */
const CARA_USER_ID = "fH16f37RPnDnVFwLiJap";

/** Dispo Active Deals pipeline ID — hardcoded to avoid alias mismatch. */
const DISPO_PIPELINE_ID = "iRmZ78SRBCSRO6LeqYpF";

/**
 * A call is "connected" when duration ≥ 30 seconds.
 * This is more reliable than disposition strings (which vary by rep).
 */
const CONNECTION_DURATION_THRESHOLD = 30;

// ── Helpers ───────────────────────────────────────────────────────────────────

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

  if (typeof data.meta?.total === "number") return data.meta.total;

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

/**
 * Runs `fn` over `items` with at most `limit` in flight at once — used for
 * per-contact GHL lookups (calls channel classification), where volume is
 * high enough (~150-250/week) that fully sequential would be slow, but
 * unbounded Promise.all risks hammering GHL's rate limit.
 */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

/**
 * Classifies a contact into a calls-tracking channel. Realtor/Broker/
 * Wholesaler use the `tags` array (same mechanism as `dealsent:`). Sellers
 * use GHL's native `type` field ("seller_lead") — NOT a tag and NOT a custom
 * field; verified live 2026-08-07 that no location custom field is named
 * "Contact Type" and that seller-outreach contacts consistently have
 * `type: "seller_lead"` (10/10 sampled). Checked in this order; first match
 * wins; returns null if the contact matches none (still counts toward the
 * Total, just not toward a channel).
 */
async function fetchContactChannel(apiKey: string, contactId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Version: "2021-07-28", Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const tags: string[] = (data.contact?.tags ?? []).map((t: string) => t.toLowerCase());
    if (tags.includes("realtor")) return "realtor";
    if (tags.includes("broker")) return "broker";
    if (tags.includes("wholesaler")) return "wholesaler";
    if (data.contact?.type === "seller_lead") return "seller";
    return null;
  } catch {
    return null;
  }
}

// ── Pipeline alias resolution ─────────────────────────────────────────────────

// Pipeline names were renamed 2026-08-06 (portfolio pivot). "main" and "listing"
// keys are kept for backward compat with any pre-existing scorecard_metrics rows;
// their search terms were updated to match the new names. "sfr" is the new
// preferred key for the same pipeline going forward. "broker" and "wholesaler"
// are new. See reference_ghl_api.md memory for the full rename map.
const PIPELINE_ALIASES: Record<string, string[]> = {
  seller:     ["seller outreach", "seller"],
  realtor:    ["realtor outreach", "realtor", "offerrocket", "offer rocket", "agent outreach"],
  listing:    ["listinghawk", "listing hawk", "on market deals", "on market"],
  main:       ["sfr deals", "sfr pipeline", "sfr", "main pipeline", "main wholesale", "wholesale pipeline", "wholesale", "main"],
  sfr:        ["sfr deals", "sfr pipeline", "sfr"],
  portfolio:  ["portfolio deals", "portfolio", "deal inbox", "deals"],
  broker:     ["broker outreach", "broker discovery", "multi-broker", "broker"],
  wholesaler: ["wholesaler outreach", "wholesaler discovery", "wholesaler"],
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
    let synced = 0;

    const nextWeek = new Date(weekStart);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekIso = nextWeek.toISOString();
    const weekStartIso = weekStart.toISOString();

    // ── 1. CALLS METRICS (orbit_call_events — no GHL API) ────────────────────

    const CALLS_CHANNELS = ["realtor", "broker", "wholesaler", "seller"];

    const isCallsKey = (key: string) => {
      const k = key.trim().toLowerCase();
      if (
        k === "calls:total_week" || k === "calls:total_week:team" || k === "calls:total_week:cara" ||
        k === "calls:connection_rate_week:team" || k === "calls:connection_rate_week:cara"
      ) return true;
      // Channel breakdown uses raw connected-call counts (calls:connected_week:X),
      // not a rate — distinct from the team/cara connection_rate_week keys above.
      // "Connection Rate — Total" stays a %; "Connected — Realtor/Broker/
      // Wholesaler/Seller" are headcounts (unit "#" in scorecard_metrics),
      // per Autumn 2026-08-07.
      return CALLS_CHANNELS.some((ch) => k === `calls:total_week:${ch}` || k === `calls:connected_week:${ch}`);
    };

    const callsMetrics = needed.filter((m: any) => isCallsKey(m.ghl_field_key));
    const afterCallsNeeded = needed.filter((m: any) => !isCallsKey(m.ghl_field_key));

    if (callsMetrics.length > 0) {
      // Fetch call stats for team (excl. Cara) and Cara separately in parallel
      const [teamTotalRes, caraTotalRes, teamConnRes, caraConnRes] = await Promise.all([
        // Team total (all non-Cara users this week)
        adminClient
          .from("orbit_call_events")
          .select("*", { count: "exact", head: true })
          .neq("ghl_user_id", CARA_USER_ID)
          .gte("occurred_at", weekStartIso)
          .lt("occurred_at", nextWeekIso),

        // Cara total this week
        adminClient
          .from("orbit_call_events")
          .select("*", { count: "exact", head: true })
          .eq("ghl_user_id", CARA_USER_ID)
          .gte("occurred_at", weekStartIso)
          .lt("occurred_at", nextWeekIso),

        // Team connected (duration >= threshold)
        adminClient
          .from("orbit_call_events")
          .select("*", { count: "exact", head: true })
          .neq("ghl_user_id", CARA_USER_ID)
          .gte("occurred_at", weekStartIso)
          .lt("occurred_at", nextWeekIso)
          .gte("duration_seconds", CONNECTION_DURATION_THRESHOLD),

        // Cara connected
        adminClient
          .from("orbit_call_events")
          .select("*", { count: "exact", head: true })
          .eq("ghl_user_id", CARA_USER_ID)
          .gte("occurred_at", weekStartIso)
          .lt("occurred_at", nextWeekIso)
          .gte("duration_seconds", CONNECTION_DURATION_THRESHOLD),
      ]);

      const teamTotal = teamTotalRes.count ?? 0;
      const caraTotal = caraTotalRes.count ?? 0;
      const legacyTotal = teamTotal + caraTotal;
      const teamConn = teamConnRes.count ?? 0;
      const caraConn = caraConnRes.count ?? 0;

      const teamConnRate = teamTotal > 0 ? Math.round((teamConn / teamTotal) * 100 * 10) / 10 : 0;
      const caraConnRate = caraTotal > 0 ? Math.round((caraConn / caraTotal) * 100 * 10) / 10 : 0;

      console.log(`calls team=${teamTotal} cara=${caraTotal} teamConn=${teamConn}(${teamConnRate}%) caraConn=${caraConn}(${caraConnRate}%)`);

      // Channel breakdown (Realtor/Broker/Wholesaler/Seller) — only computed
      // when actually requested, since it needs one GHL contact lookup per
      // distinct caller this week (see fetchContactChannel), unlike the plain
      // Supabase count above.
      const needsChannelBreakdown = callsMetrics.some((m: any) => {
        const k = (m.ghl_field_key as string).trim().toLowerCase();
        return CALLS_CHANNELS.some((ch) => k === `calls:total_week:${ch}` || k === `calls:connected_week:${ch}`);
      });

      const channelTotals: Record<string, number> = { realtor: 0, broker: 0, wholesaler: 0, seller: 0 };
      const channelConn: Record<string, number> = { realtor: 0, broker: 0, wholesaler: 0, seller: 0 };
      let channelBreakdownFailed = false;

      if (needsChannelBreakdown) {
        const { data: weekEvents, error: weekEventsErr } = await adminClient
          .from("orbit_call_events")
          .select("contact_id, duration_seconds")
          .gte("occurred_at", weekStartIso)
          .lt("occurred_at", nextWeekIso);

        if (weekEventsErr) {
          channelBreakdownFailed = true;
          for (const m of callsMetrics) {
            const k = (m.ghl_field_key as string).trim().toLowerCase();
            if (CALLS_CHANNELS.some((ch) => k === `calls:total_week:${ch}` || k === `calls:connected_week:${ch}`)) {
              errors.push({ metric_id: m.id, error: `orbit_call_events error: ${weekEventsErr.message}` });
            }
          }
        } else {
          const events = (weekEvents ?? []).filter((e: any) => !!e.contact_id);
          const contactIds = [...new Set(events.map((e: any) => e.contact_id as string))];
          console.log(`Channel breakdown: ${events.length} call events, ${contactIds.length} distinct contacts to classify`);

          const classified = await mapWithConcurrency(contactIds, 8, async (id: string) => ({
            id,
            channel: await fetchContactChannel(ghlApiKey, id),
          }));
          const channelByContact = new Map<string, string | null>(classified.map((c) => [c.id, c.channel]));

          for (const e of events) {
            const channel = channelByContact.get(e.contact_id as string);
            if (!channel) continue;
            channelTotals[channel] = (channelTotals[channel] ?? 0) + 1;
            if ((e.duration_seconds ?? 0) >= CONNECTION_DURATION_THRESHOLD) {
              channelConn[channel] = (channelConn[channel] ?? 0) + 1;
            }
          }
          console.log(`Channel totals: ${JSON.stringify(channelTotals)}, connected: ${JSON.stringify(channelConn)}`);
        }
      }

      for (const m of callsMetrics) {
        const key = (m.ghl_field_key as string).trim().toLowerCase();
        let value: number;

        const channelMatch = CALLS_CHANNELS.find((ch) => key === `calls:total_week:${ch}`);
        const connChannelMatch = CALLS_CHANNELS.find((ch) => key === `calls:connected_week:${ch}`);

        if (key === "calls:total_week:team") value = teamTotal;
        else if (key === "calls:total_week:cara") value = caraTotal;
        else if (key === "calls:total_week") value = legacyTotal;
        else if (key === "calls:connection_rate_week:team") value = teamConnRate;
        else if (key === "calls:connection_rate_week:cara") value = caraConnRate;
        else if (channelMatch) {
          if (channelBreakdownFailed) continue; // error already recorded above
          value = channelTotals[channelMatch] ?? 0;
        } else if (connChannelMatch) {
          if (channelBreakdownFailed) continue; // error already recorded above
          value = channelConn[connChannelMatch] ?? 0; // raw count, not a rate — see isCallsKey comment
        } else continue;

        const isTeamOrCaraKey = key === "calls:total_week:team" || key === "calls:total_week:cara" ||
          key === "calls:total_week" || key === "calls:connection_rate_week:team" || key === "calls:connection_rate_week:cara";
        if (isTeamOrCaraKey) {
          const errQuery = teamTotalRes.error || caraTotalRes.error || teamConnRes.error || caraConnRes.error;
          if (errQuery) {
            errors.push({ metric_id: m.id, error: `orbit_call_events error: ${errQuery.message}` });
            continue;
          }
        }

        const { error: insErr } = await adminClient.from("scorecard_entries").upsert(
          { metric_id: m.id, week_start_date: week, actual_value: value, entered_by: null, note: "Auto-synced from call events" },
          { onConflict: "metric_id,week_start_date" },
        );
        if (insErr) errors.push({ metric_id: m.id, error: insErr.message });
        else synced++;
      }
    }

    // ── 2. DISPO PIPELINE METRICS ─────────────────────────────────────────────

    const isDispoKey = (key: string) => key.trim().toLowerCase().startsWith("dispo:");
    const dispoMetrics = afterCallsNeeded.filter((m: any) => isDispoKey(m.ghl_field_key));
    const ghlNeeded = afterCallsNeeded.filter((m: any) => !isDispoKey(m.ghl_field_key));

    if (dispoMetrics.length > 0) {
      try {
        const dispoOpps = await fetchPipelineOpps(ghlApiKey, locationId, DISPO_PIPELINE_ID);
        console.log(`Dispo pipeline: ${dispoOpps.length} total opps fetched`);

        const wonOpps = dispoOpps.filter((o: any) => o.status === "won");
        const lostOpps = dispoOpps.filter((o: any) => o.status === "lost");
        const activeOpps = dispoOpps.filter((o: any) => o.status !== "won" && o.status !== "lost");
        const wonRevenue = wonOpps.reduce((s: number, o: any) => s + (o.monetaryValue || 0), 0);
        const winRate = (wonOpps.length + lostOpps.length) > 0
          ? Math.round((wonOpps.length / (wonOpps.length + lostOpps.length)) * 100 * 10) / 10
          : 0;

        console.log(`Dispo: won=${wonOpps.length} lost=${lostOpps.length} active=${activeOpps.length} revenue=$${wonRevenue} winRate=${winRate}%`);

        for (const m of dispoMetrics) {
          const key = (m.ghl_field_key as string).trim().toLowerCase();
          let value: number;

          if (key === "dispo:active") value = activeOpps.length;
          else if (key === "dispo:won_count") value = wonOpps.length;
          else if (key === "dispo:win_rate") value = winRate;
          else if (key === "dispo:revenue") value = wonRevenue;
          else {
            errors.push({ metric_id: m.id, error: `Unknown dispo key: ${key}` });
            continue;
          }

          const { error: insErr } = await adminClient.from("scorecard_entries").upsert(
            { metric_id: m.id, week_start_date: week, actual_value: value, entered_by: null, note: "Auto-synced from Dispo Active Deals pipeline" },
            { onConflict: "metric_id,week_start_date" },
          );
          if (insErr) errors.push({ metric_id: m.id, error: insErr.message });
          else synced++;
        }
      } catch (e: any) {
        for (const m of dispoMetrics) {
          errors.push({ metric_id: m.id, error: `Dispo pipeline fetch failed: ${e.message}` });
        }
      }
    }

    const isDealSentKey = (key: string) => key.trim().toLowerCase().startsWith("dealsent:");
    const dealSentMetrics = ghlNeeded.filter((m: any) => isDealSentKey(m.ghl_field_key));
    const remainingGhlNeeded = ghlNeeded.filter((m: any) => !isDealSentKey(m.ghl_field_key));

    if (!dealSentMetrics.length && !remainingGhlNeeded.length) {
      return json({ synced, skipped: metrics.length - needed.length, errors });
    }

    // ── 3. GHL PIPELINE METRICS ───────────────────────────────────────────────

    let pipelines: any[] = [];
    try {
      pipelines = await fetchPipelines(ghlApiKey, locationId);
      console.log(`Fetched ${pipelines.length} pipelines`);
    } catch (e: any) {
      return json({ synced, error: `Pipeline fetch failed: ${e.message}`, errors });
    }

    const oppsByPipelineId = new Map<string, any[]>();

    // ── 3a. DEAL-SENT METRICS (contact-tag join) ──────────────────────────────
    //
    // "Deals sent" isn't a pipeline stage — it's "did this source send us a
    // deal this week," measured by: a new opportunity created in Acq -
    // Portfolio Deals or Acq - SFR Deals this week whose GHL contact carries
    // the matching tag. Exact lowercase tag strings ("realtor" / "broker" /
    // "wholesaler") confirmed live via /contacts/search 2026-08-07. Scoped to
    // this week's new opps only (not all-time) because checking each opp's
    // contact tags costs one GHL API call per opp — weekly volume is small,
    // all-time would not be.
    if (dealSentMetrics.length > 0) {
      try {
        const dealSentPipelines = [resolvePipeline("portfolio", pipelines), resolvePipeline("sfr", pipelines)]
          .filter((p): p is any => !!p);

        if (!dealSentPipelines.length) {
          for (const m of dealSentMetrics) {
            errors.push({ metric_id: m.id, error: "Could not resolve Portfolio or SFR pipeline for dealsent join" });
          }
        } else {
          const newOppsThisWeek: any[] = [];
          for (const p of dealSentPipelines) {
            let opps = oppsByPipelineId.get(p.id);
            if (!opps) {
              opps = await fetchPipelineOpps(ghlApiKey, locationId, p.id);
              oppsByPipelineId.set(p.id, opps);
            }
            newOppsThisWeek.push(...opps.filter((o: any) => !!o.createdAt && new Date(o.createdAt) >= weekStart));
          }

          // Dedup contactIds so a contact with multiple new opps this week only costs 1 lookup
          const contactIds = [...new Set(newOppsThisWeek.map((o: any) => o.contactId).filter(Boolean))];
          const tagsByContactId = new Map<string, string[]>();

          for (const contactId of contactIds) {
            try {
              const res = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
                headers: { Authorization: `Bearer ${ghlApiKey}`, Version: "2021-07-28", Accept: "application/json" },
              });
              if (res.ok) {
                const data = await res.json();
                tagsByContactId.set(contactId, (data.contact?.tags ?? []).map((t: string) => t.toLowerCase()));
              }
            } catch { /* one contact lookup failing just undercounts, not fatal */ }
          }

          const countForTag = (tag: string) =>
            newOppsThisWeek.filter((o: any) => (tagsByContactId.get(o.contactId) ?? []).includes(tag)).length;

          console.log(`Deal-sent join: ${newOppsThisWeek.length} new opps this week across ${dealSentPipelines.map((p: any) => p.name).join(", ")}, ${contactIds.length} unique contacts checked`);

          for (const m of dealSentMetrics) {
            const key = (m.ghl_field_key as string).trim().toLowerCase();
            const tag = key.slice("dealsent:".length);
            const value = countForTag(tag);

            const { error: insErr } = await adminClient.from("scorecard_entries").upsert(
              { metric_id: m.id, week_start_date: week, actual_value: value, entered_by: null, note: "Auto-synced from GHL (contact tag join)" },
              { onConflict: "metric_id,week_start_date" },
            );
            if (insErr) errors.push({ metric_id: m.id, error: insErr.message });
            else synced++;
          }
        }
      } catch (e: any) {
        for (const m of dealSentMetrics) {
          errors.push({ metric_id: m.id, error: `Deal-sent join failed: ${e.message}` });
        }
      }
    }

    if (!remainingGhlNeeded.length) {
      return json({
        synced,
        skipped: metrics.length - needed.length,
        errors,
        pipelinesFound: pipelines.map((p: any) => p.name),
      });
    }

    const stageMetrics = remainingGhlNeeded.filter((m: any) => (m.ghl_field_key as string).includes(":stage:"));
    const batchMetrics = remainingGhlNeeded.filter((m: any) => !(m.ghl_field_key as string).includes(":stage:"));

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

    // Stage metrics
    for (const m of stageMetrics) {
      const key = (m.ghl_field_key as string).trim();
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
        let value: number;
        let fetchedOpps = oppsByPipelineId.get(pipeline.id);

        if (!fetchedOpps) {
          const checkParams = new URLSearchParams({
            location_id: locationId,
            pipeline_id: pipeline.id,
            limit: "1",
            page: "1",
          });
          const checkRes = await fetch(
            `https://services.leadconnectorhq.com/opportunities/search?${checkParams}`,
            { headers: { Authorization: `Bearer ${ghlApiKey}`, Version: "2021-07-28", Accept: "application/json" } },
          );
          const checkData = checkRes.ok ? await checkRes.json() : {};
          const pipelineTotal: number = checkData.meta?.total ?? 9999;

          if (pipelineTotal < 2900) {
            fetchedOpps = await fetchPipelineOpps(ghlApiKey, locationId, pipeline.id);
            oppsByPipelineId.set(pipeline.id, fetchedOpps);
            console.log(`Batch-fetched "${pipeline.name}": ${fetchedOpps.length} opps for stage filter`);
          }
        }

        // Terminal-outcome stages (won/closed/lost/dead/disqualified/rejected/failed)
        // hold opportunities whose `status` is no longer "open" — filtering to
        // open-only would always report 0 for these. Count by stage membership
        // alone for terminal stages; keep the open-only filter for active/mid-
        // funnel stages, since some opps retain a stale pipelineStageId after
        // being won/lost elsewhere and open-filtering avoids over-counting those.
        const isTerminalStage = /\b(won|closed|lost|dead|disqualified|rejected|failed)\b/i.test(stageName);

        if (fetchedOpps && fetchedOpps.length < 3000) {
          value = fetchedOpps.filter((o: any) =>
            o.pipelineStageId === stage.id && (isTerminalStage || (o.status ?? "open") === "open")
          ).length;
          console.log(`Stage "${stageName}" in "${pipeline.name}" (batch ${fetchedOpps.length} opps, terminal=${isTerminalStage}): ${value}`);
        } else {
          value = await fetchStageCount(ghlApiKey, locationId, pipeline.id, stage.id);
          console.log(`Stage "${stageName}" in "${pipeline.name}" (fetchStageCount large): ${value}`);
        }

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

    // Batch metrics
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
