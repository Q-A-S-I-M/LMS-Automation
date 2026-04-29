# 1. System Overview
- **Purpose**: A University Portal (LMS-like academic portal) that supports **student self-service** (profile, course registration, attendance/marks viewing, transcript, course feedback) and a **teacher module** (student list, course catalog management, registrations approval/enrollment, marks upload with grading, attendance upload, feedback review/response, semester stats).
- **Frontend tech**: React + React Router (`Frontend/src/App.jsx`), Vite dev server (`Frontend/package.json`), cookie-based API calls using `fetch(..., credentials: "include")` (`Frontend/src/api/client.js`).
- **Backend tech**: Node.js + Express (`Backend/src/app.js`), MySQL via `mysql2/promise` connection pool (`Backend/src/config/db.js`), authentication via JWT stored in an HTTP-only cookie `up_at` (`Backend/src/routes/auth.js`, `Backend/src/middleware/auth.js`), CORS enabled with credentials (`Backend/src/app.js`).
- **Data layer**: MySQL schema + seed data in `Backend/sql/schema_all_in_one.sql` and `Backend/sql/dummy_data.sql`.

-------------------------------------

# 2. Database Schema Summary

## `students`
- **Columns**
  - `roll_no` (VARCHAR(10), PK)
  - `full_name` (VARCHAR(100))
  - `email` (VARCHAR(100), UNIQUE)
  - `password_hash` (VARCHAR(255))
  - `degree` (VARCHAR(50))
  - `section` (VARCHAR(10))
  - `batch` (VARCHAR(20))
  - `campus` (VARCHAR(50))
  - `dob` (DATE)
  - `cnic` (VARCHAR(20))
  - `blood_group` (VARCHAR(5))
  - `nationality` (VARCHAR(50))
  - `status` (ENUM: `Current|Alumni|Withdrawn`, default `Current`)
- **Relationships**
  - Referenced by: `course_registrations.roll_no`, `student_registration_locks.roll_no`, `enrollments.roll_no`, `attendance.roll_no`, `marks.roll_no`, `course_feedback.roll_no`
- **Purpose**
  - Primary student identity + profile + login credential (bcrypt hash).

## `teachers`
- **Columns**
  - `id` (INT, PK, AUTO_INCREMENT)
  - `username` (VARCHAR(50), UNIQUE, NOT NULL)
  - `email` (VARCHAR(100), UNIQUE)
  - `password_hash` (VARCHAR(255), NOT NULL)
  - `full_name` (VARCHAR(100))
  - `created_at` (TIMESTAMP, default CURRENT_TIMESTAMP)
- **Relationships**
  - None declared to other tables in schema (teacher actions are role-gated; data they manage is stored in other tables without explicit teacher ownership).
- **Purpose**
  - Teacher/instructor authentication identity for the teacher module.

## `courses`
- **Columns**
  - `course_code` (VARCHAR(10), PK)
  - `course_name` (VARCHAR(100))
  - `credit_hours` (INT)
- **Relationships**
  - Referenced by: `course_offerings.course_code`, `course_registrations.course_code`, `enrollments.course_code`, `attendance.course_code`, `marks.course_code`, `course_feedback.course_code`
- **Purpose**
  - Course catalog (code/name/credit hours). Teacher can CRUD this catalog.

## `registration_cycles`
- **Columns**
  - `id` (INT, PK, AUTO_INCREMENT)
  - `semester` (VARCHAR(20), UNIQUE, NOT NULL)
  - `start_date` (DATE, NOT NULL)
  - `end_date` (DATE, NOT NULL)
  - `status` (ENUM: `Open|Closed`, default `Open`)
  - `created_at` (TIMESTAMP, default CURRENT_TIMESTAMP)
  - CHECK: `end_date >= start_date`
- **Relationships**
  - Referenced by: `course_offerings.semester` (FK to `registration_cycles.semester`), `course_registrations.semester` (FK), `student_registration_locks.semester` (FK)
- **Purpose**
  - Represents the registration window per semester, used to allow/deny student registration actions.

## `course_offerings`
- **Columns**
  - `id` (INT, PK, AUTO_INCREMENT)
  - `semester` (VARCHAR(20), FK -> `registration_cycles.semester`)
  - `course_code` (VARCHAR(10), FK -> `courses.course_code`)
  - `is_active` (BOOLEAN, default TRUE)
  - `created_at` (TIMESTAMP, default CURRENT_TIMESTAMP)
  - UNIQUE: (`semester`, `course_code`)
  - Indexes: `semester`, `course_code`
- **Relationships**
  - `course_offerings.course_code` -> `courses.course_code`
  - `course_offerings.semester` -> `registration_cycles.semester`
- **Purpose**
  - Which catalog courses are offered in a given semester (and whether selectable).

## `course_registrations`
- **Columns**
  - `id` (INT, PK, AUTO_INCREMENT)
  - `roll_no` (VARCHAR(10), FK -> `students.roll_no`)
  - `course_code` (VARCHAR(10), FK -> `courses.course_code`)
  - `semester` (VARCHAR(20), FK -> `registration_cycles.semester`)
  - `status` (ENUM: `Registered|Enrolled|Dropped`, default `Registered`)
  - `enrolled_at` (TIMESTAMP NULL)
  - `dropped_at` (TIMESTAMP NULL)
  - `created_at` (TIMESTAMP, default CURRENT_TIMESTAMP)
  - UNIQUE: (`roll_no`, `course_code`, `semester`)
  - Indexes: (`roll_no`,`semester`), `course_code`, (`status`,`semester`)
- **Relationships**
  - Links student + course + semester and captures lifecycle (`Registered` -> `Enrolled` or `Dropped`).
