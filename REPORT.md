# University Portal LMS - Project Report

## 1. Project Overview
The **University Portal LMS** is a modern, AI-integrated Learning Management System designed to streamline academic operations for students and faculty. The system features a robust backend for data management, a sleek and futuristic React-based frontend, and an advanced AI agent named **Nexus Intelligence** that allows users to interact with the LMS using natural language.

---

## 2. System Architecture
The project follows a modular, three-tier architecture:
- **Presentation Layer (Frontend)**: A React application built with Vite, focusing on a futuristic UI/UX with glassmorphism and smooth animations.
- **Agentic AI Layer (Chatbot)**: A Node.js middleware that acts as a bridge between the user and the system. it uses a local LLM for intent detection and response generation.
- **Application Layer (Backend)**: A Node.js/Express API that manages the core business logic, database interactions, and authentication.
- **Data Layer (MySQL)**: A relational database storing student, teacher, course, and enrollment records.

---

## 3. Technology Stack
- **Frontend**: React 18, Vite, CSS3 (Custom futuristic design system).
- **Backend**: Node.js, Express.js.
- **Database**: MySQL.
- **AI Integration**: Ollama (Local LLM), LM Studio.
- **Model**: `granite3.1-dense:8b` (Optimized for JSON and instruction following).
- **Automation**: Selenium (for fallback UI automation).
- **Security**: JWT (JSON Web Tokens), bcrypt (Password hashing).

---

## 4. Folder Structure
```text
LMS-Automation/
├── Backend/                 # Core LMS API (Node.js/Express)
│   ├── src/
│   │   ├── config/          # Database configuration
│   │   ├── middleware/      # Auth & Role-based access control
│   │   ├── routes/          # API Route definitions (Auth, Student, Teacher)
│   │   ├── utils/           # GPA and Grading logic
│   │   └── app.js           # Express application entry point
├── agent-chatbot/           # AI Agent Service (Nexus Intelligence)
│   ├── src/
│   │   ├── agents/          # Intent routing and control logic
│   │   ├── lms/             # API execution and capability mapping
│   │   ├── ollama/          # Local LLM service integration
│   │   ├── selenium/        # Fallback automation service
│   │   ├── sessions/        # Chat session management
│   │   └── index.js         # Chatbot service entry point
├── Frontend/                # React/Vite Application
│   ├── src/
│   │   ├── api/             # API client services
│   │   ├── auth/            # Authentication context and route guards
│   │   ├── components/      # Reusable UI components (e.g., ChatWidget)
│   │   ├── layout/          # Dashboard layouts for Student/Teacher
│   │   └── pages/           # Feature-specific pages (Marks, Attendance, etc.)
└── start_portal.bat         # Automated startup script
```

---

## 5. Backend Design (Node.js/Express)
The backend provides a RESTful API for all LMS operations.
- **Authentication**: Role-based authentication (Student/Teacher) using JWT stored in secure cookies.
- **Controllers/Routes**:
    - `auth.js`: Handles registration and login.
    - `student.js`: Profile management, course registration, viewing marks, and attendance.
    - `teacher.js`: Course management, marks upload, and attendance recording.
- **Database Logic**: Uses `mysql2/promise` for asynchronous connection pooling and transaction-safe queries.

---

## 6. Frontend Design (React)
The frontend is designed with a **futuristic, high-tech aesthetic**:
- **UI Components**: Custom-built cards, panels, and tables with glassmorphism effects (`backdrop-filter`).
- **Responsive Layout**: Sidebar-driven navigation with a fixed logout button and independently scrolling content area.
- **Nexus Intelligence**: A persistent chat widget that provides a natural language interface to the entire LMS.
- **State Management**: Uses React Context API for authentication and profile management.

---

## 7. AI Integration (Ollama / LM Studio)
The system integrates with local LLMs via **Ollama** or **LM Studio**, ensuring data privacy and zero API costs.
- **Layer 1: Intent Detection**:
    - Converts user messages (e.g., "Show my marks for CS-101") into structured JSON.
    - Uses a `CapabilityMap` to ensure the agent only attempts actions the system supports.
- **Layer 2: Response Generation**:
    - Takes raw backend data and transforms it into friendly, natural language.
- **Action Routing**:
    - **API First**: The agent attempts to fulfill requests via direct API calls for speed.
    - **Selenium Fallback**: If an API is unavailable or the task requires browser interaction, it uses Selenium automation.

---

## 8. API Endpoints
### Auth
- `POST /api/auth/register`: Student registration.
- `POST /api/auth/login`: Student login.
- `POST /api/auth/teacher/login`: Teacher login.
- `POST /api/auth/logout`: Session termination.

### Student
- `GET /api/student/profile`: Get bio-data.
- `GET /api/student/courses`: List enrolled courses.
- `GET /api/student/marks`: View course-wise marks.
- `GET /api/student/attendance`: View attendance stats.
- `POST /api/student/registration/enroll`: Register for a course.

### Teacher
- `GET /api/teacher/students`: List all students.
- `POST /api/teacher/courses`: Create new course.
- `POST /api/teacher/marks/upload`: Upload student marks.
- `POST /api/teacher/attendance/record`: Record daily attendance.

---

## 9. Execution Flow
1. **User Input**: User asks Nexus AI: "What's my attendance in Physics?"
2. **Intent Detection**: Ollama analyzes the text and returns: `{"intent": "student_view_attendance", "params": {"course_name": "Physics"}}`.
3. **Processing**: `AgentController` validates the intent and checks if the student is authenticated.
4. **Execution**: `ActionRouter` calls the Backend API `/api/student/attendance`.
5. **Data Retrieval**: Backend fetches the record from MySQL and returns JSON.
6. **Response Generation**: Ollama converts the JSON data into: "You have 92% attendance in Physics. Great job keeping up!"

---

## 10. Features Implemented
- **Student Portal**: Dashboard with stats, profile management, course registration, and academic tracking.
- **Teacher Portal**: Student list management, course catalog control, and evaluation tools.
- **Nexus Intelligence**: Local LLM-powered chatbot with intent detection and memory.
- **GPA Calculator**: Automated calculation of semester and cumulative GPA based on course credits and grades.
- **Registration Cycles**: Admin-controlled cycles for opening/closing course registration.

---

## 11. Error Handling & Logging
- **Backend**: centralized error middleware for handling SQL errors and validation failures.
- **Agent**: `logger.js` tracks AI decisions, API calls, and LLM response times.
- **Frontend**: Standardized `.error` and `.success` UI components for immediate user feedback.

---

## 12. Setup & Running Instructions
1. **Prerequisites**:
    - Install Node.js (v18+).
    - Install MySQL and import the provided schema.
    - Install [Ollama](https://ollama.ai/) and pull the model: `ollama pull granite3.1-dense:8b`.
2. **Configuration**:
    - Set up `.env` files in `Backend/` and `agent-chatbot/` with your database credentials and LLM settings.
3. **Run**:
    - Use the provided `start_portal.bat` in the root directory to launch all services.

---

## 13. Limitations / Future Improvements
- **Scalability**: Move from local LLM to a hybrid cloud model for complex reasoning.
- **Mobile App**: Develop a dedicated mobile interface for on-the-go tracking.
- **Real-time Notifications**: Implement WebSockets for instant updates on grade uploads.
