import {
  Home, FileText, Database as DbIcon, Users, ChevronDown,
  Code2, Palette, Lightbulb, Megaphone, Settings, Building2,
  Target, FolderKanban, CheckSquare, Bug, Calendar, Plus,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { departments, databases } from "@/lib/mock-data";

const deptIconMap: Record<string, React.ElementType> = {
  Code2, Palette, Lightbulb, Megaphone, Settings,
};

const dbIconMap: Record<string, React.ElementType> = {
  Target, FolderKanban, CheckSquare, Bug, Calendar, Plus,
};

const mainNav = [
  { title: "Home", url: "/", icon: Home },
  { title: "Docs", url: "/docs", icon: FileText },
  { title: "Databases", url: "/databases", icon: DbIcon },
  { title: "People", url: "/people", icon: Users },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const isDeptActive = location.pathname.startsWith("/department");
  const isDbActive = location.pathname.startsWith("/databases");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            T
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">TeamSpace</span>
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
                  {!collapsed && "Departments"}
                </span>
                {!collapsed && <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-180" />}
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {departments.map((dept) => {
                    const Icon = deptIconMap[dept.icon] || Building2;
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

        <SidebarGroup>
          <Collapsible defaultOpen={isDbActive} className="group/collapsible">
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between">
                <span className="flex items-center gap-2">
                  <DbIcon className="h-3.5 w-3.5" />
                  {!collapsed && "Databases"}
                </span>
                {!collapsed && <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-180" />}
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {databases.map((db) => {
                    const Icon = dbIconMap[db.icon] || DbIcon;
                    return (
                      <SidebarMenuItem key={db.id}>
                        <SidebarMenuButton asChild>
                          <NavLink to={`/databases/${db.id}`} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                            <Icon className="h-4 w-4" />
                            {!collapsed && <span>{db.title}</span>}
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
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">SC</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-xs font-medium text-sidebar-foreground">Sarah Chen</span>
              <span className="text-[10px] text-muted-foreground">Admin</span>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
