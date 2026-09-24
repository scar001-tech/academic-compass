// Core data model for Scholaris academic performance app.
// Persisted to localStorage. Two curricula are separate top-level entities.

export type ID = string;

/** School departments — chosen at sign-up so the Principal can review role requests faster. */
export const DEPARTMENTS = [
  "Mathematics",
  "Languages (English & Kiswahili)",
  "Sciences",
  "Humanities & Social Studies",
  "Technical & Applied Sciences",
  "Creative Arts & Sports",
  "ICT / Computer Studies",
  "Religious Education",
  "Administration",
] as const;

export type Department = typeof DEPARTMENTS[number];

export type CurriculumId = "cbc" | "844";

export interface Curriculum {
  id: CurriculumId;
  name: string;
  shortName: string;
  description: string;
  gradingScale: GradeBand[];
}

export interface GradeBand {
  grade: string; // e.g. "A", "EE1"
  min: number;
  max: number;
  points: number;
  remark: string;
}

export interface SchoolClass {
  id: ID;
  curriculumId: CurriculumId;
  name: string; // "Grade 7" or "Form 3"
  classTeacherId?: ID;
}

export interface Stream {
  id: ID;
  classId: ID;
  name: string; // "Blue", "West"
}

export interface Subject {
  id: ID;
  curriculumId: CurriculumId;
  name: string;
  code: string;
  teacherId?: ID;
}

export interface Teacher {
  id: ID;
  name: string;
  email: string;
  phone?: string;
  role: "class_teacher" | "subject_teacher" | "principal" | "admin";
  curriculumIds: CurriculumId[];
}

export interface Student {
  id: ID;
  curriculumId: CurriculumId;
  admissionNo: string;
  name: string;
  gender: "M" | "F";
  classId: ID;
  streamId: ID;
  vap: string; // Values-Attitudes-Personality note
  guardianPhone?: string;
  feeBalance?: number;
  religion?: string;
  dateOfAdmission?: string;
  house?: string;
  gradeEntryType?: string;
  dateOfBirth?: string;
  parentName?: string;
  parentNumber?: string;
  parentIdNumber?: string;
}

export interface Exam {
  id: ID;
  curriculumId: CurriculumId;
  name: string; // "Opener", "Midterm", "End Term"
  term: 1 | 2 | 3;
  year: number;
  outOf: number; // usually 100
  status: "draft" | "open" | "closed";
}

export type SheetStatus = "draft" | "submitted" | "approved" | "published";

export interface MarkSheet {
  id: ID;
  curriculumId: CurriculumId;
  classId: ID;
  streamId: ID;
  subjectId: ID;
  examId: ID;
  teacherId?: ID;
  teacherComment?: string;
  status: SheetStatus;
  locked: boolean;
  updatedAt: number;
}

export interface MarkEntry {
  id: ID;
  sheetId: ID;
  studentId: ID;
  score: number | null;
  overrideGrade?: string;
  updatedAt: number;
  updatedBy: string; // device name
  version?: number;  // optimistic locking version
  pending?: boolean; // offline pending sync
}


export interface ClassTeacherRemark {
  studentId: ID;
  examId: ID;
  remark: string;
  teacherName: string;
  updatedAt: number;
}

export interface PrincipalRemark {
  studentId: ID;
  examId: ID;
  remark: string;
  principalName: string;
  updatedAt: number;
}

export interface SyncConflict {
  id: ID;
  entity: "mark" | "comment" | "remark" | "student";
  studentId?: ID;
  subjectId?: ID;
  examId?: ID;
  field: string;
  serverValue: string;
  thisDeviceValue: string;
  otherDeviceValue?: string;
  editedBy: string;
  deviceName: string;
  otherDeviceName?: string;
  timestamp: number;
  status: "pending" | "resolved";
  resolution?: "server" | "this" | "other" | "custom";
  customValue?: string;
}

export interface TimetableSlot {
  id: ID;
  curriculumId: CurriculumId;
  classId: ID;
  streamId?: ID;
  dayOfWeek: number; // 0 = Monday … 4 = Friday
  period: number;
  startTime?: string;
  endTime?: string;
  subjectId?: ID;
  teacherId?: ID;
  room?: string;
  version?: number;
  updatedAt?: number;
  updatedBy?: string;
  pending?: boolean;
}

