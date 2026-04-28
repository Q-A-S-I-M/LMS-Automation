import { sanitizeUserText } from "../utils/text.js";

/**
 * AgentController:
 * - calls Gemini for structured plan (intent + slots)
 * - validates intent strictly against capability map
 * - runs an agentic loop:
 *   - ensure auth (auto-trigger login if credentials cached)
 *   - ask for missing params
 *   - execute API-first with selenium fallback when allowed
 *   - retry (bounded) when safe
 */
export class AgentController {
  constructor({ capabilityMap, geminiService, actionRouter, logger }) {
    this.capabilityMap = capabilityMap;
    this.gemini = geminiService;
    this.router = actionRouter;
    this.logger = logger;
  }

  async processUserMessage({ sessionState, message }) {
    console.log(`[AgentController] Processing message: "${message}" for session: ${sessionState.sessionId}`);
    const userText = sanitizeUserText(message, { maxLen: 4000 });
    sessionState.conversation.push({ role: "user", content: userText, ts: Date.now() });

    console.log("[AgentController] Calling Gemini for plan...");
    const plan = await this.gemini.proposePlan({ capabilityMap: this.capabilityMap, sessionState, userMessage: userText });
    console.log("[AgentController] Gemini Plan:", JSON.stringify(plan, null, 2));
    const intentName = plan.intent;

    if (!intentName) {
      console.log("[AgentController] No intent detected.");
      const msg = "I can help with LMS actions like registration, marks, attendance, transcript, or teacher uploads. What would you like to do?";
      sessionState.conversation.push({ role: "assistant", content: msg, ts: Date.now() });
      return { reply: msg, executed: null, followups: [] };
    }

    const spec = this.capabilityMap.getIntent(intentName);
    if (!spec) {
      console.warn(`[AgentController] Intent "${intentName}" not found in capability map.`);
      const msg = "I can’t perform that action in this LMS (not in the capability map).";
      sessionState.conversation.push({ role: "assistant", content: msg, ts: Date.now() });
      return { reply: msg, executed: null, followups: [] };
    }

    // Agentic loop (bounded)
    const MAX_RETRIES = 2;
    let params = plan.provided_params || {};

    // Cache credentials if user is logging in
    if (intentName === "student_login" && params.identifier && params.password) {
      console.log("[AgentController] Caching student credentials");
      sessionState.auth.credentials.student = { identifier: String(params.identifier), password: String(params.password) };
    }
    if (intentName === "teacher_login" && params.identifier && params.password) {
      console.log("[AgentController] Caching teacher credentials");
      sessionState.auth.credentials.teacher = { identifier: String(params.identifier), password: String(params.password) };
    }

    // Ensure role is set during login intents
    if (intentName === "student_login") sessionState.role = "student";
    if (intentName === "teacher_login") sessionState.role = "teacher";

    // Missing params -> ask friendly questions (no raw param names if we can help it)
    if (plan.missing_params?.length) {
      console.log("[AgentController] Missing parameters:", plan.missing_params);
      const msg = buildMissingParamsPrompt(intentName, plan.missing_params);
      sessionState.conversation.push({ role: "assistant", content: msg, ts: Date.now() });
      return { reply: msg, executed: null, followups: plan.missing_params };
    }

    // Auth gate: if required and not authenticated, try auto-login if credentials cached; else ask.
    if (spec.requiresAuth !== "none" && !sessionState.auth.isAuthenticated) {
      console.log("[AgentController] Auth required. Attempting auto-login...");
      const auto = await this._tryAutoLogin({ sessionState });
      if (!auto.ok) {
        console.log("[AgentController] Auto-login failed or credentials missing.");
        const msg = sessionState.role === "teacher"
          ? "You’re not logged in. Please provide your teacher username/email and password."
          : "You’re not logged in. Please provide your roll no/email and password.";
        sessionState.conversation.push({ role: "assistant", content: msg, ts: Date.now() });
        return { reply: msg, executed: null, followups: [] };
      }
      console.log("[AgentController] Auto-login successful.");
    }

    // Execute with retries + API-first fallback.
    let last = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      const prefer = plan.action === "selenium" ? "selenium" : "api";
      console.log(`[AgentController] Execution attempt ${attempt + 1}/${MAX_RETRIES + 1} (mode: ${prefer}, fallback: ${plan.fallback_allowed !== false})`);
      
      const result = await this.router.execute({
        intentSpec: spec,
        intentName,
        parameters: params,
        sessionState,
        prefer,
        fallbackAllowed: plan.fallback_allowed !== false,
      });
      last = result;

      console.log(`[AgentController] Execution result:`, JSON.stringify(result, null, 2));

      // Update session auth flags on successful login/logout/register
      if (intentName === "student_login" && result.ok) sessionState.auth.isAuthenticated = true;
      if (intentName === "teacher_login" && result.ok) sessionState.auth.isAuthenticated = true;
      if (intentName === "student_register" && result.ok) {
        sessionState.role = "student";
        sessionState.auth.isAuthenticated = true;
      }
      if (intentName === "logout" && result.ok) {
        sessionState.role = null;
        sessionState.auth.isAuthenticated = false;
        sessionState.auth.lmsCookies = [];
      }

      if (result.ok) break;

      // If unauthorized, attempt re-login once (using cached creds).
      if (isAuthError(result) && attempt < MAX_RETRIES) {
        sessionState.auth.isAuthenticated = false;
        const auto = await this._tryAutoLogin({ sessionState });
        if (auto.ok) continue;
      }

      // Otherwise, retry only once for transient-ish failures.
      if (attempt < MAX_RETRIES && isRetryable(result)) continue;
      break;
    }

