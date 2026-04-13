import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type TrainingModuleType = "guide" | "playbook" | "checklist" | "video" | "link";
export type TrainingCategory = "Onboarding" | "Role Training" | "Processes" | "Tools";

export interface TrainingStep {
  id: string;
  title: string;
  content?: string;
  videoUrl?: string;
  externalUrl?: string;
}

export interface TrainingModule {
  id: string;
  title: string;
  description: string;
  type: TrainingModuleType;
  category: TrainingCategory;
  roleIds: string[];
  steps: TrainingStep[];
  icon?: string;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  link?: string;
  linkLabel?: string;
}

interface TrainingContextValue {
  modules: TrainingModule[];
  onboardingSteps: OnboardingStep[];
  loading: boolean;
  addModule: (module: Omit<TrainingModule, "id">) => void;
  updateModule: (id: string, updates: Partial<TrainingModule>) => void;
  deleteModule: (id: string) => void;
  addOnboardingStep: (step: Omit<OnboardingStep, "id">) => void;
  updateOnboardingStep: (id: string, updates: Partial<OnboardingStep>) => void;
  deleteOnboardingStep: (id: string) => void;
}

const TrainingContext = createContext<TrainingContextValue | null>(null);

export function TrainingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [onboardingSteps, setOnboardingSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetch = async () => {
      const [modRes, stepRes] = await Promise.all([
        supabase.from("training_modules").select("*").order("sort_order"),
        supabase.from("onboarding_steps").select("*").order("sort_order"),
      ]);

      if (modRes.data) {
        setModules(
          modRes.data.map((m) => ({
            id: m.id,
            title: m.title,
            description: m.description || "",
            type: m.type as TrainingModuleType,
            category: m.category as TrainingCategory,
            roleIds: (m.role_ids as string[]) || [],
            steps: (m.steps as any as TrainingStep[]) || [],
            icon: m.icon || undefined,
          }))
        );
      }

      if (stepRes.data) {
        setOnboardingSteps(
          stepRes.data.map((s) => ({
            id: s.id,
            title: s.title,
            description: s.description || "",
            link: s.link || undefined,
            linkLabel: s.link_label || undefined,
          }))
        );
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const addModule = useCallback(async (module: Omit<TrainingModule, "id">) => {
    const { data } = await supabase
      .from("training_modules")
      .insert({
        title: module.title,
        description: module.description,
        type: module.type,
        category: module.category,
        role_ids: module.roleIds,
        steps: module.steps as any,
        sort_order: modules.length,
      })
      .select()
      .single();

    if (data) {
      setModules((prev) => [...prev, {
        id: data.id,
        title: data.title,
        description: data.description || "",
        type: data.type as TrainingModuleType,
        category: data.category as TrainingCategory,
        roleIds: (data.role_ids as string[]) || [],
        steps: (data.steps as any as TrainingStep[]) || [],
        icon: data.icon || undefined,
      }]);
    }
  }, [modules.length]);

  const updateModule = useCallback(async (id: string, updates: Partial<TrainingModule>) => {
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.roleIds !== undefined) dbUpdates.role_ids = updates.roleIds;
    if (updates.steps !== undefined) dbUpdates.steps = updates.steps;
    await supabase.from("training_modules").update(dbUpdates).eq("id", id);
  }, []);

  const deleteModule = useCallback(async (id: string) => {
    setModules((prev) => prev.filter((m) => m.id !== id));
    await supabase.from("training_modules").delete().eq("id", id);
  }, []);

  const addOnboardingStep = useCallback(async (step: Omit<OnboardingStep, "id">) => {
    const { data } = await supabase
      .from("onboarding_steps")
      .insert({
        title: step.title,
        description: step.description,
        link: step.link || null,
        link_label: step.linkLabel || null,
        sort_order: onboardingSteps.length,
      })
      .select()
      .single();

    if (data) {
      setOnboardingSteps((prev) => [...prev, {
        id: data.id,
        title: data.title,
        description: data.description || "",
        link: data.link || undefined,
        linkLabel: data.link_label || undefined,
      }]);
    }
  }, [onboardingSteps.length]);

  const updateOnboardingStep = useCallback(async (id: string, updates: Partial<OnboardingStep>) => {
    setOnboardingSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.link !== undefined) dbUpdates.link = updates.link || null;
    if (updates.linkLabel !== undefined) dbUpdates.link_label = updates.linkLabel || null;
    await supabase.from("onboarding_steps").update(dbUpdates).eq("id", id);
  }, []);

  const deleteOnboardingStep = useCallback(async (id: string) => {
    setOnboardingSteps((prev) => prev.filter((s) => s.id !== id));
    await supabase.from("onboarding_steps").delete().eq("id", id);
  }, []);

  return (
    <TrainingContext.Provider
      value={{
        modules,
        onboardingSteps,
        loading,
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
