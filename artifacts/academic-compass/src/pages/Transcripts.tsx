import { useState, useMemo } from "react";
import { useSchool } from "@/store/school";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { statsForStudentExam, identifyWeakAreas, sortStudentsByAdmissionNo } from "@/lib/schoolData";
import { Printer, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Link } from "react-router-dom";

export default function Transcripts() {
  const { state, activeCurriculum, update } = useSchool();
  const students = sortStudentsByAdmissionNo(state.students.filter(s => s.curriculumId === activeCurriculum));
  const [studentId, setStudentId] = useState<string>(students[0]?.id || "");
  const student = state.students.find(s => s.id === studentId);
  const exams = state.exams.filter(e => e.curriculumId === activeCurriculum && e.status !== "draft")
    .sort((a, b) => a.year - b.year || a.term - b.term);
  const [examId, setExamId] = useState<string>(exams[exams.length - 1]?.id || "");

  const stats = student && examId ? statsForStudentExam(state, student.id, examId) : null;
  const weak  = student ? identifyWeakAreas(state, student.id) : [];

  const trend = useMemo(() => {
    if (!student) return [];
    return exams.map(ex => {
      const s = statsForStudentExam(state, student.id, ex.id);
      return { name: `${ex.name} T${ex.term}`, mean: s.mean };
    });
  }, [student, exams, state]); // eslint-disable-line

  return (
    <div>
      <PageHeader title="Student Transcripts" description="Visual profile: subject performance, deviations, trends, weak areas." />

      <Card className="p-3 md:p-4 mb-4 flex flex-wrap gap-2 items-center">
        <Select value={studentId} onValueChange={setStudentId}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Student"/></SelectTrigger>
          <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.name} — {s.admissionNo}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={examId} onValueChange={setExamId}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Exam"/></SelectTrigger>
          <SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.id}>{e.name} · T{e.term}</SelectItem>)}</SelectContent>
        </Select>
        {student && (
          <Button asChild size="sm" variant="outline" className="ml-auto">
            <Link to={`/reports?student=${student.id}&exam=${examId}`}><Printer className="h-4 w-4 mr-1"/>Report form</Link>
          </Button>
        )}
      </Card>

      {student && stats && (
        <>
          <div className="grid md:grid-cols-4 gap-3 mb-4">
            <div className="stat-tile"><span className="text-xs text-muted-foreground">Mean score</span><span className="text-2xl font-semibold">{stats.mean}</span></div>
            <div className="stat-tile"><span className="text-xs text-muted-foreground">Overall grade</span><span className="text-2xl font-semibold">{stats.overallGrade}</span></div>
            <div className="stat-tile"><span className="text-xs text-muted-foreground">Total points</span><span className="text-2xl font-semibold">{stats.totalPoints}</span></div>
            <div className="stat-tile"><span className="text-xs text-muted-foreground">Weak subjects</span><span className="text-2xl font-semibold text-destructive">{weak.length}</span></div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="text-sm font-medium mb-3">Subject performance</div>
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={stats.rows.map(r => ({ subject: r.subject, score: r.score || 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                    <XAxis dataKey="subject" stroke="hsl(var(--muted-foreground))" fontSize={11}/>
                    <YAxis domain={[0,100]} stroke="hsl(var(--muted-foreground))" fontSize={11}/>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}/>
                    <Bar dataKey="score" fill="hsl(var(--primary))" radius={[6,6,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-medium mb-3">Skill radar</div>
              <div className="h-72">
                <ResponsiveContainer>
                  <RadarChart data={stats.rows.map(r => ({ subject: r.subject, score: r.score || 0 }))}>
                    <PolarGrid stroke="hsl(var(--border))"/>
                    <PolarAngleAxis dataKey="subject" fontSize={11}/>
                    <PolarRadiusAxis domain={[0,100]} fontSize={10}/>
                    <Radar dataKey="score" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.3}/>
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4 lg:col-span-2">
              <div className="text-sm font-medium mb-3">Mean score trend across exams</div>
              <div className="h-64">
                <ResponsiveContainer>
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                    <XAxis dataKey="name" fontSize={11}/>
                    <YAxis domain={[0,100]} fontSize={11}/>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}/>
                    <Line type="monotone" dataKey="mean" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-medium mb-3">Subject breakdown</div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Subject</th><th>Score</th><th>Grade</th><th>Rank</th><th>Deviation</th></tr></thead>
                  <tbody>
                    {stats.rows.map(r => (
                      <tr key={r.subjectId}>
                        <td className="font-medium">{r.subject}</td>
                        <td>{r.score ?? "—"}</td>
                        <td><span className="chip bg-primary-soft text-primary border-primary/30">{r.grade}</span></td>
                        <td>{r.rank || "—"}/{r.total}</td>
                        <td className={r.deviation > 0 ? "text-success" : r.deviation < 0 ? "text-destructive" : ""}>
                          {r.deviation > 0 ? "+" : ""}{r.deviation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-medium mb-3">Weak areas & recommended attention</div>
              {weak.length === 0 && <div className="text-sm text-muted-foreground">No weak areas detected.</div>}
              <ul className="space-y-2">
                {weak.map((w, i) => (
                  <li key={i} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <div>
                      <div className="font-medium">{w.subject}</div>
                      <div className="text-xs text-muted-foreground">Latest {w.latestScore} · {w.reason}</div>
                    </div>
                    <span className="chip bg-warning-soft text-warning-foreground border-warning">
                      {w.trend === "up" ? <TrendingUp className="h-3 w-3"/> : w.trend === "down" ? <TrendingDown className="h-3 w-3"/> : <Minus className="h-3 w-3"/>}
                      {w.trend}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <label className="text-xs text-muted-foreground">Support plan (editable)</label>
                <Textarea
                  placeholder="Recommended remedial actions, mentorship, guardian outreach…"
                  defaultValue={student.vap}
                  onBlur={(e) => update(s => { const x = s.students.find(x => x.id === student.id); if (x) x.vap = e.target.value; })}/>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
