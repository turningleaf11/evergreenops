import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Trash2, RefreshCw, Plus, Send, Key, Webhook, Settings as SettingsIcon, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

type DB = {
  id: string;
  title: string;
  description: string;
  icon: string;
  columns: { id: string; name: string; type: string }[];
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  database: DB;
  workspaceId: string;
  onSavedMeta: (patch: { title?: string; description?: string }) => void;
  onDeleted: () => void;
}

const FUNCTIONS_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;
const ALL_EVENTS = ["row.created", "row.updated", "row.deleted"] as const;

function randomToken(prefix: string, len = 32) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "").slice(0, len);
  return `${prefix}_${b64}`;
}
async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function copy(text: string, label = "Copied") {
  navigator.clipboard.writeText(text);
  toast({ title: label });
}

export default function DatabaseSettingsSheet({ open, onOpenChange, database, workspaceId, onSavedMeta, onDeleted }: Props) {
  const [tab, setTab] = useState("general");

  // General
  const [title, setTitle] = useState(database.title);
  const [description, setDescription] = useState(database.description);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // API keys
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  // Webhooks
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [newOutUrl, setNewOutUrl] = useState("");
  const [newOutLabel, setNewOutLabel] = useState("");
  const [newOutEvents, setNewOutEvents] = useState<string[]>([...ALL_EVENTS]);
  const [deliveries, setDeliveries] = useState<Record<string, any[]>>({});

  useEffect(() => {
    setTitle(database.title);
    setDescription(database.description);
  }, [database.id]);

  const refresh = async () => {
    const [k, w] = await Promise.all([
      supabase.from("database_api_keys").select("*").eq("database_id", database.id).order("created_at", { ascending: false }),
      supabase.from("database_webhooks").select("*").eq("database_id", database.id).order("created_at", { ascending: false }),
    ]);
    setApiKeys(k.data || []);
    setWebhooks(w.data || []);
  };
  useEffect(() => { if (open) refresh(); }, [open, database.id]);

  const loadDeliveries = async (webhookId: string) => {
    const { data } = await supabase.from("database_webhook_deliveries")
      .select("*").eq("webhook_id", webhookId).order("created_at", { ascending: false }).limit(20);
    setDeliveries(prev => ({ ...prev, [webhookId]: data || [] }));
  };

  const saveMeta = async () => {
    const { error } = await supabase.from("databases_meta")
      .update({ title, description }).eq("id", database.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    onSavedMeta({ title, description });
    toast({ title: "Saved" });
  };

  const createKey = async () => {
    const token = randomToken("sk_list");
    const prefix = token.slice(0, 12);
    const hash = await sha256(token);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("database_api_keys").insert({
      database_id: database.id, workspace_id: workspaceId,
      label: newKeyLabel || "API key", key_prefix: prefix, key_hash: hash,
      created_by: u.user?.id || null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setCreatedKey(token);
    setNewKeyLabel("");
    refresh();
  };

  const revokeKey = async (id: string) => {
    await supabase.from("database_api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    refresh();
  };
  const deleteKey = async (id: string) => {
    await supabase.from("database_api_keys").delete().eq("id", id);
    refresh();
  };

  const createWebhook = async (direction: "in" | "out") => {
    const secret = randomToken("whsec");
    const { data: u } = await supabase.auth.getUser();
    const payload: any = {
      database_id: database.id, workspace_id: workspaceId,
      direction, secret, created_by: u.user?.id || null,
    };
    if (direction === "out") {
      if (!newOutUrl.trim()) { toast({ title: "URL required", variant: "destructive" }); return; }
      payload.url = newOutUrl.trim();
      payload.label = newOutLabel || "Outbound webhook";
      payload.events = newOutEvents.length ? newOutEvents : [...ALL_EVENTS];
    } else {
      payload.label = "Inbound webhook";
    }
    const { error } = await supabase.from("database_webhooks").insert(payload);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setNewOutUrl(""); setNewOutLabel(""); setNewOutEvents([...ALL_EVENTS]);
    refresh();
  };

  const toggleWebhook = async (id: string, active: boolean) => {
    await supabase.from("database_webhooks").update({ active }).eq("id", id);
    refresh();
  };
  const deleteWebhook = async (id: string) => {
    await supabase.from("database_webhooks").delete().eq("id", id);
    refresh();
  };
  const sendTest = async (h: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${FUNCTIONS_BASE}/list-webhook-dispatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || ""}`,
      },
      body: JSON.stringify({
        database_id: database.id, event: "row.created", webhook_id: h.id,
        row: { id: "test", values: { sample: true }, created_at: new Date().toISOString() },
      }),
    });
    const j = await res.json();
    toast({ title: j?.dispatched?.[0]?.status ? `Sent (HTTP ${j.dispatched[0].status})` : "Sent" });
    loadDeliveries(h.id);
    refresh();
  };

  const apiUrl = `${FUNCTIONS_BASE}/list-api/${database.id}/rows`;
  const inboundHook = webhooks.find(w => w.direction === "in");
  const inboundUrl = inboundHook ? `${FUNCTIONS_BASE}/list-webhook-in/${inboundHook.id}` : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto top-[60px] h-[calc(100vh-60px)] p-6">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" /> List settings
          </SheetTitle>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex-1 text-xs">General</TabsTrigger>
            <TabsTrigger value="api" className="flex-1 text-xs">API</TabsTrigger>
            <TabsTrigger value="webhooks" className="flex-1 text-xs">Webhooks</TabsTrigger>
          </TabsList>

          {/* GENERAL */}
          <TabsContent value="general" className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
            </div>
            <Button size="sm" onClick={saveMeta}>Save changes</Button>

            <div className="border-t border-border/40 pt-4 mt-6 space-y-2">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" /><span className="text-sm font-medium">Danger zone</span>
              </div>
              <p className="text-xs text-muted-foreground">Deleting this list also removes all of its rows. This cannot be undone.</p>
              <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete list
              </Button>
            </div>
          </TabsContent>

          {/* API */}
          <TabsContent value="api" className="mt-4 space-y-4">
            <div>
              <Label className="text-xs">Endpoint</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input readOnly value={apiUrl} className="h-9 text-xs font-mono" />
                <Button size="icon" variant="ghost" onClick={() => copy(apiUrl, "Endpoint copied")}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
            </div>

            <div className="border border-border/40 rounded-lg p-3 space-y-2">
              <div className="text-xs font-medium">Create API key</div>
              <div className="flex gap-2">
                <Input placeholder="Label (e.g. Zapier)" value={newKeyLabel} onChange={e => setNewKeyLabel(e.target.value)} className="h-8 text-sm" />
                <Button size="sm" onClick={createKey}><Key className="h-3.5 w-3.5 mr-1" /> Generate</Button>
              </div>
              {createdKey && (
                <div className="rounded-md bg-primary/10 p-2 space-y-1.5">
                  <p className="text-[11px] text-muted-foreground">Copy this key now — it won't be shown again.</p>
                  <div className="flex gap-2 items-center">
                    <code className="text-xs font-mono break-all flex-1">{createdKey}</code>
                    <Button size="icon" variant="ghost" onClick={() => copy(createdKey, "Key copied")}><Copy className="h-3.5 w-3.5" /></Button>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setCreatedKey(null)}>Done</Button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Active keys</Label>
              {apiKeys.length === 0 && <p className="text-xs text-muted-foreground">No keys yet.</p>}
              {apiKeys.map(k => (
                <div key={k.id} className="flex items-center gap-2 border border-border/30 rounded-md px-2.5 py-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{k.label}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{k.key_prefix}…{k.revoked_at ? " · revoked" : ""}</div>
                  </div>
                  {!k.revoked_at && <Button size="sm" variant="ghost" onClick={() => revokeKey(k.id)}>Revoke</Button>}
                  <Button size="icon" variant="ghost" onClick={() => deleteKey(k.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>

            <div className="border border-border/40 rounded-lg p-3 space-y-2">
              <div className="text-xs font-medium">Quick reference</div>
              <pre className="text-[11px] bg-muted/40 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words">{`# List rows
curl "${apiUrl}" -H "Authorization: Bearer YOUR_KEY"

# Create a row
curl -X POST "${apiUrl}" \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({ values: Object.fromEntries(database.columns.slice(0, 3).map(c => [c.id, ""])) })}'

# Update a row
curl -X PATCH "${apiUrl}/ROW_ID" -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" -d '{"values":{"field_id":"new value"}}'

# Delete a row
curl -X DELETE "${apiUrl}/ROW_ID" -H "Authorization: Bearer YOUR_KEY"`}</pre>
              <div>
                <div className="text-[11px] text-muted-foreground mb-1">Field IDs for this list:</div>
                <div className="flex flex-wrap gap-1">
                  {database.columns.map(c => (
                    <Badge key={c.id} variant="secondary" className="text-[10px] font-mono">{c.id} · {c.name}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* WEBHOOKS */}
          <TabsContent value="webhooks" className="mt-4 space-y-6">
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5"><Webhook className="h-3.5 w-3.5" /> Inbound webhook</Label>
              <p className="text-[11px] text-muted-foreground">Anyone with the URL + signing secret can POST a JSON row payload to create a row.</p>
              {inboundHook ? (
                <div className="border border-border/40 rounded-md p-3 space-y-2">
                  <div className="space-y-1">
                    <div className="text-[11px] text-muted-foreground">URL</div>
                    <div className="flex gap-2 items-center">
                      <Input readOnly value={inboundUrl} className="h-8 text-xs font-mono" />
                      <Button size="icon" variant="ghost" onClick={() => copy(inboundUrl, "URL copied")}><Copy className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] text-muted-foreground">Signing secret (header X-Lovable-Signature = HMAC-SHA256)</div>
                    <div className="flex gap-2 items-center">
                      <Input readOnly value={inboundHook.secret} className="h-8 text-xs font-mono" />
                      <Button size="icon" variant="ghost" onClick={() => copy(inboundHook.secret, "Secret copied")}><Copy className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => deleteWebhook(inboundHook.id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove inbound
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => createWebhook("in")}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Generate inbound URL
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5"><Webhook className="h-3.5 w-3.5" /> Outbound webhooks</Label>
              <p className="text-[11px] text-muted-foreground">Send a signed POST to your URL when a row changes (Zapier, Make, n8n, your own server).</p>

              <div className="border border-border/40 rounded-md p-3 space-y-2">
                <Input placeholder="https://hooks.zapier.com/..." value={newOutUrl} onChange={e => setNewOutUrl(e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Label (optional)" value={newOutLabel} onChange={e => setNewOutLabel(e.target.value)} className="h-8 text-sm" />
                <div className="flex flex-wrap gap-3">
                  {ALL_EVENTS.map(e => (
                    <label key={e} className="flex items-center gap-1.5 text-xs">
                      <Checkbox
                        checked={newOutEvents.includes(e)}
                        onCheckedChange={(c) => setNewOutEvents(prev => c ? [...new Set([...prev, e])] : prev.filter(x => x !== e))}
                      />
                      <span className="font-mono">{e}</span>
                    </label>
                  ))}
                </div>
                <Button size="sm" onClick={() => createWebhook("out")}><Plus className="h-3.5 w-3.5 mr-1" /> Add webhook</Button>
              </div>

              {webhooks.filter(w => w.direction === "out").map(h => (
                <div key={h.id} className="border border-border/40 rounded-md p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{h.label}</div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate">{h.url}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(h.events || []).map((e: string) => <Badge key={e} variant="secondary" className="text-[10px] font-mono">{e}</Badge>)}
                      </div>
                      {h.last_status != null && (
                        <div className="text-[11px] text-muted-foreground mt-1">
                          Last: HTTP {h.last_status} · {h.last_delivered_at ? new Date(h.last_delivered_at).toLocaleString() : ""}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Switch checked={h.active} onCheckedChange={(v) => toggleWebhook(h.id, v)} />
                      <Button size="icon" variant="ghost" onClick={() => deleteWebhook(h.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => sendTest(h)}>
                      <Send className="h-3.5 w-3.5 mr-1" /> Send test
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => loadDeliveries(h.id)}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1" /> View deliveries
                    </Button>
                  </div>
                  {deliveries[h.id] && (
                    <div className="space-y-1 pt-1">
                      {deliveries[h.id].length === 0 && <div className="text-[11px] text-muted-foreground">No deliveries yet.</div>}
                      {deliveries[h.id].map(d => (
                        <div key={d.id} className="text-[11px] flex items-center gap-2 border-t border-border/20 pt-1">
                          <Badge variant={d.status_code >= 200 && d.status_code < 300 ? "secondary" : "destructive"} className="text-[10px]">
                            {d.status_code || "ERR"}
                          </Badge>
                          <span className="font-mono">{d.event}</span>
                          <span className="text-muted-foreground ml-auto">{new Date(d.created_at).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <ConfirmDeleteDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete this list?"
          description="All rows in this list will be permanently deleted. This action cannot be undone."
          onConfirm={() => { setConfirmDelete(false); onDeleted(); }}
        />
      </SheetContent>
    </Sheet>
  );
}
