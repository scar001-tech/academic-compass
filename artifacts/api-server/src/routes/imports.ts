import { Router } from "express";
import { authenticateJWT, requireRoles } from "./auth";
import { z } from "zod";
import { getStore } from "../lib/store";

const router = Router();

const importRowSchema = z.object({
  admissionNo: z.string().min(1),
  score: z.number().min(0).max(100).nullable().optional(),
});

function validationError(error: z.ZodError) {
  return {
    message: "Invalid import data",
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}

router.post("/marks", authenticateJWT, requireRoles("admin", "principal", "senior_teacher", "teacher", "subject_teacher"), async (req: any, res) => {
  try {
    const body = req.body;
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    const { sheetId, curriculumId } = body || {};
    if (!sheetId || !curriculumId) {
      return res.status(400).json({ message: "sheetId and curriculumId are required" });
    }

    const store = await getStore();
    const snapshot = await store.getSchoolSnapshot();
    if (!snapshot) return res.status(400).json({ message: "School data not initialized" });
    const schoolData = JSON.parse(snapshot.data) as any;

    const sheet = (schoolData.sheets || []).find((s: any) => s.id === sheetId) as any;
    if (!sheet) return res.status(404).json({ message: "Mark sheet not found" });

    const allStudents = schoolData.students || [];
    const studentsByAdm = new Map(allStudents.map((s: any) => [String(s.admissionNo).trim().toLowerCase(), s]));
    const studentsById = new Map(allStudents.map((s: any) => [String(s.id).trim().toLowerCase(), s]));
    const studentsByName = new Map(allStudents.map((s: any) => [String(s.name).trim().toLowerCase(), s]));
    const errors: Array<{ admissionNo: string; error: string }> = [];
    const entriesToUpsert: Parameters<typeof store.upsertMarkEntries>[0] = [];

    const normalizeAdmission = (value: string) => String(value).trim().toLowerCase().replace(/[\s.\-\/()]/g, "");

    const matchStudent = (admissionNo: string, rawRow: any): any => {
      const exactAdm = String(admissionNo).trim().toLowerCase();
      const normalizedAdm = normalizeAdmission(admissionNo);

      let student = studentsByAdm.get(exactAdm) || studentsById.get(exactAdm);
      if (student) return student;

      for (const [key, s] of studentsByAdm.entries() as Iterable<[string, any]>) {
        if (normalizeAdmission(key) === normalizedAdm) return s;
      }

      const numericPart = admissionNo.replace(/[^0-9]/g, "").trim();
      if (numericPart) {
        for (const [key, s] of studentsByAdm.entries() as Iterable<[string, any]>) {
          const keyNumeric = key.replace(/[^0-9]/g, "").trim();
          if (keyNumeric && keyNumeric === numericPart) return s;
        }
        for (const [key, s] of studentsById.entries() as Iterable<[string, any]>) {
          const keyNumeric = key.replace(/[^0-9]/g, "").trim();
          if (keyNumeric && keyNumeric === numericPart) return s;
        }
      }

      if (rawRow && rawRow.name) {
        const nameKey = String(rawRow.name).trim().toLowerCase();
        student = studentsByName.get(nameKey);
        if (student) return student;
      }

      return null;
    };

    for (const r of rows) {
      const admissionNo = String(r.admissionNo || r.admission_no || "").trim();
      const rawScore = r.score != null && r.score !== "" ? Number(r.score) : null;
      if (!admissionNo) continue;
      const student = matchStudent(admissionNo, r);
      if (!student) {
        errors.push({ admissionNo, error: "Student not found" });
        continue;
      }
      const score = typeof rawScore === "number" && !Number.isNaN(rawScore)
        ? Math.max(0, Math.min(100, rawScore))
        : null;
      const entryId = `e_${sheet.id}_${student.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      entriesToUpsert.push({
        id: entryId,
        curriculumId,
        sheetId: sheet.id,
        studentId: student.id,
        score,
        version: 1,
        userId: req.userId,
        deviceName: "Import",
      });
    }

    const results = entriesToUpsert.length > 0
      ? await store.upsertMarkEntries(entriesToUpsert)
      : [];

    return res.json({
      imported: results.filter((r: any) => r.status === "ok").length,
      conflicts: results.filter((r: any) => r.status === "conflict").length,
      errors,
      total: rows.length,
    });
  } catch (err) {
    console.error("[import marks]", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
