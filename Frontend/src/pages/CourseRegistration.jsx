import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

function SemesterPicker({ semester, setSemester }) {
  return (
    <input
      className="select"
      value={semester}
      onChange={(e) => setSemester(e.target.value)}
      placeholder="e.g. Spring-2026"
    />
  );
}

export default function CourseRegistration() {
  const [semester, setSemester] = useState("Spring-2026");
  const [available, setAvailable] = useState([]);
  const [my, setMy] = useState([]);
  const [summary, setSummary] = useState({ total_credit_hours: 0, max_credit_hours: 18 });
  const [finalized, setFinalized] = useState(false);
  const [finalizedAt, setFinalizedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const remaining = useMemo(
    () => Math.max(0, Number(summary.max_credit_hours) - Number(summary.total_credit_hours)),
    [summary],
  );

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [a, m] = await Promise.all([api.registrationAvailable(semester), api.registrationMy(semester)]);
      setAvailable(a.courses || []);
      setMy(m.registrations || []);
      setSummary({ total_credit_hours: m.total_credit_hours, max_credit_hours: m.max_credit_hours });
      setFinalized(Boolean(m.finalized));
      setFinalizedAt(m.finalized_at || null);
    } catch (e) {
      setError(e.message || "Failed to load registration data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semester]);

  async function registerCourse(course_code) {
    setError("");
    try {
      await api.registrationRegister({ course_code, semester });
      await refresh();
    } catch (e) {
      setError(e.message || "Failed to register");
    }
  }

  async function unregisterCourse(course_code) {
    setError("");
    try {
      await api.registrationUnregister({ course_code, semester });
      await refresh();
    } catch (e) {
      setError(e.message || "Failed to unregister");
    }
  }

  async function finalizeRegistration() {
    setError("");
    try {
      await api.registrationLock({ semester });
      await refresh();
    } catch (e) {
      setError(e.message || "Failed to finalize registration");
    }
  }

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <div className="pageTitle">Course Registration</div>
          <div className="pageSub">Register courses (max 18 credit hours per semester)</div>
        </div>
        <div className="row">
          <SemesterPicker semester={semester} setSemester={setSemester} />
          <button className="btn" type="button" onClick={finalizeRegistration} disabled={finalized || my.length === 0}>
            {finalized ? "Finalized" : "Finalize Registration"}
          </button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {finalized ? (
        <div className="panel" style={{ color: "rgba(229,231,235,0.85)" }}>
          Registration is locked for this semester{finalizedAt ? ` (finalized at ${new Date(finalizedAt).toLocaleString()})` : ""}.
          Courses can no longer be added or dropped.
        </div>
      ) : null}

      <div className="grid">
        <div className="card">
          <div className="cardTitle">Semester</div>
          <div className="cardValue">{semester}</div>
        </div>
        <div className="card">
          <div className="cardTitle">Registered CH</div>
          <div className="cardValue">{summary.total_credit_hours}</div>
          <div className="cardSub">Max {summary.max_credit_hours}</div>
        </div>
        <div className="card">
          <div className="cardTitle">Remaining CH</div>
          <div className="cardValue">{remaining}</div>
        </div>
        <div className="card">
          <div className="cardTitle">Registered courses</div>
          <div className="cardValue">{my.length}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panelTitle">My registered courses</div>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Name</th>
                <th>CH</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {my.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.course_code}</td>
                  <td>{r.course_name}</td>
                  <td>{r.credit_hours}</td>
                  <td>
                    <span className="mono">{r.status}</span>
                    {r.status === "Enrolled" ? (
                      <span className="muted" style={{ marginLeft: 8 }}>
                        Locked
                      </span>
                    ) : null}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btnGhost"
                      type="button"
                      onClick={() => unregisterCourse(r.course_code)}
                      disabled={finalized || r.status === "Enrolled"}
                      title={finalized || r.status === "Enrolled" ? "Locked courses cannot be dropped" : "Unregister course"}
                    >
                      {r.status === "Enrolled" || finalized ? "Locked" : "Unregister"}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && my.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No courses registered for this semester.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panelTitle">Available courses</div>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Name</th>
                <th>CH</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {available.map((c) => (
                <tr key={c.course_code}>
                  <td className="mono">{c.course_code}</td>
                  <td>{c.course_name}</td>
                  <td>{c.credit_hours}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn" type="button" onClick={() => registerCourse(c.course_code)} disabled={finalized}>
                      Register
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && available.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No available courses (or you registered all).
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

