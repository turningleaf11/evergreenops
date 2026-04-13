import { useTraining } from "@/contexts/TrainingContext";
import { useTrainingProgress } from "@/lib/training-progress";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { X, Sparkles } from "lucide-react";

export function OnboardingBanner() {
  const {
    onboardingDismissed,
    dismissOnboarding,
    completedOnboardingSteps,
    markOnboardingStepComplete,
    isOnboardingStepComplete,
    onboardingProgress,
  } = useTrainingProgress();
  const { onboardingSteps } = useTraining();

  if (onboardingDismissed) return null;

  const allDone = completedOnboardingSteps.length >= onboardingSteps.length;

  return (
    <Card className="border-l-4 border-l-primary bg-primary/[0.03]">
      <CardContent className="py-5 px-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                {allDone ? "You're all set! 🎉" : "Welcome to TeamSpace"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {allDone
                  ? "You've completed all onboarding steps. You can dismiss this banner."
                  : "Complete these steps to get up to speed quickly."}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={dismissOnboarding}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Progress value={onboardingProgress} className="h-1.5 flex-1" />
          <span className="text-[10px] text-muted-foreground shrink-0">{onboardingProgress}%</span>
        </div>

        <div className="space-y-2">
          {onboardingSteps.map((step) => {
            const checked = isOnboardingStepComplete(step.id);
            return (
              <div key={step.id} className="flex items-start gap-3 py-1">
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => {
                    if (!checked) markOnboardingStepComplete(step.id);
                  }}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${checked ? "line-through text-muted-foreground" : ""}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
                {step.link && !checked && (
                  <Link to={step.link}>
                    <Button variant="outline" size="sm" className="text-xs h-7 shrink-0">
                      {step.linkLabel || "Go"}
                    </Button>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
