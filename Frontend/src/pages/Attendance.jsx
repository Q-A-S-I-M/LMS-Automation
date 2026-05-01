import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

function ProgressBar({ value }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="bar">
      <div className="barFill" style={{ width: `${v}%` }} />
      <div className="barText">{v}%</div>
    </div>
  );
}

export default function Attendance() {
  const [courses, setCourses] = useState([]);
  const [selection, setSelection] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { courseId, semester } = useMemo(() => {
    const [c, s] = String(selection || "").split("|");
    return { courseId: c || "", semester: s || "" };
  }, [selection]);

  const selected = useMemo(
    () => courses.find((c) => c.course_code === courseId && c.semester === semester),
    [courses, courseId, semester],
  );

  useEffect(() => {
    let alive = true;
    async function loadCourses() {
      setLoading(true);
      setError("");
      try {
        const res = await api.courses();
        if (!alive) return;
        setCourses(res.courses || []);
        // No auto-selection to allow placeholder to show
        setSelection("");
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load courses");
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadCourses();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadAttendance() {
      if (!courseId || !semester) return;
      setError("");
      try {
        const res = await api.attendance(courseId, semester);
        if (!alive) return;
        setData(res);
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load attendance");
      }
    }
    loadAttendance();
    return () => {
      alive = false;
    };
  }, [courseId, semester]);

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <div className="pageTitle">Attendance</div>
          <div className="pageSub">Lecture-by-lecture presence and percentage</div>
        </div>

        <div className="row">
          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <span style={{ whiteSpace: "nowrap" }}>Select Course:</span>
            <select
              className="select"
              value={selection}
              onChange={(e) => setSelection(e.target.value)}
              disabled={loading || courses.length === 0}
            >
              <option value="">Choose a course...</option>
              {courses.map((c) => (
                <option key={`${c.course_code}-${c.semester}`} value={`${c.course_code}|${c.semester}`}>
                  {c.semester} — {c.course_code} — {c.course_name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {selected && data?.summary ? (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <div className="card" style={{ borderLeft: "4px solid #60a5fa" }}>
            <div className="cardTitle">Active Course</div>
            <div className="cardValue mono">{selected.course_code}</div>
            <div className="cardSub">{selected.course_name}</div>
          </div>
          <div className="card" style={{ borderLeft: "4px solid #34d399" }}>
            <div className="cardTitle">Total Presence</div>
            <div className="cardValue">{data.summary.present} / {data.summary.total_lectures}</div>
            <div className="cardSub">Lectures Attended</div>
          </div>
          <div className="card" style={{ borderLeft: "4px solid #fbbf24" }}>
            <div className="cardTitle">Attendance %</div>
            <div className="cardValue">
              <ProgressBar value={data.summary.percentage} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="panel">
        <div className="panelTitle">Lectures</div>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.lectures || []).map((l) => (
                <tr key={`${l.date}-${l.lecture_no}`}>
                  <td>{l.lecture_no}</td>
                  <td>{String(l.date).slice(0, 10)}</td>
                  <td>{l.duration_hours}</td>
                  <td>
                    <span className={l.presence === "P" ? "pill pillGreen" : "pill pillRed"}>
                      {l.presence === "P" ? "Present" : "Absent"}
                    </span>
                  </td>
                </tr>
              ))}
              {data && (data.lectures || []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No attendance data yet for this course.
                  </td>
                </tr>
              ) : null}
              {!data && !error ? (
                <tr>
                  <td colSpan={4} className="muted">
                    Select a course to view attendance.
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

