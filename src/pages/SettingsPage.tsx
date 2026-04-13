import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { teamMembers } from "@/lib/mock-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, Settings, Users, Building2, Plus, Trash2, Upload } from "lucide-react";
import { useState, useRef } from "react";
import type { AppRole } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { isAdmin, getUserRole, setUserRole } = useAuth();
  const workspace = useWorkspace();
  const { departments, addDepartment, updateDepartment, deleteDepartment } = useDepartments();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newDeptName, setNewDeptName] = useState("");

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
    addDepartment({ name, description: "", icon: "Building2", memberCount: 0, color: "220 65% 48%" });
    setNewDeptName("");
    toast({ title: "Department added", description: `"${name}" has been created.` });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage workspace, departments, and user roles.</p>
      </div>

      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Workspace
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Departments
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
              {/* Logo */}
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

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="ws-name">Workspace Name</Label>
                <Input
                  id="ws-name"
                  value={workspace.name}
                  onChange={(e) => workspace.setName(e.target.value)}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="ws-desc">Description</Label>
                <Textarea
                  id="ws-desc"
                  value={workspace.description}
                  onChange={(e) => workspace.setDescription(e.target.value)}
                  rows={3}
                />
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
                  <Input
                    value={dept.name}
                    onChange={(e) => updateDepartment(dept.id, { name: e.target.value })}
                    className="h-8 text-sm flex-1"
                  />
                  <Input
                    value={dept.description}
                    onChange={(e) => updateDepartment(dept.id, { description: e.target.value })}
                    placeholder="Description..."
                    className="h-8 text-sm flex-1"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive shrink-0"
                    onClick={() => {
                      deleteDepartment(dept.id);
                      toast({ title: "Deleted", description: `"${dept.name}" removed.` });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}

              {/* Add new */}
              <div className="flex items-center gap-2 pt-2 border-t">
                <Input
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="New department name..."
                  className="h-8 text-sm flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleAddDepartment()}
                />
                <Button size="sm" variant="outline" onClick={handleAddDepartment} disabled={!newDeptName.trim()}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4 space-y-3">
          {teamMembers.map((member) => {
            const memberRole = getUserRole(member.id);
            return (
              <Card key={member.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                        {member.name.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={memberRole === "admin" ? "default" : "secondary"} className="text-[10px]">
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      {memberRole}
                    </Badge>
                    <Select value={memberRole} onValueChange={(v) => setUserRole(member.id, v as AppRole)}>
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
