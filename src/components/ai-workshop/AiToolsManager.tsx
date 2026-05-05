import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Wrench, Plus, Trash2, Eye, EyeOff, Copy, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface AiTool {
  id: string;
  name: string;
  url: string | null;
  login_email: string | null;
  login_username: string | null;
  login_password: string | null;
  notes: string | null;
  color: string | null;
  created_by: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChanged?: () => void;
}

export default function AiToolsManager({ open, onOpenChange, onChanged }: Props) {
  const [tools, setTools] = useState<AiTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.from("ai_tools" as any).select("*").order("name") as any);
    setTools((data as AiTool[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const create = async () => {
    if (!newName.trim()) return;
    const { data, error } = await (supabase.from("ai_tools" as any).insert({
      name: newName.trim(),
      url: newUrl.trim() || null,
    } as any).select().single() as any);
    if (error) { toast({ title: "Could not add tool", description: error.message, variant: "destructive" }); return; }
    setNewName(""); setNewUrl(""); setAdding(false);
    setTools([...tools, data as AiTool].sort((a, b) => a.name.localeCompare(b.name)));
    setExpandedId((data as AiTool).id);
    onChanged?.();
  };

  const update = async (id: string, patch: Partial<AiTool>) => {
    setTools(tools.map((t) => t.id === id ? { ...t, ...patch } : t));
    const { error } = await (supabase.from("ai_tools" as any).update(patch).eq("id", id) as any);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else onChanged?.();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this tool?")) return;
    await (supabase.from("ai_tools" as any).delete().eq("id", id) as any);
    setTools(tools.filter((t) => t.id !== id));
    onChanged?.();
  };

  const copy = (text: string | null) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({ title: "Copied" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4" /> Tool Stack
          </DialogTitle>
          <p className="text-xs text-muted-foreground">All the AI tools your team uses — with login info and notes.</p>
        </DialogHeader>

        <div className="space-y-3">
          {adding ? (
            <Card className="p-3 space-y-2 border-primary/30">
              <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Tool name (e.g. Lovable)" className="h-9" />
              <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="URL (optional)" className="h-9" />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setNewName(""); setNewUrl(""); }}>Cancel</Button>
                <Button size="sm" onClick={create} disabled={!newName.trim()}>Add tool</Button>
              </div>
            </Card>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="w-full">
              <Plus className="h-3.5 w-3.5 mr-1" /> New tool
            </Button>
          )}

          {loading ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : tools.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No tools yet. Add your first one above.</p>
          ) : (
            <div className="space-y-1.5">
              {tools.map((t) => {
                const expanded = expandedId === t.id;
                return (
                  <Card key={t.id} className="overflow-hidden">
                    <button
                      onClick={() => setExpandedId(expanded ? null : t.id)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50 text-left"
                    >
                      {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className="text-sm font-medium flex-1 truncate">{t.name}</span>
                      {t.url && (
                        <a href={t.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-muted-foreground hover:text-foreground">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </button>
                    {expanded && (
                      <div className="px-3 pb-3 pt-1 space-y-2 border-t">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-muted-foreground">Name</Label>
                            <Input defaultValue={t.name} onBlur={(e) => e.target.value !== t.name && update(t.id, { name: e.target.value })} className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-muted-foreground">URL</Label>
                            <Input defaultValue={t.url ?? ""} onBlur={(e) => update(t.id, { url: e.target.value || null })} className="h-8 text-xs" placeholder="https://..." />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-muted-foreground">Login email</Label>
                            <div className="flex gap-1">
                              <Input defaultValue={t.login_email ?? ""} onBlur={(e) => update(t.id, { login_email: e.target.value || null })} className="h-8 text-xs" />
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copy(t.login_email)}><Copy className="h-3 w-3" /></Button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-muted-foreground">Username</Label>
                            <Input defaultValue={t.login_username ?? ""} onBlur={(e) => update(t.id, { login_username: e.target.value || null })} className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1 col-span-2">
                            <Label className="text-[10px] uppercase text-muted-foreground">Password</Label>
                            <div className="flex gap-1">
                              <Input
                                type={showPwd[t.id] ? "text" : "password"}
                                defaultValue={t.login_password ?? ""}
                                onBlur={(e) => update(t.id, { login_password: e.target.value || null })}
                                className="h-8 text-xs font-mono"
                              />
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setShowPwd({ ...showPwd, [t.id]: !showPwd[t.id] })}>
                                {showPwd[t.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copy(t.login_password)}><Copy className="h-3 w-3" /></Button>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground">Notes</Label>
                          <Textarea
                            defaultValue={t.notes ?? ""}
                            onBlur={(e) => update(t.id, { notes: e.target.value || null })}
                            placeholder="Plan, MFA backup, API quirks, who owns this..."
                            rows={3}
                            className="text-xs"
                          />
                        </div>
                        <div className="flex justify-end pt-1">
                          <Button variant="ghost" size="sm" onClick={() => remove(t.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-3 w-3 mr-1" /> Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
