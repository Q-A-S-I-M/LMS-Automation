import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";

/**
 * GeminiService is a structured planner.
 * It never executes actions; it only returns a plan in the required JSON format.
 */
export class GeminiService {
  constructor({ apiKey = config.GEMINI_API_KEY, model = config.GEMINI_MODEL, apiVersion = config.GEMINI_API_VERSION } = {}) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = model;
    this.apiVersion = apiVersion;
  }

  /**
   * REQUIRED OUTPUT FORMAT:
   * {
   *  "intent": "string",
   *  "confidence": 0-1,
   *  "required_params": [],
   *  "provided_params": {},
   *  "missing_params": [],
   *  "requires_auth": true/false,
   *  "role": "student|teacher",
   *  "action": "api|selenium",
   *  "fallback_allowed": true/false
   * }
   */
  async proposePlan({ capabilityMap, sessionState, userMessage }) {
    const model = this.client.getGenerativeModel({ model: this.modelName }, { apiVersion: this.apiVersion });

    const allowedIntents = capabilityMap.listIntents();
    const authSummary = {
      role: sessionState.role,
      isAuthenticated: sessionState.auth?.isAuthenticated === true,
    };

    const system = [
      "You are an agent planner for an LMS assistant.",
      "SINGLE SOURCE OF TRUTH: You MUST ONLY select an intent from ALLOWED_INTENTS.",
      "You MUST NOT invent intents, parameters, endpoints, or capabilities not present in ALLOWED_INTENTS.",
      "CRITICAL: If the user message is a greeting (like 'hello', 'hi', 'hey'), small talk, or is unrelated to LMS actions, you MUST return an empty string \"\" for the 'intent' field. DO NOT guess an intent.",
      "Role control: output role must be exactly 'student' or 'teacher'.",
      "If session is already authenticated with a known role, prefer that role unless user explicitly requests switching.",
      "Select action 'api' by default. Use 'selenium' only when explicitly needed (e.g., web-only tasks) or as fallback.",
      "Output MUST be ONLY JSON in the exact required format (no markdown, no prose).",
    ].join("\n");

    const requiredFormat = {
      intent: "string",
      confidence: "number (0..1)",
      required_params: "string[]",
      provided_params: "object",
      missing_params: "string[]",
      requires_auth: "boolean",
      role: "student|teacher",
      action: "api|selenium",
      fallback_allowed: "boolean",
    };

    const prompt = [
      system,
      "",
      "AUTH_STATE:",
      JSON.stringify(authSummary, null, 2),
      "",
      "ALLOWED_INTENTS:",
      JSON.stringify(allowedIntents),
      "",
      "CAPABILITY_HINTS:",
      "If user says: marks -> student_view_marks, attendance -> student_view_attendance, transcript -> student_view_transcript, register course -> student_register_course, drop/unregister -> student_unregister_course.",
      "Teacher uploading marks -> teacher_upsert_marks.",
      "",
      "LAST_FEW_MESSAGES:",
      JSON.stringify(sessionState.conversation.slice(-12), null, 2),
      "",
      "USER_MESSAGE:",
      userMessage,
      "",
      "REQUIRED_OUTPUT_FORMAT:",
      JSON.stringify(requiredFormat, null, 2),
      "",
      "Return ONLY JSON now (no extra keys).",
    ].join("\n");

    console.log("[GeminiService] Sending prompt to Gemini...");
    try {
      const res = await model.generateContent(prompt);
      const text = res.response.text();
      console.log("[GeminiService] Raw response from Gemini:", text);
      const parsed = safeParseJson(text);
      const normalized = normalizePlan(parsed, { capabilityMap, authSummary });
      console.log("[GeminiService] Normalized plan:", JSON.stringify(normalized, null, 2));
      return normalized;
    } catch (err) {
      console.error("[GeminiService] Gemini API error:", err);
      throw err;
    }
  }
}

function safeParseJson(text) {
  // Gemini sometimes wraps in ```json ...```
  const cleaned = String(text || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const err = new Error("Gemini returned non-JSON output");
    err.cause = e;
    err.raw = text;
    throw err;
  }
}

function normalizePlan(plan, { capabilityMap, authSummary }) {
  const out = {
    intent: String(plan?.intent || "").trim(),
    confidence: clamp01(Number(plan?.confidence)),
    required_params: Array.isArray(plan?.required_params) ? plan.required_params.map(String) : [],
    provided_params: plan?.provided_params && typeof plan.provided_params === "object" ? plan.provided_params : {},
    missing_params: Array.isArray(plan?.missing_params) ? plan.missing_params.map(String) : [],
    requires_auth: Boolean(plan?.requires_auth),
    role: plan?.role === "teacher" ? "teacher" : "student",
    action: plan?.action === "selenium" ? "selenium" : "api",
    fallback_allowed: Boolean(plan?.fallback_allowed),
  };

  // Hard safety: if intent not allowed, blank it so controller can refuse/ask.
  if (!capabilityMap.hasIntent(out.intent)) {
    out.intent = "";
    out.confidence = 0;
  }

  // Ground truth override for requires_auth + required params (capability map wins).
  if (out.intent) {
    const spec = capabilityMap.getIntent(out.intent);
    if (spec) {
      out.required_params = spec.requiredParams || [];
      out.requires_auth = spec.requiresAuth !== "none";
      // If already authenticated with a role, keep it (prevents cross-role leakage).
      if (authSummary.isAuthenticated && (authSummary.role === "student" || authSummary.role === "teacher")) {
        out.role = authSummary.role;
      }
      const missing = (spec.requiredParams || []).filter((p) => {
        const v = out.provided_params?.[p];
        return v == null || String(v).trim() === "";
      });
      out.missing_params = missing;
    }
  }

  return out;
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

