import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, ChevronDown } from "lucide-react";
import { FormSubmitDialog } from "./FormSubmitDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Form {
  id: string;
  name: string;
  description: string | null;
}

export function FormsWidget() {
  const [forms, setForms] = useState<Form[]>([]);
  const [activeFormId, setActiveFormId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("form_templates")
      .select("id, name, description")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setForms(data as Form[]);
      });
  }, []);

  return (
    <Card>
      <CardContent className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors group">
            <span className="text-sm font-medium flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground/70" />
              Submit a form
              <span className="text-[10px] text-muted-foreground font-normal">
                · {forms.length}
              </span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
            {forms.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">No active forms</div>
            ) : (
              forms.map((f) => (
                <DropdownMenuItem
                  key={f.id}
                  onClick={() => setActiveFormId(f.id)}
                  className="flex flex-col items-start gap-0.5 cursor-pointer"
                >
                  <span className="text-xs font-medium">{f.name}</span>
                  {f.description && (
                    <span className="text-[10px] text-muted-foreground line-clamp-1">{f.description}</span>
                  )}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
      <FormSubmitDialog
        formId={activeFormId}
        open={!!activeFormId}
        onOpenChange={(o) => { if (!o) setActiveFormId(null); }}
      />
    </Card>
  );
}
