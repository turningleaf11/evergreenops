import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Outlet, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { DepartmentsProvider } from "@/contexts/DepartmentsContext";
import { CEOContextProvider } from "@/lib/ceo-context";
import { StrategyFlowProvider } from "@/lib/strategy-flow";
import { TrainingProgressProvider } from "@/lib/training-progress";
import { TrainingProvider } from "@/contexts/TrainingContext";
import { Layout } from "@/components/Layout";
import Index from "./pages/Index";
import LandingPage from "./pages/LandingPage";
import CeoDashboard from "./pages/CeoDashboard";
import DepartmentPage from "./pages/DepartmentPage";
import DocsPage from "./pages/DocsPage";
import DatabasesPage from "./pages/DatabasesPage";
import PeoplePage from "./pages/PeoplePage";
import SettingsPage from "./pages/SettingsPage";
import TrainingPage from "./pages/TrainingPage";
import ExecutionPage from "./pages/ExecutionPage";
import BusinessPlansPage from "./pages/BusinessPlansPage";
import BusinessPlanDetailPage from "./pages/BusinessPlanDetailPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import NotesPage from "./pages/NotesPage";
import TimeClockPage from "./pages/TimeClockPage";
import MarketResearchPage from "./pages/MarketResearchPage";
import ContentStudioPage from "./pages/ContentStudioPage";
import DealRoomsPage from "./pages/DealRoomsPage";
import DealRoomDetailPage from "./pages/DealRoomDetailPage";
import AiWorkshopPage from "./pages/AiWorkshopPage";
import AiHubPage from "./pages/AiHubPage";
import AiHubAgentTasksPage from "./pages/AiHubAgentTasksPage";
import AiHubDocsPage from "./pages/AiHubDocsPage";
import ProcessMapPage from "./pages/ProcessMapPage";
import FormsPage from "./pages/FormsPage";
import CompanyFeedPage from "./pages/CompanyFeedPage";
import InboxPage from "./pages/InboxPage";
import ActivityPage from "./pages/ActivityPage";
import SyncPage from "./pages/SyncPage";
import WhiteboardsPage from "./pages/WhiteboardsPage";
import WhiteboardDetailPage from "./pages/WhiteboardDetailPage";
import CrmPage from "./pages/CrmPage";
import MeetingsPage from "./pages/MeetingsPage";
import IntegrationsGmailPage from "./pages/IntegrationsGmailPage";
import DeveloperPage from "./pages/DeveloperPage";
import HelpPage from "./pages/HelpPage";
import ScorecardPage from "./pages/ScorecardPage";
import GmailCallbackPage from "./pages/GmailCallbackPage";
import PublicNotePage from "./pages/PublicNotePage";
import PublicFormPage from "./pages/PublicFormPage";
import PublicLeadFormPage from "./pages/PublicLeadFormPage";
import InternalFormPage from "./pages/InternalFormPage";
import { MentionClickHandler } from "./components/MentionClickHandler";
import { MentionPeekProvider } from "./components/mention-peek/MentionPeekProvider";
import { MentionPeekRoot } from "./components/mention-peek/MentionPeekRoot";
import { FileViewerProvider } from "./components/file-viewer/FileViewerProvider";

import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import OnboardingPage from "./pages/OnboardingPage";
import NotFound from "./pages/NotFound";
import { OnboardingGate } from "./components/OnboardingGate";

const queryClient = new QueryClient();

function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/landing" replace />;
  }

  return <Outlet />;
}

/**
 * Gate for orbit-only members. They can only see Home / Feed / People /
 * Training / their Orbit Program dept page. Everything else redirects home.
 *
 * Allowed paths: /, /feed, /people, /training, /department/:id (their own),
 * /notes, /settings (personal profile only).
 */
