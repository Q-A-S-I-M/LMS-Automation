# LMS Automation System

## Overview
The **LMS Automation System** is a comprehensive University Portal designed to streamline academic workflows for students and teachers. It features a modern web-based interface, a robust RESTful backend, and an **AI-powered Agent Chatbot** that can execute complex LMS tasks through natural language processing, direct API integration, and automated browser interactions (Selenium).

The system is divided into three primary modules:
- **Backend**: Node.js/Express API with a MySQL database.
- **Frontend**: React (Vite) Single Page Application.
- **Agent Chatbot**: An intelligent automation layer powered by Google Gemini.

---

## Architecture
The system follows a multi-layered architecture to separate concerns and ensure scalability:

### 1. Backend Layer (Node.js/Express)
- **Controllers/Routes**: Handles HTTP requests for authentication, student, and teacher operations.
- **Middleware**: Manages security (JWT verification), role-based access control (RBAC), and request parsing.
- **Data Access**: Interfaces with MySQL using `mysql2/promise` for transactional integrity.
- **Utils**: Contains logic for GPA calculation, grading, and transcript generation.

### 2. Frontend Layer (React/Vite)
- **Pages**: Role-specific dashboards and views (Profile, Marks, Attendance, Course Registration, etc.).
- **Auth Context**: Manages user sessions and JWT persistence in `localStorage`.
- **API Client**: A standardized fetch wrapper for communicating with the backend.

### 3. AI Agent Layer (agent-chatbot)
- **Gemini Service**: Uses `gemini-2.0-flash` to parse user intent and extract parameters into a structured plan.
- **Capability Map**: A strict allowlist of supported intents derived from `LMS_CAPABILITY_MAP.md`.
- **Action Router**: Determines the best execution path:
  - **API Mode (Preferred)**: Direct calls to backend endpoints using session-based cookie jars.
  - **Selenium Mode (Fallback)**: Browser automation for tasks requiring UI interaction.
- **ApiExecutor**: A specialized service for executing backend calls with detailed structured logging.

---

## API Reference

### Authentication
- `POST /api/auth/register`: Student account creation.
- `POST /api/auth/login`: Student login (JWT in HTTP-only cookie).
- `POST /api/auth/teacher/login`: Teacher login.
- `POST /api/auth/logout`: Session termination.

### Student Module
- `GET /api/student/profile`: Retrieve student bio-data.
- `GET /api/student/courses`: List currently enrolled courses.
- `GET /api/student/registration/available`: List courses available for registration in a semester.
- `POST /api/student/registration/register`: Register for a course (18 credit hour limit).
- `GET /api/student/marks/:courseId`: View component-wise marks and calculated grade.
- `GET /api/student/attendance/:courseId`: View lecture-by-lecture attendance.
- `GET /api/student/transcript`: Generate full academic transcript (SGPA/CGPA).

### Teacher Module
- `GET /api/teacher/students`: List all students.
- `POST /api/teacher/courses`: Add new courses to the catalog.
- `POST /api/teacher/enroll`: Mass-enroll registered students into courses.
- `POST /api/teacher/marks/upsert`: Upload/update student marks.
- `POST /api/teacher/attendance/upsert`: Upload/update lecture attendance.

---

## Data Flow
1. **User Request**: User sends a natural language message via the ChatWidget or uses the React UI.
2. **Intent Analysis**: (If via Chat) Gemini Service analyzes the message against the **Capability Map** and returns a structured JSON plan.
3. **Execution Path**:
   - **API Mode**: `ApiExecutor` builds an authenticated request, calls the Backend, and processes the JSON response.
   - **Selenium Mode**: `SeleniumService` launches a headless Chrome instance, navigates the UI, and performs actions.
4. **Data Persistence**: Backend validates the request (RBAC + Business Rules) and updates the MySQL database within transactions.
5. **Response**: The system returns a human-friendly response to the user or updates the UI state.

---

## AI / Logic Layer
- **Intent Classification**: Gemini is constrained by a system prompt to only use intents defined in the capability map.
- **Slot Filling**: The agent identifies missing parameters (e.g., `semester`, `course_code`) and proactively asks the user for them before executing.
- **RBAC Enforcement**: The `AgentController` verifies that the detected intent is allowed for the user's current role (`student` or `teacher`).
- **Context Memory**: The system remembers the `lastIntent` to resolve vague follow-up queries (e.g., "tell me about it").

---

