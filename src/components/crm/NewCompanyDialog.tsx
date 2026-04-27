import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string | null;
  userId: string | null;
  onCreated: (id?: string) => void;
}

export function NewCompanyDialog({ open, onOpenChange, workspaceId, userId, onCreated }: Props) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(""); setDomain(""); setWebsite(""); setIndustry(""); setSize(""); setNotes("");
  };

  const submit = async () => {
    if (!userId) return;
    if (!name.trim()) {
      toast({ title: "Company name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("companies")
      .insert({
        workspace_id: workspaceId,
        name: name.trim(),
        domain: domain.trim() || null,
        website: website.trim() || null,
        industry: industry.trim() || null,
        size: size.trim() || null,
        notes: notes.trim() || "",
        created_by: userId,
        owner_id: userId,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't create company", description: error.message, variant: "destructive" });
      return;
    }
    reset();
    onOpenChange(false);
    onCreated((data as { id: string } | null)?.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New company</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Holdings" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Domain</Label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.com" />
            </div>
            <div>
              <Label className="text-xs">Website</Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.com" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Industry</Label>
              <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Real estate" />
            </div>
            <div>
              <Label className="text-xs">Size</Label>
              <Input value={size} onChange={(e) => setSize(e.target.value)} placeholder="1-10" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" onClick={submit} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Create company
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