export interface SchoolSettings {
  schoolName: string;
  motto: string;
  address: string;
  academicYear: number;
  classTeacherRemarkTemplate: string;
  principalRemarkTemplate: string;
  logoUrl?: string;
}

export interface AppState {
  settings: SchoolSettings;
  curricula: Curriculum[];
  classes: SchoolClass[];
  streams: Stream[];
  subjects: Subject[];
  teachers: Teacher[];
  students: Student[];
  exams: Exam[];
  sheets: MarkSheet[];
  entries: MarkEntry[];
  classRemarks: ClassTeacherRemark[];
  principalRemarks: PrincipalRemark[];
  conflicts: SyncConflict[];
  timetable: TimetableSlot[];
  online: boolean;
  deviceName: string;
  syncQueue: string[]; // entry ids awaiting sync
  deletedIds: string[];
  lastSyncAt: number | null;
}

// ---------- Grading ----------

const cbcScale: GradeBand[] = [
  { grade: "EE1", min: 90, max: 100, points: 12, remark: "Exceeding Expectation" },
  { grade: "EE2", min: 76, max: 89, points: 11, remark: "Exceeding Expectation" },
  { grade: "ME1", min: 58, max: 75, points: 9, remark: "Meeting Expectation" },
  { grade: "ME2", min: 41, max: 57, points: 7, remark: "Meeting Expectation" },
  { grade: "AE1", min: 31, max: 40, points: 5, remark: "Approaching Expectation" },
  { grade: "AE2", min: 21, max: 30, points: 3, remark: "Approaching Expectation" },
  { grade: "BE", min: 0, max: 20, points: 1, remark: "Below Expectation" },
];

const kcseScale: GradeBand[] = [
  { grade: "A", min: 80, max: 100, points: 12, remark: "Excellent" },
  { grade: "A-", min: 75, max: 79, points: 11, remark: "Very Good" },
  { grade: "B+", min: 70, max: 74, points: 10, remark: "Very Good" },
  { grade: "B", min: 65, max: 69, points: 9, remark: "Good" },
  { grade: "B-", min: 60, max: 64, points: 8, remark: "Good" },
  { grade: "C+", min: 55, max: 59, points: 7, remark: "Above Average" },
  { grade: "C", min: 50, max: 54, points: 6, remark: "Average" },
  { grade: "C-", min: 45, max: 49, points: 5, remark: "Average" },
  { grade: "D+", min: 40, max: 44, points: 4, remark: "Below Average" },
  { grade: "D", min: 35, max: 39, points: 3, remark: "Weak" },
  { grade: "D-", min: 30, max: 34, points: 2, remark: "Weak" },
  { grade: "E", min: 0, max: 29, points: 1, remark: "Very Weak" },
];

export function gradeFor(score: number | null | undefined, scale: GradeBand[]): GradeBand | null {
  if (score == null || isNaN(score)) return null;
  return scale.find((b) => score >= b.min && score <= b.max) ?? null;
}

export function createMarkSheetsForExam(state: AppState, exam: Exam): { sheets: MarkSheet[]; entries: MarkEntry[] } {
  const sheets: MarkSheet[] = [];
  const entries: MarkEntry[] = [];
  const now = Date.now();

  const curriculumSubjects = state.subjects.filter(s => s.curriculumId === exam.curriculumId);
  const curriculumStreams = state.streams.filter(str => {
    const cls = state.classes.find(c => c.id === str.classId);
    return cls?.curriculumId === exam.curriculumId;
  });
  const curriculumStudents = state.students.filter(s => s.curriculumId === exam.curriculumId);

  curriculumStreams.forEach((stream) => {
    const cls = state.classes.find(c => c.id === stream.classId);
    if (!cls) return;
    curriculumSubjects.forEach((subject) => {
      const sheetId = `sh_${exam.id}_${stream.id}_${subject.id}`;
      sheets.push({
        id: sheetId,
        curriculumId: exam.curriculumId,
        classId: cls.id,
        streamId: stream.id,
        subjectId: subject.id,
        examId: exam.id,
        teacherId: subject.teacherId,
        status: "draft",
        locked: false,
        updatedAt: now,
      });

      const streamStudents = curriculumStudents.filter(s => s.streamId === stream.id);
      streamStudents.forEach((stu) => {
        entries.push({
          id: `e_${sheetId}_${stu.id}`,
          sheetId,
          studentId: stu.id,
          score: null,
          updatedAt: now,
          updatedBy: state.deviceName,
        });
      });
    });
  });

  return { sheets, entries };
}

