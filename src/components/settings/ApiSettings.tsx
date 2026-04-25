import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Trash2, KeyRound, FlaskConical, Send, Loader2, Check } from "lucide-react";

interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

const FUNCTIONS_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.functions.supabase.co`;

const SAMPLE_PAYLOADS: Record<string, object> = {
  "List recent leads": {
    resource: "leads",
    action: "list",
    limit: 10,
  },
  "Create a lead": {
    resource: "leads",
    action: "create",
    data: {
      name: "Jane Prospect",
      email: "jane@example.com",
      phone: "+15551234567",
      source: "webhook",
      temperature: "warm",
      notes: "Came in from landing page form.",
    },
  },
  "Create a contact": {
    resource: "contacts",
    action: "create",
    data: {
      first_name: "Alex",
      last_name: "Buyer",
      email: "alex@example.com",
      phone: "+15555550100",
    },
  },
  "Create a task": {
    resource: "tasks",
    action: "create",
    data: {
      title: "Follow up with new lead",
      priority: "high",
      status: "todo",
    },
  },
  "Get a deal by id": {
    resource: "deals",
    action: "get",
    id: "<paste-deal-uuid>",
  },
  "Update a contact": {
    resource: "contacts",
    action: "update",
    id: "<paste-contact-uuid>",
    data: { phone: "+15559998888" },
  },
};

function generateRawToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "").replace(/\//g, "").replace(/=/g, "");
  return `evg_${b64}`;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function ApiSettings() {
  const { user, isAdmin } = useAuth();
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Playground
  const [playgroundToken, setPlaygroundToken] = useState("");
  const [endpoint, setEndpoint] = useState<"api-test" | "api-ingest">("api-test");
  const [body, setBody] = useState<string>(JSON.stringify(SAMPLE_PAYLOADS["List recent leads"], null, 2));
  const [response, setResponse] = useState<string>("");
  const [sending, setSending] = useState(false);

  const fetchTokens = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("api_tokens")
      .select("id, name, prefix, created_at, last_used_at, revoked_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setTokens(data as ApiToken[]);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) fetchTokens(); }, [isAdmin]);

  const create = async () => {
    if (!name.trim() || !user) return;
    setCreating(true);
    try {
      const raw = generateRawToken();
      const hash = await sha256Hex(raw);
      const prefix = raw.slice(0, 8);

      // Get workspace id
      const { data: prof } = await supabase.from("profiles").select("workspace_id").eq("user_id", user.id).maybeSingle();
      if (!prof?.workspace_id) throw new Error("No workspace found");

      const { error } = await supabase.from("api_tokens").insert({
        name: name.trim(),
        prefix,
        token_hash: hash,
        workspace_id: prof.workspace_id,
        created_by: user.id,
      });
      if (error) throw error;

      setRevealedToken(raw);
      setName("");
      setPlaygroundToken(raw); // pre-fill playground for convenience
      await fetchTokens();
      toast.success("Token created. Copy it now — you won't see it again.");
    } catch (e: any) {
      toast.error(e.message || "Failed to create token");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this token? Any service using it will stop working.")) return;
    const { error } = await supabase.from("api_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Token revoked"); fetchTokens(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Permanently delete this token record?")) return;
    const { error } = await supabase.from("api_tokens").delete().eq("id", id);
    if (error) toast.error(error.message);
    else fetchTokens();
  };

  const copyToken = async () => {
    if (!revealedToken) return;
    await navigator.clipboard.writeText(revealedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const sendPlayground = async () => {
    setSending(true);
    setResponse("");
    try {
      const url = `${FUNCTIONS_BASE}/${endpoint}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${playgroundToken.trim()}`,
        },
        body: body,
      });
      const text = await res.text();
      try {
        setResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponse(text);
      }
    } catch (e: any) {
      setResponse(`Network error: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  const curlExample = useMemo(() => {
    return `curl -X POST '${FUNCTIONS_BASE}/${endpoint}' \\
  -H 'Authorization: Bearer YOUR_TOKEN' \\
  -H 'Content-Type: application/json' \\
  -d '${body.replace(/'/g, "'\\''")}'`;
  }, [endpoint, body]);

  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">Admin access required.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">API Tokens</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Issue tokens for external services to read your workspace data and create records.
          Tokens are hashed — the secret is shown once at creation.
        </p>
      </div>

      <Tabs defaultValue="tokens">
        <TabsList>
          <TabsTrigger value="tokens"><KeyRound className="h-3.5 w-3.5 mr-1.5" /> Tokens</TabsTrigger>
          <TabsTrigger value="playground"><FlaskConical className="h-3.5 w-3.5 mr-1.5" /> Playground</TabsTrigger>
          <TabsTrigger value="docs">Docs</TabsTrigger>
        </TabsList>

        {/* TOKENS */}
        <TabsContent value="tokens" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create a token</CardTitle>
              <CardDescription>Give it a memorable name like "Zapier" or "Landing page webhook".</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Input
                placeholder="Token name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={creating}
              />
              <Button onClick={create} disabled={creating || !name.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create token"}
              </Button>
            </CardContent>
          </Card>

          {revealedToken && (
            <Card className="border-primary/40 bg-primary/[0.04]">
              <CardHeader>
                <CardTitle className="text-base">Your new token</CardTitle>
                <CardDescription className="text-destructive font-medium">
                  Copy it now. For security, we won't show it again.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2 items-center">
                <code className="flex-1 px-3 py-2 rounded-md bg-background border text-xs font-mono break-all">
                  {revealedToken}
                </code>
                <Button size="sm" variant="outline" onClick={copyToken}>
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRevealedToken(null)}>Done</Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active tokens</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : tokens.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tokens yet.</p>
              ) : (
                <div className="divide-y divide-border/40">
                  {tokens.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{t.name}</span>
                          {t.revoked_at && <Badge variant="destructive" className="text-[10px]">Revoked</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                          {t.prefix}…••••••••
                        </div>
                        <div className="text-[11px] text-muted-foreground/70 mt-0.5">
                          Created {new Date(t.created_at).toLocaleDateString()} ·{" "}
                          {t.last_used_at ? `Last used ${new Date(t.last_used_at).toLocaleString()}` : "Never used"}
                        </div>
                      </div>
                      {!t.revoked_at && (
                        <Button size="sm" variant="outline" onClick={() => revoke(t.id)}>Revoke</Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => remove(t.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PLAYGROUND */}
        <TabsContent value="playground" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Test a payload</CardTitle>
              <CardDescription>
                Use the <strong>api-test</strong> endpoint to validate a payload without writing anything.
                Switch to <strong>api-ingest</strong> when you're ready to do it for real.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Select value={endpoint} onValueChange={(v: any) => setEndpoint(v)}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api-test">api-test (dry-run)</SelectItem>
                    <SelectItem value="api-ingest">api-ingest (live)</SelectItem>
                  </SelectContent>
                </Select>
                <Select onValueChange={(v) => setBody(JSON.stringify(SAMPLE_PAYLOADS[v], null, 2))}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Load sample payload…" /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(SAMPLE_PAYLOADS).map((k) => (
                      <SelectItem key={k} value={k}>{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Input
                placeholder="Bearer token (evg_…)"
                value={playgroundToken}
                onChange={(e) => setPlaygroundToken(e.target.value)}
                className="font-mono text-xs"
              />

              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="font-mono text-xs"
              />

              <div className="flex justify-end">
                <Button onClick={sendPlayground} disabled={sending || !playgroundToken.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Send
                </Button>
              </div>

              {response && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Response</div>
                  <pre className="bg-muted/40 border rounded-md p-3 text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap">{response}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOCS */}
        <TabsContent value="docs" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Endpoints</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="font-semibold">Live endpoint</div>
                <code className="block bg-muted/40 px-2 py-1 rounded text-xs mt-1">
                  POST {FUNCTIONS_BASE}/api-ingest
                </code>
              </div>
              <div>
                <div className="font-semibold">Test / dry-run endpoint</div>
                <code className="block bg-muted/40 px-2 py-1 rounded text-xs mt-1">
                  POST {FUNCTIONS_BASE}/api-test
                </code>
                <p className="text-xs text-muted-foreground mt-1">
                  Validates auth + payload shape but never writes. Returns what would have been inserted.
                </p>
              </div>
              <div>
                <div className="font-semibold">Auth header</div>
                <code className="block bg-muted/40 px-2 py-1 rounded text-xs mt-1">
                  Authorization: Bearer evg_…
                </code>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payload shape</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted/40 border rounded-md p-3 text-xs font-mono overflow-auto whitespace-pre-wrap">
{`{
  "resource": "leads | contacts | deals | tasks | reminders | posts | crm_activities | issues | form_submissions | ...",
  "action": "list | get | create | update",
  "id": "<uuid> (for get/update)",
  "data": { ...fields... } (for create/update),
  "filters": { "status": "new" } (optional, for list),
  "limit": 50 (optional, max 200)
}`}
              </pre>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>workspace_id</strong> is injected automatically from your token — never include it.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">curl example</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted/40 border rounded-md p-3 text-xs font-mono overflow-auto whitespace-pre-wrap">{curlExample}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Permissions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <div className="font-semibold text-foreground">Readable</div>
                <p className="text-muted-foreground text-xs">
                  contacts, companies, deals, leads, pipelines, tasks, reminders, projects, goals, issues,
                  posts, announcements, polls, kudos, documents, notes, crm_activities, profiles, departments, scorecard_*
                </p>
              </div>
              <div>
                <div className="font-semibold text-foreground">Writable</div>
                <p className="text-muted-foreground text-xs">
                  contacts, leads, deals, tasks, reminders, posts, crm_activities, form_submissions, issues
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
