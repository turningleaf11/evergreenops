import { useAuth } from "@/contexts/AuthContext";
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
import { ShieldCheck, ShieldAlert, Settings, Users } from "lucide-react";
import { useState } from "react";
import type { AppRole } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { isAdmin, getUserRole, setUserRole } = useAuth();
  const [workspaceName, setWorkspaceName] = useState("TeamSpace");
  const [workspaceDesc, setWorkspaceDesc] = useState("Your team's collaborative workspace");

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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage workspace and user roles.</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Users & Roles
          </TabsTrigger>
          <TabsTrigger value="workspace" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Workspace
          </TabsTrigger>
        </TabsList>

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

        <TabsContent value="workspace" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workspace Settings</CardTitle>
              <CardDescription>Configure your workspace name and description.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ws-name">Workspace Name</Label>
                <Input id="ws-name" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ws-desc">Description</Label>
                <Textarea id="ws-desc" value={workspaceDesc} onChange={(e) => setWorkspaceDesc(e.target.value)} rows={3} />
              </div>
              <Button size="sm" onClick={() => toast({ title: "Saved", description: "Workspace settings updated." })}>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
