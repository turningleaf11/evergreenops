import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, ArrowLeft, Clock, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface ArchiveEntry {
  id: string;
  content: string;
  triaged_count: number;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function stripPreview(html: string, max = 80): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  const text = (div.textContent || "").trim();
  if (text) return text.slice(0, max) + (text.length > max ? "…" : "");
  // No text — see if there are images
  const imgs = div.querySelectorAll("img").length;
  if (imgs > 0) return `${imgs} image${imgs > 1 ? "s" : ""}`;
  return "(empty)";
}

export function ScratchPadHistorySheet({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ArchiveEntry | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    supabase
      .from("ceo_scratch_pad_archive")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) setEntries(data as ArchiveEntry[]);
        setLoading(false);
      });
  }, [open, user]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("ceo_scratch_pad_archive").delete().eq("id", id);
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" });
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (selected?.id === id) setSelected(null);
    toast({ title: "Removed from history" });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {selected ? (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7 -ml-2" onClick={() => setSelected(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Clock className="h-4 w-4 text-primary" />
                {new Date(selected.created_at).toLocaleString()}
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 text-primary" />
                Scratch Pad History
              </>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 mt-4 pr-3">
          {selected ? (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                {selected.triaged_count} item{selected.triaged_count === 1 ? "" : "s"} triaged
              </div>
              <div
                className="prose prose-sm max-w-none text-foreground [&_img]:rounded-lg [&_img]:max-w-full"
                dangerouslySetInnerHTML={{ __html: selected.content || "<p class='text-muted-foreground italic'>(empty)</p>" }}
              />
            </div>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <FileText className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No archived sessions yet.</p>
              <p className="text-xs mt-1">Press the AI button to file your first page.</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="group flex items-start gap-2 rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelected(e)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                      </span>
                      {e.triaged_count > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                          {e.triaged_count} item{e.triaged_count === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground line-clamp-2">{stripPreview(e.content)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      handleDelete(e.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
