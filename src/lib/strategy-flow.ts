import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ---- Types ----

export type StrategyItemType = "objective" | "constraint" | "decision";
export type StrategyItemStatus = "new" | "acknowledged" | "in_execution" | "resolved";
export type LeadershipResponseType = "accept" | "refine" | "challenge";
export type UpwardProposalType = "strategy_change" | "escalate_constraint" | "request_decision" | "flag_misalignment";
export type ProposalStatus = "pending" | "accepted" | "rejected" | "clarification_needed";

export const STATUS_LABELS: Record<StrategyItemStatus, string> = {
  new: "Sent",
  acknowledged: "Acknowledged",
  in_execution: "In Execution",
  resolved: "Complete",
};

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

// ---- DB row types ----

type DbItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  created_by: string | null;
  assigned_departments: string[];
  status: string;
  created_at: string;
  updated_at: string;
};

type DbResponse = {
  id: string;
  strategy_item_id: string;
  department_id: string | null;
  responder_id: string | null;
  type: string;
  ground_truth: string;
  analysis: string;
  recommendation: string;
  expected_impact: string;
  created_at: string;
};

type DbTranslation = {
  id: string;
  strategy_item_id: string;
  department_id: string;
  meaning: string;
  immediate_changes: string;
  priorities: string[];
  actions: string[];
  created_at: string;
};

type DbProposal = {
  id: string;
  type: string;
  department_id: string;
  created_by: string | null;
  title: string;
  reasoning: string;
  recommendation: string;
  status: string;
  ceo_response: string;
  created_at: string;
};

// ---- Converters ----

function dbItemToApp(row: DbItem, responses: LeadershipResponse[]): StrategyItem {
  return {
    id: row.id,
    type: row.type as StrategyItemType,
    title: row.title,
    description: row.description || "",
    createdBy: row.created_by || "",
    assignedDepartments: row.assigned_departments || [],
    status: row.status as StrategyItemStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    responses,
  };
}

function dbResponseToApp(row: DbResponse): LeadershipResponse {
  return {
    id: row.id,
    strategyItemId: row.strategy_item_id,
    departmentId: row.department_id || "",
    responderId: row.responder_id || "",
    type: row.type as LeadershipResponseType,
    groundTruth: row.ground_truth || "",
    analysis: row.analysis || "",
    recommendation: row.recommendation || "",
    expectedImpact: row.expected_impact || "",
    createdAt: row.created_at,
  };
}

function dbTranslationToApp(row: DbTranslation): TranslationBlock {
  return {
    id: row.id,
    strategyItemId: row.strategy_item_id,
    departmentId: row.department_id,
    meaning: row.meaning || "",
    immediateChanges: row.immediate_changes || "",
    priorities: row.priorities || [],
    actions: row.actions || [],
    createdAt: row.created_at,
  };
}

function dbProposalToApp(row: DbProposal): UpwardProposal {
  return {
    id: row.id,
    type: row.type as UpwardProposalType,
    departmentId: row.department_id,
    createdBy: row.created_by || "",
    title: row.title,
    reasoning: row.reasoning || "",
    recommendation: row.recommendation || "",
    status: row.status as ProposalStatus,
    ceoResponse: row.ceo_response || "",
    createdAt: row.created_at,
  };
}

// ---- Context ----

interface StrategyFlowContextType {
  strategyItems: StrategyItem[];
  translations: TranslationBlock[];
  proposals: UpwardProposal[];
  loading: boolean;
  addStrategyItem: (item: Omit<StrategyItem, "id" | "createdAt" | "updatedAt" | "responses">) => Promise<void>;
  updateStrategyItem: (id: string, updates: Partial<StrategyItem>) => Promise<void>;
  deleteStrategyItem: (id: string) => Promise<void>;
  addResponse: (response: Omit<LeadershipResponse, "id" | "createdAt">) => Promise<void>;
  addTranslation: (translation: Omit<TranslationBlock, "id" | "createdAt">) => Promise<void>;
  updateTranslation: (id: string, updates: Partial<TranslationBlock>) => Promise<void>;
  addProposal: (proposal: Omit<UpwardProposal, "id" | "createdAt">) => Promise<void>;
  updateProposal: (id: string, updates: Partial<UpwardProposal>) => Promise<void>;
  getItemsForDepartment: (deptId: string) => StrategyItem[];
  getTranslationsForItem: (itemId: string, deptId: string) => TranslationBlock | undefined;
  getProposalsForReview: () => UpwardProposal[];
}

const StrategyFlowContext = createContext<StrategyFlowContextType | null>(null);

const sb = supabase as any;

