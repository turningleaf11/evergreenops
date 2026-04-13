import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { NotificationBell } from "@/components/ActivityFeed";
import { CompanionProvider } from "@/contexts/CompanionContext";
import { GlobalCompanion } from "@/components/GlobalCompanion";

export function Layout() {
  return (
    <SidebarProvider>
      <CompanionProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-12 flex items-center border-b px-4 shrink-0 justify-between">
              <SidebarTrigger className="mr-3" />
              <NotificationBell />
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
