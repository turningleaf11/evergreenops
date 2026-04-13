import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { announcements, departments, docPages, databases, databaseRows } from "@/lib/mock-data";
import { Link } from "react-router-dom";
import { Pin, FileText, ArrowRight, Code2, Palette, Lightbulb, Megaphone, Settings, Building2 } from "lucide-react";
import { OnboardingBanner } from "@/components/OnboardingBanner";

const iconMap: Record<string, React.ElementType> = {
  Code2, Palette, Lightbulb, Megaphone, Settings,
};

const Index = () => {
  const pinnedAnnouncements = announcements.filter((a) => a.pinned);
  const recentDocs = docPages.slice(0, 3);
  // Show rows that are "In Progress" across all databases
  const activeRows = databaseRows.filter((r) => r.values.status === "In Progress").slice(0, 4);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back, Sarah</h1>
        <p className="text-muted-foreground mt-1">Here's what's happening across your workspace.</p>
      </div>

      <OnboardingBanner />

      {pinnedAnnouncements.length > 0 && (
        <div className="space-y-3">
          {pinnedAnnouncements.map((a) => (
            <Card key={a.id} className="border-l-4 border-l-primary">
              <CardContent className="py-4 px-5">
                <div className="flex items-start gap-2">
                  <Pin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{a.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{a.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">by {a.author} · {a.createdAt}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Departments</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {departments.map((dept) => {
            const Icon = iconMap[dept.icon] || Building2;
            return (
              <Link key={dept.id} to={`/department/${dept.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `hsl(${dept.color} / 0.1)`, color: `hsl(${dept.color})` }}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{dept.name}</p>
                        <p className="text-xs text-muted-foreground">{dept.memberCount} members</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Recent Docs</h2>
            <Link to="/docs" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <div className="space-y-2">
            {recentDocs.map((doc) => (
              <Card key={doc.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3 flex items-start gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Updated {doc.updatedAt} · {doc.author}</p>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {doc.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Active Work</h2>
            <Link to="/databases" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <div className="space-y-2">
            {activeRows.map((row) => {
              const db = databases.find(d => d.id === row.databaseId);
              return (
                <Card key={row.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm truncate mr-2">{row.values.title}</p>
                      {db && <Badge variant="outline" className="text-[10px] shrink-0">{db.title}</Badge>}
                    </div>
                    {row.values.progress !== undefined && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${row.values.progress}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{row.values.progress}%</span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1.5">{row.values.assignee}{row.values.due_date ? ` · Due ${row.values.due_date}` : ""}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Index;
