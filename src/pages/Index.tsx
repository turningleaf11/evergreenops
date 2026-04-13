import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Link } from "react-router-dom";
import { Pin, FileText, ArrowRight, Code2, Palette, Lightbulb, Megaphone, Settings, Building2 } from "lucide-react";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { ActivityFeed } from "@/components/ActivityFeed";

const iconMap: Record<string, React.ElementType> = {
  Code2, Palette, Lightbulb, Megaphone, Settings,
};

const Index = () => {
  const { departments } = useDepartments();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [recentDocs, setRecentDocs] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const [annRes, docRes] = await Promise.all([
        supabase.from("announcements").select("*").eq("pinned", true).limit(5),
        supabase.from("documents").select("id, title, author_name, updated_at, tags").order("updated_at", { ascending: false }).limit(3),
      ]);
      if (annRes.data) setAnnouncements(annRes.data);
      if (docRes.data) setRecentDocs(docRes.data);
    };
    fetch();
  }, []);

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
                    <p className="text-xs text-muted-foreground mt-0.5">Updated {doc.updated_at?.split("T")[0]} · {doc.author_name}</p>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {(doc.tags || []).map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {recentDocs.length === 0 && <p className="text-sm text-muted-foreground">No documents yet.</p>}
          </div>
        </section>

        <ActivityFeed limit={10} />
      </div>
    </div>
  );
};

export default Index;
