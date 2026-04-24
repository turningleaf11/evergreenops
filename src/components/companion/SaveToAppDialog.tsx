import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollText, Lightbulb, Target, Flag, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type SaveDestination = "decision_log" | "idea_vault" | "strategy_item" | "goal";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** The full assistant message content */
  content: string;
  /** ai_strategy_messages id, used to mark which message was saved */
  messageId: string | null;
  onSaved: (dest: SaveDestination, savedId: string) => void;
}

const DESTS: { id: SaveDestination; label: string; icon: any; description: string }[] = [
  { id: "decision_log", label: "Decision Log", icon: ScrollText, description: "Capture as a decision with rationale" },
  { id: "idea_vault", label: "Idea Vault", icon: Lightbulb, description: "Park as an idea to develop later" },
  { id: "strategy_item", label: "Strategy Item", icon: Flag, description: "Push down as a strategy item to the team" },
  { id: "goal", label: "Goal / Rock", icon: Target, description: "Promote into a quarterly goal" },
];

function deriveTitle(text: string): string {
  const firstLine = text.split("\n").find((l) => l.trim()) || "";
  return firstLine.replace(/^[#>*\-\d.\s]+/, "").slice(0, 80) || "Saved from AI";
}

export function SaveToAppDialog({ open, onOpenChange, content, messageId, onSaved }: Props) {
  const { user, profile } = useAuth();
  const [step, setStep] = useState<"pick" | "confirm">("pick");
  const [dest, setDest] = useState<SaveDestination | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep("pick");
    setDest(null);
    setTitle("");
    setBody("");
  };

  const pick = (d: SaveDestination) => {
    setDest(d);
    setTitle(deriveTitle(content));
    setBody(content);
    setStep("confirm");
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const save = async () => {
    if (!dest || !user?.id) return;
    setSaving(true);
    try {
      let savedId: string | null = null;
      if (dest === "decision_log") {
        const { data, error } = await supabase
          .from("decision_log")
          .insert({ title, rationale: body, created_by: user.id })
          .select("id")
          .single();
        if (error) throw error;
        savedId = data.id;
      } else if (dest === "idea_vault") {
        const { data, error } = await supabase
          .from("idea_vault")
          .insert({
            title,
            description: body,
            status: "captured",
            source: "ai_conversation",
            created_by: user.id,
            workspace_id: profile?.workspace_id ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        savedId = data.id;
      } else if (dest === "strategy_item") {
        const { data, error } = await supabase
          .from("strategy_items")
          .insert({
            title,
            description: body,
            type: "objective",
            status: "new",
            created_by: user.id,
            workspace_id: profile?.workspace_id ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        savedId = data.id;
      } else if (dest === "goal") {
        const now = new Date();
        const q = `Q${Math.floor(now.getMonth() / 3) + 1}`;
        const { data, error } = await supabase
          .from("goals")
          .insert({
            title,
            description: body,
            year: now.getFullYear(),
            quarter: q,
            status: "on_track",
            created_by: user.id,
            owner_id: user.id,
            workspace_id: profile?.workspace_id ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        savedId = data.id;
      }

      // Mark the source AI message
      if (messageId && savedId) {
        await supabase
          .from("ai_strategy_messages")
          .update({ saved_to_type: dest, saved_to_id: savedId })
          .eq("id", messageId);
      }

      const label = DESTS.find((d) => d.id === dest)?.label || "the app";
      toast.success(`Saved to ${label}`);
      if (savedId) onSaved(dest, savedId);
      handleClose(false);
    } catch (e: any) {
      console.error("save-to-app error:", e);
      toast.error(`Could not save: ${e?.message || "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{step === "pick" ? "Save this to..." : `Save to ${DESTS.find((d) => d.id === dest)?.label}`}</DialogTitle>
          {step === "pick" && (
            <DialogDescription>Choose where this AI response should live in your app.</DialogDescription>
          )}
        </DialogHeader>

        {step === "pick" ? (
          <div className="grid grid-cols-1 gap-2 mt-2">
            {DESTS.map((d) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.id}
                  onClick={() => pick(d.id)}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors p-3 text-left"
                >
                  <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{d.label}</div>
                    <div className="text-xs text-muted-foreground">{d.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {dest === "decision_log" ? "Rationale" : "Description"}
              </label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep("pick")} disabled={saving}>
                Back
              </Button>
              <Button size="sm" onClick={save} disabled={saving || !title.trim()}>
                {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export const SAVE_DEST_LABELS: Record<SaveDestination, string> = {
  decision_log: "Decision Log",
  idea_vault: "Idea Vault",
  strategy_item: "Strategy Item",
  goal: "Goal",
};
