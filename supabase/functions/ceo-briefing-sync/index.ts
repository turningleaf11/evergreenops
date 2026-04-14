import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ghlApiKey = Deno.env.get("GHL_API_KEY");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get user's briefing config
    const { data: configRow } = await adminClient
      .from("ceo_briefing_config")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const config = (configRow as any)?.config || { ghl_enabled: false, database_ids: [], ghl_kpis: [] };

    const result: any = { ghl_kpis: {}, database_kpis: [] };

    // --- GHL KPIs ---
    if (config.ghl_enabled && ghlApiKey) {
      try {
        // Fetch opportunities from GHL
        const oppRes = await fetch("https://services.leadconnectorhq.com/opportunities/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ghlApiKey}`,
            "Content-Type": "application/json",
            Version: "2021-07-28",
          },
          body: JSON.stringify({ limit: 100 }),
        });

        if (oppRes.ok) {
          const oppData = await oppRes.json();
          const opportunities = oppData.opportunities || [];

          // Aggregate KPIs
          const totalPipelineValue = opportunities.reduce((sum: number, o: any) => sum + (o.monetaryValue || 0), 0);
          const byStatus: Record<string, number> = {};
          for (const o of opportunities) {
            const status = o.status || "open";
            byStatus[status] = (byStatus[status] || 0) + 1;
          }

          result.ghl_kpis = {
            pipeline_value: totalPipelineValue,
            opportunities_count: opportunities.length,
            opportunities_won: byStatus["won"] || 0,
            opportunities_lost: byStatus["lost"] || 0,
            opportunities_open: byStatus["open"] || 0,
            by_status: byStatus,
          };
        } else {
          const errText = await oppRes.text();
          console.error("GHL API error:", oppRes.status, errText);
          result.ghl_error = `GHL API returned ${oppRes.status}`;
        }
      } catch (ghlErr: any) {
        console.error("GHL fetch error:", ghlErr);
        result.ghl_error = ghlErr.message;
      }
    }

    // --- Internal Database KPIs ---
    if (config.database_ids && config.database_ids.length > 0) {
      for (const dbId of config.database_ids) {
        // Get database meta for column info
        const { data: dbMeta } = await adminClient
          .from("databases_meta")
          .select("id, title, columns")
          .eq("id", dbId)
          .single();

        if (!dbMeta) continue;

        // Get row count and status distribution
        const { data: rows, count } = await adminClient
          .from("database_rows")
          .select("values", { count: "exact" })
          .eq("database_id", dbId)
          .limit(1000);

        const columns = (dbMeta as any).columns as any[];
        const statusCol = columns?.find((c: any) => c.type === "status" || c.type === "select");

        let statusDistribution: Record<string, number> = {};
        if (statusCol && rows) {
          for (const row of rows) {
            const val = (row.values as any)?.[statusCol.id] || "—";
            statusDistribution[val] = (statusDistribution[val] || 0) + 1;
          }
        }

        // Check for currency columns for totals
        const currencyCol = columns?.find((c: any) => c.type === "currency" || c.type === "number");
        let total = 0;
        if (currencyCol && rows) {
          for (const row of rows) {
            const val = parseFloat((row.values as any)?.[currencyCol.id]) || 0;
            total += val;
          }
        }

        result.database_kpis.push({
          database_id: dbId,
          title: (dbMeta as any).title,
          total_rows: count || 0,
          status_distribution: statusDistribution,
          currency_total: currencyCol ? { column: currencyCol.name, total } : null,
        });
      }
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("ceo-briefing-sync error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
