import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ChatWidget } from "../components/ChatWidget";

const navItems = [
  { to: "/app", label: "Dashboard" },
  { to: "/app/profile", label: "Profile" },
  { to: "/app/registration", label: "Course Registration" },
  { to: "/app/attendance", label: "Attendance" },
  { to: "/app/marks", label: "Marks" },
  { to: "/app/transcript", label: "Transcript" },
  { to: "/app/feedback", label: "Course Feedback" },
];

export function StudentLayout() {
  const { student, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">UP</div>
          <div className="brandText">
            <div className="brandTitle">University Portal</div>
            <div className="brandSub">Student</div>
          </div>
        </div>

        <div className="userCard">
          <div className="userName">{student?.full_name || "Student"}</div>
          <div className="userMeta">{student?.roll_no || ""}</div>
        </div>

        <nav className="nav">
          {navItems.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.to === "/app"} className="navItem">
              {it.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebarFooter">
          <button
            className="btn btnGhost btnBlock"
            onClick={() => {
              logout();
              navigate("/login");
            }}
            type="button"
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

