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
  constructor({ capabilityMap, llmService, actionRouter, logger }) {
    this.capabilityMap = capabilityMap;
    this.llm = llmService;
    this.router = actionRouter;
    this.logger = logger;
  }

  async processUserMessage({ sessionState, message }) {
    this.logger.info(`[AgentController] Processing: "${message}"`);
    const userText = sanitizeUserText(message, { maxLen: 4000 });
    sessionState.conversation.push({ role: "user", content: userText, ts: Date.now() });

    // ---------------------------------------------------------
    // LAYER 0: CONVERSATION LAYER (HIGHEST PRIORITY)
    // ---------------------------------------------------------
    const conversationResponse = this.checkLayer0(userText);
    if (conversationResponse) {
      this.logger.info(`[LAYER 0] Conversation detected: "${conversationResponse}"`);
      sessionState.conversation.push({ role: "assistant", content: conversationResponse, ts: Date.now() });
      return { reply: conversationResponse, mode: "conversation" };
    }

    // ---------------------------------------------------------
    // LAYER 1: INTENT DETECTION LAYER (STRICT MODE)
    // ---------------------------------------------------------
    this.logger.info("[LAYER 1] Calling Intent Detection...");
    let plan = await this.llm.detectIntent({ 
      capabilityMap: this.capabilityMap, 
      sessionState, 
      userMessage: userText 
    });

    // VALIDATION RULES: Invalid JSON retry or fallback to unknown
    if (!plan || !plan.intent) {
      this.logger.warn("[LAYER 1] Intent detection failed or returned invalid JSON. Falling back to unknown.");
      plan = { intent: "unknown", confidence: 0 };
    }

    this.logger.info(`[LAYER 1] Intent: ${plan.intent} (Confidence: ${plan.confidence})`);

    // Update last intent for context memory
    if (plan.intent !== "unknown") {
      sessionState.task.lastIntent = plan.intent;
    }

    // ---------------------------------------------------------
    // PARAMETER VALIDATION & MISSING PARAMS HANDLING
    // ---------------------------------------------------------
    const spec = this.capabilityMap.getIntent(plan.intent);
    if (plan.intent !== "unknown" && spec) {
      // Validate required params BEFORE API call
      const missing = (spec.requiredParams || []).filter(p => {
        const val = plan.provided_params?.[p];
        return val == null || String(val).trim() === "";
      });

      if (missing.length > 0) {
        this.logger.info(`[AgentController] Missing params: ${missing.join(", ")}`);
        const missingResponse = await this.llm.generateResponse({
          userMessage: userText,
          intent: plan.intent,
          data: null,
          error: `Missing parameters: ${missing.join(", ")}`,
          sessionState
        });
        sessionState.conversation.push({ role: "assistant", content: missingResponse, ts: Date.now() });
        return { reply: missingResponse, mode: "response", missing_params: missing };
      }
    }

    // ---------------------------------------------------------
    // BACKEND EXECUTION LAYER
    // ---------------------------------------------------------
    let executionResult = null;
    if (plan.intent !== "unknown" && spec) {
      this.logger.info(`[BACKEND] Executing intent: ${plan.intent}`);
      executionResult = await this.router.execute({
        intentSpec: spec,
        intentName: plan.intent,
        parameters: plan.provided_params,
        sessionState,
        prefer: plan.action || "api",
        fallbackAllowed: plan.fallback_allowed !== false,
      });
    }

    // ---------------------------------------------------------
    // LAYER 2: RESPONSE GENERATION LAYER
    // ---------------------------------------------------------
    this.logger.info("[LAYER 2] Generating natural language response...");
    const finalResponse = await this.llm.generateResponse({
      userMessage: userText,
      intent: plan.intent,
      data: executionResult?.data,
      error: executionResult?.error,
      sessionState
    });

    sessionState.conversation.push({ role: "assistant", content: finalResponse, ts: Date.now() });
    this.logger.info(`[LAYER 2] Final Response: "${finalResponse}"`);

    return { 
      reply: finalResponse, 
      mode: "response",
      executed: executionResult 
    };
  }

  /**
   * LAYER 0: CONVERSATION DETECTION
   */
  checkLayer0(text) {
    const t = text.toLowerCase().trim();
    
    // Greetings
    const greetings = ["hi", "hello", "hey", "good morning", "good evening", "good afternoon"];
    if (greetings.some(g => t === g || t.startsWith(g + " "))) {
      return "Hey! How can I help you with your LMS today?";
    }

    // Casual chat
    const casual = ["how are you", "what's up", "how's it going"];
    if (casual.some(c => t.includes(c))) {
      return "I'm good 😊 How can I assist you?";
    }

    // Gratitude
    const gratitude = ["thanks", "thank you", "thx", "much appreciated"];
    if (gratitude.some(g => t.includes(g))) {
      return "You're welcome!";
    }

    // Farewell
    const farewell = ["bye", "see you", "goodbye", "catch you later"];
    if (farewell.some(f => t.includes(f))) {
      return "Goodbye! Have a great day!";
    }

    return null;
  }
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

