import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Wrapper that redirects the primary admin into the Vision Setup flow if:
 *   - they haven't skipped or completed onboarding
 *   - the workspace was created less than 24h ago
 *   - the vision table has no real content
 *
 * For everyone else (or once any of those conditions fails), renders children.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, profile, isPrimaryAdmin, loading, roleLoaded } = useAuth();
  const location = useLocation();
  const [checked, setChecked] = useState(false);
  const [shouldOnboard, setShouldOnboard] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!roleLoaded) return;
    if (!user || !profile) {
      setChecked(true);
      return;
    }
    if (!isPrimaryAdmin) {
      setChecked(true);
      return;
    }
    const p: any = profile;
    if (p.onboarding_skipped || p.onboarding_completed_at) {
      setChecked(true);
      return;
    }

    let cancelled = false;
    (async () => {
      // Fetch workspace creation time + vision in parallel
      const wsId = (profile as any).workspace_id;
      const [wsRes, visionRes] = await Promise.all([
        wsId
          ? supabase.from("workspaces").select("created_at").eq("id", wsId).maybeSingle()
          : Promise.resolve({ data: null } as any),
        supabase.from("vision").select("section, content"),
      ]);

      const wsCreated = (wsRes as any)?.data?.created_at
        ? new Date((wsRes as any).data.created_at).getTime()
        : null;
      const ageOk = wsCreated ? Date.now() - wsCreated < 24 * 60 * 60 * 1000 : false;

      const hasVision = ((visionRes as any)?.data || []).some((r: any) => {
        const t = r?.content?.text;
        return typeof t === "string" && t.trim().length > 0;
      });

      const hasProgress = p.onboarding_progress && Object.keys(p.onboarding_progress).length > 0;
      const trigger = (ageOk && !hasVision) || hasProgress;

      if (!cancelled) {
        setShouldOnboard(trigger);
        setChecked(true);
      }
    })();

    return () => { cancelled = true; };
  }, [loading, roleLoaded, user, profile, isPrimaryAdmin]);

  if (loading || !checked) return <>{children}</>;

  if (shouldOnboard && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
