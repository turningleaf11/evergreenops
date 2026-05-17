import { TeamHealthWidget } from "@/components/ceo/TeamHealthWidget";
import { ThisWeeksMeetingWidget } from "@/components/ceo/ThisWeeksMeetingWidget";
import { CeoKpiCard } from "@/components/ceo/CeoKpiCard";
import { ThisWeekMilestones } from "@/components/ceo/ThisWeekMilestones";
import { AlbusPlanWeekButton } from "@/components/ceo/AlbusPlanWeek";

export function ThisWeekTab() {
  return (
    <div className="space-y-6">
      {/* Albus plan-the-week entry point */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">This Week</h2>
          <p className="text-xs text-muted-foreground/70 mt-0.5">Let Albus draft a plan, then dispatch it to the team.</p>
        </div>
        <AlbusPlanWeekButton />
      </div>

      {/* KPI Snapshot */}
      <CeoKpiCard />

      {/* Team Health */}
      <TeamHealthWidget />

      {/* This Week's Leadership Meeting */}
      <ThisWeeksMeetingWidget />

      {/* This Week's Milestones — projects + tasks landing this week, plus current quarter goals */}
      <ThisWeekMilestones />
    </div>
  );
}
