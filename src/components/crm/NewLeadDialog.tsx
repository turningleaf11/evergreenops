import { useEffect, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
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
import { ContactPicker } from "./ContactPicker";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string | null;
  userId: string | null;
  onCreated: () => void;
  /** When opened from a contact, pre-select that contact as the source. */
  defaultContactId?: string | null;
}

const PROPERTY_TYPES = [
  "SFR",
  "SFR Portfolio",
  "MF Small (2-4)",
  "MF Large (5+)",
  "Mixed Use",
  "Commercial",
  "Land",
  "Other",
];

export function NewLeadDialog({ open, onOpenChange, workspaceId, userId, onCreated, defaultContactId }: Props) {
  const [name, setName] = useState("");
  const [temperature, setTemperature] = useState("warm");
  const [sourceContactId, setSourceContactId] = useState<string | null>(null);
  const [sourceContactName, setSourceContactName] = useState<string>("");

  // Property
  const [address, setAddress] = useState("");
  const [propType, setPropType] = useState<string>("");
  const [units, setUnits] = useState("");
  const [unitMix, setUnitMix] = useState("");
  const [sqft, setSqft] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(""); setTemperature("warm");
    setSourceContactId(null); setSourceContactName("");
    setAddress("");
    setPropType(""); setUnits(""); setUnitMix(""); setSqft("");
    setAskingPrice("");
  };

  // Pre-select source contact when opened from a contact context.
  useEffect(() => {
    if (open && defaultContactId) {
      setSourceContactId(defaultContactId);
    }
  }, [open, defaultContactId]);

  const submit = async () => {
    if (!userId) return;
    const inferredName = name.trim() || address.trim() || "Untitled property lead";
    setSaving(true);
    const { error } = await supabase.from("leads").insert({
      workspace_id: workspaceId,
      name: inferredName,
      temperature,
      lane: "portfolio",
      source_contact_id: sourceContactId,
      property_address: address.trim() || null,
      property_type: propType || null,
      units: units ? Number(units) : null,
      unit_mix: unitMix.trim() || null,
      sqft: sqft ? Number(sqft) : null,
      asking_price: askingPrice ? Number(askingPrice) : null,
      created_by: userId,
      owner_id: userId,
    } as any);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't create lead", description: error.message, variant: "destructive" });
      return;
    }
    reset();
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New portfolio lead</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* PROPERTY */}
          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Property</h3>
            <div>
              <Label className="text-xs">Property Address</Label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Full property address"
                  className="pl-8"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={propType} onValueChange={setPropType}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Units</Label>
                <Input type="number" value={units} onChange={(e) => setUnits(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Beds</Label>
                <Input type="number" value={beds} onChange={(e) => setBeds(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Baths</Label>
                <Input type="number" step="0.5" value={baths} onChange={(e) => setBaths(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Sqft</Label>
                <Input type="number" value={sqft} onChange={(e) => setSqft(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Asking price ($)</Label>
                <Input type="number" value={askingPrice} onChange={(e) => setAskingPrice(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Listed cap rate (%)</Label>
                <Input type="number" step="0.01" value={capRate} onChange={(e) => setCapRate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Gross income ($)</Label>
                <Input type="number" value={grossIncome} onChange={(e) => setGrossIncome(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">NOI ($)</Label>
                <Input type="number" value={noi} onChange={(e) => setNoi(e.target.value)} />
              </div>
            </div>
          </section>

          {/* SOURCE */}
          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Source</h3>
            <div>
              <Label className="text-xs">Who sent this?</Label>
              <ContactPicker
                value={sourceContactId}
                onChange={(id, c) => {
                  setSourceContactId(id);
                  setSourceContactName(
                    c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "" : "",
                  );
                }}
                placeholder="Search existing contacts…"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Internal label (optional)</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Auto from address" />
              </div>
              <div>
                <Label className="text-xs">Temperature</Label>
                <Select value={temperature} onValueChange={setTemperature}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cold">Cold</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="hot">Hot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" onClick={submit} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Create lead
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
