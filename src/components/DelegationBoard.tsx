import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Users, ListFilter, UserPlus2 } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/EmptyState";

type DelegatedItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  type: "task" | "project";
};

type Profile = { user_id: string; full_name: string | null; avatar_url: string | null };

const statusColors: Record<string, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/10 text-blue-700",
  done: "bg-green-500/10 text-green-700",
  blocked: "bg-red-500/10 text-red-700",
  not_started: "bg-muted text-muted-foreground",
};

const priorityDots: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-green-500",
};

export function DelegationBoard() {
  const { user } = useAuth();
  const [open, setOpen] = useState(true);
  const [view, setView] = useState<"person" | "status">("person");
  const [items, setItems] = useState<DelegatedItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [tasksRes, projectsRes, profilesRes] = await Promise.all([
        supabase.from("tasks").select("id, title, status, priority, due_date, assigned_to")
          .eq("created_by", user.id).not("assigned_to", "is", null).neq("assigned_to", user.id),
        supabase.from("projects").select("id, title, status, priority, due_date, owner_id")
          .eq("created_by", user.id).not("owner_id", "is", null).neq("owner_id", user.id),
        supabase.from("profiles").select("user_id, full_name, avatar_url"),
      ]);

      const delegated: DelegatedItem[] = [
        ...(tasksRes.data || []).map(t => ({ ...t, type: "task" as const })),
        ...(projectsRes.data || []).map(p => ({ ...p, assigned_to: p.owner_id, type: "project" as const })),
      ];
      setItems(delegated);
      if (profilesRes.data) setProfiles(profilesRes.data);
    })();
  }, [user]);

  const profileMap = new Map(profiles.map(p => [p.user_id, p]));

  const getInitials = (name: string | null) => (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const renderItem = (item: DelegatedItem) => (
    <div key={item.id} className="flex items-center gap-3 py-2 px-1 border-b border-border/50 last:border-0">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityDots[item.priority] || "bg-muted"}`} />
      <span className="text-sm text-foreground flex-1 truncate">{item.title}</span>
      <Badge variant="outline" className={`text-[10px] ${statusColors[item.status] || ""}`}>
        {item.status.replace("_", " ")}
      </Badge>
      {item.due_date && (
        <span className="text-[10px] text-muted-foreground shrink-0">
          {new Date(item.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      )}
    </div>
  );

  const byPerson = () => {
    const grouped = new Map<string, DelegatedItem[]>();
    items.forEach(item => {
      const key = item.assigned_to || "unassigned";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    });
    return Array.from(grouped.entries()).map(([userId, userItems]) => {
      const p = profileMap.get(userId);
      return (
        <div key={userId} className="space-y-1">
          <div className="flex items-center gap-2 py-1">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px]">{getInitials(p?.full_name || null)}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{p?.full_name || "Unknown"}</span>
            <span className="text-xs text-muted-foreground">({userItems.length})</span>
          </div>
          <div className="pl-8">{userItems.map(renderItem)}</div>
        </div>
      );
    });
  };

  const byStatus = () => {
    const order = ["todo", "not_started", "in_progress", "blocked", "done"];
    const grouped = new Map<string, DelegatedItem[]>();
    items.forEach(item => {
      if (!grouped.has(item.status)) grouped.set(item.status, []);
      grouped.get(item.status)!.push(item);
    });
    return order.filter(s => grouped.has(s)).map(status => (
      <div key={status} className="space-y-1">
        <div className="flex items-center gap-2 py-1">
          <Badge variant="outline" className={`text-[10px] ${statusColors[status] || ""}`}>
            {status.replace("_", " ")}
          </Badge>
          <span className="text-xs text-muted-foreground">({grouped.get(status)!.length})</span>
        </div>
        <div className="pl-4">{grouped.get(status)!.map(renderItem)}</div>
      </div>
    ));
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">Delegation Board</h2>
        <span className="text-xs text-muted-foreground ml-1">({items.length})</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-1">
            <Button
              variant={view === "person" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("person")}
              className="gap-1 text-xs h-7"
            >
              <Users className="h-3 w-3" /> By Person
            </Button>
            <Button
              variant={view === "status" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("status")}
              className="gap-1 text-xs h-7"
            >
              <ListFilter className="h-3 w-3" /> By Status
            </Button>
          </div>
          {items.length === 0 ? (
            <EmptyState
              icon={UserPlus2}
              title="Nothing delegated yet"
              description="When you assign a task or project to someone else, it shows up here grouped by person or status."
              card={false}
              size="sm"
            />
          ) : (
            <div className="space-y-4">
              {view === "person" ? byPerson() : byStatus()}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
