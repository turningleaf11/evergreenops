import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface GmailAccessState {
  loading: boolean;
  connected: boolean;
  connectedEmail: string | null;
  hasAccess: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
}

/**
 * Tells the UI whether the workspace has connected Gmail and whether the
 * current user is allowed to use it (based on `gmail_access_rules`).
 */
export function useGmailAccess(): GmailAccessState {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);

  const load = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: account }, { data: canUse }] = await Promise.all([
      supabase
        .from("gmail_workspace_account")
        .select("email")
        .is("revoked_at", null)
        .maybeSingle(),
      supabase.rpc("can_use_gmail", { _user_id: user.id }),
    ]);
    setConnected(!!account);
    setConnectedEmail(account?.email ?? null);
    setHasAccess(!!canUse);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { loading, connected, connectedEmail, hasAccess, isAdmin, refresh: load };
}
