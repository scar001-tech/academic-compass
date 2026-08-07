import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useSchool } from "@/store/school";
import { useAuth } from "@/store/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { statsForStudentExam, type CurriculumId, type ID } from "@/lib/schoolData";
import { Printer, ChevronLeft, ChevronRight, Search, Download, MessageSquare } from "lucide-react";
import { toast } from "sonner";

const BLUE = "#2E86C1";
const GREEN = "#1E8449";
const LIGHT_GREY = "#f3f4f6";

export default function Reports() {
  const { state, activeCurriculum, setActiveCurriculum, update, setMarkScore } = useSchool();
  const { isPrincipal, canManageStudents, isTeacher, isSeniorTeacher } = useAuth();
  const canComment = isPrincipal || isSeniorTeacher || isTeacher;
  const canEditMarks = isPrincipal || isSeniorTeacher || isTeacher;
  const [params] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState("");
  const [sendingSms, setSendingSms] = useState(false);

  const curricula = state.curricula;

  const exams   = state.exams.filter(e => e.curriculumId === activeCurriculum && e.status !== "draft")
    .sort((a, b) => a.year - b.year || a.term - b.term);
  const classes = state.classes.filter(c => c.curriculumId === activeCurriculum);

  const [classId,   setClassId]   = useState<string>("");
  const [streamId,  setStreamId]  = useState<string>("");
  const [studentId, setStudentId] = useState<string>(params.get("student") || "");

  useEffect(() => {
    if (activeCurriculum && (!classId || !state.classes.some(c => c.id === classId && c.curriculumId === activeCurriculum))) {
      setClassId("");
      setStreamId("");
      setStudentId("");
    }
  }, [activeCurriculum]); // eslint-disable-line

  useEffect(() => {
    if (studentId) {
      const s = state.students.find(x => x.id === studentId);
      if (s) { setClassId(s.classId); setStreamId(s.streamId); }
    }
  }, [studentId]); // eslint-disable-line

  const streams = state.streams.filter(s => s.classId === classId);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.students.filter(s => {
      if (s.curriculumId !== activeCurriculum) return false;
      if (classId && s.classId !== classId) return false;
      if (streamId && s.streamId !== streamId) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q);
    });
  }, [state.students, activeCurriculum, classId, streamId, searchQuery]);

  useEffect(() => {
    if (!studentId || !filteredStudents.some(s => s.id === studentId)) {
      if (filteredStudents.length > 0) {
        setStudentId(filteredStudents[0].id);
      } else {
        setStudentId("");
      }
    }
  }, [filteredStudents]); // eslint-disable-line

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
    return { rank, total: scores.length };
  }, [student, latestExam, state, activeCurriculum]);

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
    const idx  = filteredStudents.findIndex(s => s.id === studentId);
    const next = filteredStudents[(idx + dir + filteredStudents.length) % filteredStudents.length];
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

  const loadSample844Data = () => {
    update((s) => {
      const base = "scp";
      const formNames = ["Form 2", "Form 3", "Form 4"];
      const streams = ["East", "West"];
      const subjectNames = ["Mathematics", "English", "Kiswahili", "Physics", "Chemistry", "Biology", "History", "Geography", "CRE", "Computer Studies", "Business Studies", "Agriculture"];
      const subjectCodes = ["101", "102", "103", "232", "233", "235", "312", "313", "315", "452", "442", "565"];
      const teacherNames = ["John Mwangi", "Grace Wairimu", "Peter Kipchoge", "Mary Njeri", "James Ochieng", "Rose Chebet", "David Kimani", "Susan Moraa", "Patrick Wanyama", "Lucy Atieno", "Michael Kiptoo", "Nancy Cheruiyot"];
      const studentFirstNames = ["Brian", "Cynthia", "Dennis", "Evelyn", "Francis", "Gloria", "Hillary", "Irene", "Jacob", "Kevin", "Linda", "Michael", "Nancy", "Oscar", "Patricia", "Quincy", "Rachel", "Samuel", "Tracy", "Victor", "Winnie", "Yusuf", "Zainabu", "Abel", "Diana", "Eric", "Faith", "George", "Hannah", "Ivan"];
      const studentLastNames = ["Kariuki", "Odhiambo", "Wekesa", "Jepkorir", "Mutua", "Cherono", "Kimutai", "Kiplagat", "Ngugi", "Onyango", "Mwangi", "Wafula", "Kamau", "Kihara", "Owino", "Omondi", "Maina", "Kinyua", "Mbaabu", "Kosgei"];
      const remarks = ["Well done, keep it up.", "Good effort, improve your consistency.", "Fair performance, work harder in the next term.", "Hardworking, Aim higher.", "Improving, stay focused.", "Needs to take studies seriously.", "Satisfactory, revise more often.", "Excellent work, maintain the standard."];

      let studentCounter = 1;
      let classCounter = 1;
      let streamCounter = 1;
      let subjectCounter = 1;
      let examCounter = 1;
      let sheetCounter = 1;
      let entryCounter = 1;
      let classRemarkCounter = 1;
      let principalRemarkCounter = 1;

      const newStudents: any[] = [];
      const newClasses: any[] = [];
      const newStreams: any[] = [];
      const newSubjects: any[] = [];
      const newTeachers: any[] = [];
      const newExams: any[] = [];
      const newSheets: any[] = [];
      const newEntries: any[] = [];
      const newClassRemarks: any[] = [];
      const newPrincipalRemarks: any[] = [];

      const now = Date.now();

      teacherNames.forEach((name, i) => {
        newTeachers.push({
          id: `844_teacher_${i + 1}`,
          email: name.toLowerCase().replace(/ /g, ".") + "@school.ac.ke",
          passwordHash: "hashed",
          fullName: name,
          department: subjectNames[i % subjectNames.length],
          approved: true,
          curriculumId: "844",
          role: i === 0 ? "principal" : i === 1 ? "hod" : i < 4 ? "class_teacher" : "teacher",
          createdAt: now - 100000000,
        });
      });

      subjectNames.forEach((name, i) => {
        newSubjects.push({
          id: `844_subject_${i + 1}`,
          curriculumId: "844",
          name,
          code: `${subjectCodes[i]}`,
          createdAt: now,
        });
      });

      formNames.forEach((formName, fi) => {
        const classId = `844_class_${fi + 1}`;
        newClasses.push({
          id: classId,
          curriculumId: "844",
          name: formName,
          classTeacherId: fi < 4 ? `844_teacher_${fi + 3}` : undefined,
          createdAt: now,
        });

        streams.forEach((streamName, si) => {
          const streamId = `844_stream_${fi + 1}_${si + 1}`;
          newStreams.push({
            id: streamId,
            curriculumId: "844",
            classId,
            name: streamName,
            createdAt: now,
          });

          for (let st = 0; st < 28; st++) {
            const firstName = studentFirstNames[(studentCounter + st) % studentFirstNames.length];
            const lastName = studentLastNames[(studentCounter + st) % studentLastNames.length];
            const admNo = `844/${formName.replace(" ", "")}/${String(st + 1).padStart(3, "0")}`;
            newStudents.push({
              id: `844_student_${studentCounter}`,
              curriculumId: "844",
              classId,
              streamId,
              name: `${firstName} ${lastName}`,
              admissionNo: admNo,
              kcpe: `${200 + Math.floor(Math.random() * 100)}`,
              vap: `${280 + Math.floor(Math.random() * 120)}`,
              createdAt: now,
            });
            studentCounter++;
          }

          const terms = [
            { id: `844_exam_${examCounter}`, name: "End of Term 1", year: 2024, term: 1, outOf: 100 },
            { id: `844_exam_${examCounter + 1}`, name: "End of Term 2", year: 2024, term: 2, outOf: 100 },
            { id: `844_exam_${examCounter + 2}`, name: "End of Term 3", year: 2024, term: 3, outOf: 100 },
          ];
          terms.forEach((exam) => {
            newExams.push({
              ...exam,
              curriculumId: "844",
              status: "finalized",
              createdAt: now,
            });

            newSubjects.forEach((subject, subjIdx) => {
              const sheetId = `844_sheet_${sheetCounter}`;
              newSheets.push({
                id: sheetId,
                curriculumId: "844",
                classId,
                streamId,
                subjectId: subject.id,
                examId: exam.id,
                teacherId: newTeachers[subjIdx % newTeachers.length].id,
                teacherComment: "",
                status: "finalized",
                locked: true,
                updatedAt: now,
              });

              newStudents.filter(stu => stu.classId === classId && stu.streamId === streamId).forEach((stu, stuIdx) => {
                const baseMark = 45 + Math.floor(Math.random() * 45);
                const score = Math.min(100, Math.max(0, baseMark + (Math.random() > 0.5 ? 5 : -5)));
                newEntries.push({
                  id: `844_entry_${entryCounter}`,
                  sheetId,
                  studentId: stu.id,
                  score: Math.round(score),
                  updatedAt: now,
                  updatedBy: "System",
                  pending: false,
                });
                entryCounter++;
              });

              newClassRemarks.push({
                id: `844_classremark_${classRemarkCounter}`,
                studentId: newStudents.find(stu => stu.classId === classId && stu.streamId === streamId)?.id || "",
                examId: exam.id,
                remark: remarks[Math.floor(Math.random() * remarks.length)],
                teacherName: newTeachers.find(t => t.role === "class_teacher")?.fullName || "Class Teacher",
                updatedAt: now,
              });
              classRemarkCounter++;

              newPrincipalRemarks.push({
                id: `844_principal_${principalRemarkCounter}`,
                studentId: newStudents.find(stu => stu.classId === classId && stu.streamId === streamId)?.id || "",
                examId: exam.id,
                remark: remarks[Math.floor(Math.random() * remarks.length)],
                principalName: "Dr. Joseph Mwangi",
                updatedAt: now,
              });
              principalRemarkCounter++;
              sheetCounter++;
            });
          });
          examCounter += 3;
        });
      });

      if (!s.settings.schoolName) {
        s.settings = {
          ...s.settings,
          schoolName: "HIGHWAY SECONDARY SCHOOL",
          address: "P.O BOX 1234, NAIROBI",
          academicYear: 2024,
          classTeacherRemarkTemplate: "Continue working hard.",
          principalRemarkTemplate: "Keep up the good work.",
        };
      }

      s.teachers.push(...newTeachers);
      s.subjects.push(...newSubjects);
      s.classes.push(...newClasses);
      s.streams.push(...newStreams);
      s.students.push(...newStudents);
      s.exams.push(...newExams);
      s.sheets.push(...newSheets);
      s.entries.push(...newEntries);
      s.classRemarks.push(...newClassRemarks);
      s.principalRemarks.push(...newPrincipalRemarks);
    });
    toast.success("Sample 8.4.4 Senior School data loaded. Browse reports in the 8-4-4 curriculum.");
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
            <Button size="sm" variant="default" disabled={!student || !latestExam || sendingSms || !(isPrincipal || isSeniorTeacher)} onClick={async () => {
              if (!student || !latestExam || !latestStats) { toast.error("No student or exam selected"); return; }
              setSendingSms(true);
              try {
                const res = await fetch("/api/sms/send-report", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    studentId: student.id,
                    examId: latestExam.id,
                    rows: filledRows.map(r => ({ subjectId: r.subjectId, subject: r.subject, score: r.score, grade: r.grade, remarks: r.teacherComment || "" })),
                  }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || "Failed to send SMS");
                toast.success(data.message || "Report card SMS sent successfully");
              } catch (err: any) {
                toast.error(err.message || "Failed to send SMS");
              } finally {
                setSendingSms(false);
              }
            }}>
              <MessageSquare className="h-4 w-4 mr-1"/> {sendingSms ? "Sending..." : "Send SMS"}
            </Button>
          </div>
        }
      />

      <Card className="p-3 md:p-4 mb-4 no-print">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={activeCurriculum} onValueChange={(v) => { setActiveCurriculum(v as CurriculumId); setClassId(""); setStreamId(""); setStudentId(""); }}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Curriculum"/></SelectTrigger>
            <SelectContent>
              {curricula.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {activeCurriculum === "844" && state.students.filter(s => s.curriculumId === "844").length === 0 && (
            <Button size="sm" variant="outline" onClick={loadSample844Data}>
              <Download className="h-4 w-4 mr-1"/>Load Sample 8.4.4 Data
            </Button>
          )}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search student by name or admission no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
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
            <SelectContent>{filteredStudents.map(s => <SelectItem key={s.id} value={s.id}>{s.name} — {s.admissionNo}</SelectItem>)}</SelectContent>
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
            <div className="px-6 py-5 text-white">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded bg-white/20 flex items-center justify-center text-white font-bold text-xs border border-white/30 overflow-hidden">
                  <img src="/school_logo.jpg" alt="School logo" className="h-full w-full object-contain" />
                </div>
                  <div>
                    <div className="font-bold text-xl md:text-2xl leading-tight">{state.settings.schoolName || "HIGHWAY SECONDARY SCHOOL"}</div>
                    <div className="text-sm text-white/90 leading-tight mt-1">{state.settings.address || "P.O BOX 1234, NAIROBI"}</div>
                    <div className="text-sm text-white/90 mt-1">PHONE: +254 700 000 000 | EMAIL: info@school.ac.ke</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold uppercase tracking-wide text-white/90">Academic Report Form</div>
                  <div className="text-lg font-bold">{cls?.name || "FORM"} — END OF TERM EXAMS</div>
                  <div className="text-base">({latestExam.year} — TERM {latestExam.term})</div>
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
            <Field label="Religion" value={(student as any).religion || ""} disabled={!canManageStudents}
              onChange={(v) => update(s => { const x = s.students.find(x => x.id === student.id); if (x) (x as any).religion = v; })}/>
            <Field label="Date of Birth" value={(student as any).dateOfBirth || ""} disabled={!canManageStudents}
              onChange={(v) => update(s => { const x = s.students.find(x => x.id === student.id); if (x) (x as any).dateOfBirth = v; })}/>
            <Field label="Adm. Date" value={(student as any).dateOfAdmission || ""} disabled={!canManageStudents}
              onChange={(v) => update(s => { const x = s.students.find(x => x.id === student.id); if (x) (x as any).dateOfAdmission = v; })}/>
            <Field label="House" value={(student as any).house || ""} disabled={!canManageStudents}
              onChange={(v) => update(s => { const x = s.students.find(x => x.id === student.id); if (x) (x as any).house = v; })}/>
            <Field label="Grade Entry" value={(student as any).gradeEntryType || ""} disabled={!canManageStudents}
              onChange={(v) => update(s => { const x = s.students.find(x => x.id === student.id); if (x) (x as any).gradeEntryType = v; })}/>
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
