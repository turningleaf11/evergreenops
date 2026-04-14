import {
  Home, FileText, Database as DbIcon, Users, ChevronDown,
  Settings, Building2, ShieldCheck, Compass, GraduationCap,
  Target, StickyNote, Sun, Moon,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getDeptIcon } from "@/lib/icon-map";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const isDeptActive = location.pathname.startsWith("/department");
  const { profile, isAdmin, role, signOut } = useAuth();
  const { name: workspaceName, logoUrl, ceoPageName, deptLabel } = useWorkspace();
  const { departments: allDepartments } = useDepartments();

  // Admins see all departments; users see only their assigned department
  const departments = isAdmin
    ? allDepartments
    : allDepartments.filter((d) => d.id === profile?.department_id);

  const mainNav = [
    { title: "Home", url: "/", icon: Home },
    ...(isAdmin ? [{ title: ceoPageName, url: "/ceo", icon: Compass }] : []),
    { title: "Execution Hub", url: "/execution", icon: Target },
    { title: "Docs", url: "/docs", icon: FileText },
    { title: "My Notes", url: "/notes", icon: StickyNote },
    { title: "Databases", url: "/databases", icon: DbIcon },
    { title: "People", url: "/people", icon: Users },
    { title: "Training", url: "/training", icon: GraduationCap },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={workspaceName} className="h-8 w-8 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              {workspaceName.charAt(0).toUpperCase()}
            </div>
          )}
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">{workspaceName}</span>
              <span className="text-xs text-muted-foreground">Workspace</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === "/"} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <Collapsible defaultOpen={isDeptActive} className="group/collapsible">
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between">
                <span className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5" />
                  {!collapsed && deptLabel}
                </span>
                {!collapsed && <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-180" />}
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {departments.map((dept) => {
                    const Icon = getDeptIcon(dept.icon);
                    return (
                      <SidebarMenuItem key={dept.id}>
                        <SidebarMenuButton asChild>
                          <NavLink to={`/department/${dept.id}`} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                            <Icon className="h-4 w-4" />
                            {!collapsed && <span>{dept.name}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/settings" className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <Settings className="h-4 w-4" />
                      {!collapsed && <span>Settings</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {(profile?.full_name || "U").split(" ").map((n) => n[0]).join("")}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-col flex-1">
              <span className="text-xs font-medium text-sidebar-foreground">{profile?.full_name || "User"}</span>
              <span className="text-[10px] text-muted-foreground capitalize">{role}</span>
            </div>
          )}
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground transition-colors"
            title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {resolvedTheme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>
        {!collapsed && (
          <button
            onClick={signOut}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1 text-left"
          >
            Sign out
          </button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
