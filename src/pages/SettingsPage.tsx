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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ShieldCheck, ShieldAlert, Settings, Users, Building2, Plus, Trash2, Upload,
  GraduationCap, ChevronDown, GripVertical, UserPlus, Mail, Palette, Check,
  Pencil, X, Sun, Moon, Monitor, Package, FileSpreadsheet, Clock, LayoutDashboard, CalendarDays, Briefcase, KeyRound, Crown,
} from "lucide-react";
import { HolidaysSection } from "@/components/settings/HolidaysSection";
import { CrmCustomFieldsSettings } from "@/components/settings/CrmCustomFieldsSettings";
import LeadIntakeSettings from "@/components/settings/LeadIntakeSettings";
import { ApiSettings } from "@/components/settings/ApiSettings";
import { IntegrationCredentials } from "@/components/settings/IntegrationCredentials";
import { PersonalProfilePanel } from "@/components/settings/PersonalProfilePanel";
import { UserAccessGrants } from "@/components/settings/UserAccessGrants";
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { AppRole } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { DEPARTMENT_ICONS, getDeptIcon } from "@/lib/icon-map";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAllAddons } from "@/hooks/useAddonEnabled";
import { Switch } from "@/components/ui/switch";

const moduleTypes: TrainingModuleType[] = ["guide", "playbook", "checklist", "video", "link"];
const moduleCategories: TrainingCategory[] = ["Onboarding", "Role Training", "Processes", "Tools"];

