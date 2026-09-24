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
import { gradeFor, sortStudentsByAdmissionNo, type SheetStatus, type ID, type CurriculumId, saveState } from "@/lib/schoolData";
import { AlertTriangle, Cloud, CloudOff, Save, Lock, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import type { MarkEntry } from "@/lib/schoolData";
import * as XLSX from "xlsx";

export default function MarkEntry() {
  const { state, activeCurriculum, update, setMarkScore, syncNow, setActiveCurriculum } = useSchool();
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

  useEffect(() => {
    setDrafts({});
  }, [examId, subjectId]);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [unmatched, setUnmatched] = useState<Array<{ rawAdm: string; score: number | null; suggestedStudents: typeof state.students }>>([]);
  const [manualMap, setManualMap] = useState<Record<string, string>>({});
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

    const classFilter = targetClasses.map(c => c.id);
    const classStreams = state.streams.filter(st => classFilter.includes(st.classId));

    const streamsToShow = streamId
      ? classStreams.filter(st => st.id === streamId)
      : classStreams;

    streamsToShow.forEach(stream => {
      const classStudents = sortStudentsByAdmissionNo(state.students.filter(s => classFilter.includes(s.classId) && s.streamId === stream.id));
      if (classStudents.length === 0) return;
      groups.push({
        streamId: stream.id,
        streamName: `${state.classes.find(c => c.id === stream.classId)?.name || stream.classId} · ${stream.name}`,
        students: classStudents,
      });
    });

    return groups;
  }, [state.students, state.streams, state.classes, targetClasses, subjectId, examId, streamId]);

  const totalStudents = useMemo(() => subjectStreamGroups.reduce((sum, g) => sum + g.students.length, 0), [subjectStreamGroups]);

  const getSheetFor = useMemo(() => (streamIdHint: string) => {
    if (!subjectId || !examId || !streamIdHint) return null;
    return state.sheets.find(s => s.streamId === streamIdHint && s.subjectId === subjectId && s.examId === examId) || null;
  }, [state.sheets, subjectId, examId]);

  const ensureSheetFor = (streamId: string, classIdHint?: string) => {
    if (!subjectId || !examId || !streamId) return null;
    const existing = stateRef.current.sheets.find(s => s.streamId === streamId && s.subjectId === subjectId && s.examId === examId);
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

  const entryLookup = useMemo(() => {
    const lookup = new Map<string, MarkEntry>();
    state.entries.forEach(e => lookup.set(`${e.sheetId}:${e.studentId}`, e));
    return lookup;
  }, [state.entries]);

  const pendingCount = useMemo(() => {
    let count = 0;
    subjectStreamGroups.forEach(group => {
      group.students.forEach(stu => {
        const sheet = getSheetFor(group.streamId);
        if (!sheet) return;
        const e = entryLookup.get(`${sheet.id}:${stu.id}`);
        if (e?.pending) count++;
      });
    });
    return count;
  }, [subjectStreamGroups, getSheetFor, entryLookup]);

  const missingCount = useMemo(() => {
    let count = 0;
    subjectStreamGroups.forEach(group => {
      group.students.forEach(stu => {
        const sheet = getSheetFor(group.streamId);
        if (!sheet) return;
        const e = entryLookup.get(`${sheet.id}:${stu.id}`);
        if (e?.score == null) count++;
      });
    });
    return count;
  }, [subjectStreamGroups, getSheetFor, entryLookup]);

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
      const existing = entryLookup.get(`${sheetForSubject.id}:${studentId}`);
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

    saveState(stateRef.current);
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

      const normalizeAdm = (value: string) => value.trim().toLowerCase().replace(/[\s.\-\/()]/g, "");

      const systemByNormalized = new Map<string, typeof state.students[number]>();
      const systemByLower = new Map<string, typeof state.students[number]>();
      const systemById = new Map<string, typeof state.students[number]>();

      allStudents.forEach(s => {
        const n = normalizeAdm(s.admissionNo);
        if (!systemByNormalized.has(n)) systemByNormalized.set(n, s);
        const l = s.admissionNo.trim().toLowerCase();
        if (!systemByLower.has(l)) systemByLower.set(l, s);
        const id = String(s.id).trim().toLowerCase();
        if (!systemById.has(id)) systemById.set(id, s);
      });

      const unmatchedRows: Array<{ rawAdm: string; score: number | null; suggestedStudents: typeof state.students }> = [];
      const updates: { studentId: string; score: number | null; sheetId: string }[] = [];

      for (const row of rows) {
        const rawAdm = String(row.admissionNo).trim();
        if (!rawAdm) continue;

        const normalized = normalizeAdm(rawAdm);
        const lowered = rawAdm.toLowerCase();

        let stu = systemByNormalized.get(normalized) || systemByLower.get(lowered) || systemById.get(lowered);

        if (!stu) {
          const numeric = rawAdm.replace(/[^0-9]/g, "").trim();
          if (numeric) {
            for (const [key, s] of systemByNormalized.entries()) {
              const keyNumeric = key.replace(/[^0-9]/g, "").trim();
              if (keyNumeric && keyNumeric === numeric) { stu = s; break; }
            }
            if (!stu) {
              for (const [key, s] of systemById.entries()) {
                const keyNumeric = key.replace(/[^0-9]/g, "").trim();
                if (keyNumeric && keyNumeric === numeric) { stu = s; break; }
              }
            }
          }
        }

        if (!stu) {
          const suggestions = allStudents.filter(s => {
            const sysNumeric = s.admissionNo.replace(/[^0-9]/g, "").trim();
            const rowNumeric = rawAdm.replace(/[^0-9]/g, "").trim();
            return sysNumeric && rowNumeric && sysNumeric === rowNumeric;
          });
          unmatchedRows.push({ rawAdm, score: row.score, suggestedStudents: suggestions });
          continue;
        }

        const stuSheet = stateRef.current.sheets.find(s => s.streamId === stu.streamId && s.subjectId === subjectId && s.examId === examId) || ensureSheetFor(stu.streamId, stu.classId);
        if (!stuSheet) continue;
        updates.push({ studentId: stu.id, score: row.score, sheetId: stuSheet.id });
      }

      if (unmatchedRows.length > 0) {
        setUnmatched(unmatchedRows);
        setImportOpen(true);
        toast.warning(`${unmatchedRows.length} row(s) could not be matched automatically. Please review below.`);
        setImportBusy(false);
        return;
      }

      if (updates.length === 0) {
        toast.error("No matching students found for the provided admission numbers");
        setImportBusy(false);
        return;
      }

      update(s => {
        for (const u of updates) {
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
        }
      });

      saveState(stateRef.current);
      toast.success(`Updated ${updates.length} marks locally`);
      setImportOpen(false);
      setImportText("");
      setUnmatched([]);
      setManualMap({});

      const token = localStorage.getItem("ac_token");
      if (!token) {
        toast.info("Marks saved locally. Sign in to sync them to the cloud.");
      } else if (stateRef.current.online) {
        const result = await syncNow();
        if (result && result.pushed > 0) {
          toast.success(`Synced ${result.pushed} mark${result.pushed > 1 ? "s" : ""} to cloud`);
        } else if (result === null) {
          toast.info("Marks saved locally. Sync skipped.");
        } else {
          toast.info("Marks saved locally. They will sync later.");
        }
      } else {
        toast.info("Marks saved locally. They will sync when you're back online.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed";
      toast.error(msg);
    } finally {
      setImportBusy(false);
    }
  };

  const confirmManualImport = async () => {
    if (!subjectId || !examId || !importText.trim()) return;
    setImportBusy(true);
    try {
      const rows = parseImportCsv(importText);
      if (rows.length === 0) {
        toast.error("No valid rows found");
        return;
      }

      const allStudents = subjectStreamGroups.flatMap(g => g.students);
      const normalizeAdm = (value: string) => value.trim().toLowerCase().replace(/[\s.\-\/()]/g, "");

      const systemByNormalized = new Map<string, typeof state.students[number]>();
      allStudents.forEach(s => {
        const n = normalizeAdm(s.admissionNo);
        if (!systemByNormalized.has(n)) systemByNormalized.set(n, s);
      });

      const updates: { studentId: string; score: number | null; sheetId: string }[] = [];

      for (const row of rows) {
        const rawAdm = String(row.admissionNo).trim();
        if (!rawAdm) continue;

        let stu: typeof state.students[number] | undefined;

        const manualKey = rawAdm;
        if (manualMap[manualKey]) {
          stu = allStudents.find(s => s.id === manualMap[manualKey]);
        }

        if (!stu) {
          const normalized = normalizeAdm(rawAdm);
          stu = systemByNormalized.get(normalized);
        }

         if (!stu) continue;

        const stuSheet = stateRef.current.sheets.find(s => s.streamId === stu.streamId && s.subjectId === subjectId && s.examId === examId) || ensureSheetFor(stu.streamId, stu.classId);
        if (!stuSheet) continue;
        updates.push({ studentId: stu.id, score: row.score, sheetId: stuSheet.id });
      }

      if (updates.length === 0) {
        toast.error("No valid matches found after review");
        return;
      }

      update(s => {
        for (const u of updates) {
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
        }
      });

      saveState(stateRef.current);
      toast.success(`Imported ${updates.length} marks`);
      setImportOpen(false);
      setImportText("");
      setUnmatched([]);
      setManualMap({});

      const token = localStorage.getItem("ac_token");
      if (!token) {
        toast.info("Marks saved locally. Sign in to sync them to the cloud.");
      } else if (stateRef.current.online) {
        const result = await syncNow();
        if (result && result.pushed > 0) {
          toast.success(`Synced ${result.pushed} mark${result.pushed > 1 ? "s" : ""} to cloud`);
        } else if (result === null) {
          toast.info("Marks saved locally. Sync skipped.");
        } else {
          toast.info("Marks saved locally. They will sync later.");
        }
      } else {
        toast.info("Marks saved locally. They will sync when you're back online.");
      }
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

      const detected = findHeaderRow(rawRows);

      if (!detected) {
        const inferred = inferDataColumns(rawRows);

        if (inferred) {
          const rows = rawRows
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

          if (rows.length > 0) {
            setImportText(rows.map(r => `${r.admissionNo}, ${r.score ?? ""}`).join("\n"));
            setImportOpen(true);
            return;
          }
        }

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
          if (!admissionNo) return null;
          const finalScore = (!rawScore || Number.isNaN(num)) ? null : Math.max(0, Math.min(100, num));
          return { admissionNo, score: finalScore };
        })
        .filter((r): r is { admissionNo: string; score: number | null } => r !== null);

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

  const exportMarks = () => {
    if (!subjectId || !examId) {
      toast.error("Select a subject and exam first");
      return;
    }
    const exam = state.exams.find(e => e.id === examId);
    const subject = state.subjects.find(s => s.id === subjectId);
    const rows: string[] = [];
    rows.push("Admission No,Student Name,Subject,Exam,Score");
    subjectStreamGroups.forEach(group => {
      group.students.forEach(stu => {
        const sheet = state.sheets.find(s => s.streamId === group.streamId && s.subjectId === subjectId && s.examId === examId);
        const entry = sheet ? entryLookup.get(`${sheet.id}:${stu.id}`) : undefined;
        const score = entry?.score ?? "";
        rows.push(`${stu.admissionNo},"${stu.name}","${subject?.name || ""}","${exam?.name || ""}",${score}`);
      });
    });
    const csvContent = rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `marks_${subject?.name || "export"}_${exam?.name || ""}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${subjectStreamGroups.reduce((sum, g) => sum + g.students.length, 0)} marks`);
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
            <Select value={activeCurriculum} onValueChange={(v) => { setActiveCurriculum(v as CurriculumId); setClassId(""); setStreamId(""); setSubjectId(""); setExamId(""); }}>
              <SelectTrigger><SelectValue placeholder="Curriculum"/></SelectTrigger>
              <SelectContent>{state.curricula.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
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
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
             <Select value={examId} onValueChange={setExamId}>
              <SelectTrigger><SelectValue placeholder="Exam"/></SelectTrigger>
              <SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.id}>{e.name} · T{e.term}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileImport} />
              <Button variant="outline" size="sm" disabled={!subjectId || !examId} onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1"/>Import marks
              </Button>
              <Button variant="outline" size="sm" disabled={!subjectId || !examId} onClick={exportMarks}>
                <Download className="h-4 w-4 mr-1"/>Export marks
              </Button>
            </div>
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
                  <div className="text-xs text-muted-foreground mt-1">
                    {state.exams.find(e => e.id === examId)?.name} · {group.students.length} students
                    {sheet?.locked && " · 🔒 locked"}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Marks are saved per exam and will not overwrite other exams.
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
                        const key = `${stu.id}_${subjectId}_${examId}`;
                        const draft = drafts[key] ?? String(e?.score ?? "");
                        const draftScore = draft === "" ? null : Number(draft);
                        const gb = gradeFor(!Number.isNaN(draftScore) ? draftScore : null, curriculum.gradingScale);
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
                                onChange={(ev) => {
                                  const val = ev.target.value;
                                  setDrafts((prev) => ({ ...prev, [key]: val }));
                                  changeScore(stu.id, subjectId!, val);
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
            Import marks for <b>{state.subjects.find(s => s.id === subjectId)?.name || "selected subject"}</b> in 
            <b> {state.exams.find(e => e.id === examId)?.name || "selected exam"}</b>.
            These marks will be saved separately and will not overwrite marks from other exams.
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

             {unmatched.length > 0 && (
               <div className="space-y-3 rounded-md border border-warning/40 bg-warning/5 p-3">
                 <div className="text-sm font-medium text-warning">
                   {unmatched.length} row(s) could not be matched automatically. Review and map them below.
                 </div>
                 {unmatched.map((row, idx) => {
                   const key = `${idx}_${row.rawAdm}`;
                   const selectedId = manualMap[key];
                   const allOptions = subjectStreamGroups.flatMap(g => g.students);
                   const suggestions = row.suggestedStudents && row.suggestedStudents.length > 0
                     ? row.suggestedStudents
                     : allOptions;

                   return (
                     <div key={key} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                       <div className="md:col-span-3 text-xs font-mono break-all">
                         <div className="text-[10px] uppercase text-muted-foreground">Admission</div>
                         {row.rawAdm}
                       </div>
                       <div className="md:col-span-2 text-xs">
                         <div className="text-[10px] uppercase text-muted-foreground">Score</div>
                         {row.score ?? "—"}
                       </div>
                       <div className="md:col-span-5">
                         <div className="text-[10px] uppercase text-muted-foreground mb-1">Match student</div>
                         <Select value={selectedId} onValueChange={(v) => setManualMap(prev => ({ ...prev, [key]: v }))}>
                           <SelectTrigger className="h-8 text-xs">
                             <SelectValue placeholder="Select student" />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="">-- skip --</SelectItem>
                             {suggestions.map(s => (
                               <SelectItem key={s.id} value={s.id}>
                                 {s.admissionNo} · {s.name}
                               </SelectItem>
                             ))}
                             {allOptions.filter(s => !suggestions.includes(s)).map(s => (
                               <SelectItem key={`other_${s.id}`} value={s.id}>
                                 {s.admissionNo} · {s.name}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                       <div className="md:col-span-2 text-xs text-muted-foreground">
                         {selectedId ? (
                           <span className="text-success">Matched</span>
                         ) : (
                           <span className="text-destructive">Unmatched</span>
                         )}
                       </div>
                     </div>
                   );
                 })}
               </div>
             )}

             <Button className="w-full" onClick={unmatched.length > 0 ? confirmManualImport : handleImportMarks} disabled={importBusy || !importText.trim() || !subjectId || !examId}>
               {importBusy ? "Importing..." : unmatched.length > 0 ? "Confirm Import" : "Import Marks"}
             </Button>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
