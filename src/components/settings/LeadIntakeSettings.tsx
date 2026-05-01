import { useEffect, useState } from "react";
import { Plus, Copy, Eye, EyeOff, Trash2, Webhook, FormInput, Loader2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Source = {
  id: string;
  workspace_id: string;
  name: string;
  kind: "form" | "webhook";
  slug: string;
  secret: string;
  active: boolean;
  default_source_label: string | null;
  submission_count: number;
  last_submission_at: string | null;
  created_at: string;
};

type Submission = {
  id: string;
  source_id: string;
  lead_id: string | null;
  payload: Record<string, unknown>;
  status: string;
  error: string | null;
  created_at: string;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)
    || `intake-${Math.random().toString(36).slice(2, 8)}`;
}

export default function LeadIntakeSettings() {
  const { user } = useAuth();
  const { id: workspaceId } = useWorkspace();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submissionsOpen, setSubmissionsOpen] = useState<Source | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("lead_intake_sources")
      .select("*")
      .order("created_at", { ascending: false });
    setSources((data ?? []) as Source[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (s: Source) => {
    await supabase.from("lead_intake_sources").update({ active: !s.active }).eq("id", s.id);
    setSources((prev) => prev.map((x) => x.id === s.id ? { ...x, active: !s.active } : x));
  };

  const remove = async (s: Source) => {
    if (!confirm(`Delete intake source "${s.name}"? This cannot be undone.`)) return;
    await supabase.from("lead_intake_sources").delete().eq("id", s.id);
    setSources((prev) => prev.filter((x) => x.id !== s.id));
    toast.success("Intake source deleted");
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const publicOrigin = (() => {
    const host = window.location.hostname;
    // On Lovable editor/preview hosts, point users to the published app URL instead.
    if (host.endsWith("lovable.dev") || host.includes("-preview--") || host.endsWith("lovable.app") === false && host.includes("lovable")) {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      // Default published URL pattern; users can override via custom domain.
      return "https://evergreenops.lovable.app";
    }
    return window.location.origin;
  })();
  const formUrl = (slug: string) => `${publicOrigin}/submit-lead/${slug}`;
  const webhookUrl = (slug: string) => `${supabaseUrl}/functions/v1/lead-webhook-in/${slug}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">Lead Intake</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Create public forms or signed webhooks that drop new leads into the Inbox.
            Use a form for brokers and humans; use a webhook for GHL, Zapier, or any system that can POST JSON.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New intake source
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : sources.length === 0 ? (
        <div className="border rounded-xl p-10 text-center">
          <FormInput className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium">No intake sources yet</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Create one to start collecting leads from outside the app.
          </p>
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> New intake source</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((s) => (
            <div key={s.id} className="border rounded-xl p-4 bg-card">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {s.kind === "form" ? <FormInput className="h-4 w-4 text-primary" /> : <Webhook className="h-4 w-4 text-primary" />}
                    <h3 className="font-medium truncate">{s.name}</h3>
                    <Badge variant="outline" className="text-xs capitalize">{s.kind}</Badge>
                    {!s.active && <Badge variant="secondary" className="text-xs">Disabled</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {s.submission_count} submission{s.submission_count === 1 ? "" : "s"}
                    {s.last_submission_at && ` · last ${formatDistanceToNow(new Date(s.last_submission_at))} ago`}
                  </p>

                  <div className="mt-3 space-y-2">
                    {s.kind === "form" ? (
                      <UrlRow label="Form URL" value={formUrl(s.slug)} onCopy={() => copy(formUrl(s.slug), "Form URL")} />
                    ) : (
                      <>
                        <UrlRow label="Webhook URL" value={webhookUrl(s.slug)} onCopy={() => copy(webhookUrl(s.slug), "Webhook URL")} />
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground w-28">Signing secret</span>
                          <code className="flex-1 text-xs bg-muted/50 px-2 py-1.5 rounded truncate font-mono">
                            {revealed[s.id] ? s.secret : "•".repeat(24)}
                          </code>
                          <Button size="sm" variant="ghost" onClick={() => setRevealed((p) => ({ ...p, [s.id]: !p[s.id] }))}>
                            {revealed[s.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => copy(s.secret, "Secret")}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <Switch checked={s.active} onCheckedChange={() => toggleActive(s)} />
                    <Power className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setSubmissionsOpen(s)}>
                    View log
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(s)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {s.kind === "webhook" && (
                <details className="mt-3">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    Show example cURL
                  </summary>
                  <pre className="mt-2 text-xs bg-muted/40 p-3 rounded overflow-x-auto">
{`# Compute signature: hmac-sha256(secret, raw-body) hex
BODY='{"property_address":"123 Main St","units":8,"asking_price":750000,"name":"Jane Broker","email":"jane@example.com"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "${revealed[s.id] ? s.secret : "<secret>"}" -hex | cut -d' ' -f2)

curl -X POST "${webhookUrl(s.slug)}" \\
  -H "Content-Type: application/json" \\
  -H "X-Lovable-Signature: $SIG" \\
  -d "$BODY"`}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      <CreateSourceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={workspaceId}
        userId={user?.id ?? null}
        onCreated={() => { setCreateOpen(false); load(); }}
      />

      <SubmissionsDialog
        source={submissionsOpen}
        onClose={() => setSubmissionsOpen(null)}
      />
    </div>
  );
}

function UrlRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground w-28">{label}</span>
      <code className="flex-1 text-xs bg-muted/50 px-2 py-1.5 rounded truncate font-mono">{value}</code>
      <Button size="sm" variant="ghost" onClick={onCopy}>
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function CreateSourceDialog({
  open, onOpenChange, workspaceId, userId, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string | null;
  userId: string | null;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"form" | "webhook">("form");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setName(""); setKind("form"); setLabel(""); }
  }, [open]);

  const create = async () => {
    if (!name.trim() || !workspaceId) return;
    setSaving(true);
    const slug = slugify(name);
    const { error } = await supabase.from("lead_intake_sources").insert({
      workspace_id: workspaceId,
      name: name.trim(),
      kind,
      slug,
      default_source_label: label.trim() || null,
      created_by: userId,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "That name is already used — try another." : error.message);
      return;
    }
    toast.success("Intake source created");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New intake source</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="form">Public form (shareable URL for humans)</SelectItem>
                <SelectItem value="webhook">Webhook (system-to-system, signed)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Broker Submissions" />
            <p className="text-xs text-muted-foreground">Used in the URL: <code>{name ? slugify(name) : "your-name"}</code></p>
          </div>
          <div className="space-y-2">
            <Label>Source label (optional)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What to label leads from this source" />
            <p className="text-xs text-muted-foreground">Defaults to "{kind === "form" ? "Form" : "Webhook"}: &lt;name&gt;"</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={create} disabled={!name.trim() || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubmissionsDialog({ source, onClose }: { source: Source | null; onClose: () => void }) {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!source) return;
    setLoading(true);
    supabase
      .from("lead_intake_submissions")
      .select("*")
      .eq("source_id", source.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setItems((data ?? []) as Submission[]);
        setLoading(false);
      });
  }, [source]);

  return (
    <Dialog open={!!source} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{source?.name} — recent submissions</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto -mx-6 px-6">
          {loading ? (
            <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No submissions yet.</p>
          ) : (
            <div className="space-y-2">
              {items.map((s) => (
                <div key={s.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={s.status === "ok" ? "default" : s.status === "rejected" ? "secondary" : "destructive"} className="text-xs">
                      {s.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(s.created_at))} ago
                    </span>
                  </div>
                  {s.error && <p className="text-xs text-destructive mb-1">{s.error}</p>}
                  <pre className="text-xs bg-muted/40 p-2 rounded overflow-x-auto max-h-40">
                    {JSON.stringify(s.payload, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
