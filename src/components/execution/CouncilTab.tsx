import { useEffect, useState } from "react";
import { Loader2, MessageCircle, Plus, Send, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format, parseISO, formatDistanceToNow } from "date-fns";

type CouncilStatus = "running" | "done" | "failed" | "cancelled";
type Priority = "low" | "normal" | "high" | "urgent";
type Status = "backlog" | "pending" | "doing" | "review" | "approved" | "needs_input" | "done" | "cancelled";
type ParticipantKind = "agent" | "human";

interface CouncilParticipant {
  id: string | null;
  key: string;
  name: string;
  emoji: string | null;
  subtitle: string | null;
  accent_color: string | null;
  position: number;
  kind?: ParticipantKind; // absent on old sessions created before humans-in-council; treat as "agent"
}

interface CouncilSession {
  id: string;
  question: string;
  status: CouncilStatus;
  participants: CouncilParticipant[] | null;
  workspace_id: string | null;
  created_at: string;
}

interface CouncilMessage {
  id: string;
  session_id: string;
  agent_id: string | null;
  agent_name: string;
  agent_emoji: string | null;
  body: string;
  position: number;
  created_at: string;
}

interface Agent {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  avatar_url: string | null;
  subtitle: string | null;
  role: string | null;
  status: string;
  accent_color: string | null;
}

interface HumanProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export type CouncilAgent = {
  key: string;
  agent_id: string | null;
  name: string;
  subtitle: string | null;
  emoji: string | null;
  avatar_url: string | null;
  status: string;
  accent_color: string | null;
};

