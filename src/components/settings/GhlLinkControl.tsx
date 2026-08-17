// GhlLinkControl — links a person to their GHL user account from Settings →
// Users. Lives here (not buried in Orbit's member drawer) because it's a
// fact about the person, not about their Orbit enrollment — profiles.ghl_user_id
// survives graduating, being removed from Orbit, or never having joined at all.
// orbit-sync-performance reads this to pull weekly calls/appts/deals for
// anyone with an active Orbit membership and a link set here.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GhlUserPicker } from "@/components/orbit/GhlUserPicker";
import { Link2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const sb = supabase as any;

export function GhlLinkControl({ targetUserId }: { targetUserId: string }) {
  const [loading, setLoading] = useState(true);
  const [ghlUserId, setGhlUserId] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await sb.from("profiles").select("ghl_user_id, ghl_synced_at").eq("user_id", targetUserId).maybeSingle();
      if (cancelled) return;
      setGhlUserId(data?.ghl_user_id ?? null);
      setSyncedAt(data?.ghl_synced_at ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [targetUserId]);

  const changeLink = async (next: string | null) => {
    const { error } = await sb.from("profiles").update({ ghl_user_id: next }).eq("user_id", targetUserId);
    if (error) { toast.error(error.message); return; }
    setGhlUserId(next);
  };

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading GHL link…
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-border/40 bg-card/30 px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" /> GHL account
          </p>
          <p className="text-[10px] text-muted-foreground">
            Which GHL user this person is. Enables auto-sync of Orbit performance (appts, deals) if they're on a track.
          </p>
        </div>
        {syncedAt && (
          <span className="text-[10px] text-muted-foreground/60 shrink-0">
            synced {format(new Date(syncedAt), "MMM d")}
          </span>
        )}
      </div>
      <GhlUserPicker currentGhlUserId={ghlUserId} onChange={changeLink} compact />
    </div>
  );
}
