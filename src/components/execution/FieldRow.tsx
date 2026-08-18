// A stacked icon+label+value row — the layout TaskPeek and AgentTaskPeek
// both use for Project/Assignee/Status/Priority/etc. One component so both
// peeks render these rows identically instead of drifting apart.
export default function FieldRow({
  icon: Icon, label, children,
}: {
  icon: any;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-24 shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
