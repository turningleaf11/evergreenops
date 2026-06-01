// useDeptTemplate — fetches the configurable template that governs how a
// department behaves (what shows in "My queue", what Albus weighs for
// "Today's focus", what counts as "Stuck", what KPIs default into Performance).
//
// Templates are system-shipped or workspace-custom. The dept page STRUCTURE
// stays universal across all templates; only the *rules inside the blocks*
// change. Adding a new template type = no UI code change.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type DeptTemplateId =
  | "generic"
  | "sales"
  | "operations"
  | "engineering"
  | "creative"
  | "customer_success"
  | "portfolio"
  | string; // custom workspace templates

export interface DeptTemplateConfig {
  /** Which entity types feed the "My queue" block on Overview. */
  queue_sources: string[];
  /** What Albus weighs when synthesizing the "Today's focus" block. */
  focus_inputs: string[];
  /** What patterns flag an item as "Stuck / Needs decision". */
  stuck_rules: Array<{ type: string; days?: number }>;
  /** KPI metrics shown in the Performance tab by default. */
  kpi_defaults: string[];
  /** Available views in the Work tab (list, kanban, pipeline, calendar). */
  work_views: string[];
}

export interface DeptTemplate {
  id: DeptTemplateId;
  name: string;
  description: string | null;
  is_system: boolean;
  config: DeptTemplateConfig;
}

const DEFAULT_CONFIG: DeptTemplateConfig = {
  queue_sources: ["tasks", "projects"],
  focus_inputs: ["goals", "tasks", "projects", "activity"],
  stuck_rules: [{ type: "task_overdue", days: 3 }],
  kpi_defaults: ["task_completion_rate"],
  work_views: ["list", "kanban"],
};

/**
 * Look up the template for a given department.
 * Returns `null` while loading; falls back to a synthetic 'generic' template
 * if the dept has no template_id set or the lookup fails.
 */
export function useDeptTemplate(departmentId: string | undefined | null) {
  const [template, setTemplate] = useState<DeptTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!departmentId) { setLoading(false); return; }
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Resolve dept.template_id -> dept_templates row.
        const { data: dept } = await sb
          .from("departments")
          .select("template_id")
          .eq("id", departmentId)
          .maybeSingle();

        const tplId = (dept?.template_id as string) || "generic";

        const { data: tpl } = await sb
          .from("dept_templates")
          .select("id, name, description, is_system, config")
          .eq("id", tplId)
          .maybeSingle();

        if (cancelled) return;

        if (tpl) {
          setTemplate({
            id: tpl.id,
            name: tpl.name,
            description: tpl.description,
            is_system: !!tpl.is_system,
            config: { ...DEFAULT_CONFIG, ...(tpl.config || {}) },
          });
        } else {
          // Template row missing (e.g. migration not applied) — synthesize generic.
          setTemplate({
            id: "generic",
            name: "Generic",
            description: null,
            is_system: true,
            config: DEFAULT_CONFIG,
          });
        }
      } catch (e) {
        if (!cancelled) {
          console.warn("[useDeptTemplate] lookup failed, using generic fallback:", e);
          setTemplate({
            id: "generic",
            name: "Generic",
            description: null,
            is_system: true,
            config: DEFAULT_CONFIG,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [departmentId]);

  return { template, loading };
}
