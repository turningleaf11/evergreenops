import { useEffect, useMemo, useState } from "react";
import { Loader2, Building2, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  website: string | null;
  created_at: string;
}

export function CompaniesTable({ search }: { search: string }) {
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      setCompanies((data as Company[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.domain ?? "").toLowerCase().includes(q) ||
        (c.industry ?? "").toLowerCase().includes(q)
    );
  }, [companies, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading companies…
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-sm text-muted-foreground">
        <Building2 className="h-8 w-8 mb-3 opacity-50" />
        <p className="font-medium text-foreground mb-1">No companies yet</p>
        <p>Companies will appear here as you add contacts and link them.</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-4">
      <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
        <div className="grid grid-cols-[2fr_1.5fr_1.5fr_2fr] px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border/50 bg-muted/30">
          <div>Name</div>
          <div>Domain</div>
          <div>Industry</div>
          <div>Website</div>
        </div>
        {filtered.map((c) => (
          <div
            key={c.id}
            className="grid grid-cols-[2fr_1.5fr_1.5fr_2fr] items-center px-3 py-2 text-sm border-b border-border/30 last:border-b-0 hover:bg-muted/30 transition-colors"
          >
            <div className="font-medium truncate">{c.name}</div>
            <div className="text-muted-foreground truncate">{c.domain || "—"}</div>
            <div className="text-muted-foreground truncate">{c.industry || "—"}</div>
            <div className="truncate">
              {c.website ? (
                <a
                  href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Globe className="h-3 w-3" />
                  {c.website}
                </a>
              ) : (
                <span className="text-muted-foreground/60">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
