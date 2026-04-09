import { useState } from "react";
import { databaseItems, statusConfig, priorityConfig, departments, teamMembers } from "@/lib/mock-data";
import type { DatabaseItem } from "@/lib/mock-data";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Search, LayoutGrid, List, TableIcon, CheckCircle2, Circle, Clock, AlertTriangle } from "lucide-react";

type ViewMode = "table" | "kanban" | "list";
type ItemType = "all" | "goal" | "project" | "task";

const statusIcons: Record<string, React.ElementType> = {
  not_started: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
  blocked: AlertTriangle,
};

export default function DatabasesPage() {
  const [view, setView] = useState<ViewMode>("table");
  const [typeFilter, setTypeFilter] = useState<ItemType>("all");
  const [search, setSearch] = useState("");

  const filtered = databaseItems.filter((item) => {
    const matchType = typeFilter === "all" || item.type === typeFilter;
    const matchSearch = item.title.toLowerCase().includes(search.toLowerCase()) || item.assignee.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Databases</h1>
        <p className="text-muted-foreground mt-1">Track goals, projects, and tasks across the organization.</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "goal", "project", "task"] as const).map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${typeFilter === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              {t === "all" ? "All" : `${t}s`}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm w-48" />
          </div>
          <div className="flex border rounded-md overflow-hidden">
            {([
              { mode: "table" as const, icon: TableIcon },
              { mode: "kanban" as const, icon: LayoutGrid },
              { mode: "list" as const, icon: List },
            ]).map(({ mode, icon: Icon }) => (
              <button key={mode} onClick={() => setView(mode)} className={`p-1.5 ${view === mode ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "table" && <TableView items={filtered} />}
      {view === "kanban" && <KanbanView items={filtered} />}
      {view === "list" && <ListView items={filtered} />}
    </div>
  );
}

function TableView({ items }: { items: DatabaseItem[] }) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Progress</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const st = statusConfig[item.status];
            const pr = priorityConfig[item.priority];
            return (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.title}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize text-[10px]">{item.type}</Badge></TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]" style={{ borderColor: `hsl(${st.color})`, color: `hsl(${st.color})` }}>
                    {st.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]" style={{ borderColor: `hsl(${pr.color})`, color: `hsl(${pr.color})` }}>
                    {pr.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{item.assignee}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{item.dueDate || "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${item.progress}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{item.progress}%</span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function KanbanView({ items }: { items: DatabaseItem[] }) {
  const statuses = ["not_started", "in_progress", "completed", "blocked"] as const;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statuses.map((status) => {
        const st = statusConfig[status];
        const StatusIcon = statusIcons[status];
        const columnItems = items.filter((i) => i.status === status);
        return (
          <div key={status} className="space-y-2">
            <div className="flex items-center gap-2 px-1 pb-2">
              <StatusIcon className="h-4 w-4" style={{ color: `hsl(${st.color})` }} />
              <span className="text-sm font-medium">{st.label}</span>
              <span className="text-xs text-muted-foreground ml-auto">{columnItems.length}</span>
            </div>
            <div className="space-y-2 min-h-[200px]">
              {columnItems.map((item) => {
                const pr = priorityConfig[item.priority];
                return (
                  <Card key={item.id} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-medium leading-snug">{item.title}</p>
                        <Badge variant="outline" className="text-[9px] shrink-0 capitalize">{item.type}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{item.assignee}</span>
                        <Badge variant="outline" className="text-[9px]" style={{ borderColor: `hsl(${pr.color})`, color: `hsl(${pr.color})` }}>
                          {pr.label}
                        </Badge>
                      </div>
                      {item.progress > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${item.progress}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{item.progress}%</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({ items }: { items: DatabaseItem[] }) {
  return (
    <div className="space-y-1">
      {items.map((item) => {
        const st = statusConfig[item.status];
        const StatusIcon = statusIcons[item.status];
        return (
          <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors group">
            <StatusIcon className="h-4 w-4 shrink-0" style={{ color: `hsl(${st.color})` }} />
            <span className="text-sm font-medium flex-1 truncate">{item.title}</span>
            <Badge variant="outline" className="text-[10px] capitalize shrink-0">{item.type}</Badge>
            <span className="text-xs text-muted-foreground w-24 text-right truncate hidden sm:block">{item.assignee}</span>
            <span className="text-xs text-muted-foreground w-20 text-right hidden md:block">{item.dueDate || "—"}</span>
            <div className="w-12 flex items-center justify-end">
              <span className="text-xs text-muted-foreground">{item.progress}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
