// Create or edit one rule.
//
// The pattern field is the part that goes wrong, so it says plainly that the
// text is matched literally — a payee copied off the statement is what works,
// and a percent sign in the name is just a percent sign.

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { saveRule, type BookAccount, type BookEntity, type BookRule } from "@/hooks/useBooks";

interface Props {
  rule: Partial<BookRule> | null;
  entities: BookEntity[];
  accounts: BookAccount[];
  onClose: () => void;
  onSaved: () => void;
}

const TREATMENTS: { value: string; label: string; help: string }[] = [
  { value: "post",         label: "Post it",           help: "Books it to the ledger with no further prompting. Only for payees you are certain about." },
  { value: "review",       label: "Hold for review",   help: "Fills in the answer and waits for you. The safe default for a new rule." },
  { value: "transfer",     label: "Internal transfer", help: "My own money moving between my own accounts — never income or expense." },
  { value: "exclude",      label: "Exclude",           help: "Not a business event at all." },
  { value: "intercompany", label: "Intercompany",      help: "One entity paid for another. Always held: it writes to two sets of books." },
];

export default function RuleEditor({ rule, entities, accounts, onClose, onSaved }: Props) {
  const { profile } = useAuth();
  const [draft, setDraft] = useState<Partial<BookRule>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (rule) setDraft(rule); }, [rule]);

  const needsSplits = draft.treatment === "post";
  const splits = draft.splits ?? [];
  const options = accounts
    .filter((a) => !draft.entity_id || a.entity_id === draft.entity_id || a.entity_id === null)
    .filter((a) => a.subtype !== "bank");

  const percentTotal = splits.reduce((s, x) => s + (Number(x.percent) || 0), 0);
  const usesPercent = splits.some((s) => s.percent != null);
  const valid =
    !!draft.match_pattern?.trim() &&
    (!needsSplits ||
      (splits.length > 0 &&
        splits.every((s) => s.account_id) &&
        (!usesPercent || Math.abs(percentTotal - 100) < 0.001)));

  function setSplit(i: number, patch: Partial<BookRule["splits"][number]>) {
    setDraft((d) => ({
      ...d,
      splits: (d.splits ?? []).map((s, j) => (j === i ? { ...s, ...patch } : s)),
    }));
  }

  async function save() {
    setBusy(true);
    try {
      await saveRule({
        ...draft,
        // A rule with no splits stores an empty array, not null — the engine
        // reads it either way, but the column is not nullable.
        splits: needsSplits ? splits : [],
        workspace_id: draft.id ? undefined : profile?.workspace_id,
      });
      toast.success(draft.id ? "Rule updated." : "Rule created. Dry run it before applying.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the rule.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!rule} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="text-[17px]">{draft.id ? "Edit rule" : "New rule"}</SheetTitle>
          <SheetDescription>
            Rules run before anything else and only touch uncategorised transactions.
          </SheetDescription>
        </SheetHeader>

        <div className="crm-section-stack mt-5">
          <div className="crm-field-stack">
            <div>
              <div className="crm-field-label">Match this text</div>
              <Input
                value={draft.match_pattern ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, match_pattern: e.target.value }))}
                placeholder="ADOBE"
                className="h-9 font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Matched literally, anywhere in the field, ignoring case. Not a wildcard —
                paste the payee as it appears on the statement.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="crm-field-label">In</div>
                <Select
                  value={draft.match_field ?? "description"}
                  onValueChange={(v) => setDraft((d) => ({ ...d, match_field: v as BookRule["match_field"] }))}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="description">Description</SelectItem>
                    <SelectItem value="bank_description">Bank description</SelectItem>
                    <SelectItem value="memo">Memo</SelectItem>
                    <SelectItem value="both">Description + bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="crm-field-label">Entity</div>
                <Select
                  value={draft.entity_id ?? "all"}
                  onValueChange={(v) => setDraft((d) => ({ ...d, entity_id: v === "all" ? null : v }))}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any entity</SelectItem>
                    {entities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="crm-field-label">Then</div>
              <Select
                value={draft.treatment ?? "review"}
                onValueChange={(v) => setDraft((d) => ({ ...d, treatment: v as BookRule["treatment"] }))}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TREATMENTS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1.5">
                {TREATMENTS.find((t) => t.value === (draft.treatment ?? "review"))?.help}
              </p>
            </div>
          </div>

          {needsSplits && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="crm-eyebrow">Book it to</div>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setDraft((d) => ({ ...d, splits: [...(d.splits ?? []), { account_id: "", percent: 100 }] }))}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Account
                </Button>
              </div>

              <div className="space-y-2">
                {splits.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <Select value={s.account_id} onValueChange={(v) => setSplit(i, { account_id: v })}>
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
                    <div className="relative w-24">
                      <Input
                        type="number" step="0.01" inputMode="decimal"
                        className="h-9 font-mono text-right pr-6"
                        value={s.percent ?? ""}
                        onChange={(e) => setSplit(i, { percent: Number(e.target.value) })}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </div>
                    {splits.length > 1 && (
                      <Button
                        variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                        onClick={() => setDraft((d) => ({ ...d, splits: (d.splits ?? []).filter((_, j) => j !== i) }))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                Percentages, not amounts — the same rule then works whether the bill is $54.99
                or $61.20. They have to come to 100
                {usesPercent && Math.abs(percentTotal - 100) >= 0.001 && (
                  <span className="text-amber-700 dark:text-amber-400">
                    {" "}— currently {percentTotal}
                  </span>
                )}
                .
              </p>
            </div>
          )}

          <div>
            <div className="crm-field-label">Note</div>
            <Input
              value={draft.note ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              placeholder="Why this rule exists"
              className="h-9"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Active</div>
              <p className="text-xs text-muted-foreground">An inactive rule is kept but never runs.</p>
            </div>
            <Switch
              checked={draft.is_active ?? true}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, is_active: v }))}
            />
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" disabled={!valid || busy} onClick={save}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {draft.id ? "Save" : "Create rule"}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
