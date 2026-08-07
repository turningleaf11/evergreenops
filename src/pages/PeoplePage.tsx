import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Mail, Phone } from "lucide-react";
import { PersonDetail } from "@/components/PersonDetail";
import { OrgChart } from "@/components/OrgChart";
import { PeopleOpsTab } from "@/components/people-ops/PeopleOpsTab";
import { useAuth } from "@/contexts/AuthContext";

interface Profile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  department_id: string | null;
  title: string | null;
  phone: string | null;
  email: string | null;
  bio: string | null;
  reports_to: string | null;
  start_date?: string | null;
  created_at?: string | null;
}

export default function PeoplePage() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string | null>(null);
  const { departments } = useDepartments();
  const { isAdmin, isOrbitOnly, profile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Profile | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = useMemo(() => {
    const t = searchParams.get("tab");
    if (t === "people-ops" && isAdmin) return "people-ops";
    if (t === "org-chart") return "org-chart";
    return "directory";
  }, [searchParams, isAdmin]);

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url, department_id, title, phone, email, bio, reports_to, birthday, start_date, created_at");
    if (data) setProfiles(data);
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  // Deep link from elsewhere (e.g. PersonPeek's "Open full profile") — /people?u=<id>
  // opens that person's full detail sheet once the directory has loaded.
  useEffect(() => {
    const uid = searchParams.get("u");
    if (!uid || profiles.length === 0) return;
    const match = profiles.find((p) => p.user_id === uid);
    if (match) {
      setSelectedPerson(match);
      setDetailOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("u");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles]);

  // Orbit-only members see only their cohort (same dept) + admins.
  // Everyone else sees the full directory subject to filters.
  const visible = isOrbitOnly && profile?.department_id
    ? profiles.filter((m) =>
        m.user_id === profile.user_id ||
        m.department_id === profile.department_id ||
        // Always show admins so members can reach out for help
        false /* admin check happens via separate signal — leaving inline filter simple */
      )
    : profiles;

  const filtered = visible.filter((m) => {
    const matchesSearch = (m.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.title || "").toLowerCase().includes(search.toLowerCase());
    const matchesDept = !deptFilter || m.department_id === deptFilter;
    return matchesSearch && matchesDept;
  });

  const openPerson = (p: Profile) => {
    setSelectedPerson(p);
    setDetailOpen(true);
  };

  const handleProfileUpdated = () => {
    fetchProfiles().then(() => {
      // Update selected person with fresh data
      if (selectedPerson) {
        const fresh = profiles.find((p) => p.user_id === selectedPerson.user_id);
        if (fresh) setSelectedPerson(fresh);
      }
    });
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">People</h1>
        <p className="text-muted-foreground mt-1">Team directory across all departments.</p>
      </div>

      <Tabs
        value={initialTab}
        onValueChange={(v) => {
          const next = new URLSearchParams(searchParams);
          if (v === "directory") next.delete("tab");
          else next.set("tab", v);
          setSearchParams(next, { replace: true });
        }}
      >
        <TabsList>
          <TabsTrigger value="directory">Directory</TabsTrigger>
          <TabsTrigger value="org-chart">Org Chart</TabsTrigger>
          {isAdmin && <TabsTrigger value="people-ops">People Ops</TabsTrigger>}
        </TabsList>

        <TabsContent value="directory" className="space-y-4 mt-4">
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
                <Card key={member.user_id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openPerson(member)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        {member.avatar_url && <AvatarImage src={member.avatar_url} alt={member.full_name || ""} />}
                        <AvatarFallback className="text-sm bg-muted">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{member.full_name || "Unnamed"}</p>
                        {member.title && <p className="text-xs text-muted-foreground mt-0.5">{member.title}</p>}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {dept && <Badge variant="secondary" className="text-[10px]">{dept.name}</Badge>}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {member.email && (
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate">{member.email}</span>
                            </span>
                          )}
                          {member.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3 shrink-0" />
                              {member.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filtered.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-8">No team members found.</p>}
          </div>
        </TabsContent>

        <TabsContent value="org-chart" className="mt-4">
          <OrgChart profiles={profiles} departments={departments} onSelect={openPerson} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="people-ops" className="mt-4">
            <PeopleOpsTab profiles={profiles} departments={departments} onSelect={openPerson} />
          </TabsContent>
        )}
      </Tabs>

      <PersonDetail
        person={selectedPerson}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        departments={departments}
        profiles={profiles}
        onProfileUpdated={handleProfileUpdated}
      />
    </div>
  );
}
