import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, ArrowRight, ArrowLeft, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Each step maps to either a vision section, the goals table (rocks), or the
 * pending_team_members table. We keep the question fixed but route it through
 * the AI for warm wording.
 */
type StepKind = "intro" | "vision" | "rocks" | "team" | "complete";

interface Step {
  id: string;
  label: string;
  kind: StepKind;
  /** vision section to populate (for kind === "vision") */
  visionSection?: string;
  prompt: string;
  hint?: string;
  /** Multi-line answer expected */
  multiline?: boolean;
}

const STEPS: Step[] = [
  {
    id: "welcome",
    label: "Welcome",
    kind: "intro",
    prompt: "Welcome to your HQ. Before we set anything up, I want to understand your business. This will take about 10-15 minutes and everything you share will populate your Vision Layer automatically. Let's start simple: What does your business do, and what's your name?",
    multiline: true,
  },
  {
    id: "core_focus_purpose",
    label: "Purpose",
    kind: "vision",
    visionSection: "core_focus_purpose",
    prompt: "What's the deeper purpose of your business — the reason it exists beyond making money?",
    multiline: true,
  },
  {
    id: "core_focus_niche",
    label: "Niche",
    kind: "vision",
    visionSection: "core_focus_niche",
    prompt: "What's your niche? In one sentence, what do you do better than anyone else, and for whom?",
    multiline: true,
  },
  {
    id: "core_values",
    label: "Core Values",
    kind: "vision",
    visionSection: "core_values",
    prompt: "What are the 3-5 values that define how you operate? These aren't aspirational — they're already true of you and your best people.",
    multiline: true,
  },
  {
    id: "ten_year_target",
    label: "10-Year Target",
    kind: "vision",
    visionSection: "ten_year_target",
    prompt: "Picture this business 10 years from now. What does it look like? What scale, what kind of impact?",
    multiline: true,
  },
  {
    id: "three_year_picture",
    label: "3-Year Picture",
    kind: "vision",
    visionSection: "three_year_picture",
    prompt: "Now zoom in. Three years from today, what does the business look like? Revenue, team size, what you're known for.",
    multiline: true,
  },
  {
    id: "one_year_plan",
    label: "1-Year Plan",
    kind: "vision",
    visionSection: "one_year_plan",
    prompt: "What does winning look like for your business at the end of THIS year? What do you need to accomplish?",
    multiline: true,
  },
  {
    id: "rocks",
    label: "Quarterly Rocks",
    kind: "rocks",
    prompt: "Based on your 1-year plan, what are the 2-3 most important things to accomplish THIS quarter to stay on track? List one per line.",
    multiline: true,
  },
  {
    id: "team",
    label: "Team",
    kind: "team",
    prompt: "Who's currently on your team? Just names and roles for now — one person per line, like 'Sarah Chen — Operations Lead'.",
    multiline: true,
  },
  {
    id: "complete",
    label: "Done",
    kind: "complete",
    prompt: "",
  },
];

interface ChatTurn {
  role: "ai" | "user";
  text: string;
}

