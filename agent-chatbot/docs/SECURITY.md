## Security measures (mandatory checklist)

### Isolation / no data leakage
- **Session state is server-side only**: client cookie contains only a signed session pointer (`sid`), not chat history or auth tokens.
- **No shared user state**: per-user state lives inside `SessionManager.sessions` keyed by session id; no module-level per-user variables.
- **Concurrency safety**: `SessionManager.withSessionLock()` serializes processing per session to prevent cross-request race conditions.
- **Selenium isolation**: `SeleniumService` creates a **fresh Chrome profile directory per run**, never reuses a driver, always `quit()` and deletes the profile directory.

### Authentication / authorization
- **Role-based enforcement**: `AgentController` blocks intents requiring `student` or `teacher` role when the session role does not match.
- **Auth required enforcement**: if an intent requires auth and the session is not authenticated, the agent asks for login first.

### Capability allowlist
- **Single source of truth**: `CapabilityMap` parses `../LMS_CAPABILITY_MAP.md` and extracts the set of allowed intents.
- **Hard block on unknown intents**: if Gemini proposes an intent not in capability map, execution is denied.

### Input hardening
- **Sanitization**: user messages are stripped of HTML and length-capped (`sanitizeUserText`).
- **Validation**: request schemas enforced with `zod`.

### Transport + session cookies
- Cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- Session token is signed using `SESSION_JWT_SECRET` and has explicit TTL.

### Rate limiting
- Basic per-IP limiter with `express-rate-limit`.

### Logging and secrets
- Logger redacts cookies/authorization and common secret paths.
- Do **not** commit `.env`; use `.env.example`.

