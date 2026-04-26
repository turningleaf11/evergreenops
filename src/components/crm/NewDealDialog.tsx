import { useEffect, useMemo, useState } from "react";
import { Loader2, Star, X, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Stage {
  id: string;
  name: string;
  sort_order: number;
  probability_default: number;
}
interface ContactLite {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipelineId: string | null;
  workspaceId: string | null;
  userId: string | null;
  onCreated: () => void;
  /** When opened from a contact, pre-select that contact as primary. */
  defaultContactId?: string | null;
}

const contactName = (c: ContactLite) =>
  `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Untitled";

export function NewDealDialog({
  open,
  onOpenChange,
  pipelineId,
  workspaceId,
  userId,
  onCreated,
  defaultContactId,
}: Props) {
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [stageId, setStageId] = useState<string>("");
  const [primaryId, setPrimaryId] = useState<string>("");
  const [associatedIds, setAssociatedIds] = useState<Set<string>>(new Set());
  const [closeDate, setCloseDate] = useState<string>("");
  const [stages, setStages] = useState<Stage[]>([]);
  const [contacts, setContacts] = useState<ContactLite[]>([]);
  const [search, setSearch] = useState("");
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
          .limit(500),
      ]);
      const s = (st as Stage[]) || [];
      setStages(s);
      setStageId(s[0]?.id ?? "");
      const cList = (cs as ContactLite[]) || [];
      // Make sure the default contact is in the list even if outside the latest 500.
      if (defaultContactId && !cList.some((c) => c.id === defaultContactId)) {
        const { data: extra } = await supabase
          .from("contacts")
          .select("id,first_name,last_name,email")
          .eq("id", defaultContactId)
          .maybeSingle();
        if (extra) cList.unshift(extra as ContactLite);
      }
      setContacts(cList);
    })();
  }, [open, pipelineId, defaultContactId]);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setValue("");
      setPrimaryId("");
      setAssociatedIds(new Set());
      setCloseDate("");
      setSearch("");
    } else if (defaultContactId) {
      // Pre-select the contact this dialog was opened from as primary.
      setPrimaryId(defaultContactId);
    }
  }, [open, defaultContactId]);

  const filtered = useMemo(() => {
    if (search.trim().length < 1) return contacts.slice(0, 8);
    const q = search.trim().toLowerCase();
    return contacts
      .filter(
        (c) =>
          contactName(c).toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [contacts, search]);

  const selectedContacts = useMemo(() => {
    const ids = new Set<string>(associatedIds);
    if (primaryId) ids.add(primaryId);
    return contacts.filter((c) => ids.has(c.id));
  }, [contacts, primaryId, associatedIds]);

  const togglePrimary = (id: string) => {
    if (primaryId === id) {
      setPrimaryId("");
      return;
    }
    // If currently associated, remove from associated; old primary moves to associated
    setAssociatedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      if (primaryId) next.add(primaryId);
      return next;
    });
    setPrimaryId(id);
  };

  const toggleAssociated = (id: string) => {
    if (id === primaryId) return;
    setAssociatedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
        primary_contact_id: primaryId || null,
        owner_id: userId,
        created_by: userId,
      })
      .select()
      .single();
    if (error) {
      setSaving(false);
      toast({
        title: "Couldn't create deal",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    // Link primary + associated via entity_links so they appear on each contact
    const targets = new Set<string>();
    if (primaryId) targets.add(primaryId);
    associatedIds.forEach((id) => targets.add(id));
    if (deal && targets.size > 0) {
      await supabase.from("entity_links").insert(
        Array.from(targets).map((id) => ({
          source_type: "deal",
          source_id: deal.id,
          target_type: "contact",
          target_id: id,
          created_by: userId,
        })),
      );
    }
    setSaving(false);
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New deal</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="123 Main St acquisition"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Value (USD)</Label>
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="125000"
                inputMode="decimal"
              />
            </div>
            <div>
              <Label className="text-xs">Expected close</Label>
              <Input
                type="date"
                value={closeDate}
                onChange={(e) => setCloseDate(e.target.value)}
              />
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
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Contacts */}
          <div className="rounded-lg border border-border/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Contacts</Label>
              <span className="text-[10px] text-muted-foreground">
                Click <Star className="h-2.5 w-2.5 inline -mt-0.5" /> to set primary
              </span>
            </div>

            {selectedContacts.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedContacts.map((c) => (
                  <Badge
                    key={c.id}
                    variant="outline"
                    className={`gap-1 ${
                      c.id === primaryId ? "border-primary text-primary" : ""
                    }`}
                  >
                    {c.id === primaryId && <Star className="h-2.5 w-2.5" />}
                    {contactName(c)}
                    <button
                      onClick={() => {
                        if (c.id === primaryId) setPrimaryId("");
                        else toggleAssociated(c.id);
                      }}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts…"
                className="h-8 text-sm pl-7"
              />
            </div>

            <div className="max-h-40 overflow-auto space-y-0.5">
              {filtered.map((c) => {
                const isP = c.id === primaryId;
                const isA = associatedIds.has(c.id);
                const selected = isP || isA;
                return (
                  <div
                    key={c.id}
                    className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-sm ${
                      selected ? "bg-muted/40" : "hover:bg-muted/30"
                    }`}
                  >
                    <button
                      onClick={() => toggleAssociated(c.id)}
                      disabled={isP}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="truncate font-medium">{contactName(c)}</div>
                      {c.email && (
                        <div className="truncate text-[11px] text-muted-foreground">
                          {c.email}
                        </div>
                      )}
                    </button>
                    <button
                      onClick={() => togglePrimary(c.id)}
                      className={`p-1 rounded hover:bg-muted ${
                        isP ? "text-primary" : "text-muted-foreground"
                      }`}
                      title={isP ? "Primary" : "Set as primary"}
                    >
                      <Star className={`h-3.5 w-3.5 ${isP ? "fill-current" : ""}`} />
                    </button>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-2">
                  No contacts match.
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
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
