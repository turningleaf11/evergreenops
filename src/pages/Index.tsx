import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Pin, FileText, ArrowRight } from "lucide-react";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { ActivityFeed } from "@/components/ActivityFeed";
import { RemindersWidget } from "@/components/RemindersWidget";
import { getDeptIcon } from "@/lib/icon-map";

const Index = () => {
  const { departments } = useDepartments();
  const { isAdmin, profile } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [recentDocs, setRecentDocs] = useState<any[]>([]);

  const visibleDepartments = isAdmin
    ? departments
    : departments.filter((d) => d.id === profile?.department_id);

  useEffect(() => {
    const fetch = async () => {
      const [annRes, docRes] = await Promise.all([
        supabase.from("announcements").select("*").eq("pinned", true).limit(5),
        supabase.from("documents").select("id, title, author_name, updated_at, tags, visibility, shared_with").order("updated_at", { ascending: false }).limit(20),
      ]);
      if (annRes.data) setAnnouncements(annRes.data);
      if (docRes.data) {
        const filtered = isAdmin
          ? docRes.data.slice(0, 3)
          : docRes.data
              .filter((doc: any) => {
                if (doc.visibility === "workspace") return true;
                if (doc.visibility === "private") return doc.author_id === profile?.user_id;
                const sw = doc.shared_with || { departmentIds: [], memberIds: [] };
                return (sw.departmentIds || []).includes(profile?.department_id) ||
                       (sw.memberIds || []).includes(profile?.user_id);
              })
              .slice(0, 3);
        setRecentDocs(filtered);
      }
    };
    fetch();
  }, [isAdmin, profile]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <OnboardingBanner />

      {announcements.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Pinned Announcements</h2>
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
        <h2 className="text-lg font-semibold mb-3">Departments</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {visibleDepartments.map((dept) => {
            const Icon = getDeptIcon(dept.icon);
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
                        <p className="text-xs text-muted-foreground">{dept.description || "Department"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1">
          <RemindersWidget />
        </section>

        <section className="lg:col-span-1">
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h2 className="text-base font-semibold">Recent Docs</h2>
                <Link to="/docs" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
              </div>
              <div className="px-4 pb-4 space-y-2">
                {recentDocs.map((doc) => (
                  <div key={doc.id} className="flex items-start gap-3 p-2 rounded hover:bg-muted/50 transition-colors">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{doc.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Updated {doc.updated_at?.split("T")[0]}</p>
                    </div>
                  </div>
                ))}
                {recentDocs.length === 0 && <p className="text-sm text-muted-foreground">No documents yet.</p>}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="lg:col-span-1">
          <ActivityFeed limit={8} />
        </section>
      </div>
    </div>
  );
};

export default Index;
