import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

// Compute Monday of the given date as YYYY-MM-DD
function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

async function fetchGhlOpportunities(apiKey: string) {
  const res = await fetch("https://services.leadconnectorhq.com/opportunities/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
    body: JSON.stringify({ limit: 100 }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GHL API ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.opportunities || [];
}

function valueForFieldKey(opportunities: any[], key: string): number {
  const k = (key || "").toLowerCase().trim();
  const weekStart = new Date(mondayOf(new Date()));
  const inWeek = (iso: string | null | undefined) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d >= weekStart;
  };

  switch (k) {
    case "pipeline_value":
      return opportunities.reduce((s, o) => s + (o.monetaryValue || 0), 0);
    case "opportunities_count":
    case "leads":
    case "leads_count":
    case "new_contacts":
      return opportunities.filter((o) => inWeek(o.createdAt || o.dateAdded)).length;
    case "opportunities_won":
    case "deals_won":
    case "deals_closed":
      return opportunities.filter((o) => o.status === "won" && inWeek(o.updatedAt || o.lastStatusChangeAt)).length;
    case "opportunities_lost":
    case "deals_lost":
      return opportunities.filter((o) => o.status === "lost" && inWeek(o.updatedAt || o.lastStatusChangeAt)).length;
    case "opportunities_open":
      return opportunities.filter((o) => (o.status || "open") === "open").length;
    case "revenue":
    case "revenue_won":
    case "assignment_fees":
      return opportunities
        .filter((o) => o.status === "won" && inWeek(o.updatedAt || o.lastStatusChangeAt))
        .reduce((s, o) => s + (o.monetaryValue || 0), 0);
    default:
      return 0;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ghlApiKey = Deno.env.get("GHL_API_KEY");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const week = mondayOf(new Date());

    // Fetch active GHL-sourced metrics
    const { data: metrics, error: mErr } = await adminClient
      .from("scorecard_metrics")
      .select("id, ghl_field_key, weekly_target")
      .eq("is_active", true)
      .eq("data_source", "ghl");

    if (mErr) throw mErr;
    if (!metrics || metrics.length === 0) {
      return new Response(JSON.stringify({ synced: 0, skipped: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find which metrics are missing an entry this week
    const ids = metrics.map((m) => m.id);
    const { data: existing } = await adminClient
      .from("scorecard_entries")
      .select("metric_id")
      .in("metric_id", ids)
      .eq("week_start_date", week);

    const have = new Set((existing || []).map((e: any) => e.metric_id));
    const needed = metrics.filter((m) => !have.has(m.id) && m.ghl_field_key);

    if (needed.length === 0) {
      return new Response(JSON.stringify({ synced: 0, skipped: metrics.length, errors: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ghlApiKey) {
      return new Response(
        JSON.stringify({ synced: 0, skipped: 0, errors: needed.map((m) => ({ metric_id: m.id, error: "GHL_API_KEY not configured" })) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let opportunities: any[] = [];
    const errors: { metric_id: string; error: string }[] = [];
    try {
      opportunities = await fetchGhlOpportunities(ghlApiKey);
    } catch (e: any) {
      // Mark all needed as errored, return without inserting
      for (const m of needed) errors.push({ metric_id: m.id, error: e.message });
      return new Response(JSON.stringify({ synced: 0, skipped: 0, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let synced = 0;
    for (const m of needed) {
      try {
        const value = valueForFieldKey(opportunities, m.ghl_field_key!);
        const { error: insErr } = await adminClient.from("scorecard_entries").insert({
          metric_id: m.id,
          week_start_date: week,
          actual_value: value,
          entered_by: null,
          note: "Auto-synced from GHL",
        });
        if (insErr) {
          errors.push({ metric_id: m.id, error: insErr.message });
        } else {
          synced++;
        }
      } catch (e: any) {
        errors.push({ metric_id: m.id, error: e.message });
      }
    }

    return new Response(JSON.stringify({ synced, skipped: metrics.length - needed.length, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("scorecard-ghl-sync error:", err);
    return new Response(JSON.stringify({ error: err.message, synced: 0, errors: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
