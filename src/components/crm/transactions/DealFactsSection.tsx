// DealFactsSection — the physical + underwriting facts about the property
// (beds/baths/sqft/year, ARV, repairs). Lives on the deal Summary; stored in
// dispo_deal_details. Marketing work product (photos, copy) lives in Marketing.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const dispo = supabase as unknown as { from: (table: string) => any };

interface Facts {
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  year_built: number | null;
  arv: number | null;
  repair_estimate: number | null;
}

const EMPTY: Facts = { beds: null, baths: null, sqft: null, year_built: null, arv: null, repair_estimate: null };

export function DealFactsSection({ transactionId }: { transactionId: string }) {
  const [d, setD] = useState<Facts | null>(null);

  const load = useCallback(async () => {
    const { data } = await dispo
      .from("dispo_deal_details")
      .select("beds, baths, sqft, year_built, arv, repair_estimate")
      .eq("transaction_id", transactionId)
      .maybeSingle();
    setD((data as Facts) ?? { ...EMPTY });
  }, [transactionId]);

  useEffect(() => { void load(); }, [load]);

  async function save(patch: Partial<Facts>) {
    setD((prev) => (prev ? { ...prev, ...patch } : prev));
    const { error } = await dispo
      .from("dispo_deal_details")
      .upsert({ transaction_id: transactionId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "transaction_id" });
    if (error) { toast.error(`Couldn't save: ${error.message}`); void load(); }
  }

  if (!d) return <div className="h-16 rounded-lg bg-muted/40 animate-pulse" />;

  const num = (label: string, key: keyof Facts, opts?: { step?: string; prefix?: string }) => (
    <div className="space-y-1">
      <Label className="crm-field-label">{label}</Label>
      <div className="relative">
        {opts?.prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{opts.prefix}</span>}
        <Input
          type="number"
          step={opts?.step}
          defaultValue={d[key] ?? ""}
          onBlur={(e) => {
            const v = e.target.value.trim() === "" ? null : Number(e.target.value);
            if (v !== d[key]) void save({ [key]: v } as Partial<Facts>);
          }}
          className={cn("h-9 tabular-nums", opts?.prefix && "pl-6")}
        />
      </div>
    </div>
  );

  return (
    <section className="space-y-3">
      <h3 className="crm-eyebrow">Property facts</h3>
      <div className="crm-card grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {num("Beds", "beds")}
        {num("Baths", "baths", { step: "0.5" })}
        {num("Sq ft", "sqft")}
        {num("Year built", "year_built")}
        {num("ARV", "arv", { prefix: "$" })}
        {num("Repairs", "repair_estimate", { prefix: "$" })}
      </div>
    </section>
  );
}

export default DealFactsSection;
