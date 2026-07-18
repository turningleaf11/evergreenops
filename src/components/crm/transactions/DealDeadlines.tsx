// DealDeadlines — the live TC clock. Countdowns for the contract deadlines
// (EMD due, due diligence, closing) plus the buyer-EMD 24h clock (business-day:
// signed + 1, rolled past weekends). The authoritative pings into the Activity
// inbox come from run_deadline_checks() nightly; this is the at-a-glance view
// and where the assignment dates that drive the buyer-EMD clock are set.

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface Props {
  emd_due_date: string | null;
  due_diligence_end: string | null;
  closing_date: string | null;
  assignment_signed_at: string | null;
  buyer_emd_received_at: string | null;
  onSave: (patch: { assignment_signed_at?: string | null; buyer_emd_received_at?: string | null }) => void;
}

const parse = (s: string | null): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return y ? new Date(y, (m ?? 1) - 1, d ?? 1) : null;
};
const startOfToday = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
const daysUntil = (d: Date) => Math.round((d.getTime() - startOfToday().getTime()) / 86400000);
const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

// Business-day roll-forward (weekends only, client-side; the nightly job also
// accounts for holidays). Buyer EMD is due one business day after signing.
function nextBusinessDay(d: Date): Date {
  const x = new Date(d);
  while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() + 1);
  return x;
}
function buyerEmdDue(signed: Date): Date {
  const d = new Date(signed);
  d.setDate(d.getDate() + 1);
  return nextBusinessDay(d);
}

function Countdown({ due }: { due: Date }) {
  const n = daysUntil(due);
  let label: string, tone: string;
  if (n < 0) { label = `Overdue ${-n}d`; tone = "bg-brand-coral/15 text-brand-coral"; }
  else if (n === 0) { label = "Due today"; tone = "bg-brand-tangerine/15 text-brand-tangerine"; }
  else if (n === 1) { label = "Tomorrow"; tone = "bg-brand-tangerine/15 text-brand-tangerine"; }
  else if (n <= 3) { label = `In ${n} days`; tone = "bg-brand-tangerine/10 text-brand-tangerine"; }
  else { label = `In ${n} days`; tone = "bg-muted text-muted-foreground"; }
  return <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap", tone)}>{label}</span>;
}

export function DealDeadlines(p: Props) {
  const signed = parse(p.assignment_signed_at);
  const rows: { key: string; label: string; due: Date; done?: boolean }[] = [];
  const push = (key: string, label: string, s: string | null) => { const d = parse(s); if (d) rows.push({ key, label, due: d }); };
  push("emd_due", "EMD due (contract)", p.emd_due_date);
  push("dd_end", "Due diligence ends", p.due_diligence_end);
  push("closing", "Closing", p.closing_date);
  if (signed && !p.buyer_emd_received_at) rows.push({ key: "buyer_emd", label: "Buyer EMD due", due: buyerEmdDue(signed) });
  rows.sort((a, b) => a.due.getTime() - b.due.getTime());

  return (
    <section className="space-y-3">
      <h3 className="crm-eyebrow">Deadlines</h3>

      {rows.length === 0 ? (
        <div className="crm-card text-sm text-muted-foreground italic">
          No deadlines set yet — add the contract dates below (or upload the PA and let AI pull them).
        </div>
      ) : (
        <div className="crm-card !p-1.5 divide-y divide-border/40">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-3 px-2.5 py-2">
              <span className="text-sm flex-1">{r.label}</span>
              <span className="text-[13px] text-muted-foreground tabular-nums">{fmt(r.due)}</span>
              <Countdown due={r.due} />
            </div>
          ))}
        </div>
      )}

      {/* Assignment clock — drives the buyer-EMD deadline */}
      <div className="crm-card grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="crm-field-label">Assignment signed</Label>
          <Input
            type="date"
            value={p.assignment_signed_at ?? ""}
            onChange={(e) => p.onSave({ assignment_signed_at: e.target.value || null })}
            className="h-9"
          />
          <p className="text-[11px] text-muted-foreground">
            Starts the buyer&apos;s 24-hour EMD clock (next business day).
          </p>
        </div>
        <div className="space-y-1">
          <Label className="crm-field-label">Buyer EMD received</Label>
          <Input
            type="date"
            value={p.buyer_emd_received_at ?? ""}
            onChange={(e) => p.onSave({ buyer_emd_received_at: e.target.value || null })}
            className="h-9"
          />
          {p.buyer_emd_received_at && (
            <p className="text-[11px] text-brand-mint-deep">EMD received — clock cleared.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default DealDeadlines;
