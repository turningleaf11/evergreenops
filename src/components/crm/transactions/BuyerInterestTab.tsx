// BuyerInterestTab — the buyer↔deal relationship surface for one transaction.
//
// This is the piece GHL structurally can't model: many buyers against one
// deal, each pairing carrying its own stage (interested → showing → offer →
// won) and its own offer amount. Data lives in `dispo_deal_interests`
// (interest per deal) joined to `dispo_buyers` (the buyer, GHL-sourced).
//
// Phase 1 scope: view / add / stage / offer / remove buyer interest, entered
// manually. Phase 2 wires the GHL buyer sync + buy-box match that populate it.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Users, X, Search, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/primitives";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { fmtMoney } from "./utils";

interface Buyer {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  tier: string | null;
  status: string | null;
}

interface Interest {
  id: string;
  transaction_id: string;
  buyer_id: string;
  level: string;
  offer_amount: number | null;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Row extends Interest {
  buyer: Buyer | null;
}

const DEFAULT_LEVEL = "interested";

// The dispo_* tables were created directly in the database and aren't in the
// generated Supabase types yet, so `.from("dispo_*")` types as `never`. Route
// dispo reads/writes through this untyped handle until types.ts is regenerated;
// the row shapes above are the contract in the meantime.
const dispo = supabase as unknown as { from: (table: string) => any };

function buyerName(b: Buyer | null): string {
  if (!b) return "Unknown buyer";
  const full = `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim();
  return full || b.company || b.email || "Unnamed buyer";
}

export function BuyerInterestTab({ transactionId }: { transactionId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [interestsRes, buyersRes] = await Promise.all([
      dispo
        .from("dispo_deal_interests")
        .select("*")
        .eq("transaction_id", transactionId)
        .order("created_at", { ascending: true }),
      dispo
        .from("dispo_buyers")
        .select("id, first_name, last_name, company, email, phone, tier, status"),
    ]);

    if (interestsRes.error) {
      toast.error(`Couldn't load buyer interest: ${interestsRes.error.message}`);
      setLoading(false);
      return;
    }
    const buyerList = (buyersRes.data as Buyer[]) ?? [];
    const byId = new Map(buyerList.map((b) => [b.id, b]));
    setBuyers(buyerList);
    setRows(
      ((interestsRes.data as Interest[]) ?? []).map((i) => ({
        ...i,
        buyer: byId.get(i.buyer_id) ?? null,
      })),
    );
    setLoading(false);
  }, [transactionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addedBuyerIds = useMemo(() => new Set(rows.map((r) => r.buyer_id)), [rows]);
  const available = useMemo(
    () => buyers.filter((b) => !addedBuyerIds.has(b.id)),
    [buyers, addedBuyerIds],
  );

  async function addBuyer(buyerId: string) {
    setAddOpen(false);
    const { error } = await dispo.from("dispo_deal_interests").insert({
      transaction_id: transactionId,
      buyer_id: buyerId,
      level: DEFAULT_LEVEL,
    });
    if (error) {
      toast.error(`Couldn't add buyer: ${error.message}`);
      return;
    }
    toast.success("Buyer added to deal");
    void load();
  }

  async function setLevel(id: string, level: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, level } : r)));
    const { error } = await dispo
      .from("dispo_deal_interests")
      .update({ level, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(`Couldn't update stage: ${error.message}`);
      void load();
    }
  }

  async function setOffer(id: string, offer: number | null) {
    const { error } = await dispo
      .from("dispo_deal_interests")
      .update({ offer_amount: offer, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(`Couldn't save offer: ${error.message}`);
      void load();
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, offer_amount: offer } : r)));
  }

  async function remove(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    const { error } = await dispo.from("dispo_deal_interests").delete().eq("id", id);
    if (error) {
      toast.error(`Couldn't remove buyer: ${error.message}`);
      void load();
      return;
    }
    toast.success("Buyer removed from deal");
  }

  const topOffer = useMemo(
    () => rows.reduce<number | null>((max, r) => {
      if (r.offer_amount == null) return max;
      return max == null || r.offer_amount > max ? r.offer_amount : max;
    }, null),
    [rows],
  );

  const addButton = (
    <Popover open={addOpen} onOpenChange={setAddOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 h-8">
          <Plus className="h-3.5 w-3.5" />
          Add buyer
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="p-0 w-72">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="h-3.5 w-3.5 shrink-0 opacity-50" />
            <CommandInput placeholder="Search buyers…" className="h-9 border-0" />
          </div>
          <CommandList>
            <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
              {buyers.length === 0
                ? "No buyers yet. Sync your buyer list from GHL (coming in Phase 2)."
                : "Every buyer is already on this deal."}
            </CommandEmpty>
            {available.length > 0 && (
              <CommandGroup>
                {available.map((b) => (
                  <CommandItem
                    key={b.id}
                    value={`${buyerName(b)} ${b.company ?? ""} ${b.email ?? ""}`}
                    onSelect={() => addBuyer(b.id)}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate">
                      <span className="font-medium">{buyerName(b)}</span>
                      {b.company && (
                        <span className="text-muted-foreground"> · {b.company}</span>
                      )}
                    </span>
                    {b.tier && (
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                        {b.tier}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  return (
    <section className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h3 className="crm-eyebrow">Buyer interest</h3>
          {rows.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {rows.length} {rows.length === 1 ? "buyer" : "buyers"}
              {topOffer != null && (
                <span className="ml-2 inline-flex items-center gap-1 text-brand-mint-deep">
                  <TrendingUp className="h-3 w-3" />
                  top {fmtMoney(topOffer)}
                </span>
              )}
            </span>
          )}
        </div>
        {rows.length > 0 && addButton}
      </div>

      {loading ? (
        <div className="crm-card space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 rounded-md bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            icon={Users}
            title="No buyers tracked yet"
            description="Add the buyers interested in this deal to track their stage and offers in one place — the view GHL can't give you."
          />
          <div className="flex justify-center">{addButton}</div>
        </div>
      ) : (
        <div className="crm-card !p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left">
                <th className="px-4 py-2.5 crm-field-label font-medium">Buyer</th>
                <th className="px-4 py-2.5 crm-field-label font-medium">Stage</th>
                <th className="px-4 py-2.5 crm-field-label font-medium">Offer</th>
                <th className="px-4 py-2.5 crm-field-label font-medium">Added</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((r) => (
                <tr key={r.id} className="group hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="font-medium leading-tight">{buyerName(r.buyer)}</div>
                    {(r.buyer?.company || r.buyer?.email) && (
                      <div className="text-xs text-muted-foreground leading-tight">
                        {r.buyer?.company || r.buyer?.email}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill
                      kind="buyer_interest"
                      value={r.level}
                      onChange={(v) => setLevel(r.id, v)}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <OfferCell value={r.offer_amount} onSave={(v) => setOffer(r.id, v)} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-2">
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      aria-label={`Remove ${buyerName(r.buyer)} from deal`}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-md text-muted-foreground hover:text-brand-coral hover:bg-brand-coral/10 transition-all"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// Inline-editable offer amount. Shows the formatted money until clicked, then
// a bare number input that commits on blur / Enter.
function OfferCell({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? "" : String(value));

  useEffect(() => {
    setDraft(value == null ? "" : String(value));
  }, [value]);

  function commit() {
    setEditing(false);
    const next = draft.trim() === "" ? null : Number(draft);
    if (next != null && isNaN(next)) return;
    if (next !== value) onSave(next);
  }

  if (editing) {
    return (
      <Input
        autoFocus
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value == null ? "" : String(value));
            setEditing(false);
          }
        }}
        className="h-8 w-28 tabular-nums"
        placeholder="0"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "tabular-nums rounded px-1.5 py-0.5 -mx-1.5 hover:bg-muted transition-colors",
        value == null && "text-muted-foreground",
      )}
    >
      {value == null ? "Add offer" : fmtMoney(value)}
    </button>
  );
}

export default BuyerInterestTab;
