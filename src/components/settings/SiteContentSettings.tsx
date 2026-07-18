// SiteContentSettings — edit the public site's marketing copy without code.
// Writes the single site_content row the site reads at runtime; blank fields
// fall back to the built-in default. Changes go live within a minute.

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const content = supabase as unknown as { from: (t: string) => any };

interface Field { key: string; label: string; multiline?: boolean; def: string }
interface Group { title: string; fields: Field[] }

// Mirrors lib/content.ts in the site repo (keys + default copy for placeholders).
const GROUPS: Group[] = [
  { title: "Hero", fields: [
    { key: "hero_eyebrow", label: "Eyebrow", def: "New opportunities available" },
    { key: "hero_title", label: "Headline (line 1)", def: "Investment property," },
    { key: "hero_title_accent", label: "Headline (accent line)", def: "before it hits the market." },
    { key: "hero_subtext", label: "Subtext", multiline: true, def: "Browse Evergreen's available deals, review the numbers, and connect directly with our dispositions team." },
    { key: "hero_cta_primary", label: "Primary button", def: "View inventory" },
    { key: "hero_cta_secondary", label: "Secondary button", def: "Join buyers list" },
  ] },
  { title: "Early-access banner", fields: [
    { key: "banner_title", label: "Bold lead", def: "Get early access to new inventory." },
    { key: "banner_body", label: "Body", multiline: true, def: "Buyers-list members are notified before selected deals are published." },
    { key: "banner_link", label: "Link", def: "Join the private buyers list →" },
  ] },
  { title: "Inventory (home)", fields: [
    { key: "inv_eyebrow", label: "Eyebrow", def: "Current inventory" },
    { key: "inv_title", label: "Heading", def: "Available deals" },
  ] },
  { title: "How it works", fields: [
    { key: "how_title", label: "Heading", def: "A straightforward path from discovery to closing." },
    { key: "how_intro", label: "Intro", multiline: true, def: "Review what's available, contact the dispositions team with questions or an offer, and coordinate access and closing directly with Evergreen." },
    { key: "how_1_title", label: "Step 1 title", def: "Get early access" },
    { key: "how_1_body", label: "Step 1 body", multiline: true, def: "Join the list and receive matching opportunities as they become available." },
    { key: "how_2_title", label: "Step 2 title", def: "Review the structure" },
    { key: "how_2_body", label: "Step 2 body", multiline: true, def: "See the deal type, property facts, numbers, photos, and supporting details." },
    { key: "how_3_title", label: "Step 3 title", def: "Make your move" },
    { key: "how_3_body", label: "Step 3 body", multiline: true, def: "Ask questions, schedule access, or submit your offer from the deal page." },
  ] },
  { title: "Buyers list", fields: [
    { key: "buyers_eyebrow", label: "Eyebrow", def: "Get first dibs" },
    { key: "buyers_title", label: "Heading", def: "Join our VIP Buyers List" },
    { key: "buyers_body", label: "Body", multiline: true, def: "Want a head start on our best deals? Get early access to new off-market opportunities — often before they're posted here — plus priority alerts and deal previews matched to your buying criteria." },
    { key: "buyers_cta", label: "Button", def: "I Want First Dibs" },
  ] },
  { title: "Inventory page", fields: [
    { key: "properties_eyebrow", label: "Eyebrow", def: "Deal inventory" },
    { key: "properties_title", label: "Heading", def: "Current inventory" },
    { key: "properties_subtext", label: "Subtext", multiline: true, def: "Off-market investment properties, updated regularly and open to serious buyers." },
  ] },
  { title: "Footer", fields: [
    { key: "footer_tagline", label: "Tagline", def: "Off-market inventory for serious buyers." },
  ] },
];

export function SiteContentSettings() {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    const { data } = await content.from("site_content").select("content").eq("id", 1).maybeSingle();
    setVals((data?.content as Record<string, string>) ?? {});
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    setSaving(true);
    // Store only non-empty overrides; the site fills blanks with defaults.
    const clean = Object.fromEntries(Object.entries(vals).filter(([, v]) => (v ?? "").trim() !== ""));
    const { error } = await content.from("site_content").update({ content: clean, updated_at: new Date().toISOString() }).eq("id", 1);
    setSaving(false);
    if (error) { toast.error(`Couldn't save: ${error.message}`); return; }
    toast.success("Copy saved — the site updates within a minute");
  }

  if (loading) return <div className="h-40 rounded-lg bg-muted/40 animate-pulse" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Site Content</h2>
        <p className="text-sm text-muted-foreground">Edit the public site's wording. Leave a field blank to use the default. Changes go live within a minute.</p>
      </div>

      {GROUPS.map((g) => (
        <div key={g.title} className="space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</div>
          <div className="space-y-3">
            {g.fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="crm-field-label">{f.label}</Label>
                {f.multiline ? (
                  <Textarea rows={2} value={vals[f.key] ?? ""} placeholder={f.def} onChange={(e) => set(f.key, e.target.value)} className="text-sm" />
                ) : (
                  <Input value={vals[f.key] ?? ""} placeholder={f.def} onChange={(e) => set(f.key, e.target.value)} className="h-9 text-sm" />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end border-t border-border/50 pt-4 sticky bottom-0 bg-background py-3">
        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}Save copy
        </Button>
      </div>
    </div>
  );
}

export default SiteContentSettings;
