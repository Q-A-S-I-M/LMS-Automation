import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function TeacherFeedback() {
  const [semester, setSemester] = useState("Spring-2026");
  const [course, setCourse] = useState("");
  const [courses, setCourses] = useState([]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [reply, setReply] = useState({});

  async function refresh() {
    setError("");
    setStatus("");
    const [c, f] = await Promise.all([api.teacherCourses(), api.teacherFeedback(semester, course || undefined)]);
    setCourses(c.courses || []);
    setRows(f.feedback || []);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refresh();
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load feedback");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semester, course]);

  async function respond(id) {
    setError("");
    setStatus("");
    try {
      await api.teacherFeedbackRespond(id, { teacher_response: reply[id] || "" });
      setStatus("Response saved.");
      await refresh();
    } catch (e) {
      setError(e.message || "Failed to save response");
    }
  }

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <div className="pageTitle">Feedback</div>
          <div className="pageSub">View student feedback and optionally respond.</div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <input className="select" value={semester} onChange={(e) => setSemester(e.target.value)} placeholder="e.g. Spring-2026" />
          <select className="select" value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c.course_code} value={c.course_code}>
                {c.course_code} — {c.course_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {status ? <div className="success">{status}</div> : null}

      <div className="panel">
        <div className="panelTitle">Feedback list</div>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Student</th>
                <th>Rating</th>
                <th>Comment</th>
                <th>Response</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.course_code}</td>
                  <td>
                    {r.full_name} <span className="mono">({r.roll_no})</span>
                  </td>
                  <td className="mono">{r.rating}</td>
                  <td style={{ maxWidth: 360 }}>{r.comment || "-"}</td>
                  <td style={{ minWidth: 320 }}>
                    <textarea
                      rows={3}
                      value={reply[r.id] ?? r.teacher_response ?? ""}
                      onChange={(e) => setReply((p) => ({ ...p, [r.id]: e.target.value }))}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(0,0,0,0.18)",
                        color: "#e5e7eb",
                        resize: "vertical",
                      }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                      <button className="btn btnGhost" type="button" onClick={() => respond(r.id)}>
                        Save
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No feedback found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

