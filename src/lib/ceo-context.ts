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

export interface StrategicTension {
  id: string;
  tension: string;
  sideA: string;
  sideB: string;
}

export interface PipelineSnapshot {
  wholesaleDeals: number;
  portfolioDeals: number;
  closingThisMonth: number;
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
  strategicTensions: StrategicTension[];
  pipelineSnapshot: PipelineSnapshot;
  morningReset: MorningResetData;
  topRisks: string[];
  topLeverage: string[];
  decisionsNeeded: string[];
}

// ---- Defaults ----

const today = new Date().toISOString().split("T")[0];

const defaultContext: CEOContextData = {
  currentObjective: "Close 5 wholesale deals per month and acquire one 10+ unit portfolio property by end of Q2",
  currentConstraints: [
    "Hard money lender exposure capped at $2M across all active deals",
    "No new hires until monthly assignment fee revenue exceeds $50K",
    "Must maintain 90-day cash reserve for operating expenses",
  ],
  topPriorities: [
    { id: "p1", text: "Push 3 wholesale deals from 'Under Contract' to closed this month", status: "active" },
    { id: "p2", text: "Complete due diligence on Maple Ridge 24-unit portfolio", status: "active" },
    { id: "p3", text: "Expand buyer list — add 25 new verified cash buyers", status: "active" },
  ],
  recentDecisions: [
    { id: "d1", text: "Pause portfolio acquisitions above $2M until Q3 — redirect capital to wholesale", date: "2026-04-09", outcome: "Preserves capital for faster-turning wholesale deals" },
    { id: "d2", text: "Switch primary lead source from direct mail to driving for dollars + cold calling", date: "2026-04-07", outcome: "Lower cost per lead, higher contact rate" },
    { id: "d3", text: "Hire part-time virtual assistant for skip tracing and lead scrubbing", date: "2026-04-05" },
  ],
  strategicTensions: [
    { id: "t1", tension: "Volume vs. Quality", sideA: "More leads in the pipeline = more deals", sideB: "Too many low-quality leads burns team capacity" },
    { id: "t2", tension: "Wholesale speed vs. Portfolio wealth", sideA: "Wholesale generates quick cash flow", sideB: "Portfolio builds long-term equity and passive income" },
  ],
  pipelineSnapshot: { wholesaleDeals: 14, portfolioDeals: 2, closingThisMonth: 3 },
  morningReset: { date: today, whatMatters: "", whatToIgnore: "", oneWin: "" },
  topRisks: [
    "Title issues on 567 Cascade Rd could delay closing past contract deadline",
    "Hard money lender may reduce draw schedule if market softens",
    "Key acquisitions rep interviewing elsewhere — retention risk",
  ],
  topLeverage: [
    "Maple Ridge portfolio could generate $12K/mo NOI once stabilized",
    "New JV partner expressed interest in co-funding 3 deals this quarter",
    "Buyer list doubled in March — dispo velocity should increase",
  ],
  decisionsNeeded: [
    "Approve or reject the Peachtree Industrial Blvd deal at $220K ask — need JV partner commitment",
    "Decide on marketing budget increase for Q2 buyer acquisition campaigns",
    "Set max assignment fee discount policy for repeat buyers",
  ],
};

// ---- localStorage persistence ----

const STORAGE_KEY = "ceo-strategy-context";

function loadContext(): CEOContextData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultContext, ...parsed };
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
  addTension: (tension: string, sideA: string, sideB: string) => void;
  removeTension: (id: string) => void;
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

  const addTension = useCallback((tension: string, sideA: string, sideB: string) => {
    setData((prev) => ({
      ...prev,
      strategicTensions: [...prev.strategicTensions, { id: crypto.randomUUID(), tension, sideA, sideB }],
    }));
  }, []);

  const removeTension = useCallback((id: string) => {
    setData((prev) => ({ ...prev, strategicTensions: prev.strategicTensions.filter((t) => t.id !== id) }));
  }, []);

  const updateMorningReset = useCallback((partial: Partial<MorningResetData>) => {
    setData((prev) => ({ ...prev, morningReset: { ...prev.morningReset, ...partial, date: today } }));
  }, []);

  return React.createElement(CEOCtx.Provider, {
    value: { data, update, addPriority, updatePriority, removePriority, addDecision, updateDecision, removeDecision, addTension, removeTension, updateMorningReset },
  }, children);
}

export function useCEOContext() {
  const ctx = useContext(CEOCtx);
  if (!ctx) throw new Error("useCEOContext must be used within CEOContextProvider");
  return ctx;
}
