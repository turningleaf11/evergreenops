import { useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { BriefingPill } from "@/components/home/BriefingPill";
import { GreetingHeader } from "@/components/home/GreetingHeader";
import { DailyMotivation } from "@/components/home/DailyMotivation";
import { PinnedAnnouncementsStrip } from "@/components/home/PinnedAnnouncementsStrip";
import { SlimFeed } from "@/components/home/SlimFeed";
import { MyTasksWidget } from "@/components/home/MyTasksWidget";
import { RemindersWidget } from "@/components/RemindersWidget";
import { RecentDocsWidget } from "@/components/home/RecentDocsWidget";
import { RecognitionWidget } from "@/components/home/RecognitionWidget";
import { BirthdaysWidget } from "@/components/home/BirthdaysWidget";
import { MyTeamWidget } from "@/components/home/MyTeamWidget";
import { ThisWeekWidget } from "@/components/home/ThisWeekWidget";
import { DepartmentsWidget } from "@/components/home/DepartmentsWidget";
import { FormsWidget } from "@/components/home/FormsWidget";
import { GiveKudosDialog } from "@/components/home/GiveKudosDialog";

const Index = () => {
  const { profile } = useAuth();
  const [kudosOpen, setKudosOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const onKudosSent = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-[1600px] mx-auto">
      <OnboardingBanner />

      <BriefingPill />

      {/* Row 1: Greeting (8/12) + Daily Motivation (4/12) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <GreetingHeader name={profile?.full_name} />
        </div>
        <div className="lg:col-span-1">
          <DailyMotivation />
        </div>
      </div>

      {/* Row 2: Pinned Announcements (full width, hides if empty) */}
      <PinnedAnnouncementsStrip />

      {/* Row 3: Magazine grid — Tasks/Docs (3) + Recognition/Feed (5) + Reminders/Week/Celebrations/Team (4) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        {/* Left column — personal work */}
        <div className="lg:col-span-4 md:col-span-1 space-y-5">
          <RemindersWidget />
          <MyTasksWidget />
          <RecentDocsWidget />
        </div>

        {/* Center column — social */}
        <div className="lg:col-span-5 md:col-span-2 space-y-5">
          <RecognitionWidget key={`rec-${refreshKey}`} onGiveKudos={() => setKudosOpen(true)} />
          <SlimFeed key={`feed-${refreshKey}`} />
        </div>

        {/* Right rail — time & people */}
        <div className="lg:col-span-3 md:col-span-1 space-y-5">
          <ThisWeekWidget />
          <MyTeamWidget />
          <DepartmentsWidget />
          <FormsWidget />
          <BirthdaysWidget />
        </div>
      </div>

      <GiveKudosDialog open={kudosOpen} onOpenChange={setKudosOpen} onSent={onKudosSent} />
    </div>
  );
};

export default Index;