export default function SettingsPage() {
  const { isAdmin, isPrimaryAdmin, user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const workspace = useWorkspace();
  const { departments, addDepartment, updateDepartment, deleteDepartment } = useDepartments();
  const training = useTraining();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newDeptName, setNewDeptName] = useState("");
  const [newOnboardingTitle, setNewOnboardingTitle] = useState("");
  const [activeSection, setActiveSection] = useState("workspace");

  if (!isAdmin) {
    return <PersonalProfilePanel />;
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 2MB.", variant: "destructive" });
      return;
    }
    const url = await workspace.uploadLogo(file);
    if (url) {
      toast({ title: "Logo updated" });
    } else {
      toast({ title: "Upload failed", variant: "destructive" });
    }
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
    training.addOnboardingStep({ title, description: "", audience: "everyone" });
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

  const navSections = [
    {
      label: "Workspace",
      items: [
        { value: "workspace", icon: Settings, label: "Workspace" },
        { value: "departments", icon: Building2, label: "Departments" },
        { value: "home_widgets", icon: LayoutDashboard, label: "Home Widgets" },
        { value: "holidays", icon: CalendarDays, label: "Holidays" },
      ],
    },
    {
      label: "People",
      items: [
        { value: "users", icon: Users, label: "Users & Roles" },
        { value: "training", icon: GraduationCap, label: "Training" },
      ],
    },
    {
      label: "CRM",
      items: [
        { value: "crm_fields", icon: Briefcase, label: "Custom Fields" },
        { value: "lead_intake", icon: Briefcase, label: "Lead Intake" },
      ],
    },
    {
      label: "Extensions",
      items: [
        { value: "addons", icon: Package, label: "Add-Ons" },
        { value: "forms", icon: FileSpreadsheet, label: "Forms" },
        { value: "integrations", icon: Mail, label: "Integrations" },
        { value: "credentials", icon: KeyRound, label: "Credentials" },
        { value: "api", icon: KeyRound, label: "API" },
      ],
    },
  ];


  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1.5">Manage workspace, departments, training, and user roles.</p>
      </div>

      {/* Mobile: horizontal scroller */}
      <div className="lg:hidden mb-4 -mx-6 px-6 overflow-x-auto scrollbar-hide">
        <div className="flex gap-1 w-max">
          {navSections.flatMap((s) => s.items).map((item) => {
            const isActive = activeSection === item.value;
            return (
              <button
                key={item.value}
                onClick={() => setActiveSection(item.value)}
                className={`shrink-0 inline-flex items-center gap-2 px-3 py-2 h-9 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Tabs value={activeSection} onValueChange={setActiveSection} className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-60 shrink-0 lg:sticky lg:top-6">
          <nav className="rounded-xl border border-border/60 bg-card/40 p-2 space-y-1">
            {navSections.map((section, i) => (
              <div key={section.label}>
                {i > 0 && <div className="h-px bg-border/60 my-2" />}
                <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = activeSection === item.value;
                    return (
                      <button
                        key={item.value}
                        onClick={() => setActiveSection(item.value)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 h-9 text-sm font-medium rounded-md transition-colors ${
                          isActive
                            ? "bg-primary/10 text-primary ring-1 ring-primary/15"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0 w-full">
        {/* spacer wrapper closes after all TabsContent below */}

        <TabsContent value="holidays" className="mt-4 space-y-4">
          <HolidaysSection />
        </TabsContent>

        <TabsContent value="integrations" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4" /> Gmail
              </CardTitle>
              <CardDescription>
                Connect a workspace Gmail account and control which roles or members can use the team inbox.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm">
                <a href="/settings/integrations/gmail">Manage Gmail integration</a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workspace Tab */}
        <TabsContent value="workspace" className="mt-4 space-y-4">
          {/* Theme */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Sun className="h-4 w-4" /> Theme</CardTitle>
              <CardDescription>Choose light, dark, or system theme.</CardDescription>
            </CardHeader>
            <CardContent>
              <ThemeSelector />
            </CardContent>
          </Card>


          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" /> Accent Color</CardTitle>
              <CardDescription>Choose an accent color for your workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <AccentColorPicker />
            </CardContent>
          </Card>

          {/* Naming */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Naming</CardTitle>
              <CardDescription>Customize labels used throughout the workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ceo-page-name">CEO Page Title</Label>
                <Input id="ceo-page-name" value={workspace.ceoPageName} onChange={(e) => workspace.setCeoPageName(e.target.value)} placeholder="CEO Cockpit" />
                <p className="text-xs text-muted-foreground">Shown in the sidebar and page header (e.g. "CEO Cockpit", "CEO Dash", "Command Center")</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dept-label">Department Group Label</Label>
                <Input id="dept-label" value={workspace.deptLabel} onChange={(e) => workspace.setDeptLabel(e.target.value)} placeholder="Departments" />
                <p className="text-xs text-muted-foreground">How departments are labeled in the sidebar (e.g. "Departments", "Teams", "Spaces")</p>
              </div>
            </CardContent>
          </Card>

          {/* Workspace Info */}
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

          <AlbusAvatarCard />

          {isPrimaryAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Vision Setup
                </CardTitle>
                <CardDescription>Re-run the guided AI conversation that populates your Vision Layer, Rocks, and team list.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!user) return;
                    await supabase
                      .from("profiles")
                      .update({ onboarding_skipped: false, onboarding_completed_at: null, onboarding_progress: {} })
                      .eq("user_id", user.id);
                    await refreshProfile();
                    navigate("/onboarding");
                  }}
                >
                  Run Vision Setup
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Manage Departments</CardTitle>
              <CardDescription>Add, rename, or remove departments.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {departments.map((dept) => {
                const DeptIcon = getDeptIcon(dept.icon);
                return (
                <div key={dept.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="h-8 w-8 rounded-md border flex items-center justify-center hover:bg-accent shrink-0" title="Change icon">
                        <DeptIcon className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="start">
                      <div className="grid grid-cols-6 gap-1">
                        {Object.entries(DEPARTMENT_ICONS).map(([name, IconComp]) => (
                          <button
                            key={name}
                            onClick={() => updateDepartment(dept.id, { icon: name })}
                            className={`h-8 w-8 rounded-md flex items-center justify-center hover:bg-accent transition-colors ${dept.icon === name ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                            title={name}
                          >
                            <IconComp className="h-4 w-4" />
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Input value={dept.name} onChange={(e) => updateDepartment(dept.id, { name: e.target.value })} className="h-8 text-sm flex-1" />
                  <Input value={dept.description} onChange={(e) => updateDepartment(dept.id, { description: e.target.value })} placeholder="Description..." className="h-8 text-sm flex-1" />
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => { deleteDepartment(dept.id); toast({ title: "Deleted", description: `"${dept.name}" removed.` }); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                );
              })}
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
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Show to:</span>
                      <Select
                        value={step.audience || "everyone"}
                        onValueChange={(v) => training.updateOnboardingStep(step.id, { audience: v as any })}
                      >
                        <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="everyone" className="text-xs">Everyone</SelectItem>
                          <SelectItem value="admin" className="text-xs">Admins only</SelectItem>
                          <SelectItem value="user" className="text-xs">Non-admins only</SelectItem>
                        </SelectContent>
                      </Select>
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

        <TabsContent value="addons" className="mt-4">
          <AddOnsTab />
        </TabsContent>

        <TabsContent value="forms" className="mt-4">
          <FormsManagementTab />
        </TabsContent>

        <TabsContent value="home_widgets" className="mt-4">
          <HomeWidgetDefaultsTab />
        </TabsContent>

        <TabsContent value="crm_fields" className="mt-4">
          <CrmCustomFieldsSettings />
        </TabsContent>

        <TabsContent value="lead_intake" className="mt-4">
          <LeadIntakeSettings />
        </TabsContent>

        <TabsContent value="credentials" className="mt-4">
          <IntegrationCredentials />
        </TabsContent>

        <TabsContent value="api" className="mt-4">
          <ApiSettings />
        </TabsContent>
        </div>
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
  time_clock_enabled: boolean;
  is_leader: boolean;
  email_signature_url: string | null;
}

function AlbusAvatarCard() {
  const workspace = useWorkspace();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Avatar must be under 2MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    const url = await workspace.uploadAlbusAvatar(file);
    setUploading(false);
    if (url) toast({ title: "Albus avatar updated" });
    else toast({ title: "Upload failed", variant: "destructive" });
    e.target.value = "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <span className="text-base">🧙‍♂️</span> Albus Avatar
        </CardTitle>
        <CardDescription>
          Customize the image shown on the AI chat icon and inside Albus's messages. Defaults to the wizard emoji.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4">
          {workspace.albusAvatarUrl ? (
            <img src={workspace.albusAvatarUrl} alt="Albus" className="h-14 w-14 rounded-full object-cover border" />
          ) : (
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-3xl">🧙‍♂️</div>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="h-3.5 w-3.5 mr-1" /> {uploading ? "Uploading…" : "Upload image"}
            </Button>
            {workspace.albusAvatarUrl && (
              <Button size="sm" variant="ghost" onClick={() => { workspace.setAlbusAvatarUrl(null); toast({ title: "Reverted to default emoji" }); }}>
                Reset to default
              </Button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </div>
        <p className="text-xs text-muted-foreground">
          Tip: square images at 256×256px or larger work best. Animated GIFs supported.
        </p>
      </CardContent>
    </Card>
  );
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
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    // Fetch all profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url, department_id, time_clock_enabled, is_leader, email_signature_url");

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

  const handleTimeClockToggle = async (userId: string, enabled: boolean) => {
    await supabase.from("profiles").update({ time_clock_enabled: enabled }).eq("user_id", userId);
    fetchUsers();
    toast({ title: enabled ? "Time clock enabled" : "Time clock disabled" });
  };

  const handleLeaderToggle = async (userId: string, enabled: boolean) => {
    await supabase.from("profiles").update({ is_leader: enabled } as any).eq("user_id", userId);
    fetchUsers();
    toast({ title: enabled ? "Marked as leader" : "Leader status removed" });
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

  const handleSaveName = async (userId: string) => {
    if (!editName.trim()) return;
    await supabase.from("profiles").update({ full_name: editName.trim() }).eq("user_id", userId);
    setEditingUserId(null);
    fetchUsers();
    toast({ title: "Name updated" });
  };

  const handleDeleteUser = async (userId: string) => {
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "User deleted" });
      setDeleteConfirmId(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
    setDeleting(false);
  };

  const handleUploadSignature = async (userId: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please upload an image (PNG recommended)", variant: "destructive" });
      return;
    }
    const { uploadFile } = await import("@/lib/file-upload");
    const url = await uploadFile(file);
    if (!url) {
      toast({ title: "Upload failed", variant: "destructive" });
      return;
    }
    await supabase.from("profiles").update({ email_signature_url: url } as any).eq("user_id", userId);
    toast({ title: "Signature updated" });
    fetchUsers();
  };

  const handleRemoveSignature = async (userId: string) => {
    await supabase.from("profiles").update({ email_signature_url: null } as any).eq("user_id", userId);
    toast({ title: "Signature removed" });
    fetchUsers();
  };
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

      {users.map((u) => {
        const currentRole: AppRole = u.roles.includes("admin") ? "admin" : "user";
        const initials = (u.full_name || "U").split(" ").map((n) => n[0]).join("").toUpperCase();
        const deptName = departments.find((d) => d.id === u.department_id)?.name;
        const isEditing = editingUserId === u.user_id;

        return (
          <Card key={u.user_id} className="group">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 text-sm w-40" autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(u.user_id); if (e.key === "Escape") setEditingUserId(null); }} />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveName(u.user_id)}><Check className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingUserId(null)}><X className="h-3 w-3" /></Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{u.full_name || "Unnamed"}</p>
                        <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => { setEditingUserId(u.user_id); setEditName(u.full_name || ""); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground truncate">{deptName || "No department"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select value={u.department_id || ""} onValueChange={(v) => handleDeptChange(u.user_id, v)}>
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1.5" title="Mark as department leader">
                    <Crown className="h-3.5 w-3.5 text-muted-foreground" />
                    <Switch checked={u.is_leader} onCheckedChange={(v) => handleLeaderToggle(u.user_id, v)} disabled={u.is_primary} />
                  </div>
                  <div className="flex items-center gap-1.5" title="Time clock access">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <Switch checked={u.time_clock_enabled} onCheckedChange={(v) => handleTimeClockToggle(u.user_id, v)} />
                  </div>
                  {u.is_primary ? (
                    <Badge variant="outline" className="h-8 px-3 text-xs gap-1.5 border-primary/30 text-primary">
                      <ShieldCheck className="h-3.5 w-3.5" /> Primary Admin
                    </Badge>
                  ) : (
                    <>
                      <Select value={currentRole} onValueChange={(v) => handleRoleChange(u.user_id, v as AppRole)}>
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user" className="text-xs">User</SelectItem>
                          <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      {deleteConfirmId === u.user_id ? (
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="destructive" className="h-8 text-xs" disabled={deleting} onClick={() => handleDeleteUser(u.user_id)}>
                            {deleting ? "..." : "Confirm"}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirmId(u.user_id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Email signature (PNG) — appended automatically to outgoing emails and replies */}
              <div className="flex items-center gap-3 pt-2 border-t border-border/40">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground w-28 shrink-0">
                  Email signature
                </div>
                {u.email_signature_url ? (
                  <img
                    src={u.email_signature_url}
                    alt="Signature"
                    className="max-h-12 w-auto rounded border border-border/60 bg-white"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground italic">None uploaded</span>
                )}
                <div className="ml-auto flex items-center gap-1.5">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadSignature(u.user_id, f);
                        e.target.value = "";
                      }}
                    />
                    <span className="inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-md border border-input hover:bg-accent">
                      <Upload className="h-3 w-3" />
                      {u.email_signature_url ? "Replace" : "Upload PNG"}
                    </span>
                  </label>
                  {u.email_signature_url && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleRemoveSignature(u.user_id)} title="Remove signature">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <UserAccessGrants
                targetUserId={u.user_id}
                isPrimary={!!u.is_primary}
                isAdmin={currentRole === "admin"}
              />
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

function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const options: { value: "light" | "dark" | "system"; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
    { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
    { value: "system", label: "System", icon: <Monitor className="h-4 w-4" /> },
  ];

  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
            theme === opt.value
              ? "bg-primary/10 border-primary text-primary"
              : "hover:bg-accent text-muted-foreground"
          }`}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const ACCENT_PRESETS = [
  { label: "Blue", hue: "220", color: "hsl(220, 65%, 48%)" },
  { label: "Indigo", hue: "245", color: "hsl(245, 65%, 48%)" },
  { label: "Purple", hue: "280", color: "hsl(280, 65%, 48%)" },
  { label: "Pink", hue: "330", color: "hsl(330, 65%, 48%)" },
  { label: "Red", hue: "0", color: "hsl(0, 65%, 48%)" },
  { label: "Orange", hue: "25", color: "hsl(25, 65%, 48%)" },
  { label: "Teal", hue: "175", color: "hsl(175, 65%, 48%)" },
  { label: "Green", hue: "142", color: "hsl(142, 65%, 48%)" },
];

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const match = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!match) return null;
  const r = parseInt(match[1].slice(0, 2), 16) / 255;
  const g = parseInt(match[1].slice(2, 4), 16) / 255;
  const b = parseInt(match[1].slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function accentToHex(accent: string): string {
  const parts = accent.trim().split(/\s+/);
  const h = parseInt(parts[0], 10) || 0;
  const s = (parts.length >= 3 ? parseInt(parts[1], 10) : 65) / 100;
  const l = (parts.length >= 3 ? parseInt(parts[2], 10) : 48) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}


function AccentColorPicker() {
  const { accentColor, setAccentColor } = useWorkspace();
  const activeAccent = accentColor || "220";
  const [customHex, setCustomHex] = useState(
    ACCENT_PRESETS.some(p => p.hue === activeAccent) ? "" : accentToHex(activeAccent)
  );

  const handleCustomHex = (val: string) => {
    setCustomHex(val);
    const hsl = hexToHsl(val);
    if (hsl !== null) {
      setAccentColor(`${hsl.h} ${hsl.s} ${hsl.l}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {ACCENT_PRESETS.map((preset) => (
          <button
            key={preset.hue}
            onClick={() => { setAccentColor(preset.hue === "220" ? null : preset.hue); setCustomHex(""); }}
            className="group relative flex flex-col items-center gap-1.5"
            title={preset.label}
            type="button"
          >
            <div
              className={`h-9 w-9 rounded-full transition-all duration-200 flex items-center justify-center ${activeAccent === preset.hue ? "ring-2 ring-offset-2 ring-offset-background" : ""}`}
              style={{
                backgroundColor: preset.color,
                ...(activeAccent === preset.hue ? { boxShadow: `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${preset.color}` } : {}),
              }}
            >
              {activeAccent === preset.hue && (
                <Check className="h-4 w-4 text-white" />
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">{preset.label}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <div
          className="h-8 w-8 rounded-full shrink-0 border"
          style={{ backgroundColor: customHex && hexToHsl(customHex) !== null ? customHex : `hsl(${activeAccent.split(/\s+/)[0]}, 65%, 48%)` }}
        />
        <Input
          value={customHex}
          onChange={(e) => handleCustomHex(e.target.value)}
          placeholder="#3B82F6"
          className="h-8 text-sm w-40 font-mono"
          maxLength={7}
        />
        <span className="text-xs text-muted-foreground">Hex color</span>
      </div>
    </div>
  );
}

function AddOnsTab() {
  const { packs, enabledIds, loading, toggle } = useAllAddons();

  if (loading) return <p className="text-sm text-muted-foreground py-8 text-center">Loading add-ons...</p>;

  if (packs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-2">
          <Package className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="font-medium">No add-on packs available yet</p>
          <p className="text-sm text-muted-foreground">Add-on packs will appear here when they become available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {packs.map((pack: any) => {
        const isEnabled = enabledIds.includes(pack.id);
        return (
          <Card key={pack.id} className={isEnabled ? "border-primary/30" : ""}>
            <CardContent className="p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary shrink-0" />
                  <p className="font-medium text-sm">{pack.name}</p>
                  {pack.price_tier !== "free" && (
                    <Badge variant="secondary" className="text-[10px]">{pack.price_tier}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{pack.description}</p>
              </div>
              <Switch checked={isEnabled} onCheckedChange={() => toggle(pack.id)} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function FormsManagementTab() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any>(null);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newFields, setNewFields] = useState<{ name: string; type: string; required: boolean; options?: string[] }[]>([]);

  const fetchData = useCallback(async () => {
    const { data } = await supabase.from("form_templates").select("*").order("name");
    if (data) setTemplates(data);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openNew = () => {
    setEditTemplate(null);
    setNewName(""); setNewDesc(""); setNewFields([{ name: "", type: "text", required: false }]);
    setEditOpen(true);
  };

  const openEdit = (t: any) => {
    setEditTemplate(t);
    setNewName(t.name); setNewDesc(t.description || "");
    setNewFields(t.fields || [{ name: "", type: "text", required: false }]);
    setEditOpen(true);
  };

  const saveTemplate = async () => {
    const validFields = newFields.filter(f => f.name.trim());
    if (!newName.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (editTemplate) {
      await supabase.from("form_templates").update({
        name: newName.trim(), description: newDesc.trim(), fields: validFields,
      }).eq("id", editTemplate.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("form_templates").insert({
        name: newName.trim(), description: newDesc.trim(), fields: validFields,
        is_active: true,
      });
    }
    setEditOpen(false);
    fetchData();
    toast({ title: editTemplate ? "Template updated" : "Template created" });
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from("form_templates").delete().eq("id", id);
    fetchData();
    toast({ title: "Template deleted" });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Form Templates</CardTitle>
            <CardDescription>Create and manage form templates for your team.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={openNew} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New Template
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No templates yet</p>
          ) : templates.map(t => (
            <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="text-sm font-medium">{t.name}</p>
                {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                <p className="text-[10px] text-muted-foreground mt-0.5">{(t.fields as any[])?.length || 0} fields</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-7" onClick={() => openEdit(t)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => deleteTemplate(t.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Form submissions are reviewed in the Execution Hub → Submissions tab.</p>

      {/* Template Editor Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editTemplate ? "Edit Template" : "New Template"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Form name" value={newName} onChange={e => setNewName(e.target.value)} />
            <Textarea placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="min-h-[60px]" />
            <div className="space-y-2">
              <Label className="text-xs font-medium">Fields</Label>
              {newFields.map((f, i) => (
                <div key={i} className="flex gap-1 items-center">
                  <Input
                    placeholder="Field name"
                    value={f.name}
                    onChange={e => { const n = [...newFields]; n[i] = { ...n[i], name: e.target.value }; setNewFields(n); }}
                    className="h-8 text-sm flex-1"
                  />
                  <Select value={f.type} onValueChange={v => { const n = [...newFields]; n[i] = { ...n[i], type: v }; setNewFields(n); }}>
                    <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="textarea">Textarea</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="select">Select</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setNewFields(newFields.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setNewFields([...newFields, { name: "", type: "text", required: false }])}>
                + Add Field
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveTemplate} disabled={!newName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HomeWidgetDefaultsTab() {
  const [defaults, setDefaults] = useState<Array<{ id?: string; widget_id: string; visible: boolean; sort_order: number }>>([]);
  const [loading, setLoading] = useState(true);

  const registry = [
    { id: "time_clock", label: "Time Clock" },
    { id: "announcements", label: "Pinned Announcements" },
    { id: "departments", label: "Departments" },
    { id: "forms", label: "Forms & Requests" },
    { id: "my_tasks", label: "My Tasks" },
    { id: "quick_links", label: "Quick Links" },
    { id: "feed_preview", label: "Feed Preview" },
    { id: "reminders", label: "Reminders" },
    { id: "recent_docs", label: "Recent Docs" },
    { id: "activity_feed", label: "Activity Feed" },
  ];

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("widget_defaults").select("*").order("sort_order", { ascending: true });
      if (data && data.length > 0) {
        setDefaults(data);
      } else {
        setDefaults(registry.map((w, i) => ({ widget_id: w.id, visible: true, sort_order: i })));
      }
      setLoading(false);
    };
    load();
  }, []);

  const save = async (updated: typeof defaults) => {
    setDefaults(updated);
    // Upsert via delete + insert
    await supabase.from("widget_defaults").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("widget_defaults").insert(
      updated.map((w) => ({ widget_id: w.widget_id, visible: w.visible, sort_order: w.sort_order }))
    );
    toast({ title: "Defaults saved", description: "New users will see this widget layout." });
  };

  const toggleWidget = (widgetId: string) => {
    const updated = defaults.map((w) => w.widget_id === widgetId ? { ...w, visible: !w.visible } : w);
    save(updated);
  };

  if (loading) return <p className="text-sm text-muted-foreground p-4">Loading...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><LayoutDashboard className="h-4 w-4" /> Default Home Widgets</CardTitle>
        <CardDescription>Configure which widgets new users see on the Home page by default. Users can customize their own layout.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {defaults.map((w) => {
          const meta = registry.find((r) => r.id === w.widget_id);
          return (
            <div key={w.widget_id} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{meta?.label || w.widget_id}</span>
              </div>
              <Switch checked={w.visible} onCheckedChange={() => toggleWidget(w.widget_id)} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
