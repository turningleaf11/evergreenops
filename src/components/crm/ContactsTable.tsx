import { useEffect, useMemo, useState } from "react";
import { Loader2, Maximize2, Mail, Phone, Trash2, MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

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
}

interface CompanyLite {
  id: string;
  name: string;
}

const STATUS_COLOR: Record<string, string> = {
  lead: "210 70% 50%",
  active: "142 76% 36%",
  customer: "262 70% 55%",
  lost: "0 70% 50%",
};

interface Props {
  search: string;
  refreshKey: number;
  onOpen: (id: string) => void;
  onChanged: () => void;
}

export function ContactsTable({ search, refreshKey, onOpen, onChanged }: Props) {
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<CompanyLite[]>([]);

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
    if (!q) return contacts;
    return contacts.filter((c) => {
      const name = `${c.first_name} ${c.last_name}`.toLowerCase();
      return (
        name.includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.title ?? "").toLowerCase().includes(q)
      );
    });
  }, [contacts, search]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) {
      toast({ title: "Couldn't delete contact", description: error.message, variant: "destructive" });
      return;
    }
    setContacts((c) => c.filter((x) => x.id !== id));
    onChanged();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading contacts…
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">No contacts yet</p>
        <p>Click "New contact" to add your first one.</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-4">
      <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
        <div className="grid grid-cols-[2fr_2fr_1.5fr_1.5fr_1fr_1.2fr_40px] px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border/50 bg-muted/30">
          <div>Name</div>
          <div>Email</div>
          <div>Phone</div>
          <div>Company</div>
          <div>Status</div>
          <div>Last contact</div>
          <div />
        </div>
        {filtered.map((c) => {
          const name = `${c.first_name} ${c.last_name}`.trim() || "Untitled contact";
          const colorVar = STATUS_COLOR[c.status] || "220 12% 60%";
          return (
            <div
              key={c.id}
              className="group grid grid-cols-[2fr_2fr_1.5fr_1.5fr_1fr_1.2fr_40px] items-center px-3 py-2 text-sm border-b border-border/30 last:border-b-0 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-1 min-w-0">
                <button
                  onClick={() => onOpen(c.id)}
                  className="font-medium text-left truncate hover:underline flex-1 min-w-0"
                >
                  {name}
                </button>
                <button
                  onClick={() => onOpen(c.id)}
                  className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                  title="Open contact"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="truncate min-w-0">
                {c.email ? (
                  <a
                    href={`mailto:${c.email}`}
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Mail className="h-3 w-3" />
                    {c.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground/60">—</span>
                )}
              </div>
              <div className="truncate min-w-0">
                {c.phone ? (
                  <a href={`tel:${c.phone}`} className="text-primary hover:underline inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {c.phone}
                  </a>
                ) : (
                  <span className="text-muted-foreground/60">—</span>
                )}
              </div>
              <div className="truncate min-w-0 text-muted-foreground">
                {c.company_id ? companyMap.get(c.company_id) ?? "—" : <span className="text-muted-foreground/60">—</span>}
              </div>
              <div>
                <Badge
                  variant="outline"
                  className="text-[10px] capitalize"
                  style={{ borderColor: `hsl(${colorVar})`, color: `hsl(${colorVar})` }}
                >
                  {c.status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {c.last_contacted_at
                  ? formatDistanceToNow(new Date(c.last_contacted_at), { addSuffix: true })
                  : "—"}
              </div>
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
