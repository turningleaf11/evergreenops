// Categorise one bank transaction and post it to the ledger.
//
// The caller only ever names the non-cash side. The database derives the cash
// line from the bank account and refuses anything that does not sum to what
// actually left the account — so this panel's job is to make the remainder
// visible while you work, not to enforce it.

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Loader2, AlertTriangle, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/primitives";
import {
  postTransaction, unpostTransaction, money,
  type BookAccount, type BookTransaction,
} from "@/hooks/useBooks";

interface Split { accountId: string; amount: string }

interface Props {
  txn: BookTransaction | null;
  accounts: BookAccount[];
  entityName: (id: string | null) => string;
  bankName: (id: string) => string;
  onClose: () => void;
  onPosted: () => void;
}

export default function CategorizeSheet({
  txn, accounts, entityName, bankName, onClose, onPosted,
}: Props) {
  const [splits, setSplits] = useState<Split[]>([]);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);

  const gross = txn ? Math.abs(Number(txn.amount)) : 0;
  const isPosted = txn?.review_state === "accepted";

  // Accounts for this entity, plus any shared across all of them.
  const options = useMemo(() => {
    if (!txn) return [];
    return accounts
      .filter((a) => a.entity_id === txn.entity_id || a.entity_id === null)
      .filter((a) => a.subtype !== "bank")  // cash is derived, never chosen
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [accounts, txn]);

  // Open with the whole amount on one line — the common case is a single split.
  useEffect(() => {
    if (!txn) return;
    setSplits([{ accountId: "", amount: gross.toFixed(2) }]);
    setMemo("");
  }, [txn, gross]);

  const allocated = splits.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const remainder = Number((gross - allocated).toFixed(2));
  const complete = Math.abs(remainder) < 0.005 && splits.every((s) => s.accountId && Number(s.amount) > 0);

  async function handlePost() {
    if (!txn) return;
    setBusy(true);
    try {
      await postTransaction(
        txn.id,
        splits.map((s) => ({ account_id: s.accountId, amount: Number(s.amount) })),
        memo || undefined,
      );
      toast.success("Posted to the ledger.");
      onPosted();
      onClose();
    } catch (err) {
      // The database's message names the exact shortfall — surface it verbatim.
      toast.error(err instanceof Error ? err.message : "Could not post.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnpost() {
    if (!txn) return;
    setBusy(true);
    try {
      await unpostTransaction(txn.id);
      toast.success("Unposted. The entry has been removed.");
      onPosted();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not unpost.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!txn} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {txn && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="text-[17px] leading-snug">{txn.description}</SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="font-mono">{txn.txn_date}</span>
                  <span>{entityName(txn.entity_id)}</span>
                  <span>{bankName(txn.bank_account_id)}</span>
                  <StatusPill kind="book_review" value={txn.review_state} size="sm" />
                </div>
              </SheetDescription>
            </SheetHeader>

            <div className="crm-section-stack mt-5">
              <div className="crm-card-muted flex items-baseline justify-between">
                <span className="crm-eyebrow">
                  {Number(txn.amount) < 0 ? "Money out" : "Money in"}
                </span>
                <span className="font-mono tabular-nums text-xl font-semibold">
                  {money(txn.amount)}
                </span>
              </div>

              {txn.memo && (
                <div>
                  <div className="crm-field-label">Bank memo</div>
                  <p className="text-sm text-muted-foreground">{txn.memo}</p>
                </div>
              )}

              {txn.ai_reasoning && (
                <div className="rounded-lg bg-amber-500/10 p-3">
                  <div className="crm-eyebrow text-amber-700 dark:text-amber-400">Why this is held</div>
                  <p className="text-xs mt-1 text-amber-700 dark:text-amber-400">{txn.ai_reasoning}</p>
                </div>
              )}

              {isPosted ? (
                <div className="crm-card-muted">
                  <p className="text-sm">
                    This is already posted to the ledger. Unpost it to change the categorisation —
                    the journal entry is removed and the transaction returns to unreviewed.
                  </p>
                  <Button variant="outline" className="mt-3" disabled={busy} onClick={handleUnpost}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Undo2 className="h-4 w-4 mr-2" />}
                    Unpost
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="crm-eyebrow">Categorise</div>
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => setSplits((s) => [...s, { accountId: "", amount: Math.max(remainder, 0).toFixed(2) }])}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Split
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {splits.map((s, i) => (
                        <div key={i} className="flex gap-2">
                          <Select
                            value={s.accountId}
                            onValueChange={(v) =>
                              setSplits((arr) => arr.map((x, j) => (j === i ? { ...x, accountId: v } : x)))}
                          >
                            <SelectTrigger className="flex-1 h-9">
                              <SelectValue placeholder="Choose an account…" />
                            </SelectTrigger>
                            <SelectContent>
                              {options.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  <span className="font-mono text-xs mr-2 text-muted-foreground">{a.code}</span>
                                  {a.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number" step="0.01" inputMode="decimal"
                            className="w-28 h-9 font-mono text-right"
                            value={s.amount}
                            onChange={(e) =>
                              setSplits((arr) => arr.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                          />
                          {splits.length > 1 && (
                            <Button
                              variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                              onClick={() => setSplits((arr) => arr.filter((_, j) => j !== i))}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* The running remainder — a mortgage is three lines, and this
                        is what stops you posting two of them. */}
                    <div className={`mt-3 flex justify-between text-sm rounded-lg px-3 py-2 ${
                      Math.abs(remainder) < 0.005
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    }`}>
                      <span className="font-medium">
                        {Math.abs(remainder) < 0.005 ? "Fully allocated" : "Still to allocate"}
                      </span>
                      <span className="font-mono tabular-nums font-semibold">{money(remainder)}</span>
                    </div>
                  </div>

                  <div>
                    <div className="crm-field-label">Memo (optional)</div>
                    <Input
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      placeholder={txn.description}
                      className="h-9"
                    />
                  </div>

                  {!complete && (
                    <p className="text-xs text-muted-foreground flex gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                      Every line needs an account, and the splits have to account for the whole
                      amount. The ledger will refuse anything that does not balance.
                    </p>
                  )}

                  <Button className="w-full" disabled={!complete || busy} onClick={handlePost}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Post to ledger
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
