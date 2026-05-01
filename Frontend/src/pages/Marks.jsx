import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

const categories = ["Assignment", "Quiz", "Sessional-I", "Sessional-II", "Final"];

export default function Marks() {
  const [courses, setCourses] = useState([]);
  const [selection, setSelection] = useState("");
  const [activeTab, setActiveTab] = useState("Assignment");
  const [data, setData] = useState(null);
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
    async function load() {
      try {
        const res = await api.courses();
        if (!alive) return;
        setCourses(res.courses || []);
        // No auto-selection to allow placeholder to show
        setSelection("");
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load courses");
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadMarks() {
      if (!courseId || !semester) return;
      setError("");
      try {
        const res = await api.marks(courseId, semester);
        if (!alive) return;
        setData(res);
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load marks");
      }
    }
    loadMarks();
    return () => {
      alive = false;
    };
  }, [courseId, semester]);

  const items = data?.marks?.[activeTab] || [];

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <div className="pageTitle">Marks & Grades</div>
          <div className="pageSub">Detailed evaluation breakdown for enrolled courses</div>
        </div>

        <div className="row">
          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <span style={{ whiteSpace: "nowrap" }}>Select Course:</span>
            <select className="select" value={selection} onChange={(e) => setSelection(e.target.value)}>
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

      {selected ? (
        <div className="profile-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div className="panel">
              <div className="panelTitle">Course Summary</div>
              <div className="kvGrid">
                <div className="kv">
                  <div className="kvLabel">Code</div>
                  <div className="kvValue mono">{selected.course_code}</div>
                </div>
                <div className="kv">
                  <div className="kvLabel">Credit Hours</div>
                  <div className="kvValue">{selected.credit_hours}</div>
                </div>
              </div>
              <div className="kvLabel" style={{ marginTop: 16 }}>Full Name</div>
              <div className="kvValue" style={{ fontWeight: 600 }}>{selected.course_name}</div>
            </div>

            {data?.grand_total && (
              <div className="panel" style={{ borderLeft: "4px solid #34d399" }}>
                <div className="panelTitle">Final Result</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div className="cardValue" style={{ fontSize: 32 }}>{data.grand_total.total} / 100</div>
                    <div className="muted">{data.grand_total.complete ? "Grading Finalized" : "Partial Calculation"}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="cardValue" style={{ fontSize: 32, color: "#60a5fa" }}>{data.transcript?.grade || "-"}</div>
                    <div className="muted">Letter Grade</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panelTitleRow">
              <div className="panelTitle">Evaluation Breakdown</div>
              <div className="pill">{activeTab}</div>
            </div>
            
            <div className="tabs">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={c === activeTab ? "tab tabActive" : "tab"}
                  onClick={() => setActiveTab(c)}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Component #</th>
                    <th>Obtained</th>
                    <th>Total</th>
                    <th>Weightage %</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => (
                    <tr key={`${m.category}-${m.item_no}`}>
                      <td className="mono">{m.item_no}</td>
                      <td style={{ fontWeight: 600 }}>{m.obtained_marks}</td>
                      <td className="mono">{m.total_marks}</td>
                      <td>{m.weightage}</td>
                    </tr>
                  ))}
                  {data && items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted" style={{ textAlign: "center", padding: "40px 0" }}>
                        No evaluation data available for {activeTab} yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="hint" style={{ marginTop: 20 }}>
              Note: Component weightage is pre-calculated according to department policy.
            </div>
          </div>
        </div>
      ) : (
        <div className="panel" style={{ textAlign: "center", padding: "60px 0" }}>
          <div className="muted">Select a course from the dropdown to view evaluation results.</div>
        </div>
      )}
    </div>
  );
}

