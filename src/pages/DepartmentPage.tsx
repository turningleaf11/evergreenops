import { useParams } from "react-router-dom";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FileText, Pin } from "lucide-react";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { StrategyFeed } from "@/components/StrategyFeed";
import { TranslationBlockComponent } from "@/components/TranslationBlock";
import { ExecutionSnapshot } from "@/components/ExecutionSnapshot";
import { UpwardProposalForm } from "@/components/UpwardProposal";
import { LeadershipAiChat } from "@/components/LeadershipAiChat";
import { Bot, Zap, Brain } from "lucide-react";

interface Profile { user_id: string; full_name: string | null; avatar_url: string | null; department_id: string | null; }
interface Announcement { id: string; title: string; content: string | null; pinned: boolean; }
interface Doc { id: string; title: string; author_name: string | null; updated_at: string; }
interface DB { id: string; title: string; description: string | null; rowCount?: number; }

export default function DepartmentPage() {
  const { id } = useParams<{ id: string }>();
  const { departments } = useDepartments();
  const dept = departments.find((d) => d.id === id);

  const [members, setMembers] = useState<Profile[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [dbs, setDbs] = useState<DB[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      const [profilesRes, announcementsRes, docsRes, dbsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url, department_id").eq("department_id", id),
        supabase.from("announcements").select("id, title, content, pinned").eq("department_id", id),
        supabase.from("documents").select("id, title, author_name, updated_at"),
        supabase.from("databases_meta").select("id, title, description"),
      ]);
      setMembers((profilesRes.data as Profile[]) || []);
      setAnnouncements((announcementsRes.data as Announcement[]) || []);
      // Filter docs/dbs that are shared with this department (stored in shared_with jsonb)
      const allDocs = docsRes.data || [];
      const allDbs = dbsRes.data || [];
      // We need to filter client-side since shared_with is JSONB
      // For now show all workspace-visible ones plus dept-specific
      setDocs(allDocs.map((d: any) => ({ id: d.id, title: d.title, author_name: d.author_name, updated_at: d.updated_at?.split("T")[0] || "" })));
      setDbs(allDbs.map((d: any) => ({ id: d.id, title: d.title, description: d.description })));
      setLoading(false);
    };
    fetch();
  }, [id]);

  if (!dept) return <div className="p-6 text-muted-foreground">Department not found.</div>;
  if (loading) return <div className="p-6 text-muted-foreground text-sm">Loading...</div>;

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
          {announcements.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Announcements</h2>
              {announcements.map((a) => (
                <Card key={a.id}>
                  <CardContent className="py-3 px-4 flex items-start gap-2">
                    <Pin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div><p className="font-medium text-sm">{a.title}</p><p className="text-xs text-muted-foreground mt-0.5">{a.content}</p></div>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

          <section>
            <h2 className="text-lg font-semibold mb-3">Team ({members.length})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {members.map((m) => (
                <Card key={m.user_id}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Avatar className="h-9 w-9"><AvatarFallback className="text-xs bg-muted">{(m.full_name || "U").split(" ").map((n) => n[0]).join("")}</AvatarFallback></Avatar>
                    <div className="min-w-0"><p className="font-medium text-sm truncate">{m.full_name || "Unnamed"}</p></div>
                  </CardContent>
                </Card>
              ))}
              {members.length === 0 && <p className="text-sm text-muted-foreground col-span-full">No team members assigned to this department yet.</p>}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="leadership" className="mt-4">
          <EmbeddedLeadership deptId={id!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmbeddedLeadership({ deptId }: { deptId: string }) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="strategy">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="strategy" className="text-xs"><Zap className="h-3 w-3 mr-1" />Strategy</TabsTrigger>
          <TabsTrigger value="execution" className="text-xs"><Brain className="h-3 w-3 mr-1" />Execution</TabsTrigger>
        </TabsList>
        <TabsContent value="strategy" className="space-y-6 mt-4">
          <StrategyFeed departmentId={deptId} />
          <TranslationBlockComponent departmentId={deptId} />
          <UpwardProposalForm departmentId={deptId} />
        </TabsContent>
        <TabsContent value="execution" className="mt-4">
          <ExecutionSnapshot departmentId={deptId} />
        </TabsContent>
      </Tabs>

      <button onClick={() => setChatOpen(!chatOpen)} className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors">
        <Bot className="h-5 w-5" />
      </button>
      {chatOpen && <LeadershipAiChat open={chatOpen} onOpenChange={setChatOpen} departmentId={deptId} />}
    </div>
  );
}
