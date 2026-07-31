import { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useSchool } from "@/store/school";
import { useAuth } from "@/store/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { gradeFor, type SheetStatus, type ID, type CurriculumId } from "@/lib/schoolData";
import { AlertTriangle, Cloud, CloudOff, Save, Lock, Upload } from "lucide-react";
import { toast } from "sonner";
import type { MarkEntry } from "@/lib/schoolData";
import * as XLSX from "xlsx";

export default function MarkEntry() {
  const { state, activeCurriculum, update, setMarkScore, syncNow } = useSchool();
  const { isTeacher, isSeniorTeacher, isPrincipal, isHod, isReadOnly } = useAuth();
  const [params, setParams] = useSearchParams();
  const stateRef = useRef(state);
  stateRef.current = state;

  const canEnterMarks = isPrincipal || isSeniorTeacher || isTeacher || isHod;

  if (!canEnterMarks && !isReadOnly) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-4">
        <Card className="w-full max-w-md p-6 text-center space-y-4">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-bold">Access Restricted</h1>
          <p className="text-sm text-muted-foreground">
            Only teachers and above can enter marks. Please contact the Principal for access.
          </p>
        </Card>
      </div>
    );
  }

  const preSheet = params.get("sheet");
  const preSheetObj = state.sheets.find(s => s.id === preSheet);

  const [classId, setClassId]     = useState<string>(preSheetObj?.classId || "");
  const [streamId, setStreamId]   = useState<string>(preSheetObj?.streamId || "");
  const [subjectId, setSubjectId] = useState<string>(preSheetObj?.subjectId || "");
  const [examId, setExamId]       = useState<string>(preSheetObj?.examId || "");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const classes  = state.classes.filter(c => c.curriculumId === activeCurriculum);
  const streams  = state.streams.filter(s => s.classId === classId);
  const subjects = state.subjects.filter(s => s.curriculumId === activeCurriculum);
  const exams    = state.exams.filter(e => e.curriculumId === activeCurriculum);
  const curriculum = state.curricula.find(c => c.id === activeCurriculum)!;

  const targetClasses = useMemo(() => {
    if (!classId) return classes;
    return classes.filter(c => c.id === classId);
  }, [classes, classId]);

  const subjectStreamGroups = useMemo(() => {
    if (!subjectId || !examId) return [];
    const groups: Array<{ streamId: string; streamName: string; students: typeof state.students }> = [];

    targetClasses.forEach(cls => {
      const classStreams = state.streams.filter(st => st.classId === cls.id);
      classStreams.forEach(stream => {
        const classStudents = state.students.filter(s => s.classId === cls.id && s.streamId === stream.id);
        if (classStudents.length === 0) return;
        groups.push({
          streamId: stream.id,
          streamName: `${cls.name} · ${stream.name}`,
          students: classStudents,
        });
      });
    });

    return groups;
  }, [state.students, state.streams, targetClasses, subjectId, examId]);

  const totalStudents = useMemo(() => subjectStreamGroups.reduce((sum, g) => sum + g.students.length, 0), [subjectStreamGroups]);

  const getSheetFor = useMemo(() => (streamIdHint: string) => {
    if (!subjectId || !examId || !streamIdHint) return null;
    return state.sheets.find(s => s.streamId === streamIdHint && s.subjectId === subjectId && s.examId === examId) || null;
  }, [state.sheets, subjectId, examId]);

  const ensureSheetFor = (streamId: string, classIdHint?: string) => {
    if (!subjectId || !examId || !streamId) return null;
    const existing = state.sheets.find(s => s.streamId === streamId && s.subjectId === subjectId && s.examId === examId);
    if (existing) return existing;
    const newSheet = {
      id: `${activeCurriculum}_${classIdHint || classId}_${streamId}_${subjectId}_${examId}` as ID,
      curriculumId: activeCurriculum,
      classId: classIdHint || classId || "",
      streamId,
      subjectId,
      examId,
      status: "draft" as SheetStatus,
      locked: false,
      updatedAt: Date.now(),
    };
    update(s => { s.sheets.push(newSheet); });
    return newSheet;
  };

  const initializedRef = useRef("");
  useEffect(() => {
    const key = `${examId}::${subjectId}::${totalStudents}`;
    if (key === initializedRef.current || !examId || !subjectId || totalStudents === 0) return;
    initializedRef.current = key;

    const s = state;
    const missing: MarkEntry[] = [];
    subjectStreamGroups.forEach(group => {
      group.students.forEach(stu => {
        const sheet = getSheetFor(group.streamId);
        if (!sheet) return;
        const exists = s.entries.some(e => e.sheetId === sheet.id && e.studentId === stu.id);
        if (!exists) {
          missing.push({
            id: `e_${sheet.id}_${stu.id}_${Math.random().toString(36).slice(2, 7)}`,
            sheetId: sheet.id,
            studentId: stu.id,
            score: null,
            updatedAt: Date.now(),
            updatedBy: s.deviceName,
            pending: true,
          });
        }
      });
    });
    if (missing.length > 0) {
      update(s => { s.entries.push(...missing); });
    }
  }, [examId, subjectId, totalStudents, subjectStreamGroups, getSheetFor, update]);

  const pendingCount = useMemo(() => {
    let count = 0;
    subjectStreamGroups.forEach(group => {
      group.students.forEach(stu => {
        const sheet = getSheetFor(group.streamId);
        if (!sheet) return;
        const e = state.entries.find(x => x.sheetId === sheet.id && x.studentId === stu.id);
        if (e?.pending) count++;
      });
    });
    return count;
  }, [subjectStreamGroups, getSheetFor, state.entries]);

  const missingCount = useMemo(() => {
    let count = 0;
    subjectStreamGroups.forEach(group => {
      group.students.forEach(stu => {
        const sheet = getSheetFor(group.streamId);
        if (!sheet) return;
        const e = state.entries.find(x => x.sheetId === sheet.id && x.studentId === stu.id);
        if (e?.score == null) count++;
      });
    });
    return count;
  }, [subjectStreamGroups, getSheetFor, state.entries]);

  const changeScore = (studentId: string, subjectId: string, raw: string) => {
    const stu = state.students.find(s => s.id === studentId);
    if (!stu) return;
    let sheetForSubject = state.sheets.find(s => s.streamId === stu.streamId && s.subjectId === subjectId && s.examId === examId);
    if (!sheetForSubject) {
      const created = ensureSheetFor(stu.streamId, stu.classId);
      if (!created) return;
      sheetForSubject = created;
    }

    if (raw === "") {
      const existing = state.entries.find(e => e.sheetId === sheetForSubject.id && e.studentId === studentId);
      if (existing) {
        update(s => {
          const e = s.entries.find(x => x.id === existing.id);
          if (e) {
            e.score = null;
            e.updatedAt = Date.now();
            e.updatedBy = s.deviceName;
            e.pending = true;
          }
        });
      }
      return;
    }

    const n = Number(raw);
    if (isNaN(n)) {
      toast.error("Invalid number");
      return;
    }
    const outOf = state.exams.find(e => e.id === examId)?.outOf || 100;
    if (n < 0 || n > outOf) {
      toast.error(`Score must be 0–${outOf}`);
      return;
    }

    update(s => {
      let e = s.entries.find(x => x.sheetId === sheetForSubject.id && x.studentId === studentId);
      if (!e) {
        e = {
          id: `e_${sheetForSubject.id}_${studentId}_${Date.now()}`,
          sheetId: sheetForSubject.id,
          studentId,
          score: n,
          updatedAt: Date.now(),
          updatedBy: s.deviceName,
          pending: true,
        };
        s.entries.push(e);
      } else {
        e.score = n;
        e.updatedAt = Date.now();
        e.updatedBy = s.deviceName;
        e.pending = true;
      }
      if (!s.syncQueue.includes(e.id)) s.syncQueue.push(e.id);
    });

    if (stateRef.current.online) syncNow();
  };

  const parseImportCsv = (raw: string): Array<{ admissionNo: string; score: number | null }> => {
    const lines = raw.split(/\r?\n/).filter(line => line.trim());
    const rows: Array<{ admissionNo: string; score: number | null }> = [];
    for (const line of lines) {
      const parts = line.split(",").map(s => s.trim()).filter(Boolean);
      if (parts.length < 2) continue;
      const admissionNo = parts[0];
      const scoreRaw = parts[1];
      const score = scoreRaw === "" || scoreRaw === "-" ? null : Number(scoreRaw);
      if (!admissionNo || Number.isNaN(score)) continue;
      const finalScore = typeof score === "number" && Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null;
      rows.push({ admissionNo, score: finalScore });
    }
    return rows;
  };

  const handleImportMarks = async () => {
    if (!subjectId || !examId) {
      toast.error("Select a subject and exam first");
      return;
    }
    setImportBusy(true);
    try {
      const rows = parseImportCsv(importText);
      if (rows.length === 0) {
        toast.error("No valid rows found. Format: admissionNo, score");
        return;
      }

      const allStudents = subjectStreamGroups.flatMap(g => g.students);

      const normalizeAdm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

      const systemByName = new Map<string, typeof state.students[number]>();
      allStudents.forEach(s => {
        const n = normalizeAdm(s.admissionNo);
        if (!systemByName.has(n)) systemByName.set(n, s);
      });

      const systemByLower = new Map<string, typeof state.students[number]>();
      allStudents.forEach(s => {
        const n = s.admissionNo.trim().toLowerCase();
        if (!systemByLower.has(n)) systemByLower.set(n, s);
      });

      let imported = 0;
      const updates: { studentId: string; score: number | null; sheetId: string }[] = [];
      for (const row of rows) {
        const rawAdm = String(row.admissionNo).trim();
        if (!rawAdm) continue;

        const normalized = normalizeAdm(rawAdm);
        const lowered = rawAdm.toLowerCase();

        let stu = systemByName.get(normalized) || systemByLower.get(lowered) || null;

        if (!stu) {
          const exact = allStudents.find(s => s.admissionNo === rawAdm);
          if (exact) stu = exact;
        }

        if (!stu) continue;

        const stuSheet = state.sheets.find(s => s.streamId === stu.streamId && s.subjectId === subjectId && s.examId === examId);
        if (!stuSheet) continue;
        updates.push({ studentId: stu.id, score: row.score, sheetId: stuSheet.id });
      }

      if (updates.length === 0) {
        toast.error("No matching students found for the provided admission numbers");
        return;
      }
      for (const u of updates) {
        update(s => {
          let e = s.entries.find(x => x.sheetId === u.sheetId && x.studentId === u.studentId);
          if (!e) {
            e = {
              id: `e_${u.sheetId}_${u.studentId}_${Date.now()}`,
              sheetId: u.sheetId,
              studentId: u.studentId,
              score: u.score,
              updatedAt: Date.now(),
              updatedBy: s.deviceName,
              pending: true,
            };
            s.entries.push(e);
          } else {
            e.score = u.score;
            e.updatedAt = Date.now();
            e.updatedBy = s.deviceName;
            e.pending = true;
          }
          if (!s.syncQueue.includes(e.id)) s.syncQueue.push(e.id);
        });
        imported++;
      }
      toast.success(`Imported ${imported} mark${imported > 1 ? "s" : ""}`);
      setImportOpen(false);
      setImportText("");
      if (stateRef.current.online) syncNow();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed";
      toast.error(msg);
    } finally {
      setImportBusy(false);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);

      if (!workbook.SheetNames.length) {
        toast.error("The file appears to have no sheets. Please upload a valid Excel/CSV file.");
        return;
      }

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      if (!sheet || !sheet["!ref"]) {
        toast.error("The selected sheet is empty or unreadable");
        return;
      }

      const rawRows = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: "" });

      if (!rawRows.length) {
        toast.error("File appears to be empty");
        return;
      }

      const looksLikeSystemNoise = (value: string) => /environment_details|system_prompt|user_prompt|current_time|workspace_root|open_tabs|^\s*\{/.test(value.trim().toLowerCase());

      const normalizeHeader = (h: string) => String(h).trim().toLowerCase().replace(/[\s.\-_\/()]/g, "");

      const findHeaderRow = (rows: any[][]): { rowIndex: number; headers: string[] } | null => {
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const row = rows[i];
          const values = row.map((v: any) => String(v).trim()).filter((v) => v && !looksLikeSystemNoise(v));
          if (values.length < 2) continue;

          const normalizedHeaders = values.map(normalizeHeader);
          const hasAdm = normalizedHeaders.some(h => /^(adm|admission|studentno|regno|regnumber|admissionno|admissionnumber)/.test(h) || (h.includes("adm") && h.includes("no")));
          const hasScore = normalizedHeaders.some(h => /^(score|mark|marksobtained|scorepct)/.test(h) || (h.includes("score") || h.includes("mark")));

          if (hasAdm && hasScore) {
            return { rowIndex: i, headers: row.map(String) };
          }
        }
        return null;
      };

      const detected = findHeaderRow(rawRows);

      if (!detected) {
        const firstRow = (rawRows[0] || []).map((v: any) => String(v)).filter((v: any) => v && !looksLikeSystemNoise(v)).slice(0, 5).join(", ") || "(blank)";
        toast.error(`No recognizable header row found. First row sample: ${firstRow}`);
        return;
      }

      const dataRows = rawRows.slice(detected.rowIndex + 1).filter(r => r.some((v: any) => String(v).trim() !== ""));

      if (!dataRows.length) {
        toast.error("No data rows found below header row");
        return;
      }

      const admissionHeader = detected.headers.find(h => {
        const n = normalizeHeader(h);
        return /^(adm|admission|studentno|regno|regnumber|admissionno|admissionnumber)/.test(n) || (n.includes("adm") && n.includes("no"));
      });

      const scoreHeader = detected.headers.find(h => {
        const n = normalizeHeader(h);
        return /^(score|mark|marksobtained|scorepct)/.test(n) || n.includes("score") || n.includes("mark");
      });

      if (!admissionHeader || !scoreHeader) {
        toast.error(`Detected header row but missing required columns. Headers found: ${detected.headers.slice(0, 5).join(", ")}`);
        return;
      }

      const rows = dataRows
        .map(r => {
          const colIndex = (header: string) => detected.headers.indexOf(header);
          const admCol = colIndex(admissionHeader);
          const scoreCol = colIndex(scoreHeader);
          const admissionNo = String(r[admCol] ?? "").trim();
          const rawScore = r[scoreCol] != null ? String(r[scoreCol]).trim() : "";
          const num = Number(rawScore);
          if (!admissionNo || Number.isNaN(num)) return null;
          const finalScore = Math.max(0, Math.min(100, num));
          return { admissionNo, score: finalScore };
        })
        .filter((r): r is { admissionNo: string; score: number } => r !== null);

      if (rows.length === 0) {
        toast.error("No valid rows found in file");
        return;
      }

      setImportText(rows.map(r => `${r.admissionNo}, ${r.score}`).join("\n"));
      setImportOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to read file";
      toast.error(msg);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div>
      <PageHeader
        title="Offline Mark Entry"
        description="Enter marks anywhere. Changes queue locally when offline and sync when reconnected."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={state.online ? "border-success text-success" : "border-destructive text-destructive"}>
              {state.online ? <><Cloud className="h-3 w-3 mr-1"/>Online</> : <><CloudOff className="h-3 w-3 mr-1"/>Offline</>}
            </Badge>
            {pendingCount > 0 && <Badge className="bg-warning text-warning-foreground">{pendingCount} queued</Badge>}
            <Button size="sm" disabled={!state.online || pendingCount === 0} onClick={syncNow}>
              <Save className="h-4 w-4 mr-1"/>Sync now
            </Button>
          </div>
        }
      />

      <Card className="p-3 md:p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
            <Select value={classId} onValueChange={(v) => { setClassId(v); setStreamId(""); }}>
              <SelectTrigger><SelectValue placeholder="Class / Grade"/></SelectTrigger>
              <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={streamId} onValueChange={setStreamId} disabled={!classId}>
              <SelectTrigger><SelectValue placeholder="Stream"/></SelectTrigger>
              <SelectContent>{streams.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue placeholder="Subject"/></SelectTrigger>
              <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={examId} onValueChange={setExamId}>
              <SelectTrigger><SelectValue placeholder="Exam"/></SelectTrigger>
              <SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.id}>{e.name} · T{e.term}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileImport} />
            <Button variant="outline" size="sm" disabled={!subjectId || !examId} onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1"/>Import marks
            </Button>
          </div>
        </div>
      </Card>

      {subjectStreamGroups.length === 0 && (subjectId && examId) && (
        <Card className="p-6 text-center text-muted-foreground">
          <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-warning"/>
          No students found for the selected filters.
        </Card>
      )}

      {subjectStreamGroups.length > 0 && (
        <div className="space-y-6">
          {subjectStreamGroups.map((group) => {
            const sheet = getSheetFor(group.streamId);
            return (
              <Card key={group.streamId} className="overflow-hidden card-pad">
                <div className="p-3 border-b bg-muted/30">
                  <div className="font-medium text-sm">
                    {state.subjects.find(s => s.id === subjectId)?.name} · {group.streamName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {state.exams.find(e => e.id === examId)?.name} · {group.students.length} students
                    {sheet?.locked && " · 🔒 locked"}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr><th>#</th><th>Adm. No.</th><th>Student</th><th className="w-28">Score</th><th>Grade</th></tr>
                    </thead>
                    <tbody>
                      {group.students.map((stu, i) => {
                        const e = sheet ? state.entries.find(x => x.sheetId === sheet.id && x.studentId === stu.id) : undefined;
                        const gb = gradeFor(e?.score ?? null, curriculum.gradingScale);
                        const key = `${stu.id}_${subjectId}`;
                        const draft = drafts[key] ?? String(e?.score ?? "");
                        return (
                          <tr key={stu.id}>
                            <td className="text-muted-foreground">{i+1}</td>
                            <td className="font-mono text-xs">{stu.admissionNo}</td>
                            <td className="font-medium">{stu.name}</td>
                            <td>
                              <Input
                                type="number" min={0} max={100}
                                className="h-9 w-24"
                                disabled={!canEnterMarks}
                                value={draft}
                                onChange={(ev) => setDrafts((prev) => ({ ...prev, [key]: ev.target.value }))}
                                onBlur={(ev) => {
                                  changeScore(stu.id, subjectId!, ev.target.value);
                                  setDrafts((prev) => ({ ...prev, [key]: String(e?.score ?? "") }));
                                }}
                                onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); }}
                              />
                            </td>
                            <td>{gb ? <span className="chip bg-primary-soft text-primary border-primary/30">{gb.grade}</span> : <span className="text-muted-foreground">—</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" /> Import Marks
            </DialogTitle>
            <DialogDescription>
              Paste CSV data or upload an Excel file for <b>{state.subjects.find(s => s.id === subjectId)?.name || "selected subject"}</b>.
              Expected format: <code>admissionNo, score</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Upload Excel/CSV</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileImport}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="import-text">Or paste CSV</Label>
              <textarea
                id="import-text"
                className="w-full h-40 border rounded-md p-2 text-sm font-mono"
                placeholder="2244, 78&#10;CBC/101/26, 85"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handleImportMarks} disabled={importBusy || !importText.trim() || !subjectId || !examId}>
              {importBusy ? "Importing..." : "Import Marks"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
