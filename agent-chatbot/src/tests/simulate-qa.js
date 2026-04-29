import { AgentController } from "../agents/AgentController.js";
import { GeminiService } from "../gemini/GeminiService.js";
import { ActionRouter } from "../agents/ActionRouter.js";
import { CapabilityMap } from "../lms/CapabilityMap.js";
import { logger } from "../logger.js";
import path from "node:path";

// Mock ApiExecutor to return specific data for the test scenario
class MockApiExecutor {
  async execute({ intentName, parameters, sessionState }) {
    console.log(`[MockApiExecutor] Executing ${intentName} with params:`, parameters);
    
    if (intentName === "student_list_my_registrations" || intentName === "student_list_registration_available") {
      if (parameters.semester === "Spring-2026") {
        return {
          ok: true,
          status: 200,
          data: {
            ok: true,
            semester: "Spring-2026",
            registrations: [
              { course_code: "CS101", course_name: "Introduction to Computer Science" },
              { course_code: "MT101", course_name: "Calculus I" }
            ],
            courses: [
              { course_code: "CS101", course_name: "Introduction to Computer Science" },
              { course_code: "MT101", course_name: "Calculus I" }
            ]
          }
        };
      }
    }
    return { ok: false, error: "Mock API error" };
  }
}

// Mock GeminiService to avoid 503 errors during simulation
class MockGeminiService {
  async detectIntent({ userMessage, sessionState }) {
    const msg = userMessage.toLowerCase();
    if (msg.includes("registrations")) {
      return {
        intent: "student_list_my_registrations",
        confidence: 0.95,
        provided_params: {},
        action: "api"
      };
    }
    if (msg.includes("spring-2026")) {
      return {
        intent: "student_list_my_registrations",
        confidence: 0.95,
        provided_params: { semester: "Spring-2026" },
        action: "api"
      };
    }
    return { intent: "unknown", confidence: 0 };
  }

  async generateResponse({ userMessage, intent, data, error, sessionState }) {
    if (error && error.includes("Missing parameters")) {
      return "To show you your registrations, could you please tell me which semester you're interested in?";
    }
    if (data && data.registrations) {
      const list = data.registrations.map(r => `- ${r.course_code}`).join("\n");
      return `You are registered in the following courses:\n${list}`;
    }
    return "I'm sorry, I couldn't find any information.";
  }
}

async function runQASimulation() {
  const repoRoot = path.resolve("..");
  const capabilityMap = await CapabilityMap.loadFromRepoRoot({ repoRoot });
  
  const gemini = new MockGeminiService(); // Using Mocked Gemini
  const apiExecutor = new MockApiExecutor();
  const router = new ActionRouter({ apiExecutor });
  
  const controller = new AgentController({
    capabilityMap,
    geminiService: gemini,
    actionRouter: router,
    logger
  });

  const sessionState = {
    sessionId: "qa-session-123",
    role: "student",
    auth: { isAuthenticated: true },
    conversation: [],
    task: { lastIntent: null }
  };

  const trace = [];

  async function step(message) {
    console.log(`\n--- USER: "${message}" ---`);
    const result = await controller.processUserMessage({ sessionState, message });
    console.log(`--- ASSISTANT: "${result.reply}" ---`);
    trace.push({ user: message, assistant: result.reply, mode: result.mode });
    return result;
  }

  try {
    // STEP 1: Greeting
    await step("Hi");

    // STEP 2: Intent detection for registrations
    await step("I want to see my registrations");

    // STEP 3: Provide missing parameter
    await step("Spring-2026");

    // FINAL VERDICT
    console.log("\n=====================================");
    console.log("TEST VERDICT");
    console.log("=====================================");
    
    let pass = true;
    const errors = [];

    // Validation 1: Step 1 should be conversation mode
    if (trace[0].mode !== "conversation") {
      pass = false;
      errors.push("Step 1 failed: Expected conversation mode, got " + trace[0].mode);
    }

    // Validation 2: Step 2 should ask for semester
    if (!trace[1].assistant.toLowerCase().includes("semester")) {
      pass = false;
      errors.push("Step 2 failed: Assistant did not ask for semester");
    }

    // Validation 3: Step 3 should contain the courses
    if (!trace[2].assistant.includes("CS101") || !trace[2].assistant.includes("MT101")) {
      pass = false;
      errors.push("Step 3 failed: Final response missing course codes CS101 or MT101");
    }

    console.log(`STATUS: ${pass ? "PASS" : "FAIL"}`);
    if (!pass) {
      console.log("ROOT CAUSE ANALYSIS:");
      errors.forEach(e => console.log(`- ${e}`));
    } else {
      console.log("All steps behaved exactly as expected.");
    }

  } catch (err) {
    console.error("Simulation crashed:", err);
  }
}

runQASimulation().catch(console.error);
