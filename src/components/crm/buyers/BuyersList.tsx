// BuyersList — the standalone investor-buyer list (dispo_buyers).
//
// Buyers are the demand side of the business: GHL-sourced, carrying a buy-box
// (markets, states, strategies, max price, tier). This is their home. Each
// deal's Buyers tab just references buyers from here; buyer management and the
// GHL sync live on this surface, not inside a deal.

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Users, Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { fmtMoney } from "../transactions/utils";

interface Buyer {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  status: string | null;
  tier: string | null;
  markets: string[] | null;
  states: string[] | null;
  strategies: string[] | null;
  property_types: string[] | null;
  min_price: number | null;
  max_price: number | null;
  buy_box_notes: string | null;
  updated_at: string | null;
}

// dispo_* tables aren't in the generated Supabase types (created directly in
// the DB); route dispo reads through this untyped handle until types are regen'd.
const dispo = supabase as unknown as { from: (table: string) => any };

function buyerName(b: Buyer): string {
  const full = `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim();
  return full || b.company || b.email || "Unnamed buyer";
}

function tierColor(tier: string | null): string {
  switch ((tier ?? "").toUpperCase()) {
    case "A": return "var(--brand-mint)";
    case "B": return "var(--brand-azure)";
    case "C": return "var(--brand-tangerine)";
    default: return "220 10% 55%";
  }
}

export function BuyersList({ search }: { search: string }) {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await dispo
      .from("dispo_buyers")
      .select("id, first_name, last_name, email, phone, company, source, status, tier, markets, states, strategies, property_types, min_price, max_price, buy_box_notes, updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error(`Couldn't load buyers: ${error.message}`);
      setLoading(false);
      return;
    }
    setBuyers((data as Buyer[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncFromGhl() {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("ghl-sync-buyers");
    setSyncing(false);
    if (error) {
      toast.error(`Sync failed: ${error.message}`);
      return;
    }
    const d = (data ?? {}) as { synced?: number; error?: string };
    if (d.error) {
      toast.error(d.error);
      return;
    }
    toast.success(`Synced ${d.synced ?? 0} buyer${d.synced === 1 ? "" : "s"} from GHL`);
    void load();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return buyers;
    return buyers.filter((b) =>
      [
        buyerName(b),
        b.company,
        b.email,
        ...(b.markets ?? []),
        ...(b.states ?? []),
        ...(b.strategies ?? []),
      ]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q)),
    );
  }, [buyers, search]);

  const syncButton = (
    <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={syncFromGhl} disabled={syncing}>
      <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
      {syncing ? "Syncing…" : "Sync from GHL"}
    </Button>
  );

  return (
    <div className="p-6 space-y-4">
      {/* Header strip */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-baseline gap-3">
          <h3 className="crm-eyebrow">Buyer list</h3>
          {!loading && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {filtered.length} {filtered.length === 1 ? "buyer" : "buyers"}
            </span>
          )}
        </div>
        {syncButton}
      </div>

      {loading ? (
        <div className="crm-card space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-11 rounded-md bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            icon={Users}
            title={buyers.length === 0 ? "No buyers yet" : "No buyers match your search"}
            description={
              buyers.length === 0
                ? "Import your investor-buyer list from GHL — their buy-box (markets, strategy, max price) comes with them."
                : "Try a different market, strategy, name, or company."
            }
          />
          {buyers.length === 0 && <div className="flex justify-center">{syncButton}</div>}
        </div>
      ) : (
        <div className="crm-card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left">
                  <th className="px-4 py-2.5 crm-field-label font-medium">Buyer</th>
                  <th className="px-4 py-2.5 crm-field-label font-medium">Contact</th>
                  <th className="px-4 py-2.5 crm-field-label font-medium">Focus</th>
                  <th className="px-4 py-2.5 crm-field-label font-medium">Strategy</th>
                  <th className="px-4 py-2.5 crm-field-label font-medium text-right">Max price</th>
                  <th className="px-4 py-2.5 crm-field-label font-medium">Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors align-top">
                    <td className="px-4 py-2.5">
                      <div className="font-medium leading-tight">{buyerName(b)}</div>
                      {b.company && (
                        <div className="text-xs text-muted-foreground leading-tight">{b.company}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="space-y-0.5">
                        {b.email && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[180px]">{b.email}</span>
                          </div>
                        )}
                        {b.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3 shrink-0" />
                            {b.phone}
                          </div>
                        )}
                        {!b.email && !b.phone && <span className="text-muted-foreground/60">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 max-w-[220px]">
                      {(b.markets?.length || b.states?.length) ? (
                        <>
                          <div className="text-[13px] leading-tight truncate">
                            {b.markets?.length ? b.markets.join(", ") : "—"}
                          </div>
                          {b.states?.length ? (
                            <div className="text-[11px] text-muted-foreground leading-tight truncate">
                              {b.states.join(", ")}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[13px]">
                      {b.strategies?.length ? (
                        <span className="truncate">{b.strategies.join(", ")}</span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[13px] tabular-nums whitespace-nowrap">
                      {b.max_price == null ? (
                        <span className="text-muted-foreground/60">—</span>
                      ) : (
                        fmtMoney(b.max_price)
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {b.tier ? (
                        <span
                          className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium"
                          style={{
                            backgroundColor: `hsl(${tierColor(b.tier)} / 0.13)`,
                            color: `hsl(${tierColor(b.tier)})`,
                          }}
                        >
                          {b.tier}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default BuyersList;
