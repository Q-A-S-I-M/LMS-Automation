import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function TeacherCourses() {
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ course_code: "", course_name: "", credit_hours: 3 });

  async function refresh() {
    setError("");
    const res = await api.teacherCourses();
    setCourses(res.courses || []);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refresh();
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load courses");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(e) {
    e.preventDefault();
    setError("");
    try {
      await api.teacherCourseCreate({
        course_code: form.course_code,
        course_name: form.course_name,
        credit_hours: Number(form.credit_hours),
      });
      setForm({ course_code: "", course_name: "", credit_hours: 3 });
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to create course");
    }
  }

  async function remove(course_code) {
    setError("");
    try {
      await api.teacherCourseDelete(course_code);
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to delete course");
    }
  }

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <div className="pageTitle">Courses</div>
          <div className="pageSub">Manage the course catalog</div>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="panel">
        <div className="panelTitle">Create course</div>
        <form onSubmit={create} className="form" style={{ gridTemplateColumns: "1fr 2fr 1fr auto" }}>
          <label className="field">
            <span>Code</span>
            <input className="input" value={form.course_code} onChange={(e) => setForm((p) => ({ ...p, course_code: e.target.value }))} />
          </label>
          <label className="field">
            <span>Name</span>
            <input className="input" value={form.course_name} onChange={(e) => setForm((p) => ({ ...p, course_name: e.target.value }))} />
          </label>
          <label className="field">
            <span>CH</span>
            <input
              className="input"
              type="number"
              min={1}
              value={form.credit_hours}
              onChange={(e) => setForm((p) => ({ ...p, credit_hours: e.target.value }))}
            />
          </label>
          <button className="btn" type="submit" disabled={!form.course_code || !form.course_name}>
            Create
          </button>
        </form>
      </div>

      <div className="panel">
        <div className="panelTitle">All courses</div>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>CH</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.course_code}>
                  <td className="mono">{c.course_code}</td>
                  <td>{c.course_name}</td>
                  <td className="mono">{c.credit_hours}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btnGhost" type="button" onClick={() => remove(c.course_code)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {courses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No courses yet.
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

