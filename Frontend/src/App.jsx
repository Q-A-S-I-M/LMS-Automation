import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import { AuthProvider } from "./auth/AuthContext";
import { RequireRole } from "./auth/RequireRole";
import { StudentLayout } from "./layout/StudentLayout";
import { TeacherLayout } from "./layout/TeacherLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import CourseRegistration from "./pages/CourseRegistration";
import Attendance from "./pages/Attendance";
import Marks from "./pages/Marks";
import Transcript from "./pages/Transcript";
import CourseFeedback from "./pages/CourseFeedback";
import TeacherLogin from "./pages/TeacherLogin";
import TeacherDashboard from "./pages/TeacherDashboard";
import TeacherStudents from "./pages/TeacherStudents";
import TeacherCourses from "./pages/TeacherCourses";
import TeacherRegistrations from "./pages/TeacherRegistrations";
import TeacherMarks from "./pages/TeacherMarks";
import TeacherAttendance from "./pages/TeacherAttendance";
import TeacherFeedback from "./pages/TeacherFeedback";
import Chat from "./pages/Chat";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/teacher/login" element={<TeacherLogin />} />
        {/* LMS AI assistant (agent-chatbot) — own session; not tied to LMS JWT */}
        <Route path="/chat" element={<Chat />} />

        <Route
          path="/app"
          element={
            <RequireRole role="student">
              <StudentLayout />
            </RequireRole>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="registration" element={<CourseRegistration />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="marks" element={<Marks />} />
          <Route path="transcript" element={<Transcript />} />
          <Route path="feedback" element={<CourseFeedback />} />
        </Route>

        <Route
          path="/teacher"
          element={
            <RequireRole role="teacher">
              <TeacherLayout />
            </RequireRole>
          }
        >
          <Route index element={<TeacherDashboard />} />
          <Route path="students" element={<TeacherStudents />} />
          <Route path="courses" element={<TeacherCourses />} />
          <Route path="registrations" element={<TeacherRegistrations />} />
          <Route path="marks" element={<TeacherMarks />} />
          <Route path="attendance" element={<TeacherAttendance />} />
          <Route path="feedback" element={<TeacherFeedback />} />
        </Route>

        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </AuthProvider>
  );
}
