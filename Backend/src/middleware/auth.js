const jwt = require("jsonwebtoken");

function getTokenFromReq(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme === "Bearer" && token) return token;
  const cookieToken = req.cookies?.up_at;
  if (cookieToken) return cookieToken;
  return null;
}

function authRequired(req, res, next) {
  const token = getTokenFromReq(req);
  if (!token) {
    return res.status(401).json({ ok: false, error: "Missing auth token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // payload: { role: "student"|"teacher", roll_no? , teacher_id? }
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: "Invalid or expired token" });
  }
}

function authOptional(req, _res, next) {
  const token = getTokenFromReq(req);
  if (!token) return next();
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    // ignore invalid token
  }
  return next();
}

function requireStudent(req, res, next) {
  const role = req.user?.role || "student"; // backward compatible tokens
  if (role !== "student" || !req.user?.roll_no) {
    return res.status(403).json({ ok: false, error: "Student access required" });
  }
  return next();
}

function requireTeacher(req, res, next) {
  if (req.user?.role !== "teacher" || !req.user?.teacher_id) {
    return res.status(403).json({ ok: false, error: "Teacher access required" });
  }
  return next();
}

module.exports = { authRequired, authOptional, requireStudent, requireTeacher };

