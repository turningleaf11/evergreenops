import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { DepartmentsProvider } from "@/contexts/DepartmentsContext";
import { CEOContextProvider } from "@/lib/ceo-context";
import { StrategyFlowProvider } from "@/lib/strategy-flow";
import { TrainingProgressProvider } from "@/lib/training-progress";
import { Layout } from "@/components/Layout";
import Index from "./pages/Index";
import CeoDashboard from "./pages/CeoDashboard";
import LeadershipDashboard from "./pages/LeadershipDashboard";
import DepartmentPage from "./pages/DepartmentPage";
import DocsPage from "./pages/DocsPage";
import DatabasesPage from "./pages/DatabasesPage";
import PeoplePage from "./pages/PeoplePage";
import SettingsPage from "./pages/SettingsPage";
import TrainingPage from "./pages/TrainingPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <WorkspaceProvider>
      <DepartmentsProvider>
      <CEOContextProvider>
      <StrategyFlowProvider>
      <TrainingProgressProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
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
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </TrainingProgressProvider>
      </StrategyFlowProvider>
      </CEOContextProvider>
      </DepartmentsProvider>
      </WorkspaceProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