function getCurrentQuarter(): { quarter: string; year: number } {
  const now = new Date();
  const m = now.getMonth();
  const q = m < 3 ? "Q1" : m < 6 ? "Q2" : m < 9 ? "Q3" : "Q4";
  return { quarter: q, year: now.getFullYear() };
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, profile, isPrimaryAdmin, refreshProfile, loading: authLoading } = useAuth();
  const { workspace } = useWorkspace() as any;

  const [stepIdx, setStepIdx] = useState(0);
  const [transcript, setTranscript] = useState<Record<string, ChatTurn[]>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resumed, setResumed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const step = STEPS[stepIdx];
  const userName = profile?.full_name?.split(" ")[0] || "";
  const workspaceName = workspace?.name || "your HQ";

  // Resume from saved progress
  useEffect(() => {
    if (authLoading || !profile) return;
    const prog = (profile as any).onboarding_progress as any;
    if (prog && typeof prog === "object" && !resumed) {
      if (prog.answers) setAnswers(prog.answers);
      if (prog.transcript) setTranscript(prog.transcript);
      if (typeof prog.stepIdx === "number") setStepIdx(Math.min(prog.stepIdx, STEPS.length - 1));
      setResumed(true);
    } else if (!resumed) {
      setResumed(true);
    }
  }, [authLoading, profile, resumed]);

  // Persist progress
  const saveProgress = useCallback(async (next: { stepIdx: number; answers: Record<string, string>; transcript: Record<string, ChatTurn[]> }) => {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ onboarding_progress: next as any })
      .eq("user_id", user.id);
  }, [user]);

  // Generate AI intro for current step on first visit
  useEffect(() => {
    if (!resumed) return;
    if (step.kind === "complete") return;
    if (transcript[step.id]?.length) return;

    let cancelled = false;
    (async () => {
      setAiLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("onboarding-ai", {
          body: {
            mode: "intro",
            step: { id: step.id, prompt: step.prompt, label: step.label },
            userName,
            workspaceName,
          },
        });
        if (cancelled) return;
        const text = (data as any)?.text || step.prompt;
        const next = { ...transcript, [step.id]: [{ role: "ai" as const, text }] };
        setTranscript(next);
        saveProgress({ stepIdx, answers, transcript: next });
      } catch {
        if (cancelled) return;
        const next = { ...transcript, [step.id]: [{ role: "ai" as const, text: step.prompt }] };
        setTranscript(next);
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumed, stepIdx]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript, stepIdx, aiLoading]);

  // Save answer + advance
  const handleSubmit = async () => {
    if (!input.trim() || submitting) return;
    const value = input.trim();
    setSubmitting(true);

    const userTurn: ChatTurn = { role: "user", text: value };
    const turns = [...(transcript[step.id] || []), userTurn];
    const newTranscript = { ...transcript, [step.id]: turns };
    const newAnswers = { ...answers, [step.id]: value };
    setTranscript(newTranscript);
    setAnswers(newAnswers);
    setInput("");

    // Persist data per step
    try {
      if (step.kind === "vision" && step.visionSection) {
        await persistVision(step.visionSection, value);
      } else if (step.id === "welcome") {
        // The welcome answer often contains "I'm <name>" — best effort: skip parsing,
        // but save the raw text into the workspace description if empty.
        // (Just save into onboarding progress; nothing else.)
      } else if (step.kind === "rocks") {
        await persistRocks(value);
      } else if (step.kind === "team") {
        await persistTeam(value);
      }
    } catch (e: any) {
      toast.error("Couldn't save: " + (e?.message || "unknown error"));
    }

    // Get a brief AI acknowledgement, then auto-advance after a short pause
    try {
      const { data } = await supabase.functions.invoke("onboarding-ai", {
        body: {
          mode: "followup",
          step: { id: step.id, prompt: step.prompt },
          lastAnswer: value,
          userName,
          workspaceName,
        },
      });
      const ack = (data as any)?.text;
      if (ack) {
        const withAck = { ...newTranscript, [step.id]: [...turns, { role: "ai" as const, text: ack }] };
        setTranscript(withAck);
        await saveProgress({ stepIdx, answers: newAnswers, transcript: withAck });
      }
    } catch {
      /* ignore */
    }

    // Advance
    const nextIdx = Math.min(stepIdx + 1, STEPS.length - 1);
    await saveProgress({ stepIdx: nextIdx, answers: newAnswers, transcript: { ...newTranscript } });
    setTimeout(() => {
      setStepIdx(nextIdx);
      setSubmitting(false);
    }, 700);
  };

  // Persistence helpers
  const persistVision = async (section: string, text: string) => {
    // Upsert by section
    const { data: existing } = await supabase.from("vision").select("id").eq("section", section).maybeSingle();
    if (existing?.id) {
      await supabase.from("vision").update({ content: { text }, updated_by: user?.id }).eq("id", existing.id);
    } else {
      await supabase.from("vision").insert({ section, content: { text }, updated_by: user?.id });
    }
  };

  const persistRocks = async (raw: string) => {
    const { quarter, year } = getCurrentQuarter();
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 5);
    if (!lines.length) return;
    const rows = lines.map((title) => ({
      title,
      quarter,
      year,
      status: "on_track",
      progress: 0,
      owner_id: user?.id,
      created_by: user?.id,
      workspace_id: profile?.workspace_id || null,
    }));
    await supabase.from("goals").insert(rows);
  };

  const persistTeam = async (raw: string) => {
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const rows = lines.map((line) => {
      const [name, role] = line.split(/[—–-]/).map((s) => s?.trim()).filter(Boolean);
      return {
        name: name || line,
        role: role || "",
        created_by: user!.id,
        workspace_id: profile?.workspace_id || null,
      };
    });
    await supabase.from("pending_team_members").insert(rows);
  };

  // Skip
  const handleSkip = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ onboarding_skipped: true }).eq("user_id", user.id);
    await refreshProfile();
    navigate("/ceo");
  };

  // Complete
  const handleComplete = async () => {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("user_id", user.id);
    await refreshProfile();
    navigate("/ceo");
  };

  // Back
  const handleBack = () => {
    if (stepIdx === 0 || submitting) return;
    setStepIdx(stepIdx - 1);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isPrimaryAdmin) {
    navigate("/");
    return null;
  }

  // ---------- COMPLETE step ----------
  if (step.kind === "complete") {
    return (
      <CompletionScreen
        answers={answers}
        userName={userName}
        workspaceName={workspaceName}
        onEnter={handleComplete}
      />
    );
  }

  const turns = transcript[step.id] || [];
  const progressPct = Math.round((stepIdx / (STEPS.length - 1)) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-background via-background to-muted/30 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-medium">Vision Setup</div>
            <div className="text-xs text-muted-foreground">{step.label} · Step {stepIdx + 1} of {STEPS.length - 1}</div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
          Skip for now
        </Button>
      </div>

      {/* Progress */}
      <div className="h-1 bg-border/30">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
          {turns.map((t, i) => (
            <div key={i} className={t.role === "ai" ? "flex gap-3 items-start" : "flex gap-3 items-start justify-end"}>
              {t.role === "ai" && (
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div
                className={
                  t.role === "ai"
                    ? "max-w-[85%] text-foreground leading-relaxed text-[15px] whitespace-pre-wrap"
                    : "max-w-[85%] bg-primary/10 text-foreground rounded-2xl px-4 py-3 leading-relaxed text-[15px] whitespace-pre-wrap"
                }
              >
                {t.text}
              </div>
            </div>
          ))}
          {aiLoading && (
            <div className="flex gap-3 items-start">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
              </div>
              <div className="text-muted-foreground text-sm pt-2">Thinking…</div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Type your answer… (⌘+Enter to send)"
            className="min-h-[88px] resize-none border-border/60 focus-visible:ring-primary/40 text-[15px]"
            disabled={submitting || aiLoading}
            autoFocus
          />
          <div className="flex items-center justify-between mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              disabled={stepIdx === 0 || submitting}
              className="text-muted-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!input.trim() || submitting || aiLoading}
              size="sm"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ArrowRight className="h-3.5 w-3.5 mr-1" />}
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Completion screen ----------
function CompletionScreen({
  answers,
  userName,
  workspaceName,
  onEnter,
}: {
  answers: Record<string, string>;
  userName: string;
  workspaceName: string;
  onEnter: () => void;
}) {
  const [aiSummary, setAiSummary] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("onboarding-ai", {
          body: { mode: "summary", allAnswers: answers, userName, workspaceName },
        });
        if (!cancelled) setAiSummary((data as any)?.text || "");
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [answers, userName, workspaceName]);

  const visionItems = STEPS.filter((s) => s.kind === "vision" && answers[s.id]).map((s) => s.label);
  const rocksCount = (answers["rocks"] || "").split("\n").map((l) => l.trim()).filter(Boolean).length;
  const teamCount = (answers["team"] || "").split("\n").map((l) => l.trim()).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-background via-background to-muted/30 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Setup complete</div>
              <div className="text-2xl font-semibold">Your foundation is set</div>
            </div>
          </div>

          {loading ? (
            <div className="text-muted-foreground text-sm">Generating your summary…</div>
          ) : aiSummary ? (
            <p className="text-[15px] leading-relaxed text-foreground/90 mb-8 whitespace-pre-wrap">{aiSummary}</p>
          ) : null}

          <div className="border border-border/60 rounded-xl p-5 space-y-4 bg-card/40">
            <div className="text-sm font-medium">Here's what we just built together</div>
            <div className="space-y-2 text-sm">
              {visionItems.length > 0 && (
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-foreground">Vision Layer populated:</span>{" "}
                    <span className="text-muted-foreground">{visionItems.join(" · ")}</span>
                  </div>
                </div>
              )}
              {rocksCount > 0 && (
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-foreground">{rocksCount} quarterly rock{rocksCount === 1 ? "" : "s"} created</span>
                    <span className="text-muted-foreground"> — visible in Execution Hub</span>
                  </div>
                </div>
              )}
              {teamCount > 0 && (
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-foreground">{teamCount} team member{teamCount === 1 ? "" : "s"} noted</span>
                    <span className="text-muted-foreground"> — invite them anytime from Settings</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-10">
            <Button onClick={onEnter} size="lg" className="w-full sm:w-auto">
              Enter {workspaceName}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
