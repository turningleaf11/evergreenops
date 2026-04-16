import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { NotificationBell } from "@/components/ActivityFeed";
import { CompanionProvider } from "@/contexts/CompanionContext";
import { GlobalCompanion } from "@/components/GlobalCompanion";
import { GlobalCreateMenu } from "@/components/GlobalCreateMenu";
import { RemindersBell } from "@/components/RemindersWidget";
import { TimeClockButton } from "@/components/TimeClockButton";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { GlobalSearch } from "@/components/GlobalSearch";

export function Layout() {
  const { name: workspaceName, logoUrl } = useWorkspace();

  return (
    <SidebarProvider>
      <CompanionProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-[60px] flex items-center border-b border-border/20 px-3 sm:px-5 shrink-0 bg-card/90 backdrop-blur-md sticky top-0 z-30">
              {/* Left zone */}
              <div className="flex items-center gap-3 min-w-0">
                <SidebarTrigger />
                {logoUrl ? (
                  <img src={logoUrl} alt={workspaceName} className="h-7 w-7 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="h-7 w-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                    {workspaceName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-semibold truncate hidden sm:block">{workspaceName}</span>
              </div>

              {/* Center zone — search */}
              <div className="flex-1 flex justify-center px-4">
                <GlobalSearch />
              </div>

              {/* Right zone */}
              <div className="flex items-center gap-2 shrink-0">
                <TimeClockButton />
                <GlobalCreateMenu />
                <RemindersBell />
                <NotificationBell />
              </div>
            </header>
            <main className="flex-1 overflow-auto">
              <Outlet />
            </main>
          </div>
          <GlobalCompanion />
        </div>
      </CompanionProvider>
    </SidebarProvider>
  );
}
