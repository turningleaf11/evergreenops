import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { useTraining, TrainingModule, TrainingModuleType, TrainingCategory } from "@/contexts/TrainingContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ShieldCheck, ShieldAlert, Settings, Users, Building2, Plus, Trash2, Upload,
  GraduationCap, ChevronDown, GripVertical, UserPlus, Mail,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import type { AppRole } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

const moduleTypes: TrainingModuleType[] = ["guide", "playbook", "checklist", "video", "link"];
const moduleCategories: TrainingCategory[] = ["Onboarding", "Role Training", "Processes", "Tools"];

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const workspace = useWorkspace();
  const { departments, addDepartment, updateDepartment, deleteDepartment } = useDepartments();
  const training = useTraining();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newDeptName, setNewDeptName] = useState("");
  const [newOnboardingTitle, setNewOnboardingTitle] = useState("");

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground opacity-40" />
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-sm text-muted-foreground">You need admin privileges to access settings.</p>
        </div>
      </div>
    );
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 2MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      workspace.setLogoUrl(reader.result as string);
      toast({ title: "Logo updated" });
    };
    reader.readAsDataURL(file);
  };

  const handleAddDepartment = () => {
    const name = newDeptName.trim();
    if (!name) return;
    addDepartment({ name, description: "", icon: "Building2", color: "220 65% 48%" });
    setNewDeptName("");
    toast({ title: "Department added", description: `"${name}" has been created.` });
  };

  const handleAddOnboardingStep = () => {
    const title = newOnboardingTitle.trim();
    if (!title) return;
    training.addOnboardingStep({ title, description: "" });
    setNewOnboardingTitle("");
    toast({ title: "Onboarding step added" });
  };

  const handleAddModule = () => {
    training.addModule({
      title: "New Module",
      description: "",
      type: "guide",
      category: "Onboarding",
      roleIds: [],
      steps: [],
    });
    toast({ title: "Training module added" });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage workspace, departments, training, and user roles.</p>
      </div>

      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Workspace
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Departments
          </TabsTrigger>
          <TabsTrigger value="training" className="gap-1.5">
            <GraduationCap className="h-3.5 w-3.5" /> Training
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Users & Roles
          </TabsTrigger>
        </TabsList>

        {/* Workspace Tab */}
        <TabsContent value="workspace" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workspace Settings</CardTitle>
              <CardDescription>Configure your workspace name, description, and logo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  {workspace.logoUrl ? (
                    <img src={workspace.logoUrl} alt="Logo" className="h-14 w-14 rounded-lg object-cover border" />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
                      {workspace.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-3.5 w-3.5 mr-1" /> Upload
                    </Button>
                    {workspace.logoUrl && (
                      <Button size="sm" variant="ghost" onClick={() => { workspace.setLogoUrl(null); toast({ title: "Logo removed" }); }}>
                        Remove
                      </Button>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ws-name">Workspace Name</Label>
                <Input id="ws-name" value={workspace.name} onChange={(e) => workspace.setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ws-desc">Description</Label>
                <Textarea id="ws-desc" value={workspace.description} onChange={(e) => workspace.setDescription(e.target.value)} rows={3} />
              </div>
              <Button size="sm" onClick={() => toast({ title: "Saved", description: "Workspace settings updated." })}>
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Manage Departments</CardTitle>
              <CardDescription>Add, rename, or remove departments.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {departments.map((dept) => (
                <div key={dept.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <Input value={dept.name} onChange={(e) => updateDepartment(dept.id, { name: e.target.value })} className="h-8 text-sm flex-1" />
                  <Input value={dept.description} onChange={(e) => updateDepartment(dept.id, { description: e.target.value })} placeholder="Description..." className="h-8 text-sm flex-1" />
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => { deleteDepartment(dept.id); toast({ title: "Deleted", description: `"${dept.name}" removed.` }); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-2 border-t">
                <Input value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} placeholder="New department name..." className="h-8 text-sm flex-1" onKeyDown={(e) => e.key === "Enter" && handleAddDepartment()} />
                <Button size="sm" variant="outline" onClick={handleAddDepartment} disabled={!newDeptName.trim()}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Training Tab */}
        <TabsContent value="training" className="mt-4 space-y-6">
          {/* Onboarding Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Onboarding Steps</CardTitle>
              <CardDescription>Steps shown to new users in the onboarding banner.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {training.onboardingSteps.map((step) => (
                <div key={step.id} className="flex items-start gap-3 p-3 rounded-lg border">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={step.title}
                      onChange={(e) => training.updateOnboardingStep(step.id, { title: e.target.value })}
                      className="h-8 text-sm font-medium"
                      placeholder="Step title"
                    />
                    <Input
                      value={step.description}
                      onChange={(e) => training.updateOnboardingStep(step.id, { description: e.target.value })}
                      className="h-8 text-sm"
                      placeholder="Description"
                    />
                    <div className="flex gap-2">
                      <Input
                        value={step.link || ""}
                        onChange={(e) => training.updateOnboardingStep(step.id, { link: e.target.value || undefined })}
                        className="h-7 text-xs flex-1"
                        placeholder="Link (e.g. /people)"
                      />
                      <Input
                        value={step.linkLabel || ""}
                        onChange={(e) => training.updateOnboardingStep(step.id, { linkLabel: e.target.value || undefined })}
                        className="h-7 text-xs w-32"
                        placeholder="Link label"
                      />
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => { training.deleteOnboardingStep(step.id); toast({ title: "Step deleted" }); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-2 border-t">
                <Input value={newOnboardingTitle} onChange={(e) => setNewOnboardingTitle(e.target.value)} placeholder="New step title..." className="h-8 text-sm flex-1" onKeyDown={(e) => e.key === "Enter" && handleAddOnboardingStep()} />
                <Button size="sm" variant="outline" onClick={handleAddOnboardingStep} disabled={!newOnboardingTitle.trim()}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Step
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Training Modules */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Training Modules</CardTitle>
                <CardDescription>Create and manage training content for your team.</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={handleAddModule}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Module
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {training.modules.map((mod) => (
                <ModuleEditor
                  key={mod.id}
                  module={mod}
                  onUpdate={(updates) => training.updateModule(mod.id, updates)}
                  onDelete={() => { training.deleteModule(mod.id); toast({ title: "Module deleted" }); }}
                />
              ))}
              {training.modules.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No training modules yet. Click "Add Module" to create one.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4 space-y-4">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
interface DBUser {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  department_id: string | null;
  email?: string;
  roles: string[];
  is_primary?: boolean;
}

function UsersTab() {
  const { departments } = useDepartments();
  const [users, setUsers] = useState<DBUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteDept, setInviteDept] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("user");
  const [inviting, setInviting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    // Fetch all profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url, department_id");

    if (!profiles) { setLoading(false); return; }

    // Fetch all roles (admin can see all via RLS policy)
    const { data: allRoles } = await supabase
      .from("user_roles")
      .select("user_id, role, is_primary");

    const roleMap: Record<string, string[]> = {};
    const primaryMap: Record<string, boolean> = {};
    (allRoles || []).forEach((r: any) => {
      if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
      roleMap[r.user_id].push(r.role);
      if (r.is_primary) primaryMap[r.user_id] = true;
    });

    const merged: DBUser[] = profiles.map((p: any) => ({
      ...p,
      roles: roleMap[p.user_id] || ["user"],
      is_primary: primaryMap[p.user_id] || false,
    }));

    setUsers(merged);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    if (newRole === "admin") {
      await supabase.from("user_roles").insert({ user_id: userId, role: "admin" } as any);
    } else {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
    }
    fetchUsers();
    toast({ title: "Role updated" });
  };

  const handleDeptChange = async (userId: string, deptId: string) => {
    await supabase.from("profiles").update({ department_id: deptId || null } as any).eq("user_id", userId);
    fetchUsers();
    toast({ title: "Department updated" });
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: inviteEmail.trim(),
          full_name: inviteName.trim(),
          department_id: inviteDept || null,
          role: inviteRole,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "User invited", description: `${inviteEmail} has been invited.` });
      setInviteEmail("");
      setInviteName("");
      setInviteDept("");
      setInviteRole("user");
      setInviteOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Invite failed", description: err.message, variant: "destructive" });
    }
    setInviting(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground text-center py-8">Loading users...</p>;

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{users.length} team member{users.length !== 1 ? "s" : ""}</p>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <UserPlus className="h-3.5 w-3.5" /> Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite a Team Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="name@company.com" type="email" />
              </div>
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="First Last" />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={inviteDept} onValueChange={setInviteDept}>
                  <SelectTrigger><SelectValue placeholder="Select department..." /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="w-full">
                {inviting ? "Inviting..." : "Send Invite"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {users.map((user) => {
        const currentRole: AppRole = user.roles.includes("admin") ? "admin" : "user";
        const initials = (user.full_name || "U").split(" ").map((n) => n[0]).join("").toUpperCase();
        const deptName = departments.find((d) => d.id === user.department_id)?.name;

        return (
          <Card key={user.user_id}>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{user.full_name || "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground truncate">{deptName || "No department"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select value={user.department_id || ""} onValueChange={(v) => handleDeptChange(user.user_id, v)}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {user.is_primary ? (
                  <Badge variant="outline" className="h-8 px-3 text-xs gap-1.5 border-primary/30 text-primary">
                    <ShieldCheck className="h-3.5 w-3.5" /> Primary Admin
                  </Badge>
                ) : (
                <Select value={currentRole} onValueChange={(v) => handleRoleChange(user.user_id, v as AppRole)}>
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user" className="text-xs">User</SelectItem>
                    <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}

function ModuleEditor({
  module: mod,
  onUpdate,
  onDelete,
}: {
  module: TrainingModule;
  onUpdate: (updates: Partial<TrainingModule>) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  const addStep = () => {
    const newStep = { id: Math.random().toString(36).substring(2, 10), title: "New Step", content: "" };
    onUpdate({ steps: [...mod.steps, newStep] });
  };

  const updateStep = (stepId: string, updates: Record<string, any>) => {
    onUpdate({ steps: mod.steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s)) });
  };

  const deleteStep = (stepId: string) => {
    onUpdate({ steps: mod.steps.filter((s) => s.id !== stepId) });
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-3 w-full p-3 text-left hover:bg-muted/50 transition-colors">
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-0" : "-rotate-90"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{mod.title}</p>
              <p className="text-xs text-muted-foreground truncate">{mod.category} · {mod.type} · {mod.steps.length} steps</p>
            </div>
            <Badge variant="secondary" className="text-[10px] shrink-0">{mod.category}</Badge>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-4 border-t pt-3">
            {/* Module metadata */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Title</Label>
                <Input value={mod.title} onChange={(e) => onUpdate({ title: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input value={mod.description} onChange={(e) => onUpdate({ description: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={mod.type} onValueChange={(v) => onUpdate({ type: v as TrainingModuleType })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {moduleTypes.map((t) => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={mod.category} onValueChange={(v) => onUpdate({ category: v as TrainingCategory })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {moduleCategories.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Role filter (comma-separated IDs, empty = all)</Label>
              <Input
                value={mod.roleIds.join(", ")}
                onChange={(e) => onUpdate({ roleIds: e.target.value.split(",").map((r) => r.trim()).filter(Boolean) })}
                className="h-8 text-sm"
                placeholder="e.g. engineering, design"
              />
            </div>

            {/* Steps */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Steps</Label>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={addStep}>
                  <Plus className="h-3 w-3 mr-1" /> Add Step
                </Button>
              </div>
              {mod.steps.map((step, idx) => (
                <div key={step.id} className="p-2 rounded border bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-4 shrink-0">{idx + 1}</span>
                    <Input value={step.title} onChange={(e) => updateStep(step.id, { title: e.target.value })} className="h-7 text-xs flex-1" placeholder="Step title" />
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive shrink-0" onClick={() => deleteStep(step.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <Textarea
                    value={step.content || ""}
                    onChange={(e) => updateStep(step.id, { content: e.target.value })}
                    className="text-xs min-h-[48px]"
                    placeholder="Step content..."
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Input value={step.videoUrl || ""} onChange={(e) => updateStep(step.id, { videoUrl: e.target.value || undefined })} className="h-7 text-xs" placeholder="Video URL (optional)" />
                    <Input value={step.externalUrl || ""} onChange={(e) => updateStep(step.id, { externalUrl: e.target.value || undefined })} className="h-7 text-xs" placeholder="External URL (optional)" />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-1">
              <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={onDelete}>
                <Trash2 className="h-3 w-3 mr-1" /> Delete Module
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
