import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Video, RefreshCw, Clock, Users, FileText, ListChecks, Play, AlertCircle, Brain, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { ActionItemList } from "@/components/meetings/ActionItemList";
import { LeadershipMeetingsTab } from "@/components/meetings/LeadershipMeetingsTab";

interface Meeting {
  id: string;
  fathom_meeting_id: string | null;
  recording_id: string | null;
  title: string;
  started_at: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  fathom_url: string | null;
  transcript_text: string | null;
  summary: string | null;
  ai_insights: string | null;
  key_decisions: string[] | null;
  action_items: any[] | null;
  sentiment: string | null;
  has_external_participants: boolean | null;
  host_email: string | null;
  attendees: any[];
  synced_at: string | null;
}

interface IntelligenceActionItem {
  text: string;
  owner: string | null;
  due_date: string | null;
  status: string | null;
}

const normalizeActionItems = (items: any[] | null | undefined): IntelligenceActionItem[] => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === "string") return { text: item, owner: null, due_date: null, status: "open" };
      if (!item || typeof item !== "object") return null;
      const text = item.text || item.description || item.title || "";
      if (!text) return null;
      return {
        text: String(text),
        owner: item.owner || item.assignee || item.assignee_email || null,
        due_date: item.due_date || item.due || item.deadline || null,
        status: item.status || (item.completed ? "completed" : "open"),
      };
    })
    .filter(Boolean) as IntelligenceActionItem[];
};

const sentimentClass = (sentiment: string | null | undefined) => {
  switch (sentiment?.toLowerCase()) {
    case "positive":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "negative":
      return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300";
  }
};