function OrbitOnlyGuard() {
  const { isOrbitOnly, profile, loading, roleLoaded } = useAuth();
  const location = useLocation();
  if (loading || !roleLoaded) return <Outlet />;
  if (!isOrbitOnly) return <Outlet />;

  const path = location.pathname;
  const allowed =
    path === "/" ||
    path.startsWith("/feed") ||
    path.startsWith("/people") ||
    path.startsWith("/training") ||
    path.startsWith("/notes") ||
    path.startsWith("/settings") ||
    path.startsWith("/help") ||
    // Their own Orbit Program dept page only
    (path.startsWith("/department/") && profile?.department_id && path.startsWith(`/department/${profile.department_id}`));

  if (!allowed) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Restricts a route to the workspace primary admin (CEO). */
function PrimaryAdminRoute() {
  const { isPrimaryAdmin, loading, roleLoaded } = useAuth();
  if (loading || !roleLoaded) return null;
  if (!isPrimaryAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Restricts a route to admins only. */
function AdminRoute() {
  const { isAdmin, loading, roleLoaded } = useAuth();
  if (loading || !roleLoaded) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Restricts a route to admins and department leaders. */
function LeaderRoute() {
  const { isLeader, loading, roleLoaded } = useAuth();
  if (loading || !roleLoaded) return null;
  if (!isLeader) return <Navigate to="/" replace />;
  return <Outlet />;
}

/**
 * Restricts a route based on role baseline + per-user page grants.
 * If the user has the required role OR an explicit grant for this page, they're allowed.
 */
function PageRoute({ pageKey, minRole }: { pageKey: import("@/hooks/usePageAccess").PageKey; minRole: "admin" | "leader" | "primary_admin" }) {
  const { loading, roleLoaded } = useAuth();
  const { allowed, loaded } = usePageAccess(pageKey, minRole);
  if (loading || !roleLoaded || !loaded) return null;
  if (!allowed) return <Navigate to="/" replace />;
  return <Outlet />;
}

function PublicRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <WorkspaceProvider>
      <DepartmentsProvider>
      <CEOContextProvider>
      <StrategyFlowProvider>
      <TrainingProvider>
      <TrainingProgressProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <FileViewerProvider>
          <MentionPeekProvider>
          <MentionClickHandler />
          <MentionPeekRoot />
          <Routes>
            {/* Public shared note (no auth required) */}
            <Route path="/n/:token" element={<PublicNotePage />} />

            {/* Public list form (no auth required) */}
            <Route path="/f/:slug" element={<PublicFormPage />} />

            {/* Public lead intake form (no auth required) */}
            <Route path="/submit-lead/:slug" element={<PublicLeadFormPage />} />

            {/* Public auth routes */}
            <Route element={<PublicRoute />}>
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
            </Route>

            {/* Protected app routes */}
            <Route element={<ProtectedRoute />}>
              {/* Full-screen onboarding (no Layout) */}
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route element={<OnboardingGate><Layout /></OnboardingGate>}>
                <Route element={<OrbitOnlyGuard />}>
                <Route path="/" element={<Index />} />

                {/* CEO-only baseline (with optional per-user grant for AI Hub) */}
                <Route element={<PrimaryAdminRoute />}>
                  <Route path="/ceo" element={<CeoDashboard />} />
                </Route>
                {/* Agent task board — currently the primary admin (+ any explicit
                    page_grants), by design. To widen to all Admins later, change
                    minRole below to "admin". */}
                <Route element={<PageRoute pageKey="ai_hub" minRole="primary_admin" />}>
                  <Route path="/ai-hub" element={<AiHubPage />} />
                  <Route path="/ai-hub/agent-tasks" element={<AiHubAgentTasksPage />} />
                  <Route path="/ai-hub/docs" element={<AiHubDocsPage />} />
                </Route>

                {/* People — Directory + Org Chart visible to all; People Ops tab is admin-gated inside the page */}
                <Route path="/people" element={<PeoplePage />} />

                {/* TEMPORARY: still being developed, gated to primary admin only. Revert to PageRoute pageKey="process_map" minRole="admin" when ready to reopen. */}
                <Route element={<PrimaryAdminRoute />}>
                  <Route path="/process-map" element={<ProcessMapPage />} />
                </Route>

                {/* Admin baseline + per-user grants */}
                <Route element={<PageRoute pageKey="crm" minRole="admin" />}>
                  <Route path="/crm" element={<Navigate to="/crm/contacts" replace />} />
                  <Route path="/crm/:tab" element={<CrmPage />} />
                </Route>
                <Route element={<PageRoute pageKey="forms" minRole="admin" />}>
                  <Route path="/forms" element={<FormsPage />} />
                </Route>
                <Route element={<PageRoute pageKey="market_research" minRole="admin" />}>
                  <Route path="/market-research" element={<MarketResearchPage />} />
                </Route>
                <Route element={<PageRoute pageKey="content_studio" minRole="admin" />}>
                  <Route path="/content-studio" element={<ContentStudioPage />} />
                </Route>
                <Route element={<PageRoute pageKey="ai_workshop" minRole="admin" />}>
                  <Route path="/ai-workshop" element={<AiWorkshopPage />} />
                </Route>
                <Route element={<PageRoute pageKey="deal_rooms" minRole="admin" />}>
                  <Route path="/deal-rooms" element={<DealRoomsPage />} />
                  <Route path="/deal-rooms/:id" element={<DealRoomDetailPage />} />
                </Route>

                {/* Leader baseline + per-user grants */}
                <Route element={<PageRoute pageKey="business_plans" minRole="leader" />}>
                  <Route path="/business-plans" element={<BusinessPlansPage />} />
                  <Route path="/business-plans/:id" element={<BusinessPlanDetailPage />} />
                </Route>
                <Route element={<PageRoute pageKey="execution" minRole="leader" />}>
                  <Route path="/execution" element={<ExecutionPage />} />
                  <Route path="/projects/:id" element={<ProjectDetailPage />} />
                  <Route path="/tasks/:id" element={<TaskDetailPage />} />
                  <Route path="/issues" element={<Navigate to="/execution" replace />} />
                </Route>
                {/* TEMPORARY: still being developed, gated to primary admin only. Revert to PageRoute pageKey="lists" minRole="leader" when ready to reopen. */}
                <Route element={<PrimaryAdminRoute />}>
                  <Route path="/databases" element={<DatabasesPage />} />
                  <Route path="/databases/:dbId" element={<DatabasesPage />} />
                </Route>

                {/* TEMPORARY: still being developed, gated to primary admin only. Revert to PageRoute pageKey="meetings" minRole="leader" when ready to reopen. */}
                <Route element={<PrimaryAdminRoute />}>
                  <Route path="/meetings" element={<MeetingsPage />} />
                </Route>

                {/* TEMPORARY: still being developed, gated to primary admin only. Was open to all authenticated users -- revert that when ready to reopen. */}
                <Route element={<PrimaryAdminRoute />}>
                  <Route path="/whiteboards" element={<WhiteboardsPage />} />
                  <Route path="/whiteboards/:id" element={<WhiteboardDetailPage />} />
                </Route>

                {/* Sync — leadership comms layer (CEO + leaders) */}
                <Route element={<LeaderRoute />}>
                  <Route path="/sync" element={<SyncPage />} />
                  <Route path="/sync/:channelId" element={<SyncPage />} />
                  <Route path="/sync/thread/:threadId" element={<SyncPage />} />
                </Route>

                {/* Open to all authenticated users */}
                <Route path="/department/:id" element={<DepartmentPage />} />
                <Route path="/docs" element={<DocsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/training" element={<TrainingPage />} />
                <Route path="/notes" element={<NotesPage />} />
                <Route path="/vision" element={<Navigate to="/ceo" replace />} />
                <Route path="/feed" element={<CompanyFeedPage />} />
                <Route path="/activity" element={<ActivityPage />} />
                <Route path="/forms/list/:slug" element={<InternalFormPage />} />
                <Route path="/inbox" element={<InboxPage />} />
                <Route path="/scorecard" element={<ScorecardPage />} />
                <Route path="/settings/integrations/gmail" element={<IntegrationsGmailPage />} />
                <Route path="/settings/developer" element={<DeveloperPage />} />
                <Route path="/help" element={<HelpPage />} />
                <Route path="/time-clock" element={<TimeClockPage />} />
                </Route> {/* /OrbitOnlyGuard */}
              </Route>
              <Route path="/integrations/gmail/callback" element={<GmailCallbackPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </MentionPeekProvider>
          </FileViewerProvider>
        </BrowserRouter>
      </TooltipProvider>
      </TrainingProgressProvider>
      </TrainingProvider>
      </StrategyFlowProvider>
      </CEOContextProvider>
      </DepartmentsProvider>
      </WorkspaceProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
