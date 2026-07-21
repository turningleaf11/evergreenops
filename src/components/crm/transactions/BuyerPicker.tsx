// BuyerPicker — pick the deal's end buyer from the buyers list (dispo_buyers),
// not from contacts. Compact card matching PersonCard: shows the linked buyer
// with contact info, or a search to attach one.

import { useCallback, useEffect, useState } from "react";
import { UserRound, Search, Loader2, Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

const dispo = supabase as unknown as { from: (t: string) => any };

interface Buyer {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
}

function titleCase(s: string | null): string {
  if (!s) return "";
  return s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
const buyerName = (b: Buyer) => `${titleCase(b.first_name)} ${titleCase(b.last_name)}`.trim() || b.company || b.email || "Unnamed buyer";

export function BuyerPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Buyer[]>([]);
  const [searching, setSearching] = useState(false);

  // Resolve the currently-linked buyer.
  const loadCurrent = useCallback(async () => {
    if (!value) { setBuyer(null); return; }
    const { data } = await dispo.from("dispo_buyers").select("id, first_name, last_name, company, email, phone").eq("id", value).maybeSingle();
    setBuyer((data as Buyer) ?? null);
  }, [value]);
  useEffect(() => { void loadCurrent(); }, [loadCurrent]);

  // Debounced search of the buyers list.
  useEffect(() => {
    if (buyer) return;
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    let active = true;
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await dispo
        .from("dispo_buyers")
        .select("id, first_name, last_name, company, email, phone")
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(8);
      if (!active) return;
      setResults((data as Buyer[]) ?? []);
      setSearching(false);
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [query, buyer]);

  function pick(b: Buyer) {
    onChange(b.id);
    setBuyer(b);
    setQuery("");
    setResults([]);
  }

  return (
    <div className="rounded-xl bg-card p-5 space-y-3 border border-border/40" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div className="crm-eyebrow flex items-center gap-1.5">
        <UserRound className="h-3.5 w-3.5" /> Buyer
      </div>
      {buyer ? (
        <div className="space-y-1.5">
          <div className="text-sm font-medium">{buyerName(buyer)}{buyer.company && <span className="text-muted-foreground font-normal"> · {buyer.company}</span>}</div>
          {buyer.email && (
            <a href={`mailto:${buyer.email}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand-azure"><Mail className="h-3 w-3" /> {buyer.email}</a>
          )}
          {buyer.phone && (
            <a href={`tel:${buyer.phone}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand-azure"><Phone className="h-3 w-3" /> {buyer.phone}</a>
          )}
          <button onClick={() => { onChange(null); setBuyer(null); }} className="text-[11px] text-muted-foreground hover:text-destructive">Remove</button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the buyers list…" className="h-9 pl-8 text-sm" />
            {searching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          {results.length > 0 && (
            <div className="rounded-lg border border-border/60 divide-y divide-border/30 overflow-hidden">
              {results.map((b) => (
                <button key={b.id} type="button" onClick={() => pick(b)} className="w-full text-left px-2.5 py-1.5 hover:bg-muted/40">
                  <div className="text-sm truncate">{buyerName(b)}</div>
                  {(b.company || b.email) && <div className="text-[11px] text-muted-foreground truncate">{[b.company, b.email].filter(Boolean).join(" · ")}</div>}
                </button>
              ))}
            </div>
          )}
          {query.trim().length >= 2 && !searching && results.length === 0 && (
            <p className="text-[11px] text-muted-foreground px-1">No buyers match. Buyers sync from GHL.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default BuyerPicker;
