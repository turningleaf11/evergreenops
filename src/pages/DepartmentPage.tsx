import { useParams } from "react-router-dom";
import { departments, teamMembers, announcements, docPages, databases, databaseRows } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FileText, Pin } from "lucide-react";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { lazy, Suspense } from "react";

const LeadershipDashboard = lazy(() => import("@/pages/LeadershipDashboard"));

export default function DepartmentPage() {
  const { id } = useParams<{ id: string }>();
  const dept = departments.find((d) => d.id === id);

  if (!dept) return <div className="p-6 text-muted-foreground">Department not found.</div>;

  const members = teamMembers.filter((m) => m.departmentId === id);
  const deptAnnouncements = announcements.filter((a) => a.departmentId === id);
  const deptDocs = docPages.filter((d) => d.sharedWith.departmentIds.includes(id!));
  const deptDatabases = databases.filter((d) => d.sharedWith.departmentIds.includes(id!));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{dept.name}</h1>
        <p className="text-muted-foreground mt-1">{dept.description}</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="leadership">Leadership</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8 mt-4">
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
        </TabsContent>

        <TabsContent value="leadership" className="mt-4">
          <Suspense fallback={<div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>}>
            <LeadershipDashboardEmbed deptId={id!} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Wrapper that sets the URL param LeadershipDashboard expects */
function LeadershipDashboardEmbed({ deptId }: { deptId: string }) {
  // LeadershipDashboard reads deptId from useParams, but when embedded
  // we're on /department/:id — so we render it via the route-matched lazy import
  // and override with a prop-based approach. Since we can't change useParams,
  // we'll render the dashboard content directly.
  return <EmbeddedLeadership deptId={deptId} />;
}

// We need to refactor: LeadershipDashboard uses useParams internally.
// For embedding, we create a thin wrapper that imports the internals.
import { departments as deptList } from "@/lib/mock-data";
import { StrategyFeed } from "@/components/StrategyFeed";
import { TranslationBlockComponent } from "@/components/TranslationBlock";
import { ExecutionSnapshot } from "@/components/ExecutionSnapshot";
import { UpwardProposalForm } from "@/components/UpwardProposal";
import { LeadershipAiChat } from "@/components/LeadershipAiChat";
import { Bot, Zap, Brain } from "lucide-react";
import { useState } from "react";

function EmbeddedLeadership({ deptId }: { deptId: string }) {
  const dept = deptList.find((d) => d.id === deptId);
  const [chatOpen, setChatOpen] = useState(false);

  if (!dept) return null;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="strategy">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="strategy" className="text-xs"><Zap className="h-3 w-3 mr-1" />Strategy</TabsTrigger>
          <TabsTrigger value="execution" className="text-xs"><Brain className="h-3 w-3 mr-1" />Execution</TabsTrigger>
        </TabsList>
        <TabsContent value="strategy" className="space-y-6 mt-4">
          <StrategyFeed deptId={deptId} />
          <TranslationBlockComponent deptId={deptId} />
          <UpwardProposalForm deptId={deptId} />
        </TabsContent>
        <TabsContent value="execution" className="mt-4">
          <ExecutionSnapshot deptId={deptId} />
        </TabsContent>
      </Tabs>

      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
      >
        <Bot className="h-5 w-5" />
      </button>
      {chatOpen && <LeadershipAiChat deptId={deptId} deptName={dept.name} onClose={() => setChatOpen(false)} />}
    </div>
  );
}