- **Purpose**
  - Authoritative “registration” record. Student creates/deletes registration; teacher can approve/reject or mass-enroll registered students.

## `student_registration_locks`
- **Columns**
  - `id` (INT, PK, AUTO_INCREMENT)
  - `roll_no` (VARCHAR(10), FK -> `students.roll_no`)
  - `semester` (VARCHAR(20), FK -> `registration_cycles.semester`)
  - `finalized_at` (TIMESTAMP, default CURRENT_TIMESTAMP)
  - UNIQUE: (`roll_no`, `semester`)
  - Index: `semester`
- **Relationships**
  - Prevents further changes to `course_registrations` for that student+semester.
- **Purpose**
  - “Finalize registration” lock; once inserted, student can no longer add/drop for that semester.

## `enrollments`
- **Columns**
  - `id` (INT, PK, AUTO_INCREMENT)
  - `roll_no` (VARCHAR(10), FK -> `students.roll_no`)
  - `course_code` (VARCHAR(10), FK -> `courses.course_code`)
  - `semester` (VARCHAR(20))
  - `grade` (VARCHAR(2))
  - `points` (DECIMAL(3,2))
  - `final_percentage` (DECIMAL(5,2))
  - `passed` (BOOLEAN)
  - UNIQUE: (`roll_no`, `course_code`, `semester`)
  - Indexes: (`roll_no`,`semester`), `course_code`
- **Relationships**
  - Enrollment rows are created when:
    - student finalizes registration (`/api/student/registration/lock` inserts from `course_registrations`)
    - teacher approves/enrolls students (`/api/teacher/*` ensures `enrollments` exists)
  - Used by transcript and by “courses” list used to select attendance/marks in UI.
- **Purpose**
  - Transcript + academic record per course per semester. Teacher uploading marks updates `grade/points/final_percentage/passed`.

## `attendance`
- **Columns**
  - `id` (INT, PK, AUTO_INCREMENT)
  - `roll_no` (VARCHAR(10), FK -> `students.roll_no`)
  - `course_code` (VARCHAR(10))
  - `semester` (VARCHAR(20))
  - `lecture_no` (INT)
  - `date` (DATE)
  - `duration_hours` (INT)
  - `presence` (ENUM: `P|A`)
  - UNIQUE: (`roll_no`, `course_code`, `semester`, `lecture_no`)
  - Indexes: (`roll_no`,`course_code`), (`roll_no`,`course_code`,`semester`), `date`
- **Relationships**
  - Attendance is upserted by teacher API, read by student API.
- **Purpose**
  - Lecture-by-lecture attendance with computed summary/percentage for students.

## `marks`
- **Columns**
  - `id` (INT, PK, AUTO_INCREMENT)
  - `roll_no` (VARCHAR(10), FK -> `students.roll_no`)
  - `course_code` (VARCHAR(10))
  - `semester` (VARCHAR(20))
  - `category` (ENUM: `Assignment|Quiz|Sessional-I|Sessional-II|Final`)
  - `item_no` (INT)
  - `obtained_marks` (DECIMAL(5,2))
  - `total_marks` (DECIMAL(5,2))
  - `weightage` (DECIMAL(5,2))
  - UNIQUE: (`roll_no`, `course_code`, `semester`, `category`, `item_no`)
  - Indexes: (`roll_no`,`course_code`), (`roll_no`,`course_code`,`semester`)
- **Relationships**
  - Teacher upserts marks; student reads marks and sees computed grand total, grade, points.
- **Purpose**
  - Component-wise marks storage. System computes grand total using expected weightage.

## `course_feedback`
- **Columns**
  - `id` (INT, PK, AUTO_INCREMENT)
  - `roll_no` (VARCHAR(10), FK -> `students.roll_no`)
  - `course_code` (VARCHAR(10), FK -> `courses.course_code`)
  - `semester` (VARCHAR(20))
  - `rating` (TINYINT, CHECK 1..5)
  - `comment` (TEXT)
  - `teacher_response` (TEXT NULL)
  - `responded_at` (TIMESTAMP NULL)
  - `created_at` (TIMESTAMP default CURRENT_TIMESTAMP)
  - `updated_at` (TIMESTAMP default CURRENT_TIMESTAMP ON UPDATE)
  - UNIQUE: (`roll_no`, `course_code`, `semester`)
  - Indexes: (`roll_no`,`semester`), (`course_code`,`semester`)
- **Relationships**
  - Student submits feedback (upsert), teacher can list feedback and respond (patch).
- **Purpose**
  - Course-level feedback and optional teacher response thread.

-------------------------------------

# 3. Backend API Inventory

## Auth

### POST `/api/auth/register`
- **Inputs (JSON body)**: `roll_no`, `full_name`, `email`, `password` (required); optional `degree`, `section`, `batch`, `campus`, `dob`, `cnic`, `blood_group`, `nationality`
- **Response**
  - `201`: `{ ok: true, role: "student", student: { roll_no, email, full_name } }` and sets cookie `up_at`
  - `400`: missing required fields, short password, invalid optional values (e.g., wrong date type if provided)
  - `409`: duplicate roll/email
  - `500`: generic failure
- **Logic**
  - Hashes password with bcrypt.
  - Inserts into `students`.
  - Auto-logs in by signing JWT `{ role:"student", roll_no }` and storing in `up_at` httpOnly cookie.

### POST `/api/auth/login`
- **Inputs**: `{ roll_no OR email, password }`
- **Response**
  - `200`: `{ ok: true, role: "student", student: { roll_no, email, full_name } }` + cookie `up_at`
  - `400`: missing identifier/password
  - `401`: invalid credentials
