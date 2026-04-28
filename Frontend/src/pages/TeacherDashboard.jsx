import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function TeacherDashboard() {
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
          <div className="pageTitle">Teacher Dashboard</div>
          <div className="pageSub">Statistics and quick actions</div>
        </div>
        <div className="row">
          <input className="select" value={semester} onChange={(e) => setSemester(e.target.value)} placeholder="e.g. Spring-2026" />
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="grid">
        <div className="card">
          <div className="cardTitle">Students</div>
          <div className="cardValue">{stats?.counts?.students ?? "-"}</div>
          <div className="cardSub">Registered</div>
        </div>
        <div className="card">
          <div className="cardTitle">Courses</div>
          <div className="cardValue">{stats?.counts?.courses ?? "-"}</div>
          <div className="cardSub">Catalog</div>
        </div>
        <div className="card">
          <div className="cardTitle">Registrations</div>
          <div className="cardValue">{(stats?.registrations?.registered ?? 0) + (stats?.registrations?.enrolled ?? 0)}</div>
          <div className="cardSub">
            Registered {stats?.registrations?.registered ?? "-"} · Enrolled {stats?.registrations?.enrolled ?? "-"}
          </div>
        </div>
        <div className="card">
          <div className="cardTitle">Marks completion</div>
          <div className="cardValue">{pct}%</div>
          <div className="cardSub">
            {stats?.marks_completion?.complete ?? "-"} / {stats?.marks_completion?.total ?? "-"} enrollments graded
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panelTitle">Feedback (semester)</div>
        <div className="muted">
          Count: <span className="mono">{stats?.feedback?.count ?? "-"}</span> · Avg rating:{" "}
          <span className="mono">{stats?.feedback?.avg_rating ?? "-"}</span>
        </div>
      </div>
    </div>
  );
}

