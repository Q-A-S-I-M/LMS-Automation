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
        const first = res.courses?.[0];
        setSelection(first ? `${first.course_code}|${first.semester}` : "");
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
          <div className="pageTitle">Marks</div>
          <div className="pageSub">Categorized marks with weightage</div>
        </div>

        <div className="row">
          <select className="select" value={selection} onChange={(e) => setSelection(e.target.value)}>
            {courses.map((c) => (
              <option key={`${c.course_code}-${c.semester}`} value={`${c.course_code}|${c.semester}`}>
                {c.semester} — {c.course_code} — {c.course_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {selected ? (
        <div className="panel">
          <div className="panelTitle">
            <span className="mono">{selected.course_code}</span> — {selected.course_name}
          </div>

          {data?.grand_total ? (
            <div className="grid" style={{ marginTop: 12 }}>
              <div className="card">
                <div className="cardTitle">Grand Total</div>
                <div className="cardValue">{data.grand_total.total}/100</div>
                <div className="cardSub">{data.grand_total.complete ? "Complete" : "Pending components"}</div>
              </div>
              <div className="card">
                <div className="cardTitle">Grade</div>
                <div className="cardValue mono">{data.transcript?.grade ?? "-"}</div>
                <div className="cardSub">Shown when complete</div>
              </div>
            </div>
          ) : null}

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
                  <th>Item</th>
                  <th>Obtained</th>
                  <th>Total</th>
                  <th>Weightage</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={`${m.category}-${m.item_no}`}>
                    <td>{m.item_no}</td>
                    <td>{m.obtained_marks}</td>
                    <td>{m.total_marks}</td>
                    <td>{m.weightage}</td>
                  </tr>
                ))}
                {data && items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      No marks in this category yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

