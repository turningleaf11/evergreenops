import { MapPin, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export interface MarketSummary {
  id: string;
  name: string;
  location: string | null;
  strategy: string | null;
  updated_at: string;
  last_analyzed_at?: string | null;
}

interface Props {
  market: MarketSummary;
  onClick: () => void;
}

export function MarketCard({ market, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm transition-all p-4 space-y-2 group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{market.name}</h3>
          {market.location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" /> {market.location}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        {market.strategy && (
          <span className="capitalize bg-primary/10 text-primary rounded-full px-2 py-0.5">
            {market.strategy.replace(/_/g, " ")}
          </span>
        )}
        <span>
          {market.last_analyzed_at
            ? <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Analyzed {formatDistanceToNow(new Date(market.last_analyzed_at), { addSuffix: true })}</span>
            : `Updated ${formatDistanceToNow(new Date(market.updated_at), { addSuffix: true })}`}
        </span>
      </div>
    </button>
  );
}
