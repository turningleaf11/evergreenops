// MarketingAssets — the deal's marketing work product: listing identity
// (public title + address privacy), photos, and the investor pitch copy.
// Top of the Marketing funnel: assets -> launch checklist -> campaigns.
// Property FACTS (beds/baths/ARV…) live on Summary; this is what we publish.

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Star, X, Loader2, CheckCircle2, Circle, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DealCopyGenerator } from "./DealCopyGenerator";

const dispo = supabase as unknown as { from: (table: string) => any };
const PHOTO_BUCKET = "dispo-property-photos";

interface Details {
  transaction_id: string;
  photos: string[] | null;
  investor_highlight: string | null;
  investment_details: string | null;
}

interface DealLite {
  marketing_title: string | null;
  address_private: boolean;
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
  asking_price: number | null;
  purchase_price: number | null;
  published: boolean;
  published_at: string | null;
  slug: string | null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const emptyDetails = (id: string): Details => ({
  transaction_id: id, photos: [], investor_highlight: null, investment_details: null,
});

export function MarketingAssets({
  transactionId,
  onUseInCampaign,
}: {
  transactionId: string;
  onUseInCampaign?: (subject: string, body: string) => void;
}) {
  const [d, setD] = useState<Details | null>(null);
  const [deal, setDeal] = useState<DealLite | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [detRes, dealRes] = await Promise.all([
      dispo.from("dispo_deal_details").select("transaction_id, photos, investor_highlight, investment_details").eq("transaction_id", transactionId).maybeSingle(),
      dispo.from("crm_transactions").select("marketing_title, address_private, property_address, property_city, property_state, asking_price, purchase_price, published, published_at, slug").eq("id", transactionId).maybeSingle(),
    ]);
    setD((detRes.data as Details) ?? emptyDetails(transactionId));
    setDeal((dealRes.data as DealLite) ?? null);
  }, [transactionId]);

  useEffect(() => { void load(); }, [load]);

  // Upsert a patch into dispo_deal_details (row is created on first save).
  async function save(patch: Partial<Details>) {
    setD((prev) => (prev ? { ...prev, ...patch } : prev));
    const { error } = await dispo
      .from("dispo_deal_details")
      .upsert({ transaction_id: transactionId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "transaction_id" });
    if (error) { toast.error(`Couldn't save: ${error.message}`); void load(); }
  }

  // Listing identity lives on the deal record itself.
  async function saveDeal(patch: Partial<DealLite>) {
    setDeal((prev) => (prev ? { ...prev, ...patch } : prev));
    const { error } = await dispo.from("crm_transactions").update(patch).eq("id", transactionId);
    if (error) { toast.error(`Couldn't save: ${error.message}`); void load(); }
  }

  // Pick a URL slug that isn't taken by another deal.
  async function uniqueSlug(base: string): Promise<string> {
    const { data } = await dispo.from("crm_transactions").select("id, slug").ilike("slug", `${base}%`);
    const taken = new Set(((data as { id: string; slug: string }[]) ?? []).filter((r) => r.id !== transactionId && r.slug).map((r) => r.slug));
    let slug = base;
    let n = 2;
    while (taken.has(slug)) slug = `${base}-${n++}`;
    return slug;
  }

  async function togglePublish(next: boolean) {
    if (!next) { await saveDeal({ published: false }); toast.success("Removed from site"); return; }
    const title = deal?.marketing_title?.trim();
    if (!title) { toast.error("Add a marketing title first — it becomes the listing's web address."); return; }
    const slug = deal?.slug || (await uniqueSlug(slugify(title)));
    await saveDeal({ published: true, published_at: new Date().toISOString(), slug });
    toast.success("Published to site");
  }

  async function onFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${transactionId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { upsert: false });
      if (error) { toast.error(`Upload failed: ${error.message}`); continue; }
      urls.push(supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl);
    }
    setUploading(false);
    if (urls.length) {
      const next = [...(d?.photos ?? []), ...urls];
      await save({ photos: next });
      // keep the legacy single hero column in sync for anything that reads it
      await dispo.from("dispo_deal_details").update({ photo_url: next[0] }).eq("transaction_id", transactionId);
      toast.success(`Added ${urls.length} photo${urls.length === 1 ? "" : "s"}`);
    }
  }

  function removePhoto(url: string) {
    const next = (d?.photos ?? []).filter((p) => p !== url);
    void save({ photos: next });
    void dispo.from("dispo_deal_details").update({ photo_url: next[0] ?? null }).eq("transaction_id", transactionId);
  }

  function makeHero(url: string) {
    const rest = (d?.photos ?? []).filter((p) => p !== url);
    const next = [url, ...rest];
    void save({ photos: next });
    void dispo.from("dispo_deal_details").update({ photo_url: url }).eq("transaction_id", transactionId);
  }

  if (!d) {
    return (
      <div className="space-y-3 max-w-3xl">
        {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-lg bg-muted/40 animate-pulse" />)}
      </div>
    );
  }

  const photos = d.photos ?? [];
  const price = deal?.asking_price ?? deal?.purchase_price ?? null;
  const ready = [
    { label: "Photo added", ok: photos.length > 0 },
    { label: "Price set", ok: price != null },
    { label: "Marketing title", ok: !!deal?.marketing_title?.trim() },
    { label: "Highlight written", ok: !!d.investor_highlight?.trim() },
  ];
  const readyCount = ready.filter((r) => r.ok).length;

  return (
    <section className="space-y-8 max-w-3xl">
      {/* Readiness */}
      <div className="crm-card flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="crm-eyebrow">Launch readiness</span>
        {ready.map((r) => (
          <span key={r.label} className={cn("inline-flex items-center gap-1.5 text-xs", r.ok ? "text-brand-mint-deep" : "text-muted-foreground")}>
            {r.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
            {r.label}
          </span>
        ))}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{readyCount} of {ready.length}</span>
      </div>

      {/* Listing identity — the deal's public name + address privacy */}
      <section className="space-y-3">
        <h3 className="crm-eyebrow">Listing identity</h3>
        <div className="crm-card space-y-4">
          <div className="space-y-1">
            <Label className="crm-field-label">Marketing title</Label>
            <Input
              defaultValue={deal?.marketing_title ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== (deal?.marketing_title ?? null)) void saveDeal({ marketing_title: v });
              }}
              placeholder='The deal&apos;s public name — e.g. "Low Entry SubTo Home"'
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Keep address private</div>
              <p className="text-[11px] text-muted-foreground">
                Public marketing shows {deal?.address_private
                  ? `"${[deal?.property_city, deal?.property_state].filter(Boolean).join(", ") || "city, state"}" only`
                  : "the full street address"}.
              </p>
            </div>
            <Switch
              checked={!!deal?.address_private}
              onCheckedChange={(c) => void saveDeal({ address_private: c })}
            />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-4">
            <div className="min-w-0">
              <div className="text-sm font-medium flex items-center gap-2">
                Publish to site
                {deal?.published && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand-mint/15 text-brand-mint-deep">
                    <Globe className="h-2.5 w-2.5" /> Live
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {deal?.published && deal?.slug
                  ? <>Listed at <span className="font-mono">/properties/{deal.slug}</span></>
                  : "Show this deal on the public inventory site."}
              </p>
            </div>
            <Switch
              checked={!!deal?.published}
              onCheckedChange={(c) => void togglePublish(c)}
            />
          </div>
        </div>
      </section>

      {/* Photos */}
      <section className="space-y-3">
        <h3 className="crm-eyebrow">Photos</h3>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { const list = e.target.files ? Array.from(e.target.files) : []; e.target.value = ""; void onFiles(list); }}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((url, i) => (
            <div key={url} className="group relative aspect-[4/3] rounded-lg overflow-hidden border border-border/50 bg-muted">
              <img src={url} alt="" className="h-full w-full object-cover" />
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand-mint text-white">
                  <Star className="h-2.5 w-2.5 fill-current" /> Hero
                </span>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                {i !== 0 && (
                  <button type="button" onClick={() => makeHero(url)} title="Set as hero" className="p-1.5 rounded-md bg-white/90 text-foreground hover:bg-white">
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                <button type="button" onClick={() => removePhoto(url)} title="Remove" className="p-1.5 rounded-md bg-white/90 text-brand-coral hover:bg-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="aspect-[4/3] rounded-lg border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-brand-azure hover:text-brand-azure transition-colors"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            <span className="text-xs font-medium">{uploading ? "Uploading…" : "Add photos"}</span>
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">The hero photo leads the marketing email and listing. Hover a photo to set hero or remove.</p>
      </section>

      {/* Highlight + details — the pitch copy the emails/listing pull from */}
      <section className="space-y-3">
        <h3 className="crm-eyebrow">Investor highlight</h3>
        <Input
          defaultValue={d.investor_highlight ?? ""}
          onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== (d.investor_highlight ?? null)) void save({ investor_highlight: v }); }}
          placeholder="One punchy line — the pitch hook (e.g. Cosmetic rehab, strong resale street, priced to move)"
        />
        <Label className="crm-field-label pt-2">Details / notes</Label>
        <Textarea
          key={`details-${d.investment_details ?? ""}`}
          rows={4}
          defaultValue={d.investment_details ?? ""}
          onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== (d.investment_details ?? null)) void save({ investment_details: v }); }}
          placeholder="Comps, rent estimate, condition notes — anything the buyer (and the AI email draft) should know."
        />
      </section>

      {/* AI copy — drafts description + buyer email from everything above */}
      <DealCopyGenerator
        transactionId={transactionId}
        propertyState={deal?.property_state ?? null}
        onUseAsDetails={(text) => { void save({ investment_details: text }); toast.success("Saved to Details"); }}
        onUseInCampaign={onUseInCampaign}
      />
    </section>
  );
}

export default MarketingAssets;
