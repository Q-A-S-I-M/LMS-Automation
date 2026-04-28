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
          <div className="pageTitle">Dashboard</div>
          <div className="pageSub">Quick view of your academic data</div>
        </div>
      </div>

      {loading ? <div className="muted">Loading...</div> : null}
      {error ? <div className="error">{error}</div> : null}

      {!loading && !error ? (
        <>
          <div className="grid">
            <StatCard title="Student" value={profile?.full_name || "-"} sub={profile?.roll_no} />
            <StatCard title="Degree" value={profile?.degree || "-"} sub={`Section ${profile?.section || "-"}`} />
            <StatCard title="Status" value={profile?.status || "-"} sub={profile?.campus || ""} />
            <StatCard title="Courses" value={courses.length} sub="Enrolled (all semesters)" />
          </div>

          <div className="panel">
            <div className="panelTitle">Recent enrollments</div>
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Name</th>
                    <th>CH</th>
                    <th>Semester</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.slice(0, 8).map((c) => (
                    <tr key={`${c.course_code}-${c.semester}`}>
                      <td className="mono">{c.course_code}</td>
                      <td>{c.course_name}</td>
                      <td>{c.credit_hours}</td>
                      <td>{c.semester}</td>
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

