import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import path from "node:path";

import { config, allowedOriginsSet } from "./config.js";
import { logger } from "./logger.js";
import { SessionManager } from "./sessions/SessionManager.js";
import { CapabilityMap } from "./lms/CapabilityMap.js";
import { GeminiService } from "./gemini/GeminiService.js";
import { OllamaService } from "./ollama/OllamaService.js";
import { ActionRouter } from "./agents/ActionRouter.js";
import { AgentController } from "./agents/AgentController.js";
import { sessionRoutes } from "./routes/sessionRoutes.js";
import { chatRoutes } from "./routes/chatRoutes.js";

const app = express();
app.disable("x-powered-by");

app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(express.json({ limit: "256kb" }));
app.use(cookieParser());

// Basic origin allowlist (no credentials needed here because we use cookie session on same origin in prod)
const origins = allowedOriginsSet();
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && origins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  return next();
});

app.use(
  rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    limit: config.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get("/health", (_req, res) => res.json({ ok: true, status: "up" }));

// Root: browser default GET / — API-only service; return pointers instead of 404
app.get("/", (_req, res) => {
  res.type("json").json({
    ok: true,
    service: "lms-agent-chatbot",
    message: "This is the agent API. There is no HTML UI at /. Use the endpoints below.",
    endpoints: {
      health: "GET /health",
      createSession: "POST /v1/session",
      chat: "POST /v1/chat (requires session cookie from createSession)",
      endSession: "POST /v1/session/end",
    },
    docs: "See agent-chatbot/README.md",
  });
});

const repoRoot = path.resolve(process.cwd(), ".."); // agent-chatbot is inside repoRoot/agent-chatbot

async function bootstrap() {
  const capabilityMap = await CapabilityMap.loadFromRepoRoot({ repoRoot });
  const sessions = new SessionManager();
  
  // Provider selection
  let llmService;
  if (config.LLM_PROVIDER === "ollama" || config.LLM_PROVIDER === "lmstudio") {
    const providerName = config.LLM_PROVIDER === "ollama" ? "Ollama" : "LM Studio";
    logger.info({ model: config.OLLAMA_MODEL, provider: providerName }, `Using ${providerName} LLM provider`);
    llmService = new OllamaService();
  } else {
    logger.info({ model: config.GEMINI_MODEL }, "Using Gemini LLM provider");
    llmService = new GeminiService();
  }

  const actionRouter = new ActionRouter();
  const agent = new AgentController({ capabilityMap, llmService, actionRouter, logger });

  app.use("/v1", sessionRoutes({ sessions }));
  app.use("/v1", chatRoutes({ sessions, agent }));

  app.use((err, _req, res, _next) => {
    logger.error({ err }, "Unhandled error");
    res.status(500).json({ ok: false, error: "Internal server error" });
  });

  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "Agent chatbot server listening");
    logger.info({ intents: capabilityMap.listIntents().length }, "Loaded capability map intents");
  });
}

bootstrap().catch((e) => {
  logger.error({ err: e }, "Failed to bootstrap");
  process.exit(1);
});