export function StrategyFlowProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [strategyItems, setStrategyItems] = useState<StrategyItem[]>([]);
  const [translations, setTranslations] = useState<TranslationBlock[]>([]);
  const [proposals, setProposals] = useState<UpwardProposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [
        { data: items },
        { data: responses },
        { data: trans },
        { data: props },
      ] = await Promise.all([
        sb.from("strategy_items").select("*").order("created_at", { ascending: false }),
        sb.from("strategy_responses").select("*").order("created_at", { ascending: true }),
        sb.from("strategy_translations").select("*").order("created_at", { ascending: true }),
        sb.from("upward_proposals").select("*").order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;

      const appResponses: LeadershipResponse[] = (responses ?? []).map(dbResponseToApp);
      const appItems: StrategyItem[] = (items ?? []).map((row: DbItem) =>
        dbItemToApp(row, appResponses.filter((r) => r.strategyItemId === row.id))
      );
      setStrategyItems(appItems);
      setTranslations((trans ?? []).map(dbTranslationToApp));
      setProposals((props ?? []).map(dbProposalToApp));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const addStrategyItem = useCallback(async (item: Omit<StrategyItem, "id" | "createdAt" | "updatedAt" | "responses">) => {
    const { data, error } = await sb.from("strategy_items").insert({
      type: item.type,
      title: item.title,
      description: item.description,
      created_by: item.createdBy || null,
      assigned_departments: item.assignedDepartments,
      status: item.status,
    }).select().single();
    if (!error && data) {
      setStrategyItems((prev) => [dbItemToApp(data as DbItem, []), ...prev]);
    }
  }, []);

  const updateStrategyItem = useCallback(async (id: string, updates: Partial<StrategyItem>) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.assignedDepartments !== undefined) dbUpdates.assigned_departments = updates.assignedDepartments;
    await sb.from("strategy_items").update(dbUpdates).eq("id", id);
    setStrategyItems((prev) =>
      prev.map((si) => si.id === id ? { ...si, ...updates, updatedAt: new Date().toISOString() } : si)
    );
  }, []);

  const deleteStrategyItem = useCallback(async (id: string) => {
    await sb.from("strategy_items").delete().eq("id", id);
    setStrategyItems((prev) => prev.filter((si) => si.id !== id));
  }, []);

  const addResponse = useCallback(async (response: Omit<LeadershipResponse, "id" | "createdAt">) => {
    const { data, error } = await sb.from("strategy_responses").insert({
      strategy_item_id: response.strategyItemId,
      department_id: response.departmentId,
      responder_id: response.responderId || null,
      type: response.type,
      ground_truth: response.groundTruth,
      analysis: response.analysis,
      recommendation: response.recommendation,
      expected_impact: response.expectedImpact,
    }).select().single();
    if (!error && data) {
      const newResponse = dbResponseToApp(data as DbResponse);
      setStrategyItems((prev) =>
        prev.map((si) => {
          if (si.id !== response.strategyItemId) return si;
          const newStatus = si.status === "new" ? ("acknowledged" as StrategyItemStatus) : si.status;
          if (newStatus !== si.status) {
            sb.from("strategy_items").update({ status: newStatus }).eq("id", si.id);
          }
          return { ...si, responses: [...si.responses, newResponse], status: newStatus, updatedAt: new Date().toISOString() };
        })
      );
    }
  }, []);

  const addTranslation = useCallback(async (translation: Omit<TranslationBlock, "id" | "createdAt">) => {
    const { data, error } = await sb.from("strategy_translations").insert({
      strategy_item_id: translation.strategyItemId,
      department_id: translation.departmentId,
      meaning: translation.meaning,
      immediate_changes: translation.immediateChanges,
      priorities: translation.priorities,
      actions: translation.actions,
    }).select().single();
    if (!error && data) {
      setTranslations((prev) => [...prev, dbTranslationToApp(data as DbTranslation)]);
    }
  }, []);

  const updateTranslation = useCallback(async (id: string, updates: Partial<TranslationBlock>) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.meaning !== undefined) dbUpdates.meaning = updates.meaning;
    if (updates.immediateChanges !== undefined) dbUpdates.immediate_changes = updates.immediateChanges;
    if (updates.priorities !== undefined) dbUpdates.priorities = updates.priorities;
    if (updates.actions !== undefined) dbUpdates.actions = updates.actions;
    await sb.from("strategy_translations").update(dbUpdates).eq("id", id);
    setTranslations((prev) => prev.map((t) => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const addProposal = useCallback(async (proposal: Omit<UpwardProposal, "id" | "createdAt">) => {
    const { data, error } = await sb.from("upward_proposals").insert({
      type: proposal.type,
      department_id: proposal.departmentId,
      created_by: proposal.createdBy || null,
      title: proposal.title,
      reasoning: proposal.reasoning,
      recommendation: proposal.recommendation,
      status: proposal.status,
      ceo_response: proposal.ceoResponse || "",
    }).select().single();
    if (!error && data) {
      setProposals((prev) => [dbProposalToApp(data as DbProposal), ...prev]);
    }
  }, []);

  const updateProposal = useCallback(async (id: string, updates: Partial<UpwardProposal>) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.ceoResponse !== undefined) dbUpdates.ceo_response = updates.ceoResponse;
    if (updates.reasoning !== undefined) dbUpdates.reasoning = updates.reasoning;
    if (updates.recommendation !== undefined) dbUpdates.recommendation = updates.recommendation;
    await sb.from("upward_proposals").update(dbUpdates).eq("id", id);
    setProposals((prev) => prev.map((p) => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const getItemsForDepartment = useCallback(
    (deptId: string) => strategyItems.filter((si) => si.assignedDepartments.includes(deptId)),
    [strategyItems]
  );

  const getTranslationsForItem = useCallback(
    (itemId: string, deptId: string) => translations.find((t) => t.strategyItemId === itemId && t.departmentId === deptId),
    [translations]
  );

  const getProposalsForReview = useCallback(
    () => proposals.filter((p) => p.status === "pending"),
    [proposals]
  );

  return React.createElement(
    StrategyFlowContext.Provider,
    {
      value: {
        strategyItems,
        translations,
        proposals,
        loading,
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
