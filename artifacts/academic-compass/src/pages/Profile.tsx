import { useEffect, useState } from "react";
import { useAuth } from "@/store/auth";
import { useSchool } from "@/store/school";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  User as UserIcon, Shield, Mail, Calendar, CheckCircle2, XCircle,
  Crown, Users, Clock, Briefcase, Download, KeyRound, Search,
} from "lucide-react";
import * as XLSX from "xlsx";

interface ProfileItem {
  id: string; email: string; full_name: string | null; department: string | null;
  approved: boolean; created_at: string; roles: string[];
  isLocal?: boolean;
}

const ALL_ROLES = [
  { value: "admin", label: "Admin" },
  { value: "principal", label: "Principal" },
  { value: "hod", label: "Head of Department" },
  { value: "class_teacher", label: "Class Teacher" },
  { value: "subject_teacher", label: "Subject Teacher" },
  { value: "teacher", label: "Teacher" },
  { value: "senior_teacher", label: "Senior Teacher" },
] as const;

export default function Profile() {
  const { user, roles, isTeacher, isSeniorTeacher, isPrincipal, canManageStaff, refreshRoles } = useAuth();
  const { state } = useSchool();
  const [profiles, setProfiles]           = useState<ProfileItem[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [changeOpen, setChangeOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<ProfileItem | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const isAuthenticator = canManageStaff;

  const fetchProfiles = async () => {
    if (!isAuthenticator) return;
    setLoadingProfiles(true);
    try {
      const data = await api.get<ProfileItem[]>("/auth/profiles");
      const backendProfiles: ProfileItem[] = Array.isArray(data) ? data : [];
      const localTeachers: ProfileItem[] = state.teachers.map((t) => ({
        id: t.id,
        email: t.email,
        full_name: t.name,
        department: null,
        approved: true,
        created_at: new Date().toISOString(),
        roles: [t.role],
        isLocal: true,
      }));
      const merged = [...backendProfiles];
      localTeachers.forEach((lt) => {
        if (!merged.some((p) => p.email === lt.email || p.id === lt.id)) {
          merged.push(lt);
        }
      });
      setProfiles(merged);
    } catch {
      toast.error("Failed to load user profiles.");
    } finally {
      setLoadingProfiles(false);
    }
  };

      useEffect(() => {
        fetchProfiles();
      }, [roles, state.teachers.length]); // eslint-disable-line

      const filteredProfiles = profiles.filter(p => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return (p.full_name || "").toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          (p.department || "").toLowerCase().includes(q);
      });

  const handleApprovalToggle = async (userId: string, currentlyApproved: boolean) => {
    try {
      await api.post("/auth/set-approval", { userId, approved: !currentlyApproved });
      toast.success(!currentlyApproved ? "Staff member approved." : "Staff access revoked.");
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, approved: !currentlyApproved } : p));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update approval status.";
      toast.error(msg);
    }
  };

  const handleRoleToggle = async (userId: string, targetRole: string, hasRole: boolean) => {
    const action = hasRole ? "remove" : "add";
    try {
      await api.post("/auth/assign-role", { userId, role: targetRole, action });
      toast.success("Role assignment updated successfully.");
      setProfiles(prev => prev.map(p => {
        if (p.id !== userId) return p;
        return { ...p, roles: action === "add" ? [...p.roles, targetRole] : p.roles.filter(r => r !== targetRole) };
      }));
      if (userId === user?.id) await refreshRoles();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update role assignment.";
      toast.error(msg);
    }
  };

  const exportStaff = () => {
    const data = profiles.map(p => ({
      FullName: p.full_name || "",
      Email: p.email,
      Department: p.department || "",
      Approved: p.approved ? "Yes" : "No",
      ...Object.fromEntries(ALL_ROLES.map(r => [r.label, p.roles.includes(r.value) ? "Yes" : "No"])),
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Staff");
    XLSX.writeFile(workbook, `staff-roles-${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success("Staff list exported as Excel");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordBusy(true);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      toast.success("Password changed successfully");
      setChangeOpen(false);
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to change password.";
      toast.error(msg);
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleAdminReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setPasswordBusy(true);
    try {
      await api.post("/auth/admin-reset-password", { userId: resetTarget.id, newPassword: resetNewPassword });
      toast.success(`Password reset for ${resetTarget.full_name || resetTarget.email}`);
      setResetOpen(false);
      setResetTarget(null);
      setResetNewPassword("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset password.";
      toast.error(msg);
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" description="View your profile details and role assignments." />

      <div className="grid md:grid-cols-3 gap-4 md:gap-6">
        {/* User card */}
        <Card className="p-4 md:p-6 flex flex-col items-center justify-center text-center space-y-4 md:col-span-1">
          <div className="h-24 w-24 rounded-full bg-primary/10 text-primary grid place-items-center mb-2">
            <UserIcon className="h-12 w-12" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{user?.full_name || "School Member"}</h2>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
              <Mail className="h-3 w-3" /> {user?.email}
            </p>
          </div>
          <div className="w-full pt-4 border-t border-border space-y-2 text-left">
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Registered</span>
              <span className="font-medium text-foreground">{user?.id ? "Active Account" : "N/A"}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> Department</span>
              <span className="font-medium text-foreground">{user?.department || "—"}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> System Roles</span>
              <span className="font-semibold text-primary capitalize">{roles.length > 0 ? roles.join(", ") : "no roles"}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Access Status</span>
              {isPrincipal || user?.approved ? (
                <span className="font-semibold text-success flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Approved</span>
              ) : (
                <span className="font-semibold text-warning-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Pending</span>
              )}
            </div>
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setChangeOpen(true)}>
              <KeyRound className="h-3.5 w-3.5 mr-1" /> Change Password
            </Button>
          </div>
        </Card>

        {/* Roles card */}
        <Card className="p-4 md:p-6 md:col-span-2 space-y-4 md:space-y-6">
          <div>
            <h3 className="text-base md:text-lg font-semibold">Authenticator Status</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Verify if the overall school authenticator has assigned your profile as a Teacher or a Senior Teacher.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 md:gap-4">
            <div className={`p-5 rounded-xl border flex flex-col justify-between space-y-4 ${isTeacher ? "bg-green-50/50 border-green-200 dark:bg-green-950/10 dark:border-green-900" : "bg-muted/50 border-border"}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-base">Teacher Assignment</h4>
                  <p className="text-xs text-muted-foreground mt-1">Allows you to view student lists, enter marks, and add assessment comments.</p>
                </div>
                <div className={`h-8 w-8 rounded-full grid place-items-center ${isTeacher ? "bg-green-100 text-green-600 dark:bg-green-900/30" : "bg-muted text-muted-foreground"}`}>
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium">
                {isTeacher ? (
                  <><CheckCircle2 className="h-5 w-5 text-green-600" /><span className="text-green-800 dark:text-green-400">Assigned as Teacher</span></>
                ) : (
                  <><XCircle className="h-5 w-5 text-muted-foreground" /><span className="text-muted-foreground">Not Assigned</span></>
                )}
              </div>
            </div>
            <div className={`p-5 rounded-xl border flex flex-col justify-between space-y-4 ${isSeniorTeacher ? "bg-purple-50/50 border-purple-200 dark:bg-purple-950/10 dark:border-purple-900" : "bg-muted/50 border-border"}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-base">Senior Teacher Assignment</h4>
                  <p className="text-xs text-muted-foreground mt-1">Allows you to manage timetables, schedule classes, and assign teacher duties.</p>
                </div>
                <div className={`h-8 w-8 rounded-full grid place-items-center ${isSeniorTeacher ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30" : "bg-muted text-muted-foreground"}`}>
                  <Crown className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium">
                {isSeniorTeacher ? (
                  <><CheckCircle2 className="h-5 w-5 text-purple-600" /><span className="text-purple-800 dark:text-purple-400 font-semibold">Assigned as Senior Teacher</span></>
                ) : (
                  <><XCircle className="h-5 w-5 text-muted-foreground" /><span className="text-muted-foreground">Not Assigned</span></>
                )}
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground pt-4 border-t border-border">
            * Assignments are managed securely by the principal and platform administrators. If your status is incorrect, please contact your administrator.
          </div>
        </Card>
      </div>

      {/* Principal admin panel */}
      {isAuthenticator && (
        <Card className="p-4 md:p-6 space-y-4 md:space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary animate-pulse" />
                Principal — Staff Approval &amp; Role Assignment Panel
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                As the Principal, you approve new sign-ups and assign or remove roles.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search staff..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 w-56"
                />
              </div>
              <Button variant="outline" size="sm" onClick={exportStaff} disabled={profiles.length === 0}>
                <Download className="h-4 w-4 mr-1"/>Export Staff
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto border border-border rounded-lg min-w-[640px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground text-xs uppercase font-medium border-b border-border">
                <tr>
                  <th className="px-3 md:px-6 py-3">Full Name</th>
                  <th className="px-3 md:px-6 py-3">Email</th>
                  <th className="px-3 md:px-6 py-3">Department</th>
                  <th className="px-3 md:px-6 py-3 text-center">Approved</th>
                  {ALL_ROLES.map((role) => (
                    <th key={role.value} className="px-3 md:px-6 py-3 text-center">{role.label}</th>
                  ))}
                  {isAuthenticator && <th className="px-3 md:px-6 py-3 text-center">Password</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loadingProfiles ? (
                  <tr><td colSpan={ALL_ROLES.length + 5} className="px-4 md:px-6 py-10 text-center text-muted-foreground">Loading registered staff profiles...</td></tr>
                ) : profiles.length === 0 ? (
                  <tr><td colSpan={ALL_ROLES.length + 5} className="px-4 md:px-6 py-10 text-center text-muted-foreground">No staff profiles registered.</td></tr>
                ) : filteredProfiles.length === 0 ? (
                  <tr><td colSpan={ALL_ROLES.length + 5} className="px-4 md:px-6 py-10 text-center text-muted-foreground">No staff match your search.</td></tr>
                ) : filteredProfiles.map((p) => {
                  const isPrincipalRow = p.roles.includes("admin") || p.roles.includes("principal");
                  const isLocal = p.isLocal;
                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition">
                      <td className="px-3 md:px-6 py-3 md:py-4 font-medium">{p.full_name || "Unnamed"}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-muted-foreground">{p.email}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-muted-foreground">{p.department || "—"}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                        {isPrincipalRow ? (
                          <span className="text-xs text-muted-foreground italic">Principal</span>
                        ) : isLocal ? (
                          <span className="text-xs text-muted-foreground italic">Local</span>
                        ) : (
                          <div className="flex justify-center items-center gap-2">
                            <span className={`text-xs ${p.approved ? "text-success font-semibold" : "text-warning-foreground"}`}>
                              {p.approved ? "Approved" : "Pending"}
                            </span>
                            <Switch checked={p.approved} onCheckedChange={() => handleApprovalToggle(p.id, p.approved)} />
                          </div>
                        )}
                      </td>
                      {ALL_ROLES.map((role) => {
                        const hasRole = p.roles.includes(role.value);
                        return (
                          <td key={role.value} className="px-3 md:px-6 py-3 md:py-4 text-center">
                            <div className="flex justify-center items-center gap-2">
                              <span className={`text-xs ${hasRole ? "text-green-600 font-semibold" : "text-muted-foreground"}`}>{hasRole ? "Yes" : "No"}</span>
                              <Switch checked={hasRole} onCheckedChange={() => handleRoleToggle(p.id, role.value, hasRole)} disabled={isLocal} />
                            </div>
                          </td>
                        );
                      })}
                      {isAuthenticator && !isPrincipalRow && (
                        <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                          <Button variant="ghost" size="sm" onClick={() => { setResetTarget(p); setResetOpen(true); }}>
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Change Password Dialog */}
      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> Change Password
            </DialogTitle>
            <DialogDescription>
              Update your account password. You must know your current password to proceed.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <Label htmlFor="current-password">Current Password</Label>
              <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required disabled={passwordBusy} />
            </div>
            <div>
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} disabled={passwordBusy} />
            </div>
            <Button type="submit" className="w-full" disabled={passwordBusy}>
              {passwordBusy ? "Updating..." : "Change Password"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Admin Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> Reset Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for {resetTarget?.full_name || resetTarget?.email}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdminReset} className="space-y-4">
            <div>
              <Label htmlFor="reset-new-password">New Password</Label>
              <Input id="reset-new-password" type="password" value={resetNewPassword} onChange={(e) => setResetNewPassword(e.target.value)} required minLength={6} disabled={passwordBusy} />
            </div>
            <Button type="submit" className="w-full" disabled={passwordBusy}>
              {passwordBusy ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
