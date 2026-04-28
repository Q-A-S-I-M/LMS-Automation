const express = require("express");
const { pool } = require("../config/db");
const { EXPECTED_WEIGHTAGE, computeGrandTotal, totalToGrade, totalToPoints } = require("../utils/grading");

const router = express.Router();

async function ensureEnrolled({ conn, roll_no, course_code, semester }) {
  const [enr] = await conn.execute(
    `SELECT id FROM enrollments WHERE roll_no = ? AND course_code = ? AND semester = ? LIMIT 1`,
    [roll_no, course_code, semester],
  );
  if (enr.length) {
    const [reg] = await conn.execute(
      `SELECT id
       FROM course_registrations
       WHERE roll_no = ? AND course_code = ? AND semester = ? AND status = 'Enrolled'
       LIMIT 1`,
      [roll_no, course_code, semester],
    );
    return Boolean(reg.length);
  }

  const [reg] = await conn.execute(
    `SELECT id
     FROM course_registrations
     WHERE roll_no = ? AND course_code = ? AND semester = ? AND status = 'Enrolled'
     LIMIT 1
     FOR UPDATE`,
    [roll_no, course_code, semester],
  );
  if (!reg.length) return false;

  await conn.execute(
    `INSERT INTO enrollments (roll_no, course_code, semester, grade, points)
     VALUES (?, ?, ?, NULL, NULL)
     ON DUPLICATE KEY UPDATE roll_no = VALUES(roll_no)`,
    [roll_no, course_code, semester],
  );
  await conn.execute(
    `UPDATE enrollments
     SET roll_no = roll_no
     WHERE roll_no = ? AND course_code = ? AND semester = ?`,
    [roll_no, course_code, semester],
  );
  return true;
}

// GET /api/teacher/students
router.get("/students", async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT roll_no, full_name, email, degree, section, batch, campus, status
     FROM students
     ORDER BY roll_no ASC`,
  );
  return res.json({ ok: true, students: rows });
});

// GET /api/teacher/courses
router.get("/courses", async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT course_code, course_name, credit_hours
     FROM courses
     ORDER BY course_code ASC`,
  );
  return res.json({ ok: true, courses: rows });
});

// POST /api/teacher/courses
router.post("/courses", async (req, res) => {
  const course_code = String(req.body?.course_code || "").trim();
  const course_name = String(req.body?.course_name || "").trim();
  const credit_hours = Number(req.body?.credit_hours);

  if (!course_code || !course_name || !Number.isFinite(credit_hours) || credit_hours <= 0) {
    return res.status(400).json({ ok: false, error: "course_code, course_name and credit_hours are required" });
  }

  try {
    await pool.execute(`INSERT INTO courses (course_code, course_name, credit_hours) VALUES (?, ?, ?)`, [
      course_code,
      course_name,
      credit_hours,
    ]);
  } catch (err) {
    const msg = String(err?.message || "");
    if (msg.includes("Duplicate") || msg.includes("ER_DUP_ENTRY")) {
      return res.status(409).json({ ok: false, error: "Course already exists" });
    }
    return res.status(500).json({ ok: false, error: "Failed to create course" });
  }

  return res.status(201).json({ ok: true, course: { course_code, course_name, credit_hours } });
});

// PUT /api/teacher/courses/:courseCode
router.put("/courses/:courseCode", async (req, res) => {
  const courseCode = String(req.params.courseCode || "").trim();
  const course_name = req.body?.course_name == null ? null : String(req.body.course_name).trim();
  const credit_hours = req.body?.credit_hours == null ? null : Number(req.body.credit_hours);
  if (!courseCode) return res.status(400).json({ ok: false, error: "course_code is required" });

  const updates = [];
  const params = [];
  if (course_name != null) {
    updates.push("course_name = ?");
    params.push(course_name);
  }
  if (credit_hours != null) {
    if (!Number.isFinite(credit_hours) || credit_hours <= 0) {
      return res.status(400).json({ ok: false, error: "credit_hours must be a positive number" });
    }
    updates.push("credit_hours = ?");
    params.push(credit_hours);
  }
  if (!updates.length) return res.status(400).json({ ok: false, error: "No fields to update" });

  const [result] = await pool.execute(`UPDATE courses SET ${updates.join(", ")} WHERE course_code = ?`, [
    ...params,
    courseCode,
  ]);
  if (!result.affectedRows) return res.status(404).json({ ok: false, error: "Course not found" });

  const [rows] = await pool.execute(`SELECT course_code, course_name, credit_hours FROM courses WHERE course_code = ?`, [
    courseCode,
  ]);
  return res.json({ ok: true, course: rows[0] });
});

