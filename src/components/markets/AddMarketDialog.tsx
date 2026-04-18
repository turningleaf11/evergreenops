import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

export function AddMarketDialog({ open, onOpenChange, onCreated }: Props) {
  const { user, profile } = useAuth();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [strategy, setStrategy] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setName(""); setLocation(""); setStrategy(""); };

  const submit = async () => {
    if (!user || !name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("markets").insert({
      name: name.trim(),
      location: location.trim(),
      strategy: strategy.trim(),
      criteria: strategy.trim(),
      created_by: user.id,
      workspace_id: profile?.workspace_id,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Market added");
    reset();
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a market</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Market name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Austin Metro" autoFocus />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Location</label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Austin, TX" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Investment strategy</label>
            <Textarea
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              placeholder="Describe your investment strategy for this market — e.g. buy & hold single-family rentals under $300K, target 8%+ cap rate, focus on B-class neighborhoods near job growth…"
              className="min-h-[120px]"
            />
            <p className="text-[11px] text-muted-foreground mt-1">The AI will use this to analyze the market.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Create market"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
