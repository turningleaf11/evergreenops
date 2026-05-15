import { useState } from "react";
import { useDailyBriefing } from "@/hooks/useDailyBriefing";
import { useAuth } from "@/contexts/AuthContext";
import { BriefingChatSheet } from "@/components/BriefingChatSheet";
import { AlbusAvatar } from "@/components/AlbusAvatar";
import { Sparkles, ArrowRight } from "lucide-react";

export function BriefingPill() {
  const { user, profile, isPrimaryAdmin } = useAuth();
  const { briefing, unread, markRead } = useDailyBriefing();
  const [open, setOpen] = useState(false);

  // Only the CEO gets the briefing for now (it's keyed off CEO context)
  if (!isPrimaryAdmin) return null;
  if (!briefing) return null;

  const firstName = (profile?.full_name || user?.email || "there").split(" ")[0];
  const preview = briefing.focus || briefing.bullets[0] || "Your day is ready.";

  const handleOpen = () => {
    setOpen(true);
    if (unread) markRead();
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="group w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/[0.04] to-primary/[0.08] hover:from-primary/[0.06] hover:to-primary/[0.12] transition-colors text-left relative"
      >
        <div className="relative shrink-0">
          <AlbusAvatar size="lg" />
          {unread && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background animate-pulse" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Today's briefing from Albus
            </span>
            {unread && <span className="text-[10px] font-medium text-primary">· new</span>}
          </div>
          <p className="text-sm text-foreground/90 truncate">
            {unread ? `Good morning, ${firstName}. ${preview}` : preview}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
      </button>

      <BriefingChatSheet
        open={open}
        onOpenChange={setOpen}
        briefing={briefing}
        firstName={firstName}
      />
    </>
  );
}