// ---------- Seed ----------

const uid = (p: string, i: number) => `${p}_${i}`;

function seed(): AppState {
  const now = Date.now();
  return {
    settings: {
      schoolName: "",
      motto: "",
      address: "",
      academicYear: new Date().getFullYear(),
      classTeacherRemarkTemplate: "",
      principalRemarkTemplate: "",
      logoUrl: "",
    },
    curricula: [
      { id: "cbc", name: "CBC / Junior School", shortName: "CBC", description: "Competency-Based Curriculum", gradingScale: cbcScale },
      { id: "844", name: "8-4-4 / Senior School", shortName: "8-4-4", description: "KCSE senior school curriculum", gradingScale: kcseScale },
    ],
    classes: [],
    streams: [],
    subjects: [],
    teachers: [],
    students: [],
    exams: [],
    sheets: [],
    entries: [],
    classRemarks: [],
    principalRemarks: [],
    conflicts: [],
    timetable: [],
    online: true,
    deviceName: "This Device",
    syncQueue: [],
    deletedIds: [],
    lastSyncAt: now,
  };
}

// deterministic RNG
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KEY = "scholaris_v1";
const EMPTY_PRODUCTION_DATA = import.meta.env.VITE_EMPTY_PRODUCTION_DATA === "true";

function emptyState(): AppState {
  const now = Date.now();
  return {
    settings: {
      schoolName: "",
      motto: "",
      address: "",
      academicYear: new Date().getFullYear(),
      classTeacherRemarkTemplate: "",
      principalRemarkTemplate: "",
      logoUrl: "",
    },
    curricula: [
      { id: "cbc", name: "CBC / Junior School", shortName: "CBC", description: "Competency-Based Curriculum", gradingScale: cbcScale },
      { id: "844", name: "8-4-4 / Senior School", shortName: "8-4-4", description: "KCSE senior school curriculum", gradingScale: kcseScale },
    ],
    classes: [],
    streams: [],
    subjects: [],
    teachers: [],
    students: [],
    exams: [],
    sheets: [],
    entries: [],
    classRemarks: [],
    principalRemarks: [],
    conflicts: [],
    timetable: [],
    online: true,
    deviceName: "This Device",
    syncQueue: [],
    deletedIds: [],
    lastSyncAt: now,
  };
}

function initialState(): AppState {
  return EMPTY_PRODUCTION_DATA ? emptyState() : seed();
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed as AppState;
      }
    }
  } catch (err) {
    console.warn("[loadState] failed to load state, resetting", err);
  }
  const s = initialState();
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
  return s;
}

export function saveState(s: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (err) {
    console.warn("[saveState] first save failed, trying trimmed state", err);
    try {
      const trimmed = trimStateForStorage(s);
      localStorage.setItem(KEY, JSON.stringify(trimmed));
    } catch (trimErr) {
      console.warn("[saveState] trimmed save failed, saving minimal state", trimErr);
      try {
        const minimal = minimalState(s);
        localStorage.setItem(KEY, JSON.stringify(minimal));
      } catch (minErr) {
        console.error("[saveState] unable to save state to localStorage", minErr);
      }
    }
  }
}

function trimStateForStorage(s: AppState): AppState {
  const trimmed = structuredClone(s);
  trimmed.conflicts = trimmed.conflicts.filter(c => c.status === "pending");
  const pendingEntryIds = new Set(trimmed.entries.filter(e => e.pending).map(e => e.id));
  trimmed.entries = trimmed.entries.filter(e => e.pending || pendingEntryIds.size === 0);
  if (trimmed.entries.length > 500) {
    trimmed.entries = trimmed.entries.filter(e => e.pending).slice(-500);
  }
  return trimmed;
}

function minimalState(s: AppState): AppState {
  const minimal = structuredClone(s);
  minimal.entries = minimal.entries.filter(e => e.pending).slice(-200);
  minimal.conflicts = minimal.conflicts.filter(c => c.status === "pending").slice(-100);
  return minimal;
}

export function resetState(): AppState {
  const s = initialState();
  saveState(s);
  return s;
}

