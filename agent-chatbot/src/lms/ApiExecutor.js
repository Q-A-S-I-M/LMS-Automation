import { config } from "../config.js";

/**
 * Executes an LMS action via direct backend API call.
 * Uses a per-session cookie jar (NOT a global cookie store).
 */
export class ApiExecutor {
  constructor({ apiBase = config.LMS_API_BASE } = {}) {
    this.apiBase = apiBase;
  }

  async execute({ intentSpec, parameters, sessionState }) {
    const method = intentSpec?.apiHints?.method;
    const p = intentSpec?.apiHints?.path;
    if (!method || !p) {
      console.error("[ApiExecutor] Missing API hints for intent spec:", intentSpec);
      return {
        ok: false,
        error: "No API mapping found for this intent (capability map missing API hints).",
      };
    }

    const { url, body } = this._buildRequest({ method, path: p, parameters });
    console.log(`[ApiExecutor] Fetching: ${method} ${url}`);
    if (body) console.log(`[ApiExecutor] Request body:`, JSON.stringify(body, null, 2));

    const cookieHeader = serializeCookieHeader(sessionState?.auth?.lmsCookies || []);
    if (cookieHeader) console.log(`[ApiExecutor] Sending cookies: ${cookieHeader}`);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await res.json().catch(() => null);
      console.log(`[ApiExecutor] Response status: ${res.status}`);
      if (data) console.log(`[ApiExecutor] Response data:`, JSON.stringify(data, null, 2));

      // If the LMS sets auth cookie on login/register, update session cookie jar.
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) {
        console.log(`[ApiExecutor] Set-Cookie header received.`);
        const parsed = parseSetCookieHeader(setCookie);
        if (parsed.length) {
          sessionState.auth.lmsCookies = mergeCookies(sessionState.auth.lmsCookies, parsed);
          sessionState.auth.isAuthenticated = true;
          console.log(`[ApiExecutor] Session cookies updated and authenticated.`);
        }
      }

      if (!res.ok) {
        console.error(`[ApiExecutor] Request failed with status ${res.status}`);
        return { ok: false, status: res.status, error: data?.error || `Request failed (${res.status})`, data };
      }
      return { ok: true, status: res.status, data };
    } catch (err) {
      console.error("[ApiExecutor] Fetch error:", err);
      return { ok: false, error: `Network error: ${err.message}` };
    }
  }

  _buildRequest({ method, path, parameters }) {
    const m = method.toUpperCase();

    // For now: intent specs already include correct LMS paths.
    // We only support:
    // - JSON bodies for POST/PUT/PATCH
    // - query expansion for a few known endpoints
    //
    // IMPORTANT: We do NOT invent endpoints; if something needs path params,
    // the caller must provide the proper path by choosing correct intent API hint.
    let url = `${this.apiBase}${path}`;
    let body = undefined;

    if (m === "GET") {
      // If user provided semester and path expects query, attach it if missing.
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(parameters || {})) {
        if (v == null) continue;
        if (Array.isArray(v)) continue;
        qs.set(k, String(v));
      }
      if ([...qs.keys()].length) {
        url += (url.includes("?") ? "&" : "?") + qs.toString();
      }
    } else {
      body = parameters || {};
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

