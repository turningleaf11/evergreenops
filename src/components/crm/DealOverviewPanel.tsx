import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ContactPicker } from "./ContactPicker";

interface OverviewDeal {
  id: string;
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
  property_zip: string | null;
  property_type: string | null;
  units: number | null;
  sqft: number | null;
  asking_price: number | null;
  seller_stated_value: number | null;
  source_contact_id: string | null;
  owner_id: string | null;
  disposition_strategy: string | null;
  lead_id: string | null;
}

const DISP_OPTIONS = [
  { value: "buy_hold", label: "Buy & Hold" },
  { value: "assign", label: "Assign" },
  { value: "double_close", label: "Double Close" },
  { value: "pass", label: "Pass" },
];

const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n));

export function DealOverviewPanel({
  deal,
  workspaceId,
  onSave,
}: {
  deal: OverviewDeal;
  workspaceId: string | null;
  onSave: (patch: Partial<OverviewDeal>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(deal);
  const [leadInfo, setLeadInfo] = useState<{ id: string; name: string; buy_box_fit: string | null } | null>(null);

  useEffect(() => setDraft(deal), [deal.id]);

  useEffect(() => {
    if (!deal.lead_id) {
      setLeadInfo(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, name, buy_box_fit")
        .eq("id", deal.lead_id)
        .maybeSingle();
      if (data) setLeadInfo(data as any);
    })();
  }, [deal.lead_id]);

  const blur = (patch: Partial<OverviewDeal>) => onSave(patch);

  const buyBoxColor: Record<string, string> = {
    yes: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    maybe: "bg-amber-400/15 text-amber-600 border-amber-400/30",
    no: "bg-red-500/15 text-red-600 border-red-500/30",
    unchecked: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="space-y-5">
      {/* Property */}
      <section className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Property</h3>
        <div>
          <Label className="text-xs">Address</Label>
          <Input
            value={draft.property_address ?? ""}
            onChange={(e) => setDraft({ ...draft, property_address: e.target.value })}
            onBlur={() => blur({ property_address: draft.property_address })}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">City</Label>
            <Input
              value={draft.property_city ?? ""}
              onChange={(e) => setDraft({ ...draft, property_city: e.target.value })}
              onBlur={() => blur({ property_city: draft.property_city })}
            />
          </div>
          <div>
            <Label className="text-xs">State</Label>
            <Input
              value={draft.property_state ?? ""}
              onChange={(e) => setDraft({ ...draft, property_state: e.target.value })}
              onBlur={() => blur({ property_state: draft.property_state })}
            />
          </div>
          <div>
            <Label className="text-xs">Zip</Label>
            <Input
              value={draft.property_zip ?? ""}
              onChange={(e) => setDraft({ ...draft, property_zip: e.target.value })}
              onBlur={() => blur({ property_zip: draft.property_zip })}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Type</Label>
            <Input
              value={draft.property_type ?? ""}
              placeholder="MF, SFR, Mixed…"
              onChange={(e) => setDraft({ ...draft, property_type: e.target.value })}
              onBlur={() => blur({ property_type: draft.property_type })}
            />
          </div>
          <div>
            <Label className="text-xs">Units</Label>
            <Input
              type="number"
              value={draft.units ?? ""}
              onChange={(e) => setDraft({ ...draft, units: e.target.value === "" ? null : Number(e.target.value) })}
              onBlur={() => blur({ units: draft.units })}
            />
          </div>
          <div>
            <Label className="text-xs">Sqft</Label>
            <Input
              type="number"
              value={draft.sqft ?? ""}
              onChange={(e) => setDraft({ ...draft, sqft: e.target.value === "" ? null : Number(e.target.value) })}
              onBlur={() => blur({ sqft: draft.sqft })}
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Pricing</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Asking price</Label>
            <Input
              type="number"
              value={draft.asking_price ?? ""}
              onChange={(e) => setDraft({ ...draft, asking_price: e.target.value === "" ? null : Number(e.target.value) })}
              onBlur={() => blur({ asking_price: draft.asking_price })}
            />
          </div>
          <div>
            <Label className="text-xs">Seller-stated value</Label>
            <Input
              type="number"
              value={draft.seller_stated_value ?? ""}
              onChange={(e) => setDraft({ ...draft, seller_stated_value: e.target.value === "" ? null : Number(e.target.value) })}
              onBlur={() => blur({ seller_stated_value: draft.seller_stated_value })}
            />
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground">
          Asking: <span className="font-medium text-foreground">{fmtMoney(draft.asking_price)}</span>
        </div>
      </section>

      {/* Source / disposition */}
      <section className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Source & strategy</h3>

        <div>
          <Label className="text-xs">Source contact</Label>
          <ContactPicker
            value={draft.source_contact_id}
            onChange={(id) => {
              setDraft({ ...draft, source_contact_id: id });
              blur({ source_contact_id: id });
            }}
            workspaceId={workspaceId}
          />
        </div>

        <div>
          <Label className="text-xs">Disposition strategy</Label>
          <Select
            value={draft.disposition_strategy ?? ""}
            onValueChange={(v) => {
              setDraft({ ...draft, disposition_strategy: v });
              blur({ disposition_strategy: v });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a strategy" />
            </SelectTrigger>
            <SelectContent>
              {DISP_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {leadInfo && (
          <div className="rounded-lg border border-border/40 bg-muted/30 p-2.5 text-xs flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">From lead</div>
              <div className="font-medium truncate">{leadInfo.name}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className={buyBoxColor[leadInfo.buy_box_fit ?? "unchecked"]}>
                {leadInfo.buy_box_fit ?? "unchecked"}
              </Badge>
              <Link
                to={`/crm?lead=${leadInfo.id}`}
                className="inline-flex items-center gap-0.5 text-primary hover:underline"
              >
                Open <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
