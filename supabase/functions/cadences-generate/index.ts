// Generates tasks for active cadences whose next due date is today or tomorrow.
// Idempotent via cadence_runs UNIQUE(cadence_id, due_date).
// Designed to be called nightly via pg_cron, or manually for testing.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Cadence {
  id: string;
  workspace_id: string | null;
  title: string;
  owner_id: string | null;
  schedule_type: string;
  schedule_config: any;
  task_template: any;
  is_active: boolean;
}

const computeNextDue = (c: Cadence, from: Date): Date => {
  const base = new Date(from);
  base.setHours(0, 0, 0, 0);
  if (c.schedule_type === "daily") return base;
  if (c.schedule_type === "weekly") {
    const target = c.schedule_config?.day_of_week ?? 1;
    const diff = (target - base.getDay() + 7) % 7;
    return new Date(base.getTime() + diff * 86400000);
  }
  if (c.schedule_type === "monthly") {
    const day = c.schedule_config?.day_of_month ?? 1;
    const next = new Date(base.getFullYear(), base.getMonth(), day);
    if (next < base) next.setMonth(next.getMonth() + 1);
    return next;
  }
  return base;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: cadences, error } = await supabase
    .from("cadences")
    .select("*")
    .eq("is_active", true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const today = new Date();
  const horizon = new Date(today.getTime() + 86400000); // generate today + tomorrow
  let generated = 0;
  let skipped = 0;

  for (const c of (cadences || []) as Cadence[]) {
    const nextDue = computeNextDue(c, today);
    if (nextDue > horizon) { skipped++; continue; }
    const dueDateStr = nextDue.toISOString().split("T")[0];

    // Skip if a run already exists
    const { data: existing } = await supabase
      .from("cadence_runs")
      .select("id")
      .eq("cadence_id", c.id)
      .eq("due_date", dueDateStr)
      .maybeSingle();
    if (existing) { skipped++; continue; }

    // Create the task
    const tpl = c.task_template || {};
    const { data: task, error: taskErr } = await supabase
      .from("tasks")
      .insert({
        title: tpl.title || c.title,
        description: `Cadence: ${c.title}`,
        assigned_to: c.owner_id,
        created_by: c.owner_id,
        status: "todo",
        priority: tpl.priority || "medium",
        due_date: dueDateStr,
        tags: [`cadence:${c.id}`, ...(tpl.tags || [])],
        workspace_id: c.workspace_id,
      })
      .select()
      .single();

    if (taskErr) { console.error("Task insert failed", taskErr); continue; }

    await supabase.from("cadence_runs").insert({
      cadence_id: c.id,
      generated_task_id: task.id,
      due_date: dueDateStr,
      status: "pending",
    });
    generated++;
  }

  return new Response(JSON.stringify({ generated, skipped, cadences_checked: cadences?.length ?? 0 }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
