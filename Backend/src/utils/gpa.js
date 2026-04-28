function gradeToPoints(grade) {
  const g = (grade || "").trim().toUpperCase();
  const map = {
    "A+": 4.0,
    A: 4.0,
    "A-": 3.67,
    "B+": 3.33,
    B: 3.0,
    "B-": 2.67,
    "C+": 2.33,
    C: 2.0,
    "C-": 1.67,
    D: 1.0,
    F: 0.0,
  };
  return map[g] ?? null;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function computeGpaFromRows(rows) {
  // rows: [{ credit_hours, points? , grade? }]
  let totalCh = 0;
  let totalPts = 0;

  for (const r of rows) {
    const ch = Number(r.credit_hours ?? 0);
    const pts = r.points != null ? Number(r.points) : gradeToPoints(r.grade);
    if (!ch || pts == null) continue;
    totalCh += ch;
    totalPts += pts * ch;
  }

  if (!totalCh) return { gpa: 0, total_credit_hours: 0 };
  return { gpa: round2(totalPts / totalCh), total_credit_hours: totalCh };
}

module.exports = { gradeToPoints, computeGpaFromRows };

