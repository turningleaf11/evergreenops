import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Rocket, Plus, X, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function LauncherMenu() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_favorites")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true });
    if (data) setFavorites(data);
  };

  useEffect(() => { if (open) load(); }, [open, user]);

  const add = async () => {
    if (!user || !label.trim() || !url.trim()) return;
    let cleanUrl = url.trim();
    if (!/^https?:\/\//.test(cleanUrl)) cleanUrl = "https://" + cleanUrl;
    const { error } = await supabase.from("user_favorites").insert({
      user_id: user.id,
      label: label.trim(),
      url: cleanUrl,
      sort_order: favorites.length,
    });
    if (error) { toast.error(error.message); return; }
    setLabel(""); setUrl(""); setAdding(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("user_favorites").delete().eq("id", id);
    setFavorites(favorites.filter((f) => f.id !== id));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Launcher">
          <Rocket className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <div className="flex items-center justify-between px-2 pt-1 pb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Launcher</span>
          {!adding && (
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => setAdding(true)}>
              <Plus className="h-3 w-3" /> Add
            </Button>
          )}
        </div>

        {adding && (
          <div className="space-y-1.5 p-2 bg-muted/40 rounded-md mb-2">
            <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 text-sm" />
            <Input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} className="h-8 text-sm" />
            <div className="flex gap-1 justify-end">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAdding(false); setLabel(""); setUrl(""); }}>Cancel</Button>
              <Button size="sm" className="h-7 text-xs" onClick={add} disabled={!label.trim() || !url.trim()}>Save</Button>
            </div>
          </div>
        )}

        <div className="max-h-72 overflow-auto space-y-0.5">
          {favorites.length === 0 && !adding && (
            <p className="text-xs text-muted-foreground text-center py-6">No links yet. Add your favorite tools.</p>
          )}
          {favorites.map((f) => (
            <div key={f.id} className="group flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/60">
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center gap-2 text-sm truncate"
              >
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                <span className="truncate">{f.label}</span>
              </a>
              <button onClick={() => remove(f.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
