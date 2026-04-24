import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link2, Loader2, Plus, X, Check, UserPlus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { QuickCreateDialog } from "@/components/crm/QuickCreateDialog";

interface Suggestion {
  entity_type: "contact" | "deal";
  entity_id: string;
  display_name: string;
  matched_email: string | null;
  secondary: string | null;
}

interface ExistingLink {
  id: string;
  entity_type: string;
  entity_id: string;
}

interface SearchResult {
  entity_type: "contact" | "deal" | "company";
  entity_id: string;
  display_name: string;
  secondary: string | null;
}

interface Props {
  threadId: string;
  participantEmails: string[];
  subject: string;
  snippet: string;
  workspaceId: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  contact: "Contact",
  deal: "Deal",
  company: "Company",
};

export function LinkToCrm({
  threadId,
  participantEmails,
  subject,
  snippet,
  workspaceId,
}: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [existing, setExisting] = useState<ExistingLink[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Derive a sensible prefill from the first non-self participant email.
  const primaryParticipant = useMemo(() => {
    const e = participantEmails.find((x) => !!x);
    if (!e) return undefined;
    // try to derive name from the address (e.g. "first.last@..." → "First Last")
    const local = e.split("@")[0];
    const parts = local.split(/[._-]/).filter(Boolean);
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    return {
      email: e,
      firstName: parts[0] ? cap(parts[0]) : "",
      lastName: parts.slice(1).map(cap).join(" "),
    };
  }, [participantEmails]);

  const linkedKeys = useMemo(
    () => new Set(existing.map((l) => `${l.entity_type}:${l.entity_id}`)),
    [existing],
  );

  const refresh = async () => {
    setLoading(true);
    const [{ data: links }, { data: sugg }] = await Promise.all([
      supabase
        .from("email_links")
        .select("id,entity_type,entity_id")
        .eq("gmail_thread_id", threadId),
      participantEmails.length > 0
        ? supabase.rpc("crm_suggest_links_for_emails", { _emails: participantEmails })
        : Promise.resolve({ data: [] as Suggestion[] } as any),
    ]);
    const linkRows = (links as ExistingLink[]) || [];
    setExisting(linkRows);
    setSuggestions(((sugg as Suggestion[]) || []).filter(Boolean));

    // Resolve display names for linked records
    const contactIds = linkRows.filter((l) => l.entity_type === "contact").map((l) => l.entity_id);
    const dealIds = linkRows.filter((l) => l.entity_type === "deal").map((l) => l.entity_id);
    const companyIds = linkRows.filter((l) => l.entity_type === "company").map((l) => l.entity_id);
    const [contactsRes, dealsRes, companiesRes] = await Promise.all([
      contactIds.length
        ? supabase.from("contacts").select("id,first_name,last_name,email").in("id", contactIds)
        : Promise.resolve({ data: [] as any[] } as any),
      dealIds.length
        ? supabase.from("deals").select("id,title").in("id", dealIds)
        : Promise.resolve({ data: [] as any[] } as any),
      companyIds.length
        ? supabase.from("companies").select("id,name").in("id", companyIds)
        : Promise.resolve({ data: [] as any[] } as any),
    ]);
    const map: Record<string, string> = {};
    (contactsRes.data || []).forEach((c: any) => {
      map[`contact:${c.id}`] = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Contact";
    });
    (dealsRes.data || []).forEach((d: any) => { map[`deal:${d.id}`] = d.title || "Deal"; });
    (companiesRes.data || []).forEach((c: any) => { map[`company:${c.id}`] = c.name || "Company"; });
    setNames(map);
    setLoading(false);
  };

  useEffect(() => {
    if (open) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, threadId]);

  // Search contacts/deals/companies
  useEffect(() => {
    if (!open || search.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const q = `%${search.trim()}%`;
    (async () => {
      const [contacts, deals, companies] = await Promise.all([
        supabase
          .from("contacts")
          .select("id,first_name,last_name,email,title")
          .or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q}`)
          .limit(5),
        supabase.from("deals").select("id,title,status").ilike("title", q).limit(5),
        supabase.from("companies").select("id,name,industry").ilike("name", q).limit(5),
      ]);
      if (cancelled) return;
      const out: SearchResult[] = [];
      (contacts.data || []).forEach((c: any) =>
        out.push({
          entity_type: "contact",
          entity_id: c.id,
          display_name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Contact",
          secondary: c.email || c.title || null,
        }),
      );
      (deals.data || []).forEach((d: any) =>
        out.push({ entity_type: "deal", entity_id: d.id, display_name: d.title, secondary: d.status }),
      );
      (companies.data || []).forEach((c: any) =>
        out.push({ entity_type: "company", entity_id: c.id, display_name: c.name, secondary: c.industry }),
      );
      setSearchResults(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [search, open]);

  const link = async (entity_type: string, entity_id: string) => {
    if (!user) return;
    setBusyId(`${entity_type}:${entity_id}`);
    const { error } = await supabase.from("email_links").insert({
      workspace_id: workspaceId,
      gmail_thread_id: threadId,
      entity_type,
      entity_id,
      subject: subject.slice(0, 500),
      snippet: snippet.slice(0, 1000),
      linked_by: user.id,
    });
    setBusyId(null);
    if (error) {
      toast.error("Couldn't link", { description: error.message });
      return;
    }
    toast.success(`Linked to ${TYPE_LABEL[entity_type] || entity_type}`);
    setSearch("");
    void refresh();
  };

  const unlink = async (linkId: string) => {
    setBusyId(linkId);
    const { error } = await supabase.from("email_links").delete().eq("id", linkId);
    setBusyId(null);
    if (error) {
      toast.error("Couldn't unlink", { description: error.message });
      return;
    }
    toast.success("Unlinked");
    void refresh();
  };

  const linkedCount = existing.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={linkedCount > 0 ? "secondary" : "outline"}
          size="sm"
          className="h-7 gap-1"
          title="Link this thread to a CRM record"
        >
          <Link2 className="h-3.5 w-3.5" />
          {linkedCount > 0 ? `Linked · ${linkedCount}` : "Link to CRM"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="px-3 py-2 border-b border-border/40">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Link this email
          </div>
        </div>

        {/* Currently linked */}
        {existing.length > 0 && (
          <div className="px-3 py-2 border-b border-border/40 space-y-1.5">
            <div className="text-[10px] uppercase text-muted-foreground">Linked records</div>
            {existing.map((l) => {
              const key = `${l.entity_type}:${l.entity_id}`;
              const displayName = names[key] || `${l.entity_id.slice(0, 8)}…`;
              const canOpen = l.entity_type === "contact" || l.entity_type === "deal";
              const openHref =
                l.entity_type === "contact"
                  ? `/crm/contacts?contact=${l.entity_id}`
                  : l.entity_type === "deal"
                    ? `/crm/deals?deal=${l.entity_id}`
                    : null;
              return (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                      {l.entity_type}
                    </Badge>
                    <span className="text-xs font-medium truncate">{displayName}</span>
                  </div>
                  {canOpen && openHref && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      title={`Open ${l.entity_type}`}
                      onClick={() => { setOpen(false); navigate(openHref); }}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="Unlink"
                    onClick={() => unlink(l.id)}
                    disabled={busyId === l.id}
                  >
                    {busyId === l.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Suggestions */}
        {loading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> Loading…
          </div>
        ) : (
          <>
            {suggestions.length > 0 && (
              <div className="px-3 py-2 border-b border-border/40 space-y-1">
                <div className="text-[10px] uppercase text-muted-foreground">
                  Matched by participant email
                </div>
                {suggestions.map((s) => {
                  const key = `${s.entity_type}:${s.entity_id}`;
                  const already = linkedKeys.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() => !already && link(s.entity_type, s.entity_id)}
                      disabled={already || busyId === key}
                      className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60 disabled:opacity-60"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {s.entity_type}
                          </Badge>
                          <span className="font-medium truncate">{s.display_name}</span>
                        </div>
                        {(s.matched_email || s.secondary) && (
                          <div className="text-[11px] text-muted-foreground truncate pl-1">
                            {s.matched_email || s.secondary}
                          </div>
                        )}
                      </div>
                      {already ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : busyId === key ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Search */}
            <div className="px-3 py-2">
              <div className="text-[10px] uppercase text-muted-foreground mb-1">
                Search contacts, deals, companies
              </div>
              <Input
                placeholder="Type to search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
              />
              {searchResults.length > 0 && (
                <div className="mt-1.5 space-y-1 max-h-56 overflow-auto">
                  {searchResults.map((r) => {
                    const key = `${r.entity_type}:${r.entity_id}`;
                    const already = linkedKeys.has(key);
                    return (
                      <button
                        key={key}
                        onClick={() => !already && link(r.entity_type, r.entity_id)}
                        disabled={already || busyId === key}
                        className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60 disabled:opacity-60"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {r.entity_type}
                            </Badge>
                            <span className="font-medium truncate">{r.display_name}</span>
                          </div>
                          {r.secondary && (
                            <div className="text-[11px] text-muted-foreground truncate pl-1">
                              {r.secondary}
                            </div>
                          )}
                        </div>
                        {already ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : busyId === key ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {search.trim().length >= 2 && searchResults.length === 0 && (
                <div className="text-xs text-muted-foreground py-2 text-center">No matches</div>
              )}
            </div>

            {/* Quick create */}
            <div className="border-t border-border/40 px-3 py-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 gap-1"
                onClick={() => setCreateOpen(true)}
              >
                <UserPlus className="h-3.5 w-3.5" /> Add contact (optionally with deal)
              </Button>
            </div>
          </>
        )}
      </PopoverContent>

      <QuickCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={workspaceId}
        userId={user?.id ?? null}
        initialTab="contact"
        prefill={primaryParticipant}
        onCreated={async ({ type, id }) => {
          // Auto-link every record created (contact and/or deal) to this thread
          await link(type, id);
        }}
      />
    </Popover>
  );
}
