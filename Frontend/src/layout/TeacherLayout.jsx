import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ChatWidget } from "../components/ChatWidget";

export function TeacherLayout() {
  const { teacher, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">TM</div>
          <div className="brandText">
            <div className="brandTitle">University Portal</div>
            <div className="brandSub">Teacher Module</div>
          </div>
        </div>

        <div className="userCard">
          <div className="userName">{teacher?.full_name || "Teacher"}</div>
          <div className="userMeta">{teacher?.email || "Faculty Member"}</div>
        </div>

        <nav className="nav">
          <NavLink to="/teacher" end className="navItem">Dashboard</NavLink>
          <NavLink to="/teacher/students" className="navItem">Students</NavLink>
          <NavLink to="/teacher/courses" className="navItem">Courses</NavLink>
          <NavLink to="/teacher/registrations" className="navItem">Registrations</NavLink>
          <NavLink to="/teacher/marks" className="navItem">Marks Upload</NavLink>
          <NavLink to="/teacher/attendance" className="navItem">Attendance Upload</NavLink>
          <NavLink to="/teacher/feedback" className="navItem">Feedback</NavLink>
        </nav>

        <div className="sidebarFooter">
          <button
            type="button"
            className="btn btnGhost btnBlock"
            onClick={() => {
              logout();
              nav("/teacher/login", { replace: true });
            }}
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
      <ChatWidget />
    </div>
  );
}