const AVATAR_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#06b6d4", "#f43f5e", "#a78bfa", "#34d399", "#60a5fa"];
const colorFor = (s: string) => AVATAR_COLORS[Math.abs(s.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length];
const initials = (name: string) => name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

const STATUS_DOT: Record<string, string> = {
  active: "bg-green-400", idle: "bg-yellow-400", offline: "bg-slate-400", error: "bg-red-400", online: "bg-green-400",
};

function AgentAvatar({ agent, size = "sm" }: { agent: CouncilAgent | undefined; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
  if (!agent) return (
    <span className={`flex items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground ${sz}`}>?</span>
  );
  if (agent.avatar_url) return (
    <img src={agent.avatar_url} alt={agent.name} className={`rounded-full object-cover ${sz}`} />
  );
  const bg = agent.accent_color ?? colorFor(agent.name);
  return (
    <span className={`flex items-center justify-center rounded-full font-semibold text-white ${sz}`} style={{ background: bg }}>
      {agent.emoji ?? initials(agent.name)}
    </span>
  );
}

// Strip raw tool call XML from PM2 worker results
const cleanResult = (raw: string) =>
  raw.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
     .replace(/<tool_response>[\s\S]*?<\/tool_response>/g, "")
     .replace(/^\s*\n/gm, "")
     .trim();

const COUNCIL_STATUS_BADGE: Record<CouncilStatus, string> = {
  running: "bg-blue-100 text-blue-800 border-blue-200",
  done: "bg-green-100 text-green-800 border-green-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
};

const orderedParticipants = (session: CouncilSession | null) =>
  [...(session?.participants ?? [])].sort((a, b) => a.position - b.position);

/**
 * Drives the council sequence forward starting at `fromPosition`: invokes
 * jr-coder-worker for each agent position in turn (awaiting completion,
 * matching how this already worked for all-agent councils), and stops the
 * moment it reaches a human position — just making sure that position's
 * agent_tasks row is "pending" so the UI can detect it's their turn and
 * show the reply composer. Reaching the end with no human in the way marks
 * the session done. Used both at council creation (fromPosition 0) and
 * after a human submits their turn (fromPosition = their position + 1).
 * Does not touch jr-coder-worker or council-advance.
 */
async function driveCouncilFrom(sessionId: string, participants: CouncilParticipant[], fromPosition: number) {
  const sorted = [...participants].sort((a, b) => a.position - b.position);
  for (const participant of sorted) {
    if (participant.position < fromPosition) continue;

    const { data: taskRow } = await supabase
      .from("agent_tasks")
      .select("*")
      .eq("context->>council_session_id", sessionId)
      .eq("context->>council_position", String(participant.position))
      .limit(1)
      .maybeSingle();
    if (!taskRow) continue;

    if ((participant.kind ?? "agent") === "human") {
      if (taskRow.status !== "pending") {
        await supabase.from("agent_tasks").update({ status: "pending" }).eq("id", taskRow.id);
      }
      return; // wait for the human to respond
    }

    const { error } = await supabase.functions.invoke("jr-coder-worker", {
      body: { type: "UPDATE", record: { ...taskRow, status: "pending" }, old_record: null },
    });
    if (error) {
      console.warn("[Council] worker invocation failed:", error.message);
      await supabase.from("council_sessions").update({ status: "failed" }).eq("id", sessionId);
      return;
    }
  }
  // Walked off the end without stopping at a human — everyone's responded.
  await supabase.from("council_sessions").update({ status: "done" }).eq("id", sessionId);
}

/**
 * Self-contained Council surface: fetches its own sessions/messages/agents,
 * manages selection, and renders the thread list + thread view + "New" dialog.
 * Drop in anywhere (Execution Hub Council tab, or the legacy AI Hub) without
 * the host page needing to manage council state.
 */
export function CouncilPanel() {
  const [agents, setAgents] = useState<CouncilAgent[]>([]);
  const [profiles, setProfiles] = useState<HumanProfile[]>([]);
  const [sessions, setSessions] = useState<CouncilSession[]>([]);
  const [messages, setMessages] = useState<CouncilMessage[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [newCouncilOpen, setNewCouncilOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    const [agentsRes, profilesRes, sessionsRes, messagesRes] = await Promise.all([
      supabase.from("agents").select("id,name,slug,emoji,avatar_url,subtitle,role,status,accent_color").order("position"),
      supabase.from("profiles").select("user_id, full_name, avatar_url"),
      supabase.from("council_sessions").select("*").order("created_at", { ascending: false }),
      supabase.from("council_messages").select("*").order("position", { ascending: true }).order("created_at", { ascending: true }),
    ]);
    if (agentsRes.data) {
      setAgents((agentsRes.data as Agent[]).map(a => ({
        key: a.slug, agent_id: a.id, name: a.name, subtitle: a.subtitle ?? a.role, emoji: a.emoji,
        avatar_url: a.avatar_url, status: a.status, accent_color: a.accent_color,
      })));
    }
    if (profilesRes.data) setProfiles(profilesRes.data as HumanProfile[]);
    if (sessionsRes.data) {
      const rows = sessionsRes.data as CouncilSession[];
      setSessions(rows);
      setSelectedSessionId(current => current ?? rows[0]?.id ?? null);
    }
    if (messagesRes.data) setMessages(messagesRes.data as CouncilMessage[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("council-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "council_sessions" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "council_messages" }, fetchAll)
      .subscribe();
    const poll = setInterval(fetchAll, 5000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>;
  }

  return (
    <>
      <CouncilTab
        sessions={sessions}
        messages={messages}
        agents={agents}
        selectedSessionId={selectedSessionId}
        onSelectSession={setSelectedSessionId}
        onCreateCouncil={() => setNewCouncilOpen(true)}
        onRefresh={fetchAll}
      />
      <NewCouncilDialog
        open={newCouncilOpen}
        onOpenChange={setNewCouncilOpen}
        agents={agents}
        profiles={profiles}
        onCreated={(sessionId) => { setSelectedSessionId(sessionId); fetchAll(); }}
      />
    </>
  );
}

export const CouncilTab = ({
  sessions, messages, agents, selectedSessionId, onSelectSession, onCreateCouncil, onRefresh,
}: {
  sessions: CouncilSession[];
  messages: CouncilMessage[];
  agents: CouncilAgent[];
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateCouncil: () => void;
  onRefresh?: () => void;
}) => {
  const selectedSession = sessions.find(s => s.id === selectedSessionId) ?? sessions[0] ?? null;
  const selectedMessages = selectedSession
    ? messages.filter(m => m.session_id === selectedSession.id).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
    : [];
  const participants = orderedParticipants(selectedSession);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4">
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-sm font-semibold">Council Sessions</p>
              <p className="text-xs text-muted-foreground">{sessions.length} thread{sessions.length === 1 ? "" : "s"}</p>
            </div>
            <Button size="sm" onClick={onCreateCouncil}>
              <Plus className="h-4 w-4 mr-2" /> New
            </Button>
          </div>

          {sessions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 p-5 text-center">
              <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No council threads yet</p>
              <p className="text-xs text-muted-foreground mt-1">Ask a question and route it through multiple agents — or people.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[68vh] overflow-y-auto pr-1">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    selectedSession?.id === session.id ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium line-clamp-2">{session.question}</p>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] capitalize ${COUNCIL_STATUS_BADGE[session.status]}`}>
                      {session.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>{(session.participants ?? []).length} participants</span>
                    <span className="ml-auto">{formatDistanceToNow(parseISO(session.created_at), { addSuffix: true })}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          {!selectedSession ? (
            <div className="min-h-[420px] flex items-center justify-center text-center">
              <div>
                <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Start a council</p>
                <p className="text-xs text-muted-foreground mt-1">Select agents (or people), ask one question, and watch the thread fill in order.</p>
                <Button size="sm" className="mt-4" onClick={onCreateCouncil}>
                  <Plus className="h-4 w-4 mr-2" /> New Council
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] capitalize ${COUNCIL_STATUS_BADGE[selectedSession.status]}`}>
                      {selectedSession.status}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold leading-snug">{selectedSession.question}</h2>
                  <p className="text-xs text-muted-foreground mt-2">
                    Created {format(parseISO(selectedSession.created_at), "MMM d, h:mm a")}
                  </p>
                </div>
                <div className="hidden md:flex items-center -space-x-2 shrink-0">
                  {participants.map(participant => {
                    const agent = agents.find(a => a.key === participant.key);
                    return (
                      <div key={participant.key} className="ring-2 ring-background rounded-full">
                        <AgentAvatar agent={agent ?? {
                          key: participant.key, agent_id: participant.id, name: participant.name,
                          subtitle: participant.subtitle, emoji: participant.emoji, avatar_url: null,
                          status: "active", accent_color: participant.accent_color,
                        }} />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4 max-h-[64vh] overflow-y-auto pr-2">
                {participants.map((participant, idx) => {
                  const message = selectedMessages.find(m => m.position === participant.position);
                  const agent = agents.find(a => a.key === participant.key);
                  const isHuman = (participant.kind ?? "agent") === "human";
                  const isCurrentTurn = !message && participants
                    .slice(0, idx)
                    .every(p => selectedMessages.some(m => m.position === p.position));
                  return (
                    <div key={`${selectedSession.id}-${participant.key}`} className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        <AgentAvatar agent={agent ?? {
                          key: participant.key, agent_id: participant.id, name: participant.name,
                          subtitle: participant.subtitle, emoji: participant.emoji, avatar_url: null,
                          status: message ? "active" : "idle", accent_color: participant.accent_color,
                        }} size="md" />
                        {!message && !isHuman && selectedSession.status === "running" && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-yellow-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{participant.name}</p>
                          {participant.subtitle && <p className="text-xs text-muted-foreground">{participant.subtitle}</p>}
                          {message && (
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(parseISO(message.created_at), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                        {message ? (
                          <div className="mt-2 rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {cleanResult(message.body)}
                          </div>
                        ) : isHuman && isCurrentTurn && selectedSession.status === "running" ? (
                          <HumanTurnComposer
                            sessionId={selectedSession.id}
                            participant={participant}
                            participants={participants}
                            onSubmitted={onRefresh}
                          />
                        ) : (
                          <div className="mt-2 rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                            {isHuman ? "Waiting for their turn." : "Waiting for this agent's turn."}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const HumanTurnComposer = ({
  sessionId, participant, participants, onSubmitted,
}: {
  sessionId: string;
  participant: CouncilParticipant;
  participants: CouncilParticipant[];
  onSubmitted?: () => void;
}) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setSending(true);

    const { error: msgError } = await supabase.from("council_messages").insert({
      session_id: sessionId,
      agent_id: null,
      agent_name: participant.name,
      agent_emoji: participant.emoji,
      body: text.trim(),
      position: participant.position,
    });
    if (msgError) {
      toast({ title: "Couldn't send", description: msgError.message, variant: "destructive" });
      setSending(false);
      return;
    }

    const { data: taskRow } = await supabase
      .from("agent_tasks")
      .select("id")
      .eq("context->>council_session_id", sessionId)
      .eq("context->>council_position", String(participant.position))
      .limit(1)
      .maybeSingle();
    if (taskRow) {
      await supabase.from("agent_tasks").update({ status: "done" }).eq("id", taskRow.id);
    }

    onSubmitted?.();
    void driveCouncilFrom(sessionId, participants, participant.position + 1);
    setText("");
    setSending(false);
  };

  return (
    <div className="mt-2 space-y-2">
      <Textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Your turn — add your input…"
        rows={3}
        disabled={sending}
        className="text-sm"
        autoFocus
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={sending || !text.trim()}>
          {sending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
          Send
        </Button>
      </div>
    </div>
  );
};

export const NewCouncilDialog = ({
  open, onOpenChange, agents, profiles = [], onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agents: CouncilAgent[];
  profiles?: HumanProfile[];
  onCreated: (sessionId: string) => void;
}) => {
  const [question, setQuestion] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && selectedKeys.length === 0 && agents.length > 0) {
      setSelectedKeys(agents.slice(0, 3).map(a => a.key));
    }
  }, [open, agents, selectedKeys.length]);

  const reset = () => {
    setQuestion("");
    setSelectedKeys(agents.slice(0, 3).map(a => a.key));
  };

  const toggleKey = (key: string) => {
    setSelectedKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const sortedProfiles = [...profiles].sort((a, b) => (a.full_name || "Unknown").localeCompare(b.full_name || "Unknown"));
  const sortedAgents = [...agents].sort((a, b) => a.name.localeCompare(b.name));

  const create = async () => {
    const selectedParticipants: CouncilParticipant[] = selectedKeys
      .map((key, index) => {
        const agent = agents.find(a => a.key === key);
        if (agent) {
          return {
            id: agent.agent_id, key: agent.key, name: agent.name, emoji: agent.emoji,
            subtitle: agent.subtitle, accent_color: agent.accent_color, position: index, kind: "agent" as const,
          };
        }
        const profile = profiles.find(p => p.user_id === key);
        if (profile) {
          return {
            id: null, key: profile.user_id, name: profile.full_name || "Unknown", emoji: null,
            subtitle: "Team member", accent_color: null, position: index, kind: "human" as const,
          };
        }
        return null;
      })
      .filter(Boolean) as CouncilParticipant[];

    if (!question.trim() || selectedParticipants.length === 0) return;

    setSaving(true);
    const { data: session, error: sessionError } = await supabase
      .from("council_sessions")
      .insert({
        question: question.trim(),
        status: "running",
        participants: selectedParticipants,
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      toast({ title: "Council failed", description: sessionError?.message ?? "Session was not created.", variant: "destructive" });
      setSaving(false);
      return;
    }

    const taskRows = selectedParticipants.map(participant => ({
      title: `Council: ${question.trim().slice(0, 90)}`,
      description: `Council question:\n${question.trim()}\n\nRespond as ${participant.name}. Your response will be shown in a shared council thread.`,
      assigned_to: participant.key,
      priority: "normal" as Priority,
      status: participant.position === 0 ? "pending" as Status : "backlog" as Status,
      type: "decision",
      created_by: "human",
      context: {
        council_session_id: session.id,
        council_position: participant.position,
        council_participant_count: selectedParticipants.length,
        council_question: question.trim(),
      },
    }));

    const { error: tasksError } = await supabase.from("agent_tasks").insert(taskRows);

    if (tasksError) {
      await supabase.from("council_sessions").update({ status: "failed" }).eq("id", session.id);
      toast({ title: "Council tasks failed", description: tasksError.message, variant: "destructive" });
    } else {
      toast({ title: "Council started", description: `${selectedParticipants.length} participants queued.` });
      void driveCouncilFrom(session.id, selectedParticipants, 0);
      reset();
      onOpenChange(false);
      onCreated(session.id);
    }

    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Council</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Question</Label>
            <Textarea
              autoFocus
              rows={4}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="What should the council weigh in on?"
            />
          </div>

          <div className="space-y-2">
            <Label>Participants</Label>
            <div className="rounded-lg border border-border divide-y max-h-72 overflow-y-auto">
              {sortedProfiles.length > 0 && <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/40">People</div>}
              {sortedProfiles.map(p => (
                <button
                  key={p.user_id}
                  type="button"
                  onClick={() => toggleKey(p.user_id)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/60 transition-colors"
                >
                  <Checkbox checked={selectedKeys.includes(p.user_id)} className="pointer-events-none" />
                  <AgentAvatar agent={{ key: p.user_id, agent_id: null, name: p.full_name || "Unknown", subtitle: "Team member", emoji: null, avatar_url: p.avatar_url, status: "online", accent_color: null }} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{p.full_name || "Unknown"}</p>
                  </div>
                  {selectedKeys.includes(p.user_id) && (
                    <span className="text-xs font-mono text-muted-foreground">#{selectedKeys.indexOf(p.user_id) + 1}</span>
                  )}
                </button>
              ))}
              {sortedAgents.length > 0 && <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/40">AI agents</div>}
              {sortedAgents.length === 0 && sortedProfiles.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No agents or people are available.</p>
              ) : sortedAgents.map(agent => (
                <button
                  key={agent.key}
                  type="button"
                  onClick={() => toggleKey(agent.key)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/60 transition-colors"
                >
                  <Checkbox checked={selectedKeys.includes(agent.key)} className="pointer-events-none" />
                  <AgentAvatar agent={agent} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{agent.name}</p>
                    {agent.subtitle && <p className="text-xs text-muted-foreground truncate">{agent.subtitle}</p>}
                  </div>
                  {selectedKeys.includes(agent.key) && (
                    <span className="text-xs font-mono text-muted-foreground">#{selectedKeys.indexOf(agent.key) + 1}</span>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Everyone responds in the order selected — people get an inline reply box on their turn.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={create} disabled={!question.trim() || selectedKeys.length === 0 || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Start Council
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
