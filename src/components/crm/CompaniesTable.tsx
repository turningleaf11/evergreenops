import { useEffect, useMemo, useState } from "react";
import { Loader2, Building2, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CompanyPeekSheet } from "./CompanyPeekSheet";
import {
  DataTableShell,
  DataTableHeader,
  DataTableRow,
  DataTableEmpty,
} from "@/components/ui/data-table-shell";

interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  website: string | null;
  created_at: string;
}

const TEMPLATE = "2.4fr 1.4fr 1.4fr 2fr";

export function CompaniesTable({ search, refreshKey = 0 }: { search: string; refreshKey?: number }) {
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setCompanies((data as Company[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, [refreshKey]);

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
      <div className="px-6 py-5">
        <DataTableEmpty
          icon={<Building2 className="h-7 w-7" />}
          title="No companies yet"
          hint="Companies will appear here as you add contacts and link them."
        />
      </div>
    );
  }

  return (
    <>
      <div className="px-6 py-5">
        <DataTableShell>
          <DataTableHeader template={TEMPLATE}>
            <div>Name</div>
            <div>Domain</div>
            <div>Industry</div>
            <div>Website</div>
          </DataTableHeader>

          {filtered.map((c) => (
            <DataTableRow
              key={c.id}
              template={TEMPLATE}
              onClick={() => setOpenId(c.id)}
            >
              {/* NAME */}
              <div className="min-w-0 pr-3">
                <div className="text-[14px] font-semibold truncate text-foreground leading-tight">
                  {c.name}
                </div>
              </div>

              {/* DOMAIN */}
              <div className="text-[13px] text-muted-foreground truncate pr-2">
                {c.domain || <span className="italic text-muted-foreground/60">—</span>}
              </div>

              {/* INDUSTRY */}
              <div className="text-[13px] text-muted-foreground truncate pr-2">
                {c.industry || <span className="italic text-muted-foreground/60">—</span>}
              </div>

              {/* WEBSITE */}
              <div className="text-[13px] truncate min-w-0">
                {c.website ? (
                  <a
                    href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Globe className="h-3 w-3" />
                    <span className="truncate">{c.website}</span>
                  </a>
                ) : (
                  <span className="italic text-muted-foreground/60">—</span>
                )}
              </div>
            </DataTableRow>
          ))}
        </DataTableShell>
      </div>

      <CompanyPeekSheet
        companyId={openId}
        onClose={() => setOpenId(null)}
        onChanged={reload}
      />
    </>
  );
}
