// A typed view of the books schema.
//
// src/integrations/supabase/types.ts is generated from the project and does not
// carry the book_* tables — regenerating it needs a Supabase access token this
// environment does not have. Rather than let the ledger's call sites go
// untyped, the shape they actually use is declared here and the shared client
// is re-typed through it. Same connection, same auth, same RLS; only the
// compile-time view differs.
//
// When types.ts is next regenerated, this file can go — until then, a change to
// a book_* column has to be made here too, or the compiler will keep agreeing
// with a schema that no longer exists.

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Every shape below is a `type`, never an `interface`, and that is load-bearing.
// supabase-js requires each Row to satisfy `Record<string, unknown>`; TypeScript
// gives type aliases an implicit index signature and interfaces none, so an
// interface here fails the constraint, the schema resolves to `never`, and every
// call site reports "not assignable to parameter of type 'never'" with no hint
// that the schema type is what broke.
type Timestamps = { created_at: string };

type BookEntityRow = Timestamps & {
  id: string;
  workspace_id: string;
  name: string;
  legal_name: string | null;
  home_state: string | null;
  parent_entity_id: string | null;
  final_tax_year: number | null;
  notes: string | null;
}

type BookAccountRow = Timestamps & {
  id: string;
  workspace_id: string;
  entity_id: string | null;
  code: string;
  name: string;
  account_type: string;
  subtype: string | null;
  partner_id: string | null;
  counterparty_entity_id: string | null;
  is_active: boolean;
}

type BookBankAccountRow = Timestamps & {
  id: string;
  workspace_id: string;
  entity_id: string;
  org_label: string | null;
  display_name: string;
  last_four: string | null;
  gl_account_id: string;
  is_active: boolean;
}

type BookTransactionRow = Timestamps & {
  id: string;
  workspace_id: string;
  entity_id: string;
  bank_account_id: string;
  txn_date: string;
  description: string;
  bank_description: string | null;
  memo: string | null;
  amount: number;
  status: string;
  failure_reason: string | null;
  review_state: string;
  review_note: string | null;
  suggested_by: string | null;
  confidence: number | null;
  ai_reasoning: string | null;
  external_id: string | null;
}

type BookRuleRow = Timestamps & {
  id: string;
  workspace_id: string;
  entity_id: string | null;
  match_pattern: string;
  match_field: string;
  priority: number;
  splits: unknown;
  treatment: string;
  note: string | null;
  hit_count: number;
  last_hit_at: string | null;
  created_by: string | null;
  confidence: number;
  is_active: boolean;
}

type TrialBalanceRow = {
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

/** Insert and Update are deliberately loose: defaults do most of the work. */
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
type View<Row> = { Row: Row; Relationships: [] };

export type BooksDatabase = {
  // supabase-js reads this to pick the right Postgrest overloads; without it the
  // client falls back to a shape where every table name resolves to `never`.
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      book_entities: Table<BookEntityRow>;
      book_accounts: Table<BookAccountRow>;
      book_bank_accounts: Table<BookBankAccountRow>;
      book_transactions: Table<BookTransactionRow>;
      book_rules: Table<BookRuleRow>;
    };
    Views: {
      book_trial_balance: View<TrialBalanceRow>;
    };
    Functions: {
      book_post_transaction: {
        Args: { _txn_id: string; _splits: unknown; _memo?: string | null; _source?: string };
        Returns: string;
      };
      book_unpost_transaction: { Args: { _txn_id: string }; Returns: undefined };
      book_apply_rules: {
        Args: { _entity_id?: string | null; _limit?: number; _dry_run?: boolean };
        Returns: { txn_id: string; rule_id: string; action: string; detail: string }[];
      };
      book_rule_preview: {
        Args: { _rule_id: string; _limit?: number };
        Returns: { txn_id: string; txn_date: string; description: string; amount: number }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export const booksDb = supabase as unknown as SupabaseClient<BooksDatabase>;
