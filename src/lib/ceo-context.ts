import { createContext, useContext, useState, useCallback, useEffect } from "react";
import React from "react";

// ---- Types ----

export interface Priority {
  id: string;
  text: string;
  status: "active" | "blocked" | "done";
}

export interface Decision {
  id: string;
  text: string;
  date: string;
  outcome?: string;
}

export interface MorningResetData {
  date: string;
  whatMatters: string;
  whatToIgnore: string;
  oneWin: string;
}

export interface CEOContextData {
  currentObjective: string;
  currentConstraints: string[];
  topPriorities: Priority[];
  recentDecisions: Decision[];
  morningReset: MorningResetData;
}

// ---- Defaults ----

const today = new Date().toISOString().split("T")[0];

const defaultContext: CEOContextData = {
  currentObjective: "",
  currentConstraints: [],
  topPriorities: [],
  recentDecisions: [],
  morningReset: { date: today, whatMatters: "", whatToIgnore: "", oneWin: "" },
};

// ---- localStorage persistence ----

const STORAGE_KEY = "ceo-strategy-context";

function loadContext(): CEOContextData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Strip removed fields from old storage
      const { strategicTensions, pipelineSnapshot, topRisks, topLeverage, decisionsNeeded, ...rest } = parsed;
      return { ...defaultContext, ...rest };
    }
  } catch {
    // ignore parse errors
  }
  return defaultContext;
}

function saveContext(data: CEOContextData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ---- React Context ----

interface CEOContextType {
  data: CEOContextData;
  update: (partial: Partial<CEOContextData>) => void;
  addPriority: (text: string) => void;
  updatePriority: (id: string, updates: Partial<Priority>) => void;
  removePriority: (id: string) => void;
  addDecision: (text: string) => void;
  updateDecision: (id: string, updates: Partial<Decision>) => void;
  removeDecision: (id: string) => void;
  updateMorningReset: (partial: Partial<MorningResetData>) => void;
}

const CEOCtx = createContext<CEOContextType | null>(null);

export function CEOContextProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<CEOContextData>(loadContext);

  useEffect(() => {
    saveContext(data);
  }, [data]);

  const update = useCallback((partial: Partial<CEOContextData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const addPriority = useCallback((text: string) => {
    setData((prev) => ({
      ...prev,
      topPriorities: [...prev.topPriorities, { id: crypto.randomUUID(), text, status: "active" as const }].slice(0, 5),
    }));
  }, []);

  const updatePriority = useCallback((id: string, updates: Partial<Priority>) => {
    setData((prev) => ({
      ...prev,
      topPriorities: prev.topPriorities.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  }, []);

  const removePriority = useCallback((id: string) => {
    setData((prev) => ({ ...prev, topPriorities: prev.topPriorities.filter((p) => p.id !== id) }));
  }, []);

  const addDecision = useCallback((text: string) => {
    setData((prev) => ({
      ...prev,
      recentDecisions: [{ id: crypto.randomUUID(), text, date: new Date().toISOString().split("T")[0] }, ...prev.recentDecisions].slice(0, 20),
    }));
  }, []);

  const updateDecision = useCallback((id: string, updates: Partial<Decision>) => {
    setData((prev) => ({
      ...prev,
      recentDecisions: prev.recentDecisions.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    }));
  }, []);

  const removeDecision = useCallback((id: string) => {
    setData((prev) => ({ ...prev, recentDecisions: prev.recentDecisions.filter((d) => d.id !== id) }));
  }, []);

  const updateMorningReset = useCallback((partial: Partial<MorningResetData>) => {
    setData((prev) => ({ ...prev, morningReset: { ...prev.morningReset, ...partial, date: today } }));
  }, []);

  return React.createElement(CEOCtx.Provider, {
    value: { data, update, addPriority, updatePriority, removePriority, addDecision, updateDecision, removeDecision, updateMorningReset },
  }, children);
}

export function useCEOContext() {
  const ctx = useContext(CEOCtx);
  if (!ctx) throw new Error("useCEOContext must be used within CEOContextProvider");
  return ctx;
}