- **Logic**
  - Looks up student by roll_no or email.
  - bcrypt compare.
  - JWT -> cookie.

### POST `/api/auth/teacher/login`
- **Inputs**: `{ username OR email, password }`
- **Response**
  - `200`: `{ ok: true, role:"teacher", teacher:{ id, username, email, full_name } }` + cookie `up_at`
  - `400`: missing identifier/password
  - `401`: invalid credentials
- **Logic**
  - Looks up teacher by username/email, bcrypt compare, stores JWT `{ role:"teacher", teacher_id }` in cookie.

### POST `/api/auth/logout`
- **Inputs**: none
- **Response**: `{ ok: true }` and clears cookie `up_at`
- **Logic**: clears cookie path `/`.

### GET `/api/auth/me`
- **Inputs**: cookie `up_at` or `Authorization: Bearer <token>` (optional)
- **Response**
  - `200`: `{ ok: true, role: "student", student: { roll_no, full_name, email } }` OR `{ ok: true, role:"teacher", teacher: { id, username, email, full_name } }`
  - `401`: not authenticated / invalid session / invalid role
- **Logic**
  - If token exists and verifies, fetches the corresponding user row from DB and returns it.

## Student (all routes require authentication and `role=student`)
Mounted at `app.use("/api/student", authRequired, requireStudent, studentRoutes)`.

### GET `/api/student/profile`
- **Inputs**: session (student roll_no from JWT)
- **Response**
  - `200`: `{ ok: true, profile: <student profile row> }`
  - `404`: student not found
- **Logic**: selects profile columns from `students` by roll number.

### GET `/api/student/courses`
- **Inputs**: session
- **Response**: `{ ok: true, courses: [{ course_code, course_name, credit_hours, semester }, ...] }`
- **Logic**: joins `enrollments` + `courses` for the logged-in student; used by UI pickers for marks/attendance.

### GET `/api/student/registration/available?semester=<SEM>`
- **Inputs**: query `semester`
- **Response**
  - `200`: `{ ok:true, semester, cycle_status, courses:[{course_code, course_name, credit_hours, offering_type}, ...] }`
  - `400`: missing semester
  - `404`: cycle not found
- **Logic**
  - Confirms cycle exists; returns offered courses for semester from `course_offerings` where active.
  - Filters out courses already registered in `course_registrations` for that semester.
  - Filters out courses already passed (via `enrollments` with passing grade/percentage).
  - Adds `offering_type` = `Retake` if previously failed (based on `enrollments` grade/percentage).

### GET `/api/student/registration/my?semester=<SEM>`
- **Inputs**: query `semester`
- **Response**
  - `200`: `{ ok:true, semester, finalized, finalized_at, max_credit_hours, total_credit_hours, registrations:[...] }`
  - `400`: missing semester
- **Logic**
  - Lists `course_registrations` for student+semester with `courses` join.
  - Computes total credit hours.
  - Checks lock in `student_registration_locks`.

### POST `/api/student/registration/register`
- **Inputs**: `{ course_code, semester }`
- **Response**
  - `201`: `{ ok:true, semester, course_code, status:"Registered", max_credit_hours, total_credit_hours }`
  - `400`: missing fields
  - `404`: course not found
  - `409`: cycle closed, semester finalized, course not offered, already passed, already registered, credit hour limit exceeded
  - `500`: failure
- **Logic**
  - Transactional:
    - requires registration cycle exists and is `Open`
    - disallows modification if semester finalized (`student_registration_locks`)
    - ensures course is offered (`course_offerings`)
    - disallows re-registering passed courses (`enrollments`)
    - locks current registrations with `FOR UPDATE` and enforces `MAX_CREDIT_HOURS=18`
    - inserts `course_registrations` row with status `Registered`

### POST `/api/student/registration/unregister`
- **Inputs**: `{ course_code, semester }`
- **Response**
  - `200`: `{ ok:true, semester, course_code }`
  - `400`: missing fields
  - `404`: not found
  - `409`: cycle closed, finalized, or status is `Enrolled` (cannot drop)
- **Logic**
  - Requires open cycle and not finalized.
  - Prevents removal if the registration is already `Enrolled`.
  - Deletes the `course_registrations` row.

### POST `/api/student/registration/lock`
- **Inputs**: `{ semester }`
- **Response**
  - `200`: `{ ok:true, semester, status:"Finalized", locked_courses:<n> }`
  - `400`: missing semester
  - `409`: cycle closed, already finalized, no registered courses
  - `500`: failure
- **Logic**
  - Transactional:
    - requires open cycle and not finalized
    - requires at least one registration
    - updates all `Registered` -> `Enrolled` and sets `enrolled_at`
    - inserts missing `enrollments` rows for all registrations (grade/points null)
    - inserts a `student_registration_locks` record (finalize)

### GET `/api/student/feedback/my?semester=<SEM>`
- **Inputs**: query `semester`
- **Response**: `{ ok:true, semester, courses:[{ course_code, course_name, credit_hours, rating, comment, updated_at }, ...] }`
- **Logic**
  - Lists the student’s registered courses for semester; left-joins `course_feedback` for current rating/comment.

### POST `/api/student/feedback/submit`
- **Inputs**: `{ course_code, semester, rating, comment? }`
- **Response**
  - `200`: `{ ok:true, semester, course_code, rating, comment }`
  - `400`: missing required fields, invalid rating
  - `403`: student not registered for that course+semester
- **Logic**
  - Requires a `course_registrations` row exists.
  - Upserts into `course_feedback` using unique (`roll_no`,`course_code`,`semester`).

