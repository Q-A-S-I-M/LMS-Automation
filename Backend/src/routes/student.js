const express = require("express");
const { pool } = require("../config/db");
const { computeGpaFromRows } = require("../utils/gpa");
const { computeGrandTotal, totalToGrade, totalToPoints } = require("../utils/grading");

const router = express.Router();
const MAX_CREDIT_HOURS = 18;

async function requireOpenCycle(conn, semester) {
  const [rows] = await conn.execute(
    `SELECT id, semester, start_date, end_date, status
     FROM registration_cycles
     WHERE semester = ?
     LIMIT 1`,
    [semester],
  );
  if (!rows.length) {
    return { ok: false, error: "Registration cycle not found for this semester" };
  }
  const cycle = rows[0];
  if (cycle.status !== "Open") {
    return { ok: false, error: "Registration cycle is closed for this semester" };
  }
  return { ok: true, cycle };
}

async function isSemesterFinalized(conn, rollNo, semester) {
  const [rows] = await conn.execute(
    `SELECT id
     FROM student_registration_locks
     WHERE roll_no = ? AND semester = ?
     LIMIT 1`,
    [rollNo, semester],
  );
  return Boolean(rows.length);
}

// GET /api/student/profile
router.get("/profile", async (req, res) => {
  const rollNo = req.user.roll_no;
  const [rows] = await pool.execute(
    `SELECT roll_no, full_name, email, degree, section, batch, campus, dob, cnic,
            blood_group, nationality, status
     FROM students
     WHERE roll_no = ?
     LIMIT 1`,
    [rollNo],
  );

  if (!rows.length) return res.status(404).json({ ok: false, error: "Student not found" });
  return res.json({ ok: true, profile: rows[0] });
});

// GET /api/student/courses  (helper for UI)
router.get("/courses", async (req, res) => {
  const rollNo = req.user.roll_no;
  const [rows] = await pool.execute(
    `SELECT DISTINCT e.course_code, c.course_name, c.credit_hours, e.semester
     FROM enrollments e
     JOIN courses c ON c.course_code = e.course_code
     WHERE e.roll_no = ?
     ORDER BY e.semester DESC, e.course_code ASC`,
    [rollNo],
  );
  return res.json({ ok: true, courses: rows });
});

// GET /api/student/registration/available?semester=Spring-2026
router.get("/registration/available", async (req, res) => {
  const rollNo = req.user.roll_no;
  const semester = String(req.query.semester || "").trim();
  if (!semester) return res.status(400).json({ ok: false, error: "semester is required" });

  const [cycleRows] = await pool.execute(
    `SELECT id, status FROM registration_cycles WHERE semester = ? LIMIT 1`,
    [semester],
  );
  if (!cycleRows.length) {
    return res.status(404).json({ ok: false, error: "Registration cycle not found for this semester" });
  }

  const [rows] = await pool.execute(
    `SELECT c.course_code, c.course_name, c.credit_hours,
            CASE
              WHEN f.course_code IS NOT NULL THEN 'Retake'
              ELSE 'Regular'
            END AS offering_type
     FROM course_offerings o
     JOIN courses c ON c.course_code = o.course_code
     LEFT JOIN (
       SELECT DISTINCT e.course_code
       FROM enrollments e
       WHERE e.roll_no = ?
         AND (
           (e.final_percentage IS NOT NULL AND e.final_percentage < 50)
           OR (e.final_percentage IS NULL AND e.grade IN ('D','F'))
         )
     ) f ON f.course_code = o.course_code
     WHERE o.semester = ?
       AND o.is_active = 1
       AND c.course_code NOT IN (
       SELECT r.course_code FROM course_registrations r
       WHERE r.roll_no = ? AND r.semester = ?
     )
       AND c.course_code NOT IN (
         SELECT DISTINCT e2.course_code
         FROM enrollments e2
         WHERE e2.roll_no = ?
           AND (
             (e2.final_percentage IS NOT NULL AND e2.final_percentage >= 50)
             OR (e2.final_percentage IS NULL AND e2.grade IN ('A+','A','A-','B+','B','B-','C+','C','C-'))
           )
       )
     ORDER BY c.course_code ASC`,
    [rollNo, semester, rollNo, semester, rollNo],
  );

  return res.json({ ok: true, semester, cycle_status: cycleRows[0].status, courses: rows });
});

