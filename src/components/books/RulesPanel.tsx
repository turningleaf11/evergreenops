// The rules tab.
//
// The whole point of a rule is that it runs unattended, which is exactly why
// this panel leads with a dry run. A rule that matches more than you expected
// is the failure mode here, and it is only visible before anything posts.

import { useMemo, useState } from "react";
import { Play, Plus, Trash2, Loader2, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/primitives";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import RuleEditor from "@/components/books/RuleEditor";
import {
  useBookRules, applyRules, previewRule, deleteRule, money,
  type BookAccount, type BookEntity, type BookRule, type RuleOutcome,
} from "@/hooks/useBooks";

interface Props {
  entities: BookEntity[];
  accounts: BookAccount[];
  entityName: (id: string | null) => string;
  onChanged: () => void;
}

const ACTION_TONE: Record<string, string> = {
  posted:            "text-emerald-700 dark:text-emerald-400",
  would_post:        "text-emerald-700 dark:text-emerald-400",
  suggested:         "text-amber-700 dark:text-amber-400",
  intercompany_held: "text-amber-700 dark:text-amber-400",
  held:              "text-destructive",
};

export default function RulesPanel({ entities, accounts, entityName, onChanged }: Props) {
  const [reloadKey, setReloadKey] = useState(0);
  const { rules, loading } = useBookRules(reloadKey);
  const [entityId, setEntityId] = useState<string>("");
  const [busy, setBusy] = useState<"dry" | "live" | null>(null);
  const [outcomes, setOutcomes] = useState<RuleOutcome[] | null>(null);
  const [wasDryRun, setWasDryRun] = useState(true);
  const [editing, setEditing] = useState<Partial<BookRule> | null>(null);
  const [preview, setPreview] = useState<{ rule: BookRule; rows: Awaited<ReturnType<typeof previewRule>> } | null>(null);

  const refresh = () => { setReloadKey((k) => k + 1); onChanged(); };

  const summary = useMemo(() => {
    if (!outcomes) return null;
    const by = new Map<string, number>();
    outcomes.forEach((o) => by.set(o.action, (by.get(o.action) ?? 0) + 1));
    return [...by.entries()];
  }, [outcomes]);

  async function run(dry: boolean) {
    setBusy(dry ? "dry" : "live");
    try {
      const res = await applyRules(entityId || null, dry);
      setOutcomes(res);
      setWasDryRun(dry);
      if (!dry) {
        refresh();
        toast.success(`${res.length} transaction${res.length === 1 ? "" : "s"} handled.`);
      } else if (res.length === 0) {
        toast.info("No rule matched anything left in the queue.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The run failed.");
    } finally {
      setBusy(null);
    }
  }

  async function showPreview(rule: BookRule) {
    try {
      setPreview({ rule, rows: await previewRule(rule.id, 50) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not preview.");
    }
  }

  async function remove(rule: BookRule) {
    try {
      await deleteRule(rule.id);
      toast.success("Rule deleted. Anything it already posted stays posted.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    }
  }

  return (
    <div className="crm-section-stack">
      <div className="crm-card">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="crm-eyebrow">Run the rules</div>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Rules only ever touch transactions still sitting uncategorised. Dry run first —
              it shows exactly what would happen and writes nothing.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <Select value={entityId || "all"} onValueChange={(v) => setEntityId(v === "all" ? "" : v)}>
              <SelectTrigger className="w-52 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                {entities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={busy !== null} onClick={() => run(true)}>
              {busy === "dry" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              Dry run
            </Button>
            <Button disabled={busy !== null} onClick={() => run(false)}>
              {busy === "live" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Apply
            </Button>
          </div>
        </div>

        {summary && (
          <div className="mt-4 border-t pt-4">
            <div className="crm-eyebrow mb-2">
              {wasDryRun ? "Would happen" : "What happened"}
            </div>
            {summary.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing matched.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-4 text-sm">
                  {summary.map(([action, n]) => (
                    <span key={action} className={ACTION_TONE[action] ?? "text-muted-foreground"}>
                      <span className="font-mono tabular-nums font-semibold">{n}</span>{" "}
                      {action.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
                {/* Anything the ledger refused is the only part worth reading in full. */}
                {outcomes!.filter((o) => o.action === "held").slice(0, 8).map((o) => (
                  <p key={o.txn_id} className="text-xs text-destructive mt-2">{o.detail}</p>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="section-title">Rules</div>
        <Button size="sm" onClick={() => setEditing({ match_field: "description", treatment: "review", priority: 100, splits: [] })}>
          <Plus className="h-4 w-4 mr-1.5" /> New rule
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rules.length === 0 ? (
        <EmptyState
          icon={Play}
          title="No rules yet"
          description="A rule turns a payee you have already categorised into one you never have to categorise again. Start with the names that repeat every month."
        />
      ) : (
        <div className="space-y-2">
          {rules.map((r) => (
            <div
              key={r.id}
              onClick={() => setEditing(r)}
              className={`rounded-xl border bg-card p-4 hover:shadow-lg hover:-translate-y-px transition-all cursor-pointer ${
                r.is_active ? "" : "opacity-50"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold tracking-tight truncate">
                    {r.match_pattern}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                    <StatusPill kind="book_rule" value={r.treatment} size="sm" />
                    <span>{r.match_field.replace("_", " ")}</span>
                    <span>{entityName(r.entity_id)}</span>
                    {r.hit_count > 0 && (
                      <span className="text-foreground">
                        {r.hit_count} match{r.hit_count === 1 ? "" : "es"}
                      </span>
                    )}
                  </div>
                  {r.note && <p className="text-xs text-muted-foreground mt-2">{r.note}</p>}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => setEditing(r)}>
                      <Pencil className="h-4 w-4 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => showPreview(r)}>
                      <Eye className="h-4 w-4 mr-2" /> What it matches
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => remove(r)}>
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div className="crm-card">
          <div className="flex items-center justify-between mb-3">
            <div className="crm-eyebrow">
              “{preview.rule.match_pattern}” matches {preview.rows.length}
              {preview.rows.length === 50 ? "+" : ""} transaction
              {preview.rows.length === 1 ? "" : "s"}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>Close</Button>
          </div>
          {preview.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing matches. The pattern is plain text, not a wildcard — a payee written
              exactly as it appears on the statement is what finds it.
            </p>
          ) : (
            <div className="space-y-1">
              {preview.rows.map((row) => (
                <div key={row.txn_id} className="flex justify-between gap-4 text-sm">
                  <span className="font-mono text-xs text-muted-foreground shrink-0">{row.txn_date}</span>
                  <span className="truncate flex-1">{row.description}</span>
                  <span className="font-mono tabular-nums shrink-0">{money(row.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <RuleEditor
        rule={editing}
        entities={entities}
        accounts={accounts}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); refresh(); }}
      />
    </div>
  );
}
