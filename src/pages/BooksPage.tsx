// Books — the double-entry ledger for the Evergreen entities.
//
// CEO-only, enforced at the database (is_primary_admin) as well as the route.
// Wave is frozen as the 2023-24 history; this owns 2025 forward.

import { useMemo, useState } from "react";
import { Loader2, Search, ScrollText, AlertTriangle, Scale } from "lucide-react";
import { StatusPill } from "@/components/primitives";
import { EmptyState } from "@/components/shared/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BooksImport from "@/components/books/BooksImport";
import CategorizeSheet from "@/components/books/CategorizeSheet";
import {
  useBooksSetup, useBookTransactions, useBookCounts, useTrialBalance, money,
  type BookTransaction,
} from "@/hooks/useBooks";

const FISCAL_YEAR = 2025;

export default function BooksPage() {
  const { entities, accounts, bankAccounts, entityName, bankName, loading: setupLoading } = useBooksSetup();
  const [active, setActive] = useState<BookTransaction | null>(null);
  const [tab, setTab] = useState("ledger");
  const [entityId, setEntityId] = useState<string>("");
  const [reviewState, setReviewState] = useState<string>("");
  const [search, setSearch] = useState("");
  const [includeFailed, setIncludeFailed] = useState(false);
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const filters = useMemo(
    () => ({ entityId: entityId || undefined, reviewState: reviewState || undefined, search: search || undefined, includeFailed }),
    [entityId, reviewState, search, includeFailed],
  );
  const { rows, total, loading } = useBookTransactions(filters, page, 100);
  const counts = useBookCounts(refreshKey);
  const { rows: tb, outOfBalance, loading: tbLoading } = useTrialBalance(FISCAL_YEAR, refreshKey);

  const refresh = () => { setRefreshKey((k) => k + 1); setPage(0); };

  // Per-entity profit & loss, rolled up from the trial balance rather than
  // recomputed, so the statement and the balance can never disagree.
  const plByEntity = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const r of tb) {
      if (r.account_type !== "income" && r.account_type !== "expense") continue;
      const cur = map.get(r.entity_id) ?? { income: 0, expense: 0 };
      if (r.account_type === "income") cur.income += Number(r.balance);
      else cur.expense += Number(r.balance);
      map.set(r.entity_id, cur);
    }
    return map;
  }, [tb]);

  if (setupLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pages = Math.max(1, Math.ceil(total / 100));

  return (
    <div className="px-6 py-6 crm-section-stack">
      <div>
        <h1 className="page-title">Books</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Double-entry ledger for {entities.length} entities, {FISCAL_YEAR} forward. Every posting
          balances or it is refused, and anything needing a source document is held for review
          rather than guessed.
        </p>
      </div>

      {/* Reconciliation strip — the numbers that say whether to trust the rest */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Transactions" value={counts.total.toLocaleString()} sub={`${counts.failed} failed, excluded`} />
        <Stat label="Needs review" value={counts.needsReview.toLocaleString()} sub="held, not guessed" warn={counts.needsReview > 0} />
        <Stat label="Uncategorised" value={counts.unreviewed.toLocaleString()} sub="not yet posted" />
        <Stat
          label="Trial balance"
          value={tbLoading ? "…" : money(outOfBalance)}
          sub={Math.abs(outOfBalance) < 0.005 ? "debits equal credits" : "OUT OF BALANCE"}
          warn={Math.abs(outOfBalance) >= 0.005}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="review">
            Review{counts.needsReview > 0 && ` (${counts.needsReview})`}
          </TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------- ledger */}
        <TabsContent value="ledger" className="crm-section-stack mt-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                placeholder="Search description or memo…"
                className="pl-8 w-64 h-9"
              />
            </div>
            <Select value={entityId || "all"} onValueChange={(v) => { setEntityId(v === "all" ? "" : v); setPage(0); }}>
              <SelectTrigger className="w-56 h-9"><SelectValue placeholder="All entities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                {entities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={reviewState || "all"} onValueChange={(v) => { setReviewState(v === "all" ? "" : v); setPage(0); }}>
              <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Any state" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any state</SelectItem>
                <SelectItem value="unreviewed">Unreviewed</SelectItem>
                <SelectItem value="needs_review">Needs review</SelectItem>
                <SelectItem value="accepted">Posted</SelectItem>
                <SelectItem value="excluded">Excluded</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={includeFailed ? "default" : "outline"}
              size="sm"
              onClick={() => { setIncludeFailed((v) => !v); setPage(0); }}
            >
              {includeFailed ? "Showing failed" : "Hiding failed"}
            </Button>
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground">
              {total.toLocaleString()} row{total === 1 ? "" : "s"}
            </span>
          </div>

          <LedgerTable rows={rows} loading={loading} entityName={entityName} bankName={bankName} onPick={setActive} />

          {pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">Page {page + 1} of {pages}</span>
              <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ---------------------------------------------------------- review */}
        <TabsContent value="review" className="crm-section-stack mt-4">
          <ReviewQueue entityName={entityName} bankName={bankName} refreshKey={refreshKey} onPick={setActive} />
        </TabsContent>

        {/* --------------------------------------------------------- reports */}
        <TabsContent value="reports" className="crm-section-stack mt-4">
          {Math.abs(outOfBalance) >= 0.005 && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex gap-3">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-destructive">Trial balance does not tie</p>
                <p className="text-muted-foreground mt-0.5">
                  Debits exceed credits by {money(outOfBalance)}. Nothing below is reliable until
                  that is zero.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {entities.map((e) => {
              const pl = plByEntity.get(e.id);
              if (!pl) return null;
              return (
                <div key={e.id} className="crm-card">
                  <h2 className="section-title">{e.name}</h2>
                  <div className="crm-eyebrow mb-3">Tax year {FISCAL_YEAR} · draft</div>
                  <dl className="text-sm space-y-1.5">
                    <Row label="Income" value={money(pl.income)} />
                    <Row label="Expenses" value={money(-pl.expense)} />
                    <div className="pt-2 mt-2 border-t flex justify-between font-semibold">
                      <dt>Net</dt>
                      <dd className="font-mono tabular-nums">{money(pl.income - pl.expense)}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>

          <div className="crm-card">
            <h2 className="section-title mb-1">Trial balance</h2>
            <div className="crm-eyebrow mb-3">Every account with activity in {FISCAL_YEAR}</div>
            {tbLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : tb.length === 0 ? (
              <EmptyState
                icon={Scale}
                title="Nothing posted yet"
                description="Categorise transactions in the Review tab and they will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[10.5px] uppercase tracking-wide text-muted-foreground border-b">
                      <th className="py-2 pr-3 font-semibold">Entity</th>
                      <th className="py-2 pr-3 font-semibold">Code</th>
                      <th className="py-2 pr-3 font-semibold">Account</th>
                      <th className="py-2 pr-3 font-semibold text-right">Debit</th>
                      <th className="py-2 pr-3 font-semibold text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tb.map((r) => (
                      <tr key={r.account_id} className="border-b last:border-0">
                        <td className="py-1.5 pr-3 text-muted-foreground">{entityName(r.entity_id)}</td>
                        <td className="py-1.5 pr-3 font-mono text-xs">{r.code}</td>
                        <td className="py-1.5 pr-3">{r.account_name}</td>
                        <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{money(r.total_debit)}</td>
                        <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{money(r.total_credit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------- import */}
        <TabsContent value="import" className="mt-4">
          <BooksImport bankAccounts={bankAccounts} onImported={refresh} />
        </TabsContent>
      </Tabs>

      <CategorizeSheet
        txn={active}
        accounts={accounts}
        entityName={entityName}
        bankName={bankName}
        onClose={() => setActive(null)}
        onPosted={refresh}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ bits */

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`crm-card ${warn ? "border-amber-500/40" : ""}`}>
      <div className="crm-eyebrow">{label}</div>
      <div className="text-2xl font-semibold font-mono tabular-nums tracking-tight mt-1">{value}</div>
      {sub && (
        <div className={`text-xs mt-1 ${warn ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}

function LedgerTable({
  rows, loading, entityName, bankName, onPick,
}: {
  rows: ReturnType<typeof useBookTransactions>["rows"];
  loading: boolean;
  entityName: (id: string | null) => string;
  bankName: (id: string) => string;
  onPick: (t: BookTransaction) => void;
}) {
  if (loading) {
    return (
      <div className="crm-card flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!rows.length) {
    return (
      <div className="crm-card">
        <EmptyState
          icon={ScrollText}
          title="No transactions match"
          description="Adjust the filters, or import Mercury exports from the Import tab."
        />
      </div>
    );
  }
  return (
    <div className="crm-card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-wide text-muted-foreground bg-muted/40 border-b">
              <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Date</th>
              <th className="py-2.5 px-3 font-semibold">Description</th>
              <th className="py-2.5 px-3 font-semibold">Held at</th>
              <th className="py-2.5 px-3 font-semibold">Entity</th>
              <th className="py-2.5 px-3 font-semibold">State</th>
              <th className="py-2.5 px-3 font-semibold text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr
                key={t.id}
                onClick={() => t.status !== "failed" && onPick(t)}
                className={`border-b last:border-0 ${
                  t.status === "failed"
                    ? "opacity-50"
                    : "hover:bg-muted/30 cursor-pointer"
                }`}
              >
                <td className="py-2 px-3 font-mono text-xs whitespace-nowrap">{t.txn_date}</td>
                <td className="py-2 px-3">
                  <span className={t.status === "failed" ? "line-through" : ""}>{t.description}</span>
                  {t.memo && <span className="block text-xs text-muted-foreground mt-0.5">{t.memo}</span>}
                </td>
                <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">{bankName(t.bank_account_id)}</td>
                <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">{entityName(t.entity_id)}</td>
                <td className="py-2 px-3">
                  {t.status === "failed"
                    ? <span className="text-xs text-muted-foreground">Failed at bank</span>
                    : <StatusPill kind="book_review" value={t.review_state} size="sm" />}
                </td>
                <td className={`py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap ${Number(t.amount) < 0 ? "text-destructive" : ""}`}>
                  {money(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReviewQueue({
  entityName, bankName, refreshKey, onPick,
}: {
  entityName: (id: string | null) => string;
  bankName: (id: string) => string;
  refreshKey: number;
  onPick: (t: BookTransaction) => void;
}) {
  const { rows, total, loading } = useBookTransactions(
    { reviewState: "needs_review", includeFailed: false }, 0, 100,
  );

  if (loading) {
    return (
      <div className="crm-card flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!total) {
    return (
      <div className="crm-card">
        <EmptyState
          icon={ScrollText}
          title="Nothing waiting on you"
          description="Transactions land here when a rule declines to decide — a mortgage that needs its Form 1098, a property sale, an earnest-money deposit, or a cost paid by the wrong entity."
        />
      </div>
    );
  }
  return (
    <>
      <p className="text-sm text-muted-foreground">
        These were deliberately not guessed. Each needs either a source document or a judgement
        call. Click a row to categorise and post it.
      </p>
      <LedgerTable rows={rows} loading={false} entityName={entityName} bankName={bankName} onPick={onPick} />
    </>
  );
}
