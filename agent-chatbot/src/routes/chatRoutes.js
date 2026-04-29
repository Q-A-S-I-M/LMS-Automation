import express from "express";
import { z } from "zod";
import { config } from "../config.js";

const chatSchema = z.object({
  message: z.string().min(1).max(4000),
});

export function chatRoutes({ sessions, agent }) {
  const router = express.Router();

  router.post("/chat", async (req, res) => {
    const token = req.cookies?.[config.SESSION_COOKIE_NAME];
    if (!token) return res.status(401).json({ ok: false, error: "Missing session cookie. Create a session first." });

    let sessionId;
    try {
      sessionId = sessions.verifyToken(token).sessionId;
    } catch {
      return res.status(401).json({ ok: false, error: "Invalid session cookie. Create a new session." });
    }

    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "Invalid body", details: parsed.error.flatten() });
    }

    const sessionState = sessions.getSession(sessionId);
    if (!sessionState) return res.status(401).json({ ok: false, error: "Session expired. Create a new session." });

    // SYNC AUTH: Capture all cookies from the incoming request to use for LMS API calls
    if (req.cookies) {
      const incomingCookies = Object.entries(req.cookies).map(([name, value]) => ({ name, value }));
      if (incomingCookies.length > 0) {
        // We merge them into the session's lmsCookies
        sessionState.auth.lmsCookies = mergeCookies(sessionState.auth.lmsCookies || [], incomingCookies);
        sessionState.auth.isAuthenticated = true; // If we have cookies, we assume we might be authenticated
      }
    }

    let out;
    try {
      out = await sessions.withSessionLock(sessionId, async () => {
        const result = await agent.processUserMessage({ sessionState, message: parsed.data.message });
        sessions.touch(sessionId);
        return result;
      });
    } catch (err) {
      const msg = String(err?.message || "");
      // Gemini key/config failures should be safe + actionable.
      if (msg.includes("API key not valid") || msg.includes("API_KEY_INVALID")) {
        return res.status(503).json({
          ok: false,
          error: "LLM configuration error: invalid Gemini API key. Set GEMINI_API_KEY in agent-chatbot/.env and restart.",
        });
      }
      if (msg.includes("Gemini returned non-JSON output")) {
        return res.status(502).json({
          ok: false,
          error: "LLM output parsing failed. Try again; if it persists, tighten the model prompt or response schema.",
        });
      }
      // Handle safety or quota or other transient LLM errors
      if (msg.includes("blocked") || msg.includes("safety") || msg.includes("quota") || msg.includes("503") || msg.includes("500")) {
        return res.status(503).json({
          ok: false,
          error: "The AI assistant is temporarily unavailable or blocked this request. Please try again with a different query.",
        });
      }
      return res.status(500).json({ ok: false, error: "Internal server error" });
    }

    return res.json({ ok: true, reply: out.reply, executed: out.executed, followups: out.followups });
  });

  return router;
}

function mergeCookies(oldCookies, newCookies) {
  const map = new Map((oldCookies || []).map((c) => [c.name, c]));
  for (const c of newCookies || []) map.set(c.name, c);
  return [...map.values()];
}

