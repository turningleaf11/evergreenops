// DealGhlOpportunity — link an OpsHQ deal to its existing GHL opportunity (deals
// already have one), and sync the close. On Closed-Won the deal's stage handler
// fires the writeback; this surface links the opportunity and offers a manual
// re-sync. Never creates opportunities — search, pick, update.

import { useCallback, useEffect, useState } from "react";
import { Link2, Loader2, Search, Check, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const dispo = supabase as unknown as { from: (t: string) => any };
const money = (n: number | null | undefined) => (n == null ? "" : `$${Number(n).toLocaleString()}`);

interface Link {
  ghl_opportunity_id: string | null;
  ghl_opportunity_name: string | null;
  ghl_synced_at: string | null;
}
interface Opp { id: string; name: string; monetaryValue: number | null; status: string | null; contactName: string | null; contactId: string | null }

export function DealGhlOpportunity({
  transactionId,
  defaultQuery,
  isClosed,
}: {
  transactionId: string;
  defaultQuery: string;
  isClosed: boolean;
}) {
  const [link, setLink] = useState<Link | null>(null);
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await dispo.from("crm_transactions")
      .select("ghl_opportunity_id, ghl_opportunity_name, ghl_synced_at").eq("id", transactionId).maybeSingle();
    setLink((data as Link) ?? null);
  }, [transactionId]);
  useEffect(() => { void load(); }, [load]);

  async function pick(o: Opp) {
    await dispo.from("crm_transactions").update({
      ghl_opportunity_id: o.id, ghl_opportunity_name: o.name, ghl_contact_id: o.contactId ?? null,
    }).eq("id", transactionId);
    setOpen(false);
    toast.success("Linked to GHL opportunity");
    void load();
  }

  async function unlink() {
    await dispo.from("crm_transactions").update({ ghl_opportunity_id: null, ghl_opportunity_name: null, ghl_contact_id: null }).eq("id", transactionId);
    setOpen(false); void load();
  }

  async function sync() {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("ghl-opportunity", { body: { action: "close", transactionId } });
    setSyncing(false);
    if (error || (data as any)?.error) { toast.error((data as any)?.message || (data as any)?.error || error?.message || "Sync failed"); return; }
    toast.success("Synced Closed-Won to GHL");
    void load();
  }

  const linked = !!link?.ghl_opportunity_id;

  return (
    <section className="space-y-3">
      <h3 className="crm-eyebrow">GHL opportunity</h3>
      <div className="crm-card flex flex-wrap items-center gap-3">
        <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          {linked ? (
            <>
              <div className="text-sm font-medium truncate">{link!.ghl_opportunity_name || "Linked opportunity"}</div>
              <div className="text-[11px] text-muted-foreground">
                {link!.ghl_synced_at ? `Synced ${new Date(link!.ghl_synced_at).toLocaleDateString()}` : "Linked — not yet synced"}
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Not linked. Link the existing GHL opportunity so the close syncs to your KPIs.</div>
          )}
        </div>
        {linked && isClosed && (
          <Button size="sm" variant="outline" onClick={sync} disabled={syncing} className="gap-1.5">
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Sync now
          </Button>
        )}
        <Button size="sm" variant={linked ? "ghost" : "default"} onClick={() => setOpen(true)}>
          {linked ? "Change" : "Link opportunity"}
        </Button>
      </div>

      <SearchDialog open={open} onOpenChange={setOpen} defaultQuery={defaultQuery} onPick={pick} onUnlink={linked ? unlink : undefined} />
    </section>
  );
}

function SearchDialog({
  open, onOpenChange, defaultQuery, onPick, onUnlink,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultQuery: string;
  onPick: (o: Opp) => void;
  onUnlink?: () => void;
}) {
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState<Opp[]>([]);
  const [searching, setSearching] = useState(false);
  const [ran, setRan] = useState(false);

  useEffect(() => { if (open) { setQuery(defaultQuery); setResults([]); setRan(false); } }, [open, defaultQuery]);

  async function run() {
    if (!query.trim()) return;
    setSearching(true); setRan(true);
    const { data, error } = await supabase.functions.invoke("ghl-opportunity", { body: { action: "search", query } });
    setSearching(false);
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message || "Search failed"); return; }
    setResults(((data as any).opportunities as Opp[]) ?? []);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Link GHL opportunity</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="Search by contact or address…" className="h-9" />
          <Button onClick={run} disabled={searching} className="gap-1.5">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
          </Button>
        </div>
        <div className="max-h-[46vh] overflow-y-auto space-y-1.5">
          {results.map((o) => (
            <button key={o.id} type="button" onClick={() => onPick(o)} className="w-full flex items-center gap-3 rounded-lg border border-border/60 p-3 text-left hover:bg-muted/40">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{o.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {[o.contactName, o.status, money(o.monetaryValue)].filter(Boolean).join(" · ")}
                </div>
              </div>
              <Check className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            </button>
          ))}
          {ran && !searching && results.length === 0 && (
            <p className="text-sm text-muted-foreground italic px-1 py-4 text-center">No opportunities found for that search.</p>
          )}
        </div>
        {onUnlink && (
          <button type="button" onClick={onUnlink} className="text-xs text-muted-foreground hover:text-brand-coral self-start">
            Unlink this deal
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default DealGhlOpportunity;
