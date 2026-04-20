import { useDepartments } from "@/contexts/DepartmentsContext";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Building2, ArrowRight } from "lucide-react";
import * as Icons from "lucide-react";

export function DepartmentsWidget() {
  const { departments } = useDepartments();

  const getIcon = (name: string | null) => {
    if (!name) return Building2;
    return (Icons as any)[name] || Building2;
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground/70" /> Departments
          </h2>
          <Link to="/people" className="text-xs text-primary hover:underline flex items-center gap-1">
            All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {departments.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">No departments yet</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {departments.map((d) => {
              const Icon = getIcon(d.icon);
              return (
                <Link
                  key={d.id}
                  to={`/department/${d.id}`}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/40 hover:border-border transition-colors group"
                >
                  <div
                    className="h-7 w-7 rounded-md flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `hsl(${d.color || "220 65% 48%"} / 0.12)` }}
                  >
                    <Icon
                      className="h-3.5 w-3.5"
                      style={{ color: `hsl(${d.color || "220 65% 48%"})` }}
                    />
                  </div>
                  <span className="text-xs font-medium truncate group-hover:text-foreground">
                    {d.name}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
