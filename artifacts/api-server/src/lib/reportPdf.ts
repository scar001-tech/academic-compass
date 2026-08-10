import jsPDF from "jspdf";

export function generateStudentReportPdf(student: any, exam: any, rows: any[], stats: any, classTeacher: any, principalName: string): Blob {
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
