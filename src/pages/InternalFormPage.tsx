import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";
import { FormFieldRenderer, RenderField } from "@/components/databases/FormFieldRenderer";
import { toast } from "@/hooks/use-toast";

export default function InternalFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null);
  const [columns, setColumns] = useState<any[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: f } = await supabase
        .from("database_forms")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (!f) { setLoading(false); return; }
      const { data: meta } = await supabase
        .from("databases_meta")
        .select("columns")
        .eq("id", f.database_id)
        .maybeSingle();
      setForm(f);
      setColumns(((meta?.columns as any) || []));
      setLoading(false);
    })();
  }, [slug]);

  const fields: RenderField[] = (form?.fields || []).map((f: any) => {
    const col = columns.find(c => c.id === f.column_id);
    return col ? {
      column_id: f.column_id,
      name: col.name,
      type: col.type,
      options: col.options,
      label: f.label || col.name,
      help_text: f.help_text,
      required: !!f.required,
    } : null;
  }).filter(Boolean) as RenderField[];

  const submit = async () => {
    if (!form) return;
    for (const f of fields) {
      const v = values[f.column_id];
      if (f.required && (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0))) {
        toast({ title: `${f.label} is required`, variant: "destructive" });
        return;
      }
    }
    setSubmitting(true);
    const { error } = await supabase.from("database_rows").insert({ database_id: form.database_id, values });
    setSubmitting(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setDone(form.submit_message || "Thanks!");
  };

  return (
    <div className="min-h-screen bg-muted/20 flex items-start justify-center p-4 sm:p-8">
      <Card className="w-full max-w-xl p-6 sm:p-8 mt-4 sm:mt-12">
        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading form…
          </div>
        )}
        {!loading && !form && (
          <div className="text-center py-8">
            <div className="text-lg font-medium">Form not found</div>
            <p className="text-sm text-muted-foreground mt-1">It may have been disabled or removed.</p>
          </div>
        )}
        {!loading && form && done && (
          <div className="text-center py-8 space-y-3">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
            <div className="text-lg font-medium">Submitted</div>
            <p className="text-sm text-muted-foreground">{done}</p>
            <Button variant="outline" size="sm" onClick={() => { setDone(null); setValues({}); }}>Submit another</Button>
          </div>
        )}
        {!loading && form && !done && (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-semibold">{form.title}</h1>
              {form.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{form.description}</p>}
            </div>
            <div className="space-y-4">
              {fields.map(f => (
                <FormFieldRenderer
                  key={f.column_id}
                  field={f}
                  value={values[f.column_id]}
                  onChange={(v) => setValues(prev => ({ ...prev, [f.column_id]: v }))}
                />
              ))}
            </div>
            <Button onClick={submit} disabled={submitting} className="w-full">
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
