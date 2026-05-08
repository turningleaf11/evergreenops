import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";

interface AgentTask {
  id: string;
  title: string;
  description: string;
  assigned_to: string | null;
  status: string;
  priority: string;
  created_at: string;
  result?: string;
}

interface Agent {
  id: string;
  name: string;
  title: string;
  emoji: string;
  status: string; // e.g. "active", "idle"
  status_color: string; // hex or css class
  avatar_url?: string;
}

export default function AiHubAgentTasksPage() {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    // Fetch tasks
    const { data: taskData, error: taskError } = await supabase
      .from("agent_tasks")
      .select("*")
      .order("created_at", { ascending: false });
    // Fetch agents (users/agents)
    const { data: agentData, error: agentError } = await supabase
      .from("agents")
      .select("id, name, title, emoji, status, status_color, avatar_url");
    if (taskError) console.error("Task fetch error", taskError);
    if (agentError) console.error("Agent fetch error", agentError);
    setTasks(taskData as AgentTask[]);
    setAgents(agentData as Agent[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const assignTask = async (taskId: string, agentId: string) => {
    const { error } = await supabase
      .from("agent_tasks")
      .update({ assigned_to: agentId })
      .eq("id", taskId);
    if (error) console.error("Assign error", error);
    // Refresh locally
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, assigned_to: agentId } : t))
    );
  };

  const getAgent = (id: string | null) => agents.find((a) => a.id === id);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Agent Tasks</h1>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : tasks.length === 0 ? (
        <p className="text-muted-foreground">No tasks found.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => {
            const agent = getAgent(task.assigned_to);
            return (
              <Card key={task.id} className="flex flex-col h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium truncate">
                    {task.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                    {task.description}
                  </p>
                  {/* Agent avatar / assign dropdown */}
                  <div className="mt-auto flex items-center justify-between">
                    {agent ? (
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-6 w-6">
                          {agent.avatar_url ? (
                            <AvatarImage src={agent.avatar_url} alt={agent.name} />
                          ) : null}
                          <AvatarFallback>{agent.emoji}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs font-medium">{agent.name}</p>
                          <p className="text-xs text-muted-foreground">{agent.title}</p>
                        </div>
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: agent.status_color }}
                        ></span>
                      </div>
                    ) : (
                      <Badge variant="outline">Unassigned</Badge>
                    )}
                    <Select onValueChange={(val) => assignTask(task.id, val)}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Assign" />
                      </SelectTrigger>
                      <SelectContent>
                        {agents.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            <div className="flex items-center space-x-2">
                              <Avatar className="h-5 w-5">
                                {a.avatar_url ? (
                                  <AvatarImage src={a.avatar_url} alt={a.name} />
                                ) : null}
                                <AvatarFallback>{a.emoji}</AvatarFallback>
                              </Avatar>
                              <span>{a.name}</span>
                              <span className="text-xs text-muted-foreground">{a.title}</span>
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ backgroundColor: a.status_color }}
                              ></span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