function IntelligenceActionItems({ items }: { items: IntelligenceActionItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {items.map((item, index) => (
        <Card key={`${item.text}-${index}`}>
          <CardContent className="p-3 flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm">{item.text}</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {item.owner && <Badge variant="outline" className="text-[10px]">Owner: {item.owner}</Badge>}
                {item.due_date && <Badge variant="outline" className="text-[10px]">Due: {item.due_date}</Badge>}
                {item.status && <Badge variant="secondary" className="text-[10px] capitalize">{item.status}</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function MeetingsPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("leadership") || searchParams.get("tab") === "recordings" ? (searchParams.get("tab") === "recordings" ? "recordings" : "leadership") : "leadership";
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("meetings")
      .select("*")
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(100);
    if (data) {
      setMeetings(data as any);
      if (!selected && data.length > 0) setSelected(data[0] as any);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("fathom-sync", { body: {} });
      if (error) throw error;
      toast({ title: "Synced", description: `${data?.synced ?? 0} new meetings imported` });
      await load();
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const fmtDuration = (sec: number | null) => {
    if (!sec) return "—";
    const m = Math.round(sec / 60);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Video className="h-5 w-5 text-muted-foreground" /> Meetings
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Recordings & transcripts from Fathom · Structured leadership meetings</p>
        </div>
      </div>

      <Tabs defaultValue={initialTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 pt-3 border-b border-border/60">
          <TabsList>
            <TabsTrigger value="leadership">Leadership Meetings</TabsTrigger>
            <TabsTrigger value="recordings">Recordings (Fathom)</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="leadership" className="flex-1 overflow-y-auto m-0">
          <LeadershipMeetingsTab />
        </TabsContent>

        <TabsContent value="recordings" className="flex-1 overflow-hidden m-0 flex flex-col">
          <div className="px-6 py-3 border-b border-border/60 flex items-center justify-end">
            <Button size="sm" onClick={sync} disabled={syncing} variant="outline">
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", syncing && "animate-spin")} />
              {syncing ? "Syncing…" : "Sync from Fathom"}
            </Button>
          </div>
          <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* Left rail: meeting list */}
        <div className="col-span-4 border-r border-border/60 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-xs text-muted-foreground">Loading…</div>
          ) : meetings.length === 0 ? (
            <div className="p-6 text-center">
              <Video className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium">No meetings yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-3">Click "Sync from Fathom" to pull your recorded meetings.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {meetings.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelected(m)}
                  className={cn(
                    "w-full text-left p-3 hover:bg-muted/40 transition-colors",
                    selected?.id === m.id && "bg-muted/60"
                  )}
                >
                  <div className="text-sm font-medium truncate">{m.title}</div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    {m.started_at && <span>{format(new Date(m.started_at), "MMM d, h:mm a")}</span>}
                    <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {fmtDuration(m.duration_seconds)}</span>
                    {Array.isArray(m.attendees) && m.attendees.length > 0 && (
                      <span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5" /> {m.attendees.length}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right pane */}
        <div className="col-span-8 overflow-y-auto">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Select a meeting
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {(() => {
                const aiInsights = selected.ai_insights || selected.summary;
                const decisions = selected.key_decisions || [];
                const actionItems = normalizeActionItems(selected.action_items);
                const recordingUrl = selected.fathom_url || selected.recording_url;

                return (
                  <>
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold">{selected.title}</h2>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {selected.sentiment && (
                      <Badge variant="outline" className={cn("text-[10px] capitalize", sentimentClass(selected.sentiment))}>
                        {selected.sentiment}
                      </Badge>
                    )}
                    {selected.has_external_participants && (
                      <Badge variant="outline" className="text-[10px]">External</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {selected.started_at && <span>{format(new Date(selected.started_at), "EEE, MMM d, yyyy · h:mm a")}</span>}
                  <span>{fmtDuration(selected.duration_seconds)}</span>
                </div>
                {Array.isArray(selected.attendees) && selected.attendees.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {selected.attendees.map((a: any, i: number) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs bg-muted/50 px-2 py-0.5 rounded-full">
                        <Avatar className="h-4 w-4"><AvatarFallback className="text-[8px]">{(a.name || a.email || "?").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                        {a.name || a.email}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Tabs defaultValue="summary">
                <TabsList>
                  <TabsTrigger value="summary"><FileText className="h-3.5 w-3.5 mr-1" /> Summary</TabsTrigger>
                  <TabsTrigger value="actions"><ListChecks className="h-3.5 w-3.5 mr-1" /> Action items</TabsTrigger>
                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                  <TabsTrigger value="recording"><Play className="h-3.5 w-3.5 mr-1" /> Recording</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="mt-4">
                  <div className="space-y-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Brain className="h-4 w-4 text-muted-foreground" />
                          <h3 className="text-sm font-medium">AI insights</h3>
                        </div>
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          {aiInsights
                            ? aiInsights.split("\n").map((line, i) => <p key={i}>{line}</p>)
                            : <p className="text-muted-foreground text-sm">No AI insights available.</p>}
                        </div>
                      </CardContent>
                    </Card>

                    {decisions.length > 0 && (
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                            <h3 className="text-sm font-medium">Key decisions</h3>
                          </div>
                          <ul className="space-y-2">
                            {decisions.map((decision, i) => (
                              <li key={`${decision}-${i}`} className="text-sm flex gap-2">
                                <span className="text-muted-foreground">•</span>
                                <span>{decision}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="actions" className="mt-4">
                  {actionItems.length > 0 ? (
                    <IntelligenceActionItems items={actionItems} />
                  ) : (
                    <ActionItemList meetingId={selected.id} />
                  )}
                </TabsContent>

                <TabsContent value="transcript" className="mt-4">
                  <Card>
                    <CardContent className="p-4">
                      {selected.transcript_text ? (
                        <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed max-h-[60vh] overflow-y-auto">
                          {selected.transcript_text}
                        </pre>
                      ) : (
                        <p className="text-muted-foreground text-sm">No transcript available.</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="recording" className="mt-4">
                  <Card>
                    <CardContent className="p-4">
                      {recordingUrl ? (
                        <a
                          href={recordingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <Play className="h-4 w-4" /> Open recording in Fathom
                        </a>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <AlertCircle className="h-4 w-4" /> No recording URL available.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
                  </>
                );
              })()}
            </div>
          )}
        </div>
        </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