// DELETE /api/teacher/courses/:courseCode
router.delete("/courses/:courseCode", async (req, res) => {
  const courseCode = String(req.params.courseCode || "").trim();
  const [result] = await pool.execute(`DELETE FROM courses WHERE course_code = ?`, [courseCode]);
  if (!result.affectedRows) return res.status(404).json({ ok: false, error: "Course not found" });
  return res.json({ ok: true, course_code: courseCode });
});

// GET /api/teacher/registrations?semester=Spring-2026&course_code=CS101
router.get("/registrations", async (req, res) => {
  const semester = String(req.query.semester || "").trim();
  const course_code = req.query.course_code == null ? "" : String(req.query.course_code).trim();
  if (!semester) return res.status(400).json({ ok: false, error: "semester is required" });

  const params = [semester];
  let courseFilter = "";
  if (course_code) {
    courseFilter = "AND r.course_code = ?";
    params.push(course_code);
  }

  const [rows] = await pool.execute(
    `SELECT r.id, r.roll_no, s.full_name, s.section, s.batch,
            r.course_code, c.course_name, c.credit_hours,
            r.semester, r.status, r.created_at, r.enrolled_at
     FROM course_registrations r
     JOIN students s ON s.roll_no = r.roll_no
     JOIN courses c ON c.course_code = r.course_code
     WHERE r.semester = ?
     ${courseFilter}
     ORDER BY r.course_code ASC, r.roll_no ASC`,
    params,
  );

  return res.json({ ok: true, semester, registrations: rows });
});

// POST /api/teacher/enroll
// body: { semester, course_code, roll_nos?: string[] } (if roll_nos omitted, enroll all Registered for that course+semester)
router.post("/enroll", async (req, res) => {
  const semester = String(req.body?.semester || "").trim();
  const course_code = String(req.body?.course_code || "").trim();
  const roll_nos = Array.isArray(req.body?.roll_nos) ? req.body.roll_nos.map((x) => String(x).trim()).filter(Boolean) : null;
  if (!semester || !course_code) return res.status(400).json({ ok: false, error: "semester and course_code are required" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const params = [semester, course_code];
    let rollFilter = "";
    if (roll_nos && roll_nos.length) {
      rollFilter = `AND r.roll_no IN (${roll_nos.map(() => "?").join(",")})`;
      params.push(...roll_nos);
    }

    const [regs] = await conn.execute(
      `SELECT r.roll_no
       FROM course_registrations r
       WHERE r.semester = ? AND r.course_code = ? AND r.status = 'Registered'
       ${rollFilter}
       FOR UPDATE`,
      params,
    );

    for (const r of regs) {
      await conn.execute(
        `INSERT INTO enrollments (roll_no, course_code, semester, grade, points)
         VALUES (?, ?, ?, NULL, NULL)
         ON DUPLICATE KEY UPDATE roll_no = VALUES(roll_no)`,
        [r.roll_no, course_code, semester],
      );
      await conn.execute(
        `UPDATE course_registrations
         SET status = 'Enrolled', enrolled_at = CURRENT_TIMESTAMP
         WHERE roll_no = ? AND course_code = ? AND semester = ?`,
        [r.roll_no, course_code, semester],
      );
    }

    await conn.commit();
    return res.json({ ok: true, semester, course_code, enrolled_count: regs.length });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore
    }
    return res.status(500).json({ ok: false, error: "Failed to enroll students" });
  } finally {
    conn.release();
  }
});