### GET `/api/student/attendance/:courseId?semester=<SEM>`
- **Inputs**: URL param `courseId` (course_code), query `semester`
- **Response**
  - `200`: `{ ok:true, course_code, semester, summary:{ total_lectures, present, percentage }, lectures:[...] }`
  - `400`: missing semester
- **Logic**
  - Reads attendance rows; computes present/total/percentage.

### GET `/api/student/marks/:courseId?semester=<SEM>`
- **Inputs**: URL param `courseId` (course_code), query `semester`
- **Response**
  - `200`: `{ ok:true, course_code, semester, marks:<grouped by category>, grand_total:{ total, complete, breakdown }, transcript:{ grade, points }|null }`
  - `400`: missing semester
- **Logic**
  - Loads marks rows and groups by category.
  - Computes grand total with required weightages (Quiz 10, Assignment 10, Sessional-I 15, Sessional-II 15, Final 50).
  - If complete, derives grade + GPA points.

### GET `/api/student/transcript`
- **Inputs**: session
- **Response**
  - `200`: `{ ok:true, roll_no, cgpa, semesters:[{ semester, sgpa, total_credit_hours, courses:[...] }, ...] }`
- **Logic**
  - Reads `enrollments` joined to `courses`.
  - Groups by semester for SGPA, computes overall CGPA using grade->points mapping.

## Teacher (all routes require authentication and `role=teacher`)
Mounted at `app.use("/api/teacher", authRequired, requireTeacher, teacherRoutes)`.

### GET `/api/teacher/students`
- **Inputs**: session
- **Response**: `{ ok:true, students:[{ roll_no, full_name, email, degree, section, batch, campus, status }, ...] }`
- **Logic**: lists all students.

### GET `/api/teacher/courses`
- **Response**: `{ ok:true, courses:[{ course_code, course_name, credit_hours }, ...] }`
- **Logic**: lists course catalog.

### POST `/api/teacher/courses`
- **Inputs**: `{ course_code, course_name, credit_hours }`
- **Response**
  - `201`: `{ ok:true, course:{ course_code, course_name, credit_hours } }`
  - `400`: invalid/missing fields
  - `409`: duplicate
  - `500`: failure
- **Logic**: inserts into `courses`.

### PUT `/api/teacher/courses/:courseCode`
- **Inputs**: URL param `courseCode`; body optional `course_name`, `credit_hours`
- **Response**
  - `200`: `{ ok:true, course:{...} }`
  - `400`: no updates / invalid credit hours
  - `404`: not found
- **Logic**: dynamic SQL updates only provided fields; then fetches updated row.

### DELETE `/api/teacher/courses/:courseCode`
- **Response**
  - `200`: `{ ok:true, course_code }`
  - `404`: not found
- **Logic**: deletes from `courses` (may fail at DB-level if FK constraints block; route does not special-case that).

### GET `/api/teacher/registrations?semester=<SEM>&course_code=<CODE?>`
- **Inputs**: `semester` required; `course_code` optional
- **Response**: `{ ok:true, semester, registrations:[{ id, roll_no, full_name, section, batch, course_code, course_name, credit_hours, semester, status, created_at, enrolled_at }, ...] }`
- **Logic**: joins `course_registrations` with `students` + `courses`, filters by semester and optionally course.

### POST `/api/teacher/enroll`
- **Inputs**: `{ semester, course_code, roll_nos?: string[] }`
- **Response**: `{ ok:true, semester, course_code, enrolled_count }`
- **Logic**
  - Transactional:
    - selects `Registered` registrations for course+semester (optionally within roll_nos) `FOR UPDATE`
    - inserts `enrollments` row for each roll_no if missing
    - updates registration to `Enrolled` with `enrolled_at`

### POST `/api/teacher/registrations/decision`
- **Inputs**: `{ semester, course_code, action:"approve"|"reject", roll_nos:[...] }`
- **Response**: `{ ok:true, semester, course_code, action, processed_count, processed_roll_nos }`
- **Logic**
  - Transactional:
    - finds matching `Registered` rows `FOR UPDATE`
    - `approve`: ensures enrollments rows exist, updates registrations to `Enrolled`
    - `reject`: updates registrations to `Dropped` with `dropped_at`

### POST `/api/teacher/marks/upsert`
- **Inputs**: `{ roll_no, course_code, semester, components: { Quiz?, Assignment?, "Sessional-I"?, "Sessional-II"?, Final? } }`
  - Each component: `{ obtained, total }` (numbers)
- **Response**
  - `200`: `{ ok:true, roll_no, course_code, semester, grand_total, transcript|null }`
  - `400`: invalid inputs
  - `403`: student not enrolled/registered for course+semester
  - `500`: failure
- **Logic**
  - Ensures student is enrolled by checking `course_registrations` status `Enrolled` (and ensures `enrollments` exists).
  - Upserts marks into `marks` with `item_no=1` per category and enforces expected weightage constants.
  - Computes grand total; if complete, writes `grade/points/final_percentage/passed` to `enrollments`.

### POST `/api/teacher/attendance/upsert`
- **Inputs**: `{ roll_no, course_code, semester, lectures:[{ lecture_no, date, duration_hours, presence("P"|"A") }, ...] }`
- **Response**
  - `200`: `{ ok:true, roll_no, course_code, semester, upserted:<n> }`
  - `400`: validation failures
  - `403`: student not enrolled/registered for course+semester
  - `500`: failure
- **Logic**
  - Ensures enrollment (same rule as marks).
  - Upserts each lecture by unique key `(roll_no, course_code, semester, lecture_no)`.

