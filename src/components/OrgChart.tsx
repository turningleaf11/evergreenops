import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface Profile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  department_id: string | null;
  title: string | null;
  reports_to: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface Props {
  profiles: Profile[];
  departments: Department[];
  onSelect: (p: Profile) => void;
}

function OrgNode({ person, profiles, departments, onSelect, depth }: {
  person: Profile;
  profiles: Profile[];
  departments: Department[];
  onSelect: (p: Profile) => void;
  depth: number;
}) {
  const directReports = profiles.filter((p) => p.reports_to === person.user_id);
  const dept = departments.find((d) => d.id === person.department_id);
  const initials = (person.full_name || "U").split(" ").map((n) => n[0]).join("").toUpperCase();

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={() => onSelect(person)}
        className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border bg-card hover:shadow-md transition-shadow cursor-pointer min-w-[140px]"
      >
        <Avatar className="h-10 w-10">
          {person.avatar_url && <AvatarImage src={person.avatar_url} alt={person.full_name || ""} />}
          <AvatarFallback className="text-sm bg-muted">{initials}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium text-center leading-tight">{person.full_name || "Unnamed"}</span>
        {person.title && <span className="text-[11px] text-muted-foreground text-center">{person.title}</span>}
        {dept && <Badge variant="secondary" className="text-[10px]">{dept.name}</Badge>}
      </button>

      {directReports.length > 0 && (
        <>
          <div className="w-px h-5 bg-border" />
          <div className="flex gap-4 flex-wrap justify-center relative">
            {directReports.length > 1 && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px bg-border" 
                   style={{ width: `calc(100% - 140px)` }} />
            )}
            {directReports.map((report) => (
              <div key={report.user_id} className="flex flex-col items-center">
                <div className="w-px h-5 bg-border" />
                <OrgNode
                  person={report}
                  profiles={profiles}
                  departments={departments}
                  onSelect={onSelect}
                  depth={depth + 1}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function OrgChart({ profiles, departments, onSelect }: Props) {
  // Find root nodes (no reports_to set)
  const roots = profiles.filter((p) => !p.reports_to);
  // Also find people whose reports_to points to someone not in profiles
  const allUserIds = new Set(profiles.map((p) => p.user_id));
  const orphans = profiles.filter((p) => p.reports_to && !allUserIds.has(p.reports_to));
  const topLevel = [...roots, ...orphans];

  if (topLevel.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        <p>No org chart data yet.</p>
        <p className="mt-1">Set "Reports to" on team members in the Team Management tab to build the hierarchy.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto py-6">
      <div className="flex gap-8 justify-center min-w-max px-4">
        {topLevel.map((person) => (
          <OrgNode
            key={person.user_id}
            person={person}
            profiles={profiles}
            departments={departments}
            onSelect={onSelect}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
}
