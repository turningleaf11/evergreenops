import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface GmailAccount {
  id: string;
  email: string;
  label: string | null;
  is_default: boolean;
}

interface GmailAccessState {
  loading: boolean;
  /** True when at least one Gmail account is connected for the workspace. */
  connected: boolean;
  /** Email of the default account (kept for backward-compat with existing UI). */
  connectedEmail: string | null;
  /** All active accounts the workspace has connected. */
  accounts: GmailAccount[];
  /** The default account, or null if none. */
  defaultAccount: GmailAccount | null;
  hasAccess: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
}

/**
 * Tells the UI whether the workspace has connected Gmail (one or more accounts)
 * and whether the current user is allowed to use it (based on `gmail_access_rules`).
 */
export function useGmailAccess(): GmailAccessState {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [hasAccess, setHasAccess] = useState(false);

  const load = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: accs }, { data: canUse }] = await Promise.all([
      supabase
        .from("gmail_workspace_account")
        .select("id, email, label, is_default")
        .is("revoked_at", null)
        .order("is_default", { ascending: false })
        .order("connected_at", { ascending: true }),
      supabase.rpc("can_use_gmail", { _user_id: user.id }),
    ]);
    setAccounts((accs ?? []) as GmailAccount[]);
    setHasAccess(!!canUse);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0] ?? null;
  return {
    loading,
    connected: accounts.length > 0,
    connectedEmail: defaultAccount?.email ?? null,
    accounts,
    defaultAccount,
    hasAccess,
    isAdmin,
    refresh: load,
  };
}
