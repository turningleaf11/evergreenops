import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { NotificationBell } from "@/components/ActivityFeed";
import { CompanionProvider } from "@/contexts/CompanionContext";
import { GlobalCompanion } from "@/components/GlobalCompanion";
import { UserOnboardingModal } from "@/components/UserOnboardingModal";
import { GlobalCreateMenu } from "@/components/GlobalCreateMenu";
import { AiToolsRail } from "@/components/AiToolsRail";
import { RemindersBell } from "@/components/RemindersWidget";
import { TimeClockButton } from "@/components/TimeClockButton";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { GlobalSearch } from "@/components/GlobalSearch";
import { LauncherMenu } from "@/components/LauncherMenu";
import { SidebarModeProvider, useSidebarMode } from "@/contexts/SidebarModeContext";

function LayoutInner() {
  const { name: workspaceName, logoUrl } = useWorkspace();
  const { mode } = useSidebarMode();
  const isPinned = mode === "pinned";

  return (
    <SidebarProvider defaultOpen={isPinned}>
      <CompanionProvider>
        <div className="min-h-screen flex flex-col w-full">
          {/* Header — full width, sits above the sidebar */}
          <header className="h-[60px] flex items-center border-b border-border/20 px-3 sm:px-5 shrink-0 bg-card/90 backdrop-blur-md sticky top-0 z-40">
            <div className="flex items-center gap-3 min-w-0">
              {logoUrl ? (
                <img src={logoUrl} alt={workspaceName} className="h-7 w-7 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="h-7 w-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                  {workspaceName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-semibold truncate hidden sm:block">{workspaceName}</span>
            </div>

            <div className="flex-1 flex justify-center px-4">
              <GlobalSearch />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <GlobalCreateMenu />
              <TimeClockButton />
              <LauncherMenu />
              <RemindersBell />
              <NotificationBell />
            </div>
          </header>

          {/* Body row — sidebar (left), main content (center), AI tools rail (right) */}
          <div className={isPinned ? "flex-1 flex min-h-0" : "flex-1 flex min-h-0 relative"}>
            <AppSidebar />
            <main className="flex-1 overflow-auto min-w-0">
              <Outlet />
            </main>
            <AiToolsRail />
          </div>
          <GlobalCompanion />
          <UserOnboardingModal />
        </div>
      </CompanionProvider>
    </SidebarProvider>
  );
}

export function Layout() {
  return (
    <SidebarModeProvider>
      <LayoutInner />
    </SidebarModeProvider>
  );
}
