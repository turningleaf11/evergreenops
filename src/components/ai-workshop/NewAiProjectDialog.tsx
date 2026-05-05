import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { AI_STAGES, type AiStage } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}

export default function NewAiProjectDialog({ open, onClose, onCreated }: Props) {
  const { user, profile } = useAuth();
  const [name, setName] = useState("");
  const [stage, setStage] = useState<AiStage>("idea");
  const [liveUrl, setLiveUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setName(""); setStage("idea"); setLiveUrl(""); };

  const handleCreate = async () => {
    if (!name.trim() || !user) return;
    if (!profile?.workspace_id) {
      toast({ title: "Could not create project", description: "Your account is missing workspace access.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const id = crypto.randomUUID();
    // workspace_id, created_by, owner_id are set server-side by trigger
    const { error } = await (supabase.from("ai_projects" as any).insert({
      id,
      name: name.trim(),
      stage,
      live_url: liveUrl.trim() || null,
    } as any) as any);
    setSaving(false);
    if (error) { toast({ title: "Could not create project", description: error.message, variant: "destructive" }); return; }
    reset();
    onCreated(id);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New AI Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lead intake bot" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Stage</Label>
            <Select value={stage} onValueChange={(v) => setStage(v as AiStage)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AI_STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Live URL (optional)</Label>
            <Input value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} placeholder="https://..." className="h-9" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} disabled={!name.trim() || saving}>{saving ? "Creating..." : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
