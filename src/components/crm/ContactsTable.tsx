import { useEffect, useMemo, useState } from "react";
import { Loader2, Maximize2, Trash2, MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  CONTACT_TYPES,
  CONTACT_TYPE_LABEL,
  contactTypeColor,
  contactTypeLabel,
} from "./contactTypes";
import {
  DataTableShell,
  DataTableHeader,
  DataTableRow,
  DataTablePill,
  DataTableEmpty,
} from "@/components/ui/data-table-shell";
import { InlinePopoverCell, InlineOptionList } from "./InlineCellEditors";

const TEMPLATE = "2.4fr 1fr 1.4fr 1.6fr 1.1fr 40px";

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  status: string;
  tags: string[];
  company_id: string | null;
  owner_id: string | null;
  last_contacted_at: string | null;
  created_at: string;
  contact_type: string | null;
  preferred_contact_method: string | null;
  markets: string[] | null;
  is_active: boolean;
}

interface CompanyLite {
  id: string;
  name: string;
}

interface Props {
  search: string;
  refreshKey: number;
  onOpen: (id: string) => void;
  onChanged: () => void;
}

const TYPE_PILLS: { key: string; label: string }[] = [
  { key: "all", label: "All Types" },
  ...CONTACT_TYPES.map((t) => ({ key: t, label: CONTACT_TYPE_LABEL[t] })),
];

const STATUS_PILLS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];

function initials(first: string, last: string, email: string | null) {
  const f = (first || "").trim();
  const l = (last || "").trim();
  if (f || l) return `${f[0] ?? ""}${l[0] ?? ""}`.toUpperCase() || "?";
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

// Stable pastel avatar bg from id
function avatarBg(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `hsl(${h} 45% 88%)`;
}
function avatarFg(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `hsl(${h} 50% 32%)`;
}

export function ContactsTable({ search, refreshKey, onOpen, onChanged }: Props) {
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<CompanyLite[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("active");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [{ data: rows }, { data: cos }] = await Promise.all([
        supabase
          .from("contacts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("companies").select("id,name").limit(500),
      ]);
      if (!active) return;
      setContacts((rows as Contact[]) || []);
      setCompanies((cos as CompanyLite[]) || []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const companyMap = useMemo(() => {
    const m = new Map<string, string>();
    companies.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [companies]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (typeFilter !== "all" && (c.contact_type || "other") !== typeFilter) return false;
      if (activeFilter === "active" && c.is_active === false) return false;
      if (activeFilter === "inactive" && c.is_active !== false) return false;
      if (!q) return true;
      const name = `${c.first_name} ${c.last_name}`.toLowerCase();
      return (
        name.includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.title ?? "").toLowerCase().includes(q) ||
        (c.markets ?? []).some((m) => m.toLowerCase().includes(q))
      );
    });
  }, [contacts, search, typeFilter, activeFilter]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) {
      toast({ title: "Couldn't delete contact", description: error.message, variant: "destructive" });
      return;
    }
    setContacts((c) => c.filter((x) => x.id !== id));
    onChanged();
  };

  const updateContact = async (id: string, patch: Partial<Contact>) => {
    const prev = contacts;
    setContacts((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("contacts").update(patch as any).eq("id", id);
    if (error) {
      setContacts(prev);
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    onChanged();
  };

  return (
    <div className="px-6 py-5">
      {/* Filter pill bar */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {TYPE_PILLS.map((p) => {
            const isActive = typeFilter === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setTypeFilter(p.key)}
                className={cn(
                  "h-7 px-3 rounded-full text-[11px] font-semibold transition-colors border",
                  isActive
                    ? "bg-brand-azure text-white border-brand-azure"
                    : "bg-card text-muted-foreground border-border/60 hover:bg-muted/50",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="h-5 w-px bg-border/60 hidden md:block" />
        <div className="flex items-center gap-1.5">
          {STATUS_PILLS.map((p) => {
            const isActive = activeFilter === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setActiveFilter(p.key)}
                className={cn(
                  "h-7 px-3 rounded-full text-[11px] font-semibold transition-colors border",
                  isActive
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-border/60 hover:bg-muted/50",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "contact" : "contacts"}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading contacts…
        </div>
      ) : filtered.length === 0 ? (
        <DataTableEmpty
          title="No contacts match"
          hint="Try clearing filters or adding a new contact."
        />
      ) : (
        <DataTableShell>
          <DataTableHeader template={TEMPLATE}>
            <div>Name</div>
            <div>Type</div>
            <div>Company</div>
            <div>Markets</div>
            <div>Last contact</div>
            <div />
          </DataTableHeader>
          {filtered.map((c) => {
            const fullName =
              `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Untitled contact";
            const typeColor = contactTypeColor(c.contact_type);
            const markets = c.markets ?? [];
            const company = c.company_id ? companyMap.get(c.company_id) ?? null : null;
            return (
              <DataTableRow
                key={c.id}
                template={TEMPLATE}
                onClick={() => onOpen(c.id)}
              >
                {/* NAME */}
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                    style={{ backgroundColor: avatarBg(c.id), color: avatarFg(c.id) }}
                  >
                    {initials(c.first_name, c.last_name, c.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold truncate text-foreground leading-tight">
                      {fullName}
                      {c.is_active === false && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          inactive
                        </span>
                      )}
                    </div>
                    {c.email ? (
                      <div className="text-[12px] text-muted-foreground truncate leading-tight">
                        {c.email}
                      </div>
                    ) : (
                      <div className="text-[12px] italic text-muted-foreground/60 leading-tight">
                        no email
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(c.id);
                    }}
                    className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-opacity opacity-0 group-hover:opacity-100"
                    title="Open contact"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* TYPE */}
                <div>
                  <DataTablePill hsl={typeColor}>
                    {contactTypeLabel(c.contact_type)}
                  </DataTablePill>
                </div>

                {/* COMPANY */}
                <div className="truncate min-w-0 pr-2">
                  {company ? (
                    <span className="text-[13px] text-foreground truncate">{company}</span>
                  ) : (
                    <span className="italic text-muted-foreground/60 text-[13px]">—</span>
                  )}
                </div>

                {/* MARKETS */}
                <div className="flex items-center gap-1 min-w-0 pr-2">
                  {markets.length === 0 ? (
                    <span className="italic text-muted-foreground/60 text-[13px]">—</span>
                  ) : (
                    <>
                      {markets.slice(0, 2).map((m) => (
                        <span
                          key={m}
                          className="inline-block px-2 py-0.5 rounded-md text-[11px] bg-muted/60 text-foreground/80 truncate max-w-[110px]"
                        >
                          {m}
                        </span>
                      ))}
                      {markets.length > 2 && (
                        <span className="text-[11px] text-muted-foreground font-medium shrink-0">
                          +{markets.length - 2}
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* LAST CONTACT */}
                <div className="text-[12px] text-muted-foreground">
                  {c.last_contacted_at ? (
                    formatDistanceToNow(new Date(c.last_contacted_at), { addSuffix: true })
                  ) : (
                    <span className="italic text-muted-foreground/60">—</span>
                  )}
                </div>

                {/* MENU */}
                <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-opacity opacity-0 group-hover:opacity-100"
                        title="More"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleDelete(c.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Delete contact
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </DataTableRow>
            );
          })}
        </DataTableShell>
      )}
    </div>
  );
}