// ---------- Derived helpers ----------

export interface StudentSubjectStat {
  subjectId: ID;
  subject: string;
  score: number | null;
  grade: string;
  rank: number;
  total: number;
  deviation: number; // vs stream mean
  teacherComment: string;
  teacherName: string;
  entryId: ID;
}

export function statsForStudentExam(
  state: AppState, studentId: ID, examId: ID,
): { rows: StudentSubjectStat[]; mean: number; totalPoints: number; overallGrade: string } {
  const student = state.students.find(s => s.id === studentId)!;
  const exam = state.exams.find(e => e.id === examId)!;
  const curriculum = state.curricula.find(c => c.id === student.curriculumId)!;
  const subjectSheets = state.sheets.filter(
    sh => sh.examId === examId && sh.streamId === student.streamId
  );
  const rows: StudentSubjectStat[] = [];
  subjectSheets.forEach((sh) => {
    const sub = state.subjects.find(s => s.id === sh.subjectId);
    if (!sub) return;
    const allEntries = state.entries.filter(e => e.sheetId === sh.id && e.score != null);
    const sorted = [...allEntries].sort((a, b) => (b.score! - a.score!));
    const mine = state.entries.find(e => e.sheetId === sh.id && e.studentId === studentId);
    const score = mine?.score ?? null;
    const rank = score != null ? sorted.findIndex(e => e.studentId === studentId) + 1 : 0;
    const mean = sorted.length ? sorted.reduce((a, b) => a + (b.score ?? 0), 0) / sorted.length : 0;
    const gb = gradeFor(score, curriculum.gradingScale);
    const teacher = state.teachers.find(t => t.id === sh.teacherId);
    rows.push({
      subjectId: sub.id, subject: sub.name, score,
      grade: mine?.overrideGrade || gb?.grade || "—",
      rank, total: sorted.length,
      deviation: score != null ? Math.round((score - mean) * 10) / 10 : 0,
      teacherComment: sh.teacherComment || "",
      teacherName: teacher?.name ?? "",
      entryId: mine?.id || "",
    });
  });
  const validRows = rows.filter(r => r.score != null);
  const mean = validRows.length ? validRows.reduce((a, r) => a + (r.score ?? 0), 0) / validRows.length : 0;
  const totalPoints = validRows.reduce((a, r) => a + (gradeFor(r.score, curriculum.gradingScale)?.points || 0), 0);
  const overallGrade = gradeFor(mean, curriculum.gradingScale)?.grade || "—";
  return { rows: validRows, mean: Math.round(mean * 10) / 10, totalPoints, overallGrade };
}

export interface TermSubjectStat {
  subjectId: ID;
  subject: string;
  terms: Array<{
    examId: ID;
    term: number;
    year: number;
    score: number | null;
    grade: string;
    rank: number;
    total: number;
    deviation: number;
  }>;
}

