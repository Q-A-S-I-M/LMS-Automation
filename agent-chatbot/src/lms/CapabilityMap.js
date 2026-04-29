import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Parses ../LMS_CAPABILITY_MAP.md and extracts a strict allowlist of intents + parameters.
 *
 * This is intentionally conservative: if parsing fails, the system refuses to execute
 * any action rather than guessing capabilities.
 */
export class CapabilityMap {
  constructor({ intentsByName }) {
    this.intentsByName = intentsByName; // name -> { name, requiredParams: string[], optionalParams: string[], requiresAuth: "none"|"student"|"teacher"|"any", apiHints: { method?, path? } }
  }

  static async loadFromRepoRoot({ repoRoot }) {
    const filePath = path.join(repoRoot, "LMS_CAPABILITY_MAP.md");
    const md = await readFile(filePath, "utf8");
    return CapabilityMap.parse(md);
  }

  static parse(md) {
    const intentsByName = new Map();

    // Match blocks starting with: ### Intent: `intent_name`
    const normalized = String(md || "")
      .replace(/^\uFEFF/, "") // remove BOM if present
      .replace(/\r\n/g, "\n");

    const re = /### Intent: `([^`]+)`([\s\S]*?)(?=\n### Intent: `|$)/g;
    for (const m of normalized.matchAll(re)) {
      const name = String(m[1] || "").trim();
      const chunk = `### Intent: \`${name}\`${m[2] || ""}`;
      if (!name) continue;

      const requiresAuth = parseRequiresAuth(chunk);
      const allowedRoles = parseAllowedRoles(requiresAuth, name);
      const { requiredParams, optionalParams } = parseParams(chunk);
      const apiHints = parseApi(chunk);

      intentsByName.set(name, { name, requiredParams, optionalParams, requiresAuth, allowedRoles, apiHints });
    }

    if (!intentsByName.size) {
      throw new Error("CapabilityMap parsing produced zero intents. Refusing to run.");
    }

    return new CapabilityMap({ intentsByName });
  }

  hasIntent(name) {
    return this.intentsByName.has(name);
  }

  getIntent(name) {
    return this.intentsByName.get(name) || null;
  }

  listIntents() {
    return [...this.intentsByName.values()].map((x) => x.name).sort();
  }

  getIntentSummaries() {
    return [...this.intentsByName.values()].map((x) => ({
      intent: x.name,
      required_params: x.requiredParams,
      optional_params: x.optionalParams,
      allowed_roles: x.allowedRoles
    }));
  }
}

function parseRequiresAuth(chunk) {
  // "- **Requires Authentication?** Yes (student)"
  const m = chunk.match(/- \*\*Requires Authentication\?\*\* ([^\n]+)/);
  if (!m) return "none";
  const val = m[1].trim().toLowerCase();
  if (val.startsWith("no")) return "none";
  if (val.includes("student")) return "student";
  if (val.includes("teacher")) return "teacher";
  if (val.includes("any")) return "any";
  // If unknown but says "yes", treat as any.
  if (val.startsWith("yes")) return "any";
  return "none";
}

function parseAllowedRoles(requiresAuth, intentName) {
  // 1. Explicitly based on requiresAuth
  if (requiresAuth === "student") return ["student"];
  if (requiresAuth === "teacher") return ["teacher"];
  if (requiresAuth === "any") return ["student", "teacher"];

  // 2. Inference based on intent name naming conventions if requiresAuth is "none" or "any"
  const name = intentName.toLowerCase();
  if (name.startsWith("student_")) return ["student"];
  if (name.startsWith("teacher_")) return ["teacher"];

  // 3. Fallback for common patterns
  if (name.includes("marks") && !name.includes("upsert")) return ["student"];
  if (name.includes("upsert") || name.includes("create")) return ["teacher"];
  if (name.includes("transcript") || name.includes("registration")) return ["student"];

  return ["student", "teacher"]; // Default to both for general actions like login/logout
}

function parseParams(chunk) {
  const requiredParams = [];
  const optionalParams = [];

  // Find "- **Required parameters**" section until next "- **" heading.
  const m = chunk.match(/- \*\*Required parameters\*\*([\s\S]*?)(\n- \*\*|$)/);
  if (m) {
    const body = m[1];
    const lines = body.split("\n").map((l) => l.trim());
    for (const line of lines) {
      // "  - `roll_no`, `full_name`, `email`, `password`"
      const backticks = [...line.matchAll(/`([^`]+)`/g)].map((x) => x[1]);
      for (const p of backticks) requiredParams.push(p);
      if (line.startsWith("- optional:") || line.includes("optional:")) {
        // Already covered by parseOptional block below; ignore.
      }
    }
  }

  // Some intents have "optional:" inside required section; also parse explicit optional list.
  const m2 = chunk.match(/- \*\*Required parameters\*\*[\s\S]*?optional:[\s\S]*?(\n- \*\*Requires Authentication\?\*\*|$)/);
  if (m2) {
    const backticks = [...m2[0].matchAll(/optional:\s*([\s\S]+)/g)];
    if (backticks.length) {
      // best-effort; keep parsing later too
    }
  }

  const mOpt = chunk.match(/- \*\*Required parameters\*\*[\s\S]*?optional:([\s\S]*?)(\n- \*\*|$)/);
  if (mOpt) {
    const body = mOpt[1];
    for (const bt of body.matchAll(/`([^`]+)`/g)) optionalParams.push(bt[1]);
  }

  // De-dupe & filter obvious non-params
  const req = uniq(requiredParams).filter(Boolean);
  const opt = uniq(optionalParams).filter(Boolean).filter((p) => !req.includes(p));
  return { requiredParams: req, optionalParams: opt };
}

function parseApi(chunk) {
  // "- **API**\n  - `POST /api/auth/login`"
  const m = chunk.match(/- \*\*API\*\*([\s\S]*?)(\n- \*\*|$)/);
  if (!m) return {};
  const apiLine = m[1].match(/`([A-Z]+)\s+([^`]+)`/);
  if (!apiLine) return {};
  return { method: apiLine[1], path: apiLine[2] };
}

function uniq(arr) {
  return [...new Set(arr)];
}

