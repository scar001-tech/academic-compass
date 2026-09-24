import { useMemo, useState, useEffect, useRef } from "react";
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
import { gradeFor, sortStudentsByAdmissionNo } from "@/lib/schoolData";
import { Cloud, CloudOff, Download, Upload, Lock } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import type { MarkEntry } from "@/lib/schoolData";

export default function Marks() {
  const { state, activeCurriculum, update, syncNow } = useSchool();
  const { isTeacher, isSeniorTeacher, isPrincipal, isHod, isReadOnly } = useAuth();
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
            Only teachers and above can view and enter exam marks.
          </p>
        </Card>
      </div>
    );
  }

  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [examId, setExamId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const classes  = state.classes.filter(c => c.curriculumId === activeCurriculum);
  const streams  = state.streams.filter(s => s.classId === classId);
  const exams    = state.exams.filter(e => e.curriculumId === activeCurriculum);

  const sheets = useMemo(() => {
    if (!examId || !streamId) return [];
    return state.sheets.filter(s => s.examId === examId && s.streamId === streamId);
  }, [state.sheets, examId, streamId]);

  const subjects = useMemo(() => {
    const subjectIds = new Set(sheets.map(s => s.subjectId));
    return state.subjects
      .filter(s => subjectIds.has(s.id) && s.curriculumId === activeCurriculum)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sheets, state.subjects, activeCurriculum]);

  const students = useMemo(() => {
    if (!streamId) return [];
    return sortStudentsByAdmissionNo(state.students.filter(s => s.streamId === streamId));
  }, [state.students, streamId]);

  const curriculum = state.curricula.find(c => c.id === activeCurriculum)!;

  const initializedRef = useRef("");
  useEffect(() => {
    const key = `${examId}::${streamId}::${students.length}`;
    if (key === initializedRef.current || !examId || !streamId) return;
    initializedRef.current = key;

    const s = stateRef.current;
    const relevantSheets = s.sheets.filter(sh => sh.examId === examId && sh.streamId === streamId);
    const missing: MarkEntry[] = [];
    relevantSheets.forEach(sheet => {
      s.students.filter(stu => stu.streamId === streamId).forEach(stu => {
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
  }, [examId, streamId, students.length, update]);

  const matrix = useMemo(() => {
    const result: Record<string, Record<string, { entryId: string; score: number | null; grade: string }>> = {};
    students.forEach(stu => {
      result[stu.id] = {};
      subjects.forEach(sub => {
        const sheet = sheets.find(s => s.subjectId === sub.id);
        if (!sheet) return;
        const entry = state.entries.find(e => e.sheetId === sheet.id && e.studentId === stu.id);
        const score = entry?.score ?? null;
        const gb = gradeFor(score, curriculum.gradingScale);
        result[stu.id][sub.id] = {
          entryId: entry?.id || "",
          score,
          grade: gb?.grade || "—",
        };
      });
    });
    return result;
  }, [students, subjects, sheets, state.entries, curriculum]);

  const studentStats = useMemo(() => {
    const stats: Record<string, { total: number; count: number; average: number; grade: string; position: number }> = {};
    const totals: { id: string; total: number }[] = [];
    students.forEach(stu => {
      const row = matrix[stu.id];
      let total = 0;
      let count = 0;
      subjects.forEach(sub => {
        const cell = row[sub.id];
        if (cell && cell.score != null) {
          total += cell.score;
          count++;
        }
      });
      const average = count ? Math.round(total / count * 10) / 10 : 0;
      const gb = gradeFor(average, curriculum.gradingScale);
      totals.push({ id: stu.id, total });
      stats[stu.id] = { total, count, average, grade: gb?.grade || "—", position: 0 };
    });

    const sorted = [...totals].sort((a, b) => b.total - a.total);
    students.forEach(stu => {
      stats[stu.id].position = sorted.findIndex(x => x.id === stu.id) + 1;
    });

    return stats;
  }, [students, subjects, matrix, curriculum]);

  const changeScore = (studentId: string, subjectId: string, raw: string) => {
    const sheet = sheets.find(s => s.subjectId === subjectId);
    if (!sheet) return;

    if (raw === "") {
      const existing = state.entries.find(e => e.sheetId === sheet.id && e.studentId === studentId);
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
    const outOf = state.exams.find(e => e.id === examId)?.outOf || 100;
    if (isNaN(n) || n < 0 || n > outOf) {
      toast.error(`Score must be 0–${outOf}`);
      return;
    }

    update(s => {
      let e = s.entries.find(x => x.sheetId === sheet.id && x.studentId === studentId);
      if (!e) {
        e = {
          id: `e_${sheet.id}_${studentId}_${Date.now()}`,
          sheetId: sheet.id,
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

  const exportMarks = () => {
    const data = students.map(stu => {
      const stats = studentStats[stu.id];
      const row: Record<string, any> = {
        "Adm. No.": stu.admissionNo,
        "Name": stu.name,
      };
      subjects.forEach(sub => {
        const cell = matrix[stu.id]?.[sub.id];
        row[sub.name] = cell?.score ?? "";
      });
      row["Total"] = stats.total;
      row["Average"] = stats.average;
      row["Grade"] = stats.grade;
      row["Position"] = stats.position;
      return row;
    });
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Marks");
    XLSX.writeFile(workbook, `marks-${examId}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Marks exported as Excel");
  };

  const parseImportCsv = (raw: string): Array<{ admissionNo: string; score: number | null }> => {
    const lines = raw.split(/\r?\n/).filter(line => line.trim());
    const rows: Array<{ admissionNo: string; score: number | null }> = [];
    for (const line of lines) {
      const parts = line.split(",").map(s => s.trim());
      if (parts.length < 2 || !parts[0]) continue;
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
    if (!examId || !streamId) {
      toast.error("Select an exam and stream first");
      return;
    }
    const sheet = sheets[0];
    if (!sheet) {
      toast.error("No mark sheet found for this exam and stream");
      return;
    }
    setImportBusy(true);
    try {
      const rows = parseImportCsv(importText);
      if (rows.length === 0) {
        toast.error("No valid rows found. Format: admissionNo, score");
        return;
      }
      const res = await fetch("/api/imports/marks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ac_token")}`,
        },
        body: JSON.stringify({
          rows,
          sheetId: sheet.id,
          curriculumId: sheet.curriculumId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Import failed");
      toast.success(`Imported ${data.imported} marks`);
      setImportOpen(false);
      setImportText("");
      syncNow();
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
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      const parseJson = (json: any[]): Array<{ admissionNo: string; score: number | null }> => {
        return json
          .map(r => {
            const admissionNo = String(r["Adm. No."] || r["admissionNo"] || r["admission_no"] || "").trim();
            const scoreRaw = r["score"] ?? r["Score"] ?? r["marks"] ?? r["Marks"];
            const score = scoreRaw != null && scoreRaw !== "" ? Number(scoreRaw) : null;
            if (!admissionNo || Number.isNaN(score)) return null;
            const finalScore = typeof score === "number" && Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null;
            return { admissionNo, score: finalScore };
          })
          .filter((r): r is { admissionNo: string; score: number | null } => r !== null);
      };

      let rows = parseJson(XLSX.utils.sheet_to_json<any>(sheet));

      if (rows.length === 0) {
        const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
        const looksLikeSystemNoise = (value: string) => /environment_details|system_prompt|user_prompt|current_time|workspace_root|open_tabs|^\s*\{/.test(value.trim().toLowerCase());
        const normalizeHeader = (h: string) => String(h).trim().toLowerCase().replace(/[\s.\-_\/()]/g, "");

        const looksLikeAdmission = (value: string) => /^\d+[\/\-\s]?[a-z0-9]*$/i.test(value.trim()) || /^[a-z]{0,3}\/\d+\/\d+$/i.test(value.trim());
        const looksLikeScore = (value: string) => {
          const num = Number(value);
          return !Number.isNaN(num) && Number.isFinite(num) && num >= 0 && num <= 100;
        };

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
          const looksLikeAdmission = (value: string) => /^\d+[\/\-\s]?[a-z0-9]*$/i.test(value.trim()) || /^[a-z]{0,3}\/\d+\/\d+$/i.test(value.trim());
          const looksLikeScore = (value: string) => {
            const num = Number(value);
            return !Number.isNaN(num) && Number.isFinite(num) && num >= 0 && num <= 100;
          };

          const inferDataColumns = (rows: any[][]): { admissionCol: number; scoreCol: number } | null => {
            if (!rows.length) return null;
            const firstRow = rows[0].map((v: any) => String(v).trim()).filter((v: any) => v && !looksLikeSystemNoise(v));
            if (firstRow.length < 2) return null;

            const admissionCandidates: number[] = [];
            const scoreCandidates: number[] = [];

            firstRow.forEach((val, idx) => {
              if (looksLikeAdmission(val)) admissionCandidates.push(idx);
              if (looksLikeScore(val)) scoreCandidates.push(idx);
            });

            if (admissionCandidates.length === 0) {
              const firstNumeric = firstRow.findIndex(v => looksLikeScore(v) || looksLikeAdmission(v));
              if (firstNumeric >= 0) admissionCandidates.push(firstNumeric);
            }

            if (admissionCandidates.length > 0 && scoreCandidates.length >= 1) {
              const admissionCol = admissionCandidates[0];
              const scoreCol = scoreCandidates.find(c => c !== admissionCol) ?? scoreCandidates[0];
              if (admissionCol !== scoreCol) return { admissionCol, scoreCol };
            }

            if (admissionCandidates.length > 0 && firstRow.length >= 2) {
              const admissionCol = admissionCandidates[0];
              const fallbackScoreCol = firstRow.findIndex((_, idx) => idx !== admissionCol);
              if (fallbackScoreCol >= 0 && fallbackScoreCol !== admissionCol) return { admissionCol, scoreCol: fallbackScoreCol };
            }

            return null;
          };

          const inferred = inferDataColumns(rawRows);

          if (inferred) {
            rows = rawRows
              .filter(r => r.some((v: any) => String(v).trim() !== ""))
              .map(r => {
                const admissionNo = String(r[inferred.admissionCol] ?? "").trim();
                const rawScore = r[inferred.scoreCol] != null ? String(r[inferred.scoreCol]).trim() : "";
                const num = Number(rawScore);
                if (!admissionNo) return null;
                const finalScore = (!rawScore || Number.isNaN(num)) ? null : Math.max(0, Math.min(100, num));
                return { admissionNo, score: finalScore };
              })
              .filter((r): r is { admissionNo: string; score: number | null } => r !== null);
          }

          if (rows.length === 0) {
            const firstRow = (rawRows[0] || []).map((v: any) => String(v)).filter((v: any) => v && !looksLikeSystemNoise(v)).slice(0, 5).join(", ") || "(blank)";
            toast.error(`No recognizable header row found. First row sample: ${firstRow}`);
            return;
          }

          setImportText(rows.map(r => `${r.admissionNo}, ${r.score ?? ""}`).join("\n"));
          setImportOpen(true);
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

        rows = dataRows
          .map(r => {
            const colIndex = (header: string) => detected.headers.indexOf(header);
            const admCol = colIndex(admissionHeader);
            const scoreCol = colIndex(scoreHeader);
            const admissionNo = String(r[admCol] ?? "").trim();
            const rawScore = r[scoreCol] != null ? String(r[scoreCol]).trim() : "";
            const num = Number(rawScore);
            if (!admissionNo) return null;
            const finalScore = (!rawScore || Number.isNaN(num)) ? null : Math.max(0, Math.min(100, num));
            return { admissionNo, score: finalScore };
          })
          .filter((r): r is { admissionNo: string; score: number | null } => r !== null);
      }

      if (rows.length === 0) {
        toast.error("No valid rows found in file");
        return;
      }
      setImportText(rows.map(r => `${r.admissionNo}, ${r.score ?? ""}`).join("\n"));
      setImportOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to read file";
      toast.error(msg);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const pendingCount = state.entries.filter(e => e.pending).length;

  return (
    <div>
      <PageHeader
        title="Exam Marks"
        description="View and edit marks for all subjects in a selected exam."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={state.online ? "border-success text-success" : "border-destructive text-destructive"}>
              {state.online ? <><Cloud className="h-3 w-3 mr-1" />Online</> : <><CloudOff className="h-3 w-3 mr-1" />Offline</>}
            </Badge>
            {pendingCount > 0 && <Badge className="bg-warning text-warning-foreground">{pendingCount} queued</Badge>}
            <Button size="sm" variant="outline" disabled={!state.online || pendingCount === 0 || !canEnterMarks} onClick={syncNow}>
              <Cloud className="h-4 w-4 mr-1" />Sync
            </Button>
            <Button size="sm" variant="outline" onClick={exportMarks} disabled={!examId || !streamId || students.length === 0 || !canEnterMarks}>
              <Download className="h-4 w-4 mr-1" />Export
            </Button>
            <Button size="sm" variant="outline" disabled={!examId || !streamId || students.length === 0 || !canEnterMarks} onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1" />Import
            </Button>
          </div>
        }
      />

      <Card className="p-3 md:p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Select value={examId} onValueChange={setExamId}>
            <SelectTrigger><SelectValue placeholder="Exam" /></SelectTrigger>
            <SelectContent>
              {exams.map(e => <SelectItem key={e.id} value={e.id}>{e.name} · T{e.term}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={classId} onValueChange={(v) => { setClassId(v); setStreamId(""); }}>
            <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
            <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={streamId} onValueChange={setStreamId} disabled={!classId}>
            <SelectTrigger><SelectValue placeholder="Stream" /></SelectTrigger>
            <SelectContent>{streams.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </Card>

      {!examId || !streamId ? (
        <Card className="p-6 text-center text-muted-foreground">
          Select an exam and stream to view marks.
        </Card>
      ) : subjects.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          No subjects found for this exam and stream.
        </Card>
      ) : (
        <Card className="overflow-x-auto card-pad">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Adm. No.</th>
                  <th>Student</th>
                  {subjects.map(sub => <th key={sub.id} className="text-center whitespace-nowrap">{sub.code || sub.name}</th>)}
                  <th className="text-center">Total</th>
                  <th className="text-center">Avg</th>
                  <th className="text-center">Grade</th>
                  <th className="text-center">Pos</th>
                </tr>
              </thead>
              <tbody>
                 {students.map((stu, i) => {
                  const stats = studentStats[stu.id];
                  return (
                    <tr key={stu.id}>
                      <td className="text-muted-foreground">{i + 1}</td>
                      <td className="font-mono text-xs">{stu.admissionNo}</td>
                      <td className="font-medium">{stu.name}</td>
                      {subjects.map(sub => {
                        const cell = matrix[stu.id]?.[sub.id];
                        const key = `${stu.id}_${sub.id}`;
                        const draft = drafts[key] ?? String(cell?.score ?? "");
                        return (
                          <td key={sub.id} className="text-center">
                            <Input
                              type="number"
                              className="h-8 w-16 text-center mx-auto"
                              disabled={!canEnterMarks}
                              value={draft}
                              onChange={(ev) => setDrafts((prev) => ({ ...prev, [key]: ev.target.value }))}
                              onBlur={(ev) => {
                                changeScore(stu.id, sub.id, ev.target.value);
                                setDrafts((prev) => ({ ...prev, [key]: String(cell?.score ?? "") }));
                              }}
                              onKeyDown={(ev) => {
                                if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
                              }}
                            />
                          </td>
                        );
                      })}
                      <td className="text-center font-medium">{stats.total}</td>
                      <td className="text-center">{stats.average}</td>
                      <td className="text-center">{stats.grade}</td>
                      <td className="text-center">{stats.position}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" /> Import Marks
            </DialogTitle>
            <DialogDescription>
              Paste CSV data or upload an Excel file. Expected format: <code>admissionNo, score</code> or a table with columns <code>Adm. No.</code> and <code>score</code>.
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
                placeholder="2244, 78&#10;CBC/101/26, 85&#10;CBC/102/26, 92"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handleImportMarks} disabled={importBusy || !importText.trim()}>
              {importBusy ? "Importing..." : "Import Marks"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
