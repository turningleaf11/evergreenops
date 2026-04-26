import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, X, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ContactLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  contact_type: string | null;
}

export function ContactPicker({
  value,
  onChange,
  placeholder = "Search contacts…",
  className,
}: {
  value: string | null;
  onChange: (id: string | null, contact: ContactLite | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<ContactLite[]>([]);
  const [selected, setSelected] = useState<ContactLite | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id,first_name,last_name,email,contact_type")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (!active) return;
      setContacts((data as ContactLite[]) || []);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    const found = contacts.find((c) => c.id === value);
    if (found) setSelected(found);
    else {
      // fetch single
      (async () => {
        const { data } = await supabase
          .from("contacts")
          .select("id,first_name,last_name,email,contact_type")
          .eq("id", value)
          .maybeSingle();
        if (data) setSelected(data as ContactLite);
      })();
    }
  }, [value, contacts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts.slice(0, 50);
    return contacts
      .filter((c) => {
        const blob = `${c.first_name ?? ""} ${c.last_name ?? ""} ${c.email ?? ""}`.toLowerCase();
        return blob.includes(q);
      })
      .slice(0, 50);
  }, [contacts, query]);

  const label = selected
    ? `${selected.first_name ?? ""} ${selected.last_name ?? ""}`.trim() ||
      selected.email ||
      "Unnamed contact"
    : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full inline-flex items-center justify-between gap-2 h-9 rounded-md border border-input bg-background px-3 text-sm text-left",
            "hover:bg-muted/40 transition-colors",
            className,
          )}
        >
          <span className="flex items-center gap-2 min-w-0">
            <UserIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {selected ? (
              <span className="truncate">{label}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          {selected ? (
            <X
              className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null, null);
              }}
            />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <div className="p-2 border-b border-border/40">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-[260px] overflow-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No matching contacts
            </div>
          ) : (
            filtered.map((c) => {
              const name =
                `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() ||
                c.email ||
                "Unnamed";
              const isSel = selected?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange(c.id, c);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/60",
                    isSel && "bg-muted/40",
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{name}</div>
                    {c.email && (
                      <div className="text-[11px] text-muted-foreground truncate">
                        {c.email}
                      </div>
                    )}
                  </div>
                  {isSel && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
