// Books data layer.
//
// Every table here is CEO-only at the database level (is_primary_admin), so
// these queries simply return nothing for anyone else. The UI is gated too,
// but the database is what actually enforces it.

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

export interface BookEntity {
  id: string;
  name: string;
  legal_name: string | null;
  home_state: string | null;
  parent_entity_id: string | null;
  final_tax_year: number | null;
  notes: string | null;
}

export interface BookAccount {
  id: string;
  entity_id: string | null;
  code: string;
  name: string;
  account_type: "asset" | "liability" | "equity" | "income" | "expense";
  subtype: string | null;
  partner_id: string | null;
  counterparty_entity_id: string | null;
}

export interface BookBankAccount {
  id: string;
  entity_id: string;
  org_label: string | null;
  display_name: string;
  last_four: string | null;
}

export interface BookTransaction {
  id: string;
  entity_id: string;
  bank_account_id: string;
  txn_date: string;
  description: string;
  bank_description: string | null;
  memo: string | null;
  amount: number;
  status: "posted" | "pending" | "failed";
  review_state: "unreviewed" | "needs_review" | "accepted" | "excluded";
  review_note: string | null;
  suggested_by: string | null;
  confidence: number | null;
  ai_reasoning: string | null;
  external_id: string | null;
}

export interface TrialBalanceRow {
  entity_id: string;
  fiscal_year: number;
  account_id: string;
  code: string;
  account_name: string;
  account_type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

/** Entities, accounts and bank accounts — the setup that rarely changes. */
export function useBooksSetup() {
  const [entities, setEntities] = useState<BookEntity[]>([]);
  const [accounts, setAccounts] = useState<BookAccount[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BookBankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [e, a, b] = await Promise.all([
        supabase.from("book_entities").select("*").order("name"),
        supabase.from("book_accounts").select("*").eq("is_active", true).order("code"),
        supabase.from("book_bank_accounts").select("*").eq("is_active", true).order("display_name"),
      ]);
      if (cancelled) return;
      const firstError = e.error || a.error || b.error;
      if (firstError) setError(firstError.message);
      setEntities((e.data as BookEntity[]) ?? []);
      setAccounts((a.data as BookAccount[]) ?? []);
      setBankAccounts((b.data as BookBankAccount[]) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const entityName = useMemo(() => {
    const m = new Map(entities.map((x) => [x.id, x.name]));
    return (id: string | null) => (id ? m.get(id) ?? "Unknown" : "—");
  }, [entities]);

  const bankName = useMemo(() => {
    const m = new Map(bankAccounts.map((x) => [x.id, x.display_name]));
    return (id: string) => m.get(id) ?? "Unknown account";
  }, [bankAccounts]);

  return { entities, accounts, bankAccounts, entityName, bankName, loading, error };
}

export interface TxnFilters {
  entityId?: string;
  reviewState?: string;
  search?: string;
  includeFailed?: boolean;
}

/** The ledger itself. Paged, because a full year runs to a thousand rows. */
export function useBookTransactions(filters: TxnFilters, page: number, pageSize = 100) {
  const [rows, setRows] = useState<BookTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const { entityId, reviewState, search, includeFailed } = filters;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase
        .from("book_transactions")
        .select("*", { count: "exact" })
        .order("txn_date", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (entityId) q = q.eq("entity_id", entityId);
      if (reviewState) q = q.eq("review_state", reviewState);
      if (!includeFailed) q = q.neq("status", "failed");
      if (search) q = q.or(`description.ilike.%${search}%,memo.ilike.%${search}%`);

      const { data, count } = await q;
      if (cancelled) return;
      setRows((data as BookTransaction[]) ?? []);
      setTotal(count ?? 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [entityId, reviewState, search, includeFailed, page, pageSize, reloadKey]);

  return { rows, total, loading, reload };
}

/** Counts for the tab badges, so the review queue advertises its own size. */
export function useBookCounts(reloadKey = 0) {
  const [counts, setCounts] = useState({ total: 0, needsReview: 0, unreviewed: 0, posted: 0, failed: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const head = { count: "exact" as const, head: true };
      const [all, needs, unrev, posted, failed] = await Promise.all([
        supabase.from("book_transactions").select("*", head),
        supabase.from("book_transactions").select("*", head).eq("review_state", "needs_review"),
        supabase.from("book_transactions").select("*", head).eq("review_state", "unreviewed").neq("status", "failed"),
        supabase.from("book_transactions").select("*", head).eq("review_state", "accepted"),
        supabase.from("book_transactions").select("*", head).eq("status", "failed"),
      ]);
      if (cancelled) return;
      setCounts({
        total: all.count ?? 0,
        needsReview: needs.count ?? 0,
        unreviewed: unrev.count ?? 0,
        posted: posted.count ?? 0,
        failed: failed.count ?? 0,
      });
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  return counts;
}

/** Trial balance, and whether it ties. If it doesn't, nothing else is safe. */
export function useTrialBalance(fiscalYear: number, reloadKey = 0) {
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("book_trial_balance")
        .select("*")
        .eq("fiscal_year", fiscalYear);
      if (cancelled) return;
      setRows((data as TrialBalanceRow[]) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [fiscalYear, reloadKey]);

  const outOfBalance = useMemo(
    () => rows.reduce((sum, r) => sum + Number(r.total_debit) - Number(r.total_credit), 0),
    [rows],
  );

  return { rows, outOfBalance, loading };
}

/** Post a categorised bank row. The database derives the cash side. */
export async function postTransaction(
  txnId: string,
  splits: { account_id: string; amount: number; partner_id?: string; memo?: string }[],
  memo?: string,
) {
  const { data, error } = await supabase.rpc("book_post_transaction", {
    _txn_id: txnId,
    _splits: splits,
    _memo: memo ?? null,
    _source: "bank",
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function unpostTransaction(txnId: string) {
  const { error } = await supabase.rpc("book_unpost_transaction", { _txn_id: txnId });
  if (error) throw new Error(error.message);
}

export function money(n: number | string) {
  const v = Number(n);
  const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

export interface RuleSplit {
  account_id: string;
  percent?: number;
  amount?: number;
  memo?: string;
}

export interface BookRule {
  id: string;
  entity_id: string | null;
  match_pattern: string;
  match_field: "description" | "bank_description" | "memo" | "both";
  priority: number;
  splits: RuleSplit[];
  treatment: "post" | "review" | "transfer" | "intercompany" | "exclude";
  note: string | null;
  hit_count: number;
  last_hit_at: string | null;
  confidence: number;
  is_active: boolean;
}

type BookRuleRow = Database["public"]["Tables"]["book_rules"]["Row"];

/**
 * splits is jsonb, so the database stores the shape without policing it. This
 * is the one place that assumption lives — everything downstream can trust the
 * type. A row whose splits are not an array reads as no splits rather than
 * crashing the panel, and the rules engine refuses to post a rule with none.
 */
function toRule(row: BookRuleRow): BookRule {
  return {
    id: row.id,
    entity_id: row.entity_id,
    match_pattern: row.match_pattern,
    match_field: row.match_field as BookRule["match_field"],
    priority: row.priority,
    splits: Array.isArray(row.splits) ? (row.splits as unknown as RuleSplit[]) : [],
    treatment: row.treatment as BookRule["treatment"],
    note: row.note,
    hit_count: row.hit_count,
    last_hit_at: row.last_hit_at,
    confidence: row.confidence,
    is_active: row.is_active,
  };
}

export interface RuleOutcome {
  txn_id: string;
  rule_id: string;
  action: string;
  detail: string;
}

/** The rules, most-used first — the ones earning their keep are the ones to see. */
export function useBookRules(reloadKey = 0) {
  const [rules, setRules] = useState<BookRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("book_rules")
        .select("*")
        .order("hit_count", { ascending: false })
        .order("priority");
      if (cancelled) return;
      setRules((data ?? []).map(toRule));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  return { rules, loading };
}

/**
 * Run the rules. Always offered as a dry run first: a rule that matches more
 * than you expected is the failure mode, and it is only visible before posting.
 */
export async function applyRules(entityId: string | null, dryRun: boolean, limit = 1000) {
  const { data, error } = await supabase.rpc("book_apply_rules", {
    _entity_id: entityId,
    _limit: limit,
    _dry_run: dryRun,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as RuleOutcome[];
}

/** What this rule would claim out of the ledger, before you trust it to post. */
export async function previewRule(ruleId: string, limit = 25) {
  const { data, error } = await supabase.rpc("book_rule_preview", { _rule_id: ruleId, _limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []) as { txn_id: string; txn_date: string; description: string; amount: number }[];
}

export async function saveRule(rule: Partial<BookRule> & { workspace_id?: string }) {
  // splits goes back as jsonb; everything else maps across unchanged.
  const row = {
    entity_id: rule.entity_id ?? null,
    match_pattern: rule.match_pattern ?? "",
    match_field: rule.match_field ?? "description",
    priority: rule.priority ?? 100,
    splits: (rule.splits ?? []) as unknown as Json,
    treatment: rule.treatment ?? "review",
    note: rule.note ?? null,
    is_active: rule.is_active ?? true,
  };

  const { error } = rule.id
    ? await supabase.from("book_rules").update(row).eq("id", rule.id)
    : await supabase.from("book_rules").insert({ ...row, workspace_id: rule.workspace_id! });
  if (error) throw new Error(error.message);
}

export async function deleteRule(id: string) {
  const { error } = await supabase.from("book_rules").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface TransferOutcome {
  action: string;
  detail: string;
  txn_id: string;
  sibling_id: string | null;
  amount: number;
}

/**
 * Sweep internal transfers. Keys on Mercury's own label and the counterparty's
 * account number, so it pairs rows rather than guessing at them — and refuses
 * to pair two identical transfers made on the same day.
 */
export async function applyInternalTransfers(dryRun: boolean) {
  const { data, error } = await supabase.rpc("book_post_internal_transfers", { _dry_run: dryRun });
  if (error) throw new Error(error.message);
  return (data ?? []) as TransferOutcome[];
}

/**
 * One entity paid for another. Writes both halves — the payer's due-from and
 * the benefiting entity's due-to — so the two sets of books agree.
 */
export async function postIntercompany(
  txnId: string,
  benefitingEntityId: string,
  theirAccountId: string,
  memo?: string,
) {
  const { error } = await supabase.rpc("book_post_intercompany", {
    _txn_id: txnId,
    _benefiting_entity: benefitingEntityId,
    _their_account_id: theirAccountId,
    _memo: memo ?? null,
  });
  if (error) throw new Error(error.message);
}
