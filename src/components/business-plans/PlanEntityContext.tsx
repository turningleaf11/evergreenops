import { createContext, useContext } from "react";

/**
 * Live plan records, shared with the inline blocks rendered inside the plan
 * doc's TipTap editor.
 *
 * The doc stores only a record id per block — never a copy of the title or
 * status. Everything displayed is read from here, so a milestone edited on
 * the Roadmap and the same milestone embedded mid-sentence in the doc are
 * the same row, and neither can drift from the other.
 *
 * TipTap's ReactNodeViewRenderer portals node views into the React tree at
 * the position of <EditorContent>, so context set above the editor reaches
 * the blocks.
 */

export type PlanMilestone = {
  id: string; goal_id: string | null; title: string; done: boolean; due_date: string | null;
};
export type PlanRisk = { id: string; text: string; severity: string };
export type PlanGoal = { id: string; title: string; status: string; quarter: string; year: number };

export type PlanEntityValue = {
  planId: string;
  milestones: PlanMilestone[];
  risks: PlanRisk[];
  goals: PlanGoal[];
  /** Refetch the plan after a block mutates a record. */
  refresh: () => Promise<void>;
};

const PlanEntityContext = createContext<PlanEntityValue | null>(null);

export const PlanEntityProvider = PlanEntityContext.Provider;

/** Null outside a plan doc — the node renders inert rather than throwing. */
export function usePlanEntities(): PlanEntityValue | null {
  return useContext(PlanEntityContext);
}
