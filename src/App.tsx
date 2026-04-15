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
import FormsPage from "./pages/FormsPage";
import CompanyFeedPage from "./pages/CompanyFeedPage";

import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import NotFound from "./pages/NotFound";

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
    return <Navigate to="/login" replace />;
  }

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
          <Routes>
            {/* Public auth routes */}
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
            </Route>

            {/* Protected app routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Index />} />
                <Route path="/ceo" element={<CeoDashboard />} />
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

                {/* Add-Ons */}
                <Route path="/time-clock" element={<TimeClockPage />} />
                <Route path="/market-research" element={<MarketResearchPage />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
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
