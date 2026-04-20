import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props { id: string; open: boolean; onClose: () => void; }

export default function RecordPeek({ id, open, onClose }: Props) {
  const navigate = useNavigate();
  const [row, setRow] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);

  useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("database_rows").select("*").eq("id", id).maybeSingle();
      if (cancelled) return;
      setRow(data);
      if (data?.database_id) {
        const { data: m } = await supabase.from("databases_meta").select("id, title, columns").eq("id", data.database_id).maybeSingle();
        if (!cancelled) setMeta(m);
      }
    })();
    return () => { cancelled = true; };
  }, [id, open]);

  const v = row?.values || {};
  const columns: Array<{ id: string; name: string; type: string }> = (meta?.columns as any) || [];
  const title = v.title || v.name || columns[0] && v[columns[0].id] || "Record";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-6">
        <SheetHeader className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Database className="h-3.5 w-3.5 text-primary/70" />
            <span className="font-medium">{meta?.title || "Record"}</span>
          </div>
          <SheetTitle className="text-xl">{String(title)}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {columns.map((col) => {
            const val = v[col.id];
            if (val === undefined || val === null || val === "") return null;
            return (
              <div key={col.id} className="grid grid-cols-3 gap-3 py-2 border-b border-border/30 text-sm">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{col.name}</span>
                <div className="col-span-2 break-words">
                  {Array.isArray(val) ? (
                    <div className="flex flex-wrap gap-1">
                      {val.map((x, i) => <Badge key={i} variant="secondary" className="text-[11px] rounded-full">{String(x)}</Badge>)}
                    </div>
                  ) : (
                    <span>{String(val)}</span>
                  )}
                </div>
              </div>
            );
          })}

          <div className="pt-4">
            <Button variant="outline" size="sm" className="w-full" onClick={() => { onClose(); navigate(`/databases/${meta?.id || ""}`); }}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open in list
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
