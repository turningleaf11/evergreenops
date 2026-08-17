// OrbitMembershipControl — one-stop Orbit provisioning from Settings → Users.
//
// Consolidates what used to be three disjoint steps (set is_orbit_only, create
// an orbit_members row, pick a track) into a single toggle + track selector.
// Turning "Orbit member" on enrolls the user in the Orbit program on a track
// AND flips is_orbit_only so they get the member workbook hub.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TRACK_OPTIONS, type OrbitTrack } from "@/components/orbit/orbit-types";
import { Loader2, Orbit } from "lucide-react";
import { toast } from "sonner";

const sb = supabase as any;

export function OrbitMembershipControl({ targetUserId }: { targetUserId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orbitOnly, setOrbitOnly] = useState(false);
  const [hasMember, setHasMember] = useState(false);
  const [track, setTrack] = useState<OrbitTrack>("dts");
  const [programDeptId, setProgramDeptId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [profRes, memRes, deptRes] = await Promise.all([
        sb.from("profiles").select("is_orbit_only").eq("user_id", targetUserId).maybeSingle(),
        sb.from("orbit_members").select("track, status").eq("user_id", targetUserId).maybeSingle(),
        sb.from("departments").select("id").eq("is_program", true).maybeSingle(),
      ]);
      if (cancelled) return;
      setOrbitOnly(!!profRes.data?.is_orbit_only);
      if (memRes.data) { setHasMember(true); setTrack((memRes.data.track as OrbitTrack) ?? "dts"); }
      setProgramDeptId(deptRes.data?.id ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [targetUserId]);

  // Upsert the orbit_members row without relying on a DB unique constraint.
  const persistMembership = async (nextTrack: OrbitTrack): Promise<boolean> => {
    if (!programDeptId) { toast.error("No Orbit program department found"); return false; }
    if (hasMember) {
      const { error } = await sb.from("orbit_members")
        .update({ track: nextTrack, status: "active", department_id: programDeptId })
        .eq("user_id", targetUserId);
      if (error) { toast.error(error.message); return false; }
    } else {
      const { error } = await sb.from("orbit_members")
        .insert({ user_id: targetUserId, department_id: programDeptId, track: nextTrack, status: "active" });
      if (error) { toast.error(error.message); return false; }
      setHasMember(true);
    }
    return true;
  };

  const toggleOrbit = async (next: boolean) => {
    setSaving(true);
    if (next && !(await persistMembership(track))) { setSaving(false); return; }
    const { error } = await sb.from("profiles").update({ is_orbit_only: next }).eq("user_id", targetUserId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setOrbitOnly(next);
    toast.success(next ? "Added to Orbit — member hub enabled" : "Removed from Orbit-only access");
  };

  const changeTrack = async (v: string) => {
    const next = v as OrbitTrack;
    setTrack(next);
    setSaving(true);
    const ok = await persistMembership(next);
    setSaving(false);
    if (ok) toast.success("Track updated");
  };

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading Orbit status…
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-border/40 bg-card/30 px-3 py-2.5 space-y-2.5">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Orbit className="h-3.5 w-3.5" /> Orbit member
          </p>
          <p className="text-[10px] text-muted-foreground">
            Enrolls them in the Orbit program on a track and gives them the sales-only member hub. No internal ops.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          <Switch checked={orbitOnly} onCheckedChange={toggleOrbit} disabled={saving} />
        </div>
      </div>

      {orbitOnly && (
        <div className="flex items-center gap-2 pl-0.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Track</span>
          <Select value={track} onValueChange={changeTrack} disabled={saving}>
            <SelectTrigger className="h-7 text-xs w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRACK_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