### GET `/api/teacher/feedback?semester=<SEM>&course_code=<CODE?>`
- **Inputs**: `semester` required; `course_code` optional
- **Response**: `{ ok:true, semester, feedback:[{ id, roll_no, full_name, course_code, course_name, semester, rating, comment, updated_at, teacher_response, responded_at }, ...] }`
- **Logic**: joins `course_feedback` with `students` + `courses`, filters by semester and optional course.

### PATCH `/api/teacher/feedback/:id/respond`
- **Inputs**: URL param `id`; body `{ teacher_response }`
- **Response**
  - `200`: `{ ok:true, id, teacher_response }`
  - `400`: invalid id
  - `404`: feedback not found
- **Logic**
  - Updates teacher response; sets `responded_at` to now if response not empty, else clears it.

### GET `/api/teacher/stats?semester=<SEM?>`
- **Inputs**: optional query `semester`
- **Response**: `{ ok:true, semester|null, counts:{students,courses}, registrations:{registered,enrolled,dropped}, feedback:{count,avg_rating}, marks_completion:{complete,total} }`
- **Logic**
  - Always returns global `students` count and `courses` count.
  - If semester provided, aggregates registration statuses, feedback count/avg, and how many enrollments have `grade` set.

## Misc / Health

### GET `/`
- **Response**: text `"Server is running..."`

### GET `/api/health`
- **Response**: `{ ok:true, status:"up" }`

-------------------------------------

# 4. Feature List (System Capabilities)
- **Authentication**
  - Student registration
  - Student login (roll no or email)
  - Teacher login (username or email)
  - Logout
  - Session hydration via `/api/auth/me`
  - JWT stored in HTTP-only cookie (and also supports Bearer token)
- **Student self-service**
  - View profile (complete biodata)
  - View historical enrollments list (used as course picker)
  - Course registration for a semester
    - View available offered courses
    - Register course (credit-hour cap enforced)
    - Unregister a non-enrolled course
    - Finalize registration (locks the semester)
    - Enrollments record creation on finalize
    - Retake vs regular indicator based on prior failure
    - Prevent re-registering a passed course
  - Attendance view per course+semester with percentage summary
  - Marks view per course+semester
    - category grouping
    - computed grand total + grade/points when complete
  - Transcript view
    - semester grouping with SGPA
    - overall CGPA
  - Course feedback
    - list registered courses and existing feedback
    - submit/update rating+comment
- **Teacher module**
  - View all students
  - Course catalog management (create, update, delete)
  - View registrations by semester (optionally filter by course)
  - Enroll registered students (bulk)
  - Approve/reject selected registrations
  - Upload marks by component; auto compute grade/points/final percentage and update transcript fields
  - Upload attendance (upsert lecture record)
  - View feedback and respond
  - Semester dashboard stats (counts, registration statuses, avg feedback, marks completion)

-------------------------------------

# 5. User Action Mapping

## STUDENT ACTIONS
- Register account (creates student + auto-login)
- Login (with roll number or email)
- Logout
- View dashboard (profile + recent enrollments)
- View profile details
- Choose a semester and:
  - View available courses offered for that semester
  - Register a course (subject to credit hour cap and business rules)
  - Unregister a course (only if not enrolled/locked)
  - Finalize registration for semester (locks add/drop)
- Choose a course+semester and:
  - View attendance list and attendance percentage
  - View marks by category and computed totals/grade when complete
- View transcript (semester-wise SGPA + overall CGPA)
- Submit or update feedback for a registered course (rating + comment)

## TEACHER ACTIONS
- Login (with username or email)
- Logout
- View semester stats dashboard (optionally by semester)
- View all students
- View course catalog
- Create a course
- Update a course (name and/or credit hours)
- Delete a course
- View registrations for a semester (optionally filter by course)
- Enroll all registered students for a course in a semester
- Approve (enroll) selected registrations for a course in a semester
- Reject selected registrations for a course in a semester (marks as dropped)
- Upload marks components for a student in a course+semester (partial or complete)
- Upload attendance for a student in a course+semester (lecture-by-lecture upsert)
- View feedback for a semester (optionally filter by course)
- Respond to a feedback record

-------------------------------------

# 6. Workflow Extraction

## Registration Flow (Student Account Creation)
- **Steps**
  1. Student fills registration form (roll no, full name, email, password, optional bio fields) in `Frontend/src/pages/Register.jsx`.
  2. Frontend calls `api.register(payload)` which POSTs to `/api/auth/register` with `credentials:"include"`.
  3. Backend inserts into `students`, sets cookie `up_at`, returns student identity.
  4. Frontend sets auth state in `AuthContext` and navigates to `/app`.
- **APIs involved**
  - `POST /api/auth/register`
  - (Implicit) `GET /api/auth/me` on page refresh/app mount to hydrate session
- **Required data**
  - `roll_no`, `full_name`, `email`, `password`

## Login Flow (Student)
- **Steps**
  1. Student enters roll number or email + password in `Frontend/src/pages/Login.jsx`.
  2. Frontend chooses payload key based on `identifier.includes("@")`.
  3. Calls `POST /api/auth/login`.
  4. Backend sets cookie `up_at`.
  5. Frontend sets auth state -> navigate `/app`.
- **APIs involved**: `POST /api/auth/login`, `GET /api/auth/me` (hydration)
- **Required data**: `roll_no|email`, `password`

## Login Flow (Teacher)
- **Steps**
  1. Teacher enters username/email + password in `Frontend/src/pages/TeacherLogin.jsx`.
  2. Calls `POST /api/auth/teacher/login`.
  3. Backend sets cookie `up_at`.
  4. Frontend sets teacher auth state -> navigate `/teacher`.
