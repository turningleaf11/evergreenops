import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Users, Building2, Rocket, Plus, Search, Inbox, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ContactsTable } from "@/components/crm/ContactsTable";
import { CompaniesTable } from "@/components/crm/CompaniesTable";
import { DealsKanban } from "@/components/crm/DealsKanban";
import { LeadsList } from "@/components/crm/LeadsList";
import { ContactPeekSheet } from "@/components/crm/ContactPeekSheet";
import { DealPeekSheet } from "@/components/crm/DealPeekSheet";
import { NewContactDialog } from "@/components/crm/NewContactDialog";
import { NewCompanyDialog } from "@/components/crm/NewCompanyDialog";
import { TransactionsList } from "@/components/crm/transactions/TransactionsList";

type Tab = "leads" | "contacts" | "companies" | "deals" | "transactions";

export default function CrmPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { id: workspaceId } = useWorkspace();

  const initialTab: Tab = (["leads", "contacts", "companies", "deals", "transactions"] as Tab[]).includes(
    params.tab as Tab,
  )
    ? (params.tab as Tab)
    : "contacts";

  const [tab, setTab] = useState<Tab>(initialTab);
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [openContactId, setOpenContactId] = useState<string | null>(null);
  const [openDealId, setOpenDealId] = useState<string | null>(null);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [newCompanyOpen, setNewCompanyOpen] = useState(false);
  // Per-tab "request new" signal counters; tabs watch their counter and open their own dialog.
  const [newDealSignal, setNewDealSignal] = useState(0);
  const [newLeadSignal, setNewLeadSignal] = useState(0);
  const [newTxSignal, setNewTxSignal] = useState(0);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  // Open peek from URL query params (e.g. ?contact=<id> or ?deal=<id>)
  useEffect(() => {
    const c = searchParams.get("contact");
    const d = searchParams.get("deal");
    if (c) setOpenContactId(c);
    if (d) setOpenDealId(d);
  }, [searchParams]);

  const clearPeekParam = (key: "contact" | "deal") => {
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const handleTabChange = (next: string) => {
    const t = next as Tab;
    setTab(t);
    navigate(`/crm/${t}`, { replace: true });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border/50 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Rocket className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Deals</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={`Search ${tab}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8 w-64"
            />
          </div>
          {tab === "contacts" && (
            <Button size="sm" onClick={() => setNewContactOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New contact
            </Button>
          )}
          {tab === "leads" && (
            <Button size="sm" onClick={() => setNewLeadSignal((n) => n + 1)}>
              <Plus className="h-4 w-4 mr-1" /> New lead
            </Button>
          )}
          {tab === "deals" && (
            <Button size="sm" onClick={() => setNewDealSignal((n) => n + 1)}>
              <Plus className="h-4 w-4 mr-1" /> New deal
            </Button>
          )}
          {tab === "transactions" && (
            <Button size="sm" onClick={() => setNewTxSignal((n) => n + 1)}>
              <Plus className="h-4 w-4 mr-1" /> New transaction
            </Button>
          )}
          {tab === "companies" && (
            <Button size="sm" onClick={() => setNewCompanyOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New company
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
        <div className="px-6 pt-3 border-b border-border/50">
          <TabsList className="h-9 bg-transparent p-0 gap-1">
            <TabsTrigger value="contacts" className="data-[state=active]:bg-muted gap-1.5">
              <Users className="h-3.5 w-3.5" /> Contacts
            </TabsTrigger>
            <TabsTrigger value="leads" className="data-[state=active]:bg-muted gap-1.5">
              <Inbox className="h-3.5 w-3.5" /> Inbox
            </TabsTrigger>
            <TabsTrigger value="deals" className="data-[state=active]:bg-muted gap-1.5">
              <Briefcase className="h-3.5 w-3.5" /> Deals
            </TabsTrigger>
            <TabsTrigger value="transactions" className="data-[state=active]:bg-muted gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Transactions
            </TabsTrigger>
            <TabsTrigger value="companies" className="data-[state=active]:bg-muted gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Companies
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="leads" className="flex-1 min-h-0 overflow-auto m-0">
          <LeadsList search={search} newSignal={newLeadSignal} />
        </TabsContent>
        <TabsContent value="contacts" className="flex-1 min-h-0 overflow-auto m-0">
          <ContactsTable
            search={search}
            refreshKey={refreshKey}
            onOpen={(id) => setOpenContactId(id)}
            onChanged={() => setRefreshKey((k) => k + 1)}
          />
        </TabsContent>
        <TabsContent value="companies" className="flex-1 min-h-0 overflow-auto m-0">
          <CompaniesTable search={search} refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="deals" className="flex-1 min-h-0 overflow-auto m-0">
          <DealsKanban search={search} newSignal={newDealSignal} />
        </TabsContent>
        <TabsContent value="transactions" className="flex-1 min-h-0 overflow-auto m-0">
          <TransactionsList search={search} newSignal={newTxSignal} />
        </TabsContent>
      </Tabs>

      <ContactPeekSheet
        contactId={openContactId}
        onClose={() => { setOpenContactId(null); clearPeekParam("contact"); }}
        onChanged={() => setRefreshKey((k) => k + 1)}
        onOpenDeal={(id) => { setOpenContactId(null); clearPeekParam("contact"); setOpenDealId(id); }}
      />

      <DealPeekSheet
        dealId={openDealId}
        onClose={() => { setOpenDealId(null); clearPeekParam("deal"); }}
        onChanged={() => setRefreshKey((k) => k + 1)}
      />

      <NewContactDialog
        open={newContactOpen}
        onOpenChange={setNewContactOpen}
        workspaceId={workspaceId}
        userId={user?.id ?? null}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />

      <NewCompanyDialog
        open={newCompanyOpen}
        onOpenChange={setNewCompanyOpen}
        workspaceId={workspaceId}
        userId={user?.id ?? null}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />

      <ContactPeekSheet
        contactId={openContactId}
        onClose={() => { setOpenContactId(null); clearPeekParam("contact"); }}
        onChanged={() => setRefreshKey((k) => k + 1)}
        onOpenDeal={(id) => { setOpenContactId(null); clearPeekParam("contact"); setOpenDealId(id); }}
      />

      <DealPeekSheet
        dealId={openDealId}
        onClose={() => { setOpenDealId(null); clearPeekParam("deal"); }}
        onChanged={() => setRefreshKey((k) => k + 1)}
      />

      <NewContactDialog
        open={newContactOpen}
        onOpenChange={setNewContactOpen}
        workspaceId={workspaceId}
        userId={user?.id ?? null}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
