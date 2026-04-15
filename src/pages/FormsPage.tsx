import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Send, CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

interface FormTemplate {
  id: string;
  name: string;
  description: string;
  fields: { name: string; type: string; required?: boolean; options?: string[] }[];
  is_active: boolean;
}

interface FormSubmission {
  id: string;
  template_id: string;
  values: Record<string, any>;
  status: string;
  review_notes: string;
  created_at: string;
}

export default function FormsPage() {
  const { user, isAdmin } = useAuth();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [fillOpen, setFillOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<FormTemplate | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [tRes, sRes] = await Promise.all([
      supabase.from("form_templates").select("*").eq("is_active", true).order("name"),
      isAdmin
        ? supabase.from("form_submissions").select("*").order("created_at", { ascending: false })
        : supabase.from("form_submissions").select("*").eq("submitted_by", user.id).order("created_at", { ascending: false }),
    ]);
    if (tRes.data) setTemplates(tRes.data as any as FormTemplate[]);
    if (sRes.data) setSubmissions(sRes.data as any as FormSubmission[]);
  }, [user, isAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openForm = (template: FormTemplate) => {
    setActiveTemplate(template);
    setFormValues({});
    setFillOpen(true);
  };

  const submitForm = async () => {
    if (!user || !activeTemplate) return;
    // Validate required fields
    for (const field of activeTemplate.fields) {
      if (field.required && !formValues[field.name]?.toString().trim()) {
        toast.error(`${field.name} is required`);
        return;
      }
    }
    const { error } = await supabase.from("form_submissions").insert({
      template_id: activeTemplate.id,
      submitted_by: user.id,
      values: formValues,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Form submitted!");
    setFillOpen(false);
    fetchData();
  };

  const updateSubmissionStatus = async (id: string, status: string) => {
    if (!user) return;
    await supabase.from("form_submissions").update({ status, reviewed_by: user.id } as any).eq("id", id);
    fetchData();
    toast.success(`Request ${status}`);
  };

  const statusIcon: Record<string, React.ReactNode> = {
    pending: <Clock className="h-3.5 w-3.5 text-amber-500" />,
    approved: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
    denied: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  };

  const getTemplateName = (id: string) => templates.find(t => t.id === id)?.name || "Unknown";

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Forms & Requests</h1>
        <p className="text-sm text-muted-foreground">Submit and track internal requests</p>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Available Forms</TabsTrigger>
          <TabsTrigger value="submissions">My Submissions</TabsTrigger>
          {isAdmin && <TabsTrigger value="review">Review Queue</TabsTrigger>}
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          {templates.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No form templates available yet.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {templates.map(t => (
                <Card key={t.id} className="hover:border-primary/40 transition-colors cursor-pointer" onClick={() => openForm(t)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{t.name}</p>
                        {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                        <p className="text-[10px] text-muted-foreground mt-1">{t.fields.length} field(s)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="submissions" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {submissions.filter(s => s.submitted_by === user?.id || !isAdmin).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No submissions yet</p>
              ) : (
                <div className="space-y-2">
                  {submissions.map(s => (
                    <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        {statusIcon[s.status]}
                        <div>
                          <p className="text-sm font-medium">{getTemplateName(s.template_id)}</p>
                          <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="capitalize text-xs">{s.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="review" className="mt-4">
            <Card>
              <CardContent className="p-4">
                {submissions.filter(s => s.status === "pending").length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No pending requests</p>
                ) : (
                  <div className="space-y-2">
                    {submissions.filter(s => s.status === "pending").map(s => (
                      <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-border">
                        <div>
                          <p className="text-sm font-medium">{getTemplateName(s.template_id)}</p>
                          <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(s.values).map(([k, v]) => (
                              <Badge key={k} variant="outline" className="text-[10px]">{k}: {String(v)}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => updateSubmissionStatus(s.id, "approved")} className="h-7 text-xs text-green-600">Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => updateSubmissionStatus(s.id, "denied")} className="h-7 text-xs text-red-600">Deny</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Fill Form Dialog */}
      <Dialog open={fillOpen} onOpenChange={setFillOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{activeTemplate?.name}</DialogTitle></DialogHeader>
          {activeTemplate?.description && <p className="text-sm text-muted-foreground">{activeTemplate.description}</p>}
          <div className="space-y-3">
            {activeTemplate?.fields.map((field) => (
              <div key={field.name}>
                <label className="text-xs text-muted-foreground">
                  {field.name} {field.required && <span className="text-destructive">*</span>}
                </label>
                {field.type === "select" && field.options ? (
                  <Select value={formValues[field.name] || ""} onValueChange={v => setFormValues(prev => ({ ...prev, [field.name]: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {field.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : field.type === "textarea" ? (
                  <Textarea
                    value={formValues[field.name] || ""}
                    onChange={e => setFormValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                    className="mt-1 min-h-[60px]"
                  />
                ) : field.type === "date" ? (
                  <Input
                    type="date"
                    value={formValues[field.name] || ""}
                    onChange={e => setFormValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                    className="mt-1"
                  />
                ) : (
                  <Input
                    value={formValues[field.name] || ""}
                    onChange={e => setFormValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                    className="mt-1"
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFillOpen(false)}>Cancel</Button>
            <Button onClick={submitForm} className="gap-1.5"><Send className="h-3.5 w-3.5" /> Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