// POST /api/teacher/registrations/decision
// body: { semester, course_code, action: "approve"|"reject", roll_nos: string[] }
router.post("/registrations/decision", async (req, res) => {
  const semester = String(req.body?.semester || "").trim();
  const course_code = String(req.body?.course_code || "").trim();
  const action = String(req.body?.action || "").trim().toLowerCase();
  const roll_nos = Array.isArray(req.body?.roll_nos) ? req.body.roll_nos.map((x) => String(x).trim()).filter(Boolean) : [];

  if (!semester || !course_code || !["approve", "reject"].includes(action)) {
    return res.status(400).json({ ok: false, error: "semester, course_code and valid action are required" });
  }
  if (!roll_nos.length) return res.status(400).json({ ok: false, error: "roll_nos array is required" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [regs] = await conn.execute(
      `SELECT roll_no
       FROM course_registrations
       WHERE semester = ? AND course_code = ? AND status = 'Registered'
         AND roll_no IN (${roll_nos.map(() => "?").join(",")})
       FOR UPDATE`,
      [semester, course_code, ...roll_nos],
    );

    if (!regs.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, error: "No registered students found for selected roll numbers" });
    }

    if (action === "approve") {
      for (const r of regs) {
        await conn.execute(
          `INSERT INTO enrollments (roll_no, course_code, semester, grade, points)
           VALUES (?, ?, ?, NULL, NULL)
           ON DUPLICATE KEY UPDATE roll_no = VALUES(roll_no)`,
          [r.roll_no, course_code, semester],
        );
      }
      await conn.execute(
        `UPDATE course_registrations
         SET status = 'Enrolled', enrolled_at = CURRENT_TIMESTAMP, dropped_at = NULL
         WHERE semester = ? AND course_code = ? AND status = 'Registered'
           AND roll_no IN (${regs.map(() => "?").join(",")})`,
        [semester, course_code, ...regs.map((x) => x.roll_no)],
      );
    } else {
      await conn.execute(
        `UPDATE course_registrations
         SET status = 'Dropped', dropped_at = CURRENT_TIMESTAMP
         WHERE semester = ? AND course_code = ? AND status = 'Registered'
           AND roll_no IN (${regs.map(() => "?").join(",")})`,
        [semester, course_code, ...regs.map((x) => x.roll_no)],
      );
    }

    await conn.commit();
    return res.json({
      ok: true,
      semester,
      course_code,
      action,
      processed_count: regs.length,
      processed_roll_nos: regs.map((x) => x.roll_no),
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore
    }
    return res.status(500).json({ ok: false, error: "Failed to process registration decision" });
  } finally {
    conn.release();
  }
});