    const reply = buildHumanFriendlyReply({ intentName, result: last });
    sessionState.conversation.push({ role: "assistant", content: reply, ts: Date.now() });
    sessionState.task.lastAction = { intentName, at: Date.now(), ok: Boolean(last?.ok) };
    return { reply, executed: { intent: intentName, result: last }, followups: [] };
  }

  async _tryAutoLogin({ sessionState }) {
    const role = sessionState.role;
    if (role === "teacher") {
      const c = sessionState.auth.credentials.teacher;
      if (!c?.identifier || !c?.password) return { ok: false, error: "Missing cached teacher credentials" };
      const spec = this.capabilityMap.getIntent("teacher_login");
      const res = await this.router.execute({
        intentSpec: spec,
        intentName: "teacher_login",
        parameters: { identifier: c.identifier, password: c.password },
        sessionState,
        prefer: "api",
        fallbackAllowed: true,
      });
      if (res.ok) sessionState.auth.isAuthenticated = true;
      return res;
    }

    // default to student
    const c = sessionState.auth.credentials.student;
    if (!c?.identifier || !c?.password) return { ok: false, error: "Missing cached student credentials" };
    const spec = this.capabilityMap.getIntent("student_login");
    const res = await this.router.execute({
      intentSpec: spec,
      intentName: "student_login",
      parameters: { identifier: c.identifier, password: c.password },
      sessionState,
      prefer: "api",
      fallbackAllowed: true,
    });
    if (res.ok) {
      sessionState.role = "student";
      sessionState.auth.isAuthenticated = true;
    }
    return res;
  }
}

function buildMissingParamsPrompt(intentName, missing) {
  const m = new Set(missing || []);
  // Friendly prompts for high-value flows.
  if (intentName === "student_register_course") {
    if (m.has("semester") && m.has("course_code")) return "Which semester and which course code would you like to register (e.g., Spring-2026 and CS101)?";
    if (m.has("semester")) return "Which semester is this for? (e.g., Spring-2026)";
    if (m.has("course_code")) return "Which course code would you like to register? (e.g., CS101)";
  }
  if (intentName === "student_unregister_course") {
    if (m.has("semester") && m.has("course_code")) return "Which semester and course code should I drop/unregister?";
    if (m.has("semester")) return "Which semester is this for?";
    if (m.has("course_code")) return "Which course code should I drop/unregister?";
  }
  if (intentName === "student_view_marks" || intentName === "student_view_attendance") {
    if (m.has("semester") && m.has("course_code")) return "Which semester and course code should I use?";
    if (m.has("semester")) return "Which semester is this for?";
    if (m.has("course_code")) return "Which course code is this for?";
  }
  if (intentName === "student_login") return "Please provide your roll no/email and password.";
  if (intentName === "teacher_login") return "Please provide your teacher username/email and password.";
  return `I need a bit more info: ${[...m].join(", ")}.`;
}

function buildHumanFriendlyReply({ intentName, result }) {
  if (!result) return "I couldn’t run that action.";
  if (result.ok) {
    switch (intentName) {
      case "student_register":
        return "Your student account is created and you’re logged in.";
      case "student_login":
        return "You’re logged in as a student.";
      case "teacher_login":
        return "You’re logged in as a teacher.";
      case "student_register_course":
        return `Course registered successfully (${result.mode}).`;
      case "student_unregister_course":
        return `Course unregistered successfully (${result.mode}).`;
      case "student_view_marks":
        return `Here are your marks (${result.mode}).`;
      case "student_view_attendance":
        return `Here is your attendance (${result.mode}).`;
      case "logout":
        return "Logged out.";
      default:
        return `Done (${result.mode}).`;
    }
  }
  const base = result.error || "Action failed.";
  if (result.attempts?.length) {
    return `I couldn’t complete that. I tried: ${result.attempts.map((a) => `${a.mode}${a.ok ? "" : "✗"}`).join(" → ")}.\nError: ${base}`;
  }
  return `I couldn’t complete that.\nError: ${base}`;
}

function isAuthError(result) {
  const status = result?.status;
  if (status === 401 || status === 403) return true;
  const msg = String(result?.error || "").toLowerCase();
  return msg.includes("missing auth token") || msg.includes("not authenticated") || msg.includes("invalid or expired token");
}

function isRetryable(result) {
  const status = result?.status;
  if (status == null) return true;
  if (status >= 500) return true;
  const msg = String(result?.error || "").toLowerCase();
  return msg.includes("timeout") || msg.includes("network") || msg.includes("temporar");
}

