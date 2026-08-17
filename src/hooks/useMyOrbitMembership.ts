import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { OrbitMember, OrbitPerformance, OrbitStrike, OrbitChecklistItem } from "@/components/orbit/orbit-types";

const sb = supabase as any;

export interface MyOrbitData {
  /** Primary track membership (earliest track_started_at) — unchanged shape for
   *  existing single-track consumers (MyOrbitWidget, ProgramOverview admin preview). */
  member: OrbitMember | null;
  /** Every track membership this person holds (any status), for track switchers —
   *  someone can now be active on more than one track at once (e.g. DTA + DTB). */
  members: OrbitMember[];
  /** Primary member's recent performance/strikes/checklist. */
  recentPerformance: OrbitPerformance[];
  strikes: OrbitStrike[];
  checklist: OrbitChecklistItem[];
}

const EMPTY: MyOrbitData = { member: null, members: [], recentPerformance: [], strikes: [], checklist: [] };

/**
 * Returns the current user's Orbit Program membership(s) (if any) plus the
 * primary track's recent performance snapshots and strikes. Used by the My
 * Orbit home widget and to auto-filter the Curriculum to the user's track.
 */
export function useMyOrbitMembership() {
  const { user } = useAuth();
  const [data, setData] = useState<MyOrbitData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setData(EMPTY); setLoading(false); return; }
    setLoading(true);
    const { data: rows } = await sb
      .from("orbit_members")
      .select("*")
      .eq("user_id", user.id)
      .order("track_started_at", { ascending: true });

    const members = (rows ?? []) as OrbitMember[];
    const primary = members[0] ?? null;

    if (!primary) {
      setData(EMPTY);
      setLoading(false);
      return;
    }

    const [perfRes, strikesRes, checklistRes] = await Promise.all([
      sb.from("orbit_performance_snapshots").select("*").eq("member_id", primary.id).order("snapshot_date", { ascending: false }).limit(6),
      sb.from("orbit_strikes").select("*").eq("member_id", primary.id).order("strike_number", { ascending: true }),
      sb.from("orbit_setup_checklist").select("*").eq("member_id", primary.id).order("sort_order"),
    ]);

    setData({
      member: primary,
      members,
      recentPerformance: (perfRes.data ?? []) as OrbitPerformance[],
      strikes: (strikesRes.data ?? []) as OrbitStrike[],
      checklist: (checklistRes.data ?? []) as OrbitChecklistItem[],
    });
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return { ...data, loading, refresh: load };
}
