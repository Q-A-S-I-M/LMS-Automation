const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");
const { authOptional } = require("../middleware/auth");

const router = express.Router();

function optionalText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function setAccessCookie(res, token) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("up_at", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

function clearAccessCookie(res) {
  res.clearCookie("up_at", { path: "/" });
}

// POST /api/auth/register
// body: { roll_no, full_name, email, password, degree, section, batch, campus, dob, cnic, blood_group, nationality }
router.post("/register", async (req, res) => {
  const {
    roll_no,
    full_name,
    email,
    password,
    degree,
    section,
    batch,
    campus,
    dob,
    cnic,
    blood_group,
    nationality,
  } = req.body || {};

  if (!roll_no || !full_name || !email || !password) {
    return res.status(400).json({
      ok: false,
      error: "roll_no, full_name, email, and password are required",
    });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ ok: false, error: "Password must be at least 6 characters" });
  }

  const password_hash = await bcrypt.hash(String(password), 10);

  try {
    await pool.execute(
      `INSERT INTO students
        (roll_no, full_name, email, password_hash, degree, section, batch, campus, dob, cnic, blood_group, nationality, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Current')`,
      [
        String(roll_no).trim(),
        String(full_name).trim(),
        String(email).trim(),
        password_hash,
        optionalText(degree),
        optionalText(section),
        optionalText(batch),
        optionalText(campus),
        optionalText(dob),
        optionalText(cnic),
        optionalText(blood_group),
        optionalText(nationality),
      ],
    );
  } catch (err) {
    const msg = String(err?.message || "");
    if (err?.code === "ER_DUP_ENTRY" || msg.includes("Duplicate")) {
      return res.status(409).json({ ok: false, error: "Roll no or email already exists" });
    }
    if (err?.code === "ER_TRUNCATED_WRONG_VALUE" || err?.code === "ER_WRONG_VALUE_FOR_TYPE") {
      return res.status(400).json({ ok: false, error: "Invalid field value in registration form" });
    }
    console.error("Register error:", err?.code || "UNKNOWN", err?.message || err);
    return res.status(500).json({ ok: false, error: "Failed to register student" });
  }

  // auto login after register
  const token = jwt.sign({ role: "student", roll_no: String(roll_no).trim() }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
  setAccessCookie(res, token);

  return res.status(201).json({
    ok: true,
    role: "student",
    student: { roll_no: String(roll_no).trim(), email: String(email).trim(), full_name },
  });
});

// POST /api/auth/login
// body: { roll_no: "20CS001" or email: "...", password: "..." }
router.post("/login", async (req, res) => {
  const { roll_no, email, password } = req.body || {};

  if (!password || (!roll_no && !email)) {
    return res.status(400).json({
      ok: false,
      error: "Provide (roll_no or email) and password",
    });
  }

  const [rows] = await pool.execute(
    `SELECT roll_no, email, full_name, password_hash
     FROM students
     WHERE roll_no = ? OR email = ?
     LIMIT 1`,
    [roll_no || null, email || null],
  );

  if (!rows.length) {
    return res.status(401).json({ ok: false, error: "Invalid credentials" });
  }

  const student = rows[0];
  const match = await bcrypt.compare(String(password), String(student.password_hash || ""));
  if (!match) {
    return res.status(401).json({ ok: false, error: "Invalid credentials" });
  }

  const token = jwt.sign({ role: "student", roll_no: student.roll_no }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
  setAccessCookie(res, token);

  return res.json({
    ok: true,
    role: "student",
    student: {
      roll_no: student.roll_no,
      email: student.email,
      full_name: student.full_name,
    },
  });
});

// POST /api/auth/teacher/login
// body: { username or email, password }
router.post("/teacher/login", async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!password || (!username && !email)) {
    return res.status(400).json({ ok: false, error: "Provide (username or email) and password" });
  }

  const [rows] = await pool.execute(
    `SELECT id, username, email, full_name, password_hash
     FROM teachers
     WHERE username = ? OR email = ?
     LIMIT 1`,
    [username || null, email || null],
  );

  if (!rows.length) return res.status(401).json({ ok: false, error: "Invalid credentials" });
  const t = rows[0];
  const match = await bcrypt.compare(String(password), String(t.password_hash || ""));
  if (!match) return res.status(401).json({ ok: false, error: "Invalid credentials" });

  const token = jwt.sign({ role: "teacher", teacher_id: t.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
  setAccessCookie(res, token);
  return res.json({
    ok: true,
    role: "teacher",
    teacher: { id: t.id, username: t.username, email: t.email, full_name: t.full_name },
  });
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  clearAccessCookie(res);
  return res.json({ ok: true });
});

// GET /api/auth/me (cookie-based)
router.get("/me", authOptional, async (req, res) => {
  const role = req.user?.role;
  if (!role) return res.status(401).json({ ok: false, error: "Not authenticated" });

  if (role === "student") {
    const rollNo = req.user.roll_no;
    const [rows] = await pool.execute(
      `SELECT roll_no, full_name, email
       FROM students
       WHERE roll_no = ?
       LIMIT 1`,
      [rollNo],
    );
    if (!rows.length) return res.status(401).json({ ok: false, error: "Invalid session" });
    return res.json({ ok: true, role: "student", student: rows[0] });
  }

  if (role === "teacher") {
    const teacherId = req.user.teacher_id;
    const [rows] = await pool.execute(
      `SELECT id, username, email, full_name
       FROM teachers
       WHERE id = ?
       LIMIT 1`,
      [teacherId],
    );
    if (!rows.length) return res.status(401).json({ ok: false, error: "Invalid session" });
    return res.json({ ok: true, role: "teacher", teacher: rows[0] });
  }

  return res.status(401).json({ ok: false, error: "Invalid role" });
});

module.exports = router;

