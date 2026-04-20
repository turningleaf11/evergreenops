import { useDepartments } from "@/contexts/DepartmentsContext";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";
import * as Icons from "lucide-react";

export function DepartmentsWidget() {
  const { departments } = useDepartments();
  const navigate = useNavigate();

  const getIcon = (name: string | null) => {
    if (!name) return Building2;
    return (Icons as any)[name] || Building2;
  };

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2 px-1">
          <Building2 className="h-4 w-4 text-muted-foreground/70" />
          <span className="text-sm font-medium">Departments</span>
          <span className="text-[10px] text-muted-foreground font-normal">· {departments.length}</span>
        </div>
        {departments.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground text-center">No departments</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {departments.map((d) => {
              const Icon = getIcon(d.icon);
              const color = d.color || "220 65% 48%";
              return (
                <button
                  key={d.id}
                  onClick={() => navigate(`/department/${d.id}`)}
                  className="group inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full border border-border/60 bg-card hover:bg-muted/40 hover:border-border transition-all text-xs"
                  title={d.name}
                >
                  <span
                    className="h-5 w-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `hsl(${color} / 0.15)` }}
                  >
                    <Icon className="h-3 w-3" style={{ color: `hsl(${color})` }} />
                  </span>
                  <span className="truncate max-w-[120px]">{d.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
