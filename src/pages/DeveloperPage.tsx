import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Loader2, Code2, RefreshCw, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsDeveloperWorkspace, DEVELOPER_WORKSPACE_ID } from "@/lib/developer";
import { useGmailAccess } from "@/hooks/useGmailAccess";
import { toast } from "sonner";

export default function DeveloperPage() {
  const { isPrimaryAdmin, profile, user } = useAuth();
  const isDevWorkspace = useIsDeveloperWorkspace();
  const { accounts, refresh } = useGmailAccess();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // Hard gate: only the developer workspace's primary admin sees this page.
  if (!isDevWorkspace || !isPrimaryAdmin) {
    return <Navigate to="/" replace />;
  }

  const refreshGmailToken = async (accountId: string) => {
    setRefreshingId(accountId);
    const { data, error } = await supabase.functions.invoke("gmail-debug-refresh", {
      body: { account_id: accountId },
    });
    setRefreshingId(null);
    if (error) {
      toast.error(error.message || "Refresh failed");
      return;
    }
    toast.success(`Token refreshed (expires ${new Date(data.expires_at).toLocaleTimeString()})`);
    refresh();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5">
      <Link to="/settings" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back to Settings
      </Link>

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Code2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Developer</h1>
          <p className="text-sm text-muted-foreground">Internal tools — visible only to this workspace.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Workspace ID" value={profile?.workspace_id ?? "—"} mono />
          <Row label="User ID" value={user?.id ?? "—"} mono />
          <Row label="Email" value={user?.email ?? "—"} />
          <Row label="Developer workspace" value={DEVELOPER_WORKSPACE_ID} mono />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gmail accounts ({accounts.length})</CardTitle>
          <CardDescription>Force-refresh access tokens to debug OAuth issues.</CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No Gmail accounts connected.</p>
          ) : (
            <ul className="space-y-2">
              {accounts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate flex items-center gap-2">
                      {a.label || a.email}
                      {a.is_default && <Badge variant="outline" className="text-[10px]">default</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate font-mono">{a.id}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refreshGmailToken(a.id)}
                    disabled={refreshingId === a.id}
                  >
                    {refreshingId === a.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Refresh token
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <LinkRow href="/settings/integrations/gmail" label="Gmail integration" />
          <LinkRow href="/help" label="Help center" />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={mono ? "font-mono text-xs" : "text-sm"}>{value}</span>
    </div>
  );
}

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <Link to={href} className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 hover:bg-muted/50 transition-colors">
      <span>{label}</span>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
    </Link>
  );
}
