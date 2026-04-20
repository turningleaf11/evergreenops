import { useDepartments } from "@/contexts/DepartmentsContext";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronDown } from "lucide-react";
import * as Icons from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function DepartmentsWidget() {
  const { departments } = useDepartments();
  const navigate = useNavigate();

  const getIcon = (name: string | null) => {
    if (!name) return Building2;
    return (Icons as any)[name] || Building2;
  };

  return (
    <Card>
      <CardContent className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors group">
            <span className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground/70" />
              Departments
              <span className="text-[10px] text-muted-foreground font-normal">
                · {departments.length}
              </span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto">
            {departments.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">No departments</div>
            ) : (
              departments.map((d) => {
                const Icon = getIcon(d.icon);
                return (
                  <DropdownMenuItem
                    key={d.id}
                    onClick={() => navigate(`/department/${d.id}`)}
                    className="gap-2 cursor-pointer"
                  >
                    <div
                      className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `hsl(${d.color || "220 65% 48%"} / 0.12)` }}
                    >
                      <Icon className="h-3 w-3" style={{ color: `hsl(${d.color || "220 65% 48%"})` }} />
                    </div>
                    <span className="text-xs truncate">{d.name}</span>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}
