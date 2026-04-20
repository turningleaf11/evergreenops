import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { FileText, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useMentionPeek } from "@/components/mention-peek/MentionPeekProvider";

interface Doc {
  id: string;
  title: string;
  icon: string | null;
  updated_at: string;
}

export function RecentDocsWidget() {
  const [docs, setDocs] = useState<Doc[]>([]);

  useEffect(() => {
    supabase
      .from("documents")
      .select("id, title, icon, updated_at")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setDocs(data as Doc[]);
      });
  }, []);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground/70" /> Recent Docs
          </h2>
          <Link to="/docs" className="text-xs text-primary hover:underline flex items-center gap-1">
            All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {docs.length === 0 ? (
          <div className="py-4 text-center">
            <FileText className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">No documents yet</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {docs.map((d) => (
              <button
                key={d.id}
                onClick={() => openPeek("doc", d.id)}
                className="w-full flex items-center gap-2 py-1.5 px-1.5 rounded-md hover:bg-muted/40 transition-colors group text-left"
              >
                <span className="text-sm shrink-0 w-4 text-center">
                  {d.icon || "📄"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate group-hover:text-foreground">{d.title}</p>
                  <p className="text-[10px] text-muted-foreground/70">
                    {formatDistanceToNow(new Date(d.updated_at), { addSuffix: true })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
