import { useState } from "react";
import { useStrategyFlow, STATUS_LABELS, StrategyItem } from "@/lib/strategy-flow";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Target, ShieldAlert, Gavel, CheckCircle2, Clock, Send, MessageSquare, Lightbulb } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { DirectiveThread } from "@/components/DirectiveThread";

const typeIcons: Record<string, React.ElementType> = {
  note: MessageSquare,
  idea: Lightbulb,
  objective: Target,
  constraint: ShieldAlert,
  decision: Gavel,
};

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  acknowledged: "bg-amber-100 text-amber-700",
  in_execution: "bg-emerald-100 text-emerald-700",
  resolved: "bg-muted text-muted-foreground",
};

function DirectiveRow({ item }: { item: StrategyItem }) {
  const { departments } = useDepartments();
  const [expanded, setExpanded] = useState(false);
  const Icon = typeIcons[item.type] || Target;

  const responses = item.responses || [];
  const respondedDepts = new Set(responses.map((r) => r.departmentId));
  const total = item.assignedDepartments.length;
  const responded = item.assignedDepartments.filter((d) => respondedDepts.has(d)).length;

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 py-3 px-1 text-left hover:bg-muted/30 transition-colors rounded"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-foreground flex-1 truncate">{item.title}</span>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {responded}/{total} responded
        </span>
        <Badge variant="secondary" className={`text-[10px] shrink-0 ${statusColors[item.status]}`}>
          {STATUS_LABELS[item.status] ?? item.status}
        </Badge>
      </button>
      {expanded && (
        <div className="pl-10 pr-2 pb-3 space-y-2">
          {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
          <div className="space-y-1.5">
            {item.assignedDepartments.map((deptId) => {
              const dept = departments.find((d) => d.id === deptId);
              const resp = responses.find((r) => r.departmentId === deptId);
              return (
                <div key={deptId} className="flex items-center gap-2 text-xs">
                  {resp ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                  ) : (
                    <Clock className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                  )}
                  <span className="font-medium text-foreground">{dept?.name || "Unknown dept"}</span>
                  {resp ? (
                    <span className="text-muted-foreground capitalize">— {resp.type}</span>
                  ) : (
                    <span className="text-muted-foreground/60">— awaiting response</span>
                  )}
                  {resp?.recommendation && (
                    <span className="text-muted-foreground/80 truncate flex-1">"{resp.recommendation}"</span>
                  )}
                </div>
              );
            })}
            {item.assignedDepartments.length === 0 && (
              <p className="text-xs text-muted-foreground/60 italic">No departments assigned.</p>
            )}
          </div>
          <div className="pt-3 border-t border-border/40">
            <DirectiveThread strategyItemId={item.id} />
          </div>
        </div>
      )}
    </div>
  );
}

export function DirectivesStatusBoard() {
  const { strategyItems, loading } = useStrategyFlow();
  const [open, setOpen] = useState(true);

  // Hide resolved/complete directives from the active board
  const active = strategyItems.filter((si) => si.status !== "resolved");

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">Directives</h2>
        <span className="text-xs text-muted-foreground ml-1">({active.length} open)</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <div className="rounded-xl border border-border bg-card p-5">
          {loading && active.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 text-center py-4">Loading directives…</p>
          ) : active.length === 0 ? (
            <EmptyState
              icon={Send}
              title="No open directives"
              description="When you send a directive from Big Picture, it shows up here with each department's response status."
              card={false}
              size="sm"
            />
          ) : (
            <div>
              {active.map((item) => <DirectiveRow key={item.id} item={item} />)}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
