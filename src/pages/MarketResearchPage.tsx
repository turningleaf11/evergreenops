import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Building, Search } from "lucide-react";
import { MarketCard, type MarketSummary } from "@/components/markets/MarketCard";
import { AddMarketDialog } from "@/components/markets/AddMarketDialog";
import { MarketWorkspace } from "@/components/markets/MarketWorkspace";

export default function MarketResearchPage() {
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    // Fetch markets + their latest analysis date
    const { data: ms } = await supabase
      .from("markets")
      .select("id, name, location, strategy, updated_at, decision")
      .order("updated_at", { ascending: false });
    const { data: latestByMarket } = await supabase
      .from("market_research")
      .select("market_id, created_at")
      .not("market_id", "is", null)
      .order("created_at", { ascending: false });

    const lastMap = new Map<string, string>();
    for (const r of (latestByMarket as any[] | null) || []) {
      if (r.market_id && !lastMap.has(r.market_id)) lastMap.set(r.market_id, r.created_at);
    }
    setMarkets(((ms as any[]) || []).map((m) => ({ ...m, last_analyzed_at: lastMap.get(m.id) ?? null })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = markets.filter((m) =>
    !query.trim() || m.name.toLowerCase().includes(query.toLowerCase()) || (m.location || "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-8 space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Markets</h1>
          <p className="text-sm text-muted-foreground">Track research and AI analysis per market</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search markets…" className="pl-8 h-9 w-56" />
          </div>
          <Button onClick={() => setAdding(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Add market</Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/30 p-12 text-center space-y-3">
          <Building className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <div>
            <p className="text-sm font-medium">No markets yet</p>
            <p className="text-xs text-muted-foreground">Add your first market to start tracking research.</p>
          </div>
          <Button onClick={() => setAdding(true)} variant="outline" className="gap-1.5"><Plus className="h-4 w-4" /> Add market</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((m) => (
            <MarketCard key={m.id} market={m} onClick={() => setOpenId(m.id)} />
          ))}
        </div>
      )}

      <AddMarketDialog open={adding} onOpenChange={setAdding} onCreated={load} />
      <MarketWorkspace marketId={openId} open={!!openId} onOpenChange={(v) => !v && setOpenId(null)} onChanged={load} />
    </div>
  );
}
