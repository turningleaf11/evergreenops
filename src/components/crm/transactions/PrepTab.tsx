// PrepTab — get a deal launch-ready. Photos, property facts, numbers, and the
// investor highlight all live here (dispo_deal_details). This is the data the
// branded/AI campaign email later pulls from, and it drives readiness: when the
// essentials are in, the deal is ready to move Prep -> Ready and launch.

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Star, X, Loader2, CheckCircle2, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const dispo = supabase as unknown as { from: (table: string) => any };
const PHOTO_BUCKET = "dispo-property-photos";

interface Details {
  transaction_id: string;
  photos: string[] | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  year_built: number | null;
  arv: number | null;
  repair_estimate: number | null;
  investor_highlight: string | null;
  investment_details: string | null;
}

interface DealLite {
  property_address: string | null;
  asking_price: number | null;
  purchase_price: number | null;
}

const emptyDetails = (id: string): Details => ({
  transaction_id: id, photos: [], beds: null, baths: null, sqft: null,
  year_built: null, arv: null, repair_estimate: null, investor_highlight: null, investment_details: null,
});

export function PrepTab({ transactionId }: { transactionId: string }) {
  const [d, setD] = useState<Details | null>(null);
  const [deal, setDeal] = useState<DealLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [detRes, dealRes] = await Promise.all([
      dispo.from("dispo_deal_details").select("*").eq("transaction_id", transactionId).maybeSingle(),
      dispo.from("crm_transactions").select("property_address, asking_price, purchase_price").eq("id", transactionId).maybeSingle(),
    ]);
    setD((detRes.data as Details) ?? emptyDetails(transactionId));
    setDeal((dealRes.data as DealLite) ?? null);
    setLoading(false);
  }, [transactionId]);

  useEffect(() => { void load(); }, [load]);

  // Upsert a patch into dispo_deal_details (row is created on first save).
  async function save(patch: Partial<Details>) {
    setD((prev) => (prev ? { ...prev, ...patch } : prev));
    const { error } = await dispo
      .from("dispo_deal_details")
      .upsert({ transaction_id: transactionId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "transaction_id" });
    if (error) {
      toast.error(`Couldn't save: ${error.message}`);
      void load();
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const urls: string[] = [];
    for (const file of Array.from(files)) {
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

  if (loading || !d) {
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
    { label: "Beds & baths", ok: d.beds != null && d.baths != null },
    { label: "Highlight written", ok: !!d.investor_highlight?.trim() },
  ];
  const readyCount = ready.filter((r) => r.ok).length;

  // number field: commits on blur, stores null when cleared
  const num = (label: string, key: keyof Details, opts?: { step?: string; prefix?: string }) => (
    <div className="space-y-1">
      <Label className="crm-field-label">{label}</Label>
      <div className="relative">
        {opts?.prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{opts.prefix}</span>}
        <Input
          type="number"
          step={opts?.step}
          defaultValue={(d[key] as number | null) ?? ""}
          onBlur={(e) => {
            const v = e.target.value.trim() === "" ? null : Number(e.target.value);
            if (v !== (d[key] as number | null)) void save({ [key]: v } as Partial<Details>);
          }}
          className={cn("h-9 tabular-nums", opts?.prefix && "pl-6")}
        />
      </div>
    </div>
  );

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

      {/* Photos */}
      <section className="space-y-3">
        <h3 className="crm-eyebrow">Photos</h3>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }}
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

      {/* Property facts */}
      <section className="space-y-3">
        <h3 className="crm-eyebrow">Property facts</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {num("Beds", "beds")}
          {num("Baths", "baths", { step: "0.5" })}
          {num("Sq ft", "sqft")}
          {num("Year built", "year_built")}
        </div>
      </section>

      {/* Numbers */}
      <section className="space-y-3">
        <h3 className="crm-eyebrow">Numbers</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {num("ARV", "arv", { prefix: "$" })}
          {num("Repair estimate", "repair_estimate", { prefix: "$" })}
          <div className="space-y-1">
            <Label className="crm-field-label">Marketing price</Label>
            <div className="h-9 flex items-center text-sm tabular-nums">
              {price != null ? `$${price.toLocaleString()}` : <span className="text-muted-foreground italic">set on Overview</span>}
            </div>
          </div>
        </div>
      </section>

      {/* Highlight + details */}
      <section className="space-y-3">
        <h3 className="crm-eyebrow">Investor highlight</h3>
        <Input
          defaultValue={d.investor_highlight ?? ""}
          onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== (d.investor_highlight ?? null)) void save({ investor_highlight: v }); }}
          placeholder="One punchy line — the pitch hook (e.g. Cosmetic rehab, strong resale street, priced to move)"
        />
        <Label className="crm-field-label pt-2">Details / notes</Label>
        <Textarea
          rows={4}
          defaultValue={d.investment_details ?? ""}
          onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== (d.investment_details ?? null)) void save({ investment_details: v }); }}
          placeholder="Comps, rent estimate, condition notes — anything the buyer (and the AI email draft) should know."
        />
      </section>
    </section>
  );
}

export default PrepTab;
