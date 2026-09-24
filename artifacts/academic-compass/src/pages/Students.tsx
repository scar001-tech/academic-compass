import { useState, useRef, useMemo } from "react";
import { useSchool } from "@/store/school";
import { useAuth } from "@/store/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Trash2, Lock, Download, Upload, Printer } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { PDFParse } from "pdf-parse";
import { GlobalWorkerOptions } from "pdfjs-dist";
import mammoth from "mammoth";
import { statsForStudentExam, sortStudentsByAdmissionNo } from "@/lib/schoolData";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const ADMISSION_PATTERN = /^(ADM|ADMISSION|STUDENT|LEARNER|PUPIL)?[\s:\-#/]*([A-Za-z0-9\-\/]{1,20})$/i;
const NAME_PATTERN = /^[A-Za-z][A-Za-z\s\.\'\-]{1,60}$/i;

export default function Students() {
  const { state, activeCurriculum, update, syncNow } = useSchool();
  const { canManageStudents } = useAuth();
  const [q, setQ] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [streamFilter, setStreamFilter] = useState<string>("all");
  const [printOpen, setPrintOpen] = useState(false);
  const [printClassId, setPrintClassId] = useState<string>("all");
  const [printStreamId, setPrintStreamId] = useState<string>("all");
  const [printMode, setPrintMode] = useState<"class" | "stream">("class");
  const [printExamId, setPrintExamId] = useState<string>("none");
  const [printOptions, setPrintOptions] = useState({
    contacts: true,
    signature: true,
    rank: false,
    mark: false,
    blankRows: 0,
    blankCols: 0,
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ admissionNo: string; name: string }[] | null>(null);
  const classes = useMemo(() => state.classes.filter(c => c.curriculumId === activeCurriculum), [state.classes, activeCurriculum]);
  const streams = useMemo(() => state.streams.filter(s => classFilter === "all" || s.classId === classFilter), [state.streams, classFilter]);
  const students = useMemo(() => sortStudentsByAdmissionNo(
    state.students.filter(s => s.curriculumId === activeCurriculum)
      .filter(s => classFilter === "all" || s.classId === classFilter)
      .filter(s => streamFilter === "all" || s.streamId === streamFilter)
      .filter(s => !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.admissionNo.toLowerCase().includes(q.toLowerCase()))
  ), [state.students, activeCurriculum, classFilter, streamFilter, q]);
  const printExamStats = useMemo(() => {
    const stats = new Map<string, ReturnType<typeof statsForStudentExam>>();
    if (printExamId === "none") return stats;
    state.students
      .filter(s => s.curriculumId === activeCurriculum)
      .forEach(s => stats.set(s.id, statsForStudentExam(state, s.id, printExamId)));
    return stats;
  }, [state.students, state.sheets, state.entries, state.curricula, activeCurriculum, printExamId]);

  const addStudent = () => {
    if (!canManageStudents) { toast.error("Only the Principal or Senior Teacher can add learners"); return; }
    const cls = classes[0];
    if (!cls) { toast.error("Create a class first"); return; }
    const stream = state.streams.find(s => s.classId === cls.id);
    if (!stream) { toast.error("Create a stream first"); return; }
    update((s) => {
      const id = `stu_${Date.now()}`;
      s.students.push({
        id, curriculumId: activeCurriculum, admissionNo: `NEW/${s.students.length+1}/${s.settings.academicYear}`,
        name: "New Student", gender: "M", classId: cls.id, streamId: stream.id, vap: "",
        religion: "", dateOfAdmission: new Date().toISOString().slice(0,10), house: "", gradeEntryType: "", dateOfBirth: "",
        parentName: "", parentNumber: "", parentIdNumber: "",
      });
    });
    toast.success("Student added — edit their details inline");
  };

  const removeStudent = (id: string) => {
    if (!canManageStudents) { toast.error("Only the Principal or Senior Teacher can remove learners"); return; }
    update(st => { st.students = st.students.filter(x => x.id !== id); st.deletedIds = [...(st.deletedIds ?? []), id]; });
  };

  const exportStudents = () => {
    const target = students.filter(s => streamFilter === "all" || s.streamId === streamFilter);
    const data = target.map(s => {
      const cls = state.classes.find(c => c.id === s.classId);
      const stream = state.streams.find(st => st.id === s.streamId);
      return {
        AdmissionNo: s.admissionNo,
        Name: s.name,
        Gender: s.gender,
        Class: cls?.name || "",
        Stream: stream?.name || "",
        VAP: s.vap || "",
        Religion: (s as any).religion || "",
        DOB: (s as any).dateOfBirth || "",
        "Adm. Date": (s as any).dateOfAdmission || "",
        House: (s as any).house || "",
        "Grade Entry": (s as any).gradeEntryType || "",
        "Parent Name": (s as any).parentName || "",
        "Parent No.": (s as any).parentNumber || "",
        "Parent ID": (s as any).parentIdNumber || "",
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
    const suffix = streamFilter !== "all" ? `stream-${streamFilter}` : activeCurriculum;
    XLSX.writeFile(workbook, `students-${suffix}-${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success(`Exported ${data.length} students`);
  };

  const importStudents = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    try {
      let rows: { admissionNo: string; name: string }[] = [];

      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const data = new Uint8Array(await file.arrayBuffer());
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: "" });
        rows = extractStudentsFromExcel(rawRows);
      } else if (name.endsWith(".pdf")) {
        const data = new Uint8Array(await file.arrayBuffer());
        const pdf = new PDFParse({ verbosity: 0 });
        await (pdf as any).load(data.buffer);
        const info = await (pdf as any).getInfo();
        const numPages = info?.numPages ?? 0;
        let text = "";
        for (let i = 1; i <= numPages; i++) {
          const pageText = await (pdf as any).getText(i);
          text += (pageText || "") + "\n";
        }
        rows = extractStudentsFromRawText(text);
      } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
        const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        const text = result.value || "";
        rows = extractStudentsFromRawText(text);
      } else {
        throw new Error("Unsupported file format");
      }

      const filtered = rows.filter((row) => row.admissionNo || row.name);

      if (filtered.length === 0) throw new Error("No students found in file");

      setPreview(filtered);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to import students";
      toast.error(message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const extractStudentsFromExcel = (rawRows: any[]): { admissionNo: string; name: string }[] => {
    if (!rawRows.length) return [];

    const firstRow = rawRows[0];
    const isHeader = Array.isArray(firstRow) && firstRow.some((cell) => typeof cell === "string" && isNaN(Number(cell)));

    if (isHeader) {
      const header = firstRow.map((cell: any) => String(cell ?? "").trim().toLowerCase());
      const admissionIdx = header.findIndex((h) => /admission|adm|student\s*id|learner\s*id|pupil\s*id/.test(h));
      const nameIdx = header.findIndex((h) => /^name|full\s*name|student\s*name|learner\s*name|pupil\s*name/.test(h));
      return rawRows.slice(1).map((row: any) => {
        const cells = Array.isArray(row) ? row : [];
        return {
          admissionNo: String(cells[admissionIdx] ?? cells[0] ?? "").trim(),
          name: String(cells[nameIdx] ?? cells[1] ?? "").trim(),
        };
      });
    }

    return rawRows.map((row) => {
      const cells = Array.isArray(row) ? row : [];
      const admissionNo = String(cells[0] ?? "").trim();
      const studentName = String(cells[1] ?? "").trim();
      return { admissionNo, name: studentName };
    });
  };

  const extractStudentsFromRawText = (text: string): { admissionNo: string; name: string }[] => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const rows: { admissionNo: string; name: string }[] = [];
    let pendingAdmission: string | null = null;

    for (const line of lines) {
      const admissionMatch = line.match(ADMISSION_PATTERN);
      const nameMatch = line.match(NAME_PATTERN);

      if (admissionMatch) {
        pendingAdmission = admissionMatch[2] || admissionMatch[0];
      }

      if (nameMatch) {
        const candidate = nameMatch[0];
        if (pendingAdmission) {
          rows.push({ admissionNo: pendingAdmission, name: candidate });
          pendingAdmission = null;
        } else if (rows.length) {
          const last = rows[rows.length - 1];
          if (!last.name) last.name = candidate;
        }
      }
    }

    return rows;
  };

  const confirmImport = () => {
    if (!preview) return;
    update((s) => {
      preview.forEach((row) => {
        let classId = classFilter !== "all" ? classFilter : (classes[0]?.id || "");
        let streamId = "";
        if (classId) {
          const fallback = s.streams.find(st => st.classId === classId);
          if (fallback) streamId = fallback.id;
        }
        if (streamFilter !== "all") {
          const filtered = s.streams.find(st => st.id === streamFilter);
          if (filtered) streamId = filtered.id;
        }
        s.students.push({
          id: `stu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          curriculumId: activeCurriculum,
          admissionNo: row.admissionNo || `IMP/${Date.now()}/${s.settings.academicYear}`,
          name: row.name || "New Student",
          gender: "M",
          classId,
          streamId,
          vap: "",
          religion: "",
          dateOfAdmission: new Date().toISOString().slice(0,10),
          house: "",
          gradeEntryType: "",
          dateOfBirth: "",
          parentName: "",
          parentNumber: "",
          parentIdNumber: "",
        });
      });
    });
    toast.success(`Imported ${preview.length} students`);
    setPreview(null);
  };

  return (
    <div>
      <PageHeader
        title="Students"
        description={canManageStudents
          ? "Manage learners in the selected curriculum. Click any field to edit."
          : "View-only. Only the Principal or Senior Teacher can add, edit, or remove learners."}
        actions={canManageStudents
          ? <Button onClick={addStudent}><Plus className="h-4 w-4 mr-1"/>Add student</Button>
          : <Badge variant="outline"><Lock className="h-3 w-3 mr-1"/>Read only</Badge>
        }
      />

      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground"/>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or admission no." className="pl-8 w-64"/>
        </div>
        <Select value={classFilter} onValueChange={(v) => { setClassFilter(v); setStreamFilter("all"); }}>
          <SelectTrigger className="w-48"><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={streamFilter} onValueChange={setStreamFilter} disabled={classFilter === "all"}>
          <SelectTrigger className="w-48"><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All streams</SelectItem>
            {streams.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {canManageStudents && (
          <>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1"/>Import
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.pdf,.doc,.docx" className="hidden" onChange={importStudents} />
          </>
        )}
        <Badge variant="secondary" className="ml-auto self-center">{students.length} students</Badge>
        <Button variant="outline" onClick={() => setPrintOpen(true)}>
          <Printer className="h-4 w-4 mr-1"/>Print class list
        </Button>
      </div>

      <Card className="overflow-x-auto card-pad">
        <table className="data-table">
          <thead>
            <tr>
              <th>Adm. No.</th><th>Name</th><th>Gender</th><th>Class</th><th>Stream</th><th>VAP</th>
              <th>Religion</th><th>DOB</th><th>Adm. Date</th><th>House</th><th>Grade Entry</th><th>Parent Name</th><th>Parent No.</th><th>Parent ID</th>
              {canManageStudents && <th></th>}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const streams = state.streams.filter(st => st.classId === s.classId);
              return (
                <tr key={s.id}>
                  <td>
                    <input className="inline-edit w-28" value={s.admissionNo} disabled={!canManageStudents}
                      onChange={(e) => update(st => { const x = st.students.find(x => x.id === s.id); if (x) x.admissionNo = e.target.value; })} />
                  </td>
                  <td>
                    <input className="inline-edit w-48 font-medium" value={s.name} disabled={!canManageStudents}
                      onChange={(e) => update(st => { const x = st.students.find(x => x.id === s.id); if (x) x.name = e.target.value; })} />
                  </td>
                  <td>
                    <select className="inline-edit" value={s.gender} disabled={!canManageStudents}
                      onChange={(e) => update(st => { const x = st.students.find(x => x.id === s.id); if (x) x.gender = e.target.value as "M" | "F"; })}>
                      <option value="M">M</option><option value="F">F</option>
                    </select>
                  </td>
                  <td>
                    <select className="inline-edit" value={s.classId} disabled={!canManageStudents}
                      onChange={(e) => update(st => {
                        const x = st.students.find(x => x.id === s.id);
                        if (x) { x.classId = e.target.value; x.streamId = st.streams.find(str => str.classId === e.target.value)?.id || x.streamId; }
                      })}>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="inline-edit" value={s.streamId} disabled={!canManageStudents}
                      onChange={(e) => update(st => { const x = st.students.find(x => x.id === s.id); if (x) x.streamId = e.target.value; })}>
                      {streams.map(str => <option key={str.id} value={str.id}>{str.name}</option>)}
                    </select>
                  </td>
                  <td className="max-w-[280px]">
                    <input className="inline-edit w-full text-xs" value={s.vap} disabled={!canManageStudents}
                      onChange={(e) => update(st => { const x = st.students.find(x => x.id === s.id); if (x) x.vap = e.target.value; })} />
                  </td>
                  <td>
                    <input className="inline-edit w-24" value={(s as any).religion || ""} disabled={!canManageStudents}
                      onChange={(e) => update(st => { const x = st.students.find(x => x.id === s.id); if (x) (x as any).religion = e.target.value; })} />
                  </td>
                  <td>
                    <input type="date" className="inline-edit w-36" value={(s as any).dateOfBirth || ""} disabled={!canManageStudents}
                      onChange={(e) => update(st => { const x = st.students.find(x => x.id === s.id); if (x) (x as any).dateOfBirth = e.target.value; })} />
                  </td>
                  <td>
                    <input type="date" className="inline-edit w-36" value={(s as any).dateOfAdmission || ""} disabled={!canManageStudents}
                      onChange={(e) => update(st => { const x = st.students.find(x => x.id === s.id); if (x) (x as any).dateOfAdmission = e.target.value; })} />
                  </td>
                  <td>
                    <select className="inline-edit" value={(s as any).house || ""} disabled={!canManageStudents}
                      onChange={(e) => update(st => { const x = st.students.find(x => x.id === s.id); if (x) (x as any).house = e.target.value; })}>
                      <option value="">—</option>
                      <option value="LENANA">LENANA</option>
                      <option value="KILIMAMBOGO">KILIMAMBOGO</option>
                      <option value="TANA">TANA</option>
                      <option value="LUKENYA">LUKENYA</option>
                      <option value="ATHI">ATHI</option>
                    </select>
                  </td>
                  <td>
                    <input className="inline-edit w-28" value={(s as any).gradeEntryType || ""} disabled={!canManageStudents}
                      onChange={(e) => update(st => { const x = st.students.find(x => x.id === s.id); if (x) (x as any).gradeEntryType = e.target.value; })} />
                  </td>
                  <td>
                    <input className="inline-edit w-36" value={(s as any).parentName || ""} disabled={!canManageStudents}
                      onChange={(e) => update(st => { const x = st.students.find(x => x.id === s.id); if (x) (x as any).parentName = e.target.value; })} />
                  </td>
                  <td>
                    <input className="inline-edit w-28" value={(s as any).parentNumber || ""} disabled={!canManageStudents}
                      onChange={(e) => update(st => { const x = st.students.find(x => x.id === s.id); if (x) { x.parentNumber = e.target.value; x.updatedAt = Date.now(); } })}
                      onBlur={() => { void syncNow(); }} />
                  </td>
                  <td>
                    <input className="inline-edit w-28" value={(s as any).parentIdNumber || ""} disabled={!canManageStudents}
                      onChange={(e) => update(st => { const x = st.students.find(x => x.id === s.id); if (x) (x as any).parentIdNumber = e.target.value; })} />
                  </td>
                  {canManageStudents && (
                    <td>
                      <Button size="icon" variant="ghost" onClick={() => removeStudent(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive"/>
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr><td colSpan={canManageStudents ? 15 : 14} className="text-center text-muted-foreground py-8">No students match filters</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={!!preview} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Import</DialogTitle>
            <DialogDescription>Review the students to be imported. Admission number and name are taken directly from the file.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 border">#</th>
                  <th className="text-left p-2 border">Admission No.</th>
                  <th className="text-left p-2 border">Name</th>
                </tr>
              </thead>
              <tbody>
                {preview?.map((row, idx) => (
                  <tr key={idx}>
                    <td className="p-2 border text-muted-foreground">{idx + 1}</td>
                    <td className="p-2 border font-mono">{row.admissionNo || "—"}</td>
                    <td className="p-2 border font-medium">{row.name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>Cancel</Button>
            <Button onClick={confirmImport}>Confirm Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Class List</DialogTitle>
            <DialogDescription>Print or save as PDF. Choose to print per class or per stream.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 mb-3 no-print">
            <Select value={printMode} onValueChange={(v: "class" | "stream") => { setPrintMode(v); setPrintClassId("all"); setPrintStreamId("all"); }}>
              <SelectTrigger className="w-40"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="class">Per class</SelectItem>
                <SelectItem value="stream">Per stream</SelectItem>
              </SelectContent>
            </Select>
            <Select value={printClassId} onValueChange={(v) => { setPrintClassId(v); setPrintStreamId("all"); }}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Select class"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {printMode === "stream" && printClassId !== "all" && (
              <Select value={printStreamId} onValueChange={setPrintStreamId}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Select stream"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All streams</SelectItem>
                  {state.streams.filter(st => st.classId === printClassId).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={printExamId} onValueChange={setPrintExamId}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Exam (for rank/mark)"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No exam —</SelectItem>
                {state.exams.filter(e => e.curriculumId === activeCurriculum && e.status !== "draft").map(e => <SelectItem key={e.id} value={e.id}>{e.name} T{e.term} {e.year}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => {
              document.body.classList.add("printing-class-list");
              setTimeout(() => {
                window.print();
                setTimeout(() => document.body.classList.remove("printing-class-list"), 100);
              }, 50);
            }}>
              <Printer className="h-4 w-4 mr-1"/>Print
            </Button>
          </div>
          <div className="flex flex-wrap gap-4 mb-3 no-print text-sm items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={printOptions.contacts} onCheckedChange={(v) => setPrintOptions(o => ({ ...o, contacts: !!v }))}/>
              <span>Parent contact</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={printOptions.signature} onCheckedChange={(v) => setPrintOptions(o => ({ ...o, signature: !!v }))}/>
              <span>Signature column</span>
            </label>
            <label className={`flex items-center gap-2 cursor-pointer ${printExamId === "none" ? "opacity-50" : ""}`}>
              <Checkbox checked={printOptions.rank} disabled={printExamId === "none"} onCheckedChange={(v) => setPrintOptions(o => ({ ...o, rank: !!v }))}/>
              <span>Exam rank</span>
            </label>
            <label className={`flex items-center gap-2 cursor-pointer ${printExamId === "none" ? "opacity-50" : ""}`}>
              <Checkbox checked={printOptions.mark} disabled={printExamId === "none"} onCheckedChange={(v) => setPrintOptions(o => ({ ...o, mark: !!v }))}/>
              <span>Exam mean mark</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Blank rows after each student:</span>
              <input type="number" min={0} max={10} className="inline-edit w-14" value={printOptions.blankRows} onChange={(e) => setPrintOptions(o => ({ ...o, blankRows: Math.max(0, Math.min(10, Number(e.target.value) || 0)) }))}/>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Blank columns:</span>
              <input type="number" min={0} max={5} className="inline-edit w-14" value={printOptions.blankCols} onChange={(e) => setPrintOptions(o => ({ ...o, blankCols: Math.max(0, Math.min(5, Number(e.target.value) || 0)) }))}/>
            </div>
          </div>
          <div className="border rounded p-2 max-h-[60vh] overflow-y-auto bg-white">
            <div id="class-list-preview">
              {printMode === "class" ? (
                state.classes.filter(c => c.curriculumId === activeCurriculum).filter(c => printClassId === "all" || c.id === printClassId).map(cls => {
                  const classStudents = state.students.filter(s => s.curriculumId === activeCurriculum && s.classId === cls.id)
                    .sort((a, b) => a.admissionNo.localeCompare(b.admissionNo, undefined, { numeric: true }));
                  return (
                    <div key={cls.id} className="mb-6 border-b pb-4 last:border-b-0">
                      <div className="flex items-center gap-3 border-b pb-2 mb-2">
                        {state.settings.logoUrl && <img src={state.settings.logoUrl} alt="Logo" className="h-10 w-10 object-contain"/>}
                        <div>
                          <div className="text-base font-bold">{state.settings.schoolName || "DRUMVALE SENIOR SCHOOL"}</div>
                          <div className="text-xs text-muted-foreground">Class List — {cls.name}</div>
                        </div>
                        <div className="ml-auto text-[10px] text-muted-foreground">
                          {new Date().toLocaleDateString()} | Total: {classStudents.length}
                        </div>
                      </div>
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border p-1 text-left w-8">#</th>
                            <th className="border p-1 text-left">Adm. No.</th>
                            <th className="border p-1 text-left">Name</th>
                            {printOptions.mark && <th className="border p-1 text-left">Mean</th>}
                            {printOptions.rank && <th className="border p-1 text-left">Rank</th>}
                            {printOptions.contacts && <th className="border p-1 text-left">Parent</th>}
                            {printOptions.signature && <th className="border p-1 text-left">Signature</th>}
                            {Array.from({ length: printOptions.blankCols }).map((_, i) => (
                              <th key={`bh-${i}`} className="border p-1 text-left w-16"></th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {classStudents.flatMap((s, i) => {
                              const stats = printExamStats.get(s.id) ?? null;
                            const studentRow = (
                              <tr key={s.id}>
                                <td className="border p-1">{i + 1}</td>
                                <td className="border p-1 font-mono">{s.admissionNo}</td>
                                <td className="border p-1">{s.name}</td>
                                {printOptions.mark && <td className="border p-1">{stats?.mean ?? "—"}</td>}
                                {printOptions.rank && <td className="border p-1">{stats ? `${stats.overallGrade}` : "—"}</td>}
                                {printOptions.contacts && <td className="border p-1">{(s as any).parentNumber || ""}</td>}
                                {printOptions.signature && <td className="border p-1 h-5"></td>}
                                {Array.from({ length: printOptions.blankCols }).map((_, ci) => (
                                  <td key={`bc-${s.id}-${ci}`} className="border p-1 h-5"></td>
                                ))}
                              </tr>
                            );
                            if (printOptions.blankRows > 0) {
                              const blanks = Array.from({ length: printOptions.blankRows }).map((_, bi) => (
                                <tr key={`br-${s.id}-${bi}`}>
                                  {Array.from({ length: 3 + (printOptions.mark ? 1 : 0) + (printOptions.rank ? 1 : 0) + (printOptions.contacts ? 1 : 0) + (printOptions.signature ? 1 : 0) + printOptions.blankCols }).map((_, ci) => (
                                    <td key={`brc-${s.id}-${bi}-${ci}`} className="border p-1 h-5"></td>
                                  ))}
                                </tr>
                              ));
                              return [studentRow, ...blanks];
                            }
                            return [studentRow];
                          })}
                          {classStudents.length === 0 && (
                            <tr><td colSpan={10} className="border p-2 text-center text-muted-foreground">No students in this class</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                })
              ) : (
                state.streams.filter(st => printClassId === "all" ? st.classId !== "" : st.classId === printClassId)
                  .filter(st => printStreamId === "all" || st.id === printStreamId)
                  .map(stream => {
                    const streamStudents = state.students.filter(s => s.curriculumId === activeCurriculum && s.streamId === stream.id)
                      .sort((a, b) => a.admissionNo.localeCompare(b.admissionNo, undefined, { numeric: true }));
                    const cls = state.classes.find(c => c.id === stream.classId);
                    return (
                      <div key={stream.id} className="mb-6 border-b pb-4 last:border-b-0">
                        <div className="flex items-center gap-3 border-b pb-2 mb-2">
                          {state.settings.logoUrl && <img src={state.settings.logoUrl} alt="Logo" className="h-10 w-10 object-contain"/>}
                          <div>
                            <div className="text-base font-bold">{state.settings.schoolName || "DRUMVALE SENIOR SCHOOL"}</div>
                            <div className="text-xs text-muted-foreground">Class List — {cls?.name} {stream.name}</div>
                          </div>
                          <div className="ml-auto text-[10px] text-muted-foreground">
                            {new Date().toLocaleDateString()} | Total: {streamStudents.length}
                          </div>
                        </div>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="border p-1 text-left w-8">#</th>
                              <th className="border p-1 text-left">Adm. No.</th>
                              <th className="border p-1 text-left">Name</th>
                              {printOptions.mark && <th className="border p-1 text-left">Mean</th>}
                              {printOptions.rank && <th className="border p-1 text-left">Rank</th>}
                              {printOptions.contacts && <th className="border p-1 text-left">Parent</th>}
                              {printOptions.signature && <th className="border p-1 text-left">Signature</th>}
                              {Array.from({ length: printOptions.blankCols }).map((_, i) => (
                                <th key={`bh-${i}`} className="border p-1 text-left w-16"></th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {streamStudents.flatMap((s, i) => {
                              const stats = printExamStats.get(s.id) ?? null;
                              const studentRow = (
                                <tr key={s.id}>
                                  <td className="border p-1">{i + 1}</td>
                                  <td className="border p-1 font-mono">{s.admissionNo}</td>
                                  <td className="border p-1">{s.name}</td>
                                  {printOptions.mark && <td className="border p-1">{stats?.mean ?? "—"}</td>}
                                  {printOptions.rank && <td className="border p-1">{stats ? `${stats.overallGrade}` : "—"}</td>}
                                  {printOptions.contacts && <td className="border p-1">{(s as any).parentNumber || ""}</td>}
                                  {printOptions.signature && <td className="border p-1 h-5"></td>}
                                  {Array.from({ length: printOptions.blankCols }).map((_, ci) => (
                                    <td key={`bc-${s.id}-${ci}`} className="border p-1 h-5"></td>
                                  ))}
                                </tr>
                              );
                              if (printOptions.blankRows > 0) {
                                const blanks = Array.from({ length: printOptions.blankRows }).map((_, bi) => (
                                  <tr key={`br-${s.id}-${bi}`}>
                                    {Array.from({ length: 3 + (printOptions.mark ? 1 : 0) + (printOptions.rank ? 1 : 0) + (printOptions.contacts ? 1 : 0) + (printOptions.signature ? 1 : 0) + printOptions.blankCols }).map((_, ci) => (
                                      <td key={`brc-${s.id}-${bi}-${ci}`} className="border p-1 h-5"></td>
                                    ))}
                                  </tr>
                                ));
                                return [studentRow, ...blanks];
                              }
                              return [studentRow];
                            })}
                            {streamStudents.length === 0 && (
                              <tr><td colSpan={10} className="border p-2 text-center text-muted-foreground">No students in this stream</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    );
                  })
              )}
              {state.classes.filter(c => c.curriculumId === activeCurriculum).filter(c => printClassId === "all" || c.id === printClassId).length === 0 && (
                <div className="text-center text-muted-foreground py-8">No classes to display</div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div id="class-list-print-root" style={{ backgroundColor: "white" }}>
        <div id="class-list-print" className="print-force-visible">
          {printMode === "class" ? (
            state.classes.filter(c => c.curriculumId === activeCurriculum).filter(c => printClassId === "all" || c.id === printClassId).map(cls => {
              const classStudents = state.students.filter(s => s.curriculumId === activeCurriculum && s.classId === cls.id)
                .sort((a, b) => a.admissionNo.localeCompare(b.admissionNo, undefined, { numeric: true }));
              return (
                <div key={cls.id} className="print-page mb-6" style={{ pageBreakAfter: "always" }}>
                  <div className="flex items-center gap-3 border-b pb-2 mb-2">
                    {state.settings.logoUrl && <img src={state.settings.logoUrl} alt="Logo" className="h-12 w-12 object-contain"/>}
                    <div>
                      <div className="text-lg font-bold">{state.settings.schoolName || "DRUMVALE SENIOR SCHOOL"}</div>
                      <div className="text-sm text-muted-foreground">Class List — {cls.name}</div>
                    </div>
                    <div className="ml-auto text-xs text-muted-foreground">
                      {new Date().toLocaleDateString()} | Total: {classStudents.length}
                    </div>
                  </div>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border p-1 text-left w-12">#</th>
                        <th className="border p-1 text-left">Adm. No.</th>
                        <th className="border p-1 text-left">Name</th>
                        {printOptions.mark && <th className="border p-1 text-left">Mean</th>}
                        {printOptions.rank && <th className="border p-1 text-left">Rank</th>}
                        {printOptions.contacts && <th className="border p-1 text-left">Parent Contact</th>}
                        {printOptions.signature && <th className="border p-1 text-left">Signature</th>}
                        {Array.from({ length: printOptions.blankCols }).map((_, i) => (
                          <th key={`bh-${i}`} className="border p-1 text-left w-20"></th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {classStudents.flatMap((s, i) => {
                        const stats = printExamStats.get(s.id) ?? null;
                        const studentRow = (
                          <tr key={s.id}>
                            <td className="border p-1">{i + 1}</td>
                            <td className="border p-1 font-mono">{s.admissionNo}</td>
                            <td className="border p-1 font-medium">{s.name}</td>
                            {printOptions.mark && <td className="border p-1">{stats?.mean ?? "—"}</td>}
                            {printOptions.rank && <td className="border p-1">{stats ? `${stats.overallGrade}` : "—"}</td>}
                            {printOptions.contacts && <td className="border p-1">{(s as any).parentNumber || ""}</td>}
                            {printOptions.signature && <td className="border p-1 h-8"></td>}
                            {Array.from({ length: printOptions.blankCols }).map((_, ci) => (
                              <td key={`bc-${s.id}-${ci}`} className="border p-1 h-8"></td>
                            ))}
                          </tr>
                        );
                        if (printOptions.blankRows > 0) {
                          const blanks = Array.from({ length: printOptions.blankRows }).map((_, bi) => (
                            <tr key={`br-${s.id}-${bi}`} className="print:break-inside-avoid">
                              {Array.from({ length: 3 + (printOptions.mark ? 1 : 0) + (printOptions.rank ? 1 : 0) + (printOptions.contacts ? 1 : 0) + (printOptions.signature ? 1 : 0) + printOptions.blankCols }).map((_, ci) => (
                                <td key={`brc-${s.id}-${bi}-${ci}`} className="border p-1 h-8"></td>
                              ))}
                            </tr>
                          ));
                          return [studentRow, ...blanks];
                        }
                        return [studentRow];
                      })}
                      {classStudents.length === 0 && (
                        <tr><td colSpan={10} className="border p-4 text-center text-muted-foreground">No students in this class</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })
          ) : (
            state.streams.filter(st => printClassId === "all" ? st.classId !== "" : st.classId === printClassId)
              .filter(st => printStreamId === "all" || st.id === printStreamId)
              .map(stream => {
                const streamStudents = state.students.filter(s => s.curriculumId === activeCurriculum && s.streamId === stream.id)
                  .sort((a, b) => a.admissionNo.localeCompare(b.admissionNo, undefined, { numeric: true }));
                const cls = state.classes.find(c => c.id === stream.classId);
                return (
                  <div key={stream.id} className="print-page mb-6" style={{ pageBreakAfter: "always" }}>
                    <div className="flex items-center gap-3 border-b pb-2 mb-2">
                      {state.settings.logoUrl && <img src={state.settings.logoUrl} alt="Logo" className="h-12 w-12 object-contain"/>}
                      <div>
                        <div className="text-lg font-bold">{state.settings.schoolName || "DRUMVALE SENIOR SCHOOL"}</div>
                        <div className="text-sm text-muted-foreground">Class List — {cls?.name || ""} {stream.name}</div>
                      </div>
                      <div className="ml-auto text-xs text-muted-foreground">
                        {new Date().toLocaleDateString()} | Total: {streamStudents.length}
                      </div>
                    </div>
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border p-1 text-left w-12">#</th>
                          <th className="border p-1 text-left">Adm. No.</th>
                          <th className="border p-1 text-left">Name</th>
                          {printOptions.mark && <th className="border p-1 text-left">Mean</th>}
                          {printOptions.rank && <th className="border p-1 text-left">Rank</th>}
                          {printOptions.contacts && <th className="border p-1 text-left">Parent Contact</th>}
                          {printOptions.signature && <th className="border p-1 text-left">Signature</th>}
                          {Array.from({ length: printOptions.blankCols }).map((_, i) => (
                            <th key={`bh-${i}`} className="border p-1 text-left w-20"></th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {streamStudents.flatMap((s, i) => {
                          const stats = printExamStats.get(s.id) ?? null;
                          const studentRow = (
                            <tr key={s.id}>
                              <td className="border p-1">{i + 1}</td>
                              <td className="border p-1 font-mono">{s.admissionNo}</td>
                              <td className="border p-1 font-medium">{s.name}</td>
                              {printOptions.mark && <td className="border p-1">{stats?.mean ?? "—"}</td>}
                              {printOptions.rank && <td className="border p-1">{stats ? `${stats.overallGrade}` : "—"}</td>}
                              {printOptions.contacts && <td className="border p-1">{(s as any).parentNumber || ""}</td>}
                              {printOptions.signature && <td className="border p-1 h-8"></td>}
                              {Array.from({ length: printOptions.blankCols }).map((_, ci) => (
                                <td key={`bc-${s.id}-${ci}`} className="border p-1 h-8"></td>
                              ))}
                            </tr>
                          );
                          if (printOptions.blankRows > 0) {
                            const blanks = Array.from({ length: printOptions.blankRows }).map((_, bi) => (
                              <tr key={`br-${s.id}-${bi}`} className="print:break-inside-avoid">
                                {Array.from({ length: 3 + (printOptions.mark ? 1 : 0) + (printOptions.rank ? 1 : 0) + (printOptions.contacts ? 1 : 0) + (printOptions.signature ? 1 : 0) + printOptions.blankCols }).map((_, ci) => (
                                  <td key={`brc-${s.id}-${bi}-${ci}`} className="border p-1 h-8"></td>
                                ))}
                              </tr>
                            ));
                            return [studentRow, ...blanks];
                          }
                          return [studentRow];
                        })}
                        {streamStudents.length === 0 && (
                          <tr><td colSpan={10} className="border p-4 text-center text-muted-foreground">No students in this stream</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}
