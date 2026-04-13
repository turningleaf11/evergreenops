import { useState, useEffect } from "react";
import { useStrategyFlow } from "@/lib/strategy-flow";
import { supabase } from "@/integrations/supabase/client";
import { CheckSquare, AlertTriangle, FolderKanban } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  departmentId: string;
}

export function ExecutionSnapshot({ departmentId }: Props) {
  const { getItemsForDepartment, translations } = useStrategyFlow();
  const items = getItemsForDepartment(departmentId);
  const inExecution = items.filter((i) => i.status === "in_execution" || i.status === "translated");
  const deptTranslations = translations.filter((t) => t.departmentId === departmentId);

  const [dbRows, setDbRows] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("database_rows").select("id, database_id, values");
      if (data) setDbRows(data);
    };
    fetch();
  }, []);

  const activeProjects = dbRows.filter((r) => r.values?.status === "In Progress");
  const activeTasks = dbRows.filter((r) => r.values?.status === "In Progress" || r.values?.status === "To Do");
  const blockedItems = dbRows.filter((r) => r.values?.status === "Blocked");

  return (
    <div className="space-y-4">
      {inExecution.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Strategy in execution</p>
          <div className="space-y-1.5">
            {inExecution.map((item) => {
              const translation = deptTranslations.find((t) => t.strategyItemId === item.id);
              return (
                <div key={item.id} className="rounded-md border border-border px-3 py-2 space-y-1">
                  <p className="text-xs font-medium text-foreground">{item.title}</p>
                  {translation && (
                    <div className="pl-2 border-l-2 border-primary/20 space-y-0.5">
                      <p className="text-[10px] text-muted-foreground">{translation.meaning}</p>
                      {translation.priorities.map((p, i) => (
                        <p key={i} className="text-[10px] text-primary font-medium">→ {p}</p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Active Projects ({activeProjects.length})</p>
        </div>
        {activeProjects.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 py-2">No active projects</p>
        ) : (
          <div className="space-y-1">
            {activeProjects.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs py-1">
                <span className="text-foreground">{p.values.title as string}</span>
                <Badge variant="secondary" className="text-[10px]">{p.values.priority as string}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tasks ({activeTasks.length})</p>
        </div>
        {activeTasks.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 py-2">No active tasks</p>
        ) : (
          <div className="space-y-1">
            {activeTasks.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between text-xs py-1">
                <span className="text-foreground">{t.values.title as string}</span>
                <Badge variant="outline" className="text-[10px]">{t.values.status as string}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {blockedItems.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            <p className="text-[10px] text-destructive uppercase tracking-wide font-medium">Blockers ({blockedItems.length})</p>
          </div>
          <div className="space-y-1">
            {blockedItems.map((b) => (
              <div key={b.id} className="text-xs text-foreground py-1 pl-2 border-l-2 border-destructive/30">
                {b.values.title as string}
              </div>
            ))}
          </div>
        </div>
      )}

      {inExecution.length === 0 && activeProjects.length === 0 && activeTasks.length === 0 && blockedItems.length === 0 && (
        <p className="text-xs text-muted-foreground/60 text-center py-6">No execution activity to display.</p>
      )}
    </div>
  );
}
