import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, ChevronLeft, Loader2, Unplug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface AccessRules {
  allow_all_admins: boolean;
  allow_all_members: boolean;
  allowed_user_ids: string[];
  allowed_roles: string[];
}

interface Member {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

export default function IntegrationsGmailPage() {
  const { isAdmin, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [account, setAccount] = useState<{ email: string; connected_at: string } | null>(null);
  const [rules, setRules] = useState<AccessRules>({
    allow_all_admins: true,
    allow_all_members: false,
    allowed_user_ids: [],
    allowed_roles: [],
  });
  const [members, setMembers] = useState<Member[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: acc }, { data: rulesRow }, { data: profiles }] = await Promise.all([
      supabase.from("gmail_workspace_account").select("email, connected_at").is("revoked_at", null).maybeSingle(),
      supabase.from("gmail_access_rules").select("*").maybeSingle(),
      supabase.from("profiles").select("user_id, full_name, email").eq("workspace_id", profile?.workspace_id ?? "").order("full_name"),
    ]);
    setAccount(acc);
    if (rulesRow) {
      setRules({
        allow_all_admins: rulesRow.allow_all_admins,
        allow_all_members: rulesRow.allow_all_members,
        allowed_user_ids: rulesRow.allowed_user_ids ?? [],
        allowed_roles: rulesRow.allowed_roles ?? [],
      });
    }
    setMembers((profiles ?? []) as Member[]);
    setLoading(false);
  };

  useEffect(() => {
    if (profile?.workspace_id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.workspace_id]);

  const connect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-oauth-start");
      if (error || !data?.authorize_url) throw error || new Error("No URL returned");
      window.location.href = data.authorize_url;
    } catch (e: any) {
      toast.error(e.message || "Failed to start OAuth");
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect Gmail? All workspace members will lose access to the team inbox.")) return;
    const { error } = await supabase.functions.invoke("gmail-disconnect");
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Gmail disconnected");
      setAccount(null);
    }
  };

  const saveRules = async () => {
    if (!profile?.workspace_id) return;
    setSaving(true);
    const { error } = await supabase
      .from("gmail_access_rules")
      .upsert(
        {
          workspace_id: profile.workspace_id,
          allow_all_admins: rules.allow_all_admins,
          allow_all_members: rules.allow_all_members,
          allowed_user_ids: rules.allowed_user_ids,
          allowed_roles: rules.allowed_roles,
        },
        { onConflict: "workspace_id" },
      );
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Access rules saved");
  };

  const toggleUser = (userId: string) => {
    setRules((r) => ({
      ...r,
      allowed_user_ids: r.allowed_user_ids.includes(userId)
        ? r.allowed_user_ids.filter((x) => x !== userId)
        : [...r.allowed_user_ids, userId],
    }));
  };

  const toggleRole = (role: string) => {
    setRules((r) => ({
      ...r,
      allowed_roles: r.allowed_roles.includes(role)
        ? r.allowed_roles.filter((x) => x !== role)
        : [...r.allowed_roles, role],
    }));
  };

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>Admin only</CardTitle>
            <CardDescription>Only workspace admins can manage integrations.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      <Link to="/settings" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back to Settings
      </Link>

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Gmail Integration</h1>
          <p className="text-sm text-muted-foreground">Connect a Gmail mailbox for the entire workspace.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : account ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{account.email}</div>
                <div className="text-xs text-muted-foreground">
                  Connected {new Date(account.connected_at).toLocaleDateString()}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={disconnect}>
                <Unplug className="h-3.5 w-3.5 mr-1.5" />
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">No Gmail account connected.</p>
              <Button onClick={connect} disabled={connecting}>
                {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                Connect Gmail
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {account && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Access</CardTitle>
            <CardDescription>Choose who can use the team mailbox.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <Label htmlFor="all-admins" className="text-sm">Allow all admins</Label>
              <Switch
                id="all-admins"
                checked={rules.allow_all_admins}
                onCheckedChange={(v) => setRules((r) => ({ ...r, allow_all_admins: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="all-members" className="text-sm">Allow all members</Label>
              <Switch
                id="all-members"
                checked={rules.allow_all_members}
                onCheckedChange={(v) => setRules((r) => ({ ...r, allow_all_members: v }))}
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Per role</Label>
              <div className="flex gap-4 mt-2">
                {["admin", "user"].map((role) => (
                  <label key={role} className="flex items-center gap-2 text-sm capitalize">
                    <Checkbox
                      checked={rules.allowed_roles.includes(role)}
                      onCheckedChange={() => toggleRole(role)}
                    />
                    {role}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Specific people</Label>
              <div className="mt-2 max-h-72 overflow-auto border rounded-lg divide-y">
                {members.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground">No members</div>
                ) : (
                  members.map((m) => (
                    <label key={m.user_id} className="flex items-center gap-3 p-2.5 hover:bg-muted/50 cursor-pointer">
                      <Checkbox
                        checked={rules.allowed_user_ids.includes(m.user_id)}
                        onCheckedChange={() => toggleUser(m.user_id)}
                      />
                      <div className="flex-1">
                        <div className="text-sm">{m.full_name || "Unnamed"}</div>
                        {m.email && <div className="text-xs text-muted-foreground">{m.email}</div>}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={saveRules} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save access
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
