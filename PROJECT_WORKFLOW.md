# University AI Portal (Student Portal) — Project Workflow

This document explains the **complete end-to-end workflow** of the University Portal project (React + Node/Express + MySQL), focusing on the **Student Portal** features that are currently implemented.

---

## 1) Tech stack and folders

- **Frontend**: React (Vite) in `Frontend/`
- **Backend**: Node.js + Express in `Backend/`
- **Database**: MySQL

Directory highlights:

- `Backend/src/app.js`: Express app entrypoint
- `Backend/src/config/db.js`: MySQL connection pool
- `Backend/src/routes/auth.js`: Auth endpoints (login + register)
- `Backend/src/routes/student.js`: Student portal endpoints (profile, attendance, marks, transcript, course registration, feedback)
- `Backend/sql/schema.sql`: Base schema (students/courses/enrollments/attendance/marks)
- `Backend/sql/schema_registration_feedback.sql`: Schema extension (course registrations + feedback)
- `Backend/sql/dummy_data.sql`: Dummy dataset to test the portal

---

## 2) Database design (how data is stored)

### Core academic tables (from `schema.sql`)

- **`students`**
  - Stores student identity + bio-data + `password_hash` used for authentication.
- **`courses`**
  - Course catalog with `credit_hours`.
- **`enrollments`**
  - Stores **transcript history** (semester, grade, points) used for SGPA/CGPA.
  - This table represents **official/academic record** data.
- **`attendance`**
  - Lecture-by-lecture presence for a course.
- **`marks`**
  - Marks for a course, categorized (Assignment/Quiz/Sessional/Final).

### Registration and feedback tables (from `schema_registration_feedback.sql`)

- **`course_registrations`**
  - Represents **student course registration requests** for a semester.
  - Key columns: `(roll_no, course_code, semester)`
  - Unique constraint ensures a student cannot register the same course twice in the same semester.
- **`course_feedback`**
  - Stores feedback **only for registered courses**.
  - Key columns: `(roll_no, course_code, semester, rating, comment)`
  - Unique constraint ensures one feedback record per student/course/semester (updates overwrite).

### Why registrations are separate from enrollments

- `enrollments` = transcript / gradebook / official record (inserted by admin scripts or later automation).
- `course_registrations` = student-driven selection with policy checks (18 credit hours cap).

This separation keeps academic records clean and allows future approval workflows (e.g., “pending/approved”) without changing transcript logic.

---

## 3) Backend workflow (Node/Express)

### Startup

1. `Backend/src/app.js` loads environment variables from `Backend/.env`
2. Express middleware is configured:
   - `cors`
   - `express.json()`
3. Routes are mounted:
   - `/api/auth/*` → `Backend/src/routes/auth.js`
   - `/api/student/*` → protected by JWT middleware `Backend/src/middleware/auth.js`
4. A DB connectivity check runs using the MySQL pool in `Backend/src/config/db.js`

### Authentication model (JWT)

- On successful **login** or **register**, backend returns:
  - `token` (JWT containing `{ roll_no }`)
  - `student` summary (roll_no, full_name, email)
- Frontend stores the token in `localStorage` under `up_token` and sends it as:
  - `Authorization: Bearer <token>`
- Backend verifies JWT on all `/api/student/*` endpoints and sets `req.user.roll_no`.

### Auth endpoints

- **POST `/api/auth/register`**
  - Creates a new student in `students`
  - Hashes password using bcrypt into `password_hash`
  - Returns JWT (auto-login)
- **POST `/api/auth/login`**
  - Finds student by roll no OR email
  - Compares password with bcrypt
  - Returns JWT

### Student endpoints (protected)

#### Profile
- **GET `/api/student/profile`**
  - Returns the student’s profile from `students`

#### Dashboard helper
- **GET `/api/student/courses`**
  - Returns courses linked to the student’s `enrollments`
  - Used for dropdowns and “recent enrollments” display

#### Attendance
- **GET `/api/student/attendance/:courseId`**
  - Returns all lecture rows + computed percentage

#### Marks
- **GET `/api/student/marks/:courseId`**
  - Returns marks grouped by category (Assignment/Quiz/Sessional/Final)

#### Transcript (SGPA + CGPA)
- **GET `/api/student/transcript`**
  - Reads `enrollments JOIN courses`
  - Computes:
    - **SGPA per semester**
    - **CGPA overall**
  - Uses `enrollments.points` if present, otherwise derives from grade mapping

---

## 4) Course registration workflow (18 credit hour limit)

### Goal

Allow students to register courses for a semester while enforcing:

- **Maximum 18 credit hours per semester**
- No duplicates (same course in same semester)
- Strong data integrity even when requests happen quickly (race prevention)

### Endpoints

- **GET `/api/student/registration/available?semester=...`**
  - Lists all courses the student is **not registered** for in that semester
