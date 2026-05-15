import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { OrbitMember, OrbitPerformance, OrbitStrike } from "@/components/orbit/orbit-types";

const sb = supabase as any;

export interface MyOrbitData {
  member: OrbitMember | null;
  recentPerformance: OrbitPerformance[];
  strikes: OrbitStrike[];
}

/**
 * Returns the current user's Orbit Program membership (if any) plus their
 * recent performance snapshots and strikes. Used by the My Orbit home widget
 * and to auto-filter the Curriculum to the user's track.
 */
export function useMyOrbitMembership() {
  const { user } = useAuth();
  const [data, setData] = useState<MyOrbitData>({ member: null, recentPerformance: [], strikes: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setData({ member: null, recentPerformance: [], strikes: [] }); setLoading(false); return; }
    setLoading(true);
    const { data: m } = await sb
      .from("orbit_members")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!m) {
      setData({ member: null, recentPerformance: [], strikes: [] });
      setLoading(false);
      return;
    }

    const [perfRes, strikesRes] = await Promise.all([
      sb.from("orbit_performance_snapshots").select("*").eq("member_id", m.id).order("snapshot_date", { ascending: false }).limit(6),
      sb.from("orbit_strikes").select("*").eq("member_id", m.id).order("strike_number", { ascending: true }),
    ]);

    setData({
      member: m as OrbitMember,
      recentPerformance: (perfRes.data ?? []) as OrbitPerformance[],
      strikes: (strikesRes.data ?? []) as OrbitStrike[],
    });
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return { ...data, loading, refresh: load };
}
