import { useState } from "react";
import { databaseTemplates } from "@/lib/mock-data";
import type { DatabaseColumn, Visibility, SharedWith } from "@/lib/mock-data";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Target, FolderKanban, CheckSquare, Bug, Calendar, Plus } from "lucide-react";
import AccessPicker from "@/components/AccessPicker";

const iconMap: Record<string, React.ElementType> = {
  Target, FolderKanban, CheckSquare, Bug, Calendar, Plus,
};

interface CreateDatabaseDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string, description: string, columns: DatabaseColumn[], icon: string, visibility: Visibility, sharedWith: SharedWith) => void;
}

export default function CreateDatabaseDialog({ open, onClose, onCreate }: CreateDatabaseDialogProps) {
  const [step, setStep] = useState<"template" | "details">("template");
  const [selectedTemplate, setSelectedTemplate] = useState<typeof databaseTemplates[0] | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("workspace");
  const [sharedWith, setSharedWith] = useState<SharedWith>({ departmentIds: [], memberIds: [] });

  const handleClose = () => {
    setStep("template");
    setSelectedTemplate(null);
    setTitle("");
    setDescription("");
    setVisibility("workspace");
    setSharedWith({ departmentIds: [], memberIds: [] });
    onClose();
  };

  const handleSelectTemplate = (template: typeof databaseTemplates[0]) => {
    setSelectedTemplate(template);
    setTitle(template.id === "blank" ? "" : template.title);
    setDescription(template.description);
    setStep("details");
  };

  const handleCreate = () => {
    if (!selectedTemplate || !title.trim()) return;
    onCreate(title.trim(), description, selectedTemplate.columns, selectedTemplate.icon, visibility, sharedWith);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{step === "template" ? "Choose a Template" : "Database Details"}</DialogTitle>
        </DialogHeader>

        {step === "template" && (
          <div className="grid grid-cols-2 gap-3 py-2">
            {databaseTemplates.map(t => {
              const Icon = iconMap[t.icon] || Plus;
              return (
                <Card key={t.id} className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all" onClick={() => handleSelectTemplate(t)}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4 text-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {step === "details" && (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Database Name</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="My Database" className="h-9" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this database for?" className="h-9" />
            </div>
            {selectedTemplate && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Columns</Label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTemplate.columns.map(col => (
                    <span key={col.id} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{col.name} · {col.type}</span>
                  ))}
                </div>
              </div>
            )}
            <AccessPicker
              visibility={visibility}
              sharedWith={sharedWith}
              onChange={(v, s) => { setVisibility(v); setSharedWith(s); }}
            />
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setStep("template")}>Back</Button>
              <Button size="sm" onClick={handleCreate} disabled={!title.trim()}>Create Database</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
