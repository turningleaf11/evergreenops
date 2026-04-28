import { useEffect, useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Lead {
  id: string;
  workspace_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  title: string | null;
  notes: string;
  owner_id: string | null;
  property_address?: string | null;
  property_city?: string | null;
  property_state?: string | null;
  property_zip?: string | null;
  property_type?: string | null;
  units?: number | null;
  unit_mix?: string | null;
  sqft?: number | null;
  asking_price?: number | null;
  source_contact_id?: string | null;
}

interface Pipeline { id: string; name: string; is_default: boolean }
interface Stage { id: string; name: string; pipeline_id: string; sort_order: number }

export function ConvertLeadDialog({
  lead,
  open,
  onOpenChange,
  userId,
  onConverted,
}: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
  onConverted: (dealId: string) => void;
}) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [pipelineId, setPipelineId] = useState<string>("");
  const [stageId, setStageId] = useState<string>("");
  const [dealTitle, setDealTitle] = useState("");
  const [value, setValue] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: pls } = await supabase.from("pipelines").select("id,name,is_default").order("sort_order");
      const list = (pls as Pipeline[]) || [];
      setPipelines(list);
      const def = list.find((p) => p.is_default) || list[0];
      if (def) setPipelineId(def.id);
    })();
  }, [open]);

  useEffect(() => {
    if (!pipelineId) return;
    (async () => {
      const { data } = await supabase
        .from("pipeline_stages")
        .select("id,name,pipeline_id,sort_order")
        .eq("pipeline_id", pipelineId)
        .order("sort_order");
      const list = (data as Stage[]) || [];
      setStages(list);
      if (list[0]) setStageId(list[0].id);
    })();
  }, [pipelineId]);

  useEffect(() => {
    if (lead && open) {
      const loc =
        [lead.property_city, lead.property_state].filter(Boolean).join(", ") || null;
      const title =
        lead.property_address
          ? `${lead.property_address}${loc ? ` (${loc})` : ""}`
          : lead.company_name
            ? `${lead.company_name} — ${lead.name || "New deal"}`
            : `${lead.name || "New deal"}`;
      setDealTitle(title);
      setValue(lead.asking_price ? String(lead.asking_price) : "0");
    }
  }, [lead, open]);

  const submit = async () => {
    if (!lead || !userId || !stageId || !pipelineId) return;
    setSaving(true);

    // 1. find or create contact
    let contactId: string | null = null;
    if (lead.email) {
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("email", lead.email)
        .maybeSingle();
      if (existing) contactId = (existing as { id: string }).id;
    }
    if (!contactId) {
      const [first, ...rest] = (lead.name || "").trim().split(" ");
      const { data: c, error: cErr } = await supabase
        .from("contacts")
        .insert({
          workspace_id: lead.workspace_id,
          first_name: first || "",
          last_name: rest.join(" "),
          email: lead.email,
          phone: lead.phone,
          title: lead.title,
          owner_id: lead.owner_id || userId,
          created_by: userId,
        })
        .select("id")
        .single();
      if (cErr) {
        setSaving(false);
        toast({ title: "Couldn't create contact", description: cErr.message, variant: "destructive" });
        return;
      }
      contactId = (c as { id: string }).id;
    }

    // 2. create deal — carry property + financial fields directly so the deal
    //    inherits everything entered on the lead.
    const { data: d, error: dErr } = await supabase
      .from("deals")
      .insert({
        workspace_id: lead.workspace_id,
        title: dealTitle.trim() || lead.name || "New deal",
        pipeline_id: pipelineId,
        stage_id: stageId,
        value: Number(value) || lead.asking_price || 0,
        currency: "USD",
        primary_contact_id: contactId,
        owner_id: lead.owner_id || userId,
        created_by: userId,
        status: "open",
        lead_id: lead.id,
        property_address: lead.property_address ?? null,
        property_city: lead.property_city ?? null,
        property_state: lead.property_state ?? null,
        property_zip: lead.property_zip ?? null,
        property_type: lead.property_type ?? null,
        units: lead.units ?? null,
        unit_mix: lead.unit_mix ?? null,
        sqft: lead.sqft ?? null,
        asking_price: lead.asking_price ?? null,
        source_contact_id: lead.source_contact_id ?? null,
      } as any)
      .select("id,workspace_id")
      .single();
    if (dErr) {
      setSaving(false);
      toast({ title: "Couldn't create deal", description: dErr.message, variant: "destructive" });
      return;
    }
    const dealId = (d as { id: string }).id;

    // 3. carry over freeform lead notes as a single activity entry.
    const body = (lead.notes || "").trim();
    if (body) {
      await supabase.from("crm_activities").insert({
        workspace_id: lead.workspace_id,
        entity_type: "deal",
        entity_id: dealId,
        type: "note",
        subject: "Imported from lead",
        body,
        actor_id: userId,
      });
    }

    // 4. mark lead converted
    await supabase
      .from("leads")
      .update({
        status: "converted",
        converted_contact_id: contactId,
        converted_deal_id: dealId,
      })
      .eq("id", lead.id);

    setSaving(false);
    onOpenChange(false);
    onConverted(dealId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Qualify lead <ArrowRight className="h-4 w-4 text-muted-foreground" /> Deal
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Deal title</Label>
            <Input value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Pipeline</Label>
              <Select value={pipelineId} onValueChange={setPipelineId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Stage</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Value (USD)</Label>
            <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            A contact will be created (or matched by email) and linked as the deal's primary contact.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" onClick={submit} disabled={saving || !stageId}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Convert to deal
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
