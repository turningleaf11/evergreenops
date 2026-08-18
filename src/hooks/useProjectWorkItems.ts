import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AgentMeta } from "@/components/execution/CreateEntityDialog";

export type WorkItemKind = "task" | "agent_task";

// Single source of truth for "what work belongs to this project" — tasks and
// agent_tasks merged into one list, tagged with the table each row came
// from. Every view (List, Board, Calendar, Timeline, or anything added
// later) reads `items` and calls these same mutators; none of them need to
// know which table a row lives in.
export function useProjectWorkItems(projectId: string | undefined) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [agentTasks, setAgentTasks] = useState<any[]>([]);
  const [agents, setAgents] = useState<AgentMeta[]>([]);
  const [repos, setRepos] = useState<{ slug: string; name: string; github_repo: string }[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!projectId) return;
    const [tRes, atRes, agRes, rRes, prRes] = await Promise.all([
      supabase.from("tasks").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("agent_tasks").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("agents").select("slug, name, emoji, avatar_url, accent_color"),
      supabase.from("repos").select("slug, name, github_repo").eq("active", true),
      supabase.from("profiles").select("user_id, full_name"),
    ]);
    if (tRes.data) setTasks(tRes.data);
    if (atRes.data) setAgentTasks(atRes.data);
    if (agRes.data) setAgents(agRes.data as AgentMeta[]);
    if (rRes.data) setRepos(rRes.data);
    if (prRes.data) setProfiles(prRes.data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const items = [
    ...tasks.map((t) => ({ ...t, _kind: "task" as const })),
    ...agentTasks.map((a) => ({ ...a, _kind: "agent_task" as const })),
  ];

  const getAssigneeName = useCallback((uid: string | null) => {
    if (!uid) return "Unassigned";
    const agent = agents.find((a) => a.slug === uid);
    if (agent) return agent.name;
    return profiles.find((p) => p.user_id === uid)?.full_name || "Unknown";
  }, [agents, profiles]);

  const tableFor = useCallback(
    (id: string) => (items.find((i) => i.id === id)?._kind === "agent_task" ? "agent_tasks" : "tasks"),
    [items],
  );

  const updateStatus = useCallback(async (id: string, status: string) => {
    const { error } = await supabase.from(tableFor(id)).update({ status }).eq("id", id);
    if (error) toast.error(error.message); else fetchItems();
  }, [tableFor, fetchItems]);

  const updateFields = useCallback(async (id: string, patch: Record<string, any>) => {
    const { error } = await supabase.from(tableFor(id)).update(patch).eq("id", id);
    if (error) toast.error(error.message); else fetchItems();
  }, [tableFor, fetchItems]);

  // Assignee decides the table: an agent slug goes to agent_tasks, a person
  // goes to tasks.
  const createItem = useCallback(async (data: {
    title: string; description?: string; assigned_to?: string;
    agent_type?: string; agent_repo?: string;
  }, createdBy: string | undefined) => {
    const isAgent = agents.some((a) => a.slug === data.assigned_to);
    if (isAgent) {
      const { error } = await supabase.from("agent_tasks").insert({
        title: data.title,
        description: data.description || data.title,
        assigned_to: data.assigned_to,
        type: data.agent_type || "general",
        repo: data.agent_repo || null,
        project_id: projectId,
        status: "backlog",
        priority: "normal",
        created_by: "human",
      } as any);
      if (error) toast.error(error.message);
      else { toast.success("AI task created"); fetchItems(); }
      return;
    }
    const { error } = await supabase.from("tasks").insert({
      title: data.title, project_id: projectId, description: data.description,
      assigned_to: data.assigned_to || createdBy, created_by: createdBy,
    });
    if (error) toast.error(error.message);
    else { toast.success("Task created"); fetchItems(); }
  }, [agents, projectId, fetchItems]);

  return {
    items, tasks, agents, repos, profiles, loading,
    getAssigneeName, updateStatus, updateFields, createItem, refetch: fetchItems,
  };
}
