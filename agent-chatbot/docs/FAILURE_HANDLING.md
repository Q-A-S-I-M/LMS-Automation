## Failure handling scenarios

This agent is designed to fail safely and ask for missing data rather than guessing.

### 1) Wrong login credentials
- **Symptom**: LMS returns `401 Invalid credentials`
- **Agent behavior**
  - Respond with “Login failed” and ask to re-enter identifier/password.
  - Do not store/echo the password back.

### 2) Not logged in (401 / missing cookie)
- **Symptom**: LMS endpoints return 401/403
- **Agent behavior**
  - Detect auth-required intent and prompt for login based on role.
  - Propose `student_login` or `teacher_login` intent first.

### 3) Missing required parameters
- **Symptom**: user says “register my course” without semester/course_code
- **Agent behavior**
  - Ask targeted follow-ups for the missing slots.
  - Prefer capability-map guidance, e.g. ask for `semester` and `course_code`.

### 4) Business rule conflicts (409)
Examples from LMS backend:
- registration finalized
- cycle closed
- credit hour limit exceeded
- course already passed
- already registered

**Agent behavior**
- Surface backend error message.
- Suggest next legal action (choose different course/semester) without inventing new system features.

### 5) Selenium failures
- **Symptom**: driver startup, selector not found, navigation issues
- **Agent behavior**
  - Return a clear error message: “Selenium automation failed”
  - Fall back to API mode when possible.
  - Never reuse a failed driver; always exit and clean profile.

### 6) Gemini failures
- Invalid/missing API key: returns `503` with actionable message.
- Non-JSON response: returns `502` to the client (prompt/schema tightening needed).

