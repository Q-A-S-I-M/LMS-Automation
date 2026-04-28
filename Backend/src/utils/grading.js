const { gradeToPoints } = require("./gpa");

const EXPECTED_WEIGHTAGE = Object.freeze({
  Quiz: 10,
  Assignment: 10,
  "Sessional-I": 15,
  "Sessional-II": 15,
  Final: 50,
});

function round2(n) {
  return Math.round(n * 100) / 100;
}

function computeGrandTotal(marksRows) {
  // rows: [{ category, obtained_marks, total_marks, weightage }]
  const byCat = {};
  for (const r of marksRows || []) {
    const cat = r.category;
    if (!EXPECTED_WEIGHTAGE[cat]) continue;
    byCat[cat] ||= { score: 0, weightage_uploaded: 0 };
    const obtained = Number(r.obtained_marks);
    const total = Number(r.total_marks);
    const weight = Number(r.weightage);
    if (!Number.isFinite(obtained) || !Number.isFinite(total) || total <= 0) continue;
    if (!Number.isFinite(weight) || weight <= 0) continue;
    const normalized = Math.max(0, Math.min(1, obtained / total));
    byCat[cat].score += normalized * weight;
    byCat[cat].weightage_uploaded += weight;
  }

  const breakdown = {};
  let total = 0;
  let complete = true;
  for (const [cat, expected] of Object.entries(EXPECTED_WEIGHTAGE)) {
    const uploaded = round2(byCat[cat]?.weightage_uploaded || 0);
    const score = round2(byCat[cat]?.score || 0);
    breakdown[cat] = {
      expected_weightage: expected,
      uploaded_weightage: uploaded,
      score,
      complete: uploaded >= expected,
    };
    if (uploaded < expected) complete = false;
    total += score;
  }

  return { total: round2(total), complete, breakdown };
}

function totalToGrade(total) {
  const t = Number(total);
  if (!Number.isFinite(t)) return null;
  if (t >= 85) return "A";
  if (t >= 80) return "A-";
  if (t >= 75) return "B+";
  if (t >= 70) return "B";
  if (t >= 65) return "B-";
  if (t >= 60) return "C+";
  if (t >= 55) return "C";
  if (t >= 50) return "C-";
  if (t >= 45) return "D";
  return "F";
}

function totalToPoints(total) {
  const grade = totalToGrade(total);
  if (!grade) return null;
  return gradeToPoints(grade);
}

module.exports = { EXPECTED_WEIGHTAGE, computeGrandTotal, totalToGrade, totalToPoints };

