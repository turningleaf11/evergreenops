import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { Target, Flag, AlertTriangle, Link2Off } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { usePlanEntities } from "@/components/business-plans/PlanEntityContext";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * A live business-plan record embedded inline in the plan doc.
 *
 * The node stores only { kind, recordId } — the title, status and dates are
 * always read from the database through PlanEntityContext, so the doc can
 * never hold a stale copy of a record that's been edited elsewhere.
 */

export type PlanEntityKind = "milestone" | "risk" | "goal";

const SEVERITIES = [
  { value: "high", label: "High" },
  { value: "med", label: "Medium" },
  { value: "low", label: "Low" },
];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    planEntity: {
      insertPlanEntity: (attrs: { kind: PlanEntityKind; recordId: string }) => ReturnType;
    };
  }
}

function PlanEntityView({ node, editor, deleteNode }: any) {
  const kind = node.attrs.kind as PlanEntityKind;
  const recordId = node.attrs.recordId as string;
  const ctx = usePlanEntities();
  const editable = editor?.isEditable;

  const milestone = kind === "milestone" ? ctx?.milestones.find((m) => m.id === recordId) : undefined;
  const risk = kind === "risk" ? ctx?.risks.find((r) => r.id === recordId) : undefined;
  const goal = kind === "goal" ? ctx?.goals.find((g) => g.id === recordId) : undefined;
  const record = milestone || risk || goal;

  // The row was deleted from another surface — say so rather than vanishing,
  // so the sentence around it doesn't silently lose its referent.
  if (ctx && !record) {
    return (
      <NodeViewWrapper as="div" className="plan-entity plan-entity--orphan" data-kind={kind}>
        <Link2Off className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span className="flex-1 text-muted-foreground italic">This {kind} was deleted</span>
        {editable && (
          <button type="button" onClick={() => deleteNode()} className="plan-entity__x" title="Remove from doc">
            Remove
          </button>
        )}
      </NodeViewWrapper>
    );
  }

  // Rendered outside a plan doc (or before context loads) — stay inert.
  if (!ctx || !record) {
    return (
      <NodeViewWrapper as="div" className="plan-entity" data-kind={kind}>
        <span className="flex-1 text-muted-foreground">Loading…</span>
      </NodeViewWrapper>
    );
  }

  const toggleMilestone = async () => {
    if (!milestone) return;
    await supabase.from("business_plan_milestones").update({ done: !milestone.done }).eq("id", milestone.id);
    await ctx.refresh();
  };

  const setSeverity = async (severity: string) => {
    if (!risk) return;
    await supabase.from("business_plan_risks").update({ severity }).eq("id", risk.id);
    await ctx.refresh();
  };

  return (
    <NodeViewWrapper as="div" className="plan-entity" data-kind={kind}>
      {kind === "milestone" && milestone && (
        <>
          <input
            type="checkbox"
            checked={milestone.done}
            onChange={toggleMilestone}
            disabled={!editable}
            className="h-3.5 w-3.5 accent-primary shrink-0"
            title="Mark reached"
          />
          <span className={cn("flex-1 min-w-0", milestone.done && "line-through text-muted-foreground")}>
            {milestone.title}
          </span>
          {milestone.goal_id && (
            <span className="plan-entity__meta" title="Checkpoint toward a goal">
              → {ctx.goals.find((g) => g.id === milestone.goal_id)?.title ?? "goal"}
            </span>
          )}
          {milestone.due_date && (
            <span className="plan-entity__meta tabular-nums">{format(new Date(milestone.due_date), "MMM d")}</span>
          )}
        </>
      )}

      {kind === "risk" && risk && (
        <>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive/80" />
          <span className="flex-1 min-w-0">{risk.text}</span>
          {editable ? (
            <Select value={risk.severity || "med"} onValueChange={setSeverity}>
              <SelectTrigger className="h-6 w-[84px] text-[11px] shrink-0">
                {SEVERITIES.find((s) => s.value === (risk.severity || "med"))?.label ?? "Medium"}
              </SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <span className="plan-entity__meta">{SEVERITIES.find((s) => s.value === risk.severity)?.label}</span>
          )}
        </>
      )}

      {kind === "goal" && goal && (
        <>
          <Target className="h-3.5 w-3.5 shrink-0 text-blue-500" />
          <span className="flex-1 min-w-0">{goal.title}</span>
          <span className="plan-entity__meta">{goal.quarter} {goal.year}</span>
        </>
      )}

      {editable && (
        <button type="button" onClick={() => deleteNode()} className="plan-entity__x" title="Remove from doc (keeps the record)">
          ×
        </button>
      )}
    </NodeViewWrapper>
  );
}

const PlanEntity = Node.create({
  name: "planEntity",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      kind: {
        default: "milestone",
        parseHTML: (el) => el.getAttribute("data-plan-entity-kind") || "milestone",
        renderHTML: (attrs) => ({ "data-plan-entity-kind": attrs.kind }),
      },
      recordId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-plan-entity-id"),
        renderHTML: (attrs) => ({ "data-plan-entity-id": attrs.recordId }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-plan-entity-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "plan-entity" })];
  },

  addCommands() {
    return {
      insertPlanEntity:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(PlanEntityView);
  },
});

export default PlanEntity;
