import { useMyOrbitMembership } from "@/hooks/useMyOrbitMembership";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TRACK_COLORS, TRACK_LABEL, STATUS_COLORS, STATUS_LABEL } from "@/components/orbit/orbit-types";
import { differenceInDays, format } from "date-fns";
import { Sparkles, ArrowRight, AlertTriangle, BookOpen, BarChart3, CheckCircle2, Circle, ListChecks } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function MyOrbitWidget() {
  const { member, recentPerformance, strikes, checklist, loading } = useMyOrbitMembership();

  if (loading || !member) return null;

  const daysOnTrack = differenceInDays(new Date(), new Date(member.track_started_at));
  const daysLeft = Math.max(0, 90 - daysOnTrack);
  const past90 = daysOnTrack >= 90;
  const progress = Math.min(100, (daysOnTrack / 90) * 100);

  // Sum recent performance (most recent 4 weeks)
  const recentSums = recentPerformance.slice(0, 4).reduce(
    (acc, p) => ({
      calls: acc.calls + (p.calls_made || 0),
      appts: acc.appts + (p.appointments_set || 0),
      conv: acc.conv + (p.conversations || 0),
      deals: acc.deals + (p.deals_closed || 0),
    }),
    { calls: 0, appts: 0, conv: 0, deals: 0 }
  );

  const showStrikeWarning = strikes.length > 0;

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardContent className="p-0">
        {/* Header with gradient */}
        <div className="px-5 py-4 bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-transparent border-b border-border/40">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">My Orbit Track</span>
            </div>
            <Link
              to={`/department/${member.department_id}`}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
            >
              Open <ArrowRight className="h-2.5 w-2.5" />
            </Link>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className={`text-xs ${TRACK_COLORS[member.track]}`}>{TRACK_LABEL[member.track]}</Badge>
            <Badge variant="secondary" className={`text-[10px] ${STATUS_COLORS[member.status]}`}>{STATUS_LABEL[member.status]}</Badge>
          </div>

          {/* 90-day progress */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Day {daysOnTrack} of 90</span>
              <span className={cn("font-medium", past90 ? "text-amber-600" : "text-muted-foreground")}>
                {past90 ? "Track review due" : `${daysLeft} days left`}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full transition-all", past90 ? "bg-amber-500" : "bg-primary")}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {showStrikeWarning && (
            <div className="flex items-start gap-2 px-2.5 py-2 rounded-md bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-foreground">
                You have <strong>{strikes.length}/3 strikes</strong>. Stay locked in.
              </p>
            </div>
          )}

          {/* Setup checklist — show only when there's anything pending */}
          {checklist.length > 0 && checklist.some((c) => !c.done) && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ListChecks className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Your director is setting up</span>
                </div>
                <span className="text-[10px] text-muted-foreground/60">
                  {checklist.filter((c) => c.done).length}/{checklist.length}
                </span>
              </div>
              <div className="space-y-0.5">
                {checklist.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 px-1.5 py-1 text-xs">
                    {c.done ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                    ) : (
                      <Circle className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                    )}
                    <span className={cn(c.done ? "text-muted-foreground/60 line-through" : "text-foreground/90")}>
                      {c.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance summary */}
          {recentPerformance.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <BarChart3 className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Last 4 weeks</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center">
                  <p className="text-base font-bold text-foreground">{recentSums.calls}</p>
                  <p className="text-[9px] text-muted-foreground">Calls</p>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-foreground">{recentSums.appts}</p>
                  <p className="text-[9px] text-muted-foreground">Appts</p>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-foreground">{recentSums.conv}</p>
                  <p className="text-[9px] text-muted-foreground">Conv</p>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-emerald-600">{recentSums.deals}</p>
                  <p className="text-[9px] text-muted-foreground">Deals</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/60 italic text-center py-1">
              No performance data yet — your director will start tracking soon.
            </p>
          )}

          {/* CTA */}
          <Link to={`/department/${member.department_id}`}>
            <Button variant="outline" size="sm" className="w-full gap-1.5 mt-1">
              <BookOpen className="h-3 w-3" /> Open my track resources
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
