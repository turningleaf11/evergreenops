import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Plus, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Poll {
  id: string;
  title: string;
  description: string;
  options: string[];
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

interface PollVote {
  id: string;
  poll_id: string;
  user_id: string;
  option_index: number;
}

export function TeamPolls() {
  const { user, isAdmin } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<PollVote[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const fetchData = useCallback(async () => {
    const [pollsRes, votesRes] = await Promise.all([
      supabase.from("polls").select("*").eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("poll_votes").select("*"),
    ]);
    if (pollsRes.data) setPolls(pollsRes.data as any as Poll[]);
    if (votesRes.data) setVotes(votesRes.data as any as PollVote[]);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createPoll = async () => {
    if (!user || !title.trim()) { toast.error("Add a title"); return; }
    const validOptions = options.filter(o => o.trim());
    if (validOptions.length < 2) { toast.error("Add at least 2 options"); return; }
    const { error } = await supabase.from("polls").insert({
      title: title.trim(),
      options: validOptions as any,
      created_by: user.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Poll created!");
    setCreateOpen(false);
    setTitle("");
    setOptions(["", ""]);
    fetchData();
  };

  const vote = async (pollId: string, optionIndex: number) => {
    if (!user) return;
    const existing = votes.find(v => v.poll_id === pollId && v.user_id === user.id);
    if (existing) {
      await supabase.from("poll_votes").update({ option_index: optionIndex }).eq("id", existing.id);
    } else {
      await supabase.from("poll_votes").insert({ poll_id: pollId, user_id: user.id, option_index: optionIndex });
    }
    fetchData();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Team Polls
        </h2>
        {isAdmin && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3 w-3 mr-1" /> New Poll
          </Button>
        )}
      </div>

      {polls.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No active polls</CardContent></Card>
      ) : (
        polls.map(poll => {
          const pollVotes = votes.filter(v => v.poll_id === poll.id);
          const totalVotes = pollVotes.length;
          const myVote = pollVotes.find(v => v.user_id === user?.id);

          return (
            <Card key={poll.id}>
              <CardContent className="p-4 space-y-3">
                <p className="font-medium text-sm">{poll.title}</p>
                <div className="space-y-2">
                  {(poll.options as string[]).map((opt, i) => {
                    const optVotes = pollVotes.filter(v => v.option_index === i).length;
                    const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                    const isMyVote = myVote?.option_index === i;
                    return (
                      <button
                        key={i}
                        onClick={() => vote(poll.id, i)}
                        className={`w-full text-left p-2 rounded-lg border transition-colors ${isMyVote ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            {isMyVote && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                            <span className="text-sm">{opt}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create Poll</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Question</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="What should we..." className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Options</label>
              {options.map((opt, i) => (
                <div key={i} className="flex gap-1 mt-1">
                  <Input
                    value={opt}
                    onChange={e => { const next = [...options]; next[i] = e.target.value; setOptions(next); }}
                    placeholder={`Option ${i + 1}`}
                  />
                  {options.length > 2 && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setOptions(options.filter((_, j) => j !== i))}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
              {options.length < 6 && (
                <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={() => setOptions([...options, ""])}>
                  <Plus className="h-3 w-3 mr-1" /> Add Option
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createPoll}>Create Poll</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
