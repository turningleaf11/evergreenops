// OrbitMembershipControl — one-stop Orbit provisioning from Settings → Users.
//
// Consolidates what used to be three disjoint steps (set is_orbit_only, create
// an orbit_members row, pick a track) into a single toggle + track checklist.
// Turning "Orbit member" on enrolls the user in the Orbit program on a track
// AND flips is_orbit_only so they get the member workbook hub.
//
// A person can hold more than one track at once (e.g. Kez works DTA + DTB) —
// each checked track is its own orbit_members row. Unchecking a track doesn't
// delete its row (that would lose its checklist/strike history); it sets
// status to "removed" so re-checking later reactivates the same row instead
// of violating the (user_id, department_id, track) unique constraint.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { TRACK_OPTIONS, type OrbitTrack } from "@/components/orbit/orbit-types";
import { Loader2, Orbit } from "lucide-react";
import { toast } from "sonner";

const sb = supabase as any;

type TrackRow = { id: string; track: OrbitTrack; status: string };

export function OrbitMembershipControl({ targetUserId }: { targetUserId: string }) {
  const [loading, setLoading] = useState(true);
  const [savingTrack, setSavingTrack] = useState<OrbitTrack | null>(null);
  const [orbitOnly, setOrbitOnly] = useState(false);
  const [rows, setRows] = useState<TrackRow[]>([]);
  const [programDeptId, setProgramDeptId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [profRes, memRes, deptRes] = await Promise.all([
      sb.from("profiles").select("is_orbit_only").eq("user_id", targetUserId).maybeSingle(),
      sb.from("orbit_members").select("id, track, status").eq("user_id", targetUserId),
      sb.from("departments").select("id").eq("is_program", true).maybeSingle(),
    ]);
    setOrbitOnly(!!profRes.data?.is_orbit_only);
    setRows((memRes.data as TrackRow[]) ?? []);
    setProgramDeptId(deptRes.data?.id ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [targetUserId]);

  const activeTracks = rows.filter((r) => r.status === "active");

  const toggleOrbit = async (next: boolean) => {
    setSavingTrack(null);
    const { error } = await sb.from("profiles").update({ is_orbit_only: next }).eq("user_id", targetUserId);
    if (error) { toast.error(error.message); return; }
    setOrbitOnly(next);
    toast.success(next ? "Added to Orbit — member hub enabled" : "Removed from Orbit-only access");
  };

  const toggleTrack = async (track: OrbitTrack, checked: boolean) => {
    if (!programDeptId) { toast.error("No Orbit program department found"); return; }
    setSavingTrack(track);
    const existing = rows.find((r) => r.track === track);
    if (checked) {
      const { error } = existing
        ? await sb.from("orbit_members").update({ status: "active" }).eq("id", existing.id)
        : await sb.from("orbit_members").insert({ user_id: targetUserId, department_id: programDeptId, track, status: "active" });
      if (error) { toast.error(error.message); setSavingTrack(null); return; }
    } else if (existing) {
      const { error } = await sb.from("orbit_members").update({ status: "removed", removed_at: new Date().toISOString() }).eq("id", existing.id);
      if (error) { toast.error(error.message); setSavingTrack(null); return; }
    }
    await load();
    setSavingTrack(null);
    toast.success(checked ? `Added to ${track.toUpperCase()}` : `Removed from ${track.toUpperCase()}`);
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
            Enrolls them in the Orbit program and gives them the sales-only member hub. No internal ops.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch checked={orbitOnly} onCheckedChange={toggleOrbit} />
        </div>
      </div>

      {(orbitOnly || activeTracks.length > 0) && (
        <div className="pl-0.5 space-y-1.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Tracks {activeTracks.length > 1 && "(more than one — workbook shows a switcher)"}
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5">
            {TRACK_OPTIONS.map((t) => {
              const checked = activeTracks.some((r) => r.track === t.value);
              return (
                <label key={t.value} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Checkbox
                    checked={checked}
                    disabled={savingTrack === t.value}
                    onCheckedChange={(v) => toggleTrack(t.value, v === true)}
                  />
                  {t.label}
                  {savingTrack === t.value && <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground" />}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
