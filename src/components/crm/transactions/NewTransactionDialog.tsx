import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "@/hooks/use-toast";

interface PrefillFromDeal {
  dealId: string;
  property_address: string;
  property_city?: string | null;
  property_state?: string | null;
  property_zip?: string | null;
  property_type?: string | null;
  units?: number | null;
  unit_mix?: string | null;
  asking_price?: number | null;
  source_contact_id?: string | null;
  expected_close_date?: string | null;
}

export function NewTransactionDialog({
  open,
  onOpenChange,
  prefillFromDeal,
  defaultLane = "wholesale",
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefillFromDeal?: PrefillFromDeal | null;
  defaultLane?: "wholesale" | "portfolio";
  onCreated?: (txId: string) => void;
}) {
  const { user } = useAuth();
  const { id: workspaceId } = useWorkspace();

  const [saving, setSaving] = useState(false);
  const [lane, setLane] = useState<"wholesale" | "portfolio">(defaultLane);
  const [type, setType] = useState<"assign" | "double_close" | "buy">("assign");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [contractDate, setContractDate] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");

  useEffect(() => {
    if (!open) return;
    if (prefillFromDeal) {
      setLane("portfolio");
      setType("buy");
      setAddress(prefillFromDeal.property_address || "");
      setCity(prefillFromDeal.property_city || "");
      setStateCode(prefillFromDeal.property_state || "");
      setClosingDate(prefillFromDeal.expected_close_date || "");
      setPurchasePrice(prefillFromDeal.asking_price?.toString() || "");
      setContractDate("");
    } else {
      setLane(defaultLane);
      setType("assign");
      setAddress("");
      setCity("");
      setStateCode("");
      setContractDate("");
      setClosingDate("");
      setPurchasePrice("");
    }
  }, [open, prefillFromDeal, defaultLane]);

  const submit = async () => {
    if (!user || !workspaceId) return;
    if (!address.trim()) {
      toast({ title: "Property address required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("crm_transactions")
      .insert({
        workspace_id: workspaceId,
        deal_id: prefillFromDeal?.dealId ?? null,
        lane,
        transaction_type: type,
        property_address: address.trim(),
        property_city: city.trim() || null,
        property_state: stateCode.trim() || null,
        property_zip: prefillFromDeal?.property_zip ?? null,
        property_type: prefillFromDeal?.property_type ?? null,
        units: prefillFromDeal?.units ?? null,
        unit_mix: prefillFromDeal?.unit_mix ?? null,
        asking_price: prefillFromDeal?.asking_price ?? null,
        contract_date: contractDate || null,
        closing_date: closingDate || null,
        purchase_price: purchasePrice ? Number(purchasePrice) : null,
        source_contact_id: prefillFromDeal?.source_contact_id ?? null,
        created_by: user.id,
      } as any)
      .select("id")
      .single();

    setSaving(false);
    if (error) {
      toast({ title: "Couldn't create deal", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deal created" });
    onOpenChange(false);
    onCreated?.((data as any).id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{prefillFromDeal ? "Create deal from pipeline" : "New deal"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Lane</Label>
              <Select value={lane} onValueChange={(v: any) => setLane(v)} disabled={!!prefillFromDeal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                  <SelectItem value="portfolio">Portfolio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Deal type</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="assign">Assign</SelectItem>
                  <SelectItem value="double_close">Double Close</SelectItem>
                  <SelectItem value="buy">Buy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Property address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">State</Label>
              <Input value={stateCode} onChange={(e) => setStateCode(e.target.value)} maxLength={2} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Contract date</Label>
              <Input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Closing date</Label>
              <Input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Purchase price</Label>
            <Input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Create deal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
