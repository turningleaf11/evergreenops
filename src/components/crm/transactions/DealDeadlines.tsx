// DealDeadlines — the assignment / buyer-EMD clock, and the "most urgent
// deadline" roll-up for the Closing step header. The contract dates themselves
// (fully executed, EMD due, DD end, closing) are edited via DateCards alongside;
// this owns the buyer-EMD 24h business-day clock and surfaces which deadline is
// nearest so the collapsed step can show risk. The nightly job (run_deadline_
// checks) is the authoritative ping source.

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { StepTone } from "./LaunchStep";

interface Props {
  emd_due_date: string | null;
  due_diligence_end: string | null;
  closing_date: string | null;
  assignment_signed_at: string | null;
  buyer_emd_received_at: string | null;
  onSave: (patch: { assignment_signed_at?: string | null; buyer_emd_received_at?: string | null }) => void;
  onStatus?: (s: { label: string; tone: StepTone } | null) => void;
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

function countdown(n: number): { label: string; tone: StepTone } {
  if (n < 0) return { label: `Overdue ${-n}d`, tone: "danger" };
  if (n === 0) return { label: "Due today", tone: "warn" };
  if (n === 1) return { label: "Tomorrow", tone: "warn" };
  if (n <= 3) return { label: `In ${n} days`, tone: "warn" };
  return { label: `In ${n} days`, tone: "progress" };
}

const CHIP: Record<StepTone, string> = {
  done: "bg-brand-mint/15 text-brand-mint-deep",
  progress: "bg-muted text-muted-foreground",
  todo: "bg-muted text-muted-foreground",
  warn: "bg-brand-tangerine/15 text-brand-tangerine",
  danger: "bg-brand-coral/15 text-brand-coral",
};

export function DealDeadlines(p: Props) {
  const signed = parse(p.assignment_signed_at);
  const buyerDue = signed && !p.buyer_emd_received_at ? buyerEmdDue(signed) : null;

  // Roll up the nearest live deadline for the step header.
  const candidates: { label: string; due: Date }[] = [];
  const add = (label: string, s: string | null) => { const d = parse(s); if (d) candidates.push({ label, due: d }); };
  add("EMD due", p.emd_due_date);
  add("Due diligence", p.due_diligence_end);
  add("Closing", p.closing_date);
  if (buyerDue) candidates.push({ label: "Buyer EMD", due: buyerDue });

  useEffect(() => {
    if (!p.onStatus) return;
    if (candidates.length === 0) { p.onStatus(null); return; }
    const nearest = candidates.reduce((a, b) => (daysUntil(a.due) <= daysUntil(b.due) ? a : b));
    const c = countdown(daysUntil(nearest.due));
    p.onStatus({ label: `${nearest.label} ${c.label.toLowerCase()}`, tone: c.tone });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.emd_due_date, p.due_diligence_end, p.closing_date, p.assignment_signed_at, p.buyer_emd_received_at]);

  return (
    <div className="crm-field-stack">
      {/* Buyer-EMD 24h clock — the assignment-side deadline */}
      <div className="rounded-lg border border-border/50 bg-muted/30 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Buyer EMD clock</span>
          {buyerDue ? (
            (() => { const c = countdown(daysUntil(buyerDue)); return (
              <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", CHIP[c.tone])}>
                Due {fmt(buyerDue)} · {c.label}
              </span>
            ); })()
          ) : p.buyer_emd_received_at ? (
            <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", CHIP.done)}>EMD received</span>
          ) : (
            <span className="text-[11px] text-muted-foreground">Set the signed date to start</span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="crm-field-label">Assignment signed</Label>
            <Input
              type="date"
              value={p.assignment_signed_at ?? ""}
              onChange={(e) => p.onSave({ assignment_signed_at: e.target.value || null })}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="crm-field-label">Buyer EMD received</Label>
            <Input
              type="date"
              value={p.buyer_emd_received_at ?? ""}
              onChange={(e) => p.onSave({ buyer_emd_received_at: e.target.value || null })}
              className="h-9"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          The buyer has 24 hours (next business day) to submit EMD after signing.
        </p>
      </div>
    </div>
  );
}

export default DealDeadlines;
