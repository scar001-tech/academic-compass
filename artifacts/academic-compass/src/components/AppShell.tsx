import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, UserSquare, ClipboardList,
  FileSpreadsheet, PencilLine, GitMerge, LineChart, Printer, Settings,
  Wifi, WifiOff, RefreshCw, School, User, LogOut, CalendarDays, Menu, ChevronDown, Phone,
} from "lucide-react";
import { useState } from "react";
import { useSchool } from "@/store/school";
import { useAuth } from "@/store/auth";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const NAV = [
  { to: "/",           label: "Dashboard",       icon: LayoutDashboard, end: true },
  { to: "/students",   label: "Students",         icon: Users },
  { to: "/parent-contacts", label: "Parent Contacts", icon: Phone },
  { to: "/classes",    label: "Classes & Streams", icon: GraduationCap },
  { to: "/subjects",   label: "Subjects",         icon: BookOpen },
  { to: "/teachers",   label: "Teachers",         icon: UserSquare },
  { to: "/exams",      label: "Exams",            icon: ClipboardList },
  { to: "/sheets",     label: "Mark Sheets",      icon: FileSpreadsheet },
  { to: "/entry",      label: "Mark Entry",       icon: PencilLine },
  { to: "/marks",      label: "Marks & Results",   icon: FileSpreadsheet },
  { to: "/timetable",  label: "Timetable",        icon: CalendarDays },
  { to: "/conflicts",  label: "Conflicts",        icon: GitMerge },
  { to: "/transcripts",label: "Transcripts",      icon: LineChart },
  { to: "/reports",    label: "Report Forms",     icon: Printer },
  { to: "/settings",   label: "Settings",         icon: Settings },
  { to: "/profile",    label: "My Profile",       icon: User },
];

const FOOTER_LINKS = [
  { to: "/", label: "Home" },
  { to: "/sheets", label: "Mark Sheets" },
  { to: "/entry", label: "Mark Entry" },
  { to: "/marks", label: "Marks & Results" },
  { to: "/reports", label: "Reports" },
  { to: "/students", label: "Students" },
  { to: "/timetable", label: "Timetable" },
];

const PAGE_BG: Record<string, string> = {
  "/": "page-bg-dashboard",
  "/students": "page-bg-students",
  "/parent-contacts": "page-bg-students",
  "/classes": "page-bg-classes",
  "/subjects": "page-bg-subjects",
  "/teachers": "page-bg-teachers",
  "/exams": "page-bg-exams",
  "/sheets": "page-bg-sheets",
  "/entry": "page-bg-entry",
  "/marks": "page-bg-marks",
  "/timetable": "page-bg-timetable",
  "/conflicts": "page-bg-conflicts",
  "/transcripts": "page-bg-transcripts",
  "/reports": "page-bg-reports",
  "/settings": "page-bg-settings",
  "/profile": "page-bg-profile",
};

const KEY_QUICK_LINKS = [
  { to: "/", label: "Dashboard" },
  { to: "/sheets", label: "Mark Sheets" },
  { to: "/entry", label: "Mark Entry" },
  { to: "/marks", label: "Marks & Results" },
  { to: "/reports", label: "Reports" },
  { to: "/students", label: "Students" },
  { to: "/timetable", label: "Timetable" },
];

const MORE_LINKS = [
  { to: "/classes", label: "Classes & Streams", icon: GraduationCap },
  { to: "/subjects", label: "Subjects", icon: BookOpen },
  { to: "/teachers", label: "Teachers", icon: UserSquare },
  { to: "/exams", label: "Exams", icon: ClipboardList },
  { to: "/sheets", label: "Mark Sheets", icon: FileSpreadsheet },
  { to: "/marks", label: "Marks & Results", icon: FileSpreadsheet },
  { to: "/conflicts", label: "Conflicts", icon: GitMerge },
  { to: "/transcripts", label: "Transcripts", icon: LineChart },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/profile", label: "My Profile", icon: User },
];

