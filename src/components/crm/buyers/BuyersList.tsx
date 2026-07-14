// BuyersList — the standalone investor-buyer list (dispo_buyers).
//
// Buyers are the demand side of the business: GHL-sourced, carrying a buy-box
// (markets, states, strategies, max price, tier). This is their home. Each
// deal's Buyers tab just references buyers from here; buyer management and the
// GHL sync live on this surface, not inside a deal.

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Users, Mail, Phone, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  DataTableShell,
  DataTableHeader,
  DataTableRow,
  DataTablePill,
} from "@/components/ui/data-table-shell";
import { fmtMoney } from "../transactions/utils";

interface Buyer {
  id: string;
  ghl_contact_id: string | null;
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

// dispo_* + app_settings reads through an untyped handle (dispo_* aren't in the
// generated Supabase types; app_settings is admin-readable per RLS).
const db = supabase as unknown as { from: (table: string) => any };

const GRID = "1.7fr 1.5fr 1.5fr 1.1fr 0.9fr 0.6fr 40px";

function titleCase(s: string | null): string {
  if (!s) return "";
  return s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function buyerName(b: Buyer): string {
  const full = `${titleCase(b.first_name)} ${titleCase(b.last_name)}`.trim();
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
  const [ghlLocation, setGhlLocation] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db
      .from("dispo_buyers")
      .select("id, ghl_contact_id, first_name, last_name, email, phone, company, source, status, tier, markets, states, strategies, property_types, min_price, max_price, buy_box_notes, updated_at")
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
    // Location id (admin-readable) powers the "open in GHL" deep-link. We fetch
    // only this key — never the API key.
    void (async () => {
      const { data } = await db
        .from("app_settings")
        .select("value")
        .eq("key", "GHL_LOCATION_ID")
        .maybeSingle();
      setGhlLocation(data?.value ?? null);
    })();
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

  const ghlUrl = (b: Buyer): string | null =>
    ghlLocation && b.ghl_contact_id
      ? `https://app.gohighlevel.com/v2/location/${ghlLocation}/contacts/detail/${b.ghl_contact_id}`
      : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return buyers;
    return buyers.filter((b) =>
      [buyerName(b), b.company, b.email, ...(b.markets ?? []), ...(b.states ?? []), ...(b.strategies ?? [])]
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
        <DataTableShell className="p-2 space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-11 rounded-md bg-muted/40 animate-pulse" />
          ))}
        </DataTableShell>
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
        <DataTableShell>
          <DataTableHeader template={GRID}>
            <div>Buyer</div>
            <div>Contact</div>
            <div>Focus</div>
            <div>Strategy</div>
            <div className="text-right">Max price</div>
            <div>Tier</div>
            <div />
          </DataTableHeader>
          {filtered.map((b) => {
            const url = ghlUrl(b);
            return (
              <DataTableRow key={b.id} template={GRID}>
                {/* BUYER */}
                <div className="min-w-0 pr-3">
                  <div className="font-medium truncate leading-tight">{buyerName(b)}</div>
                  {b.company && (
                    <div className="text-xs text-muted-foreground truncate leading-tight">{b.company}</div>
                  )}
                </div>

                {/* CONTACT */}
                <div className="min-w-0 pr-3 space-y-0.5">
                  {b.email ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{b.email}</span>
                    </div>
                  ) : null}
                  {b.phone ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" />
                      {b.phone}
                    </div>
                  ) : null}
                  {!b.email && !b.phone && <span className="text-muted-foreground/50">—</span>}
                </div>

                {/* FOCUS */}
                <div className="min-w-0 pr-3">
                  {b.markets?.length || b.states?.length ? (
                    <>
                      <div className="text-[13px] truncate leading-tight">
                        {b.markets?.length ? b.markets.join(", ") : "—"}
                      </div>
                      {b.states?.length ? (
                        <div className="text-[11px] text-muted-foreground truncate leading-tight">
                          {b.states.join(", ")}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </div>

                {/* STRATEGY */}
                <div className="min-w-0 pr-3 text-[13px] truncate">
                  {b.strategies?.length ? b.strategies.join(", ") : <span className="text-muted-foreground/50">—</span>}
                </div>

                {/* MAX PRICE */}
                <div className="text-right text-[13px] tabular-nums whitespace-nowrap">
                  {b.max_price == null ? <span className="text-muted-foreground/50">—</span> : fmtMoney(b.max_price)}
                </div>

                {/* TIER */}
                <div>
                  {b.tier ? (
                    <DataTablePill hsl={tierColor(b.tier)}>{b.tier}</DataTablePill>
                  ) : (
                    <span className="text-muted-foreground/50 text-xs">—</span>
                  )}
                </div>

                {/* OPEN IN GHL */}
                <div className="flex justify-end">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in GHL"
                      aria-label={`Open ${buyerName(b)} in GHL`}
                      className="p-1.5 rounded-md text-muted-foreground/70 hover:text-brand-azure hover:bg-brand-azure/10 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              </DataTableRow>
            );
          })}
        </DataTableShell>
      )}
    </div>
  );
}

export default BuyersList;
