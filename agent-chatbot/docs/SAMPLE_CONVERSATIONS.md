## Sample conversations (realistic)

These examples are constrained to intents/actions defined in `../LMS_CAPABILITY_MAP.md`.

### 1) Student asks for marks (already logged in)
**User**: “Show my marks for CS101 in Spring-2026”

**Agent**:
- Detect intent: `student_view_marks`
- Required params: `course_code=CS101`, `semester=Spring-2026`
- Execute: `GET /api/student/marks/CS101?semester=Spring-2026`
- Reply: “Here are your marks for CS101 (Spring-2026). Grand total is X/100; grade appears when complete.”

### 2) Student not logged in → login flow → transcript
**User**: “Show my transcript”

**Agent**:
- Sees `student_view_transcript` requires auth
- Asks: “You’re not logged in. Are you a student or teacher? What’s your roll no/email and password?”

**User**: “Student. 20CS001, password student123”

**Agent**:
- Intent: `student_login` with identifier/password
- Execute: `POST /api/auth/login`
- Then: `student_view_transcript`
- Execute: `GET /api/student/transcript`

### 3) Teacher uploads marks (missing parameters)
**User**: “Upload marks for Ayesha in CS102”

**Agent**:
- Intent candidate: `teacher_upsert_marks`
- Missing params: `roll_no`, `semester`, `components`
- Followups:
  - “Which semester?”
  - “What is the student roll number?”
  - “Provide components (Quiz/Assignment/Sessional-I/Sessional-II/Final) obtained + total.”

### 4) Invalid credentials retry (teacher)
**User**: “Login as teacher: teacher1 / wrongpass”

**Agent**:
- Intent: `teacher_login`
- LMS returns 401 → agent replies:
  - “Login failed (invalid credentials). Please re-enter username/email and password.”

### 5) Student enroll/register with missing course code
**User**: “Enroll me in AI course for Spring-2026”

**Agent**:
- Intent: `student_register_course`
- Missing params: `course_code`
- Followups:
  - “What is the course code (e.g., CS101)?”
  - “If you don’t know it, I can list available courses for Spring-2026.”
- If user asks to list:
  - Intent: `student_list_registration_available`
  - Execute: `GET /api/student/registration/available?semester=Spring-2026`

