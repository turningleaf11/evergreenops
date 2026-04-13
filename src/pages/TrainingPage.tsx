import { useState } from "react";
import { useTraining } from "@/contexts/TrainingContext";
import type { TrainingModule, TrainingCategory } from "@/lib/training-data";
import { useTrainingProgress } from "@/lib/training-progress";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import {
  BookOpen, PlayCircle, ListChecks, Link2, FileText,
  ExternalLink, CheckCircle2, Circle,
} from "lucide-react";

const typeIcons: Record<string, React.ElementType> = {
  guide: BookOpen,
  playbook: ListChecks,
  checklist: ListChecks,
  video: PlayCircle,
  link: Link2,
};

const categories: TrainingCategory[] = ["Onboarding", "Role Training", "Processes", "Tools"];

export default function TrainingPage() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const { isStepComplete, markStepComplete, markStepIncomplete, getModuleProgress, isModuleComplete } = useTrainingProgress();
  const { profile } = useAuth();
  const { modules: trainingModules } = useTraining();

  // Filter modules by role — show all if roleIds is empty, otherwise match user dept
  const userDept = profile?.department_id?.toLowerCase() || "";
  const visibleModules = trainingModules.filter(
    (m) => m.roleIds.length === 0 || m.roleIds.some((r) => userDept.includes(r))
  );

  const filtered = activeCategory === "all"
    ? visibleModules
    : visibleModules.filter((m) => m.category === activeCategory);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Training Hub</h1>
        <p className="text-muted-foreground mt-1">
          Access onboarding materials, role training, and company resources.
        </p>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {categories.map((cat) => (
            <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeCategory} className="mt-4">
          <div className="space-y-3">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">No training modules in this category.</p>
            )}
            <Accordion type="multiple" className="space-y-3">
              {filtered.map((mod) => (
                <ModuleCard
                  key={mod.id}
                  module={mod}
                  isStepComplete={isStepComplete}
                  markStepComplete={markStepComplete}
                  markStepIncomplete={markStepIncomplete}
                  progress={getModuleProgress(mod.id, mod.steps.length)}
                  complete={isModuleComplete(mod.id, mod.steps.length)}
                />
              ))}
            </Accordion>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ModuleCard({
  module: mod,
  isStepComplete,
  markStepComplete,
  markStepIncomplete,
  progress,
  complete,
}: {
  module: TrainingModule;
  isStepComplete: (moduleId: string, stepId: string) => boolean;
  markStepComplete: (moduleId: string, stepId: string) => void;
  markStepIncomplete: (moduleId: string, stepId: string) => void;
  progress: number;
  complete: boolean;
}) {
  const Icon = typeIcons[mod.type] || FileText;
  const StatusIcon = complete ? CheckCircle2 : Circle;

  return (
    <AccordionItem value={mod.id} className="border rounded-lg overflow-hidden">
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
        <div className="flex items-center gap-3 w-full mr-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate">{mod.title}</p>
              <Badge variant="secondary" className="text-[10px] shrink-0">{mod.category}</Badge>
              <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${complete ? "text-green-500" : "text-muted-foreground/40"}`} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{mod.description}</p>
          </div>
          <div className="w-16 shrink-0">
            <Progress value={progress} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground text-right mt-0.5">{progress}%</p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-3 pt-2">
          {mod.steps.map((step) => {
            const checked = isStepComplete(mod.id, step.id);
            return (
              <div key={step.id} className="flex gap-3">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(val) =>
                    val ? markStepComplete(mod.id, step.id) : markStepIncomplete(mod.id, step.id)
                  }
                  className="mt-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className={`text-sm font-medium ${checked ? "line-through text-muted-foreground" : ""}`}>
                    {step.title}
                  </p>
                  {step.content && (
                    <p className="text-xs text-muted-foreground whitespace-pre-line">{step.content}</p>
                  )}
                  {step.videoUrl && (
                    <div className="mt-2 rounded-lg overflow-hidden border aspect-video max-w-lg">
                      <iframe
                        src={step.videoUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={step.title}
                      />
                    </div>
                  )}
                  {step.externalUrl && (
                    <a
                      href={step.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {step.externalLabel || "Open link"}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
