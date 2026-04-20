import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ClipboardList, ArrowRight } from "lucide-react";

interface Form {
  id: string;
  name: string;
  description: string | null;
}

export function FormsWidget() {
  const [forms, setForms] = useState<Form[]>([]);

  useEffect(() => {
    supabase
      .from("form_templates")
      .select("id, name, description")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (data) setForms(data as Form[]);
      });
  }, []);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground/70" /> Forms
          </h2>
          <Link to="/forms" className="text-xs text-primary hover:underline flex items-center gap-1">
            All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {forms.length === 0 ? (
          <div className="py-4 text-center">
            <ClipboardList className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">No active forms</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {forms.map((f) => (
              <Link
                key={f.id}
                to="/forms"
                className="px-3 py-2 rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/40 hover:border-border transition-colors group min-w-0"
              >
                <p className="text-xs font-medium truncate group-hover:text-foreground">{f.name}</p>
                {f.description && (
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{f.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
