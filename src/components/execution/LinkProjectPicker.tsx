import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, FolderKanban, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Project { id: string; title: string; goal_id: string | null; status: string; }

interface LinkProjectPickerProps {
  goalId: string;
  allProjects: Project[];
  onLinked: () => void;
}

export default function LinkProjectPicker({ goalId, allProjects, onLinked }: LinkProjectPickerProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const candidates = useMemo(() => {
    const q = search.toLowerCase();
    return allProjects
      .filter(p => p.goal_id !== goalId)
      .filter(p => !q || p.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [allProjects, goalId, search]);

  const linkExisting = async (projectId: string) => {
    const { error } = await supabase.from("projects").update({ goal_id: goalId }).eq("id", projectId);
    if (error) toast.error(error.message);
    else { toast.success("Project linked"); setOpen(false); setSearch(""); onLinked(); }
  };

  const createLinked = async () => {
    const title = search.trim() || "New project";
    const { error } = await supabase.from("projects").insert({
      title, goal_id: goalId, owner_id: user?.id, created_by: user?.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Project created and linked"); setOpen(false); setSearch(""); onLinked(); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs">
          <Plus className="h-3.5 w-3.5 mr-1" /> Link project
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-2 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search or create…"
              className="h-8 pl-7 text-sm"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {candidates.map(p => (
            <button
              key={p.id}
              onClick={() => linkExisting(p.id)}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <FolderKanban className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{p.title}</span>
            </button>
          ))}
          {candidates.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">No matching projects</p>
          )}
        </div>
        <div className="border-t border-border/50 p-1">
          <button
            onClick={createLinked}
            className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-primary/10 text-primary transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            Create {search.trim() ? `"${search.trim()}"` : "new project"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
