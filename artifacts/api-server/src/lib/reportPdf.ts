import { jsPDF } from "jspdf";

export interface TermStat {
  examId: string;
  term: number;
  year: number;
  score: number | null;
  grade: string;
  rank: number;
  total: number;
  deviation: number;
}

export function generateStudentReportPdf(student: any, exam: any, rows: any[], stats: any, classTeacher: any, principalName: string, termStats?: TermStat[]): Blob {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("ACADEMIC COMPASS", pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(11);
  doc.text("STUDENT REPORT CARD", pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Name: ${student.name}`, 14, y);
  doc.text(`Admission No: ${student.admissionNo}`, pageWidth - 14, y, { align: "right" });
  y += 5;
  doc.text(`Class: ${exam.name || ""}`, 14, y);
  doc.text(`Term: ${exam.term}, Year: ${exam.year}`, pageWidth - 14, y, { align: "right" });
  y += 6;

  doc.setDrawColor(180);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;

  if (termStats && termStats.length > 0) {
    const uniqueTerms = Array.from(new Map(termStats.map(t => [`${t.term}-${t.year}`, { term: t.term, year: t.year }])).values());
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Subject", 14, y);
    uniqueTerms.forEach((ut, idx) => {
      const x = 90 + idx * 55;
      doc.text(`T${ut.term} ${ut.year}`, x, y);
      doc.text("Score", x, y + 4);
      doc.text("Grade", x + 18, y + 4);
      doc.text("Rank", x + 36, y + 4);
    });
    y += 2;
    doc.line(14, y, pageWidth - 14, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    rows.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.text(r.subject || "", 14, y);
      const subjectTerms = termStats.filter(ts => ts.examId === r.examId);
      if (subjectTerms.length === 0 && r.examId) {
        const ts = termStats.find(t => t.examId === r.examId);
        if (ts) {
          doc.text(ts.score != null ? String(ts.score) : "—", 90, y, { align: "center" });
          doc.text(ts.grade || "—", 108, y, { align: "center" });
          doc.text(ts.rank ? String(ts.rank) : "—", 126, y, { align: "center" });
        }
      } else if (subjectTerms.length > 0) {
        subjectTerms.forEach((ts, idx) => {
          const x = 90 + idx * 55;
          doc.text(ts.score != null ? String(ts.score) : "—", x, y, { align: "center" });
          doc.text(ts.grade || "—", x + 18, y, { align: "center" });
          doc.text(ts.rank ? String(ts.rank) : "—", x + 36, y, { align: "center" });
        });
      }
      y += 6;
    });
  } else {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Subject", 14, y);
    doc.text("Score", 90, y, { align: "center" });
    doc.text("Grade", 110, y, { align: "center" });
    doc.text("Remarks", 130, y, { align: "center" });
    y += 2;
    doc.line(14, y, pageWidth - 14, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    rows.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.text(r.subject || "", 14, y);
      doc.text(r.score != null ? String(r.score) : "—", 90, y, { align: "center" });
      doc.text(r.grade || "—", 110, y, { align: "center" });
      doc.text(r.remarks || "—", 130, y, { align: "center" });
      y += 6;
    });
  }

  y += 4;
  doc.line(14, y, pageWidth - 14, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`Mean Score: ${stats.mean != null ? stats.mean.toFixed(1) : "—"}`, 14, y);
  doc.text(`Grade: ${stats.overallGrade || "—"}`, 90, y, { align: "center" });
  doc.text(`Stream Pos.: ${stats.streamPosition || "—"}`, pageWidth - 14, y, { align: "right" });

  y += 10;
  doc.setFont("helvetica", "normal");
  doc.text("Class Teacher:", 14, y);
  doc.text(classTeacher?.name || "", 50, y);

  return doc.output("blob");
}
