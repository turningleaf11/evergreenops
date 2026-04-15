import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export function useAddonEnabled(slug: string): boolean {
  const [enabled, setEnabled] = useState(false);
  const { id: workspaceId } = useWorkspace();

  useEffect(() => {
    if (!workspaceId) return;
    const check = async () => {
      const { data } = await supabase
        .from("workspace_addons")
        .select("id, addon_packs!inner(slug)")
        .eq("addon_packs.slug", slug)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      setEnabled(!!data);
    };
    check();
  }, [workspaceId, slug]);

  return enabled;
}

export function useAllAddons() {
  const { id: workspaceId } = useWorkspace();
  const [packs, setPacks] = useState<any[]>([]);
  const [enabledIds, setEnabledIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    if (!workspaceId) return;
    const [packsRes, enabledRes] = await Promise.all([
      supabase.from("addon_packs").select("*").eq("is_active", true).order("name"),
      supabase.from("workspace_addons").select("addon_id").eq("workspace_id", workspaceId),
    ]);
    if (packsRes.data) setPacks(packsRes.data);
    if (enabledRes.data) setEnabledIds(enabledRes.data.map((r: any) => r.addon_id));
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [workspaceId]);

  const toggle = async (addonId: string) => {
    if (!workspaceId) return;
    const isEnabled = enabledIds.includes(addonId);
    if (isEnabled) {
      await supabase.from("workspace_addons").delete().eq("workspace_id", workspaceId).eq("addon_id", addonId);
      setEnabledIds(prev => prev.filter(id => id !== addonId));
    } else {
      await supabase.from("workspace_addons").insert({ workspace_id: workspaceId, addon_id: addonId });
      setEnabledIds(prev => [...prev, addonId]);
    }
  };

  return { packs, enabledIds, loading, toggle, refetch: fetch };
}
