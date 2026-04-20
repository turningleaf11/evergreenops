import { useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { GreetingHeader } from "@/components/home/GreetingHeader";
import { PulseStrip } from "@/components/home/PulseStrip";
import { DailyMotivation } from "@/components/home/DailyMotivation";
import { PinnedAnnouncementsStrip } from "@/components/home/PinnedAnnouncementsStrip";
import { InlineFeed } from "@/components/home/InlineFeed";
import { RecognitionWidget } from "@/components/home/RecognitionWidget";
import { BirthdaysWidget } from "@/components/home/BirthdaysWidget";
import { MyTeamWidget } from "@/components/home/MyTeamWidget";
import { ThisWeekWidget } from "@/components/home/ThisWeekWidget";
import type { PostMode } from "@/components/feed/FeedComposer";

const Index = () => {
  const { profile } = useAuth();
  const [requestedMode, setRequestedMode] = useState<PostMode | undefined>();
  const [requestKey, setRequestKey] = useState(0);

  const openComposer = useCallback((mode: PostMode) => {
    setRequestedMode(mode);
    setRequestKey((current) => current + 1);
  }, []);

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-[1600px] mx-auto">
      <OnboardingBanner />

      {/* Row 1: Greeting (full width) */}
      <GreetingHeader name={profile?.full_name} />

      {/* Row 2: Pulse (2/3) + Daily Motivation (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <PulseStrip />
        </div>
        <div className="lg:col-span-1">
          <DailyMotivation />
        </div>
      </div>

      {/* Row 3: Pinned announcements (full width, hides if empty) */}
      <PinnedAnnouncementsStrip />

      {/* Row 4: Magazine grid — Feed (5/12) + Recognition+Celebrations (4/12) + Team+Week (3/12) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        {/* Main column */}
        <div className="lg:col-span-5 md:col-span-2 space-y-5">
          <InlineFeed requestedMode={requestedMode} requestKey={requestKey} />
        </div>

        {/* Center column */}
        <div className="lg:col-span-4 md:col-span-1 space-y-5">
          <RecognitionWidget onGiveKudos={() => openComposer("kudos")} />
          <BirthdaysWidget />
        </div>

        {/* Right rail */}
        <div className="lg:col-span-3 md:col-span-1 space-y-5">
          <MyTeamWidget />
          <ThisWeekWidget />
        </div>
      </div>
    </div>
  );
};

export default Index;
