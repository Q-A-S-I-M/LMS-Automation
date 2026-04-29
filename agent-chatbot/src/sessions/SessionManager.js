import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";

/**
 * SessionManager is an in-memory session store with:
 * - strict per-session isolation (state is never shared across sessions)
 * - explicit TTL
 * - per-session locking to avoid concurrent mutation races
 *
 * IMPORTANT: This is intentionally instantiated and owned by the server bootstrap,
 * not as a module-level singleton, to avoid "global user state".
 */
export class SessionManager {
  constructor({ ttlMs = config.SESSION_TTL_MS } = {}) {
    this.ttlMs = ttlMs;
    this.sessions = new Map(); // sessionId -> { state, expiresAt }
    this.locks = new Map(); // sessionId -> Promise queue
  }

  createSession({ userId = null, role = null, isAuthenticated = false } = {}) {
    const sessionId = uuidv4();
    const now = Date.now();
    const expiresAt = now + this.ttlMs;

    const state = {
      sessionId,
      createdAt: now,
      updatedAt: now,
      // Identity & authorization
      userId, // Unified ID from LMS (roll_no for students, id for teachers)
      role, // "student" | "teacher" | null
      auth: {
        isAuthenticated,
        lmsCookies: [],
      },
      // Conversation and agent memory
      conversation: [], // [{role:"user"|"assistant"|"system", content, ts}]
      task: {
        activeIntent: null,
        lastIntent: null,
        pendingSlots: {}, // {paramName: {reason, askedAt}}
        lastAction: null,
      },
    };

    this.sessions.set(sessionId, { state, expiresAt });
    return { sessionId, token: this._signSessionToken(sessionId, expiresAt) };
  }

  verifyToken(token) {
    const payload = jwt.verify(token, config.SESSION_JWT_SECRET);
    if (!payload?.sid) throw new Error("Invalid session token");
    return { sessionId: payload.sid };
  }

  getSession(sessionId) {
    const entry = this.sessions.get(sessionId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.sessions.delete(sessionId);
      this.locks.delete(sessionId);
      return null;
    }
    return entry.state;
  }

  endSession(sessionId) {
    this.sessions.delete(sessionId);
    this.locks.delete(sessionId);
  }

  touch(sessionId) {
    const entry = this.sessions.get(sessionId);
    if (!entry) return;
    entry.expiresAt = Date.now() + this.ttlMs;
    entry.state.updatedAt = Date.now();
  }

  /**
   * Serialize session token into JWT for client cookie.
   * NOTE: We store state server-side; token is only a pointer.
   */
  _signSessionToken(sessionId, expiresAt) {
    return jwt.sign({ sid: sessionId, exp: Math.floor(expiresAt / 1000) }, config.SESSION_JWT_SECRET);
  }

  /**
   * Run a function with an exclusive per-session lock.
   * Prevents concurrent message processing corrupting the session state.
   */
  async withSessionLock(sessionId, fn) {
    const prev = this.locks.get(sessionId) || Promise.resolve();
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    this.locks.set(sessionId, prev.then(() => gate));

    await prev;
    try {
      return await fn();
    } finally {
      release();
      // Optional cleanup: if this was last queued operation, allow GC by removing lock
      // only if current lock equals "prev.then(gate)" is hard to check safely; keep simple.
    }
  }
}

