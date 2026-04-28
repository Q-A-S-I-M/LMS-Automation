import express from "express";
import { config } from "../config.js";

export function sessionRoutes({ sessions }) {
  const router = express.Router();

  // Create session and set cookie
  router.post("/session", (req, res) => {
    const { token } = sessions.createSession({ userHint: req.body?.userHint || null });
    res.cookie(config.SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: config.SESSION_TTL_MS,
    });
    return res.json({ ok: true });
  });

  router.post("/session/end", (req, res) => {
    const token = req.cookies?.[config.SESSION_COOKIE_NAME];
    if (token) {
      try {
        const { sessionId } = sessions.verifyToken(token);
        sessions.endSession(sessionId);
      } catch {
        // ignore
      }
    }
    res.clearCookie(config.SESSION_COOKIE_NAME, { path: "/" });
    return res.json({ ok: true });
  });

  return router;
}

