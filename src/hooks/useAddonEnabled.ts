import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export function useAddonEnabled(slug: string): boolean {
  const [enabled, setEnabled] = useState(false);
  const { id: workspaceId } = useWorkspace();

  useEffect(() => {
    if (!workspaceId) return;
    const check = async () => {
      const { data: pack } = await supabase
        .from("addon_packs")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!pack) return;
      const { data } = await supabase
        .from("workspace_addons")
        .select("id")
        .eq("addon_id", pack.id)
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

  // Packs are global — load immediately, no workspace needed
  useEffect(() => {
    const loadPacks = async () => {
      const { data } = await supabase
        .from("addon_packs")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (data) setPacks(data);
      setLoading(false);
    };
    loadPacks();
  }, []);

  // Enabled state is per-workspace
  useEffect(() => {
    if (!workspaceId) return;
    const loadEnabled = async () => {
      const { data } = await supabase
        .from("workspace_addons")
        .select("addon_id")
        .eq("workspace_id", workspaceId);
      if (data) setEnabledIds(data.map((r) => r.addon_id));
    };
    loadEnabled();
  }, [workspaceId]);

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

  return { packs, enabledIds, loading, toggle };
}
