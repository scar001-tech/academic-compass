import { useSchool } from "@/store/school";
import { useAuth } from "@/store/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Lock, Download, Upload, Shield, Search, X } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { api } from "@/lib/api";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BackendProfile {
  id: string;
  email: string;
  full_name: string | null;
  department: string | null;
  approved: boolean;
  created_at: string;
  roles: string[];
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

export default function Teachers() {
  const { isPrincipal } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [backendProfiles, setBackendProfiles] = useState<BackendProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState<string>("subject_teacher");
  const [password, setPassword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const pendingProfiles = backendProfiles.filter(p => !p.approved);
  const filteredProfiles = backendProfiles.filter(p => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (p.full_name || "").toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      (p.department || "").toLowerCase().includes(q);
  });

  const fetchProfiles = async () => {
    if (!isPrincipal) return;
    setLoadingProfiles(true);
    try {
      const data = await api.get<BackendProfile[]>("/auth/profiles");
      const sorted = Array.isArray(data) ? data : [];
      sorted.sort((a, b) => Number(a.approved) - Number(b.approved) || a.full_name?.localeCompare(b.full_name || "") || 0);
      setBackendProfiles(sorted);
    } catch {
      toast.error("Failed to load staff profiles.");
    } finally {
      setLoadingProfiles(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [isPrincipal]); // eslint-disable-line

  const add = async () => {
    if (!isPrincipal) { toast.error("Only the Principal can manage the staff directory"); return; }
    try {
      const res = await api.post<{ id: string; email: string; full_name: string | null; department: string | null; roles: string[]; temp_password: string }>("/auth/create-staff", {
        email: email || `new.teacher.${Date.now()}@school.ac.ke`,
        full_name: name || "New Teacher",
        department: department || undefined,
        role: role as BackendProfile["roles"][number],
        password: password || undefined,
      });
      toast.success(`Staff created. Password: ${res.temp_password}`);
      setOpen(false);
      setName(""); setEmail(""); setDepartment(""); setRole("subject_teacher"); setPassword("");
      await fetchProfiles();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create staff member.";
      toast.error(msg);
    }
  };

  const remove = async (id: string) => {
    if (!isPrincipal) { toast.error("Only the Principal can manage the staff directory"); return; }
    try {
      await api.delete(`/auth/profiles/${id}`);
      toast.success("Staff member removed.");
      setBackendProfiles(prev => prev.filter(p => p.id !== id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove staff member.";
      toast.error(msg);
    }
  };

  const exportTeachers = () => {
    const data = backendProfiles.map(p => ({
      Name: p.full_name || "",
      Email: p.email,
      Department: p.department || "",
      Approved: p.approved ? "Yes" : "No",
      Roles: p.roles.join(", "),
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Staff");
    XLSX.writeFile(workbook, `staff-${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success("Staff exported as Excel");
  };

  const importTeachers = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(sheet);
        if (!Array.isArray(json) || json.length === 0) throw new Error("Invalid format");
        let imported = 0;
        for (const row of json) {
          const email = String(row.Email || row.email || "").trim();
          if (!email) continue;
          try {
            const role = (["admin", "principal", "class_teacher", "subject_teacher", "teacher", "senior_teacher", "hod"].includes(String(row.Role || row.role)) ? String(row.Role || row.role) : "subject_teacher");
            const res = await api.post<{ id: string }>("/auth/create-staff", {
              email,
              full_name: String(row.Name || row.FullName || row.full_name || "").trim() || "Imported Staff",
              department: String(row.Department || row.department || "").trim() || undefined,
              role,
            });
            if (res.id) imported++;
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "";
            if (!msg.includes("Email already registered")) {
              console.error("Failed to import staff row", row, err);
            }
          }
        }
        toast.success(`Imported ${imported} staff members from Excel`);
        await fetchProfiles();
      } catch {
        toast.error("Failed to import staff. Please upload a valid Excel (.xlsx) file.");
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleApprovalToggle = async (userId: string, currentlyApproved: boolean) => {
    try {
      await api.post("/auth/set-approval", { userId, approved: !currentlyApproved });
      toast.success(!currentlyApproved ? "Staff member approved." : "Staff access revoked.");
      setBackendProfiles(prev => prev.map(p => p.id === userId ? { ...p, approved: !currentlyApproved } : p));
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
      setBackendProfiles(prev => prev.map(p => {
        if (p.id !== userId) return p;
        return { ...p, roles: action === "add" ? [...p.roles, targetRole] : p.roles.filter(r => r !== targetRole) };
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update role assignment.";
      toast.error(msg);
    }
  };

  return (
    <div>
      <PageHeader title="Staff Directory" description={isPrincipal
          ? "Manage registered staff accounts, approvals, and role assignments."
          : "View-only. Only the Principal or Admin can manage the staff directory."}
        actions={isPrincipal
          ? <div className="flex gap-2">
              <Button variant="outline" onClick={exportTeachers} disabled={backendProfiles.length === 0}>
                <Download className="h-4 w-4 mr-1"/>Export
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1"/>Import
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={importTeachers} />
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-1"/>Add staff</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Staff Member</DialogTitle>
                    <DialogDescription>Create a new staff account. Leave password blank to auto-generate one.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3 py-2">
                    <div className="grid gap-1">
                      <Label htmlFor="staff-name">Full Name</Label>
                      <Input id="staff-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Muthoni" />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="staff-email">Email</Label>
                      <Input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. jane@school.ac.ke" />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="staff-dept">Department</Label>
                      <Input id="staff-dept" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Mathematics" />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="staff-role">Role</Label>
                      <Select value={role} onValueChange={setRole}>
                        <SelectTrigger id="staff-role"><SelectValue/></SelectTrigger>
                        <SelectContent>
                          {ALL_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="staff-password">Password (optional)</Label>
                      <Input id="staff-password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to auto-generate" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={add}>Create Staff</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          : <Badge variant="outline"><Lock className="h-3 w-3 mr-1"/>Read only</Badge>} />

      {isPrincipal && pendingProfiles.length > 0 && (
        <Card className="p-4 md:p-6 mb-4 border-warning bg-warning-soft/30">
          <div className="text-sm font-medium mb-1">Pending approvals</div>
          <p className="text-xs text-muted-foreground mb-3">These accounts are awaiting Principal approval.</p>
          <div className="flex flex-wrap gap-2">
            {pendingProfiles.map(p => (
              <div key={p.id} className="flex items-center gap-2 bg-background border rounded-md px-3 py-2 text-xs">
                <span className="font-medium">{p.full_name || p.email}</span>
                <span className="text-muted-foreground">{p.email}</span>
                <Button size="sm" variant="outline" onClick={() => handleApprovalToggle(p.id, false)}>Approve</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {
        <Card className="p-4 md:p-6 mb-4 space-y-4 md:space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-bold">Registered Staff — Approval &amp; Role Assignment</h3>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 w-64"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            View all staff who have registered accounts. Approve access and assign roles.
          </p>
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
                  {isPrincipal && <th className="px-3 md:px-6 py-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                 {loadingProfiles ? (
                   <tr><td colSpan={ALL_ROLES.length + 5} className="px-4 md:px-6 py-10 text-center text-muted-foreground">Loading registered staff...</td></tr>
                 ) : filteredProfiles.length === 0 ? (
                   <tr><td colSpan={ALL_ROLES.length + 5} className="px-4 md:px-6 py-10 text-center text-muted-foreground">No staff match your search.</td></tr>
                 ) : filteredProfiles.map((p) => {
                  const isPrincipalRow = p.roles.includes("admin") || p.roles.includes("principal");
                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition">
                      <td className="px-3 md:px-6 py-3 md:py-4 font-medium">{p.full_name || "Unnamed"}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-muted-foreground">{p.email}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-muted-foreground">{p.department || "—"}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                        {isPrincipalRow ? (
                          <span className="text-xs text-muted-foreground italic">Principal</span>
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
                              <Switch checked={hasRole} onCheckedChange={() => handleRoleToggle(p.id, role.value, hasRole)} disabled={isPrincipalRow} />
                            </div>
                          </td>
                        );
                      })}
                      {isPrincipal && (
                        <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                          <Button variant="ghost" size="icon" onClick={() => remove(p.id)} disabled={isPrincipalRow}>
                            <Trash2 className="h-4 w-4 text-destructive"/>
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
      }
    </div>
  );
}
