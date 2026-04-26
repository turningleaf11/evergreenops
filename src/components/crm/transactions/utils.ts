export const TX_LANE_LABEL: Record<string, string> = {
  wholesale: "Wholesale",
  portfolio: "Portfolio",
};

// Brand-aligned HSL tokens
export const TX_LANE_COLOR: Record<string, string> = {
  wholesale: "var(--brand-azure)",
  portfolio: "var(--brand-mint)",
};

export const TX_TYPE_LABEL: Record<string, string> = {
  assign: "Assign",
  double_close: "Double Close",
  buy: "Buy",
};

export const TX_TYPE_COLOR: Record<string, string> = {
  assign: "var(--brand-violet)",
  double_close: "var(--brand-tangerine)",
  buy: "var(--brand-azure)",
};

export const TX_STATUS_COLOR: Record<string, string> = {
  active: "var(--brand-azure)",
  closed: "var(--brand-mint-deep)",
  cancelled: "220 10% 50%",
};

export const fmtMoney = (n: number | null | undefined) =>
  n == null || isNaN(Number(n))
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(Number(n));

export function daysBetween(target: string | null | undefined): number | null {
  if (!target) return null;
  const t = new Date(target).getTime();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((t - now.getTime()) / 86400000);
}

export function closingCountdownClass(days: number | null): string {
  if (days == null) return "text-muted-foreground bg-muted/40 border-border/40";
  if (days < 7) return "text-brand-coral bg-brand-coral/10 border-brand-coral/30";
  if (days <= 14) return "text-brand-tangerine bg-brand-tangerine/15 border-brand-tangerine/30";
  return "text-brand-mint-deep bg-brand-mint/15 border-brand-mint/30";
}

export function fmtCountdown(days: number | null): string {
  if (days == null) return "—";
  if (days === 0) return "today";
  if (days < 0) return `${Math.abs(days)}d ago`;
  return `${days}d away`;
}
