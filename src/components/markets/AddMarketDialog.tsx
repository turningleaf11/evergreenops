import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const STRATEGIES = [
  { value: "buy_and_hold", label: "Buy & Hold" },
  { value: "brrrr", label: "BRRRR" },
  { value: "fix_and_flip", label: "Fix & Flip" },
  { value: "wholesale", label: "Wholesale" },
  { value: "multifamily", label: "Multifamily" },
  { value: "commercial", label: "Commercial" },
  { value: "short_term_rental", label: "Short-Term Rental" },
  { value: "land", label: "Land Development" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

export function AddMarketDialog({ open, onOpenChange, onCreated }: Props) {
  const { user, profile } = useAuth();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [strategy, setStrategy] = useState("buy_and_hold");
  const [criteria, setCriteria] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setName(""); setLocation(""); setStrategy("buy_and_hold"); setCriteria(""); };

  const submit = async () => {
    if (!user || !name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("markets").insert({
      name: name.trim(),
      location: location.trim(),
      strategy,
      criteria: criteria.trim(),
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
            <Select value={strategy} onValueChange={setStrategy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STRATEGIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Criteria (optional)</label>
            <Textarea value={criteria} onChange={(e) => setCriteria(e.target.value)} placeholder="Budget, target returns, property types…" className="min-h-[70px]" />
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
