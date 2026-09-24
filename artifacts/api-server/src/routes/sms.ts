import { Router } from "express";
import { authenticateJWT, requireRoles } from "./auth";
import { getStore } from "../lib/store";
import { SmsConfig, SmsResult, sendSms } from "../lib/smsService";
import { generateStudentReportPdf } from "../lib/reportPdf";

const router = Router();

router.post("/send-report", authenticateJWT, requireRoles("admin", "principal", "senior_teacher"), async (req: any, res) => {
  try {
    const { studentId, examId, rows, parentNumber: requestParentNumber, student: requestStudent, exam: requestExam, streamPosition: requestStreamPosition, overallPosition: requestOverallPosition } = req.body || {};
    if (!studentId || !examId || !Array.isArray(rows)) {
      return res.status(400).json({ message: "studentId, examId and rows are required" });
    }

    const store = await getStore();
    const snapshot = await store.getSchoolSnapshot();
    const schoolData = snapshot ? JSON.parse(snapshot.data) as any : {};

    const student = (schoolData.students || []).find((s: any) => s.id === studentId) || requestStudent;
    if (!student) return res.status(404).json({ message: "Student not found" });

    const exam = (schoolData.exams || []).find((e: any) => e.id === examId) || requestExam;
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const parentNumber = (requestParentNumber || student.parentNumber || student.guardianPhone || "").trim();
    if (!parentNumber) {
      return res.status(400).json({ message: "Student has no parent phone number" });
    }

    const curriculum = (schoolData.curricula || []).find((c: any) => c.id === student.curriculumId);
    const gradeForScore = (score: number | null) => {
      if (score == null) return "—";
      return curriculum?.gradingScale?.find((band: any) => score >= band.min && score <= band.max)?.grade || "—";
    };
    const examSheets = (schoolData.sheets || []).filter((sheet: any) => sheet.examId === exam.id);
    const entries = schoolData.entries || [];
    const subjects = schoolData.subjects || [];
    const rowsForStudent = (target: any) => {
      const targetSheets = examSheets.filter((sheet: any) => sheet.streamId === target.streamId);
      return targetSheets.map((sheet: any) => {
        const subject = subjects.find((item: any) => item.id === sheet.subjectId);
        const entry = entries.find((item: any) => item.sheetId === sheet.id && item.studentId === target.id);
        return {
          subjectId: sheet.subjectId,
          subject: subject?.name || "",
          score: typeof entry?.score === "number" ? entry.score : null,
          grade: entry?.overrideGrade || gradeForScore(entry?.score ?? null),
          remarks: sheet.teacherComment || "",
          teacherName: "",
        };
      }).filter((row: any) => row.score != null);
    };
    const requestedRows = rows.map((r: any) => {
      const subject = subjects.find((item: any) => item.id === r.subjectId);
      const score = typeof r.score === "number" ? r.score : null;
      return {
        subjectId: r.subjectId,
        subject: r.subject || subject?.name || "",
        score,
        grade: r.grade || gradeForScore(score),
        remarks: r.remarks || r.teacherComment || "",
        teacherName: "",
      };
    }).filter((row: any) => row.score != null);
    const enrichedRows = rowsForStudent(student);
    const reportRows = enrichedRows.length ? enrichedRows : requestedRows;
    const scores = reportRows.map((row: any) => row.score) as number[];
    const mean = scores.length ? scores.reduce((total, score) => total + score, 0) / scores.length : 0;
    const meanForStudent = (target: any) => {
      const targetScores = rowsForStudent(target).map((row: any) => row.score) as number[];
      return targetScores.length ? targetScores.reduce((total, score) => total + score, 0) / targetScores.length : null;
    };
    const rankedStudents = (schoolData.students || [])
      .filter((target: any) => target.curriculumId === student.curriculumId)
      .map((target: any) => ({ student: target, mean: meanForStudent(target) }))
      .filter((item: any) => item.mean != null)
      .sort((a: any, b: any) => b.mean - a.mean);
    const streamScores = rankedStudents.filter((item: any) => item.student.streamId === student.streamId);
    const classScores = rankedStudents.filter((item: any) => item.student.classId === student.classId);
    const findPosition = (ranked: any[]) => {
      const position = ranked.findIndex((item: any) => item.student.id === student.id);
      return position >= 0 ? position + 1 : 0;
    };
    const totalPoints = reportRows.reduce((total: number, row: any) => {
      const gradeBand = curriculum?.gradingScale?.find((band: any) => band.grade === row.grade);
      return total + (gradeBand?.points || 0);
    }, 0);
    const stats = {
      mean: Math.round(mean * 10) / 10,
      overallGrade: gradeForScore(mean),
      streamPosition: requestStreamPosition?.rank ? `${requestStreamPosition.rank}/${requestStreamPosition.total}` : (findPosition(streamScores) || "—"),
      overallPosition: requestOverallPosition?.rank ? `${requestOverallPosition.rank}/${requestOverallPosition.total}` : (findPosition(classScores) || "—"),
      totalPoints,
    };

    const classTeacher = (schoolData.teachers || []).find((t: any) => t.id === (schoolData.classes || []).find((c: any) => c.id === student.classId)?.classTeacherId);

    const termExams = (schoolData.exams || [])
      .filter((e: any) => e.curriculumId === student.curriculumId && e.status !== "draft")
      .sort((a: any, b: any) => a.year - b.year || a.term - b.term);

    const termStats: any[] = [];
    termExams.forEach((ex: any) => {
      const sheet = (schoolData.sheets || []).find((s: any) => s.examId === ex.id && s.subjectId === reportRows[0]?.subjectId && s.streamId === student.streamId);
      if (!sheet) return;
      const entry = (schoolData.entries || []).find((e: any) => e.sheetId === sheet.id && e.studentId === student.id);
      const allEntries = (schoolData.entries || []).filter((e: any) => e.sheetId === sheet.id && e.score != null);
      const sorted = [...allEntries].sort((a: any, b: any) => (b.score - a.score));
      const score = entry?.score ?? null;
      const rank = score != null ? sorted.findIndex((e: any) => e.studentId === student.id) + 1 : 0;
      const mean = sorted.length ? sorted.reduce((a: any, b: any) => a + (b.score ?? 0), 0) / sorted.length : 0;
      const deviation = score != null ? Math.round((score - mean) * 10) / 10 : 0;
      const curriculum = schoolData.curricula?.find((c: any) => c.id === student.curriculumId);
      const grade = score != null ? (curriculum?.gradingScale?.find((g: any) => score >= g.min && score <= g.max)?.grade || "—") : "—";
      termStats.push({ examId: ex.id, term: ex.term, year: ex.year, score, grade, rank, total: sorted.length, deviation });
    });

    const pdfBlob = generateStudentReportPdf(student, exam, reportRows, stats, classTeacher, "", termStats);

    const config = {
      provider: "safravo" as SmsConfig["provider"],
      apiKey: process.env.SMS_API_KEY,
      partnerId: process.env.SMS_PARTNER_ID || "17068",
      senderId: "DrumvaleSec",
      baseUrl: "https://api.safravo.co.ke",
    };

    const subjectBreakdown = reportRows
      .filter((r: any) => r.score != null)
      .map((r: any) => `${r.subject}: ${r.score} (${r.grade})`)
      .join("\n");

    const message = `Dear Parent/Guardian,
${exam.name} Report Card for ${student.name}:
${subjectBreakdown}
Summary: Total Points Attained: ${stats.totalPoints} | Mean Grade: ${stats.overallGrade}
Drumvale Secondary`;

    let result: SmsResult = { success: false, error: "No SMS provider configured" };
    if (config.baseUrl || config.apiKey) {
      result = await sendSms(config, {
        to: parentNumber,
        body: message,
        mediaUrl: "data:application/pdf;base64," + Buffer.from(await pdfBlob.arrayBuffer()).toString("base64"),
      });
    }

    try {
      await store.createSmsLog({
        studentId: student.id,
        admissionNo: student.admissionNo || "",
        studentName: student.name || "",
        parentNumber,
        examId: exam.id,
        examName: exam.name || "",
        provider: config.provider,
        status: result.success ? "sent" : "failed",
        messageId: result.messageId || null,
        error: result.error || null,
      });
    } catch (logError) {
      console.error("[sms log failed]", logError);
    }

    if (!result.success) {
      return res.status(500).json({ message: result.error || "Failed to send SMS" });
    }

    return res.json({ message: "Report card SMS sent successfully", messageId: result.messageId });
  } catch (err) {
    console.error("[sms send-report]", err);
    return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.get("/logs", authenticateJWT, requireRoles("admin", "principal", "senior_teacher"), async (_req: any, res) => {
  try {
    const logs = await (await getStore()).listSmsLogs();
    return res.json(logs);
  } catch (err) {
    console.error("[sms logs]", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
