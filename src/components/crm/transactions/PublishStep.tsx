// PublishStep — step 2 of the Marketing launch sequence: put the listing on the
// public site and choose who fronts it. Driven by the parent sheet's deal state
// (saveField), so the step status chip stays in sync automatically.

import { Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DispoManagerField } from "./DispoManagerField";
import { logEvent } from "@/lib/events";

const dispo = supabase as unknown as { from: (table: string) => any };

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function PublishStep({
  transactionId,
  marketingTitle,
  published,
  slug,
  dispoManagerId,
  onSave,
}: {
  transactionId: string;
  marketingTitle: string | null;
  published: boolean;
  slug: string | null;
  dispoManagerId: string | null;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  // Pick a URL slug that isn't taken by another deal.
  async function uniqueSlug(base: string): Promise<string> {
    const { data } = await dispo.from("crm_transactions").select("id, slug").ilike("slug", `${base}%`);
    const taken = new Set(
      ((data as { id: string; slug: string }[]) ?? [])
        .filter((r) => r.id !== transactionId && r.slug)
        .map((r) => r.slug),
    );
    let s = base;
    let n = 2;
    while (taken.has(s)) s = `${base}-${n++}`;
    return s;
  }

  async function togglePublish(next: boolean) {
    if (!next) {
      onSave({ published: false });
      toast.success("Removed from site");
      return;
    }
    const title = marketingTitle?.trim();
    if (!title) {
      toast.error("Add a marketing title first — it becomes the listing's web address.");
      return;
    }
    const s = slug || (await uniqueSlug(slugify(title)));
    onSave({ published: true, published_at: new Date().toISOString(), slug: s });
    toast.success("Published to site");
    void logEvent({
      type: "deal_published",
      severity: "success",
      title: `${title} published to the site`,
      source: "opshq",
      entityType: "deal",
      entityId: transactionId,
      entityLabel: title,
      metadata: { slug: s },
    });
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium flex items-center gap-2">
            Publish to site
            {published && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand-mint/15 text-brand-mint-deep">
                <Globe className="h-2.5 w-2.5" /> Live
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {published && slug ? (
              <>Listed at <span className="font-mono">/properties/{slug}</span></>
            ) : (
              "Show this deal on the public inventory site."
            )}
          </p>
        </div>
        <Switch checked={published} onCheckedChange={(c) => void togglePublish(c)} />
      </div>

      <div className="border-t border-border/40 pt-4 space-y-1.5">
        <Label className="crm-field-label">Listing contact</Label>
        <DispoManagerField
          value={dispoManagerId}
          onChange={(id) => onSave({ dispo_manager_id: id })}
        />
        <p className="text-[11px] text-muted-foreground">
          Shown on the public listing with their photo and direct contact.
        </p>
      </div>
    </div>
  );
}

export default PublishStep;
