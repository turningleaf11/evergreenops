import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Stage { id: string; name: string; sort_order: number; probability_default: number }
interface ContactLite { id: string; first_name: string; last_name: string; email: string | null }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipelineId: string | null;
  workspaceId: string | null;
  userId: string | null;
  onCreated: () => void;
}

export function NewDealDialog({ open, onOpenChange, pipelineId, workspaceId, userId, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [stageId, setStageId] = useState<string>("");
  const [contactId, setContactId] = useState<string>("");
  const [closeDate, setCloseDate] = useState<string>("");
  const [stages, setStages] = useState<Stage[]>([]);
  const [contacts, setContacts] = useState<ContactLite[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !pipelineId) return;
    (async () => {
      const [{ data: st }, { data: cs }] = await Promise.all([
        supabase
          .from("pipeline_stages")
          .select("id,name,sort_order,probability_default")
          .eq("pipeline_id", pipelineId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("contacts")
          .select("id,first_name,last_name,email")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      const s = (st as Stage[]) || [];
      setStages(s);
      setStageId(s[0]?.id ?? "");
      setContacts((cs as ContactLite[]) || []);
    })();
  }, [open, pipelineId]);

  const reset = () => {
    setTitle(""); setValue(""); setContactId(""); setCloseDate("");
  };

  const submit = async () => {
    if (!userId || !pipelineId || !stageId) return;
    if (!title.trim()) {
      toast({ title: "Add a deal title", variant: "destructive" });
      return;
    }
    setSaving(true);
    const stage = stages.find((s) => s.id === stageId);
    const numericValue = Number(value.replace(/[^0-9.\-]/g, "")) || 0;
    const { data: deal, error } = await supabase
      .from("deals")
      .insert({
        workspace_id: workspaceId,
        title: title.trim(),
        pipeline_id: pipelineId,
        stage_id: stageId,
        value: numericValue,
        probability: stage?.probability_default ?? 0,
        expected_close_date: closeDate || null,
        primary_contact_id: contactId || null,
        owner_id: userId,
        created_by: userId,
      })
      .select()
      .single();
    if (error) {
      setSaving(false);
      toast({ title: "Couldn't create deal", description: error.message, variant: "destructive" });
      return;
    }
    // Link primary contact via entity_links so it shows on the contact too
    if (contactId && deal) {
      await supabase.from("entity_links").insert({
        source_type: "deal",
        source_id: deal.id,
        target_type: "contact",
        target_id: contactId,
        created_by: userId,
      });
    }
    setSaving(false);
    reset();
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New deal</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="123 Main St acquisition" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Value (USD)</Label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="125000" inputMode="decimal" />
            </div>
            <div>
              <Label className="text-xs">Expected close</Label>
              <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Stage</Label>
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Primary contact</Label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">— None —</option>
              {contacts.map((c) => {
                const name = `${c.first_name} ${c.last_name}`.trim() || c.email || "Untitled";
                return <option key={c.id} value={c.id}>{name}</option>;
              })}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" onClick={submit} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Create deal
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
