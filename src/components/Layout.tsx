import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { NotificationBell } from "@/components/ActivityFeed";
import { CompanionProvider } from "@/contexts/CompanionContext";
import { GlobalCompanion } from "@/components/GlobalCompanion";
import { GlobalCreateMenu } from "@/components/GlobalCreateMenu";
import { RemindersBell } from "@/components/RemindersWidget";

export function Layout() {
  return (
    <SidebarProvider>
      <CompanionProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center border-b border-border/30 px-5 shrink-0 justify-between bg-card/80 backdrop-blur-sm">
              <SidebarTrigger className="mr-3" />
              <div className="flex items-center gap-2">
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
