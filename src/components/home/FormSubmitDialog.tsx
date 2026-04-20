import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Field {
  name: string;
  type: string;
  required?: boolean;
  options?: string[];
}

interface FormSubmitDialogProps {
  formId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FormSubmitDialog({ formId, open, onOpenChange }: FormSubmitDialogProps) {
  const { user } = useAuth();
  const [template, setTemplate] = useState<{ id: string; name: string; description: string | null; fields: Field[] } | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !formId) return;
    setValues({});
    supabase
      .from("form_templates")
      .select("id, name, description, fields")
      .eq("id", formId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setTemplate(data as any);
      });
  }, [formId, open]);

  const submit = async () => {
    if (!user || !template) return;
    for (const f of template.fields) {
      if (f.required && !values[f.name]?.toString().trim()) {
        toast.error(`${f.name} is required`);
        return;
      }
    }
    setSubmitting(true);
    const { error } = await supabase.from("form_submissions").insert({
      template_id: template.id,
      submitted_by: user.id,
      values,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Form submitted!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template?.name || "Form"}</DialogTitle>
          {template?.description && (
            <p className="text-sm text-muted-foreground">{template.description}</p>
          )}
        </DialogHeader>
        <div className="space-y-4 py-2">
          {template?.fields.map((f) => (
            <div key={f.name} className="space-y-1.5">
              <Label className="text-xs font-medium">
                {f.name}
                {f.required && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              {f.type === "textarea" ? (
                <Textarea
                  value={values[f.name] || ""}
                  onChange={(e) => setValues((p) => ({ ...p, [f.name]: e.target.value }))}
                  rows={3}
                />
              ) : f.type === "select" ? (
                <Select value={values[f.name] || ""} onValueChange={(v) => setValues((p) => ({ ...p, [f.name]: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {(f.options || []).map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                  value={values[f.name] || ""}
                  onChange={(e) => setValues((p) => ({ ...p, [f.name]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
