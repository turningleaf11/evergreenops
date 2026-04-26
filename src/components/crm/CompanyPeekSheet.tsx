import { useEffect, useState } from "react";
import { Building2, Globe, Mail, Phone, ExternalLink, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import ActivityPanel from "@/components/activity/ActivityPanel";
import {
  EntitySheetShell,
  EntitySheetHeader,
  EntityIdentityStrip,
  EntitySectionHeader,
  EntityTabs,
  EntityTabPanel,
  type EntityTabId,
} from "./_shell";

interface Company {
  id: string;
  workspace_id: string | null;
  name: string;
  domain: string | null;
  industry: string | null;
  website: string | null;
  size: string | null;
  notes: string | null;
  address: any;
  created_at: string;
}

interface ContactLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
}

interface DealLite {
  id: string;
  title: string;
  status: string | null;
  value: number | null;
  currency: string | null;
}

const formatMoney = (n: number | null, currency = "USD") =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
        maximumFractionDigits: 0,
      }).format(n);

export function CompanyPeekSheet({
  companyId,
  onClose,
  onChanged,
}: {
  companyId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<ContactLite[]>([]);
  const [deals, setDeals] = useState<DealLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<EntityTabId>("overview");

  useEffect(() => {
    if (!companyId) {
      setCompany(null);
      setContacts([]);
      setDeals([]);
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      const [{ data: c }, { data: cs }, { data: ds }] = await Promise.all([
        supabase.from("companies").select("*").eq("id", companyId).maybeSingle(),
        supabase
          .from("contacts")
          .select("id,first_name,last_name,email,phone,title")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("deals")
          .select("id,title,status,value,currency")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (!active) return;
      setCompany((c as Company) || null);
      setContacts((cs as ContactLite[]) || []);
      setDeals((ds as DealLite[]) || []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [companyId]);

  const isOpen = !!companyId;
  const websiteHref = company?.website
    ? company.website.startsWith("http")
      ? company.website
      : `https://${company.website}`
    : null;

  return (
    <EntitySheetShell
      open={isOpen}
      onOpenChange={(v) => !v && onClose()}
      loading={loading || !company}
      width="default"
    >
      {company && (
        <>
          <EntitySheetHeader
            title={company.name}
            subtitle={
              <div className="flex items-center gap-3 flex-wrap mt-1">
                {company.domain && (
                  <span className="text-xs text-muted-foreground">{company.domain}</span>
                )}
                {websiteHref && (
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Globe className="h-3 w-3" />
                    <span className="truncate max-w-[220px]">{company.website}</span>
                  </a>
                )}
              </div>
            }
            titleClassName="text-xl font-semibold"
            leading={<Building2 className="h-5 w-5 text-primary" />}
            onClose={onClose}
          />

          <EntityIdentityStrip
            chips={
              <>
                {company.industry && <span>{company.industry}</span>}
                {company.size && <span>{company.size}</span>}
              </>
            }
          />

          <EntityTabs
            value={tab}
            onValueChange={(v) => setTab(v)}
            hide={["more"]}
          >
            <EntityTabPanel value="overview">
              <div className="space-y-7">
                <section>
                  <EntitySectionHeader>Company info</EntitySectionHeader>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 mt-3">
                    <FieldCell label="Domain">{company.domain || "—"}</FieldCell>
                    <FieldCell label="Website">
                      {websiteHref ? (
                        <a
                          href={websiteHref}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {company.website}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </FieldCell>
                    <FieldCell label="Industry">{company.industry || "—"}</FieldCell>
                    <FieldCell label="Size">{company.size || "—"}</FieldCell>
                  </div>
                </section>

                {company.notes && (
                  <section>
                    <EntitySectionHeader>Notes</EntitySectionHeader>
                    <p className="text-sm whitespace-pre-wrap mt-2">{company.notes}</p>
                  </section>
                )}

                <section>
                  <div className="flex items-center justify-between">
                    <EntitySectionHeader>Contacts ({contacts.length})</EntitySectionHeader>
                    {contacts.length > 0 && (
                      <button
                        onClick={() => setTab("deals")}
                        className="text-xs text-primary hover:underline"
                      >
                        View all
                      </button>
                    )}
                  </div>
                  {contacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic mt-2">
                      No contacts at this company.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {contacts.slice(0, 5).map((c) => (
                        <ContactRow key={c.id} contact={c} />
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <EntitySectionHeader>Deals ({deals.length})</EntitySectionHeader>
                  {deals.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic mt-2">No deals yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {deals.slice(0, 5).map((d) => (
                        <li
                          key={d.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-card px-3 py-2 text-sm"
                        >
                          <span className="truncate font-medium">{d.title}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatMoney(d.value, d.currency || "USD")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </EntityTabPanel>

            <EntityTabPanel value="deals">
              <div className="space-y-2">
                <EntitySectionHeader>All deals</EntitySectionHeader>
                {deals.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic mt-2">No deals yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {deals.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-card px-3 py-2 text-sm"
                      >
                        <span className="truncate font-medium">{d.title}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatMoney(d.value, d.currency || "USD")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <EntitySectionHeader className="pt-6">Contacts</EntitySectionHeader>
                {contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic mt-2">
                    No contacts at this company.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {contacts.map((c) => (
                      <ContactRow key={c.id} contact={c} />
                    ))}
                  </ul>
                )}
              </div>
            </EntityTabPanel>

            <EntityTabPanel value="activity" className="p-4 flex flex-col min-h-0">
              <ActivityPanel entityType="company" entityId={company.id} hideHeader />
            </EntityTabPanel>

            <EntityTabPanel value="files">
              <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground">
                <Inbox className="h-8 w-8 mb-2 opacity-50" />
                <p className="font-medium text-foreground mb-1">No files yet</p>
                <p>File attachments for companies will appear here.</p>
              </div>
            </EntityTabPanel>
          </EntityTabs>
        </>
      )}
    </EntitySheetShell>
  );
}

function FieldCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function ContactRow({ contact }: { contact: ContactLite }) {
  const name =
    `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
    contact.email ||
    "Untitled";
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-card px-3 py-2 text-sm">
      <div className="min-w-0">
        <div className="font-medium truncate">{name}</div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {contact.title && <span className="truncate">{contact.title}</span>}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="inline-flex items-center gap-1 hover:text-primary truncate"
            >
              <Mail className="h-3 w-3" /> {contact.email}
            </a>
          )}
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="inline-flex items-center gap-1 hover:text-primary"
            >
              <Phone className="h-3 w-3" /> {contact.phone}
            </a>
          )}
        </div>
      </div>
    </li>
  );
}
