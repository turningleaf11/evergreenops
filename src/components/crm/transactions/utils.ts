export const TX_LANE_LABEL: Record<string, string> = {
  wholesale: "Wholesale",
  portfolio: "Portfolio",
};

// HSL tokens — azure for wholesale, mint for portfolio
export const TX_LANE_COLOR: Record<string, string> = {
  wholesale: "210 90% 55%", // azure blue
  portfolio: "160 65% 45%", // tropical mint
};

export const TX_TYPE_LABEL: Record<string, string> = {
  assign: "Assign",
  double_close: "Double Close",
  buy: "Buy",
};

export const TX_TYPE_COLOR: Record<string, string> = {
  assign: "270 60% 55%",
  double_close: "30 90% 55%",
  buy: "200 70% 45%",
};

export const TX_STATUS_COLOR: Record<string, string> = {
  active: "210 70% 50%",
  closed: "142 76% 36%",
  cancelled: "0 0% 50%",
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
  if (days < 7) return "text-red-600 bg-red-500/10 border-red-500/30";
  if (days < 14) return "text-amber-600 bg-amber-400/15 border-amber-400/30";
  return "text-emerald-600 bg-emerald-500/10 border-emerald-500/30";
}

export function fmtCountdown(days: number | null): string {
  if (days == null) return "—";
  if (days === 0) return "today";
  if (days < 0) return `${Math.abs(days)}d ago`;
  return `${days}d away`;
}
