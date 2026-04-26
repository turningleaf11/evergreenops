import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mail, ChevronLeft, Loader2, Unplug, Plus, Star, Pencil, Check } from "lucide-react";
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

interface GmailAccountRow {
  id: string;
  email: string;
  label: string | null;
  is_default: boolean;
  connected_at: string;
}

export default function IntegrationsGmailPage() {
  const { isAdmin, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [accounts, setAccounts] = useState<GmailAccountRow[]>([]);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
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
    const [{ data: accs }, { data: rulesRow }, { data: profiles }] = await Promise.all([
      supabase
        .from("gmail_workspace_account")
        .select("id, email, label, is_default, connected_at")
        .is("revoked_at", null)
        .order("is_default", { ascending: false })
        .order("connected_at", { ascending: true }),
      supabase.from("gmail_access_rules").select("*").maybeSingle(),
      supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("workspace_id", profile?.workspace_id ?? "")
        .order("full_name"),
    ]);
    setAccounts((accs ?? []) as GmailAccountRow[]);
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

  const disconnect = async (accountId: string, email: string) => {
    if (!confirm(`Disconnect ${email}? Members will lose access to that mailbox.`)) return;
    const { error } = await supabase.functions.invoke("gmail-disconnect", {
      body: { account_id: accountId },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Disconnected");
      load();
    }
  };

  const setDefault = async (accountId: string) => {
    // Two-step: clear current default, then set new — keeps the partial unique index happy.
    await supabase
      .from("gmail_workspace_account")
      .update({ is_default: false })
      .eq("is_default", true)
      .is("revoked_at", null);
    const { error } = await supabase
      .from("gmail_workspace_account")
      .update({ is_default: true })
      .eq("id", accountId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Default account updated");
      load();
    }
  };

  const startEditLabel = (a: GmailAccountRow) => {
    setEditingLabelId(a.id);
    setLabelDraft(a.label ?? "");
  };

  const saveLabel = async (accountId: string) => {
    const value = labelDraft.trim() || null;
    const { error } = await supabase
      .from("gmail_workspace_account")
      .update({ label: value })
      .eq("id", accountId);
    if (error) {
      toast.error(error.message);
    } else {
      setEditingLabelId(null);
      load();
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
          <p className="text-sm text-muted-foreground">
            Connect one or more Gmail mailboxes for the workspace.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Connected accounts</CardTitle>
          <Button onClick={connect} disabled={connecting} size="sm">
            {connecting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Plus className="h-3.5 w-3.5 mr-1.5" />
            )}
            Connect Gmail
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Gmail accounts connected yet.</p>
          ) : (
            <ul className="space-y-2">
              {accounts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2.5 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {editingLabelId === a.id ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <Input
                            autoFocus
                            value={labelDraft}
                            onChange={(e) => setLabelDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveLabel(a.id);
                              if (e.key === "Escape") setEditingLabelId(null);
                            }}
                            placeholder="Nickname (e.g. Sales)"
                            className="h-7 text-sm max-w-[240px]"
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveLabel(a.id)}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditLabel(a)}
                          className="text-sm font-medium hover:text-primary inline-flex items-center gap-1.5 group"
                        >
                          {a.label || a.email}
                          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      )}
                      {a.is_default && (
                        <Badge variant="outline" className="text-[10px]">
                          <Star className="h-2.5 w-2.5 mr-0.5 fill-current" /> Default
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {a.label ? `${a.email} · ` : ""}
                      Connected {new Date(a.connected_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-3 shrink-0">
                    {!a.is_default && (
                      <Button variant="ghost" size="sm" onClick={() => setDefault(a.id)}>
                        Make default
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => disconnect(a.id, a.email)}>
                      <Unplug className="h-3.5 w-3.5 mr-1" />
                      Disconnect
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Access</CardTitle>
            <CardDescription>
              Choose who can use the team mailboxes. Rules apply to all connected accounts.
            </CardDescription>
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
