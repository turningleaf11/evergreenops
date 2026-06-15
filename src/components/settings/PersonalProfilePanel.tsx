import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Sun, Moon, Monitor, Upload, KeyRound, Loader2 } from "lucide-react";

export function PersonalProfilePanel() {
  const { user, profile, refreshProfile } = useAuth();
  const { theme, setTheme, palette, setPalette } = useTheme();
  const { departments } = useDepartments();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const dept = departments.find((d) => d.id === profile?.department_id);
  const initials = (profile?.full_name || user?.email || "U").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const saveName = async () => {
    const next = fullName.trim();
    if (!next || next === profile?.full_name) return;
    setSavingName(true);
    const { error } = await supabase.from("profiles").update({ full_name: next }).eq("user_id", user!.id);
    setSavingName(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      await refreshProfile();
      toast({ title: "Name updated" });
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Avatar must be under 2MB.", variant: "destructive" });
      return;
    }
    setUploadingAvatar(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) {
      setUploadingAvatar(false);
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: updErr } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", user.id);
    setUploadingAvatar(false);
    if (updErr) {
      toast({ title: "Update failed", description: updErr.message, variant: "destructive" });
    } else {
      await refreshProfile();
      toast({ title: "Profile photo updated" });
    }
  };

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast({ title: "Password change failed", description: error.message, variant: "destructive" });
    } else {
      setNewPassword("");
      toast({ title: "Password updated" });
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Your profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your personal account settings.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Photo, name, and basic info shown to your team.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name || ""} />}
              <AvatarFallback className="text-base bg-primary text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1.5">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar} className="gap-1.5">
                {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploadingAvatar ? "Uploading…" : "Change photo"}
              </Button>
              <p className="text-xs text-muted-foreground">JPG or PNG, max 2 MB.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <div className="flex items-center gap-2">
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); }}
                className="max-w-sm"
              />
              <Button size="sm" onClick={saveName} disabled={savingName || fullName.trim() === profile?.full_name}>
                {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Email</Label>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Department</Label>
            <p className="text-sm text-muted-foreground">{dept?.name || "Unassigned"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Choose a color theme or control light/dark mode.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Palette */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Color theme</p>
            <div className="flex gap-2 flex-wrap">
              {([
                { value: "default",    label: "Default",        swatch: ["#FAFBFC", "#3E54D3"], dark: false },
                { value: "midnight",   label: "Midnight Slate", swatch: ["#0D1117", "#4F6EF7"], dark: true },
                { value: "warm-sand",  label: "Warm Sand",      swatch: ["#FAF7F2", "#C1440E"], dark: false },
              ] as const).map((opt) => {
                const active = palette === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setPalette(opt.value)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                      active ? "border-primary bg-primary/8 text-foreground" : "bg-card border-border hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className="flex gap-0.5 shrink-0">
                      <span className="w-3 h-3 rounded-full border border-border/40" style={{ background: opt.swatch[0] }} />
                      <span className="w-3 h-3 rounded-full border border-border/40" style={{ background: opt.swatch[1] }} />
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Light / dark — only relevant for Default palette */}
          {palette === "default" && (
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Mode</p>
              <div className="flex gap-2">
                {([
                  { value: "light", label: "Light", icon: Sun },
                  { value: "dark",  label: "Dark",  icon: Moon },
                  { value: "system", label: "System", icon: Monitor },
                ] as const).map((opt) => {
                  const Icon = opt.icon;
                  const active = theme === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setTheme(opt.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                        active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4" /> Password</CardTitle>
          <CardDescription>Change your sign-in password.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 max-w-sm">
            <Input
              type="password"
              placeholder="New password (min 8 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") changePassword(); }}
            />
            <Button size="sm" onClick={changePassword} disabled={savingPassword || !newPassword}>
              {savingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Update"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
