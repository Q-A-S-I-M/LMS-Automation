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
   * LAYER 1: INTENT DETECTION LAYER
   * STRICT JSON ONLY
   */
  async detectIntent({ capabilityMap, sessionState, userMessage }) {
    const model = this.client.getGenerativeModel({ model: this.modelName }, { apiVersion: this.apiVersion });

    const allowedIntents = capabilityMap.listIntents();
    const authSummary = {
      role: sessionState.role,
      isAuthenticated: sessionState.auth?.isAuthenticated === true,
    };

    const systemPrompt = `
      You are an LMS Intent Detector. 
      Your ONLY job is to classify the user's message into an LMS intent.

      PROMPT RULES:
      - Output MUST be STRICT JSON ONLY.
      - No explanations.
      - No natural language.

      ALLOWED_INTENTS: ${JSON.stringify(allowedIntents)}
      
      USER_ROLE: ${authSummary.role || "unknown"}
      IS_AUTHENTICATED: ${authSummary.isAuthenticated}

      OUTPUT_FORMAT:
      {
        "intent": "string",
        "confidence": number (0 to 1),
        "required_params": string[],
        "provided_params": object,
        "missing_params": string[],
        "requires_auth": boolean,
        "role": "student" | "teacher",
        "action": "api" | "none",
        "fallback_allowed": boolean
      }

      VALIDATION RULES:
      - If intent is missing or unknown, set intent to "unknown".
      - Confidence must be between 0 and 1.
    `;

    const prompt = `
      ${systemPrompt}

      USER_MESSAGE: "${userMessage}"
      LAST_INTENT: "${sessionState.task.lastIntent || "None"}"
      
      Return ONLY JSON.
    `;

    try {
      let text;
      let parsed;
      let retries = 1;

      while (retries >= 0) {
        const res = await model.generateContent(prompt);
        text = res.response.text();
        try {
          parsed = safeParseJson(text);
          break;
        } catch (e) {
          if (retries === 0) throw e;
          retries--;
          console.warn("[GeminiService] Invalid JSON from Gemini, retrying once...");
        }
      }
      
      // Basic normalization
      if (!parsed.intent) parsed.intent = "unknown";
      if (typeof parsed.confidence !== "number") parsed.confidence = 0;
      
      return parsed;
    } catch (err) {
      console.error("[GeminiService] detectIntent error after retries:", err.message);
      return { intent: "unknown", confidence: 0, required_params: [], provided_params: {}, missing_params: [], requires_auth: false, role: "student", action: "none", fallback_allowed: false };
    }
  }

  /**
   * LAYER 2: RESPONSE GENERATION LAYER
   * NATURAL LANGUAGE ONLY
   */
  async generateResponse({ userMessage, intent, data, error, sessionState }) {
    const model = this.client.getGenerativeModel({ model: this.modelName }, { apiVersion: this.apiVersion });

    const systemPrompt = `
      You are a friendly LMS Assistant. 
      Convert backend data into a natural, human-like response.

      RULES:
      - Convert backend data into natural language.
      - NEVER return JSON.
      - NEVER mention APIs or backend or internal systems.
      - Keep responses user-friendly and short.
      - If error exists, provide a friendly message (e.g., "I couldn't find that record" instead of "404 Not Found").
      - If data is empty, say "No records found".
      - If missing params, ask the user clearly for them.
    `;

    const prompt = `
      ${systemPrompt}

      CONTEXT:
      - User Message: "${userMessage}"
      - Intent: "${intent}"
      - Backend Data: ${JSON.stringify(data)}
      - Error: ${error || "None"}
      - User Role: ${sessionState.role}

      Generate a natural assistant response:
    `;

    try {
      const res = await model.generateContent(prompt);
      return res.response.text().trim();
    } catch (err) {
      console.error("[GeminiService] generateResponse error:", err.message);
      return "I'm sorry, I'm having trouble generating a response right now. How else can I help you?";
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
    message: String(plan?.message || "").trim(),
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