// POST /api/teacher/marks/upsert
// body: { roll_no, course_code, semester, components: { Quiz, Assignment, "Sessional-I", "Sessional-II", Final } }
// Each component: { obtained, total } ; weightage enforced by EXPECTED_WEIGHTAGE, stored as single item_no=1 per category.
router.post("/marks/upsert", async (req, res) => {
  const roll_no = String(req.body?.roll_no || "").trim();
  const course_code = String(req.body?.course_code || "").trim();
  const semester = String(req.body?.semester || "").trim();
  const components = req.body?.components || {};
  if (!roll_no || !course_code || !semester) {
    return res.status(400).json({ ok: false, error: "roll_no, course_code and semester are required" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const okEnroll = await ensureEnrolled({ conn, roll_no, course_code, semester });
    if (!okEnroll) {
      await conn.rollback();
      return res.status(403).json({ ok: false, error: "Student is not registered/enrolled for this course+semester" });
    }

    for (const [cat, expectedWeight] of Object.entries(EXPECTED_WEIGHTAGE)) {
      if (!(cat in components)) continue;
      const obtained = Number(components?.[cat]?.obtained);
      const total = Number(components?.[cat]?.total);
      if (!Number.isFinite(obtained) || !Number.isFinite(total) || total <= 0) {
        await conn.rollback();
        return res.status(400).json({ ok: false, error: `Invalid obtained/total for ${cat}` });
      }

      await conn.execute(
        `INSERT INTO marks (roll_no, course_code, semester, category, item_no, obtained_marks, total_marks, weightage)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?)
         ON DUPLICATE KEY UPDATE obtained_marks = VALUES(obtained_marks), total_marks = VALUES(total_marks), weightage = VALUES(weightage)`,
        [roll_no, course_code, semester, cat, obtained, total, expectedWeight],
      );
    }

    const [rows] = await conn.execute(
      `SELECT category, item_no, obtained_marks, total_marks, weightage
       FROM marks
       WHERE roll_no = ? AND course_code = ? AND semester = ?`,
      [roll_no, course_code, semester],
    );

    const gt = computeGrandTotal(rows);
    let grade = null;
    let points = null;
    if (gt.complete) {
      grade = totalToGrade(gt.total);
      points = totalToPoints(gt.total);
      const passed = gt.total >= 50;
      await conn.execute(
        `UPDATE enrollments
         SET grade = ?, points = ?, final_percentage = ?, passed = ?
         WHERE roll_no = ? AND course_code = ? AND semester = ?`,
        [grade, points, gt.total, passed ? 1 : 0, roll_no, course_code, semester],
      );
    }

    await conn.commit();
    return res.json({
      ok: true,
      roll_no,
      course_code,
      semester,
      grand_total: gt,
      transcript: gt.complete ? { grade, points } : null,
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore
    }
    return res.status(500).json({ ok: false, error: "Failed to upload marks" });
  } finally {
    conn.release();
  }
});

// POST /api/teacher/attendance/upsert
// body: { roll_no, course_code, semester, lectures: [{ lecture_no, date, duration_hours, presence }] }
router.post("/attendance/upsert", async (req, res) => {
  const roll_no = String(req.body?.roll_no || "").trim();
  const course_code = String(req.body?.course_code || "").trim();
  const semester = String(req.body?.semester || "").trim();
  const lectures = Array.isArray(req.body?.lectures) ? req.body.lectures : [];
  if (!roll_no || !course_code || !semester) {
    return res.status(400).json({ ok: false, error: "roll_no, course_code and semester are required" });
  }
  if (!lectures.length) return res.status(400).json({ ok: false, error: "lectures array is required" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const okEnroll = await ensureEnrolled({ conn, roll_no, course_code, semester });
    if (!okEnroll) {
      await conn.rollback();
      return res.status(403).json({ ok: false, error: "Student is not registered/enrolled for this course+semester" });
    }

    for (const l of lectures) {
      const lecture_no = Number(l?.lecture_no);
      const date = String(l?.date || "").slice(0, 10);
      const duration_hours = Number(l?.duration_hours);
      const presence = String(l?.presence || "").toUpperCase();

      if (!Number.isInteger(lecture_no) || lecture_no <= 0) {
        await conn.rollback();
        return res.status(400).json({ ok: false, error: "Invalid lecture_no" });
      }
      if (!date) {
        await conn.rollback();
        return res.status(400).json({ ok: false, error: "Invalid date" });
      }
      if (!Number.isFinite(duration_hours) || duration_hours <= 0) {
        await conn.rollback();
        return res.status(400).json({ ok: false, error: "Invalid duration_hours" });
      }
      if (presence !== "P" && presence !== "A") {
        await conn.rollback();
        return res.status(400).json({ ok: false, error: "presence must be P or A" });
      }

      await conn.execute(
        `INSERT INTO attendance (roll_no, course_code, semester, lecture_no, date, duration_hours, presence)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE date = VALUES(date), duration_hours = VALUES(duration_hours), presence = VALUES(presence)`,
        [roll_no, course_code, semester, lecture_no, date, duration_hours, presence],
      );
    }

    await conn.commit();
    return res.json({ ok: true, roll_no, course_code, semester, upserted: lectures.length });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore
    }
    return res.status(500).json({ ok: false, error: "Failed to upload attendance" });
  } finally {
    conn.release();
  }
});

// GET /api/teacher/feedback?semester=Spring-2026&course_code=CS101
router.get("/feedback", async (req, res) => {
  const semester = String(req.query.semester || "").trim();
  const course_code = req.query.course_code == null ? "" : String(req.query.course_code).trim();
  if (!semester) return res.status(400).json({ ok: false, error: "semester is required" });

  const params = [semester];
  let courseFilter = "";
  if (course_code) {
    courseFilter = "AND f.course_code = ?";
    params.push(course_code);
  }

  const [rows] = await pool.execute(
    `SELECT f.id, f.roll_no, s.full_name, f.course_code, c.course_name, f.semester,
            f.rating, f.comment, f.updated_at,
            f.teacher_response, f.responded_at
     FROM course_feedback f
     JOIN students s ON s.roll_no = f.roll_no
     JOIN courses c ON c.course_code = f.course_code
     WHERE f.semester = ?
     ${courseFilter}
     ORDER BY f.course_code ASC, f.updated_at DESC`,
    params,
  );

  return res.json({ ok: true, semester, feedback: rows });
});

// PATCH /api/teacher/feedback/:id/respond
// body: { teacher_response }
router.patch("/feedback/:id/respond", async (req, res) => {
  const id = Number(req.params.id);
  const teacher_response = req.body?.teacher_response == null ? null : String(req.body.teacher_response);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: "Invalid id" });

  const [result] = await pool.execute(
    `UPDATE course_feedback
     SET teacher_response = ?, responded_at = CASE WHEN ? IS NULL OR ? = '' THEN NULL ELSE CURRENT_TIMESTAMP END
     WHERE id = ?`,
    [teacher_response, teacher_response, teacher_response, id],
  );
  if (!result.affectedRows) return res.status(404).json({ ok: false, error: "Feedback not found" });
  return res.json({ ok: true, id, teacher_response });
});

// GET /api/teacher/stats?semester=Spring-2026
router.get("/stats", async (req, res) => {
  const semester = String(req.query.semester || "").trim();

  const [[studentCount]] = await pool.execute(`SELECT COUNT(*) AS n FROM students`);
  const [[courseCount]] = await pool.execute(`SELECT COUNT(*) AS n FROM courses`);

  let regStats = { registered: 0, enrolled: 0, dropped: 0 };
  let fbStats = { count: 0, avg_rating: null };
  let marksCompletion = { complete: 0, total: 0 };

  if (semester) {
    const [[r1]] = await pool.execute(
      `SELECT
        SUM(status='Registered') AS registered,
        SUM(status='Enrolled') AS enrolled,
        SUM(status='Dropped') AS dropped
       FROM course_registrations
       WHERE semester = ?`,
      [semester],
    );
    regStats = {
      registered: Number(r1.registered || 0),
      enrolled: Number(r1.enrolled || 0),
      dropped: Number(r1.dropped || 0),
    };

    const [[f1]] = await pool.execute(
      `SELECT COUNT(*) AS count, ROUND(AVG(rating), 2) AS avg_rating
       FROM course_feedback
       WHERE semester = ?`,
      [semester],
    );
    fbStats = { count: Number(f1.count || 0), avg_rating: f1.avg_rating == null ? null : Number(f1.avg_rating) };

    const [[m1]] = await pool.execute(
      `SELECT
         SUM(CASE WHEN grade IS NOT NULL THEN 1 ELSE 0 END) AS complete,
         COUNT(*) AS total
       FROM enrollments
       WHERE semester = ?`,
      [semester],
    );
    marksCompletion = { complete: Number(m1.complete || 0), total: Number(m1.total || 0) };
  }

  return res.json({
    ok: true,
    semester: semester || null,
    counts: {
      students: Number(studentCount.n || 0),
      courses: Number(courseCount.n || 0),
    },
    registrations: regStats,
    feedback: fbStats,
    marks_completion: marksCompletion,
  });
});

module.exports = router;

