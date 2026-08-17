// TeamRoleControl — sets profiles.role_key from Settings → Users.
//
// A person's role (Jr. Acquisitions, Closer, Underwriter, Dispo, TC, Ops,
// Investor Relations) controls which Team Hub Resources shelves they see.
// Door (DTS/DTA/DTB/DTW) is separate and still comes from Orbit membership,
// set right below this via OrbitMembershipControl — role picks the job, door
// only narrows which items on a Jr. Acq's shelves apply to them.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Loader2 } from "lucide-react";
import { toast } from "sonner";

const sb = supabase as any;

type Role = { key: string; label: string };

export function TeamRoleControl({ targetUserId }: { targetUserId: string }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleKey, setRoleKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [rolesRes, profRes] = await Promise.all([
        sb.from("team_roles").select("key, label").order("sort_order"),
        sb.from("profiles").select("role_key").eq("user_id", targetUserId).maybeSingle(),
      ]);
      if (cancelled) return;
      setRoles(rolesRes.data ?? []);
      setRoleKey(profRes.data?.role_key ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [targetUserId]);

  const changeRole = async (v: string) => {
    const next = v === "__none" ? null : v;
    setSaving(true);
    const { error } = await sb.from("profiles").update({ role_key: next }).eq("user_id", targetUserId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setRoleKey(next);
    toast.success("Role updated");
  };

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading role…
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-border/40 bg-card/30 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5" /> Role
          </p>
          <p className="text-[10px] text-muted-foreground">
            Their job (Jr. Acq, Closer, Underwriter…) — which Team Hub Resources shelves they see. Not the access
            level dropdown above, and not their OpsHQ department.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          <Select value={roleKey ?? "__none"} onValueChange={changeRole} disabled={saving}>
            <SelectTrigger className="h-7 text-xs w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">No role</SelectItem>
              {roles.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
