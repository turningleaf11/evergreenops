import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileText, StickyNote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  id: string;
  open: boolean;
  onClose: () => void;
  variant: "doc" | "note";
}

export default function DocPeek({ id, open, onClose, variant }: Props) {
  const navigate = useNavigate();
  const [doc, setDoc] = useState<any>(null);

  useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    (async () => {
      const table = variant === "doc" ? "documents" : "notes";
      const { data } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
      if (!cancelled) setDoc(data);
    })();
    return () => { cancelled = true; };
  }, [id, open, variant]);

  const Icon = variant === "doc" ? FileText : StickyNote;
  const label = variant === "doc" ? "Document" : "Note";
  const openPath = variant === "doc" ? `/docs?id=${id}` : `/notes?id=${id}`;
  const maxW = variant === "doc" ? "max-w-3xl" : "max-w-2xl";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${maxW} max-h-[85vh] overflow-hidden flex flex-col p-0`}>
        <DialogHeader className="px-7 pt-6 pb-4 border-b border-border/50 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5 text-primary/70" />
            <span className="font-medium">{label}</span>
          </div>
          <DialogTitle className="text-2xl">{doc?.title || "Loading..."}</DialogTitle>
          {doc?.tags && doc.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {doc.tags.map((t: string) => (
                <Badge key={t} variant="secondary" className="text-[11px] rounded-full">{t}</Badge>
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="overflow-y-auto px-7 py-6 flex-1">
          {doc?.content ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: doc.content }}
            />
          ) : (
            <p className="text-sm text-muted-foreground italic">No content yet.</p>
          )}
        </div>

        <div className="px-7 py-4 border-t border-border/50 flex justify-end bg-muted/20">
          <Button size="sm" onClick={() => { onClose(); navigate(openPath); }}>
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open full {label.toLowerCase()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
