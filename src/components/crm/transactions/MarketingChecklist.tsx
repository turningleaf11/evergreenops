// MarketingChecklist — the editable, categorized "get it out there" checklist
// for a deal's Marketing phase (Direct · Post online · 3rd party · Hedge funds).
// Per-deal copy, seeded from DEFAULT_MARKETING_CHECKLIST, stored as jsonb on
// dispo_deal_details.marketing_checklist. Separate from the TC closing checklist.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { DEFAULT_MARKETING_CHECKLIST, type MarketingGroup } from "@/lib/dealVocab";

const dispo = supabase as unknown as { from: (table: string) => any };

export function MarketingChecklist({ transactionId }: { transactionId: string }) {
  const [groups, setGroups] = useState<MarketingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null); // category being added-to
  const [draft, setDraft] = useState("");
  const [newCat, setNewCat] = useState("");
  const [addingCat, setAddingCat] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await dispo
      .from("dispo_deal_details")
      .select("marketing_checklist")
      .eq("transaction_id", transactionId)
      .maybeSingle();
    const stored = (data?.marketing_checklist as MarketingGroup[] | null) ?? null;
    setGroups(stored && stored.length ? stored : structuredClone(DEFAULT_MARKETING_CHECKLIST));
    setLoading(false);
  }, [transactionId]);

  useEffect(() => { void load(); }, [load]);

  // Persist the whole checklist (upsert — the details row may not exist yet).
  const persist = useCallback(async (next: MarketingGroup[]) => {
    setGroups(next);
    const { error } = await dispo
      .from("dispo_deal_details")
      .upsert({ transaction_id: transactionId, marketing_checklist: next, updated_at: new Date().toISOString() }, { onConflict: "transaction_id" });
    if (error) { toast.error(`Couldn't save: ${error.message}`); void load(); }
  }, [transactionId, load]);

  const { done, total } = useMemo(() => {
    let d = 0, t = 0;
    groups.forEach((g) => g.items.forEach((i) => { t++; if (i.done) d++; }));
    return { done: d, total: t };
  }, [groups]);
  const pct = total ? (done / total) * 100 : 0;

  function toggle(gi: number, ii: number) {
    const next = groups.map((g, gx) =>
      gx !== gi ? g : { ...g, items: g.items.map((it, ix) => (ix === ii ? { ...it, done: !it.done } : it)) },
    );
    void persist(next);
  }
  function removeItem(gi: number, ii: number) {
    const next = groups.map((g, gx) => (gx !== gi ? g : { ...g, items: g.items.filter((_, ix) => ix !== ii) }));
    void persist(next);
  }
  function addItem(gi: number) {
    const label = draft.trim();
    if (!label) { setAdding(null); return; }
    const next = groups.map((g, gx) => (gx !== gi ? g : { ...g, items: [...g.items, { label, done: false }] }));
    setDraft("");
    setAdding(null);
    void persist(next);
  }
  function addCategory() {
    const cat = newCat.trim();
    if (!cat) { setAddingCat(false); return; }
    setNewCat("");
    setAddingCat(false);
    void persist([...groups, { cat, items: [] }]);
  }
  function removeGroup(gi: number) {
    void persist(groups.filter((_, gx) => gx !== gi));
  }

  if (loading) {
    return <div className="space-y-2 max-w-2xl">{[0, 1, 2].map((i) => <div key={i} className="h-8 rounded bg-muted/40 animate-pulse" />)}</div>;
  }

  return (
    <section className="space-y-3 max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h3 className="crm-eyebrow">Marketing checklist</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{done} of {total}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-brand-azure transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="space-y-4 pt-1">
        {groups.map((g, gi) => (
          <div key={gi} className="group/cat">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.cat}</span>
              <button
                type="button"
                onClick={() => removeGroup(gi)}
                className="opacity-0 group-hover/cat:opacity-100 text-muted-foreground/60 hover:text-brand-coral transition-opacity"
                title="Remove category"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="crm-card !p-1.5 divide-y divide-border/30">
              {g.items.map((it, ii) => (
                <div key={ii} className="group/item flex items-center gap-2.5 px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => toggle(gi, ii)}
                    className={cn(
                      "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                      it.done ? "bg-brand-mint border-brand-mint text-white" : "border-border hover:border-brand-azure",
                    )}
                  >
                    {it.done && <Check className="h-3 w-3" strokeWidth={3} />}
                  </button>
                  <span className={cn("text-sm flex-1", it.done && "line-through text-muted-foreground")}>{it.label}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(gi, ii)}
                    className="opacity-0 group-hover/item:opacity-100 text-muted-foreground/60 hover:text-brand-coral transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {adding === g.cat ? (
                <div className="px-2 py-1.5">
                  <Input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => addItem(gi)}
                    onKeyDown={(e) => { if (e.key === "Enter") addItem(gi); if (e.key === "Escape") { setDraft(""); setAdding(null); } }}
                    placeholder="New item…"
                    className="h-7 text-sm"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setAdding(g.cat); setDraft(""); }}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs text-brand-azure hover:underline"
                >
                  <Plus className="h-3 w-3" /> Add item
                </button>
              )}
            </div>
          </div>
        ))}

        {addingCat ? (
          <Input
            autoFocus
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onBlur={addCategory}
            onKeyDown={(e) => { if (e.key === "Enter") addCategory(); if (e.key === "Escape") { setNewCat(""); setAddingCat(false); } }}
            placeholder="New category…"
            className="h-8 text-sm max-w-xs"
          />
        ) : (
          <button type="button" onClick={() => setAddingCat(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand-azure">
            <Plus className="h-3.5 w-3.5" /> Add category
          </button>
        )}
      </div>
    </section>
  );
}

export default MarketingChecklist;
