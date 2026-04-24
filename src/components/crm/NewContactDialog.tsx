import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string | null;
  userId: string | null;
  onCreated: () => void;
}

export function NewContactDialog({ open, onOpenChange, workspaceId, userId, onCreated }: Props) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFirst("");
    setLast("");
    setEmail("");
    setPhone("");
    setTitle("");
  };

  const submit = async () => {
    if (!userId) return;
    if (!first.trim() && !last.trim() && !email.trim()) {
      toast({ title: "Add at least a name or email", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("contacts").insert({
      workspace_id: workspaceId,
      first_name: first.trim(),
      last_name: last.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      title: title.trim() || null,
      created_by: userId,
      owner_id: userId,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't create contact", description: error.message, variant: "destructive" });
      return;
    }
    reset();
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">First name</Label>
              <Input value={first} onChange={(e) => setFirst(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Last name</Label>
              <Input value={last} onChange={(e) => setLast(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Create contact
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
