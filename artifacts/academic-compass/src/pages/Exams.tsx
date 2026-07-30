import { useSchool } from "@/store/school";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Download, Upload, Search, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { createMarkSheetsForExam } from "@/lib/schoolData";
import { Input } from "@/components/ui/input";

export default function Exams() {
  const { state, activeCurriculum, update } = useSchool();
  const [searchQuery, setSearchQuery] = useState("");
  const exams = state.exams.filter(e => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return e.curriculumId === activeCurriculum;
    return e.curriculumId === activeCurriculum && (
      e.name.toLowerCase().includes(q) || String(e.term).includes(q) || e.status.toLowerCase().includes(q)
    );
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const add = () => update(s => {
    const id = `ex_${Date.now()}`;
    const exam = {
      id, curriculumId: activeCurriculum, name: "New Exam",
      term: 1 as 1 | 2 | 3, year: s.settings.academicYear, outOf: 100, status: "draft" as const,
    };
    s.exams.push(exam);
    const { sheets, entries } = createMarkSheetsForExam(s, exam);
    s.sheets.push(...sheets);
    s.entries.push(...entries);
  });

  const exportExams = () => {
    const worksheet = XLSX.utils.json_to_sheet(exams.map(ex => ({
      Name: ex.name,
      Term: ex.term,
      Year: ex.year,
      OutOf: ex.outOf,
      Status: ex.status,
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Exams");
    XLSX.writeFile(workbook, `exams-${activeCurriculum}-${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success("Exams exported as Excel");
  };

  const importExams = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(sheet);
        if (!Array.isArray(json) || json.length === 0) throw new Error("Invalid format");
        update(s => {
          json.forEach((row) => {
            if (!row.Name || !row.Term || !row.Year) return;
            s.exams.push({
              id: `ex_${Date.now()}`,
              curriculumId: activeCurriculum,
              name: String(row.Name),
              term: Number(row.Term) as 1 | 2 | 3,
              year: Number(row.Year),
              outOf: Number(row.OutOf) || 100,
              status: (["draft", "open", "closed"].includes(String(row.Status)) ? String(row.Status) : "draft") as "draft" | "open" | "closed",
            });
          });
        });
        toast.success(`Imported ${json.length} exams from Excel`);
      } catch {
        toast.error("Failed to import exams. Please upload a valid Excel (.xlsx) file.");
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div>
      <PageHeader title="Exams" description="Set up exams and terms for this curriculum."
        actions={
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search exams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 w-56"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button variant="outline" onClick={exportExams} disabled={exams.length === 0}>
              <Download className="h-4 w-4 mr-1"/>Export
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1"/>Import
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={importExams} />
            <Button onClick={add}><Plus className="h-4 w-4 mr-1"/>Add exam</Button>
          </div>
        }/>
      <Card className="overflow-x-auto card-pad">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Term</th><th>Year</th><th>Out of</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {exams.map(ex => (
              <tr key={ex.id}>
                <td><input className="inline-edit w-40 font-medium" value={ex.name}
                  onChange={(e) => update(s => { const x = s.exams.find(x => x.id === ex.id); if (x) x.name = e.target.value; })}/></td>
                <td>
                  <select className="inline-edit" value={ex.term}
                    onChange={(e) => update(s => { const x = s.exams.find(x => x.id === ex.id); if (x) x.term = Number(e.target.value) as 1|2|3; })}>
                    <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                  </select>
                </td>
                <td><input type="number" className="inline-edit w-20" value={ex.year}
                  onChange={(e) => update(s => { const x = s.exams.find(x => x.id === ex.id); if (x) x.year = Number(e.target.value); })}/></td>
                <td><input type="number" className="inline-edit w-16" value={ex.outOf}
                  onChange={(e) => update(s => { const x = s.exams.find(x => x.id === ex.id); if (x) x.outOf = Number(e.target.value); })}/></td>
                <td>
                  <select className="inline-edit" value={ex.status}
                    onChange={(e) => update(s => { const x = s.exams.find(x => x.id === ex.id); if (x) x.status = e.target.value as "draft"|"open"|"closed"; })}>
                    <option value="draft">Draft</option>
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                  </select>
                </td>
                <td>
                  <Button variant="ghost" size="icon" onClick={() => update(s => { s.exams = s.exams.filter(x => x.id !== ex.id); s.deletedIds = [...(s.deletedIds ?? []), ex.id]; })}>
                    <Trash2 className="h-4 w-4 text-destructive"/>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
