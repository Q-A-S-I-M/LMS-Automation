import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function Item({ to, children }) {
  return (
    <NavLink to={to} className={({ isActive }) => (isActive ? "navItem navItemActive" : "navItem")}>
      {children}
    </NavLink>
  );
}

export function TeacherLayout() {
  const { logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandTitle">University Portal</div>
          <div className="brandSub">Teacher Module</div>
        </div>

        <div className="nav">
          <Item to="/teacher">Dashboard</Item>
          <Item to="/teacher/students">Students</Item>
          <Item to="/teacher/courses">Courses</Item>
          <Item to="/teacher/registrations">Registrations</Item>
          <Item to="/teacher/marks">Marks Upload</Item>
          <Item to="/teacher/attendance">Attendance Upload</Item>
          <Item to="/teacher/feedback">Feedback</Item>
        </div>

        <div className="sidebarFooter">
          <button
            type="button"
            className="btn btnGhost"
            onClick={() => {
              logout();
              nav("/teacher/login", { replace: true });
            }}
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

