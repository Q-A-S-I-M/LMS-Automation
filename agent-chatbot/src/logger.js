import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      "*.password",
      "*.password_hash",
      "*.token",
      "*.SESSION_JWT_SECRET",
      "*.GEMINI_API_KEY",
    ],
    remove: true,
  },
});

