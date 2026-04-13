import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

// ---- Types ----

export type StrategyItemType = "objective" | "constraint" | "decision";
export type StrategyItemStatus = "new" | "acknowledged" | "translated" | "in_execution" | "resolved";
export type LeadershipResponseType = "accept" | "refine" | "challenge";
export type UpwardProposalType = "strategy_change" | "escalate_constraint" | "request_decision" | "flag_misalignment";
export type ProposalStatus = "pending" | "accepted" | "rejected" | "clarification_needed";

export interface StrategyItem {
  id: string;
  type: StrategyItemType;
  title: string;
  description: string;
  createdBy: string;
  assignedDepartments: string[];
  status: StrategyItemStatus;
  createdAt: string;
  updatedAt: string;
  responses: LeadershipResponse[];
}

export interface LeadershipResponse {
  id: string;
  strategyItemId: string;
  departmentId: string;
  responderId: string;
  type: LeadershipResponseType;
  groundTruth: string;
  analysis: string;
  recommendation: string;
  expectedImpact: string;
  createdAt: string;
}

export interface TranslationBlock {
  id: string;
  strategyItemId: string;
  departmentId: string;
  meaning: string;
  immediateChanges: string;
  priorities: string[];
  actions: string[];
  createdAt: string;
}

export interface UpwardProposal {
  id: string;
  type: UpwardProposalType;
  departmentId: string;
  createdBy: string;
  title: string;
  reasoning: string;
  recommendation: string;
  status: ProposalStatus;
  ceoResponse?: string;
  createdAt: string;
}

interface StrategyFlowState {
  strategyItems: StrategyItem[];
  translations: TranslationBlock[];
  proposals: UpwardProposal[];
}

interface StrategyFlowContextType extends StrategyFlowState {
  addStrategyItem: (item: Omit<StrategyItem, "id" | "createdAt" | "updatedAt" | "responses">) => void;
  updateStrategyItem: (id: string, updates: Partial<StrategyItem>) => void;
  deleteStrategyItem: (id: string) => void;
  addResponse: (response: Omit<LeadershipResponse, "id" | "createdAt">) => void;
  addTranslation: (translation: Omit<TranslationBlock, "id" | "createdAt">) => void;
  updateTranslation: (id: string, updates: Partial<TranslationBlock>) => void;
  addProposal: (proposal: Omit<UpwardProposal, "id" | "createdAt">) => void;
  updateProposal: (id: string, updates: Partial<UpwardProposal>) => void;
  getItemsForDepartment: (deptId: string) => StrategyItem[];
  getTranslationsForItem: (itemId: string, deptId: string) => TranslationBlock | undefined;
  getProposalsForReview: () => UpwardProposal[];
}

const StrategyFlowContext = createContext<StrategyFlowContextType | null>(null);

const STORAGE_KEY = "strategy-flow-data";

