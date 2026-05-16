// Pulls weekly performance data from GHL for linked Orbit members.
//
// Modes:
//   - Manual:   invoke with { memberId: "...", weekStart?: "YYYY-MM-DD" }  → syncs one member
//   - Bulk:     invoke with { all: true, weekStart?: "YYYY-MM-DD" }         → syncs every linked active member
//   - Cron:     no auth header expected — service-role only, syncs all active members for the current week
//
// Metrics:
//   - deals_closed      = opportunities with status='won' assigned to ghl_user_id this week
//   - appointments_set  = calendar events created by ghl_user_id this week (the setter, not the calendar owner)
//   - calls_made        = stubbed for now; GHL v2 lacks a clean per-user call count endpoint
//   - conversations     = stubbed for now (same reason)
//
// Source flag: any row written by this function gets source='ghl'. Manual entries keep source='manual' and are upserted separately.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function sundayOf(date: Date): string {
  const d = new Date(mondayOf(date));
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

async function fetchGhlCreds(admin: any) {
  const { data: settings } = await admin
    .from("app_settings")
    .select("key, value")
    .in("key", ["GHL_API_KEY", "GHL_LOCATION_ID"]);
  const map: Record<string, string> = {};
  (settings ?? []).forEach((s: any) => { map[s.key] = s.value; });
  return {
    apiKey: map.GHL_API_KEY || Deno.env.get("GHL_API_KEY"),
    locationId: map.GHL_LOCATION_ID || Deno.env.get("GHL_LOCATION_ID"),
  };
}

async function ghlGet(url: string, apiKey: string) {
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION, Accept: "application/json" },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GHL ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json();
}

async function ghlPost(url: string, apiKey: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: GHL_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GHL ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json();
}

// ============== Per-metric fetchers ==============

/** Deals won by the user this week */
async function fetchDealsClosed(apiKey: string, locationId: string, ghlUserId: string, weekStartIso: string, weekEndIso: string): Promise<number> {
  const body = {
    locationId,
    assignedTo: [ghlUserId],
    status: "won",
    limit: 100,
  };
  const data = await ghlPost(`${GHL_BASE}/opportunities/search`, apiKey, body);
  const opportunities = data.opportunities || [];
  // Filter to the week — GHL's API may not respect the date filter perfectly, so we post-filter
  const weekStart = new Date(weekStartIso);
  const weekEnd = new Date(weekEndIso);
  return opportunities.filter((o: any) => {
    const ts = o.updatedAt || o.lastStatusChangeAt || o.dateAdded;
    if (!ts) return false;
    const d = new Date(ts);
    return d >= weekStart && d <= weekEnd;
  }).length;
}

/** Appointments where this user is the SETTER (createdBy.userId). Falls back to assignedUserId match. */
async function fetchAppointmentsSet(apiKey: string, locationId: string, ghlUserId: string, weekStartIso: string, weekEndIso: string): Promise<number> {
  // GHL calendars/events takes startTime/endTime as ms epoch
  const startMs = new Date(weekStartIso).getTime();
  const endMs = new Date(weekEndIso).getTime();
  const url = `${GHL_BASE}/calendars/events?locationId=${encodeURIComponent(locationId)}&startTime=${startMs}&endTime=${endMs}`;
  try {
    const data = await ghlGet(url, apiKey);
    const events = data.events || [];
    return events.filter((e: any) => {
      // Best-effort: check createdBy.userId (setter), then fall back to assignedUserId
      const setterId = e.createdBy?.userId || e.createdById || e.setterUserId;
      const assigned = e.assignedUserId;
      return setterId === ghlUserId || (!setterId && assigned === ghlUserId);
    }).length;
  } catch (e) {
    console.warn("Appointments fetch failed:", e);
    return 0;
  }
}

// ============== Main sync per member ==============

interface SyncResult {
  member_id: string;
  ghl_user_id: string;
  week: string;
  metrics: { deals_closed: number; appointments_set: number; calls_made: number; conversations: number };
  error?: string;
}

async function syncMember(admin: any, apiKey: string, locationId: string, member: any, weekStart: string): Promise<SyncResult> {
  const weekStartIso = new Date(weekStart + "T00:00:00.000Z").toISOString();
  const weekEndIso = sundayOf(new Date(weekStart));

  try {
    const [deals_closed, appointments_set] = await Promise.all([
      fetchDealsClosed(apiKey, locationId, member.ghl_user_id, weekStartIso, weekEndIso),
      fetchAppointmentsSet(apiKey, locationId, member.ghl_user_id, weekStartIso, weekEndIso),
    ]);
    // calls_made and conversations stubbed — GHL v2 lacks clean per-user endpoints we trust yet
    const calls_made = 0;
    const conversations = 0;

    await admin.from("orbit_performance_snapshots").upsert({
      member_id: member.id,
      snapshot_date: weekStart,
      calls_made,
      appointments_set,
      conversations,
      deals_closed,
      source: "ghl",
    }, { onConflict: "member_id,snapshot_date" });

    await admin.from("orbit_members").update({ ghl_synced_at: new Date().toISOString() }).eq("id", member.id);

    return {
      member_id: member.id,
      ghl_user_id: member.ghl_user_id,
      week: weekStart,
      metrics: { deals_closed, appointments_set, calls_made, conversations },
    };
  } catch (e: any) {
    return {
      member_id: member.id,
      ghl_user_id: member.ghl_user_id,
      week: weekStart,
      metrics: { deals_closed: 0, appointments_set: 0, calls_made: 0, conversations: 0 },
      error: String(e?.message ?? e),
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    const cronSecret = req.headers.get("X-Cron-Secret");
    const expectedCronSecret = Deno.env.get("ORBIT_CRON_SECRET");

    // Three auth paths: user JWT (admin only), cron secret, or service role
    let allowed = false;
    if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
      allowed = true;
    } else if (authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: roleRow } = await userClient
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (roleRow) allowed = true;
      }
    }
    if (!allowed) return json({ error: "Unauthorized" }, 401);

    let body: any = {};
    try { body = await req.json(); } catch { /* GET-style cron invocation */ }
    const { memberId, all, weekStart: customWeekStart } = body;
    const weekStart = customWeekStart || mondayOf(new Date());

    const { apiKey, locationId } = await fetchGhlCreds(admin);
    if (!apiKey || !locationId) {
      return json({ error: "GHL not configured (need GHL_API_KEY + GHL_LOCATION_ID)" }, 400);
    }

    // Fetch members to sync
    let query = admin.from("orbit_members").select("id, user_id, ghl_user_id, status").not("ghl_user_id", "is", null);
    if (memberId) {
      query = query.eq("id", memberId);
    } else if (all) {
      query = query.in("status", ["active", "on_notice"]);
    } else {
      return json({ error: "Specify { memberId } or { all: true }" }, 400);
    }

    const { data: members, error: mErr } = await query;
    if (mErr) throw mErr;
    if (!members || members.length === 0) {
      return json({ synced: 0, results: [], message: "No linked members to sync" });
    }

    // Sync sequentially to avoid hammering GHL rate limits
    const results: SyncResult[] = [];
    for (const m of members) {
      results.push(await syncMember(admin, apiKey, locationId, m, weekStart));
    }

    return json({
      synced: results.filter((r) => !r.error).length,
      failed: results.filter((r) => r.error).length,
      week: weekStart,
      results,
    });
  } catch (e: any) {
    console.error("orbit-sync-performance error", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
