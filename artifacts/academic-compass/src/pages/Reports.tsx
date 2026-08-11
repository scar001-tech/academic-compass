import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useSchool } from "@/store/school";
import { useAuth } from "@/store/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { statsForStudentExam, statsForStudentAllTerms, type CurriculumId, type ID } from "@/lib/schoolData";
import { Printer, ChevronLeft, ChevronRight, Search, Download, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import ReportCard from "@/components/ReportCard";

export default function Reports() {
  const { state, activeCurriculum, setActiveCurriculum, update } = useSchool();
  const { isPrincipal, canManageStudents, isTeacher, isSeniorTeacher } = useAuth();
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

  const multiTermStats = student ? statsForStudentAllTerms(state, student.id) : null;

  const navigate = (dir: -1 | 1) => {
    const idx  = filteredStudents.findIndex(s => s.id === studentId);
    const next = filteredStudents[(idx + dir + filteredStudents.length) % filteredStudents.length];
    if (next) setStudentId(next.id);
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
                principalName: "",
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
                    termStats: multiTermStats ? multiTermStats.rows.map(r => ({
                      subjectId: r.subjectId,
                      subject: r.subject,
                      terms: r.terms.map(t => ({ examId: t.examId, term: t.term, year: t.year, score: t.score, grade: t.grade, rank: t.rank, total: t.total, deviation: t.deviation })),
                    })) : [],
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
          {(activeCurriculum === "844" || classes.some(c => c.name.includes("Form"))) && (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => {
                const form3 = classes.find(c => c.name.toLowerCase().includes("form 3") || c.name.toLowerCase().includes("form3"));
                if (form3) { setClassId(form3.id); setStreamId(""); }
              }}>Form 3</Button>
              <Button size="sm" variant="outline" onClick={() => {
                const form4 = classes.find(c => c.name.toLowerCase().includes("form 4") || c.name.toLowerCase().includes("form4"));
                if (form4) { setClassId(form4.id); setStreamId(""); }
              }}>Form 4</Button>
            </div>
          )}
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

      {!student ? (
        <Card className="p-8 text-center text-muted-foreground">
          <div className="text-lg font-semibold mb-2">Select a student to view report card</div>
          <div className="text-sm">Choose a curriculum, class/grade, and student from the filters above.</div>
        </Card>
      ) : !latestExam ? (
        <Card className="p-8 text-center text-muted-foreground">
          <div className="text-lg font-semibold mb-2">No exam data available</div>
          <div className="text-sm">Create an exam and enter marks to generate report cards.</div>
        </Card>
      ) : (
        <ReportCard studentId={studentId} activeCurriculum={activeCurriculum} />
      )}
    </div>
  );
}
