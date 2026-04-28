import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(7000),
  // For local/dev: allow running with only GEMINI_API_KEY.
  // For production, always set a strong secret via environment.
  SESSION_JWT_SECRET: z.string().min(32).optional().default("dev_only_change_me_to_a_long_random_secret_1234567890"),
  SESSION_TTL_MS: z.coerce.number().int().positive().default(2 * 60 * 60 * 1000),
  SESSION_COOKIE_NAME: z.string().min(1).default("lms_agent_sid"),

  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  GEMINI_API_VERSION: z.string().min(1).default("v1beta"),

  LMS_API_BASE: z.string().url().default("http://localhost:5000"),
  LMS_WEB_BASE: z.string().url().default("http://localhost:5173"),

  ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),

  SELENIUM_BROWSER: z.enum(["chrome"]).default("chrome"),
});

export const config = envSchema.parse(process.env);

export function allowedOriginsSet() {
  return new Set(
    String(config.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

