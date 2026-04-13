import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  trainingModules as defaultModules,
  onboardingSteps as defaultOnboarding,
  TrainingModule,
  OnboardingStep,
  TrainingModuleType,
  TrainingCategory,
} from "@/lib/training-data";

interface TrainingContextValue {
  modules: TrainingModule[];
  onboardingSteps: OnboardingStep[];
  addModule: (module: Omit<TrainingModule, "id">) => void;
  updateModule: (id: string, updates: Partial<TrainingModule>) => void;
  deleteModule: (id: string) => void;
  addOnboardingStep: (step: Omit<OnboardingStep, "id">) => void;
  updateOnboardingStep: (id: string, updates: Partial<OnboardingStep>) => void;
  deleteOnboardingStep: (id: string) => void;
}

const STORAGE_KEY = "teamspace-training-data";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function loadData(): { modules: TrainingModule[]; onboardingSteps: OnboardingStep[] } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        modules: parsed.modules || defaultModules,
        onboardingSteps: parsed.onboardingSteps || defaultOnboarding,
      };
    }
  } catch {}
  return { modules: defaultModules, onboardingSteps: defaultOnboarding };
}

const TrainingContext = createContext<TrainingContextValue | null>(null);

export function TrainingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState(loadData);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }, [data]);

  const addModule = useCallback((module: Omit<TrainingModule, "id">) => {
    setData((prev) => ({
      ...prev,
      modules: [...prev.modules, { ...module, id: generateId() }],
    }));
  }, []);

  const updateModule = useCallback((id: string, updates: Partial<TrainingModule>) => {
    setData((prev) => ({
      ...prev,
      modules: prev.modules.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    }));
  }, []);

  const deleteModule = useCallback((id: string) => {
    setData((prev) => ({ ...prev, modules: prev.modules.filter((m) => m.id !== id) }));
  }, []);

  const addOnboardingStep = useCallback((step: Omit<OnboardingStep, "id">) => {
    setData((prev) => ({
      ...prev,
      onboardingSteps: [...prev.onboardingSteps, { ...step, id: generateId() }],
    }));
  }, []);

  const updateOnboardingStep = useCallback((id: string, updates: Partial<OnboardingStep>) => {
    setData((prev) => ({
      ...prev,
      onboardingSteps: prev.onboardingSteps.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  }, []);

  const deleteOnboardingStep = useCallback((id: string) => {
    setData((prev) => ({ ...prev, onboardingSteps: prev.onboardingSteps.filter((s) => s.id !== id) }));
  }, []);

  return (
    <TrainingContext.Provider
      value={{
        modules: data.modules,
        onboardingSteps: data.onboardingSteps,
        addModule,
        updateModule,
        deleteModule,
        addOnboardingStep,
        updateOnboardingStep,
        deleteOnboardingStep,
      }}
    >
      {children}
    </TrainingContext.Provider>
  );
}

export function useTraining() {
  const ctx = useContext(TrainingContext);
  if (!ctx) throw new Error("useTraining must be used within TrainingProvider");
  return ctx;
}

export type { TrainingModule, OnboardingStep, TrainingModuleType, TrainingCategory };
