import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Outlet } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
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
import LeadershipDashboard from "./pages/LeadershipDashboard";
import DepartmentPage from "./pages/DepartmentPage";
import DocsPage from "./pages/DocsPage";
import DatabasesPage from "./pages/DatabasesPage";
import PeoplePage from "./pages/PeoplePage";
import SettingsPage from "./pages/SettingsPage";
import TrainingPage from "./pages/TrainingPage";
import ExecutionPage from "./pages/ExecutionPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import NotesPage from "./pages/NotesPage";
import TimeClockPage from "./pages/TimeClockPage";
import MarketResearchPage from "./pages/MarketResearchPage";
import ContentStudioPage from "./pages/ContentStudioPage";
import FormsPage from "./pages/FormsPage";
import CompanyFeedPage from "./pages/CompanyFeedPage";
import InboxPage from "./pages/InboxPage";
import CrmPage from "./pages/CrmPage";
import MeetingsPage from "./pages/MeetingsPage";
import IntegrationsGmailPage from "./pages/IntegrationsGmailPage";
import DeveloperPage from "./pages/DeveloperPage";
import HelpPage from "./pages/HelpPage";
import ScorecardPage from "./pages/ScorecardPage";
import GmailCallbackPage from "./pages/GmailCallbackPage";
import PublicNotePage from "./pages/PublicNotePage";
import PublicFormPage from "./pages/PublicFormPage";
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

/** Restricts a route to the workspace primary admin (CEO). */
function PrimaryAdminRoute() {
  const { isPrimaryAdmin, loading, roleLoaded } = useAuth();
  if (loading || !roleLoaded) return null;
  if (!isPrimaryAdmin) return <Navigate to="/" replace />;
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
                <Route path="/" element={<Index />} />
                <Route element={<PrimaryAdminRoute />}>
                  <Route path="/ceo" element={<CeoDashboard />} />
                </Route>
                <Route path="/leadership/:deptId" element={<LeadershipDashboard />} />
                <Route path="/department/:id" element={<DepartmentPage />} />
                <Route path="/docs" element={<DocsPage />} />
                <Route path="/databases" element={<DatabasesPage />} />
                <Route path="/databases/:dbId" element={<DatabasesPage />} />
                <Route path="/people" element={<PeoplePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/training" element={<TrainingPage />} />
                <Route path="/notes" element={<NotesPage />} />
                
                <Route path="/execution" element={<ExecutionPage />} />
                <Route path="/projects/:id" element={<ProjectDetailPage />} />
                <Route path="/tasks/:id" element={<TaskDetailPage />} />
                <Route path="/issues" element={<Navigate to="/execution" replace />} />
                <Route path="/vision" element={<Navigate to="/ceo" replace />} />

                {/* Intranet */}
                <Route path="/feed" element={<CompanyFeedPage />} />
                <Route path="/forms" element={<FormsPage />} />
                <Route path="/forms/list/:slug" element={<InternalFormPage />} />
                <Route path="/inbox" element={<InboxPage />} />
                <Route path="/crm" element={<Navigate to="/crm/contacts" replace />} />
                <Route path="/crm/:tab" element={<CrmPage />} />
                <Route path="/meetings" element={<MeetingsPage />} />
                <Route path="/scorecard" element={<ScorecardPage />} />
                <Route path="/settings/integrations/gmail" element={<IntegrationsGmailPage />} />
                <Route path="/settings/developer" element={<DeveloperPage />} />
                <Route path="/help" element={<HelpPage />} />

                {/* Add-Ons */}
                <Route path="/time-clock" element={<TimeClockPage />} />
                <Route path="/market-research" element={<MarketResearchPage />} />
                <Route path="/content-studio" element={<ContentStudioPage />} />
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