- **APIs involved**: `POST /api/auth/teacher/login`, `GET /api/auth/me` (hydration)
- **Required data**: `username|email`, `password`

## Course Registration Flow (Student Add/Drop + Finalize)
- **Steps**
  1. Student navigates to `/app/registration` (`Frontend/src/pages/CourseRegistration.jsx`).
  2. Frontend calls, in parallel:
     - `GET /api/student/registration/available?semester=...`
     - `GET /api/student/registration/my?semester=...`
  3. Student clicks “Register” on an available course.
  4. Frontend calls `POST /api/student/registration/register` with `{ course_code, semester }`.
  5. Backend enforces:
     - cycle exists and `Open`
     - semester not finalized
     - course is offered and active
     - course not already passed
     - credit hours <= 18 total (transaction with `FOR UPDATE`)
  6. Student can “Unregister” a course if not enrolled and not finalized.
     - Frontend calls `POST /api/student/registration/unregister`.
  7. Student clicks “Finalize Registration”.
     - Frontend calls `POST /api/student/registration/lock`.
     - Backend transitions `Registered` -> `Enrolled`, inserts `enrollments`, inserts lock row.
  8. After each mutation, UI refreshes via step (2) calls.
- **APIs involved**
  - `GET /api/student/registration/available`
  - `GET /api/student/registration/my`
  - `POST /api/student/registration/register`
  - `POST /api/student/registration/unregister`
  - `POST /api/student/registration/lock`
- **Required data**
  - `semester` always
  - `course_code` for add/drop

## Attendance Viewing Flow (Student)
- **Steps**
  1. Student opens `/app/attendance`.
  2. Frontend loads available course+semester options from `GET /api/student/courses` (actually enrollments history).
  3. On selection change, frontend calls `GET /api/student/attendance/:course_code?semester=...`.
  4. UI renders lecture list and computed percentage.
- **APIs involved**: `GET /api/student/courses`, `GET /api/student/attendance/:courseId`
- **Required data**: `course_code`, `semester`

## Marks Viewing Flow (Student)
- **Steps**
  1. Student opens `/app/marks`.
  2. Frontend loads course+semester options via `GET /api/student/courses`.
  3. On selection change, frontend calls `GET /api/student/marks/:course_code?semester=...`.
  4. UI renders marks per category + grand total; grade appears only when complete.
- **APIs involved**: `GET /api/student/courses`, `GET /api/student/marks/:courseId`
- **Required data**: `course_code`, `semester`

## Transcript Flow (Student)
- **Steps**
  1. Student opens `/app/transcript`.
  2. Frontend calls `GET /api/student/transcript`.
  3. UI groups by semester and displays SGPA + CGPA.
- **APIs involved**: `GET /api/student/transcript`
- **Required data**: none beyond authentication

## Feedback Submission Flow (Student)
- **Steps**
  1. Student opens `/app/feedback`, selects semester.
  2. Frontend calls `GET /api/student/feedback/my?semester=...` to show registered courses + existing rating/comment.
  3. Student selects course, chooses rating, writes comment, submits.
  4. Frontend calls `POST /api/student/feedback/submit`.
  5. Backend verifies registration exists, then upserts into `course_feedback`.
  6. UI refreshes list for that semester.
- **APIs involved**: `GET /api/student/feedback/my`, `POST /api/student/feedback/submit`
- **Required data**: `semester`, `course_code`, `rating` (comment optional)

## Registration Management Flow (Teacher: Approve/Reject/Enroll)
- **Steps**
  1. Teacher opens `/teacher/registrations`.
  2. Frontend loads:
     - `GET /api/teacher/courses` (for course dropdown)
     - `GET /api/teacher/registrations?semester=...&course_code=...` (for table)
  3. Teacher can enroll all registered students for selected course:
     - `POST /api/teacher/enroll` with `{ semester, course_code }`
  4. Teacher can select rows and approve:
     - `POST /api/teacher/registrations/decision` with `{ action:"approve", roll_nos:[...] }`
     - this enrolls them and creates enrollment records if needed
  5. Teacher can reject:
     - same endpoint with `{ action:"reject" }` which sets status `Dropped`
  6. UI refreshes registrations list.
- **APIs involved**
  - `GET /api/teacher/courses`
  - `GET /api/teacher/registrations`
  - `POST /api/teacher/enroll`
  - `POST /api/teacher/registrations/decision`
- **Required data**: `semester`, `course_code` (for actions), `roll_nos` for decision endpoint

## Marks Upload Flow (Teacher)
- **Steps**
  1. Teacher opens `/teacher/marks`.
  2. Frontend loads:
     - `GET /api/teacher/courses`
     - `GET /api/teacher/students`
  3. Teacher selects semester/course/student and enters components.
  4. Submits to `POST /api/teacher/marks/upsert`.
  5. Backend ensures student is enrolled (`course_registrations.status='Enrolled'`) and ensures an `enrollments` row exists.
  6. Backend upserts `marks` components and computes grand total.
  7. If complete, backend updates `enrollments` with grade/points/final_percentage/passed.
- **APIs involved**: `GET /api/teacher/courses`, `GET /api/teacher/students`, `POST /api/teacher/marks/upsert`
- **Required data**: `semester`, `course_code`, `roll_no`, and at least one marks component to upload

## Attendance Upload Flow (Teacher)
- **Steps**
  1. Teacher opens `/teacher/attendance`.
  2. Frontend loads `GET /api/teacher/courses` and `GET /api/teacher/students`.
  3. Teacher selects semester/course/student and enters lecture details.
  4. Submits to `POST /api/teacher/attendance/upsert`.
  5. Backend validates lecture payload, ensures enrollment, and upserts into `attendance`.