export default function AppShell() {
  const { state, activeCurriculum, setActiveCurriculum, syncNow } = useSchool();
  const { user, signOut, isPrincipal, isSeniorTeacher, isTeacher, canManageStaff } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const pending   = state.entries.filter(e => e.pending).length;
  const conflicts = state.conflicts.filter(c => c.status === "pending").length;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const canAccess = (roles: string[]) => {
    if (isPrincipal) return true;
    if (isSeniorTeacher && roles.some(r => ["senior_teacher", "teacher", "all"].includes(r))) return true;
    if (isTeacher && roles.some(r => ["teacher", "all"].includes(r))) return true;
    return false;
  };

  const filteredNav = NAV.filter(n => {
    if (n.to === "/teachers" || n.to === "/settings") return canAccess(["admin", "principal"]);
    return true;
  });

  const filteredFooterLinks = FOOTER_LINKS.filter(link => filteredNav.some(n => n.to === link.to));
  const filteredQuickLinks = KEY_QUICK_LINKS.filter(link => filteredNav.some(n => n.to === link.to));

  const pageBgClass = PAGE_BG[location.pathname] || "page-bg-default";

  const SidebarContent = () => (
    <>
      <div className="px-5 py-4 flex items-center gap-2 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-md bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center">
          <School className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-semibold">Academic Compass</div>
          <div className="text-[11px] text-sidebar-foreground/70">Academic Ops</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {filteredNav.map((n) => (
          <NavLink
            key={n.to} to={n.to} end={n.end}
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) => cn(
              "mx-2 my-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "hover:bg-sidebar-accent/60"
            )}
          >
            <n.icon className="h-4 w-4 opacity-90" />
            <span className="flex-1">{n.label}</span>
            {n.to === "/conflicts" && conflicts > 0 && (
              <span className="text-[10px] rounded-full bg-destructive text-destructive-foreground px-1.5 py-0.5 font-semibold">{conflicts}</span>
            )}
            {n.to === "/entry" && pending > 0 && (
              <span className="text-[10px] rounded-full bg-warning text-warning-foreground px-1.5 py-0.5 font-semibold">{pending}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 text-[11px] text-sidebar-foreground/60 border-t border-sidebar-border">
        v1.0 · {state.settings.schoolName}
      </div>
    </>
  );

  return (
    <div className="min-h-screen text-foreground flex flex-col bg-background overflow-x-hidden">
      {/* Header with key quick links */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b no-print">
        <div className="px-4 lg:px-6">
          {/* Top row: logo + quick links + user controls */}
          <div className="h-14 flex items-center gap-3">
            {/* Mobile menu toggle + logo */}
            <div className="lg:hidden flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)} className="h-8 w-8">
                <Menu className="h-5 w-5" />
              </Button>
              <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center">
                <School className="h-4 w-4" />
              </div>
              <div className="text-sm font-semibold">Academic Compass</div>
            </div>

            {/* Desktop logo */}
            <div className="hidden lg:flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center">
                <School className="h-4 w-4" />
              </div>
              <div className="text-sm font-semibold">Academic Compass</div>
            </div>

             {/* Desktop key quick links */}
             <nav className="hidden lg:flex items-center gap-1 ml-6">
               {filteredQuickLinks.map((link) => (
                 <NavLink
                   key={link.to}
                   to={link.to}
                   end={link.to === "/"}
                   className={({ isActive }) => cn(
                     "px-3 py-1.5 text-sm rounded-md transition-colors",
                     isActive
                       ? "bg-primary/10 text-primary font-medium"
                       : "text-muted-foreground hover:text-foreground hover:bg-muted"
                   )}
                 >
                   {link.label}
                 </NavLink>
               ))}
               <div className="relative">
                 <Button
                   variant="ghost"
                   size="sm"
                   className="h-8 px-2 text-sm text-muted-foreground hover:text-foreground"
                   onClick={() => setMoreOpen(!moreOpen)}
                 >
                   More <ChevronDown className="h-3.5 w-3.5 ml-1" />
                 </Button>
                 {moreOpen && (
                   <>
                     <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                     <div className="absolute top-full left-0 mt-1 w-48 bg-card border rounded-md shadow-lg z-50 py-1">
                       {MORE_LINKS.filter(link => filteredNav.some(n => n.to === link.to)).map((link) => (
                         <NavLink
                           key={link.to}
                           to={link.to}
                           end={link.to === "/"}
                           className={({ isActive }) => cn(
                             "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                             isActive
                               ? "bg-primary/10 text-primary font-medium"
                               : "text-muted-foreground hover:text-foreground hover:bg-muted"
                           )}
                           onClick={() => setMoreOpen(false)}
                         >
                           <link.icon className="h-4 w-4" />
                           {link.label}
                         </NavLink>
                       ))}
                     </div>
                   </>
                 )}
               </div>
             </nav>

            {/* Mobile top nav dropdown */}
            <div className="lg:hidden ml-auto">
              <Select value={location.pathname} onValueChange={(v) => { navigate(v); }}>
                <SelectTrigger className="h-8 w-[150px] text-xs">
                  <SelectValue placeholder="Navigate" />
                </SelectTrigger>
                <SelectContent>
                  {filteredNav.map((n) => (
                    <SelectItem key={n.to} value={n.to}>
                      <span className="flex items-center gap-2">
                        <n.icon className="h-3.5 w-3.5" />
                        {n.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Right side controls */}
            <div className="ml-auto flex items-center gap-2 md:gap-3">
              <Select value={activeCurriculum} onValueChange={(v) => setActiveCurriculum(v as "cbc" | "844")}>
                <SelectTrigger className="h-9 w-[150px] md:w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {state.curricula.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className={cn(
                          "h-2 w-2 rounded-full",
                          c.id === "cbc" ? "bg-primary" : "bg-success"
                        )}/>
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="h-4 w-px bg-border mx-1 hidden md:block" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 cursor-default select-none">
                    {state.online
                      ? <Wifi className="h-4 w-4 text-success"/>
                      : <WifiOff className="h-4 w-4 text-destructive"/>}
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {state.online ? "Online" : "Offline"}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {state.online ? "Connected to network" : "No network connection — changes will sync when reconnected"}
                </TooltipContent>
              </Tooltip>

              {pending > 0 && (
                <Badge variant="outline" className="border-warning text-warning-foreground bg-warning-soft hidden sm:inline-flex">
                  {pending} pending
                </Badge>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={syncNow} disabled={!state.online || pending === 0} className="hidden sm:inline-flex">
                    <RefreshCw className="h-4 w-4 mr-1"/> Sync
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {state.lastSyncAt ? `Last sync ${new Date(state.lastSyncAt).toLocaleTimeString()}` : "Never synced"}
                </TooltipContent>
              </Tooltip>

              <div className="h-4 w-px bg-border mx-1 hidden md:block" />

              <span className="text-xs font-medium text-muted-foreground hidden md:inline">
                {user?.full_name || user?.email}
              </span>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate("/profile")}
                    className="h-9 w-9 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    <User className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View Profile</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      signOut();
                      toast.success("Signed out successfully.");
                    }}
                    className="h-9 w-9 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sign Out</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main key={location.pathname} className={cn("flex-1 min-w-0 px-4 lg:px-6 py-4 md:py-5 animate-fade-in", pageBgClass)}>
        <Outlet />
      </main>

      {/* Footer with quick links */}
      <footer className="bg-card border-t no-print">
        <div className="px-4 lg:px-6 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-primary/10 text-primary grid place-items-center">
                <School className="h-3 w-3" />
              </div>
              <span className="text-xs text-muted-foreground">
                Academic Compass · {state.settings.schoolName} · v1.0
              </span>
            </div>
            <nav className="flex flex-wrap items-center gap-1">
              {filteredFooterLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === "/"}
                  className={({ isActive }) => cn(
                    "px-2 py-1 text-xs rounded transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <div className="text-xs text-muted-foreground">
              {new Date().getFullYear()} Academic Compass. All rights reserved.
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative w-64 h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}
    </div>
  );
}
