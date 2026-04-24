import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";
import { FormFieldRenderer, RenderField } from "@/components/databases/FormFieldRenderer";

const FUNCTIONS_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

export default function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ title: string; description: string; submit_message: string; fields: RenderField[] } | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`${FUNCTIONS_BASE}/list-form/${slug}`)
      .then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Form not found");
        setForm(j);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await fetch(`${FUNCTIONS_BASE}/list-form/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Submission failed");
      setDone(j.message || "Thanks!");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 flex items-start justify-center p-4 sm:p-8">
      <Card className="w-full max-w-xl p-6 sm:p-8 mt-4 sm:mt-12">
        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading form…
          </div>
        )}

        {!loading && error && !form && (
          <div className="text-center py-8">
            <div className="text-lg font-medium">Form not found</div>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        )}

        {!loading && form && done && (
          <div className="text-center py-8 space-y-3">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
            <div className="text-lg font-medium">Submitted</div>
            <p className="text-sm text-muted-foreground">{done}</p>
          </div>
        )}

        {!loading && form && !done && (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-semibold">{form.title}</h1>
              {form.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{form.description}</p>}
            </div>
            <div className="space-y-4">
              {form.fields.map(f => (
                <FormFieldRenderer
                  key={f.column_id}
                  field={f}
                  value={values[f.column_id]}
                  onChange={(v) => setValues(prev => ({ ...prev, [f.column_id]: v }))}
                />
              ))}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={submit} disabled={submitting} className="w-full">
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
