import { useMemo, useState } from "react";
import { useSchool } from "@/store/school";
import { useAuth } from "@/store/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Save, Phone, UsersRound } from "lucide-react";
import { sortStudentsByAdmissionNo } from "@/lib/schoolData";
import { toast } from "sonner";

export default function ParentContacts() {
  const { state, activeCurriculum, update, syncNow } = useSchool();
  const { canManageStudents } = useAuth();
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [streamFilter, setStreamFilter] = useState("all");
  const [drafts, setDrafts] = useState<Record<string, { parentName: string; parentNumber: string }>>({});

  const classes = state.classes.filter((item) => item.curriculumId === activeCurriculum);
  const streams = state.streams.filter((item) => classFilter === "all" || item.classId === classFilter);
  const students = useMemo(() => sortStudentsByAdmissionNo(state.students
    .filter((student) => student.curriculumId === activeCurriculum)
    .filter((student) => classFilter === "all" || student.classId === classFilter)
    .filter((student) => streamFilter === "all" || student.streamId === streamFilter)
    .filter((student) => {
      const text = `${student.name} ${student.admissionNo} ${student.parentName || ""} ${student.parentNumber || student.guardianPhone || ""}`.toLowerCase();
      return !query.trim() || text.includes(query.trim().toLowerCase());
    })), [state.students, activeCurriculum, classFilter, streamFilter, query]);

  const getDraft = (student: typeof state.students[number]) => drafts[student.id] ?? {
    parentName: student.parentName || "",
    parentNumber: student.parentNumber || student.guardianPhone || "",
  };

  const updateDraft = (studentId: string, field: "parentName" | "parentNumber", value: string) => {
    const student = state.students.find((item) => item.id === studentId);
    if (!student) return;
    const current = getDraft(student);
    setDrafts((previous) => ({ ...previous, [studentId]: { ...current, [field]: value } }));
  };

  const saveContact = (studentId: string) => {
    if (!canManageStudents) {
      toast.error("Only the Principal or Senior Teacher can manage parent contacts");
      return;
    }
    const student = state.students.find((item) => item.id === studentId);
    if (!student) return;
    const draft = getDraft(student);
    update((next) => {
      const target = next.students.find((item) => item.id === studentId);
      if (!target) return;
      target.parentName = draft.parentName.trim();
      target.parentNumber = draft.parentNumber.trim();
      target.updatedAt = Date.now();
    });
    setTimeout(() => { void syncNow(); }, 0);
    toast.success(`Parent contact linked to ${student.name}`);
  };

  const linkedCount = state.students.filter((student) => student.curriculumId === activeCurriculum && (student.parentNumber || student.guardianPhone)?.trim()).length;

  return (
    <div>
      <PageHeader
        title="Parent Contacts"
        description="Link a parent or guardian phone number to a student for report SMS delivery."
        actions={<div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4" />{linkedCount} linked contacts</div>}
      />

      <Card className="p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student, admission number, or parent" className="pl-9" />
          </div>
          <Select value={classFilter} onValueChange={(value) => { setClassFilter(value); setStreamFilter("all"); }}>
            <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {classes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={streamFilter} onValueChange={setStreamFilter}>
            <SelectTrigger><SelectValue placeholder="All streams" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All streams</SelectItem>
              {streams.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b text-left">
                <th className="p-3">Student</th>
                <th className="p-3">Class / Stream</th>
                <th className="p-3 min-w-48">Parent name</th>
                <th className="p-3 min-w-48">Parent phone</th>
                <th className="p-3 w-28">Action</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const draft = getDraft(student);
                const className = state.classes.find((item) => item.id === student.classId)?.name || "—";
                const streamName = state.streams.find((item) => item.id === student.streamId)?.name || "—";
                return (
                  <tr key={student.id} className="border-b last:border-0">
                    <td className="p-3">
                      <div className="font-medium">{student.name}</div>
                      <div className="text-xs text-muted-foreground">{student.admissionNo}</div>
                    </td>
                    <td className="p-3 text-muted-foreground">{className} / {streamName}</td>
                    <td className="p-3"><Input value={draft.parentName} disabled={!canManageStudents} onChange={(event) => updateDraft(student.id, "parentName", event.target.value)} placeholder="Parent or guardian name" /></td>
                    <td className="p-3"><Input value={draft.parentNumber} disabled={!canManageStudents} onChange={(event) => updateDraft(student.id, "parentNumber", event.target.value)} placeholder="e.g. 0712345678" inputMode="tel" /></td>
                    <td className="p-3"><Button size="sm" onClick={() => saveContact(student.id)} disabled={!canManageStudents}><Save className="h-4 w-4 mr-1" />Save</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {students.length === 0 && <div className="p-10 text-center text-muted-foreground"><UsersRound className="h-8 w-8 mx-auto mb-2 opacity-50" />No students match the selected filters.</div>}
      </Card>
    </div>
  );
}