export function statsForStudentAllTerms(
  state: AppState, studentId: ID, selectedTerm?: number, maxExams: number = 2,
): { rows: TermSubjectStat[]; terms: Array<{ examId: ID; term: number; year: number; name: string }> } {
  const student = state.students.find(s => s.id === studentId)!;
  const curriculum = state.curricula.find(c => c.id === student.curriculumId)!;
  const exams = state.exams
    .filter(e => e.curriculumId === student.curriculumId && e.status !== "draft")
    .filter(e => selectedTerm === undefined || e.term === selectedTerm)
    .sort((a, b) => a.year - b.year || a.term - b.term);
  const subjects = state.subjects.filter(s => s.curriculumId === student.curriculumId);
  const termList = exams.map(e => ({ examId: e.id, term: e.term, year: e.year, name: e.name }));
  const rows: TermSubjectStat[] = [];

  const lastTwoExams = maxExams >= 999 ? exams.slice(-2) : exams.slice(0, maxExams);
  const currentExam = lastTwoExams[lastTwoExams.length - 1];
  const previousExam = lastTwoExams.length >= 2 ? lastTwoExams[0] : null;

  subjects.forEach((sub) => {
    const terms: TermSubjectStat["terms"] = [];
    if (previousExam) {
      const sheet = state.sheets.find(s => s.examId === previousExam.id && s.subjectId === sub.id && s.streamId === student.streamId);
      if (sheet) {
        const entry = state.entries.find(e => e.sheetId === sheet.id && e.studentId === studentId);
        const score = entry?.score ?? null;
        const gb = gradeFor(score, curriculum.gradingScale);
        const grade = entry?.overrideGrade || gb?.grade || "—";
        const allEntries = state.entries.filter(e => e.sheetId === sheet.id && e.score != null);
        const sorted = [...allEntries].sort((a, b) => (b.score! - a.score!));
        const rank = score != null ? sorted.findIndex(e => e.studentId === studentId) + 1 : 0;
        const mean = sorted.length ? sorted.reduce((a, b) => a + (b.score ?? 0), 0) / sorted.length : 0;
        const deviation = score != null ? Math.round((score - mean) * 10) / 10 : 0;
        terms.push({ examId: previousExam.id, term: previousExam.term, year: previousExam.year, score, grade, rank, total: sorted.length, deviation });
      }
    }
    if (currentExam) {
      const sheet = state.sheets.find(s => s.examId === currentExam.id && s.subjectId === sub.id && s.streamId === student.streamId);
      if (sheet) {
        const entry = state.entries.find(e => e.sheetId === sheet.id && e.studentId === studentId);
        const score = entry?.score ?? null;
        const gb = gradeFor(score, curriculum.gradingScale);
        const grade = entry?.overrideGrade || gb?.grade || "—";
        const allEntries = state.entries.filter(e => e.sheetId === sheet.id && e.score != null);
        const sorted = [...allEntries].sort((a, b) => (b.score! - a.score!));
        const rank = score != null ? sorted.findIndex(e => e.studentId === studentId) + 1 : 0;
        const mean = sorted.length ? sorted.reduce((a, b) => a + (b.score ?? 0), 0) / sorted.length : 0;
        const deviation = score != null ? Math.round((score - mean) * 10) / 10 : 0;
        terms.push({ examId: currentExam.id, term: currentExam.term, year: currentExam.year, score, grade, rank, total: sorted.length, deviation });
      }
    }
    if (terms.length) {
      rows.push({ subjectId: sub.id, subject: sub.name, terms });
    }
  });

  const displayTerms = [];
  if (previousExam) {
    displayTerms.push({ examId: previousExam.id, term: previousExam.term, year: previousExam.year, name: "Opener Exam" });
  }
  if (currentExam) {
    const pos = exams.findIndex(e => e.id === currentExam.id);
    const label = pos === 0 ? "Opener Exam" : pos === 1 ? "Mid-term Exam" : pos === 2 ? "End-term Exam" : `Exam ${pos + 1}`;
    displayTerms.push({ examId: currentExam.id, term: currentExam.term, year: currentExam.year, name: label });
  }

  return { rows, terms: displayTerms.slice(-maxExams) };
}

export function identifyWeakAreas(
  state: AppState, studentId: ID,
): { subject: string; latestScore: number; trend: "up" | "down" | "flat"; reason: string }[] {
  const student = state.students.find(s => s.id === studentId)!;
  const exams = state.exams
    .filter(e => e.curriculumId === student.curriculumId && e.status !== "draft")
    .sort((a, b) => a.year - b.year || a.term - b.term);
  const subs = state.subjects.filter(s => s.curriculumId === student.curriculumId);
  const out: { subject: string; latestScore: number; trend: "up"|"down"|"flat"; reason: string }[] = [];
  subs.forEach((sub) => {
    const seq: number[] = [];
    exams.forEach((ex) => {
      const sh = state.sheets.find(s => s.examId === ex.id && s.subjectId === sub.id && s.streamId === student.streamId);
      if (!sh) return;
      const e = state.entries.find(en => en.sheetId === sh.id && en.studentId === studentId);
      if (e?.score != null) seq.push(e.score);
    });
    if (!seq.length) return;
    const latest = seq[seq.length - 1];
    const first = seq[0];
    const trend: "up"|"down"|"flat" = seq.length < 2 ? "flat" : latest > first + 2 ? "up" : latest < first - 2 ? "down" : "flat";
    const reasons: string[] = [];
    if (latest < 50) reasons.push("Low mark");
    if (trend === "down") reasons.push("Downward trend");
    if (reasons.length) {
      out.push({ subject: sub.name, latestScore: latest, trend, reason: reasons.join(" · ") });
    }
  });
  return out;
}
