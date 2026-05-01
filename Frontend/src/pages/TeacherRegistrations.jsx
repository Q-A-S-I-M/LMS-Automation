import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function TeacherRegistrations() {
  const [semester, setSemester] = useState("Spring-2026");
  const [course, setCourse] = useState("");
  const [courses, setCourses] = useState([]);
  const [regs, setRegs] = useState([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState([]);

  async function refresh() {
    setError("");
    setStatus("");
    const [c, r] = await Promise.all([api.teacherCourses(), api.teacherRegistrations(semester, course || undefined)]);
    setCourses(c.courses || []);
    setRegs(r.registrations || []);
    setSelected([]);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refresh();
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load registrations");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semester, course]);

  async function enrollAll() {
    setError("");
    setStatus("");
    if (!course) {
      setError("Select a course to enroll.");
      return;
    }
    try {
      const res = await api.teacherEnroll({ semester, course_code: course });
      setStatus(`Enrolled ${res.enrolled_count} student(s).`);
      await refresh();
    } catch (e) {
      setError(e.message || "Failed to enroll");
    }
  }

  function toggleOne(rollNo) {
    setSelected((prev) => (prev.includes(rollNo) ? prev.filter((r) => r !== rollNo) : [...prev, rollNo]));
  }

  function toggleAllRegistered() {
    const registeredRolls = regs.filter((r) => r.status === "Registered").map((r) => r.roll_no);
    const allSelected = registeredRolls.length > 0 && registeredRolls.every((r) => selected.includes(r));
    setSelected(allSelected ? [] : registeredRolls);
  }

  async function decide(action, roll_nos) {
    setError("");
    setStatus("");
    if (!course) {
      setError("Select a course first.");
      return;
    }
    if (!roll_nos.length) {
      setError("Select at least one registered student.");
      return;
    }
    try {
      const res = await api.teacherRegistrationDecision({ semester, course_code: course, action, roll_nos });
      setStatus(`${action === "approve" ? "Approved/Enrolled" : "Rejected"} ${res.processed_count} student(s).`);
      await refresh();
    } catch (e) {
      setError(e.message || "Failed to process decision");
    }
  }

  const registeredRows = regs.filter((r) => r.status === "Registered");

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <div className="pageTitle">Registrations</div>
          <div className="pageSub">View course registrations and enroll students</div>
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
          <button className="btn" type="button" onClick={enrollAll} disabled={!course}>
            Enroll registered
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => decide("approve", selected)}
            disabled={!course || selected.length === 0}
          >
            Approve selected
          </button>
          <button
            className="btn btnDanger"
            type="button"
            onClick={() => decide("reject", selected)}
            disabled={!course || selected.length === 0}
          >
            Reject selected
          </button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {status ? <div className="success">{status}</div> : null}

      <div className="panel">
        <div className="panelTitle">Registrations</div>
        <div className="row" style={{ marginBottom: 10, gap: 8 }}>
          <button
            className="btn btnGhost"
            type="button"
            onClick={toggleAllRegistered}
            disabled={registeredRows.length === 0}
          >
            {registeredRows.length > 0 && registeredRows.every((r) => selected.includes(r.roll_no))
              ? "Unselect all registered"
              : "Select all registered"}
          </button>
          <span className="muted">{selected.length} selected</span>
        </div>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th />
                <th>Course</th>
                <th>Student</th>
                <th>Roll No</th>
                <th>Semester</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {regs.map((r) => (
                <tr key={r.id}>
                  <td style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={selected.includes(r.roll_no)}
                      onChange={() => toggleOne(r.roll_no)}
                      disabled={r.status !== "Registered"}
                    />
                  </td>
                  <td className="mono">{r.course_code}</td>
                  <td>{r.full_name}</td>
                  <td className="mono">{r.roll_no}</td>
                  <td className="mono">{r.semester}</td>
                  <td className="mono">{r.status}</td>
                  <td style={{ textAlign: "right", minWidth: 220 }}>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => decide("approve", [r.roll_no])}
                      disabled={r.status !== "Registered" || !course || r.course_code !== course}
                    >
                      Enroll
                    </button>{" "}
                    <button
                      className="btn btnDanger"
                      type="button"
                      onClick={() => decide("reject", [r.roll_no])}
                      disabled={r.status !== "Registered" || !course || r.course_code !== course}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
              {regs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    No registrations found.
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

