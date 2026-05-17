import { TeamHealthWidget } from "@/components/ceo/TeamHealthWidget";
import { ThisWeeksMeetingWidget } from "@/components/ceo/ThisWeeksMeetingWidget";
import { CeoKpiCard } from "@/components/ceo/CeoKpiCard";
import { ThisWeekMilestones } from "@/components/ceo/ThisWeekMilestones";

export function ThisWeekTab() {
  return (
    <div className="space-y-6">
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
