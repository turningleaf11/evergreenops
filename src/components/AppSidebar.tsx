import { useEffect, useRef } from "react";
import {
  Home, FileText, Database as DbIcon, Users,
  Settings, Building2, ShieldCheck, Compass, GraduationCap,
  Target, StickyNote, Sun, Moon, Clock, Building, Pizza, PanelLeft, Pin, PinOff, Mail, Sparkles, Video, BarChart3, Briefcase, Rocket,
  HelpCircle, Code2,
} from "lucide-react";
import { useIsDeveloperWorkspace } from "@/lib/developer";
import { useSidebarMode } from "@/contexts/SidebarModeContext";
import { useGmailAccess } from "@/hooks/useGmailAccess";
import { usePageGrants } from "@/hooks/usePageAccess";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getDeptIcon } from "@/lib/icon-map";
import { useAddonEnabled } from "@/hooks/useAddonEnabled";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const { state, setOpen } = useSidebar();
  const { mode, toggleMode } = useSidebarMode();
  const isPinned = mode === "pinned";
  const collapsed = state === "collapsed";
  const { profile, isAdmin, isPrimaryAdmin, isLeader, role, signOut } = useAuth();
  const { grants } = usePageGrants();
  const can = (key: string) => isAdmin || grants.has(key as any);
  const { name: workspaceName, logoUrl, ceoPageName, deptLabel } = useWorkspace();
  const { departments: allDepartments } = useDepartments();
  const { resolvedTheme, setTheme } = useTheme();
  const isDevWorkspace = useIsDeveloperWorkspace();
  const showDeveloper = isDevWorkspace && isPrimaryAdmin;

  const timeClockEnabled = useAddonEnabled("time-clock");
  const marketResearchEnabled = useAddonEnabled("real-estate-research");
  const contentStudioEnabled = useAddonEnabled("content-studio");
  const aiWorkshopEnabled = useAddonEnabled("ai-workshop");
  const userTimeClockEnabled = profile?.time_clock_enabled || false;
  const { hasAccess: gmailAccess } = useGmailAccess();

  // Admins see all departments; users see only their assigned department
  const departments = isAdmin
    ? allDepartments
    : allDepartments.filter((d) => d.id === profile?.department_id);

  const homeNav = [
    { title: "Home", url: "/", icon: Home },
    ...(isPrimaryAdmin ? [{ title: ceoPageName, url: "/ceo", icon: Compass }] : []),
  ];

  const cultureNav = [
    { title: "Feed", url: "/feed", icon: Pizza },
    { title: "People", url: "/people", icon: Users },
    { title: "Training", url: "/training", icon: GraduationCap },
  ];

  const workNav = [
    ...(isLeader || can("execution") ? [{ title: "Execution Hub", url: "/execution", icon: Target }] : []),
    ...(isAdmin || can("process_map") ? [{ title: "Process Map", url: "/process-map", icon: Briefcase }] : []),
    ...(gmailAccess ? [{ title: "Inbox", url: "/inbox", icon: Mail }] : []),
    ...(isAdmin || can("crm") ? [{ title: "Deals", url: "/crm/deals", icon: Rocket }] : []),
    ...(isLeader || can("meetings") ? [{ title: "Meetings", url: "/meetings", icon: Video }] : []),
    { title: "Wiki", url: "/docs", icon: FileText },
    { title: "My Notes", url: "/notes", icon: StickyNote },
    ...(isLeader || can("lists") ? [{ title: "Lists", url: "/databases", icon: DbIcon }] : []),
  ];

  const reportingNav = [
    ...(isAdmin ? [{ title: "Scorecard", url: "/scorecard", icon: BarChart3 }] : []),
  ];

  const addonNav = [
    ...(timeClockEnabled && (isAdmin || userTimeClockEnabled) ? [{ title: "Time Clock", url: "/time-clock", icon: Clock }] : []),
    ...(marketResearchEnabled && (isAdmin || can("market_research")) ? [{ title: "Market Research", url: "/market-research", icon: Building }] : []),
    ...(contentStudioEnabled && (isAdmin || can("content_studio")) ? [{ title: "Content Studio", url: "/content-studio", icon: Sparkles }] : []),
    ...(aiWorkshopEnabled && (isAdmin || can("ai_workshop")) ? [{ title: "AI Workshop", url: "/ai-workshop", icon: Sparkles }] : []),
  ];

  // AI Hub - CEO baseline, others need grant
  const aiHubNav = (isPrimaryAdmin || can("ai_hub")) ? [
    { title: "AI Hub", url: "/ai-hub", icon: Sparkles },
  ] : [];

  // Click anywhere on the empty space of the collapsed sidebar to expand
  const handleRailClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!collapsed) return;
    const target = e.target as HTMLElement;
    if (target.closest("a,button")) return;
    setOpen(true);
  };

  // Click outside the expanded sidebar → collapse it (overlay behaviour, only when floating)
  const sidebarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (collapsed || isPinned) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = sidebarRef.current;
      if (!root) return;
      const target = e.target as HTMLElement;
      // Ignore clicks inside the sidebar itself or on the header trigger
      if (root.contains(target)) return;
      if (target.closest("[data-sidebar='trigger']")) return;
      // Ignore clicks inside Radix popovers/dialogs that may be portaled
      if (target.closest("[data-radix-popper-content-wrapper]")) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [collapsed, isPinned, setOpen]);

  // Wrap nav buttons with a tooltip that shows the title when collapsed
  const NavItem = ({ item }: { item: { title: string; url: string; icon: any } }) => {
    const link = (
      <SidebarMenuButton asChild>
        <NavLink to={item.url} end={item.url === "/"} className="hover:text-foreground rounded-lg transition-colors" activeClassName="text-primary font-medium">
          <item.icon className="h-4 w-4" />
          {!collapsed && <span>{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    );
    if (!collapsed) return link;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">{item.title}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className={cn("contents", isPinned && "sidebar-pinned-mode")}>
    <Sidebar collapsible="icon">
      <div ref={sidebarRef} onClick={handleRailClick} className="contents">
      <SidebarContent className="pt-2">

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {homeNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <NavItem item={item} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[10px]">People & Culture</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {cultureNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <NavItem item={item} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[10px]">Work</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {workNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <NavItem item={item} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5" />
              {deptLabel}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {departments.map((dept) => {
                const Icon = getDeptIcon(dept.icon);
                const link = (
                  <SidebarMenuButton asChild>
                    <NavLink to={`/department/${dept.id}`} className="hover:text-foreground rounded-lg transition-colors" activeClassName="text-primary font-medium">
                      <Icon className="h-4 w-4" />
                      {!collapsed && <span>{dept.name}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                );
                return (
                  <SidebarMenuItem key={dept.id}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">{dept.name}</TooltipContent>
                      </Tooltip>
                    ) : link}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


        {/* Reporting */}
        {reportingNav.length > 0 && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel className="text-[10px]">Reporting</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {reportingNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <NavItem item={item} />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Add-Ons */}
        {addonNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px]">Apps</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {addonNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <NavItem item={item} />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* AI Hub */}
        {aiHubNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px]">AI Hub</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {aiHubNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <NavItem item={item} />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {!collapsed && (
        <SidebarFooter className="border-t border-sidebar-border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {(profile?.full_name || "U").split(" ").map((n) => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col flex-1">
              <span className="text-xs font-medium text-sidebar-foreground">{profile?.full_name || "User"}</span>
              <span className="text-[10px] text-muted-foreground capitalize">{role}</span>
            </div>
            <NavLink to="/settings" className="p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground transition-colors" activeClassName="text-sidebar-foreground" title="Settings">
              <Settings className="h-3.5 w-3.5" />
            </NavLink>
            <NavLink to="/help" className="p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground transition-colors" activeClassName="text-sidebar-foreground" title="Help & docs">
              <HelpCircle className="h-3.5 w-3.5" />
            </NavLink>
            {showDeveloper && (
              <NavLink to="/settings/developer" className="p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground transition-colors" activeClassName="text-sidebar-foreground" title="Developer">
                <Code2 className="h-3.5 w-3.5" />
              </NavLink>
            )}
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground transition-colors"
              title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {resolvedTheme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
          </div>
          <button
            onClick={signOut}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1 text-left"
          >
            Sign out
          </button>
          <div className="pt-1 border-t border-sidebar-border/60 -mx-3 px-3 mt-1 flex items-center gap-1">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 h-8 flex items-center gap-2 px-2 rounded-md text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors justify-start text-xs"
              title="Collapse sidebar"
            >
              <PanelLeft className="h-3.5 w-3.5" />
              <span>Collapse</span>
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleMode}
                  className={cn(
                    "h-8 w-8 flex items-center justify-center rounded-md transition-colors",
                    isPinned
                      ? "text-primary bg-sidebar-accent"
                      : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {isPinned ? "Unpin sidebar (auto-collapse)" : "Pin sidebar (keep open)"}
              </TooltipContent>
            </Tooltip>
          </div>
        </SidebarFooter>
      )}
      </div>

      {/* Floating cluster (collapsed state only) — pinned to bottom-left of viewport */}
      {collapsed && (
        <div className="fixed bottom-3 left-3 z-50 flex items-center gap-1 rounded-full border border-border/60 bg-background/90 backdrop-blur shadow-lg px-1.5 py-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className="h-7 w-7 cursor-default">
                <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                  {(profile?.full_name || "U").split(" ").map((n) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">{profile?.full_name || "User"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink to="/settings" className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" activeClassName="text-foreground">
                <Settings className="h-3.5 w-3.5" />
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Settings</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                {resolvedTheme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setOpen(true)}
                className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <PanelLeft className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Expand sidebar</TooltipContent>
          </Tooltip>
        </div>
      )}
    </Sidebar>
    </div>
  );
}
