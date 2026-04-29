import { config } from "../config.js";
import { logger } from "../logger.js";

/**
 * Executes an LMS action via direct backend API call.
 * Uses a per-session cookie jar (NOT a global cookie store).
 */
export class ApiExecutor {
  constructor({ apiBase = config.LMS_API_BASE } = {}) {
    this.apiBase = apiBase;
  }

  async execute({ intentSpec, parameters, sessionState, intentName }) {
    const method = intentSpec?.apiHints?.method;
    const p = intentSpec?.apiHints?.path;

    if (!method || !p) {
      logger.error(`No API mapping found for intent: ${intentName || "unknown"}`);
      return {
        ok: false,
        error: `No API mapping found for intent: ${intentName || "unknown"}`,
      };
    }

    const { url, body } = this._buildRequest({ method, path: p, parameters, sessionState });
    const cookieHeader = serializeCookieHeader(sessionState?.auth?.lmsCookies || []);

    // Logging BEFORE execution
    logger.info(`[API CALL] Intent: ${intentName || "unknown"}`);
    logger.info(`[API CALL] Endpoint: ${method} ${url}`);
    if (body) {
      logger.info(`[API CALL] Params: ${JSON.stringify(body)}`);
    }

    try {
      let res;
      let attempt = 0;
      const MAX_RETRIES = 2;

      while (attempt <= MAX_RETRIES) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

          res = await fetch(url, {
            method,
            headers: {
              "Content-Type": "application/json",
              ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          break; // Success or non-timeout error
        } catch (err) {
          if (err.name === 'AbortError' && attempt < MAX_RETRIES) {
            attempt++;
            logger.warn(`[API CALL] Timeout on ${url}. Retrying (${attempt}/${MAX_RETRIES})...`);
            continue;
          }
          throw err;
        }
      }

      const data = await res.json().catch(() => null);

      // Logging AFTER response
      if (res.ok) {
        logger.info(`[API RESPONSE] Status: ${res.status}`);
        const shortenedData = data ? (JSON.stringify(data).length > 500 ? JSON.stringify(data).slice(0, 500) + "..." : JSON.stringify(data)) : "null";
        logger.info(`[API RESPONSE] Data: ${shortenedData}`);
      } else {
        logger.error(`[API ERROR] Endpoint: ${url}`);
        logger.error(`[API ERROR] Status: ${res.status}`);
        
        let friendlyError = data?.error || res.statusText || "Unknown error";
        if (res.status === 404) friendlyError = "Resource not found";
        if (res.status === 500) friendlyError = "Server error";
        
        logger.error(`[API ERROR] Message: ${friendlyError}`);
        return { ok: false, status: res.status, error: friendlyError, data };
      }

      // If the LMS sets auth cookie on login/register, update session cookie jar.
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) {
        const parsed = parseSetCookieHeader(setCookie);
        if (parsed.length) {
          sessionState.auth.lmsCookies = mergeCookies(sessionState.auth.lmsCookies, parsed);
          sessionState.auth.isAuthenticated = true;
        }
      }

      return { ok: true, status: res.status, data };
    } catch (err) {
      logger.error(`[API ERROR] Endpoint: ${url}`);
      logger.error(`[API ERROR] Message: ${err.message}`);
      return { ok: false, error: err.name === 'AbortError' ? "Request timeout after retries" : `Network error: ${err.message}` };
    }
  }

  _buildRequest({ method, path, parameters, sessionState }) {
    const m = method.toUpperCase();
    let url = `${this.apiBase}${path}`;
    let body = undefined;

    // Automatically inject userId into parameters if available and missing
    const enhancedParams = { ...parameters };
    // [REMOVED] roll_no injection; backend should identify user via session/token
    
    if (m === "GET") {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(enhancedParams || {})) {
        if (v == null) continue;
        if (Array.isArray(v)) continue;
        qs.set(k, String(v));
      }
      if ([...qs.keys()].length) {
        url += (url.includes("?") ? "&" : "?") + qs.toString();
      }
    } else {
      body = enhancedParams || {};
    }

    return { url, body };
  }
}

function serializeCookieHeader(cookies) {
  const parts = [];
  for (const c of cookies || []) {
    if (!c?.name) continue;
    parts.push(`${c.name}=${c.value ?? ""}`);
  }
  return parts.join("; ");
}

function parseSetCookieHeader(setCookieValue) {
  // Very conservative parser: extracts "name=value" portion only.
  // If multiple cookies are concatenated, we split on ", " only when it looks like a new cookie.
  const out = [];
  const raw = String(setCookieValue || "");
  const candidates = raw.split(/,(?=[^;,]+=)/g);
  for (const cand of candidates) {
    const first = cand.split(";")[0].trim();
    const eq = first.indexOf("=");
    if (eq <= 0) continue;
    const name = first.slice(0, eq);
    const value = first.slice(eq + 1);
    out.push({ name, value });
  }
  return out;
}

function mergeCookies(oldCookies, newCookies) {
  const map = new Map((oldCookies || []).map((c) => [c.name, c]));
  for (const c of newCookies || []) map.set(c.name, c);
  return [...map.values()];
}

