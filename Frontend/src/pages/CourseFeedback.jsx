import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function CourseFeedback() {
  const [semester, setSemester] = useState("Spring-2026");
  const [courses, setCourses] = useState([]);
  const [selected, setSelected] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    setStatus("");
    try {
      const res = await api.feedbackMy(semester);
      setCourses(res.courses || []);
      const first = res.courses?.[0]?.course_code || "";
      setSelected((cur) => cur || first);
    } catch (e) {
      setError(e.message || "Failed to load courses");
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semester]);

  useEffect(() => {
    const c = courses.find((x) => x.course_code === selected);
    if (!c) return;
    setRating(c.rating || 5);
    setComment(c.comment || "");
  }, [selected, courses]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setStatus("");
    try {
      await api.feedbackSubmit({ course_code: selected, semester, rating, comment });
      setStatus("Feedback submitted.");
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to submit feedback");
    }
  }

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <div className="pageTitle">Course Feedback</div>
          <div className="pageSub">Submit feedback for your registered courses</div>
        </div>
        <div className="row">
          <input
            className="select"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            placeholder="e.g. Spring-2026"
          />
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {status ? (
        <div className="panel" style={{ color: "rgba(229,231,235,0.85)" }}>
          {status}
        </div>
      ) : null}

      <div className="panel">
        <div className="panelTitle">Feedback form</div>
        <form onSubmit={submit} className="form">
          <label className="field">
            <span>Course</span>
            <select className="select" value={selected} onChange={(e) => setSelected(e.target.value)}>
              {courses.map((c) => (
                <option key={c.course_code} value={c.course_code}>
                  {c.course_code} — {c.course_name}
                </option>
              ))}
            </select>
          </label>

          {courses.length === 0 ? (
            <div className="muted">No registered courses in this semester.</div>
          ) : null}

          <label className="field">
            <span>Rating (1-5)</span>
            <select className="select" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Comment</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(0,0,0,0.18)",
                color: "#e5e7eb",
                resize: "vertical",
              }}
            />
          </label>

          <button className="btn" type="submit" disabled={!selected}>
            Submit feedback
          </button>
        </form>
      </div>

      <div className="panel">
        <div className="panelTitle">My feedback (this semester)</div>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Name</th>
                <th>Rating</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.course_code}>
                  <td className="mono">{c.course_code}</td>
                  <td>{c.course_name}</td>
                  <td className="mono">{c.rating ?? "-"}</td>
                  <td className="mono">{c.updated_at ? String(c.updated_at).slice(0, 19).replace("T", " ") : "-"}</td>
                </tr>
              ))}
              {courses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No data.
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