- **GET `/api/student/registration/my?semester=...`**
  - Lists registered courses for that semester and returns:
    - `total_credit_hours`
    - `max_credit_hours` (18)
- **POST `/api/student/registration/register`**
  - Body: `{ course_code, semester }`
  - Uses a **DB transaction** and a `FOR UPDATE` lock to avoid race conditions.
  - Steps:
    1. Lock existing registrations for student+semester and sum current credit hours
    2. Load selected course credit hours
    3. If `current + course > 18` → reject (409)
    4. Insert registration (unique key prevents duplicates)
    5. Commit transaction
- **POST `/api/student/registration/unregister`**
  - Removes a registration row for that semester

### Data integrity guarantees

- **Unique key** on `(roll_no, course_code, semester)` prevents duplicates.
- **Transaction + row lock** ensures the credit-hour sum is consistent during registration attempts.
- **Foreign keys** ensure registrations reference valid students and courses.

---

## 5) Course feedback workflow

### Goal

Let students submit feedback only for courses they have registered in a semester.

### Endpoints

- **GET `/api/student/feedback/my?semester=...`**
  - Returns the student’s registered courses for that semester
  - Also includes existing feedback (rating/comment) if already submitted
- **POST `/api/student/feedback/submit`**
  - Body: `{ course_code, semester, rating (1-5), comment }`
  - Validation:
    - Must be registered in `course_registrations` for that course+semester
    - Rating must be 1..5
  - Storage:
    - Inserts feedback or updates it (one record per course+semester)

### Integrity guarantees

- Backend checks registration before insert/update.
- Unique key prevents multiple feedback rows for the same course+semester.

---

## 6) Frontend workflow (React)

### Client and session storage

- API client: `Frontend/src/api/client.js`
  - Automatically attaches `Authorization: Bearer <token>` if present.
- Auth context: `Frontend/src/auth/AuthContext.jsx`
  - Stores token and student in `localStorage`:
    - `up_token`
    - `up_student`

### Route protection

- `Frontend/src/auth/RequireAuth.jsx` blocks access to `/app/*` when token is missing.
- Unauthenticated users are redirected to `/login`.

### Pages and feature flow

#### Authentication
- **`/register`** → creates account → auto-navigates to `/app`
- **`/login`** → logs in → navigates to `/app`
- **Logout**
  - Button in sidebar clears token and navigates to `/login`

#### Student portal layout

- All student pages live under `/app/*` and use `StudentLayout`:
  - Sidebar navigation
  - Main content outlet

#### Dashboard (`/app`)
- Loads profile + enrollment-based courses
- Displays cards + a recent enrollments table

#### Profile (`/app/profile`)
- Displays student bio-data from `/api/student/profile`

#### Attendance (`/app/attendance`)
- Select a course → fetch attendance → show table + percentage bar

#### Marks (`/app/marks`)
- Select a course → fetch marks → show category tabs

#### Transcript (`/app/transcript`)
- Loads transcript summary and renders:
  - CGPA
  - semester panels with SGPA + courses

#### Course Registration (`/app/registration`)
- Student selects a semester (e.g. `Spring-2026`)
- UI loads:
  - “My registered courses” + total credit hours
  - “Available courses”
- Register/unregister buttons call the registration APIs
- If a student tries to exceed 18 credit hours:
  - API returns 409 and UI shows the error message

#### Course Feedback (`/app/feedback`)
- Student selects a semester
- UI loads only registered courses
- Student selects a course, chooses rating, writes comment, submits
- Existing feedback is displayed and can be updated

---

## 7) Start-to-finish walkthrough (typical user journey)

1. **DB setup**
   - Admin runs `schema.sql`
   - Admin runs `schema_registration_feedback.sql`
   - Admin optionally runs `dummy_data.sql`
2. **Backend starts**
   - Express starts on `PORT` (default 5000)
   - DB pool connects
3. **Frontend starts**
   - Vite dev server starts
   - `VITE_API_BASE_URL` points to backend
4. **Student registers or logs in**
   - Receives JWT and stores it locally
5. **Student uses portal modules**
   - Profile, attendance, marks, transcript read from DB tables
6. **Student registers courses**
   - System enforces 18 credit hour limit per semester
7. **Student submits feedback**
   - Only possible for registered courses
8. **Student logs out**
   - Token cleared, session ends

---

## 8) Setup checklist (developer/admin)

### Backend `.env`

`Backend/.env` contains:

- `PORT`
- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`

### Frontend `.env`

Create `Frontend/.env` (or use `.env.example`) with:

- `VITE_API_BASE_URL=http://localhost:5000`

---

## 9) Notes for future automation

The project is structured so you can later automate admin work (AI/agents) because:

- APIs return standardized JSON
- Course registrations are captured independently from official transcript enrollments
- Feedback is tied to registered courses and is normalized for analytics

