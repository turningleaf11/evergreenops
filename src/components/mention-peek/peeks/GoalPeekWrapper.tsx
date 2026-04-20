import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import GoalPeek from "@/components/execution/GoalPeek";
import { supabase } from "@/integrations/supabase/client";

interface Props { id: string; open: boolean; onClose: () => void; }

export default function GoalPeekWrapper({ id, open, onClose }: Props) {
  const navigate = useNavigate();
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [{ data: projects }, { data: profiles }] = await Promise.all([
      supabase.from("projects").select("id, title, goal_id, status, owner_id, due_date"),
      supabase.from("profiles").select("user_id, full_name"),
    ]);
    setAllProjects(projects || []);
    const map: Record<string, string> = {};
    (profiles || []).forEach((p: any) => { map[p.user_id] = p.full_name || "Unknown"; });
    setProfilesMap(map);
  }, []);

  useEffect(() => { if (open && id) load(); }, [open, id, load]);

  if (!open || !id) return null;

  return (
    <GoalPeek
      goalId={id}
      onClose={onClose}
      allProjects={allProjects}
      getName={(uid) => uid ? (profilesMap[uid] || "Unknown") : "Unassigned"}
      onChanged={load}
      onOpenProject={(pid) => { onClose(); navigate(`/projects/${pid}`); }}
    />
  );
}
