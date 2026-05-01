import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const TARGET_CAP_RATE = 0.07; // default — used to derive Our Value

interface UWDeal {
  id: string;
  asking_price: number | null;
  units: number | null;
  quick_arv: number | null;
  repair_estimate: number | null;
  mao: number | null;
  spread: number | null;
  gross_income: number | null;
  vacancy_rate: number | null;
  effective_gross_income: number | null;
  operating_expenses: number | null;
  noi: number | null;
  our_value: number | null;
  our_cap_rate: number | null;
  price_per_unit: number | null;
  loi_date: string | null;
  loi_amount: number | null;
  value: number | null; // final offer / deal value
}

const fmtMoney = (n: number | null | undefined) =>
  n == null || isNaN(Number(n))
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n));

const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function DealUnderwritingTab({
  deal,
  onChanged,
}: {
  deal: UWDeal;
  onChanged: () => void;
}) {
  // Quick UW state
  const [arv, setArv] = useState<string>(deal.quick_arv?.toString() ?? "");
  const [repairs, setRepairs] = useState<string>(deal.repair_estimate?.toString() ?? "");
  const [savingQuick, setSavingQuick] = useState(false);

  // Full UW state
  const [grossIncome, setGrossIncome] = useState<string>(deal.gross_income?.toString() ?? "");
  const [vacancy, setVacancy] = useState<string>(deal.vacancy_rate?.toString() ?? "");
  const [opex, setOpex] = useState<string>(deal.operating_expenses?.toString() ?? "");
  const [finalOffer, setFinalOffer] = useState<string>(deal.value?.toString() ?? "");
  const [loiDate, setLoiDate] = useState<string>(deal.loi_date ?? "");
  const [loiAmount, setLoiAmount] = useState<string>(deal.loi_amount?.toString() ?? "");
  const [savingFull, setSavingFull] = useState(false);

  useEffect(() => {
    setArv(deal.quick_arv?.toString() ?? "");
    setRepairs(deal.repair_estimate?.toString() ?? "");
    setGrossIncome(deal.gross_income?.toString() ?? "");
    setVacancy(deal.vacancy_rate?.toString() ?? "");
    setOpex(deal.operating_expenses?.toString() ?? "");
    setFinalOffer(deal.value?.toString() ?? "");
    setLoiDate(deal.loi_date ?? "");
    setLoiAmount(deal.loi_amount?.toString() ?? "");
  }, [deal.id]);

  // Derived quick UW
  const arvN = Number(arv) || 0;
  const repairsN = Number(repairs) || 0;
  const mao = arvN > 0 ? arvN * 0.7 - repairsN : null;
  const askingN = Number(deal.asking_price) || 0;
  const spread = mao != null && askingN > 0 ? askingN - mao : null;

  const quickDone = (deal.quick_arv ?? null) != null && (deal.repair_estimate ?? null) != null;

  // Derived full UW
  const giN = Number(grossIncome) || 0;
  const vacN = Number(vacancy) || 0;
  const opexN = Number(opex) || 0;
  const vacancyLoss = giN * (vacN / 100);
  const egi = giN - vacancyLoss;
  const noi = egi - opexN;
  const ourValue = noi > 0 ? noi / TARGET_CAP_RATE : 0;
  const ourCapRate = ourValue > 0 ? noi / ourValue : 0;
  const pricePerUnit = deal.units && askingN ? askingN / Number(deal.units) : null;

  const saveQuick = async () => {
    setSavingQuick(true);
    const { error } = await supabase
      .from("deals")
      .update({
        quick_arv: num(arv),
        repair_estimate: num(repairs),
        mao,
        spread,
      } as any)
      .eq("id", deal.id);
    setSavingQuick(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Quick underwrite saved" });
    onChanged();
  };

  const saveFull = async () => {
    setSavingFull(true);
    const { error } = await supabase
      .from("deals")
      .update({
        gross_income: num(grossIncome),
        vacancy_rate: num(vacancy),
        effective_gross_income: egi || null,
        operating_expenses: num(opex),
        noi: noi || null,
        our_value: ourValue || null,
        our_cap_rate: ourCapRate || null,
        price_per_unit: pricePerUnit,
        value: num(finalOffer) ?? deal.value,
        loi_date: loiDate || null,
        loi_amount: num(loiAmount),
      } as any)
      .eq("id", deal.id);
    setSavingFull(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Full underwrite saved" });
    onChanged();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* QUICK UNDERWRITE */}
      <section className="crm-card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="crm-eyebrow">Quick Underwrite</h3>
          <span className="text-[10px] text-muted-foreground">70% rule</span>
        </div>

        <div>
          <Label className="crm-field-label">Quick ARV</Label>
          <Input type="number" value={arv} onChange={(e) => setArv(e.target.value)} placeholder="0" />
        </div>
        <div>
          <Label className="crm-field-label">Repair estimate</Label>
          <Input type="number" value={repairs} onChange={(e) => setRepairs(e.target.value)} placeholder="0" />
        </div>

        <div className="rounded-xl bg-muted/40 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">MAO</span>
            <span className="font-semibold tabular-nums">{fmtMoney(mao)}</span>
          </div>
          <div className="text-[11px] text-muted-foreground italic">ARV × 0.70 − Repairs</div>
          <div className="flex items-center justify-between text-sm pt-2 border-t border-border/40">
            <span className="text-muted-foreground">Asking</span>
            <span className="tabular-nums">{fmtMoney(askingN || null)}</span>
          </div>
          <div className="space-y-1 pt-2">
            <div className="crm-field-label">Spread (Asking − MAO)</div>
            <div
              className={cn(
                "text-2xl font-semibold tabular-nums",
                spread != null && spread < 0 && "text-brand-mint",
                spread != null && spread > 0 && "text-brand-coral",
                spread == null && "text-muted-foreground",
              )}
            >
              {fmtMoney(spread)}
            </div>
            <div className="text-[11px] text-muted-foreground italic">
              Negative spread = below MAO (good)
            </div>
          </div>
        </div>

        <Button size="sm" className="w-full bg-brand-azure hover:bg-brand-azure/90 text-white" onClick={saveQuick} disabled={savingQuick}>
          {savingQuick && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Run Quick Underwrite
        </Button>
      </section>

      {/* FULL UNDERWRITE */}
      <section
        className={cn(
          "crm-card space-y-4 relative",
          !quickDone && "opacity-60 pointer-events-none",
        )}
      >
        {!quickDone && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/40 rounded-xl z-10">
            <span className="text-xs text-muted-foreground bg-background px-3 py-1.5 rounded-md border border-border/60">
              Complete Quick Underwrite first
            </span>
          </div>
        )}
        <h3 className="crm-eyebrow">Full Underwrite</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="crm-field-label">Gross income</Label>
            <Input type="number" value={grossIncome} onChange={(e) => setGrossIncome(e.target.value)} />
          </div>
          <div>
            <Label className="crm-field-label">Vacancy %</Label>
            <Input type="number" value={vacancy} onChange={(e) => setVacancy(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label className="crm-field-label">Operating expenses</Label>
            <Input type="number" value={opex} onChange={(e) => setOpex(e.target.value)} />
          </div>
        </div>

        <div className="rounded-xl bg-muted/40 p-4 space-y-1.5 text-sm">
          <Row label="Vacancy loss" value={fmtMoney(vacancyLoss || null)} />
          <Row label="EGI (GI − vacancy)" value={fmtMoney(egi || null)} />
          <Row label="NOI (EGI − OpEx)" value={fmtMoney(noi || null)} bold />
          <Row label={`Our Value (NOI ÷ ${(TARGET_CAP_RATE * 100).toFixed(1)}%)`} value={fmtMoney(ourValue || null)} />
          <Row label="Our Cap Rate" value={ourCapRate ? `${(ourCapRate * 100).toFixed(2)}%` : "—"} />
          <Row label="Price / Unit" value={fmtMoney(pricePerUnit)} />
          <Row label="Price / Sqft" value={pricePerSqft ? `$${pricePerSqft.toFixed(2)}` : "—"} />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/40">
          <div className="col-span-2">
            <Label className="crm-field-label">Final offer amount</Label>
            <Input type="number" value={finalOffer} onChange={(e) => setFinalOffer(e.target.value)} />
          </div>
          <div>
            <Label className="crm-field-label">LOI date</Label>
            <Input type="date" value={loiDate} onChange={(e) => setLoiDate(e.target.value)} />
          </div>
          <div>
            <Label className="crm-field-label">LOI amount</Label>
            <Input type="number" value={loiAmount} onChange={(e) => setLoiAmount(e.target.value)} />
          </div>
        </div>

        <Button size="sm" className="w-full bg-brand-azure hover:bg-brand-azure/90 text-white" onClick={saveFull} disabled={savingFull}>
          {savingFull && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Save Full Underwrite
        </Button>
      </section>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", bold && "font-semibold")}>{value}</span>
    </div>
  );
}
