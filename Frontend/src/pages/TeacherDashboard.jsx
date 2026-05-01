import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export default function TeacherDashboard() {
  const { teacher } = useAuth();
  const [semester, setSemester] = useState("Spring-2026");
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setError("");
      try {
        const res = await api.teacherStats(semester);
        if (!alive) return;
        setStats(res);
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load stats");
      }
    })();
    return () => {
      alive = false;
    };
  }, [semester]);

  const pct =
    stats?.marks_completion?.total ? Math.round((stats.marks_completion.complete / stats.marks_completion.total) * 100) : 0;

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <div className="pageTitle">Welcome, {teacher?.full_name || "Teacher"}</div>
          <div className="pageSub">Academic overview for {semester}</div>
        </div>
        <div className="row">
          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <span style={{ whiteSpace: "nowrap" }}>Select Semester:</span>
            <input className="select" value={semester} onChange={(e) => setSemester(e.target.value)} placeholder="e.g. Spring-2026" />
          </label>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <div className="card" style={{ borderLeft: "4px solid #60a5fa" }}>
          <div className="cardTitle">Active Students</div>
          <div className="cardValue">{stats?.counts?.students ?? "-"}</div>
          <div className="cardSub">Across all courses</div>
        </div>
        <div className="card" style={{ borderLeft: "4px solid #a78bfa" }}>
          <div className="cardTitle">Course Catalog</div>
          <div className="cardValue">{stats?.counts?.courses ?? "-"}</div>
          <div className="cardSub">Department courses</div>
        </div>
        <div className="card" style={{ borderLeft: "4px solid #34d399" }}>
          <div className="cardTitle">Total Enrollments</div>
          <div className="cardValue">{(stats?.registrations?.registered ?? 0) + (stats?.registrations?.enrolled ?? 0)}</div>
          <div className="cardSub">
            {stats?.registrations?.enrolled ?? "0"} Enrolled · {stats?.registrations?.registered ?? "0"} Pending
          </div>
        </div>
        <div className="card" style={{ borderLeft: "4px solid #fbbf24" }}>
          <div className="cardTitle">Grading Progress</div>
          <div className="cardValue">{pct}%</div>
          <div className="cardSub">
            {stats?.marks_completion?.complete ?? "0"} / {stats?.marks_completion?.total ?? "0"} graded
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
        <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
          <div className="panelTitleRow">
            <div className="panelTitle">Student Feedback</div>
            <div className="pill pillGreen">{stats?.feedback?.avg_rating ?? "-"} / 5.0</div>
          </div>
          <div className="muted" style={{ marginBottom: 16, flex: 1 }}>
            Based on {stats?.feedback?.count ?? "0"} student reviews this semester.
          </div>
          <Link to="/teacher/feedback" className="btn btnGhost btnBlock">
            Read Reviews
          </Link>
        </div>

        <div className="panel">
          <div className="panelTitle">Evaluations</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link to="/teacher/marks" className="btn btnBlock">Upload Marks</Link>
            <Link to="/teacher/attendance" className="btn btnGhost btnBlock">Record Attendance</Link>
          </div>
        </div>

        <div className="panel">
          <div className="panelTitle">Management</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link to="/teacher/courses" className="btn btnBlock">Course Catalog</Link>
            <Link to="/teacher/registrations" className="btn btnGhost btnBlock">Registrations</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