- **APIs involved**: `GET /api/teacher/courses`, `GET /api/teacher/students`, `POST /api/teacher/attendance/upsert`
- **Required data**: `semester`, `course_code`, `roll_no`, `lectures[]`

## Feedback Review/Response Flow (Teacher)
- **Steps**
  1. Teacher opens `/teacher/feedback`, chooses semester and optional course filter.
  2. Frontend loads:
     - `GET /api/teacher/courses`
     - `GET /api/teacher/feedback?semester=...&course_code=...`
  3. Teacher writes response and clicks save.
  4. Frontend calls `PATCH /api/teacher/feedback/:id/respond`.
  5. Backend sets/clears `teacher_response` and `responded_at`.
- **APIs involved**: `GET /api/teacher/feedback`, `PATCH /api/teacher/feedback/:id/respond`
- **Required data**: `semester`, feedback `id`, `teacher_response`

-------------------------------------

# 7. AI Interaction Readiness Layer (IMPORTANT)

Below is an AI-agent oriented “intent layer” that maps each supported user action to:
- **Intent Name**
- **Required Parameters**
- **Requires Authentication?** (and which role)
- **Missing Info Handling**: what the AI should ask the user for if parameters are missing/ambiguous

## Auth intents

### Intent: `student_register`
- **Required parameters**
  - `roll_no`, `full_name`, `email`, `password`
  - optional: `degree`, `section`, `batch`, `campus`, `dob`, `cnic`, `blood_group`, `nationality`
- **Requires Authentication?** No
- **Missing info handling**
  - Ask for roll number, full name, email, password.
  - If optional fields omitted, proceed with minimal required fields.
- **API**
  - `POST /api/auth/register`

### Intent: `student_login`
- **Required parameters**: `identifier` (roll_no or email), `password`
- **Requires Authentication?** No
- **Missing info handling**
  - Ask “roll number or email?” and password.
- **API**
  - `POST /api/auth/login` (map identifier to `roll_no` or `email`)

### Intent: `teacher_login`
- **Required parameters**: `identifier` (username or email), `password`
- **Requires Authentication?** No
- **Missing info handling**
  - Ask “username or email?” and password.
- **API**
  - `POST /api/auth/teacher/login`

### Intent: `logout`
- **Required parameters**: none
- **Requires Authentication?** Yes (any role, but safe to call even if already logged out)
- **Missing info handling**
  - If user is not logged in, confirm they still want to clear session; proceed.
- **API**
  - `POST /api/auth/logout`

## Student intents

### Intent: `student_view_profile`
- **Required parameters**: none
- **Requires Authentication?** Yes (student)
- **Missing info handling**
  - If not authenticated, ask student to login.
- **API**
  - `GET /api/student/profile`

### Intent: `student_list_enrollments`
- **Required parameters**: none
- **Requires Authentication?** Yes (student)
- **Missing info handling**
  - If user asks “my courses”, clarify whether they mean “registered this semester” vs “all enrollments history”.
- **API**
  - `GET /api/student/courses`

### Intent: `student_list_registration_available`
- **Required parameters**: `semester`
- **Requires Authentication?** Yes (student)
- **Missing info handling**
  - Ask: “Which semester? (e.g., Spring-2026)”.
- **API**
  - `GET /api/student/registration/available?semester=...`

### Intent: `student_list_my_registrations`
- **Required parameters**: `semester`
- **Requires Authentication?** Yes (student)
- **Missing info handling**
  - Ask for semester.
- **API**
  - `GET /api/student/registration/my?semester=...`

### Intent: `student_register_course`
- **Required parameters**: `semester`, `course_code`
- **Requires Authentication?** Yes (student)
- **Missing info handling**
  - If `semester` missing: ask for semester.
  - If `course_code` missing: ask for course code or offer to list available courses first (`student_list_registration_available`).
  - If API returns 409:
    - Ask whether they want to choose a different course/semester or if registration is finalized/closed.
- **API**
  - `POST /api/student/registration/register`

### Intent: `student_unregister_course`
- **Required parameters**: `semester`, `course_code`
- **Requires Authentication?** Yes (student)
- **Missing info handling**
  - Ask for semester and course code.
  - If status is `Enrolled` / finalized: tell user it’s locked; suggest contacting admin/teacher (system has no API to drop enrolled courses).
- **API**
  - `POST /api/student/registration/unregister`

### Intent: `student_finalize_registration`
- **Required parameters**: `semester`
- **Requires Authentication?** Yes (student)
- **Missing info handling**
  - Ask for semester.
  - If “no registered courses found”: ask if they want to register courses first.
- **API**
  - `POST /api/student/registration/lock`

### Intent: `student_view_attendance`
- **Required parameters**: `course_code`, `semester`
- **Requires Authentication?** Yes (student)
- **Missing info handling**
  - If missing `course_code`/`semester`: offer to list available course+semester pairs from enrollments (`student_list_enrollments`) and have user choose.
- **API**
  - `GET /api/student/attendance/:courseId?semester=...`

### Intent: `student_view_marks`
- **Required parameters**: `course_code`, `semester`
- **Requires Authentication?** Yes (student)
- **Missing info handling**
  - If missing selection: offer list from `student_list_enrollments`.
  - If grade is missing: explain that teacher must upload all 5 components.
- **API**
  - `GET /api/student/marks/:courseId?semester=...`

### Intent: `student_view_transcript`
- **Required parameters**: none
- **Requires Authentication?** Yes (student)
- **Missing info handling**
  - None; if no data, explain transcript appears after enrollments exist and teacher uploads marks/grades.
