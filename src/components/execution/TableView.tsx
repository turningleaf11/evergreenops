import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

interface TableViewProps {
  items: any[];
  type: "project" | "task";
  onItemClick: (item: any) => void;
  onStatusChange: (id: string, status: string) => void;
  getName: (uid: string | null) => string;
  statusOptions: { value: string; label: string }[];
  goals?: any[];
  projects?: any[];
}

const priorityColors: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-800",
  urgent: "bg-red-200 text-red-900",
};

export default function TableView({
  items, type, onItemClick, onStatusChange, getName, statusOptions, goals, projects,
}: TableViewProps) {
  const ownerField = type === "project" ? "owner_id" : "assigned_to";

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>{type === "project" ? "Owner" : "Assignee"}</TableHead>
            <TableHead>Due Date</TableHead>
            {type === "project" && <TableHead>Goal</TableHead>}
            {type === "task" && <TableHead>Project</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(item => {
            const goalTitle = goals?.find((g: any) => g.id === item.goal_id)?.title;
            const projectTitle = projects?.find((p: any) => p.id === item.project_id)?.title;
            return (
              <TableRow
                key={item.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onItemClick(item)}
              >
                <TableCell className="font-medium">{item.title}</TableCell>
                <TableCell>
                  <Select
                    value={item.status}
                    onValueChange={v => onStatusChange(item.id, v)}
                  >
                    <SelectTrigger className="w-28 h-7 text-xs" onClick={e => e.stopPropagation()}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {item.priority && (
                    <Badge variant="outline" className={`text-[10px] capitalize ${priorityColors[item.priority] || ""}`}>
                      {item.priority}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">{getName(item[ownerField])}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{item.due_date || "—"}</TableCell>
                {type === "project" && (
                  <TableCell className="text-xs">{goalTitle || "—"}</TableCell>
                )}
                {type === "task" && (
                  <TableCell className="text-xs">{projectTitle || "—"}</TableCell>
                )}
              </TableRow>
            );
          })}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No items match your filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
