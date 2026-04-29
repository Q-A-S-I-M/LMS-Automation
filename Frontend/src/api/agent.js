const AGENT_BASE = "http://localhost:7000";

async function request(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };

  const res = await fetch(`${AGENT_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error || `Agent request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export const agentApi = {
  createSession: (payload) => request("/v1/session", { method: "POST", body: payload }),
  chat: (message) => request("/v1/chat", { method: "POST", body: { message } }),
  endSession: () => request("/v1/session/end", { method: "POST" }),
};
