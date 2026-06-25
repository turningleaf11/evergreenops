// AppSidebar — full-height left column with three regions:
//
//   ┌──────────────────────────┐
//   │  Header (logo + name)    │  ← workspace identity lives here
//   ├──────────────────────────┤
//   │                          │
//   │  Nav (scrolls)           │  ← grouped sections + dept list
//   │                          │
//   ├──────────────────────────┤
//   │  Footer (account menu)   │  ← avatar + name + dropdown to
//   │                          │     Settings / Theme / Help / Sign out
//   └──────────────────────────┘
//
// Collapse is a WIDTH CHANGE (240px ↔ ~56px icons-only), not a slide.
// No pin button; no floating cluster at the bottom of the viewport.

import {
  Home, FileText, Database as DbIcon, Users,
  Settings, Building2, Compass, GraduationCap,
  Target, StickyNote, Sun, Moon, Clock, Building, Pizza, PanelLeft, Mail, Sparkles, Video, BarChart3, Briefcase, Rocket,
  HelpCircle, Code2, MessagesSquare, Layers, LogOut, ChevronsUpDown,
} from "lucide-react";
import { useIsDeveloperWorkspace } from "@/lib/developer";
import { useGmailAccess } from "@/hooks/useGmailAccess";
import { usePageGrants } from "@/hooks/usePageAccess";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getDeptIcon } from "@/lib/icon-map";
import { useAddonEnabled } from "@/hooks/useAddonEnabled";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile, isAdmin, isPrimaryAdmin, isLeader, isOrbitOnly, role, signOut } = useAuth();
  const { grants } = usePageGrants();
  const can = (key: string) => isAdmin || grants.has(key as any);
  const { name: workspaceName, logoUrl, ceoPageName, deptLabel } = useWorkspace();
  const { departments: allDepartments } = useDepartments();
  const { resolvedTheme, setTheme } = useTheme();
  const isDevWorkspace = useIsDeveloperWorkspace();
  const showDeveloper = isDevWorkspace && isPrimaryAdmin;
  const navigate = useNavigate();

  const timeClockEnabled = useAddonEnabled("time-clock");
  const marketResearchEnabled = useAddonEnabled("real-estate-research");
  const contentStudioEnabled = useAddonEnabled("content-studio");
  const aiWorkshopEnabled = useAddonEnabled("ai-workshop");
  const userTimeClockEnabled = profile?.time_clock_enabled || false;
  const { hasAccess: gmailAccess } = useGmailAccess();

  // Admins see all departments; users see only their assigned dept.
  // Orbit-only members only see their own Orbit Program dept.
  const departments = isAdmin
    ? allDepartments
    : isOrbitOnly
      ? allDepartments.filter((d) => (d as any).is_program && d.id === profile?.department_id)
      : allDepartments.filter((d) => d.id === profile?.department_id);

  const homeNav = isOrbitOnly
    ? [{ title: "Home", url: "/", icon: Home }]
    : [
        { title: "Home", url: "/", icon: Home },
        ...(isPrimaryAdmin ? [{ title: ceoPageName, url: "/ceo", icon: Compass }] : []),
        ...(isLeader || isAdmin ? [{ title: "Sync", url: "/sync", icon: MessagesSquare }] : []),
      ];

  const cultureNav = [
    { title: "Feed", url: "/feed", icon: Pizza },
    { title: "People", url: "/people", icon: Users },
    { title: "Training", url: "/training", icon: GraduationCap },
  ];

  // Process Map, Meetings, Whiteboards, and Lists are still being developed --
  // temporarily restricted to primary admin only (not the usual admin/leader
  // baseline or per-user grants). Revert to the commented conditions below
  // when ready to reopen them.
  const workNav = isOrbitOnly ? [] : [
    ...(isLeader || can("execution") ? [{ title: "Execution Hub", url: "/execution", icon: Target }] : []),
    ...(isPrimaryAdmin /* was: isAdmin || can("process_map") */ ? [{ title: "Process Map", url: "/process-map", icon: Briefcase }] : []),
    ...(gmailAccess ? [{ title: "Inbox", url: "/inbox", icon: Mail }] : []),
    ...(isAdmin || can("crm") ? [{ title: "Deals", url: "/crm/deals", icon: Rocket }] : []),
    ...(isPrimaryAdmin /* was: isLeader || can("meetings") */ ? [{ title: "Meetings", url: "/meetings", icon: Video }] : []),
    { title: "Wiki", url: "/docs", icon: FileText },
    { title: "My Notes", url: "/notes", icon: StickyNote },
    ...(isPrimaryAdmin /* was: unconditional */ ? [{ title: "Whiteboards", url: "/whiteboards", icon: Layers }] : []),
    ...(isPrimaryAdmin /* was: isLeader || can("lists") */ ? [{ title: "Lists", url: "/databases", icon: DbIcon }] : []),
  ];

  const reportingNav = isOrbitOnly ? [] : [
    ...(isAdmin ? [{ title: "Scorecard", url: "/scorecard", icon: BarChart3 }] : []),
  ];

  const addonNav = isOrbitOnly ? [] : [
    ...(timeClockEnabled && (isAdmin || userTimeClockEnabled) ? [{ title: "Time Clock", url: "/time-clock", icon: Clock }] : []),
    ...(marketResearchEnabled && (isAdmin || can("market_research")) ? [{ title: "Market Research", url: "/market-research", icon: Building }] : []),
    ...(contentStudioEnabled && (isAdmin || can("content_studio")) ? [{ title: "Content Studio", url: "/content-studio", icon: Sparkles }] : []),
    ...(aiWorkshopEnabled && (isAdmin || can("ai_workshop")) ? [{ title: "AI Workshop", url: "/ai-workshop", icon: Sparkles }] : []),
  ];

  const aiHubNav = (!isOrbitOnly && (isPrimaryAdmin || can("ai_hub"))) ? [
    { title: "AI Hub", url: "/ai-hub", icon: Sparkles },
  ] : [];

  // Single nav-item renderer — tooltip wraps automatically when collapsed.
  const NavItem = ({ item }: { item: { title: string; url: string; icon: any } }) => {
    const link = (
      <SidebarMenuButton asChild>
        <NavLink to={item.url} end={item.url === "/"} className="hover:text-foreground rounded-lg transition-colors" activeClassName="text-primary font-medium bg-sidebar-accent">
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
    <Sidebar collapsible="icon">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <SidebarHeader className="p-2 border-b border-sidebar-border/60">
        <div className={cn(
          "flex items-center transition-colors",
          collapsed ? "flex-col gap-2 px-0 py-1" : "gap-2.5 p-2",
        )}>
          {/* Logo — bigger when collapsed (fills the icon column nicely),
              object-contain so the actual image renders fully without cropping. */}
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={workspaceName}
              className={cn(
                "rounded-lg object-contain shrink-0 bg-transparent",
                collapsed ? "h-9 w-9" : "h-7 w-7",
              )}
            />
          ) : (
            <div
              className={cn(
                "rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0",
                collapsed ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs",
              )}
            >
              {workspaceName.charAt(0).toUpperCase()}
            </div>
          )}

          {!collapsed && (
            <>
              <span className="text-sm font-semibold truncate flex-1 text-sidebar-foreground">{workspaceName}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleSidebar}
                    className="p-1 rounded-md text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                    aria-label="Collapse sidebar"
                  >
                    <PanelLeft className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">Collapse</TooltipContent>
              </Tooltip>
            </>
          )}

          {/* Collapsed: expand trigger sits directly under the logo,
              same column, smaller chevron. No avatar-pill weirdness. */}
          {collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleSidebar}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                  aria-label="Expand sidebar"
                >
                  <PanelLeft className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Expand</TooltipContent>
            </Tooltip>
          )}
        </div>
      </SidebarHeader>

      {/* ── Nav (scrolls) ────────────────────────────────────────────────── */}
      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {homeNav.map((item) => (
                <SidebarMenuItem key={item.title}><NavItem item={item} /></SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[10px]">People & Culture</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {cultureNav.map((item) => (
                <SidebarMenuItem key={item.title}><NavItem item={item} /></SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {workNav.length > 0 && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel className="text-[10px]">Work</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {workNav.map((item) => (
                  <SidebarMenuItem key={item.title}><NavItem item={item} /></SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {departments.length > 0 && (
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
                      <NavLink to={`/department/${dept.id}`} className="hover:text-foreground rounded-lg transition-colors" activeClassName="text-primary font-medium bg-sidebar-accent">
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
        )}

        {reportingNav.length > 0 && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel className="text-[10px]">Reporting</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {reportingNav.map((item) => (
                  <SidebarMenuItem key={item.title}><NavItem item={item} /></SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {addonNav.length > 0 && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel className="text-[10px]">Apps</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {addonNav.map((item) => (
                  <SidebarMenuItem key={item.title}><NavItem item={item} /></SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {aiHubNav.length > 0 && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel className="text-[10px]">AI Hub</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {aiHubNav.map((item) => (
                  <SidebarMenuItem key={item.title}><NavItem item={item} /></SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* ── Footer: account menu ─────────────────────────────────────────── */}
      <SidebarFooter className="border-t border-sidebar-border/60 p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "w-full flex items-center gap-2.5 rounded-lg p-2 hover:bg-sidebar-accent transition-colors",
              collapsed && "justify-center",
            )}>
              <UserAvatar
                name={profile?.full_name}
                avatarUrl={profile?.avatar_url}
                className="h-7 w-7 shrink-0"
                fallbackClassName="text-xs bg-primary text-primary-foreground"
              />
              {!collapsed && (
                <>
                  <div className="flex flex-col flex-1 min-w-0 text-left">
                    <span className="text-xs font-medium text-sidebar-foreground truncate">{profile?.full_name || "User"}</span>
                    <span className="text-[10px] text-muted-foreground capitalize">{role}</span>
                  </div>
                  <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={collapsed ? "right" : "top"}
            align="start"
            className="w-56"
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Signed in as <span className="text-foreground font-medium">{profile?.full_name || "User"}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <Settings className="h-3.5 w-3.5" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              {resolvedTheme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              <span>{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/help")}>
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Help & docs</span>
            </DropdownMenuItem>
            {showDeveloper && (
              <DropdownMenuItem onClick={() => navigate("/settings/developer")}>
                <Code2 className="h-3.5 w-3.5" />
                <span>Developer</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
