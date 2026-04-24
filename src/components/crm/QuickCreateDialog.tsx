import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CustomFieldsRenderer, useCustomFields } from "./CustomFieldsRenderer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Stage { id: string; name: string; pipeline_id: string }
interface Pipeline { id: string; name: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string | null;
  userId: string | null;
  initialTab?: "contact" | "deal";
  prefill?: { firstName?: string; lastName?: string; email?: string };
  onCreated: (created: { type: "contact" | "deal"; id: string }) => void;
}

export function QuickCreateDialog({
  open,
  onOpenChange,
  workspaceId,
  userId,
  initialTab = "contact",
  prefill,
  onCreated,
}: Props) {
  const [tab, setTab] = useState<"contact" | "deal">(initialTab);
  const [saving, setSaving] = useState(false);

  // contact fields
  const [first, setFirst] = useState(prefill?.firstName ?? "");
  const [last, setLast] = useState(prefill?.lastName ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [contactCustom, setContactCustom] = useState<Record<string, unknown>>({});

  // deal fields
  const [dealTitle, setDealTitle] = useState("");
  const [dealValue, setDealValue] = useState<string>("");
  const [pipelineId, setPipelineId] = useState<string>("");
  const [stageId, setStageId] = useState<string>("");
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [dealCustom, setDealCustom] = useState<Record<string, unknown>>({});

  const { fields: contactCF } = useCustomFields("contact");
  const { fields: dealCF } = useCustomFields("deal");

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setFirst(prefill?.firstName ?? "");
    setLast(prefill?.lastName ?? "");
    setEmail(prefill?.email ?? "");
    setDealTitle(
      prefill?.firstName || prefill?.lastName
        ? `${prefill?.firstName ?? ""} ${prefill?.lastName ?? ""}`.trim() + " – New deal"
        : "",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: pls } = await supabase.from("pipelines").select("id,name").order("created_at");
      setPipelines((pls as Pipeline[]) || []);
      if (pls && pls.length > 0) {
        setPipelineId(pls[0].id);
        const { data: sts } = await supabase
          .from("pipeline_stages")
          .select("id,name,pipeline_id")
          .eq("pipeline_id", pls[0].id)
          .order("sort_order");
        setStages((sts as Stage[]) || []);
        if (sts && sts.length > 0) setStageId(sts[0].id);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!pipelineId) return;
    (async () => {
      const { data: sts } = await supabase
        .from("pipeline_stages")
        .select("id,name,pipeline_id")
        .eq("pipeline_id", pipelineId)
        .order("sort_order");
      setStages((sts as Stage[]) || []);
      if (sts && sts.length > 0) setStageId(sts[0].id);
    })();
  }, [pipelineId]);

  const submit = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      if (tab === "contact") {
        if (!first.trim() && !last.trim() && !email.trim()) {
          toast({ title: "Add at least a name or email", variant: "destructive" });
          return;
        }
        const { data, error } = await supabase
          .from("contacts")
          .insert({
            workspace_id: workspaceId ?? undefined,
            first_name: first.trim(),
            last_name: last.trim(),
            email: email.trim() || null,
            phone: phone.trim() || null,
            title: title.trim() || null,
            created_by: userId,
            owner_id: userId,
            custom_fields: contactCustom as any,
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        onCreated({ type: "contact", id: (data as any).id });
      } else {
        if (!dealTitle.trim()) {
          toast({ title: "Deal needs a title", variant: "destructive" });
          return;
        }
        if (!stageId) {
          toast({ title: "Pick a stage", variant: "destructive" });
          return;
        }
        const { data, error } = await supabase
          .from("deals")
          .insert({
            workspace_id: workspaceId,
            title: dealTitle.trim(),
            value: dealValue ? Number(dealValue) : null,
            pipeline_id: pipelineId,
            stage_id: stageId,
            status: "open",
            owner_id: userId,
            created_by: userId,
            custom_fields: dealCustom,
          })
          .select("id")
          .single();
        if (error) throw error;
        onCreated({ type: "deal", id: (data as any).id });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Couldn't create", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to CRM</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "contact" | "deal")}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="deal">Deal</TabsTrigger>
          </TabsList>

          <TabsContent value="contact" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">First name</Label>
                <Input value={first} onChange={(e) => setFirst(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Last name</Label>
                <Input value={last} onChange={(e) => setLast(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            {contactCF.length > 0 && (
              <div className="pt-2 border-t border-border/40">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                  Custom fields
                </div>
                <CustomFieldsRenderer
                  fields={contactCF}
                  values={contactCustom}
                  onChange={setContactCustom}
                  compact
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="deal" className="space-y-3 pt-3">
            <div>
              <Label className="text-xs">Deal title</Label>
              <Input value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Value</Label>
                <Input
                  type="number"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  placeholder="0"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Pipeline</Label>
                <Select value={pipelineId} onValueChange={setPipelineId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Stage</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {dealCF.length > 0 && (
              <div className="pt-2 border-t border-border/40">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                  Custom fields
                </div>
                <CustomFieldsRenderer
                  fields={dealCF}
                  values={dealCustom}
                  onChange={setDealCustom}
                  compact
                />
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Create {tab === "contact" ? "contact" : "deal"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
