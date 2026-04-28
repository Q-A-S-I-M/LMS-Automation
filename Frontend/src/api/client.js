const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

async function request(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  health: () => request("/api/health"),
  login: (payload) => request("/api/auth/login", { method: "POST", body: payload }),
  register: (payload) => request("/api/auth/register", { method: "POST", body: payload }),
  teacherLogin: (payload) => request("/api/auth/teacher/login", { method: "POST", body: payload }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request("/api/auth/me"),
  profile: () => request("/api/student/profile"),
  courses: () => request("/api/student/courses"),
  attendance: (courseId, semester) =>
    request(`/api/student/attendance/${courseId}?semester=${encodeURIComponent(semester)}`),
  marks: (courseId, semester) => request(`/api/student/marks/${courseId}?semester=${encodeURIComponent(semester)}`),
  transcript: () => request("/api/student/transcript"),
  registrationAvailable: (semester) =>
    request(`/api/student/registration/available?semester=${encodeURIComponent(semester)}`),
  registrationMy: (semester) =>
    request(`/api/student/registration/my?semester=${encodeURIComponent(semester)}`),
  registrationRegister: (payload) => request("/api/student/registration/register", { method: "POST", body: payload }),
  registrationUnregister: (payload) =>
    request("/api/student/registration/unregister", { method: "POST", body: payload }),
  registrationLock: (payload) => request("/api/student/registration/lock", { method: "POST", body: payload }),
  feedbackMy: (semester) => request(`/api/student/feedback/my?semester=${encodeURIComponent(semester)}`),
  feedbackSubmit: (payload) => request("/api/student/feedback/submit", { method: "POST", body: payload }),

  // Teacher APIs
  teacherStudents: () => request("/api/teacher/students"),
  teacherCourses: () => request("/api/teacher/courses"),
  teacherCourseCreate: (payload) => request("/api/teacher/courses", { method: "POST", body: payload }),
  teacherCourseUpdate: (courseCode, payload) =>
    request(`/api/teacher/courses/${encodeURIComponent(courseCode)}`, { method: "PUT", body: payload }),
  teacherCourseDelete: (courseCode) => request(`/api/teacher/courses/${encodeURIComponent(courseCode)}`, { method: "DELETE" }),
  teacherRegistrations: (semester, course_code) => {
    const qs = new URLSearchParams({ semester, ...(course_code ? { course_code } : {}) }).toString();
    return request(`/api/teacher/registrations?${qs}`);
  },
  teacherEnroll: (payload) => request("/api/teacher/enroll", { method: "POST", body: payload }),
  teacherRegistrationDecision: (payload) => request("/api/teacher/registrations/decision", { method: "POST", body: payload }),
  teacherMarksUpsert: (payload) => request("/api/teacher/marks/upsert", { method: "POST", body: payload }),
  teacherAttendanceUpsert: (payload) => request("/api/teacher/attendance/upsert", { method: "POST", body: payload }),
  teacherStats: (semester) => request(`/api/teacher/stats?semester=${encodeURIComponent(semester)}`),
  teacherFeedback: (semester, course_code) => {
    const qs = new URLSearchParams({ semester, ...(course_code ? { course_code } : {}) }).toString();
    return request(`/api/teacher/feedback?${qs}`);
  },
  teacherFeedbackRespond: (id, payload) =>
    request(`/api/teacher/feedback/${encodeURIComponent(id)}/respond`, { method: "PATCH", body: payload }),
};

