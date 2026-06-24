// Layout — two-column structure: sidebar (left) + main column (right).
//
// Sidebar owns its own top (workspace logo + name) and bottom (account
// menu). The header that used to span the full viewport now lives INSIDE
// the main column so the two columns never overlap. Collapse is a width
// change, not a slide-out.

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { NotificationBell } from "@/components/ActivityFeed";
import { CompanionProvider } from "@/contexts/CompanionContext";
import { GlobalCompanion } from "@/components/GlobalCompanion";
import { UserOnboardingModal } from "@/components/UserOnboardingModal";
import { GlobalCreateMenu } from "@/components/GlobalCreateMenu";
import { AiToolsRail } from "@/components/AiToolsRail";
import { AppConfirmProvider } from "@/components/AppConfirm";
import { RemindersBell } from "@/components/RemindersWidget";
import { TimeClockButton } from "@/components/TimeClockButton";
import { GlobalSearch } from "@/components/GlobalSearch";
import { LauncherMenu } from "@/components/LauncherMenu";
import { SidebarModeProvider } from "@/contexts/SidebarModeContext";
import { useAuth } from "@/contexts/AuthContext";
import { OrbitMemberHub } from "@/components/orbit/OrbitMemberHub";

function LayoutInner() {
  return (
    // Default sidebar to OPEN. Collapse is a width change (icon-only),
    // not a slide-overlay — so there's no need to pin anything.
    <SidebarProvider defaultOpen={true}>
      <CompanionProvider>
        <div className="h-screen overflow-hidden flex w-full">
          {/* Sidebar — full-height left column, owns its own header + footer */}
          <AppSidebar />

          {/* Main column — its own header strip + scrollable outlet */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <header className="h-[56px] flex items-center border-b border-border/40 px-3 sm:px-5 shrink-0 bg-background/95 backdrop-blur-md sticky top-0 z-30">
              {/* Left: page-level breathing room. Page titles render in their
                  own content area below — header doesn't need to duplicate them. */}
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

            <main className="flex-1 overflow-auto min-w-0">
              <Outlet />
            </main>
          </div>

          {/* AI tools rail — far right, separate column */}
          <AiToolsRail />

          <GlobalCompanion />
          <UserOnboardingModal />
          <AppConfirmProvider />
        </div>
      </CompanionProvider>
    </SidebarProvider>
  );
}

export function Layout() {
  const { isOrbitOnly, loading, roleLoaded } = useAuth();

  // Orbit-only members get their own self-contained workbook app — no cockpit
  // sidebar, header, or AI rail. This is their entire experience.
  if (!loading && roleLoaded && isOrbitOnly) {
    return <OrbitMemberHub />;
  }

  return (
    <SidebarModeProvider>
      <LayoutInner />
    </SidebarModeProvider>
  );
}
