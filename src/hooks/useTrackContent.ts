// useTrackContent — returns the active TrackContent for a track, preferring
// the per-workspace DB override (orbit_track_content) and falling back to the
// hardcoded TRACK_CONTENT defaults from orbit-types.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TRACK_CONTENT, type OrbitTrack, type TrackContent } from "@/components/orbit/orbit-types";

const sb = supabase as any;

export function useTrackContent(track: OrbitTrack) {
  const { profile, isAdmin } = useAuth();
  const workspaceId = profile?.workspace_id ?? null;
  const baseline = TRACK_CONTENT[track];
  const [override, setOverride] = useState<Partial<TrackContent> | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoaded(false);
    try {
      let q = sb.from("orbit_track_content").select("*").eq("track", track);
      if (workspaceId) q = q.eq("workspace_id", workspaceId);
      const { data } = await q.maybeSingle();
      if (data) {
        setOverride({
          full_name:        data.full_name ?? undefined,
          tagline:          data.tagline ?? undefined,
          what_it_is:       data.what_it_is ?? undefined,
          kpis:             Array.isArray(data.kpis) ? data.kpis : undefined,
          daily_flow:       Array.isArray(data.daily_flow) ? data.daily_flow : undefined,
          success_criteria: Array.isArray(data.success_criteria) ? data.success_criteria : undefined,
          getting_started:  Array.isArray(data.getting_started) ? data.getting_started : undefined,
        });
      } else {
        setOverride(null);
      }
    } catch {
      // Table not present yet (migration not applied) — fall back to baseline.
      setOverride(null);
    } finally {
      setLoaded(true);
    }
  }, [track, workspaceId]);

  useEffect(() => { load(); }, [load]);

  const merged: TrackContent = {
    ...baseline,
    ...(override?.full_name        !== undefined && { full_name: override.full_name }),
    ...(override?.tagline          !== undefined && { tagline: override.tagline }),
    ...(override?.what_it_is       !== undefined && { what_it_is: override.what_it_is }),
    ...(override?.kpis             !== undefined && { kpis: override.kpis as TrackContent["kpis"] }),
    ...(override?.daily_flow       !== undefined && { daily_flow: override.daily_flow as TrackContent["daily_flow"] }),
    ...(override?.success_criteria !== undefined && { success_criteria: override.success_criteria as TrackContent["success_criteria"] }),
    ...(override?.getting_started  !== undefined && { getting_started: override.getting_started as TrackContent["getting_started"] }),
  };

  const save = useCallback(async (next: Partial<TrackContent>) => {
    if (!isAdmin) throw new Error("Admin only");
    const payload: any = {
      workspace_id: workspaceId,
      track,
      ...(next.full_name        !== undefined && { full_name: next.full_name }),
      ...(next.tagline          !== undefined && { tagline: next.tagline }),
      ...(next.what_it_is       !== undefined && { what_it_is: next.what_it_is }),
      ...(next.kpis             !== undefined && { kpis: next.kpis }),
      ...(next.daily_flow       !== undefined && { daily_flow: next.daily_flow }),
      ...(next.success_criteria !== undefined && { success_criteria: next.success_criteria }),
      ...(next.getting_started  !== undefined && { getting_started: next.getting_started }),
    };
    const { error } = await sb.from("orbit_track_content").upsert(payload, { onConflict: "workspace_id,track" });
    if (error) throw error;
    await load();
  }, [isAdmin, workspaceId, track, load]);

  const resetToDefault = useCallback(async () => {
    if (!isAdmin) return;
    if (workspaceId) {
      await sb.from("orbit_track_content").delete().eq("workspace_id", workspaceId).eq("track", track);
    } else {
      await sb.from("orbit_track_content").delete().is("workspace_id", null).eq("track", track);
    }
    await load();
  }, [isAdmin, workspaceId, track, load]);

  return { content: merged, hasOverride: override !== null, loaded, save, resetToDefault, refresh: load };
}
