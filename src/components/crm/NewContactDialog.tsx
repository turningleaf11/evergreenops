import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { MarketsEditor } from "./MarketsEditor";
import {
  CONTACT_TYPES,
  CONTACT_TYPE_LABEL,
  PREFERRED_CONTACT_METHODS,
  type ContactType,
  type PreferredContactMethod,
} from "./contactTypes";

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
  const [contactType, setContactType] = useState<ContactType>("other");
  const [preferredMethod, setPreferredMethod] = useState<PreferredContactMethod | "">("");
  const [buyBox, setBuyBox] = useState("");
  const [markets, setMarkets] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFirst("");
    setLast("");
    setEmail("");
    setPhone("");
    setTitle("");
    setContactType("other");
    setPreferredMethod("");
    setBuyBox("");
    setMarkets([]);
    setMarketDraft("");
  };

  const addMarket = () => {
    const v = marketDraft.trim();
    if (!v) return;
    if (!markets.includes(v)) setMarkets([...markets, v]);
    setMarketDraft("");
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
      contact_type: contactType,
      preferred_contact_method: preferredMethod || null,
      buy_box_notes: buyBox.trim() || null,
      markets: markets.length ? markets : null,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={contactType} onValueChange={(v) => setContactType(v as ContactType)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {CONTACT_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Preferred contact method</Label>
              <Select
                value={preferredMethod || "_none"}
                onValueChange={(v) =>
                  setPreferredMethod(v === "_none" ? "" : (v as PreferredContactMethod))
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {PREFERRED_CONTACT_METHODS.map((m) => (
                    <SelectItem key={m} value={m} className="capitalize">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Buy box / notes</Label>
            <Textarea
              rows={3}
              value={buyBox}
              onChange={(e) => setBuyBox(e.target.value)}
              placeholder="Criteria, price range, geographies, etc."
            />
          </div>

          <div>
            <Label className="text-xs">Markets</Label>
            <div className="flex gap-2">
              <Input
                value={marketDraft}
                onChange={(e) => setMarketDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addMarket();
                  }
                }}
                placeholder="Add a market (e.g. Tampa) and press Enter"
              />
              <Button type="button" variant="outline" size="sm" onClick={addMarket}>
                Add
              </Button>
            </div>
            {markets.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {markets.map((m) => (
                  <Badge key={m} variant="secondary" className="gap-1">
                    {m}
                    <button
                      type="button"
                      onClick={() => setMarkets(markets.filter((x) => x !== m))}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
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
