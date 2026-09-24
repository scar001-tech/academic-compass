import { useMemo } from "react";
import { useSchool } from "@/store/school";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from "recharts";
import {
  Users, BookOpen, ClipboardList,
  AlertTriangle, TrendingUp, GitMerge, CheckCircle2,
} from "lucide-react";
import { statsForStudentExam } from "@/lib/schoolData";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { state, activeCurriculum } = useSchool();
  const navigate = useNavigate();
  const curriculum = state.curricula.find(c => c.id === activeCurriculum)!;

  const students = state.students.filter(s => s.curriculumId === activeCurriculum);
  const subjects  = state.subjects.filter(s => s.curriculumId === activeCurriculum);
  const exams     = state.exams.filter(e => e.curriculumId === activeCurriculum);
  const sheets    = state.sheets.filter(s => s.curriculumId === activeCurriculum);

  const pendingEntries = state.entries.filter(e => {
    const sh = state.sheets.find(x => x.id === e.sheetId);
    return sh?.curriculumId === activeCurriculum && e.pending === true;
  });
  const pendingMarks = pendingEntries.length;

  const sheetPendingCounts = new Map<string, number>();
  for (const e of pendingEntries) {
    sheetPendingCounts.set(e.sheetId, (sheetPendingCounts.get(e.sheetId) ?? 0) + 1);
  }
  const topPendingSheetId = [...sheetPendingCounts.entries()]
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  const conflicts = state.conflicts.filter(c => c.status === "pending").length;
  const latestExam = exams.find(e => e.status !== "draft");
  const entriesBySheet = useMemo(() => {
    const m = new Map<string, typeof state.entries>();
    for (const e of state.entries) {
      if (e.score == null) continue;
      const list = m.get(e.sheetId) ?? [];
      list.push(e);
      m.set(e.sheetId, list);
    }
    return m;
  }, [state.entries]);
  const subjectAvgData = useMemo(() => {
    if (!latestExam) return [];
    return subjects.map((sub) => {
      const shs = sheets.filter(s => s.subjectId === sub.id && s.examId === latestExam.id);
      let total = 0, count = 0;
      for (const sh of shs) {
        const ents = entriesBySheet.get(sh.id);
        if (ents) { for (const e of ents) { total += e.score ?? 0; count++; } }
      }
      const avg = count ? total / count : 0;
      return { subject: sub.code, name: sub.name, avg: Math.round(avg * 10) / 10 };
    });
  }, [subjects, sheets, latestExam, entriesBySheet]);

  const trendData = useMemo(() => {
    return exams
      .filter(e => e.status !== "draft")
      .sort((a, b) => a.year - b.year || a.term - b.term)
      .map(ex => {
        const shs = sheets.filter(s => s.examId === ex.id);
        let total = 0, count = 0;
        for (const sh of shs) {
          const ents = entriesBySheet.get(sh.id);
          if (ents) { for (const e of ents) { total += e.score ?? 0; count++; } }
        }
        const avg = count ? total / count : 0;
        return { name: `${ex.name} T${ex.term}`, avg: Math.round(avg * 10) / 10 };
      });
  }, [exams, sheets, entriesBySheet]);

  const weakAreas = subjectAvgData.filter(s => s.avg > 0 && s.avg < 50).length;

  const tiles = [
    { label: "Students",        value: students.length, icon: Users,         tone: "info" },
    { label: "Subjects",        value: subjects.length, icon: BookOpen,       tone: "primary" },
    { label: "Exams",           value: exams.length,    icon: ClipboardList,  tone: "accent" },
    { label: "Pending marks",   value: pendingMarks,    icon: AlertTriangle,  tone: "warning" },
    { label: "Weak areas",      value: weakAreas,       icon: TrendingUp,     tone: "destructive" },
    { label: "Conflicts",       value: conflicts,       icon: GitMerge,       tone: "destructive" },
  ];

  return (
    <div className="dashboard-bg">
      <PageHeader
        title={`${curriculum.shortName} Dashboard`}
        description={curriculum.description + " · " + state.settings.academicYear}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link to="/entry">Enter Marks</Link></Button>
            <Button asChild><Link to="/reports">Generate Reports</Link></Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4 md:mb-6">
        {tiles.map((t) => (
          <div key={t.label} className="stat-tile">
            <div className="flex items-center justify-between">
              <span className="text-[10px] md:text-xs text-muted-foreground">{t.label}</span>
              <t.icon className={`h-3.5 w-3.5 md:h-4 md:w-4 text-${t.tone}`} />
            </div>
            <div className="text-xl md:text-2xl font-semibold">{t.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        <Card className="p-3 md:p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <div>
              <div className="text-sm font-medium">Average performance by subject</div>
              <div className="text-xs text-muted-foreground">
                {latestExam ? `${latestExam.name} · Term ${latestExam.term}` : "No exam data"}
              </div>
            </div>
            <Badge variant="secondary">{curriculum.shortName}</Badge>
          </div>
          <div className="h-56 md:h-72">
            <ResponsiveContainer>
              <BarChart data={subjectAvgData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="subject" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-3 md:p-4">
          <div className="text-sm font-medium mb-1">Trend across exams</div>
          <div className="text-xs text-muted-foreground mb-2 md:mb-3">Overall mean score</div>
          <div className="h-56 md:h-72">
            <ResponsiveContainer>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 md:gap-4 mt-3 md:mt-4">
        <Card className="p-4">
          <div className="text-sm font-medium mb-3">Attention needed</div>
          <ul className="space-y-2 text-sm">
            {conflicts > 0 && (
              <li className="flex items-center justify-between rounded-md border p-3">
                <span className="flex items-center gap-2">
                  <GitMerge className="h-4 w-4 text-destructive"/>
                  {conflicts} sync conflict{conflicts > 1 ? "s" : ""} awaiting review
                </span>
                <Button asChild size="sm" variant="outline">
                  <Link to="/conflicts">Resolve</Link>
                </Button>
              </li>
            )}
            {pendingMarks > 0 && (
              <li className="flex items-center justify-between rounded-md border p-3">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning"/>
                  {pendingMarks} pending mark entr{pendingMarks > 1 ? "ies" : "y"} awaiting sync
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(topPendingSheetId ? `/entry?sheet=${topPendingSheetId}` : "/entry")}
                >
                  Open
                </Button>
              </li>
            )}
            {weakAreas > 0 && (
              <li className="flex items-center justify-between rounded-md border p-3">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-destructive"/>
                  {weakAreas} subject{weakAreas > 1 ? "s" : ""} below 50% average
                </span>
                <Button asChild size="sm" variant="outline">
                  <Link to="/transcripts">Review</Link>
                </Button>
              </li>
            )}
            {conflicts + pendingMarks + weakAreas === 0 && (
              <li className="text-sm text-muted-foreground flex items-center gap-2 p-2">
                <CheckCircle2 className="h-4 w-4 text-success"/> All clear. Nice work.
              </li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
