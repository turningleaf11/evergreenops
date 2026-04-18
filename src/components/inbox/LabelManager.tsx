import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface EmailLabel { id: string; name: string; color: string; gmail_label_id: string | null; }

const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}

export function LabelManager({ open, onOpenChange, onChanged }: Props) {
  const { profile } = useAuth();
  const [labels, setLabels] = useState<EmailLabel[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("email_labels").select("*").order("name");
    if (data) setLabels(data as EmailLabel[]);
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open]);

  const create = async () => {
    if (!name.trim() || !profile?.workspace_id) return;
    const { error } = await supabase.from("email_labels").insert({
      name: name.trim(),
      color,
      workspace_id: profile.workspace_id,
    });
    if (error) { toast.error(error.message); return; }
    setName("");
    setColor(PALETTE[0]);
    await load();
    onChanged();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("email_labels").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await load();
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Manage labels</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && create()}
                placeholder="Label name"
                className="h-9 text-sm"
              />
              <Button size="sm" onClick={create} className="gap-1 h-9">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            <div className="flex gap-1.5">
              {PALETTE.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full border-2 transition-all ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-border/50 pt-3 space-y-1 max-h-72 overflow-auto">
            {loading ? (
              <div className="text-center py-4"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
            ) : labels.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4">No labels yet</div>
            ) : labels.map(l => (
              <div key={l.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                <span className="text-sm flex-1 truncate">{l.name}</span>
                <button onClick={() => remove(l.id)} className="text-muted-foreground hover:text-destructive p-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
