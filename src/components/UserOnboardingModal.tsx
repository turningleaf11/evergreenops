import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Sun, Moon, Monitor, Loader2, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";

type Step = "welcome" | "photo" | "theme" | "done";

const sb = supabase as any;

export function UserOnboardingModal() {
  const { user, profile, isPrimaryAdmin, roleLoaded, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const { departments } = useDepartments();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Decide whether to show
  useEffect(() => {
    if (!roleLoaded || !profile) return;
    const p: any = profile;
    // Skip primary admins (they get the vision wizard) and anyone who's already done it
    if (isPrimaryAdmin) return;
    if (p.onboarding_completed_at || p.onboarding_skipped) return;
    setName(profile.full_name || "");
    setOpen(true);
  }, [roleLoaded, profile, isPrimaryAdmin]);

  const dept = departments.find((d) => d.id === profile?.department_id);
  const initials = (profile?.full_name || user?.email || "U").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const saveName = async () => {
    const next = name.trim();
    if (!next || next === profile?.full_name) return;
    await sb.from("profiles").update({ full_name: next }).eq("user_id", user!.id);
    await refreshProfile();
  };

  const uploadPhoto = async (file: File) => {
    if (!user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Photo must be under 2 MB.");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      setUploading(false);
      toast.error("Upload failed: " + error.message);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    await sb.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", user.id);
    await refreshProfile();
    setUploading(false);
  };

  const finish = async (skipped = false) => {
    if (!user) return;
    setFinishing(true);
    await saveName();
    const update: Record<string, unknown> = skipped
      ? { onboarding_skipped: true }
      : { onboarding_completed_at: new Date().toISOString() };
    await sb.from("profiles").update(update).eq("user_id", user.id);
    await refreshProfile();
    setFinishing(false);
    setOpen(false);
    if (!skipped) toast.success("Welcome aboard!");
  };

  const next = () => {
    if (step === "welcome") { saveName(); setStep("photo"); }
    else if (step === "photo") setStep("theme");
    else if (step === "theme") setStep("done");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) finish(true); else setOpen(true); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogTitle className="sr-only">Welcome onboarding</DialogTitle>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pt-5 pb-2">
          {(["welcome", "photo", "theme", "done"] as Step[]).map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        <div className="px-6 pb-6 pt-3 space-y-5">
          {step === "welcome" && (
            <>
              <div className="space-y-2 text-center">
                <span className="text-3xl block">👋</span>
                <h2 className="text-xl font-semibold">Welcome to EvergreenOps</h2>
                <p className="text-sm text-muted-foreground">
                  Quick setup — under a minute. Confirm your name and you're in.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Your name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) next(); }}
                />
                {dept && (
                  <p className="text-xs text-muted-foreground">
                    You're on the <span className="font-medium text-foreground">{dept.name}</span> team.
                  </p>
                )}
              </div>
              <Button onClick={next} disabled={!name.trim()} className="w-full gap-2">
                Continue <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          {step === "photo" && (
            <>
              <div className="space-y-2 text-center">
                <h2 className="text-xl font-semibold">Add a profile photo</h2>
                <p className="text-sm text-muted-foreground">Optional — your team will see it on comments and threads.</p>
              </div>
              <div className="flex flex-col items-center gap-3">
                <Avatar className="h-24 w-24">
                  {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name || ""} />}
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground">{initials}</AvatarFallback>
                </Avatar>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }}
                />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1.5">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {uploading ? "Uploading…" : profile?.avatar_url ? "Change photo" : "Upload photo"}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={next} className="flex-1">Skip</Button>
                <Button onClick={next} className="flex-1 gap-2">
                  Continue <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </>
          )}

          {step === "theme" && (
            <>
              <div className="space-y-2 text-center">
                <h2 className="text-xl font-semibold">Pick a theme</h2>
                <p className="text-sm text-muted-foreground">You can change this any time in Settings.</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "light", label: "Light", icon: Sun },
                  { value: "dark", label: "Dark", icon: Moon },
                  { value: "system", label: "System", icon: Monitor },
                ] as const).map((opt) => {
                  const Icon = opt.icon;
                  const active = theme === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setTheme(opt.value)}
                      className={`flex flex-col items-center gap-2 px-3 py-4 rounded-lg border transition-colors ${
                        active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-medium">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              <Button onClick={next} className="w-full gap-2">
                Continue <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          {step === "done" && (
            <>
              <div className="space-y-3 text-center py-4">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                  <Check className="h-6 w-6 text-emerald-600" />
                </div>
                <h2 className="text-xl font-semibold">You're all set</h2>
                <p className="text-sm text-muted-foreground">
                  Head to your home page to see what's on your plate today.
                </p>
              </div>
              <Button onClick={() => finish(false)} disabled={finishing} className="w-full gap-2">
                {finishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Get started"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
