import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Loader2, Pencil, Check, X, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Credential = {
  key: string;
  label: string;
  description: string;
  group: string;
  isSecret?: boolean;
};

const CREDENTIALS: Credential[] = [
  {
    key: "GHL_API_KEY",
    label: "GHL API Key",
    description: "Private Integration token — needs contacts.read, contacts.write, contacts/tags.write scopes",
    group: "GoHighLevel",
  },
  {
    key: "GHL_LOCATION_ID",
    label: "GHL Location ID",
    description: "Your sub-account location ID (not secret — safe to share)",
    group: "GoHighLevel",
    isSecret: false,
  },
  {
    key: "OPENROUTER_API",
    label: "OpenRouter API Key",
    description: "Used for AI features (Lead Review classification, etc.)",
    group: "AI",
  },
  {
    key: "ANTHROPIC_API_KEY",
    label: "Anthropic API Key",
    description: "Direct Anthropic key — optional if OpenRouter is set",
    group: "AI",
  },
  {
    key: "OPENAI_API_KEY",
    label: "OpenAI API Key",
    description: "Direct OpenAI key — optional if OpenRouter is set",
    group: "AI",
  },
];

const GROUPS = [...new Set(CREDENTIALS.map((c) => c.group))];

function mask(val: string) {
  if (val.length <= 4) return "••••";
  return "••••••••••••" + val.slice(-4);
}

function CredentialRow({ cred, saved }: { cred: Credential; saved: string | null }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const isSecret = cred.isSecret !== false;

  const save = async () => {
    if (!value.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: cred.key,
        value: value.trim(),
        description: cred.description,
        is_secret: isSecret,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      },
      { onConflict: "key" }
    );
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: `${cred.label} updated` });
      setEditing(false);
      setValue("");
    }
  };

  const cancel = () => {
    setEditing(false);
    setValue("");
    setShow(false);
  };

  return (
    <div className="py-4 border-b border-border/40 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{cred.label}</span>
            <code className="text-[10px] bg-muted/60 px-1.5 py-0.5 rounded text-muted-foreground font-mono">
              {cred.key}
            </code>
            {saved && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">● set</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{cred.description}</p>
          {saved && !editing && (
            <p className="text-xs font-mono text-muted-foreground/60 mt-1">{mask(saved)}</p>
          )}
        </div>

        {!editing && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
            className="shrink-0 gap-1.5 h-8 text-xs"
          >
            <Pencil className="h-3 w-3" />
            {saved ? "Update" : "Set"}
          </Button>
        )}
      </div>

      {editing && (
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type={isSecret && !show ? "password" : "text"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Enter ${cred.label}…`}
              className="pr-9 font-mono text-xs h-9"
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
              autoFocus
            />
            {isSecret && (
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
          <Button size="sm" onClick={save} disabled={saving || !value.trim()} className="h-9 gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={cancel} className="h-9">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function IntegrationCredentials() {
  const { isAdmin } = useAuth();
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("app_settings").select("key, value");
    const map: Record<string, string> = {};
    for (const row of data ?? []) map[row.key] = row.value;
    setSaved(map);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (!isAdmin) return <p className="text-sm text-muted-foreground">Admin access required.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Integration Credentials</h2>
        <p className="text-sm text-muted-foreground mt-1">
          API keys and secrets used by edge functions. Stored securely — values are masked after saving.
          These override environment variables when set.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-6">
          {GROUPS.map((group) => (
            <div key={group} className="rounded-xl border border-border/50 bg-card/80 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                {group}
              </h3>
              <div>
                {CREDENTIALS.filter((c) => c.group === group).map((cred) => (
                  <CredentialRow
                    key={cred.key}
                    cred={cred}
                    saved={saved[cred.key] ?? null}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground/60">
        Values set here are read by Supabase edge functions at runtime. Changes take effect immediately on the next function call.
        If a key isn't set here, the function falls back to the Supabase environment variable of the same name.
      </p>
    </div>
  );
}
