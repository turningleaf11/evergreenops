import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Mail } from "lucide-react";

interface Profile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  department_id: string | null;
}

export default function PeoplePage() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string | null>(null);
  const { departments } = useDepartments();
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, avatar_url, department_id");
      if (data) setProfiles(data);
    };
    fetch();
  }, []);

  const filtered = profiles.filter((m) => {
    const matchesSearch = (m.full_name || "").toLowerCase().includes(search.toLowerCase());
    const matchesDept = !deptFilter || m.department_id === deptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">People</h1>
        <p className="text-muted-foreground mt-1">Team directory across all departments.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search people..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setDeptFilter(null)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!deptFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            All
          </button>
          {departments.map((dept) => (
            <button key={dept.id} onClick={() => setDeptFilter(dept.id)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${deptFilter === dept.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              {dept.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((member) => {
          const dept = departments.find((d) => d.id === member.department_id);
          const initials = (member.full_name || "U").split(" ").map((n) => n[0]).join("").toUpperCase();
          return (
            <Card key={member.user_id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="text-sm bg-muted">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{member.full_name || "Unnamed"}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {dept && <Badge variant="secondary" className="text-[10px]">{dept.name}</Badge>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-8">No team members found.</p>}
      </div>
    </div>
  );
}
