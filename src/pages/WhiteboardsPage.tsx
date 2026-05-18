// WhiteboardsPage — top-level whiteboards list.
// Click a card → opens the canvas at /whiteboards/:id

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Layers, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { appConfirm } from "@/components/AppConfirm";
import { formatDistanceToNow } from "date-fns";

const sb = supabase as any;

type Whiteboard = {
  id: string;
  title: string;
  description: string;
  cover_color: string;
  updated_at: string;
  created_at: string;
  created_by: string | null;
};

function relTime(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ""; }
}

export default function WhiteboardsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<Whiteboard[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await sb
      .from("whiteboards")
      .select("id, title, description, cover_color, updated_at, created_at, created_by")
      .order("updated_at", { ascending: false });
    setBoards((data ?? []) as Whiteboard[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createBoard = async () => {
    if (!user) return;
    const { data: prof } = await sb.from("profiles").select("workspace_id").eq("user_id", user.id).maybeSingle();
    const { data, error } = await sb.from("whiteboards").insert({
      title: "Untitled Whiteboard",
      created_by: user.id,
      workspace_id: (prof as any)?.workspace_id ?? null,
    }).select("id").single();
    if (error || !data) { toast.error(error?.message || "Couldn't create whiteboard"); return; }
    navigate(`/whiteboards/${data.id}`);
  };

  const remove = async (id: string) => {
    if (!(await appConfirm({ title: "Delete this whiteboard?", confirmLabel: "Delete", destructive: true }))) return;
    setBoards((prev) => prev.filter((b) => b.id !== id));
    await sb.from("whiteboards").delete().eq("id", id);
  };

  return (
    <div className="p-6 max-w-[1500px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Whiteboards</h1>
        </div>
        <button
          onClick={createBoard}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> New whiteboard
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : boards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/40 p-12 text-center space-y-3">
          <Layers className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <h2 className="text-lg font-semibold">No whiteboards yet</h2>
          <p className="text-sm text-muted-foreground">Drag shapes, draw, drop sticky notes, connect ideas. Project planning + brainstorming surface.</p>
          <button
            onClick={createBoard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Create your first whiteboard
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {boards.map((b) => (
            <div
              key={b.id}
              className="group relative rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-md transition-all overflow-hidden"
            >
              <Link to={`/whiteboards/${b.id}`} className="block">
                <div className="h-24" style={{ background: `linear-gradient(135deg, ${b.cover_color}, ${b.cover_color}66)` }} />
                <div className="p-4 space-y-1">
                  <h3 className="text-sm font-semibold text-foreground truncate">{b.title}</h3>
                  {b.description && <p className="text-xs text-muted-foreground line-clamp-2">{b.description}</p>}
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Updated {relTime(b.updated_at)}</p>
                </div>
              </Link>
              {b.created_by === user?.id && (
                <button
                  onClick={() => remove(b.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 h-7 w-7 rounded-md bg-background/80 backdrop-blur border border-border/40 text-muted-foreground hover:text-destructive flex items-center justify-center"
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