function generateId() {
  return `sf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const defaultState: StrategyFlowState = {
  strategyItems: [
    {
      id: "si1",
      type: "objective",
      title: "Close 3 wholesale deals by end of Q2",
      description: "Focus the wholesale acquisitions team on high-probability deals in the pipeline. Deprioritize speculative leads and concentrate on properties with motivated sellers and clear title.",
      createdBy: "m1",
      assignedDepartments: ["eng", "product"],
      status: "new",
      createdAt: "2026-04-10T09:00:00Z",
      updatedAt: "2026-04-10T09:00:00Z",
      responses: [],
    },
    {
      id: "si2",
      type: "constraint",
      title: "No new hires until revenue target is met",
      description: "We need to hit $500K monthly revenue before expanding headcount. All teams must optimize with current resources.",
      createdBy: "m1",
      assignedDepartments: ["eng", "design", "product", "marketing"],
      status: "new",
      createdAt: "2026-04-11T10:00:00Z",
      updatedAt: "2026-04-11T10:00:00Z",
      responses: [],
    },
    {
      id: "si3",
      type: "decision",
      title: "Pause portfolio acquisitions above $2M until Q3",
      description: "Capital allocation decision: focus available capital on wholesale deals with faster ROI. Resume larger portfolio acquisitions when wholesale revenue stabilizes.",
      createdBy: "m1",
      assignedDepartments: ["product"],
      status: "acknowledged",
      createdAt: "2026-04-09T14:00:00Z",
      updatedAt: "2026-04-12T08:00:00Z",
      responses: [
        {
          id: "lr1",
          strategyItemId: "si3",
          departmentId: "product",
          responderId: "m4",
          type: "refine",
          groundTruth: "We have two portfolio deals in late-stage negotiation that could close within 30 days.",
          analysis: "Pausing all portfolio deals above $2M would mean walking away from $180K in potential Q2 revenue from deals already near closing.",
          recommendation: "Grandfather the two in-progress deals but pause new portfolio deal sourcing above $2M.",
          expectedImpact: "Preserves $180K revenue opportunity while still redirecting future capital to wholesale.",
          createdAt: "2026-04-12T08:00:00Z",
        },
      ],
    },
  ],
  translations: [],
  proposals: [
    {
      id: "up1",
      type: "flag_misalignment",
      departmentId: "eng",
      createdBy: "m2",
      title: "Engineering capacity is overcommitted",
      reasoning: "Current sprint has 40% more story points than team capacity. Three strategy items require engineering support simultaneously.",
      recommendation: "Prioritize the wholesale CRM integration and defer the analytics dashboard rebuild to Q3.",
      status: "pending",
      createdAt: "2026-04-12T11:00:00Z",
    },
  ],
};

function loadState(): StrategyFlowState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return defaultState;
}

export function StrategyFlowProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StrategyFlowState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addStrategyItem = useCallback((item: Omit<StrategyItem, "id" | "createdAt" | "updatedAt" | "responses">) => {
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      strategyItems: [...prev.strategyItems, { ...item, id: generateId(), createdAt: now, updatedAt: now, responses: [] }],
    }));
  }, []);

  const updateStrategyItem = useCallback((id: string, updates: Partial<StrategyItem>) => {
    setState((prev) => ({
      ...prev,
      strategyItems: prev.strategyItems.map((si) =>
        si.id === id ? { ...si, ...updates, updatedAt: new Date().toISOString() } : si
      ),
    }));
  }, []);

  const deleteStrategyItem = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      strategyItems: prev.strategyItems.filter((si) => si.id !== id),
    }));
  }, []);

  const addResponse = useCallback((response: Omit<LeadershipResponse, "id" | "createdAt">) => {
    const newResponse: LeadershipResponse = { ...response, id: generateId(), createdAt: new Date().toISOString() };
    setState((prev) => ({
      ...prev,
      strategyItems: prev.strategyItems.map((si) =>
        si.id === response.strategyItemId
          ? { ...si, responses: [...si.responses, newResponse], status: si.status === "new" ? "acknowledged" : si.status, updatedAt: new Date().toISOString() }
          : si
      ),
    }));
  }, []);

  const addTranslation = useCallback((translation: Omit<TranslationBlock, "id" | "createdAt">) => {
    const newTranslation: TranslationBlock = { ...translation, id: generateId(), createdAt: new Date().toISOString() };
    setState((prev) => {
      const updatedItems = prev.strategyItems.map((si) =>
        si.id === translation.strategyItemId && (si.status === "acknowledged" || si.status === "new")
          ? { ...si, status: "translated" as StrategyItemStatus, updatedAt: new Date().toISOString() }
          : si
      );
      return { ...prev, translations: [...prev.translations, newTranslation], strategyItems: updatedItems };
    });
  }, []);

  const updateTranslation = useCallback((id: string, updates: Partial<TranslationBlock>) => {
    setState((prev) => ({
      ...prev,
      translations: prev.translations.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  }, []);

  const addProposal = useCallback((proposal: Omit<UpwardProposal, "id" | "createdAt">) => {
    setState((prev) => ({
      ...prev,
      proposals: [...prev.proposals, { ...proposal, id: generateId(), createdAt: new Date().toISOString() }],
    }));
  }, []);

  const updateProposal = useCallback((id: string, updates: Partial<UpwardProposal>) => {
    setState((prev) => ({
      ...prev,
      proposals: prev.proposals.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  }, []);

  const getItemsForDepartment = useCallback(
    (deptId: string) => state.strategyItems.filter((si) => si.assignedDepartments.includes(deptId)),
    [state.strategyItems]
  );

  const getTranslationsForItem = useCallback(
    (itemId: string, deptId: string) => state.translations.find((t) => t.strategyItemId === itemId && t.departmentId === deptId),
    [state.translations]
  );

  const getProposalsForReview = useCallback(
    () => state.proposals.filter((p) => p.status === "pending"),
    [state.proposals]
  );

  return React.createElement(
    StrategyFlowContext.Provider,
    {
      value: {
        ...state,
        addStrategyItem,
        updateStrategyItem,
        deleteStrategyItem,
        addResponse,
        addTranslation,
        updateTranslation,
        addProposal,
        updateProposal,
        getItemsForDepartment,
        getTranslationsForItem,
        getProposalsForReview,
      },
    },
    children
  );
}

export function useStrategyFlow() {
  const ctx = useContext(StrategyFlowContext);
  if (!ctx) throw new Error("useStrategyFlow must be used within StrategyFlowProvider");
  return ctx;
}
