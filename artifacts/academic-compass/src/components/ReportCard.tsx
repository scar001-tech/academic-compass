import { useMemo } from "react";
import { useSchool } from "@/store/school";
import { useAuth } from "@/store/auth";
import {
  statsForStudentExam,
  statsForStudentAllTerms,
  type CurriculumId,
  type ID,
} from "@/lib/schoolData";
import { Textarea } from "@/components/ui/textarea";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const BLUE = "#2E86C1";
const GREEN = "#1E8449";
const LIGHT_GREY = "#f3f4f6";

export interface ReportCardProps {
  studentId: ID;
  activeCurriculum: CurriculumId;
  printMode?: boolean;
  selectedTerm?: number;
}

export default function ReportCard({ studentId, activeCurriculum, printMode = false, selectedTerm }: ReportCardProps) {
  const { state, update } = useSchool();
  const { isPrincipal, canManageStudents, isTeacher, isSeniorTeacher } = useAuth();
  const canComment = isPrincipal || isSeniorTeacher || isTeacher;

  const student = state.students.find(s => s.id === studentId);
  const cls = student ? state.classes.find(c => c.id === student.classId) : null;
  const str = student ? state.streams.find(s => s.id === student.streamId) : null;
  const classTeacher = cls ? state.teachers.find(t => t.id === cls.classTeacherId) : null;

  const exams = state.exams.filter(e => e.curriculumId === activeCurriculum && e.status !== "draft")
    .filter(e => selectedTerm === undefined || e.term === selectedTerm)
    .sort((a, b) => a.year - b.year || a.term - b.term);

  const latestExam = useMemo(() => exams[exams.length - 1] ?? null, [exams]);

  const examLabel = (exam: ID | undefined, index: number) => {
    if (!exam) return "";
    const pos = exams.findIndex(e => e.id === exam);
    if (activeCurriculum === "844") {
      if (pos === 0) return "Assessment 1";
      if (pos === 1) return "Assessment 2";
      if (pos === 2) return "End-term Exam";
      return `Exam ${pos + 1}`;
    }
    if (pos === 0) return "Opener Exam";
    if (pos === 1) return "Mid-term Exam";
    if (pos === 2) return "End-term Exam";
    return `Exam ${pos + 1}`;
  };

  const latestStats = student && latestExam ? statsForStudentExam(state, student.id, latestExam.id) : null;
  const filledRows = useMemo(() => (latestStats?.rows ?? []).filter(r => r.score != null), [latestStats]);
  const is844 = activeCurriculum === "844";
  const isCbcLike = activeCurriculum === "cbc" || cls?.name.toLowerCase().includes("form 3") || cls?.name.toLowerCase().includes("form 4") || cls?.name.toLowerCase().includes("grade 10");
  const isTerm2 = selectedTerm === 2;

  const maxExams = isCbcLike || (is844 && isTerm2) ? 2 : 999;

  const multiTermStats = student ? statsForStudentAllTerms(state, student.id, selectedTerm, maxExams) : null;

  const streamPosition = useMemo(() => {
    if (!student || !latestExam || !latestStats) return null;
    const streamStudents = state.students.filter(s => s.streamId === student.streamId && s.curriculumId === activeCurriculum);
    const scores: { id: string; mean: number }[] = [];
    streamStudents.forEach(s => {
      const st = statsForStudentExam(state, s.id, latestExam.id);
      if (st.mean > 0) scores.push({ id: s.id, mean: st.mean });
    });
    scores.sort((a, b) => b.mean - a.mean);
    const rank = scores.findIndex(s => s.id === student.id) + 1;
    return { rank, total: scores.length };
  }, [student, latestExam, state, activeCurriculum]);

  const overallPosition = useMemo(() => {
    if (!student || !latestExam || !latestStats) return null;
    const classStudents = state.students.filter(s => s.classId === student.classId && s.curriculumId === activeCurriculum);
    const scores: { id: string; mean: number }[] = [];
    classStudents.forEach(s => {
      const st = statsForStudentExam(state, s.id, latestExam.id);
      if (st.mean > 0) scores.push({ id: s.id, mean: st.mean });
    });
    scores.sort((a, b) => b.mean - a.mean);
    const rank = scores.findIndex(s => s.id === student.id) + 1;
    return { rank, total: classStudents.length };
  }, [student, latestExam, state, activeCurriculum]);

  const performanceTrend = useMemo(() => {
    if (!student || !latestExam) return [];
    const subjects = state.subjects.filter(s => s.curriculumId === activeCurriculum);
    const entries = subjects
      .map(sub => {
        const sheet = state.sheets.find(s => s.examId === latestExam.id && s.subjectId === sub.id && s.streamId === student.streamId);
        const entry = sheet ? state.entries.find(e => e.sheetId === sheet.id && e.studentId === student.id) : undefined;
        return { subject: sub.name, score: entry?.score ?? null };
      })
      .filter(item => item.score != null);
    return entries.map(item => ({
      name: item.subject,
      mean: Math.round((item.score as number) * 10) / 10,
    }));
  }, [student, latestExam, state, activeCurriculum]);

  const classRemark = latestExam ? state.classRemarks.find(r => r.studentId === studentId && r.examId === latestExam.id) : null;
  const principalRemark = latestExam ? state.principalRemarks.find(r => r.studentId === studentId && r.examId === latestExam.id) : null;

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
      const entry = { studentId: student.id, examId: latestExam.id, remark: e.target.value, principalName: "", updatedAt: Date.now() };
      if (idx >= 0) s.principalRemarks[idx] = entry;
      else s.principalRemarks.push(entry);
    });
  };

  if (!student || !latestExam) return null;

  return (
    <div className="a4-sheet print-page">
      <header className="rounded-t-lg overflow-hidden" style={{ backgroundColor: BLUE }}>
        <div className="px-6 py-5 text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded bg-white/20 flex items-center justify-center text-white font-bold text-xs border border-white/30 overflow-hidden">
                {state.settings.logoUrl ? (
                  <img src={state.settings.logoUrl} alt="School logo" className="h-full w-full object-contain" />
                ) : (
                  <img src="/assets/school_logo.jpg" alt="School logo" className="h-full w-full object-contain" />
                )}
              </div>
              <div>
                <div className="font-bold text-xl md:text-2xl leading-tight">{state.settings.schoolName || "DRUMVALE SENIOR SCHOOL"}</div>
                <div className="text-sm text-white/90 leading-tight mt-1">{state.settings.address || "P.O BOX 1234, NAIROBI"}</div>
                <div className="text-sm text-white/90 mt-1">PHONE: 0704921291 | EMAIL: info@drumvalesecondary.sc.ke</div>
              </div>
            </div>
              <div className="text-right">
                <div className="text-sm font-semibold uppercase tracking-wide text-white/90">Academic Report Form</div>
                <div className="text-lg font-bold">{cls?.name || "FORM"} — {latestExam ? examLabel(latestExam.id, exams.findIndex(e => e.id === latestExam.id)) : ""}</div>
                <div className="text-base">({latestExam?.year} — TERM {latestExam?.term})</div>
              </div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-2 py-2 text-sm border-b border-l-4" style={{ borderLeftColor: GREEN }}>
        <Field label="Student Name" value={student.name} disabled={!canManageStudents || printMode}
          onChange={(v) => update(s => { const x = s.students.find(x => x.id === student.id); if (x) x.name = v; })}/>
        <Field label="Adm. No." value={student.admissionNo} disabled={!canManageStudents || printMode}
          onChange={(v) => update(s => { const x = s.students.find(x => x.id === student.id); if (x) x.admissionNo = v; })}/>
        <Field label="Form / Class" value={cls?.name || ""} disabled/>
        <Field label="Stream" value={str?.name || ""} disabled/>
      </section>

      <section className="grid grid-cols-5 gap-2 py-2 border-b">
        <SummaryBox label="Mean Grade" value={(latestStats as any).overallGrade} />
        <SummaryBox label="Total Marks" value={filledRows.reduce((a, r) => a + (r.score ?? 0), 0).toFixed(0)} />
        <SummaryBox label="Total Points" value={(latestStats as any).totalPoints.toFixed(0)} />
        <SummaryBox label="Stream Pos." value={streamPosition ? `${streamPosition.rank} / ${streamPosition.total}` : "—"} />
        <SummaryBox label="Overall Pos." value={overallPosition ? `${overallPosition.rank} / ${overallPosition.total}` : "—"} />
      </section>

      {performanceTrend.length > 0 && (
        <section className="py-2 border-b">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Performance Trend</div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Line type="monotone" dataKey="mean" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {multiTermStats && (
        <section className="py-2 border-b overflow-x-auto">
          <table className="w-full text-[11px] border border-black" style={{ minWidth: 720 }}>
            <thead>
              <tr style={{ backgroundColor: BLUE }} className="text-white">
                <th className="text-left p-1.5 border border-black/30 w-8">#</th>
                <th className="text-left p-1.5 border border-black/30">SUBJECTS</th>
                {multiTermStats?.terms.map((t) => (
                  <th key={t.examId} className="text-center p-1.5 border border-black/30" colSpan={4}>
                    {examLabel(t.examId, exams.findIndex(e => e.id === t.examId))}
                  </th>
                ))}
                <th className="text-left p-1.5 border border-black/30">COMMENT</th>
              </tr>
              <tr style={{ backgroundColor: BLUE }} className="text-white">
                <th className="p-1.5 border border-black/30"></th>
                <th className="p-1.5 border border-black/30"></th>
                {multiTermStats?.terms.map((t) => (
                  <>
                    <th key={`${t.examId}-marks`} className="text-center p-1.5 border border-black/30 w-14">MARKS</th>
                    <th key={`${t.examId}-dev`} className="text-center p-1.5 border border-black/30 w-14">DEV.</th>
                    <th key={`${t.examId}-grade`} className="text-center p-1.5 border border-black/30 w-12">GRADE</th>
                    <th key={`${t.examId}-rank`} className="text-center p-1.5 border border-black/30 w-16">RANK</th>
                  </>
                ))}
                <th className="p-1.5 border border-black/30"></th>
              </tr>
            </thead>
            <tbody>
              {multiTermStats?.rows.filter(r => r.terms.some(t => t.score != null)).map((r, i) => (
                <tr key={r.subjectId} className="even:bg-gray-50">
                  <td className="p-1.5 border text-center">{i + 1}</td>
                  <td className="p-1.5 border font-medium">{r.subject}</td>
                  {r.terms.map((t) => (
                    <>
                      <td key={`${t.examId}-score`} className="p-1.5 border text-center">
                        {t.score != null ? t.score : "—"}
                      </td>
                      <td key={`${t.examId}-dev`} className={`p-1.5 border text-center ${t.deviation > 0 ? "text-green-700" : t.deviation < 0 ? "text-red-600" : ""}`}>
                        {t.deviation > 0 ? "+" : ""}{t.deviation}
                      </td>
                      <td key={`${t.examId}-grade`} className="p-1.5 border text-center">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold"
                          style={{ backgroundColor: (t.grade === "A" || t.grade === "A-") ? "#d4edda" : t.grade === "B" ? "#d1ecf1" : t.grade === "C" ? "#fff3cd" : "#f8d7da", color: "#155724" }}>
                          {t.grade}
                        </span>
                      </td>
                      <td key={`${t.examId}-rank`} className="p-1.5 border text-center">{t.rank ? `${t.rank}/${t.total}` : "—"}</td>
                    </>
                  ))}
                  <td className="p-1.5 border">
                    <input className="w-full text-[11px] border-b border-dashed outline-none" defaultValue={filledRows.find(fr => fr.subjectId === r.subjectId)?.teacherComment || ""}
                      disabled={!canComment || printMode}
                      onBlur={(e) => update(s => {
                        const sh = s.sheets.find(x => x.examId === latestExam.id && x.subjectId === r.subjectId && x.streamId === student.streamId);
                        if (sh) sh.teacherComment = e.target.value;
                      })}/>
                  </td>
                </tr>
              ))}
              {(multiTermStats?.rows.filter(r => r.terms.some(t => t.score != null)).length ?? 0) === 0 && (
                <tr><td colSpan={multiTermStats ? 5 + multiTermStats.terms.length * 4 : 5} className="p-4 text-center text-muted-foreground">No marks entered yet.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 py-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Class Teacher's Remarks</div>
          <Textarea className="text-xs min-h-[50px] print:min-h-[40px] resize-none" defaultValue={classRemark?.remark || state.settings.classTeacherRemarkTemplate}
            disabled={!canComment || printMode}
            onBlur={updateClassRemark}/>
          <div className="mt-4 border-t pt-1 text-[10px] text-muted-foreground">
            <div className="font-semibold">Class Teacher Signature</div>
            <div className="h-8"></div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 py-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Principal's Remarks</div>
          <Textarea className="text-xs min-h-[50px] print:min-h-[40px] resize-none" defaultValue={principalRemark?.remark || "You can do better. Exploit your potential."}
            disabled={!isPrincipal || printMode}
            onBlur={updatePrincipalRemark}/>
          <div className="mt-4 border-t pt-1 text-[10px] text-muted-foreground">
            <div className="font-semibold">Principal's Signature</div>
            <div className="h-8"></div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 py-2">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Stamp</div>
            <div className="w-24 h-24 border-2 border-dashed rounded flex items-center justify-center text-[9px] text-muted-foreground">
              STAMP
            </div>
          </div>
        </div>
      </section>
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