## Folder Structure
```text
LMS-Automation/
├── Backend/                # Express API
│   ├── sql/                # MySQL Schema and Dummy Data
│   ├── src/
│   │   ├── config/         # DB connection pool
│   │   ├── middleware/     # Auth and RBAC
│   │   ├── routes/         # Student/Teacher/Auth routes
│   │   └── app.js          # Entry point
├── Frontend/               # React SPA
│   ├── src/
│   │   ├── api/            # API client
│   │   ├── auth/           # Session management
│   │   ├── components/     # UI components (ChatWidget, etc.)
│   │   └── pages/          # Feature-specific views
├── agent-chatbot/          # AI Automation Agent
│   ├── src/
│   │   ├── agents/         # Agent logic and Routing
│   │   ├── gemini/         # AI planning service
│   │   ├── lms/            # API execution logic
│   │   ├── selenium/       # Browser automation
│   │   └── index.js        # Agent entry point
├── LMS_CAPABILITY_MAP.md   # Source of truth for AI intents
└── PROJECT_WORKFLOW.md     # Detailed business logic documentation
```

---

## Database Models (MySQL)
- **`students`**: Identity, profile, and hashed credentials.
- **`teachers`**: Teacher authentication data.
- **`courses`**: Course catalog (code, name, credit hours).
- **`enrollments`**: Official academic records and transcript data.
- **`course_registrations`**: Student-driven registration requests with lifecycle states.
- **`marks`**: Component-wise scores (Quiz, Assignment, Sessional, Final).
- **`attendance`**: Lecture-by-lecture presence logs.
- **`course_feedback`**: Student ratings and teacher responses.

---

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- MySQL Server
- Google Gemini API Key

### 1. Database Setup
```bash
mysql -u root -p < Backend/sql/schema_all_in_one.sql
mysql -u root -p < Backend/sql/dummy_data.sql  # Optional
```

### 2. Backend Setup
```bash
cd Backend
npm install
# Configure .env with DB credentials and JWT_SECRET
npm start
```

### 3. Agent Chatbot Setup
```bash
cd agent-chatbot
npm install
# Configure .env with GEMINI_API_KEY and LMS_API_BASE
npm start
```

### 4. Frontend Setup
```bash
cd Frontend
npm install
# Configure .env with VITE_API_BASE_URL
npm run dev
```

---

## Environment Variables

### Backend (.env)
- `PORT`: Server port (default 5000).
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: MySQL connection details.
- `JWT_SECRET`: Secret for signing session tokens.

### Agent Chatbot (.env)
- `GEMINI_API_KEY`: Google AI credentials.
- `GEMINI_MODEL`: Model version (e.g., `gemini-2.0-flash`).
- `LMS_API_BASE`: URL of the running backend.
- `LMS_WEB_BASE`: URL of the running frontend (for Selenium).

---

## Logging System
The **Agent Chatbot** uses `pino` and `pino-pretty` for structured, human-readable logging.
- **API Logs**: Every backend call is logged with `[API CALL]`, `[API RESPONSE]`, or `[API ERROR]`.
- **Traceability**: Logs include the Intent Name, Endpoint, HTTP Method, Request Body, and Response Status.
- **Security**: Sensitive fields like passwords and API keys are automatically redacted.

---

## Security
- **Authentication**: JWT-based session management.
- **Cookie Security**: Tokens are stored in `httpOnly` cookies to prevent XSS.
- **RBAC**: Strict role checks on every endpoint and AI intent.
- **Input Validation**: Sanitization of user text and Zod-based schema validation in the agent.

---

## Error Handling
- **Graceful Failures**: The agent detects session expiry (401/403) and prompts for re-authentication.
- **Missing Params**: Instead of failing, the AI identifies missing slots and asks follow-up questions.
- **Business Logic**: Backend errors (e.g., "Credit hour limit exceeded") are bubbled up to the user.
- **Transient Errors**: The agent includes bounded retry logic for network timeouts.

---

## Known Issues
- **Selenium Selectors**: UI automation depends on specific CSS selectors which may require updates if the Frontend layout changes.
- **Concurrent Registrations**: While the backend uses transactions, rapid-fire registration requests from the same user are managed via `FOR UPDATE` locks.

---

## Future Improvements
- **Multi-Agent Orchestration**: Introducing specialized agents for different LMS departments.
- **Enhanced Analytics**: Dashboard for teachers to view class performance trends.
- **Mobile Integration**: Responsive design improvements for mobile-first accessibility.