// GET /api/student/registration/my?semester=Spring-2026
router.get("/registration/my", async (req, res) => {
  const rollNo = req.user.roll_no;
  const semester = String(req.query.semester || "").trim();
  if (!semester) return res.status(400).json({ ok: false, error: "semester is required" });

  const [rows] = await pool.execute(
    `SELECT r.id, r.course_code, c.course_name, c.credit_hours, r.semester, r.status, r.created_at, r.enrolled_at
     FROM course_registrations r
     JOIN courses c ON c.course_code = r.course_code
     WHERE r.roll_no = ? AND r.semester = ?
     ORDER BY r.created_at DESC`,
    [rollNo, semester],
  );

  const total = rows.reduce((sum, r) => sum + Number(r.credit_hours || 0), 0);
  const [locks] = await pool.execute(
    `SELECT finalized_at
     FROM student_registration_locks
     WHERE roll_no = ? AND semester = ?
     LIMIT 1`,
    [rollNo, semester],
  );
  return res.json({
    ok: true,
    semester,
    finalized: Boolean(locks.length),
    finalized_at: locks[0]?.finalized_at || null,
    max_credit_hours: MAX_CREDIT_HOURS,
    total_credit_hours: total,
    registrations: rows,
  });
});

// POST /api/student/registration/register
// body: { course_code, semester }
router.post("/registration/register", async (req, res) => {
  const rollNo = req.user.roll_no;
  const course_code = String(req.body?.course_code || "").trim();
  const semester = String(req.body?.semester || "").trim();
  if (!course_code || !semester) {
    return res.status(400).json({ ok: false, error: "course_code and semester are required" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const cycleCheck = await requireOpenCycle(conn, semester);
    if (!cycleCheck.ok) {
      await conn.rollback();
      return res.status(409).json({ ok: false, error: cycleCheck.error });
    }
    if (await isSemesterFinalized(conn, rollNo, semester)) {
      await conn.rollback();
      return res.status(409).json({ ok: false, error: "Registration is finalized for this semester and cannot be modified" });
    }

    const [offered] = await conn.execute(
      `SELECT id FROM course_offerings WHERE semester = ? AND course_code = ? AND is_active = 1 LIMIT 1`,
      [semester, course_code],
    );
    if (!offered.length) {
      await conn.rollback();
      return res.status(409).json({ ok: false, error: "Course is not offered in this registration cycle" });
    }

    const [passedBefore] = await conn.execute(
      `SELECT id
       FROM enrollments
       WHERE roll_no = ? AND course_code = ?
         AND (
           (final_percentage IS NOT NULL AND final_percentage >= 50)
           OR (final_percentage IS NULL AND grade IN ('A+','A','A-','B+','B','B-','C+','C','C-'))
         )
       LIMIT 1`,
      [rollNo, course_code],
    );
    if (passedBefore.length) {
      await conn.rollback();
      return res.status(409).json({ ok: false, error: "Course already passed and cannot be re-registered" });
    }

    // lock existing regs for this student+semester to prevent race condition
    const [curRows] = await conn.execute(
      `SELECT SUM(c.credit_hours) AS total_ch
       FROM course_registrations r
       JOIN courses c ON c.course_code = r.course_code
       WHERE r.roll_no = ? AND r.semester = ?
       FOR UPDATE`,
      [rollNo, semester],
    );
    const currentCh = Number(curRows?.[0]?.total_ch || 0);

    const [courseRows] = await conn.execute(
      `SELECT course_code, credit_hours FROM courses WHERE course_code = ? LIMIT 1`,
      [course_code],
    );
    if (!courseRows.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, error: "Course not found" });
    }
    const courseCh = Number(courseRows[0].credit_hours || 0);

    if (currentCh + courseCh > MAX_CREDIT_HOURS) {
      await conn.rollback();
      return res.status(409).json({
        ok: false,
        error: `Credit hour limit exceeded. Current: ${currentCh}, course: ${courseCh}, max: ${MAX_CREDIT_HOURS}`,
      });
    }

    try {
      await conn.execute(
        `INSERT INTO course_registrations (roll_no, course_code, semester, status, enrolled_at)
         VALUES (?, ?, ?, ?, ?)`,
        [rollNo, course_code, semester, "Registered", null],
      );
    } catch (err) {
      const msg = String(err?.message || "");
      if (msg.includes("Duplicate") || msg.includes("ER_DUP_ENTRY")) {
        await conn.rollback();
        return res.status(409).json({ ok: false, error: "Already registered for this course" });
      }
      throw err;
    }

    await conn.commit();
    return res.status(201).json({
      ok: true,
      semester,
      course_code,
      status: "Registered",
      max_credit_hours: MAX_CREDIT_HOURS,
      total_credit_hours: currentCh + courseCh,
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore
    }
    return res.status(500).json({ ok: false, error: "Failed to register course" });
  } finally {
    conn.release();
  }
});

// POST /api/student/registration/unregister
// body: { course_code, semester }
router.post("/registration/unregister", async (req, res) => {
  const rollNo = req.user.roll_no;
  const course_code = String(req.body?.course_code || "").trim();
  const semester = String(req.body?.semester || "").trim();
  if (!course_code || !semester) {
    return res.status(400).json({ ok: false, error: "course_code and semester are required" });
  }

  const conn = await pool.getConnection();
  try {
    const cycleCheck = await requireOpenCycle(conn, semester);
    if (!cycleCheck.ok) {
      return res.status(409).json({ ok: false, error: cycleCheck.error });
    }
    if (await isSemesterFinalized(conn, rollNo, semester)) {
      return res.status(409).json({ ok: false, error: "Registration is finalized for this semester and cannot be modified" });
    }
  } finally {
    conn.release();
  }

  const [regRows] = await pool.execute(
    `SELECT id, status FROM course_registrations WHERE roll_no = ? AND course_code = ? AND semester = ? LIMIT 1`,
    [rollNo, course_code, semester],
  );
  if (!regRows.length) return res.status(404).json({ ok: false, error: "Registration not found" });
  if (regRows[0].status === "Enrolled") {
    return res.status(409).json({ ok: false, error: "Enrolled courses are locked and cannot be unregistered" });
  }

  const [result] = await pool.execute(`DELETE FROM course_registrations WHERE id = ?`, [regRows[0].id]);
  return res.json({ ok: true, semester, course_code });
});

// POST /api/student/registration/lock
// body: { semester }
router.post("/registration/lock", async (req, res) => {
  const rollNo = req.user.roll_no;
  const semester = String(req.body?.semester || "").trim();
  if (!semester) {
    return res.status(400).json({ ok: false, error: "semester is required" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const cycleCheck = await requireOpenCycle(conn, semester);
    if (!cycleCheck.ok) {
      await conn.rollback();
      return res.status(409).json({ ok: false, error: cycleCheck.error });
    }
    if (await isSemesterFinalized(conn, rollNo, semester)) {
      await conn.rollback();
      return res.status(409).json({ ok: false, error: "Registration already finalized for this semester" });
    }

    const [reg] = await conn.execute(
      `SELECT id
       FROM course_registrations
       WHERE roll_no = ? AND semester = ?
       FOR UPDATE`,
      [rollNo, semester],
    );
    if (!reg.length) {
      await conn.rollback();
      return res.status(409).json({ ok: false, error: "No registered courses found to finalize" });
    }

    await conn.execute(
      `UPDATE course_registrations
       SET status = 'Enrolled', enrolled_at = CURRENT_TIMESTAMP
       WHERE roll_no = ? AND semester = ? AND status = 'Registered'`,
      [rollNo, semester],
    );
    await conn.execute(
      `INSERT INTO enrollments (roll_no, course_code, semester, grade, points, final_percentage, passed)
       SELECT r.roll_no, r.course_code, r.semester, NULL, NULL, NULL, NULL
       FROM course_registrations r
       WHERE r.roll_no = ? AND r.semester = ?
       ON DUPLICATE KEY UPDATE roll_no = VALUES(roll_no)`,
      [rollNo, semester],
    );
    await conn.execute(
      `INSERT INTO student_registration_locks (roll_no, semester, finalized_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [rollNo, semester],
    );

    await conn.commit();
    return res.json({ ok: true, semester, status: "Finalized", locked_courses: reg.length });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore
    }
    return res.status(500).json({ ok: false, error: "Failed to lock registration" });
  } finally {
    conn.release();
  }
});

// GET /api/student/feedback/my?semester=Spring-2026
router.get("/feedback/my", async (req, res) => {
  const rollNo = req.user.roll_no;
  const semester = String(req.query.semester || "").trim();
  if (!semester) return res.status(400).json({ ok: false, error: "semester is required" });

  const [rows] = await pool.execute(
    `SELECT r.course_code, c.course_name, c.credit_hours,
            f.rating, f.comment, f.updated_at
     FROM course_registrations r
     JOIN courses c ON c.course_code = r.course_code
     LEFT JOIN course_feedback f
       ON f.roll_no = r.roll_no AND f.course_code = r.course_code AND f.semester = r.semester
     WHERE r.roll_no = ? AND r.semester = ?
     ORDER BY r.created_at DESC`,
    [rollNo, semester],
  );

  return res.json({ ok: true, semester, courses: rows });
});

// POST /api/student/feedback/submit
// body: { course_code, semester, rating, comment }
router.post("/feedback/submit", async (req, res) => {
  const rollNo = req.user.roll_no;
  const course_code = String(req.body?.course_code || "").trim();
  const semester = String(req.body?.semester || "").trim();
  const rating = Number(req.body?.rating);
  const comment = req.body?.comment == null ? null : String(req.body.comment);

  if (!course_code || !semester || !rating) {
    return res.status(400).json({ ok: false, error: "course_code, semester and rating are required" });
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ ok: false, error: "rating must be between 1 and 5" });
  }

  // Must be registered for the course in that semester
  const [reg] = await pool.execute(
    `SELECT id FROM course_registrations WHERE roll_no = ? AND course_code = ? AND semester = ? LIMIT 1`,
    [rollNo, course_code, semester],
  );
  if (!reg.length) return res.status(403).json({ ok: false, error: "Register the course before submitting feedback" });

  await pool.execute(
    `INSERT INTO course_feedback (roll_no, course_code, semester, rating, comment)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), updated_at = CURRENT_TIMESTAMP`,
    [rollNo, course_code, semester, rating, comment],
  );

  return res.json({ ok: true, semester, course_code, rating, comment });
});

// GET /api/student/attendance/:courseId
router.get("/attendance/:courseId", async (req, res) => {
  const rollNo = req.user.roll_no;
  const courseId = req.params.courseId;
  const semester = String(req.query.semester || "").trim();
  if (!semester) return res.status(400).json({ ok: false, error: "semester is required" });

  const [rows] = await pool.execute(
    `SELECT lecture_no, date, duration_hours, presence
     FROM attendance
     WHERE roll_no = ? AND course_code = ? AND semester = ?
     ORDER BY date ASC, lecture_no ASC`,
    [rollNo, courseId, semester],
  );

  const total = rows.length;
  const present = rows.filter((r) => r.presence === "P").length;
  const percentage = total ? Math.round((present / total) * 100) : 0;

  return res.json({
    ok: true,
    course_code: courseId,
    semester,
    summary: { total_lectures: total, present, percentage },
    lectures: rows,
  });
});

// GET /api/student/marks/:courseId
router.get("/marks/:courseId", async (req, res) => {
  const rollNo = req.user.roll_no;
  const courseId = req.params.courseId;
  const semester = String(req.query.semester || "").trim();
  if (!semester) return res.status(400).json({ ok: false, error: "semester is required" });

  const [rows] = await pool.execute(
    `SELECT category, item_no, obtained_marks, total_marks, weightage
     FROM marks
     WHERE roll_no = ? AND course_code = ? AND semester = ?
     ORDER BY FIELD(category,'Assignment','Quiz','Sessional-I','Sessional-II','Final'), item_no ASC`,
    [rollNo, courseId, semester],
  );

  const grouped = rows.reduce((acc, r) => {
    acc[r.category] ||= [];
    acc[r.category].push(r);
    return acc;
  }, {});

  const grand_total = computeGrandTotal(rows);
  const grade = grand_total.complete ? totalToGrade(grand_total.total) : null;
  const points = grand_total.complete ? totalToPoints(grand_total.total) : null;

  return res.json({
    ok: true,
    course_code: courseId,
    semester,
    marks: grouped,
    grand_total,
    transcript: grand_total.complete ? { grade, points } : null,
  });
});

// GET /api/student/transcript
router.get("/transcript", async (req, res) => {
  const rollNo = req.user.roll_no;

  const [rows] = await pool.execute(
    `SELECT e.semester, e.course_code, c.course_name, c.credit_hours, e.grade, e.points
     FROM enrollments e
     JOIN courses c ON c.course_code = e.course_code
     WHERE e.roll_no = ?
     ORDER BY e.semester ASC, e.course_code ASC`,
    [rollNo],
  );

  const bySemester = rows.reduce((acc, r) => {
    acc[r.semester] ||= [];
    acc[r.semester].push(r);
    return acc;
  }, {});

  const semesterSummaries = Object.entries(bySemester).map(([semester, items]) => {
    const { gpa, total_credit_hours } = computeGpaFromRows(items);
    return { semester, sgpa: gpa, total_credit_hours, courses: items };
  });

  const allCourses = rows.map((r) => ({
    credit_hours: r.credit_hours,
    points: r.points,
    grade: r.grade,
  }));
  const cgpa = computeGpaFromRows(allCourses).gpa;

  return res.json({
    ok: true,
    roll_no: rollNo,
    cgpa,
    semesters: semesterSummaries,
  });
});

module.exports = router;

