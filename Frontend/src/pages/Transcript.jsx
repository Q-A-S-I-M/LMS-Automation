import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function Transcript() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await api.transcript();
        if (!alive) return;
        setData(res);
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load transcript");
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
          <div className="pageTitle">Transcript</div>
          <div className="pageSub">Semester-wise SGPA and overall CGPA</div>
        </div>
        <div className="chip">
          CGPA <span className="chipValue">{data?.cgpa ?? "-"}</span>
        </div>
      </div>

      {loading ? <div className="muted">Loading...</div> : null}
      {error ? <div className="error">{error}</div> : null}

      {(data?.semesters || []).map((s) => (
        <div key={s.semester} className="panel">
          <div className="panelTitleRow">
            <div className="panelTitle">{s.semester}</div>
            <div className="chip">
              SGPA <span className="chipValue">{s.sgpa}</span>
            </div>
          </div>

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Name</th>
                  <th>CH</th>
                  <th>Grade</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {s.courses.map((c) => (
                  <tr key={`${s.semester}-${c.course_code}`}>
                    <td className="mono">{c.course_code}</td>
                    <td>{c.course_name}</td>
                    <td>{c.credit_hours}</td>
                    <td className="mono">{c.grade ?? "-"}</td>
                    <td className="mono">{c.points ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="muted" style={{ marginTop: 10 }}>
            Note: grades appear after the teacher uploads all components (Quiz 10, Assignment 10, Sessional-I 15, Sessional-II
            15, Final 50) for the course.
          </div>
        </div>
      ))}

      {!loading && !error && (data?.semesters || []).length === 0 ? (
        <div className="panel">
          <div className="panelTitle">No transcript data yet</div>
          <div className="muted">Once enrollments are inserted, the transcript will appear here.</div>
        </div>
      ) : null}
    </div>
  );
}

