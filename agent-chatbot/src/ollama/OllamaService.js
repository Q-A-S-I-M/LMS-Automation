import { config } from "../config.js";

/**
 * OllamaService is a structured planner using a local Ollama instance.
 * It provides the same interface as GeminiService.
 */
export class OllamaService {
  constructor({ 
    baseUrl = config.OLLAMA_BASE_URL, 
    model = config.OLLAMA_MODEL 
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.modelName = model;
  }

  /**
   * LAYER 1: INTENT DETECTION LAYER
   * STRICT JSON ONLY
   */
  async detectIntent({ capabilityMap, sessionState, userMessage }) {
    const intentSummaries = capabilityMap.getIntentSummaries().map(s => 
      `${s.intent}(${s.required_params.join(", ")})`
    ).join("\n");
    
    const authSummary = {
      role: sessionState.role,
      isAuthenticated: sessionState.auth?.isAuthenticated === true,
    };

    const systemPrompt = `
      You are an LMS Intent Detector. 
      Your ONLY job is to classify the user's message into an LMS intent and extract parameters.

      PROMPT RULES:
      - Output MUST be STRICT JSON ONLY.
      - No explanations. No natural language.
      - Extract parameters from the message.

      AVAILABLE_INTENTS (Required Parameters):
      ${intentSummaries}
      
      USER_CONTEXT:
      - Role: ${authSummary.role || "unknown"}
      - Authenticated: ${authSummary.isAuthenticated}

      OUTPUT_FORMAT:
      {
        "intent": "string",
        "confidence": number (0 to 1),
        "required_params": string[],
        "provided_params": object,
        "missing_params": string[],
        "requires_auth": boolean,
        "role": "student" | "teacher",
        "action": "api" | "selenium",
        "fallback_allowed": boolean
      }

      EXAMPLES:
      1. User: "login as student with roll 123 and pass abc"
         Response: {"intent": "student_login", "confidence": 1.0, "provided_params": {"identifier": "123", "password": "abc"}, "action": "selenium"}
      2. User: "show my courses for Spring-2026"
         Response: {"intent": "student_list_registration_available", "confidence": 0.95, "provided_params": {"semester": "Spring-2026"}, "action": "api"}
    `;

    const userPrompt = `
      USER_MESSAGE: "${userMessage}"
      LAST_INTENT: "${sessionState.task.lastIntent || "None"}"
      
      Return ONLY JSON.
    `;

    try {
      let parsed;
      let retries = 1;

      while (retries >= 0) {
        const text = await this._callOllama([
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]);
        
        try {
          parsed = this._safeParseJson(text);
          break;
        } catch (e) {
          if (retries === 0) throw e;
          retries--;
          console.warn("[OllamaService] Invalid JSON from Ollama, retrying once...");
        }
      }
      
      // Basic normalization
      if (!parsed.intent) parsed.intent = "unknown";
      if (typeof parsed.confidence !== "number") parsed.confidence = 0;
      
      // Use normalizePlan for consistency across providers
      return normalizePlan(parsed, { 
        capabilityMap, 
        authSummary 
      });
    } catch (err) {
      console.error("[OllamaService] detectIntent error after retries:", err.message);
      return { intent: "unknown", confidence: 0, required_params: [], provided_params: {}, missing_params: [], requires_auth: false, role: "student", action: "none", fallback_allowed: false };
    }
  }

  /**
   * LAYER 2: RESPONSE GENERATION LAYER
   * NATURAL LANGUAGE ONLY
   */
  async generateResponse({ userMessage, intent, data, error, sessionState }) {
    const systemPrompt = `
      You are a friendly LMS Assistant. 
      Convert backend data into a natural, human-like response.

      RULES:
      - Convert backend data into natural language.
      - NEVER return JSON.
      - NEVER mention APIs, backend, Selenium, or internal systems.
      - Keep responses user-friendly and short.
      - If error exists, provide a friendly message (e.g., "I couldn't find that record" instead of "404 Not Found").
      - If data is empty, say "No records found".
      - If missing params, ask the user clearly for them.
      
      USER_ROLE: ${sessionState.role}
    `;

    const userPrompt = `
      CONTEXT:
      - User Message: "${userMessage}"
      - Intent: "${intent}"
      - Backend Data: ${JSON.stringify(data)}
      - Error: ${error || "None"}
      - User Role: ${sessionState.role}

      Generate a natural assistant response:
    `;

    try {
      const text = await this._callOllama([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]);
      return text.trim();
    } catch (err) {
      console.error("[OllamaService] generateResponse error:", err.message);
      return "I'm sorry, I'm having trouble generating a response right now. How else can I help you?";
    }
  }

  async _callOllama(messages) {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: messages,
        stream: false,
        options: {
          temperature: 0.1, // Low temperature for consistent JSON/responses
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  _safeParseJson(text) {
    const cleaned = String(text || "")
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      const err = new Error("Ollama returned non-JSON output");
      err.cause = e;
      err.raw = text;
      throw err;
    }
  }
}

function normalizePlan(plan, { capabilityMap, authSummary }) {
  const out = {
    intent: String(plan?.intent || "").trim(),
    confidence: clamp01(Number(plan?.confidence)),
    required_params: Array.isArray(plan?.required_params) ? plan.required_params.map(String) : [],
    provided_params: {},
    missing_params: Array.isArray(plan?.missing_params) ? plan.missing_params.map(String) : [],
    requires_auth: Boolean(plan?.requires_auth),
    role: plan?.role === "teacher" ? "teacher" : "student",
    action: plan?.action === "selenium" ? "selenium" : "api",
    fallback_allowed: Boolean(plan?.fallback_allowed),
    message: String(plan?.message || "").trim(),
  };

  // Clean provided_params
  if (plan?.provided_params && typeof plan.provided_params === "object") {
    for (const [k, v] of Object.entries(plan.provided_params)) {
      const val = String(v || "").trim();
      if (val && val !== "...") {
        out.provided_params[k] = val;
      }
    }
  }

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
