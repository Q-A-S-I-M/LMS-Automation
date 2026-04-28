## LMS Agentic Chatbot (Production-oriented)

This is a **user-isolated agentic chatbot service** that uses:
- **Gemini API** for intent detection + slot filling + tool selection
- **Direct LMS API calls** (preferred for reliability)
- **Selenium** for web automation fallback (login/navigation/forms) with **strict per-user browser isolation**

### Architecture (text diagram)

```
Client UI
  |
  |  POST /v1/chat  (cookie session)
  v
Express Chat Server
  |
  +--> SessionManager (per-session state: role/auth/conversation/task context)
  |
  +--> AgentController
        |
        +--> CapabilityMap (parsed from ../LMS_CAPABILITY_MAP.md)  <-- single source of truth
        |
        +--> GeminiService (returns structured JSON: intent + params + followups + execution plan)
        |
        +--> ActionRouter
              |
              +--> ApiExecutor (fetch to LMS backend)
              |
              +--> SeleniumService (fresh browser per run; never shared across users)
```

### Run locally

1. Install deps:

```bash
cd "agent-chatbot"
npm install
```

2. Create `.env` from `.env.example` and fill in:
- `SESSION_JWT_SECRET`
- `GEMINI_API_KEY`
- `LMS_API_BASE` and `LMS_WEB_BASE`

3. Start:

```bash
npm run dev
```

Service listens on `PORT` (default `7000`).

### API

- `POST /v1/session` → create a session (sets httpOnly cookie)
- `POST /v1/chat` → send a user message; returns assistant reply + action results (if any)
- `POST /v1/session/end` → terminate session

### Security model (summary)
- **No global user state**: all per-user data lives inside `SessionManager` instances and is keyed by session id.
- **Strict isolation**: Selenium runs with a dedicated, unique profile directory per session run.
- **Least capability**: model can only select intents that exist in `../LMS_CAPABILITY_MAP.md`.
- **PII safety**: short-lived sessions, minimal logging, input sanitization, rate limiting.

