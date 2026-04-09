import { useParams } from "react-router-dom";
import { departments, teamMembers, announcements, docPages, databases, databaseRows } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FileText, Pin } from "lucide-react";
import { Link } from "react-router-dom";

export default function DepartmentPage() {
  const { id } = useParams<{ id: string }>();
  const dept = departments.find((d) => d.id === id);

  if (!dept) return <div className="p-6 text-muted-foreground">Department not found.</div>;

  const members = teamMembers.filter((m) => m.departmentId === id);
  const deptAnnouncements = announcements.filter((a) => a.departmentId === id);
  const deptDocs = docPages.filter((d) => d.sharedWith.departmentIds.includes(id!));
  const deptDatabases = databases.filter((d) => d.sharedWith.departmentIds.includes(id!));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{dept.name}</h1>
        <p className="text-muted-foreground mt-1">{dept.description}</p>
      </div>

      {deptAnnouncements.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Announcements</h2>
          {deptAnnouncements.map((a) => (
            <Card key={a.id}>
              <CardContent className="py-3 px-4 flex items-start gap-2">
                <Pin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">{a.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.content}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">Team ({members.length})</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {members.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs bg-muted">{m.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{m.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.role}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {deptDocs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Docs</h2>
          <div className="space-y-2">
            {deptDocs.map((doc) => (
              <Card key={doc.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3 flex items-start gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{doc.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{doc.author} · {doc.updatedAt}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {deptDatabases.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Databases</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {deptDatabases.map((db) => {
              const rowCount = databaseRows.filter(r => r.databaseId === db.id).length;
              return (
                <Link key={db.id} to={`/databases/${db.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <p className="font-medium text-sm">{db.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{db.description}</p>
                      <Badge variant="secondary" className="text-[10px] mt-2">{rowCount} rows</Badge>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
