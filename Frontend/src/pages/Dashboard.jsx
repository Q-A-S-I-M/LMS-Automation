import { useEffect, useState } from "react";
import { api } from "../api/client";

function StatCard({ title, value, sub }) {
  return (
    <div className="card">
      <div className="cardTitle">{title}</div>
      <div className="cardValue">{value}</div>
      {sub ? <div className="cardSub">{sub}</div> : null}
    </div>
  );
}

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [p, c] = await Promise.all([api.profile(), api.courses()]);
        if (!alive) return;
        setProfile(p.profile);
        setCourses(c.courses || []);
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load dashboard");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <div className="pageTitle">Welcome, {profile?.full_name || "Student"}</div>
          <div className="pageSub">Academic summary and recent enrollments</div>
        </div>
      </div>

      {loading ? <div className="muted">Loading dashboard...</div> : null}
      {error ? <div className="error">{error}</div> : null}

      {!loading && !error ? (
        <>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <div className="card" style={{ borderLeft: "4px solid #60a5fa" }}>
              <div className="cardTitle">Registration</div>
              <div className="cardValue">{profile?.roll_no || "-"}</div>
              <div className="cardSub">{profile?.degree || "-"}</div>
            </div>
            <div className="card" style={{ borderLeft: "4px solid #a78bfa" }}>
              <div className="cardTitle">Current Program</div>
              <div className="cardValue">{profile?.batch || "-"}</div>
              <div className="cardSub">Section {profile?.section || "-"}</div>
            </div>
            <div className="card" style={{ borderLeft: "4px solid #34d399" }}>
              <div className="cardTitle">Enrollments</div>
              <div className="cardValue">{courses.length}</div>
              <div className="cardSub">Active Courses</div>
            </div>
            <div className="card" style={{ borderLeft: "4px solid #fbbf24" }}>
              <div className="cardTitle">Campus Status</div>
              <div className="cardValue">{profile?.status || "-"}</div>
              <div className="cardSub">{profile?.campus || "-"}</div>
            </div>
          </div>

          <div className="panel">
            <div className="panelTitleRow">
              <div className="panelTitle">Course List</div>
              <div className="pill">{courses.length} Total</div>
            </div>
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Course Name</th>
                    <th>CH</th>
                    <th>Semester</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c) => (
                    <tr key={`${c.course_code}-${c.semester}`}>
                      <td className="mono">{c.course_code}</td>
                      <td style={{ fontWeight: 500 }}>{c.course_name}</td>
                      <td className="mono">{c.credit_hours}</td>
                      <td className="mono">{c.semester}</td>
                    </tr>
                  ))}
                  {courses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted">
                        No enrollment data yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

