import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useSchool } from "@/store/school";
import { useAuth } from "@/store/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { statsForStudentExam } from "@/lib/schoolData";
import { Printer, ChevronLeft, ChevronRight } from "lucide-react";

const BLUE = "#2E86C1";
const GREEN = "#1E8449";
const LIGHT_GREY = "#f3f4f6";

export default function Reports() {
  const { state, activeCurriculum, update, setMarkScore } = useSchool();
  const { isPrincipal, canManageStudents, isTeacher, isSeniorTeacher } = useAuth();
  const canComment = isPrincipal || isSeniorTeacher || isTeacher;
  const canEditMarks = isPrincipal || isSeniorTeacher || isTeacher;
  const [params] = useSearchParams();

  const exams   = state.exams.filter(e => e.curriculumId === activeCurriculum && e.status !== "draft")
    .sort((a, b) => a.year - b.year || a.term - b.term);
  const classes = state.classes.filter(c => c.curriculumId === activeCurriculum);

  const [classId,   setClassId]   = useState<string>("");
  const [streamId,  setStreamId]  = useState<string>("");
  const [studentId, setStudentId] = useState<string>(params.get("student") || "");

  useEffect(() => {
    if (studentId) {
      const s = state.students.find(x => x.id === studentId);
      if (s) { setClassId(s.classId); setStreamId(s.streamId); }
    }
  }, [studentId]); // eslint-disable-line

  const streams = state.streams.filter(s => s.classId === classId);
  const studentsInStream = state.students.filter(s =>
    s.curriculumId === activeCurriculum &&
    (!classId  || s.classId  === classId) &&
    (!streamId || s.streamId === streamId)
  );

  useEffect(() => {
    if (!studentId && studentsInStream.length) setStudentId(studentsInStream[0].id);
  }, [studentsInStream.length]); // eslint-disable-line

  const student        = state.students.find(s => s.id === studentId);
  const cls            = student ? state.classes.find(c => c.id === student.classId) : null;
  const str            = student ? state.streams.find(s => s.id === student.streamId) : null;
  const classTeacher   = cls ? state.teachers.find(t => t.id === cls.classTeacherId) : null;

  const latestExam = useMemo(() => {
    if (!exams.length) return null;
    return [...exams].sort((a, b) => b.year - a.year || b.term - a.term)[0];
  }, [exams]);

  const latestStats = student && latestExam ? statsForStudentExam(state, student.id, latestExam.id) : null;

  const filledRows = useMemo(() => (latestStats?.rows ?? []).filter(r => r.score != null), [latestStats]);

  const streamPosition = useMemo(() => {
    if (!student || !latestExam || !latestStats) return null;
    const streamStudents = state.students.filter(s => s.streamId === student.streamId);
    const scores: { id: string; mean: number }[] = [];
    streamStudents.forEach(s => {
      const st = statsForStudentExam(state, s.id, latestExam.id);
      if (st.mean > 0) scores.push({ id: s.id, mean: st.mean });
    });
    scores.sort((a, b) => b.mean - a.mean);
    const rank = scores.findIndex(s => s.id === student.id) + 1;
    return { rank, total: scores.length };
  }, [student, latestExam, state]);

  const overallPosition = useMemo(() => {
    if (!student || !latestExam || !latestStats) return null;
    const classStudents = state.students.filter(s => s.classId === student.classId);
    const scores: { id: string; mean: number }[] = [];
    classStudents.forEach(s => {
      const st = statsForStudentExam(state, s.id, latestExam.id);
      if (st.mean > 0) scores.push({ id: s.id, mean: st.mean });
    });
    scores.sort((a, b) => b.mean - a.mean);
    const rank = scores.findIndex(s => s.id === student.id) + 1;
    return { rank, total: scores.length };
  }, [student, latestExam, state]);

  const performanceTrend = useMemo(() => {
    if (!student || !exams.length) return [];
    return exams.map(ex => {
      const st = statsForStudentExam(state, student.id, ex.id);
      const formNum = cls ? cls.name.match(/\d+/)?.[0] || "?" : "?";
      return {
        name: `F${formNum}T${ex.term}`,
        full: `${ex.name} T${ex.term} ${ex.year}`,
        mean: Math.round(st.mean * 10) / 10,
        year: ex.year,
        term: ex.term,
      };
    });
  }, [student, exams, state, cls]);

  const classRemark = latestExam ? state.classRemarks.find(r => r.studentId === studentId && r.examId === latestExam.id) : null;
  const principalRemark = latestExam ? state.principalRemarks.find(r => r.studentId === studentId && r.examId === latestExam.id) : null;

  const navigate = (dir: -1 | 1) => {
    const idx  = studentsInStream.findIndex(s => s.id === studentId);
    const next = studentsInStream[(idx + dir + studentsInStream.length) % studentsInStream.length];
    if (next) setStudentId(next.id);
  };

  const updateClassRemark = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!student || !latestExam) return;
    update(s => {
      const idx = s.classRemarks.findIndex(r => r.studentId === student.id && r.examId === latestExam.id);
      const entry = { studentId: student.id, examId: latestExam.id, remark: e.target.value, teacherName: classTeacher?.name || "", updatedAt: Date.now() };
      if (idx >= 0) s.classRemarks[idx] = entry;
      else s.classRemarks.push(entry);
    });
  };

  const updatePrincipalRemark = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!student || !latestExam) return;
    update(s => {
      const idx = s.principalRemarks.findIndex(r => r.studentId === student.id && r.examId === latestExam.id);
      const entry = { studentId: student.id, examId: latestExam.id, remark: e.target.value, principalName: "Dr. Joseph Mwangi", updatedAt: Date.now() };
      if (idx >= 0) s.principalRemarks[idx] = entry;
      else s.principalRemarks.push(entry);
    });
  };

  return (
    <div>
      <PageHeader
        title="Student Report Forms"
        description="Combined academic report per student across all terms."
        actions={
          <div className="flex gap-1 no-print">
            <Button size="sm" variant="outline" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4"/></Button>
            <Button size="sm" variant="outline" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4"/></Button>
            <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1"/>Print</Button>
          </div>
        }
      />

      <Card className="p-3 md:p-4 mb-4 no-print">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Select value={classId} onValueChange={(v) => { setClassId(v); setStreamId(""); setStudentId(""); }}>
            <SelectTrigger><SelectValue placeholder="Class / Grade"/></SelectTrigger>
            <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={streamId} onValueChange={(v) => { setStreamId(v); setStudentId(""); }} disabled={!classId}>
            <SelectTrigger><SelectValue placeholder="Stream"/></SelectTrigger>
            <SelectContent>{streams.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger><SelectValue placeholder="Student"/></SelectTrigger>
            <SelectContent>{studentsInStream.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          {latestExam && (
            <div className="flex items-center text-xs text-muted-foreground">
              Latest exam: <span className="font-semibold ml-1">{latestExam.name} · T{latestExam.term} · {latestExam.year}</span>
            </div>
          )}
        </div>
      </Card>

      {student && latestExam && latestStats && (
        <div className="a4-sheet print-page">
          {/* Blue Header Bar */}
          <header className="rounded-t-lg overflow-hidden" style={{ backgroundColor: BLUE }}>
            <div className="px-4 py-3 text-white">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded bg-white/20 flex items-center justify-center text-white font-bold text-[10px] border border-white/30 overflow-hidden">
                  <img src="/school_logo.jpg" alt="School logo" className="h-full w-full object-contain" />
                </div>
                  <div>
                    <div className="font-bold text-sm md:text-base leading-tight">{state.settings.schoolName || "HIGHWAY SECONDARY SCHOOL"}</div>
                    <div className="text-[10px] text-white/80 leading-tight">{state.settings.address || "P.O BOX 1234, NAIROBI"}</div>
                    <div className="text-[10px] text-white/80">PHONE: +254 700 000 000 | EMAIL: info@school.ac.ke</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-white/90">Academic Report Form</div>
                  <div className="text-xs font-bold">{cls?.name || "FORM"} — END OF TERM EXAMS</div>
                  <div className="text-xs">({latestExam.year} — TERM {latestExam.term})</div>
                </div>
              </div>
            </div>
          </header>

          {/* Student Info Bar */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-2 py-2 text-sm border-b border-l-4" style={{ borderLeftColor: GREEN }}>
            <Field label="Student Name" value={student.name} disabled={!canManageStudents}
              onChange={(v) => update(s => { const x = s.students.find(x => x.id === student.id); if (x) x.name = v; })}/>
            <Field label="Adm. No." value={student.admissionNo} disabled={!canManageStudents}
              onChange={(v) => update(s => { const x = s.students.find(x => x.id === student.id); if (x) x.admissionNo = v; })}/>
            <Field label="Form / Class" value={cls?.name || ""} disabled/>
            <Field label="Stream" value={str?.name || ""} disabled/>
            <Field label="KCPE Index" value={(student as any).kcpe || ""} disabled={!canManageStudents}
              onChange={(v) => update(s => { const x = s.students.find(x => x.id === student.id); if (x) (x as any).kcpe = v; })}/>
            <Field label="VAP" value={student.vap} disabled={!canManageStudents}
              onChange={(v) => update(s => { const x = s.students.find(x => x.id === student.id); if (x) x.vap = v; })}/>
          </section>

          {/* Summary Boxes */}
          <section className="grid grid-cols-5 gap-2 py-2 border-b">
            <SummaryBox label="Mean Grade" value={latestStats.overallGrade} />
            <SummaryBox label="Total Marks" value={filledRows.reduce((a, r) => a + (r.score ?? 0), 0).toFixed(0)} />
            <SummaryBox label="Total Points" value={latestStats.totalPoints.toFixed(0)} />
            <SummaryBox label="Stream Pos." value={streamPosition ? `${streamPosition.rank} / ${streamPosition.total}` : "—"} />
            <SummaryBox label="Overall Pos." value={overallPosition ? `${overallPosition.rank} / ${overallPosition.total}` : "—"} />
          </section>

          {/* Charts Row */}
          <section className="grid grid-cols-2 gap-3 py-2 border-b">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Subject Performance</div>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filledRows.map(r => ({ subject: r.subject.length > 12 ? r.subject.slice(0, 12) + "…" : r.subject, score: r.score || 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
                    <XAxis dataKey="subject" stroke="#6b7280" fontSize={9} tick={{fontSize: 9}}/>
                    <YAxis domain={[0, 100]} stroke="#6b7280" fontSize={9}/>
                    <Tooltip contentStyle={{ fontSize: 10 }}/>
                    <Bar dataKey="score" radius={[3,3,0,0]}>
                      {filledRows.map((r) => {
                        const pct = r.score || 0;
                        const fill = pct >= 80 ? "#28B463" : pct >= 60 ? "#2E86C1" : pct >= 40 ? "#F39C12" : "#E74C3C";
                        return <Cell key={r.subjectId} fill={fill}/>;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Performance over Time</div>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
                    <XAxis dataKey="name" stroke="#6b7280" fontSize={9} tick={{fontSize: 9}}/>
                    <YAxis domain={[0, 100]} stroke="#6b7280" fontSize={9}/>
                    <Tooltip contentStyle={{ fontSize: 10 }} formatter={(value: any) => [`${value}%`, "Mean"]} labelFormatter={(label) => performanceTrend.find(d => d.name === label)?.full || label}/>
                    <Bar dataKey="mean" radius={[3,3,0,0]}>
                      {performanceTrend.map((entry) => {
                        const fill = entry.mean >= 80 ? "#28B463" : entry.mean >= 60 ? "#2E86C1" : entry.mean >= 40 ? "#F39C12" : "#E74C3C";
                        return <Cell key={entry.name} fill={fill}/>;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* Subject Results Table */}
          <section className="py-2 border-b overflow-x-auto">
            <table className="w-full text-[11px] border border-black" style={{ minWidth: 720 }}>
              <thead>
                <tr style={{ backgroundColor: BLUE }} className="text-white">
                  <th className="text-left p-1.5 border border-black/30 w-8">#</th>
                  <th className="text-left p-1.5 border border-black/30">SUBJECTS</th>
                  <th className="text-center p-1.5 border border-black/30 w-14">MARKS</th>
                  <th className="text-center p-1.5 border border-black/30 w-14">DEV.</th>
                  <th className="text-center p-1.5 border border-black/30 w-12">GRADE</th>
                  <th className="text-center p-1.5 border border-black/30 w-16">RANK</th>
                  <th className="text-left p-1.5 border border-black/30">COMMENT</th>
                  <th className="text-left p-1.5 border border-black/30 w-28">TEACHER</th>
                </tr>
              </thead>
              <tbody>
                {filledRows.map((r, i) => (
                  <tr key={r.subjectId} className="even:bg-gray-50">
                    <td className="p-1.5 border text-center">{i + 1}</td>
                    <td className="p-1.5 border font-medium">{r.subject}</td>
                    <td className="p-1.5 border text-center">
                      {canEditMarks ? (
                        <input type="number" className="w-12 text-center border-b border-dashed outline-none"
                          defaultValue={r.score ?? ""}
                          onBlur={(e) => {
                            const raw = e.target.value;
                            if (raw === "") setMarkScore(r.entryId, null);
                            else { const n = Number(raw); if (!isNaN(n)) setMarkScore(r.entryId, n); }
                          }}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}/>
                      ) : (
                        r.score ?? "—"
                      )}
                    </td>
                    <td className={`p-1.5 border text-center ${r.deviation > 0 ? "text-green-700" : r.deviation < 0 ? "text-red-600" : ""}`}>
                      {r.deviation > 0 ? "+" : ""}{r.deviation}
                    </td>
                    <td className="p-1.5 border text-center">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold"
                        style={{ backgroundColor: (r.grade === "A" || r.grade === "A-") ? "#d4edda" : r.grade === "B" ? "#d1ecf1" : r.grade === "C" ? "#fff3cd" : "#f8d7da", color: "#155724" }}>
                        {r.grade}
                      </span>
                    </td>
                    <td className="p-1.5 border text-center">{r.rank ? `${r.rank}/${r.total}` : "—"}</td>
                    <td className="p-1.5 border">
                      <input className="w-full text-[11px] border-b border-dashed outline-none" defaultValue={r.teacherComment}
                        disabled={!canComment}
                        onBlur={(e) => update(s => {
                          const sh = s.sheets.find(x => x.examId === latestExam.id && x.subjectId === r.subjectId && x.streamId === student.streamId);
                          if (sh) sh.teacherComment = e.target.value;
                        })}/>
                    </td>
                    <td className="p-1.5 border text-muted-foreground">{r.teacherName}</td>
                  </tr>
                ))}
                {filledRows.length === 0 && (
                  <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">No marks entered yet for this exam.</td></tr>
                )}
              </tbody>
            </table>
          </section>

          {/* Remarks & Signatures */}
          <section className="grid grid-cols-2 gap-4 py-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Class Teacher's Remarks</div>
              <Textarea className="text-xs min-h-[50px] print:min-h-[40px] resize-none" defaultValue={classRemark?.remark || state.settings.classTeacherRemarkTemplate}
                disabled={!canComment}
                onBlur={updateClassRemark}/>
              <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                <span>Signed: {classTeacher?.name || "—"}</span>
                <span>Date: {new Date().toLocaleDateString()}</span>
              </div>
              <div className="mt-4 border-t pt-1 text-[10px] text-muted-foreground">
                <div className="font-semibold">Class Teacher Signature</div>
                <div className="h-8"></div>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Principal's Remarks</div>
              <Textarea className="text-xs min-h-[50px] print:min-h-[40px] resize-none" defaultValue={principalRemark?.remark || state.settings.principalRemarkTemplate}
                disabled={!isPrincipal}
                onBlur={updatePrincipalRemark}/>
              <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                <span>Signed: {state.teachers.find(t => t.role === "principal")?.name || "Principal"}</span>
                <span>Date: {new Date().toLocaleDateString()}</span>
              </div>
              <div className="mt-4 border-t pt-1 text-[10px] text-muted-foreground flex items-start gap-2">
                <div className="flex-1">
                  <div className="font-semibold">Chief Principal Signature</div>
                  <div className="h-8"></div>
                </div>
                <div className="w-16 h-16 border-2 border-dashed rounded flex items-center justify-center text-[9px] text-muted-foreground">
                  STAMP
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, disabled }: {
  label: string; value: string; onChange?: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <input className="inline-edit w-full font-medium" value={value} disabled={disabled} onChange={(e) => onChange?.(e.target.value)}/>
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-md p-1.5 text-center" style={{ backgroundColor: LIGHT_GREY }}>
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
      <div className="text-sm font-bold" style={{ color: BLUE }}>{value}</div>
    </div>
  );
}
