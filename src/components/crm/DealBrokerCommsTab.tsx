import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

interface FeedbackEntry {
  id: string;
  body: string;
  occurred_at: string;
}

export function DealBrokerCommsTab({
  dealId,
  workspaceId,
  initialFeedback,
  initialEntries,
  onChanged,
}: {
  dealId: string;
  workspaceId: string | null;
  initialFeedback: string | null;
  initialEntries: FeedbackEntry[];
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<FeedbackEntry[]>(initialEntries);

  const submit = async () => {
    if (!draft.trim() || !user) return;
    setSaving(true);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("crm_activities")
      .insert({
        workspace_id: workspaceId,
        entity_type: "deal",
        entity_id: dealId,
        type: "broker_feedback",
        subject: "Broker feedback",
        body: draft.trim(),
        actor_id: user.id,
        occurred_at: now,
      })
      .select("id, body, occurred_at")
      .single();

    if (error) {
      setSaving(false);
      toast({ title: "Couldn't log", description: error.message, variant: "destructive" });
      return;
    }

    const newEntry = data as FeedbackEntry;
    const merged = [
      `[${new Date(now).toLocaleString()}] ${draft.trim()}`,
      initialFeedback?.trim() || "",
    ]
      .filter(Boolean)
      .join("\n\n");

    await supabase.from("deals").update({ broker_feedback: merged } as any).eq("id", dealId);

    setEntries((prev) => [newEntry, ...prev]);
    setDraft("");
    setSaving(false);
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/50 bg-card p-3 space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Log broker feedback (call notes, email summary, price guidance, etc.)…"
          rows={3}
          className="resize-none"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} disabled={!draft.trim() || saving}>
            {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
            Log feedback
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-6">
          No broker feedback logged yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="rounded-lg border border-border/40 bg-card p-3 text-sm">
              <div className="text-[11px] text-muted-foreground mb-1">
                {formatDistanceToNow(new Date(e.occurred_at), { addSuffix: true })} ·{" "}
                {new Date(e.occurred_at).toLocaleString()}
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{e.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
