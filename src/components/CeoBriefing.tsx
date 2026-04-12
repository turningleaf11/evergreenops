import { useCEOContext } from "@/lib/ceo-context";
import { AlertTriangle, TrendingUp, CircleDot } from "lucide-react";

export function CeoBriefing() {
  const { data } = useCEOContext();

  // TODO: Pull pipeline data from databases, generate AI summary
  const { pipelineSnapshot, topRisks, topLeverage, decisionsNeeded } = data;

  return (
    <div className="space-y-6">
      {/* Pipeline Reality */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Pipeline Reality</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-semibold text-foreground">{pipelineSnapshot.wholesaleDeals}</p>
            <p className="text-xs text-muted-foreground mt-1">Wholesale (1-4 unit)</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-foreground">{pipelineSnapshot.portfolioDeals}</p>
            <p className="text-xs text-muted-foreground mt-1">Portfolio / MF 5+</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-foreground">{pipelineSnapshot.closingThisMonth}</p>
            <p className="text-xs text-muted-foreground mt-1">Closing this month</p>
          </div>
        </div>
      </div>

      {/* Top Risks */}
      {topRisks.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" /> Top Risks
          </h3>
          <ul className="space-y-1.5">
            {topRisks.map((risk, i) => (
              <li key={i} className="text-sm text-foreground/80 pl-4 border-l-2 border-destructive/30">{risk}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Top Leverage */}
      {topLeverage.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3" /> Top Leverage
          </h3>
          <ul className="space-y-1.5">
            {topLeverage.map((item, i) => (
              <li key={i} className="text-sm text-foreground/80 pl-4 border-l-2 border-primary/30">{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Decisions Needing Attention */}
      {decisionsNeeded.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
            <CircleDot className="h-3 w-3" /> Decisions Needed
          </h3>
          <ul className="space-y-1.5">
            {decisionsNeeded.map((d, i) => (
              <li key={i} className="text-sm text-foreground/80 pl-4 border-l-2 border-warning/30">{d}</li>
            ))}
          </ul>
        </div>
      )}

      {topRisks.length === 0 && topLeverage.length === 0 && decisionsNeeded.length === 0 && (
        <p className="text-sm text-muted-foreground italic">Add risks, leverage points, and pending decisions to populate your briefing.</p>
      )}
    </div>
  );
}
