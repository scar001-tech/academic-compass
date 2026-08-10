import { Router } from "express";
import { authenticateJWT, requireRoles } from "./auth";
import { getStore } from "../lib/store";
import { SmsConfig, SmsResult, sendSms } from "../lib/smsService";
import { generateStudentReportPdf } from "../lib/reportPdf";

const router = Router();

router.post("/send-report", authenticateJWT, requireRoles("admin", "principal", "senior_teacher"), async (req: any, res) => {
  try {
    const { studentId, examId, rows } = req.body || {};
    if (!studentId || !examId || !Array.isArray(rows)) {
      return res.status(400).json({ message: "studentId, examId and rows are required" });
    }

    const store = await getStore();
    const snapshot = await store.getSchoolSnapshot();
    if (!snapshot) return res.status(400).json({ message: "School data not initialized" });
    const schoolData = JSON.parse(snapshot.data) as any;

    const student = (schoolData.students || []).find((s: any) => s.id === studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const exam = (schoolData.exams || []).find((e: any) => e.id === examId);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const parentNumber = (student.parentNumber || "").trim();
    if (!parentNumber) {
      return res.status(400).json({ message: "Student has no parent phone number" });
    }

    const enrichedRows = rows.map((r: any) => {
      const subject = (schoolData.subjects || []).find((s: any) => s.id === r.subjectId);
      return {
        subjectId: r.subjectId,
        subject: r.subject || subject?.name || "",
        score: r.score ?? null,
        grade: r.grade || "",
        remarks: r.remarks || r.teacherComment || "",
        teacherName: "",
      };
    });

    const scores = enrichedRows.map(r => r.score).filter((s: any) => typeof s === "number") as number[];
    const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const stats = {
      mean,
      overallGrade: mean >= 80 ? "A" : mean >= 60 ? "B" : mean >= 40 ? "C" : "D",
      streamPosition: "—",
      totalPoints: 0,
    };

    const classTeacher = (schoolData.teachers || []).find((t: any) => t.id === (schoolData.classes || []).find((c: any) => c.id === student.classId)?.classTeacherId);

    const termExams = (schoolData.exams || [])
      .filter((e: any) => e.curriculumId === student.curriculumId && e.status !== "draft")
      .sort((a: any, b: any) => a.year - b.year || a.term - b.term);

    const termStats: any[] = [];
    termExams.forEach((ex: any) => {
      const sheet = (schoolData.sheets || []).find((s: any) => s.examId === ex.id && s.subjectId === enrichedRows[0]?.subjectId && s.streamId === student.streamId);
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

    const pdfBlob = generateStudentReportPdf(student, exam, enrichedRows, stats, classTeacher, "", termStats);

    const config = {
      provider: (process.env.SMS_PROVIDER || "custom") as SmsConfig["provider"],
      apiKey: process.env.SMS_API_KEY,
      username: process.env.SMS_USERNAME,
      senderId: process.env.SMS_SENDER_ID || "0704921291",
      accountSid: process.env.SMS_ACCOUNT_SID,
      authToken: process.env.SMS_AUTH_TOKEN,
      from: process.env.SMS_FROM || "0704921291",
      baseUrl: process.env.SMS_BASE_URL,
    };

    const message = `Dear Parent, ${student.name} (${student.admissionNo}) scored ${stats.overallGrade} in ${exam.name} Term ${exam.term} ${exam.year}. Mean: ${stats.mean.toFixed(1)}.`;

    let result: SmsResult = { success: false, error: "No SMS provider configured" };
    if (config.baseUrl || config.apiKey || config.accountSid) {
      result = await sendSms(config, {
        to: parentNumber,
        body: message,
        mediaUrl: "data:application/pdf;base64," + Buffer.from(await pdfBlob.arrayBuffer()).toString("base64"),
      });
    }

    await store.createSmsLog({
      studentId: student.id,
      admissionNo: student.admissionNo,
      studentName: student.name,
      parentNumber,
      examId: exam.id,
      examName: exam.name,
      provider: config.provider,
      status: result.success ? "sent" : "failed",
      messageId: result.messageId || null,
      error: result.error || null,
    });

    if (!result.success) {
      return res.status(500).json({ message: result.error || "Failed to send SMS" });
    }

    return res.json({ message: "Report card SMS sent successfully", messageId: result.messageId });
  } catch (err) {
    console.error("[sms send-report]", err);
    return res.status(500).json({ message: "Internal server error" });
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
