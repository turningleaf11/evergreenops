import { useEffect, useState } from "react";
import { ArrowUpRight, MapPin } from "lucide-react";
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
  unit_mix: string | null;
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
    yes: "bg-brand-mint/15 text-brand-mint-deep border-brand-mint/30",
    maybe: "bg-brand-tangerine/20 text-brand-tangerine border-brand-tangerine/30",
    no: "bg-brand-coral/15 text-brand-coral border-brand-coral/30",
    unchecked: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="space-y-8">
      {/* Property */}
      <section className="crm-card space-y-4">
        <h3 className="crm-eyebrow">Property</h3>
        <div>
          <Label className="crm-field-label">Property Address</Label>
          <div className="relative">
            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={draft.property_address ?? ""}
              placeholder="Full property address"
              className="pl-8"
              onChange={(e) => setDraft({ ...draft, property_address: e.target.value })}
              onBlur={() => blur({ property_address: draft.property_address })}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="crm-field-label">Type</Label>
            <Input
              value={draft.property_type ?? ""}
              placeholder="MF, SFR, Mixed…"
              onChange={(e) => setDraft({ ...draft, property_type: e.target.value })}
              onBlur={() => blur({ property_type: draft.property_type })}
            />
          </div>
          <div>
            <Label className="crm-field-label">Units</Label>
            <Input
              type="number"
              value={draft.units ?? ""}
              onChange={(e) => setDraft({ ...draft, units: e.target.value === "" ? null : Number(e.target.value) })}
              onBlur={() => blur({ units: draft.units })}
            />
          </div>
          <div>
            <Label className="crm-field-label">Sqft</Label>
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
      <section className="crm-card space-y-4">
        <h3 className="crm-eyebrow">Pricing</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="crm-field-label">Asking price</Label>
            <div className="text-lg font-semibold tabular-nums mb-1">
              {fmtMoney(draft.asking_price)}
            </div>
            <Input
              type="number"
              value={draft.asking_price ?? ""}
              onChange={(e) => setDraft({ ...draft, asking_price: e.target.value === "" ? null : Number(e.target.value) })}
              onBlur={() => blur({ asking_price: draft.asking_price })}
              className="h-9"
            />
          </div>
          <div>
            <Label className="crm-field-label">Seller-stated value</Label>
            <div className="text-lg font-semibold tabular-nums mb-1">
              {fmtMoney(draft.seller_stated_value)}
            </div>
            <Input
              type="number"
              value={draft.seller_stated_value ?? ""}
              onChange={(e) => setDraft({ ...draft, seller_stated_value: e.target.value === "" ? null : Number(e.target.value) })}
              onBlur={() => blur({ seller_stated_value: draft.seller_stated_value })}
              className="h-9"
            />
          </div>
        </div>
      </section>

      {leadInfo && (
        <section className="crm-card">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="crm-eyebrow">From lead</div>
              <div className="font-medium truncate mt-1">{leadInfo.name}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className={buyBoxColor[leadInfo.buy_box_fit ?? "unchecked"]}>
                {leadInfo.buy_box_fit ?? "unchecked"}
              </Badge>
              <Link
                to={`/crm?lead=${leadInfo.id}`}
                className="inline-flex items-center gap-0.5 text-brand-azure hover:underline text-sm"
              >
                Open <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
