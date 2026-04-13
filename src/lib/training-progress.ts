import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

interface TrainingProgressState {
  completedSteps: Record<string, string[]>; // moduleId -> stepId[]
  onboardingDismissed: boolean;
  completedOnboardingSteps: string[];
}

interface TrainingProgressContextValue extends TrainingProgressState {
  markStepComplete: (moduleId: string, stepId: string) => void;
  markStepIncomplete: (moduleId: string, stepId: string) => void;
  isStepComplete: (moduleId: string, stepId: string) => boolean;
  getModuleProgress: (moduleId: string, totalSteps: number) => number;
  isModuleComplete: (moduleId: string, totalSteps: number) => boolean;
  markOnboardingStepComplete: (stepId: string) => void;
  isOnboardingStepComplete: (stepId: string) => boolean;
  dismissOnboarding: () => void;
  onboardingProgress: number;
}

const STORAGE_KEY = "teamspace-training-progress";

const defaultState: TrainingProgressState = {
  completedSteps: {},
  onboardingDismissed: false,
  completedOnboardingSteps: [],
};

function loadState(): TrainingProgressState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaultState, ...JSON.parse(stored) };
  } catch {}
  return defaultState;
}

function saveState(state: TrainingProgressState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

const TrainingProgressContext = createContext<TrainingProgressContextValue | null>(null);

export function TrainingProgressProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TrainingProgressState>(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const markStepComplete = useCallback((moduleId: string, stepId: string) => {
    setState((prev) => {
      const existing = prev.completedSteps[moduleId] || [];
      if (existing.includes(stepId)) return prev;
      return { ...prev, completedSteps: { ...prev.completedSteps, [moduleId]: [...existing, stepId] } };
    });
  }, []);

  const markStepIncomplete = useCallback((moduleId: string, stepId: string) => {
    setState((prev) => {
      const existing = prev.completedSteps[moduleId] || [];
      return { ...prev, completedSteps: { ...prev.completedSteps, [moduleId]: existing.filter((s) => s !== stepId) } };
    });
  }, []);

  const isStepComplete = useCallback((moduleId: string, stepId: string) => {
    return (state.completedSteps[moduleId] || []).includes(stepId);
  }, [state.completedSteps]);

  const getModuleProgress = useCallback((moduleId: string, totalSteps: number) => {
    if (totalSteps === 0) return 100;
    return Math.round(((state.completedSteps[moduleId] || []).length / totalSteps) * 100);
  }, [state.completedSteps]);

  const isModuleComplete = useCallback((moduleId: string, totalSteps: number) => {
    return (state.completedSteps[moduleId] || []).length >= totalSteps;
  }, [state.completedSteps]);

  const markOnboardingStepComplete = useCallback((stepId: string) => {
    setState((prev) => {
      if (prev.completedOnboardingSteps.includes(stepId)) return prev;
      return { ...prev, completedOnboardingSteps: [...prev.completedOnboardingSteps, stepId] };
    });
  }, []);

  const isOnboardingStepComplete = useCallback((stepId: string) => {
    return state.completedOnboardingSteps.includes(stepId);
  }, [state.completedOnboardingSteps]);

  const dismissOnboarding = useCallback(() => {
    setState((prev) => ({ ...prev, onboardingDismissed: true }));
  }, []);

  const onboardingProgress = Math.round((state.completedOnboardingSteps.length / 5) * 100);

  const value: TrainingProgressContextValue = {
    ...state,
    markStepComplete,
    markStepIncomplete,
    isStepComplete,
    getModuleProgress,
    isModuleComplete,
    markOnboardingStepComplete,
    isOnboardingStepComplete,
    dismissOnboarding,
    onboardingProgress,
  };

  return React.createElement(TrainingProgressContext.Provider, { value }, children);
}

export function useTrainingProgress() {
  const ctx = useContext(TrainingProgressContext);
  if (!ctx) throw new Error("useTrainingProgress must be used within TrainingProgressProvider");
  return ctx;
}