- **API**
  - `GET /api/student/transcript`

### Intent: `student_list_feedback_courses`
- **Required parameters**: `semester`
- **Requires Authentication?** Yes (student)
- **Missing info handling**
  - Ask for semester.
- **API**
  - `GET /api/student/feedback/my?semester=...`

### Intent: `student_submit_feedback`
- **Required parameters**: `semester`, `course_code`, `rating`
  - optional: `comment`
- **Requires Authentication?** Yes (student)
- **Missing info handling**
  - Ask for semester and course code (offer list from `student_list_feedback_courses`).
  - Ask for rating (1-5); ask optional comment.
  - If API returns 403: explain they must be registered for that course+semester first.
- **API**
  - `POST /api/student/feedback/submit`

## Teacher intents

### Intent: `teacher_list_students`
- **Required parameters**: none
- **Requires Authentication?** Yes (teacher)
- **Missing info handling**
  - If user is student role, ask to switch/login as teacher.
- **API**
  - `GET /api/teacher/students`

### Intent: `teacher_list_courses`
- **Required parameters**: none
- **Requires Authentication?** Yes (teacher)
- **Missing info handling**
  - None.
- **API**
  - `GET /api/teacher/courses`

### Intent: `teacher_create_course`
- **Required parameters**: `course_code`, `course_name`, `credit_hours`
- **Requires Authentication?** Yes (teacher)
- **Missing info handling**
  - Ask for course code/name and credit hours.
  - If 409 duplicate: ask if they intended to update instead.
- **API**
  - `POST /api/teacher/courses`

### Intent: `teacher_update_course`
- **Required parameters**: `course_code` and at least one of `course_name`, `credit_hours`
- **Requires Authentication?** Yes (teacher)
- **Missing info handling**
  - Ask which field(s) to update if none provided.
- **API**
  - `PUT /api/teacher/courses/:courseCode`

### Intent: `teacher_delete_course`
- **Required parameters**: `course_code`
- **Requires Authentication?** Yes (teacher)
- **Missing info handling**
  - Ask for course code.
  - If deletion fails (possible FK constraint), ask if they want to remove dependent registrations/enrollments first (system has no API; would require DB/admin ops).
- **API**
  - `DELETE /api/teacher/courses/:courseCode`

### Intent: `teacher_list_registrations`
- **Required parameters**: `semester`
  - optional: `course_code`
- **Requires Authentication?** Yes (teacher)
- **Missing info handling**
  - Ask for semester; ask optional course filter.
- **API**
  - `GET /api/teacher/registrations?semester=...&course_code=...`

### Intent: `teacher_enroll_registered_students`
- **Required parameters**: `semester`, `course_code`
  - optional: `roll_nos[]` (if enrolling specific students; frontend uses “all registered” variant)
- **Requires Authentication?** Yes (teacher)
- **Missing info handling**
  - Ask for semester and course code.
  - If enrolling specific students, ask for roll numbers (or offer to list registrations first and select from them).
- **API**
  - `POST /api/teacher/enroll`

### Intent: `teacher_registration_decision`
- **Required parameters**: `semester`, `course_code`, `action` (`approve` or `reject`), `roll_nos[]`
- **Requires Authentication?** Yes (teacher)
- **Missing info handling**
  - Ask for semester/course.
  - Ask whether approve or reject.
  - Ask for roll numbers (or offer to list registrations and select registered rows).
- **API**
  - `POST /api/teacher/registrations/decision`

### Intent: `teacher_upsert_marks`
- **Required parameters**
  - `roll_no`, `course_code`, `semester`
  - `components` (any subset of: `Quiz`, `Assignment`, `Sessional-I`, `Sessional-II`, `Final` each with `obtained`, `total`)
- **Requires Authentication?** Yes (teacher)
- **Missing info handling**
  - Ask for semester/course/student.
  - Ask which components they want to upload; for each component ask obtained/total.
  - If 403: tell teacher the student must be `Enrolled` for that course+semester first (approve/enroll via registrations).
- **API**
  - `POST /api/teacher/marks/upsert`

### Intent: `teacher_upsert_attendance`
- **Required parameters**
  - `roll_no`, `course_code`, `semester`
  - `lectures[]` with `{ lecture_no, date, duration_hours, presence }`
- **Requires Authentication?** Yes (teacher)
- **Missing info handling**
  - Ask for semester/course/student.
  - Ask lecture number, date, hours, presence.
  - If 403: student must be enrolled for that course+semester.
- **API**
  - `POST /api/teacher/attendance/upsert`

### Intent: `teacher_list_feedback`
- **Required parameters**: `semester`
  - optional: `course_code`
- **Requires Authentication?** Yes (teacher)
- **Missing info handling**
  - Ask for semester; ask optional course filter.
- **API**
  - `GET /api/teacher/feedback?semester=...&course_code=...`

### Intent: `teacher_respond_feedback`
- **Required parameters**: `feedback_id`, `teacher_response` (may be empty string to clear response)
- **Requires Authentication?** Yes (teacher)
- **Missing info handling**
  - Ask for which feedback item (id) if not provided; offer to list feedback first.
  - Ask for response text.
- **API**
  - `PATCH /api/teacher/feedback/:id/respond`

### Intent: `teacher_view_stats`
- **Required parameters**: optional `semester`
- **Requires Authentication?** Yes (teacher)
- **Missing info handling**
  - If semester omitted, ask if they want a specific semester’s registration/feedback/marks stats; otherwise show global counts.
- **API**
  - `GET /api/teacher/stats?semester=...`

