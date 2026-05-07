import { useEffect, useState } from "react";
import { Sparkles, CheckCircle2, Clock, AlertCircle, Play, Users, Activity, Terminal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

// ClawBuddy API config
const CLAWBUDDY_API = "https://hwxidgvttafaijtldnjq.supabase.co/functions/v1/clawbuddy-api";
const CLAWBUDDY_SECRET = "b2d09852bd7d5e39f9ce6bfafd23bf1bdae9ec709b4882905ffb82b1822a4376";
const CLAWBUDDY_USER_ID = "ac4d5b08-0fd4-495a-8885-b14a1375b3b2";

interface Task {
  id: string;
  title: string;
  board_column_id: string;
  priority: string;
  created_at: string;
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  status: string;
  current_activity: string;
}

interface LogEntry {
  id: string;
  message: string;
  category: string;
  agent_name: string;
  agent_emoji: string;
  created_at: string;
}

const columnNames: Record<string, string> = {
  "69be5921-c6ae-405a-93e1-ba870f7ef2fd": "To Do",
  "beb7e44f-4172-4e71-a0e2-488303c50380": "Doing",
  "5082722a-835b-4655-a988-18c655545c13": "Needs Input",
  "b7564c72-3f37-4ad7-a6db-9bb83e97474e": "Done",
  "4f5dea45-51f2-47c4-b792-ef8b2ec8dd5a": "Canceled",
};

const columnColors: Record<string, string> = {
  "To Do": "bg-red-100 text-red-800",
  "Doing": "bg-yellow-100 text-yellow-800",
  "Needs Input": "bg-purple-100 text-purple-800",
  "Done": "bg-green-100 text-green-800",
  "Canceled": "bg-gray-100 text-gray-800",
};

export default function AiHubPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("tasks");

  const fetchClawBuddy = async () => {
    setLoading(true);
    try {
      // Fetch tasks
      const tasksRes = await fetch(`${CLAWBUDDY_API}/tasks?user_id=${CLAWBUDDY_USER_ID}`, {
        headers: {
          "x-clawbuddy-secret": CLAWBUDDY_SECRET,
          "x-user-id": CLAWBUDDY_USER_ID,
        },
      });
      const tasksData = await tasksRes.json();
      setTasks(tasksData.tasks || []);

      // Fetch agents
      const agentsRes = await fetch(`${CLAWBUDDY_API}/agents?user_id=${CLAWBUDDY_USER_ID}`, {
        headers: {
          "x-clawbuddy-secret": CLAWBUDDY_SECRET,
          "x-user-id": CLAWBUDDY_USER_ID,
        },
      });
      const agentsData = await agentsRes.json();
      setAgents(agentsData.agents || []);

      // Fetch recent logs
      const logsRes = await fetch(`${CLAWBUDDY_API}/logs?user_id=${CLAWBUDDY_USER_ID}`, {
        headers: {
          "x-clawbuddy-secret": CLAWBUDDY_SECRET,
          "x-user-id": CLAWBUDDY_USER_ID,
        },
      });
      const logsData = await logsRes.json();
      setLogs(logsData.logs?.slice(0, 20) || []);
    } catch (err) {
      console.error("Error fetching ClawBuddy data:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClawBuddy();
  }, []);

  const getColumnName = (id: string) => columnNames[id] || "Unknown";
  const getColumnColor = (id: string) => {
    const name = columnNames[id] || "Unknown";
    return columnColors[name] || "bg-gray-100";
  };

  const todoTasks = tasks.filter((t) => getColumnName(t.board_column_id) === "To Do");
  const doingTasks = tasks.filter((t) => getColumnName(t.board_column_id) === "Doing");
  const doneTasks = tasks.filter((t) => getColumnName(t.board_column_id) === "Done");

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> AI Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            ClawBuddy task board + agent status
          </p>
        </div>
        <Button onClick={fetchClawBuddy} variant="outline" size="sm">
          <Activity className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Clock className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todoTasks.length}</p>
                <p className="text-xs text-muted-foreground">To Do</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Play className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{doingTasks.length}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{doneTasks.length}</p>
                <p className="text-xs text-muted-foreground">Done</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{agents.length}</p>
                <p className="text-xs text-muted-foreground">Active Agents</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          {loading ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Loading tasks...
              </CardContent>
            </Card>
          ) : tasks.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No tasks found. Create one in ClawBuddy dashboard.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {["To Do", "Doing", "Done"].map((col) => {
                const colTasks = tasks.filter(
                  (t) => getColumnName(t.board_column_id) === col
                );
                return (
                  <Card key={col}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        {col}
                        <Badge variant="secondary">{colTasks.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {colTasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors cursor-pointer"
                        >
                          <p className="font-medium text-sm">{task.title}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge
                              variant="outline"
                              className="text-xs"
                            >
                              {task.priority}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="agents" className="mt-4">
          {loading ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Loading agents...
              </CardContent>
            </Card>
          ) : agents.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No agents configured. Add agents in ClawBuddy dashboard.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <Card key={agent.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{agent.emoji}</div>
                      <div className="flex-1">
                        <p className="font-medium">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {agent.current_activity || "Idle"}
                        </p>
                      </div>
                      <Badge
                        variant={agent.status === "active" ? "default" : "secondary"}
                      >
                        {agent.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          {loading ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Loading activity...
              </CardContent>
            </Card>
          ) : logs.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No activity logs yet.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className="text-lg">{log.agent_emoji}</div>
                    <div className="flex-1">
                      <p className="text-sm">{log.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {log.agent_name}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {log.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}