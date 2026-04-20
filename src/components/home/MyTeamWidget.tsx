import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const statusDot: Record<string, string> = {
  available: "bg-emerald-500",
  busy: "bg-amber-500",
  away: "bg-muted-foreground",
  out: "bg-red-500",
};

export function MyTeamWidget() {
  const { profile } = useAuth();
  const { departments } = useDepartments();
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    if (!profile?.department_id) {
      setMembers([]);
      return;
    }
    supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url, title, availability_status")
      .eq("department_id", profile.department_id)
      .neq("user_id", profile.user_id)
      .limit(4)
      .then(({ data }) => {
        if (data) setMembers(data);
      });
  }, [profile?.department_id, profile?.user_id]);

  const dept = departments.find((d) => d.id === profile?.department_id);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground/70" /> My Team
            {dept && <span className="text-xs font-normal text-muted-foreground">· {dept.name}</span>}
          </h2>
          <Link to="/people" className="text-xs text-primary hover:underline flex items-center gap-1">
            Directory <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {members.length === 0 ? (
          <div className="py-3 text-center">
            <Users className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">
              {profile?.department_id ? "You're the only one here so far." : "Join a department to see your team."}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {members.map((m) => {
              const initials = (m.full_name || "U").split(" ").map((n: string) => n[0]).slice(0, 2).join("");
              const status = m.availability_status || "available";
              return (
                <div key={m.user_id} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-muted/40 transition-colors">
                  <div className="relative shrink-0">
                    <Avatar className="h-8 w-8">
                      {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                      <AvatarFallback className="text-[10px] bg-muted">{initials}</AvatarFallback>
                    </Avatar>
                    <span className={cn("absolute -bottom-0 -right-0 h-2.5 w-2.5 rounded-full ring-2 ring-card", statusDot[status] || statusDot.available)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate leading-tight">{m.full_name || "Unnamed"}</p>
                    {m.title && <p className="text-[10px] text-muted-foreground truncate">{m.title}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
