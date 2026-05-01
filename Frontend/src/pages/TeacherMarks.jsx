import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

const COMPONENTS = [
  { key: "Quiz", label: "Quizzes (10)" },
  { key: "Assignment", label: "Assignments (10)" },
  { key: "Sessional-I", label: "Sessional-I (15)" },
  { key: "Sessional-II", label: "Sessional-II (15)" },
  { key: "Final", label: "Final (50)" },
];

export default function TeacherMarks() {
  const [semester, setSemester] = useState("Spring-2026");
  const [course, setCourse] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [components, setComponents] = useState(() =>
    Object.fromEntries(COMPONENTS.map((c) => [c.key, { obtained: "", total: "" }])),
  );
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, s] = await Promise.all([api.teacherCourses(), api.teacherStudents()]);
        if (!alive) return;
        setCourses(c.courses || []);
        setStudents(s.students || []);
        setCourse(c.courses?.[0]?.course_code || "");
        setRollNo(s.students?.[0]?.roll_no || "");
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load data");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const payloadComponents = useMemo(() => {
    const out = {};
    for (const c of COMPONENTS) {
      const ob = components[c.key]?.obtained;
      const tot = components[c.key]?.total;
      if (ob === "" || tot === "") continue;
      out[c.key] = { obtained: Number(ob), total: Number(tot) };
    }
    return out;
  }, [components]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setStatus("");
    try {
      const res = await api.teacherMarksUpsert({
        roll_no: rollNo,
        course_code: course,
        semester,
        components: payloadComponents,
      });
      setStatus(
        res.grand_total?.complete
          ? `Uploaded. Grand total: ${res.grand_total.total}/100. Grade: ${res.transcript?.grade || "-"}`
          : `Uploaded. Grand total so far: ${res.grand_total?.total ?? "-"}/100.`,
      );
    } catch (e2) {
      setError(e2.message || "Failed to upload marks");
    }
  }

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <div className="pageTitle">Marks Upload</div>
          <div className="pageSub">Upload marks; system calculates grand total and final grade once complete.</div>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {status ? <div className="success">{status}</div> : null}

      <div className="panel">
        <div className="panelTitle">Evaluation Form</div>
        <form onSubmit={submit} className="form">
          <div className="grid" style={{ gridTemplateColumns: "1fr 2fr 2fr", margin: 0 }}>
            <label className="field">
              <span>Semester</span>
              <input className="input" value={semester} onChange={(e) => setSemester(e.target.value)} />
            </label>
            <label className="field">
              <span>Course</span>
              <select className="select" value={course} onChange={(e) => setCourse(e.target.value)}>
                {courses.map((c) => (
                  <option key={c.course_code} value={c.course_code}>
                    {c.course_code} — {c.course_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Student</span>
              <select className="select" value={rollNo} onChange={(e) => setRollNo(e.target.value)}>
                {students.map((s) => (
                  <option key={s.roll_no} value={s.roll_no}>
                    {s.roll_no} — {s.full_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="panel" style={{ background: "rgba(255,255,255,0.02)", marginTop: 16 }}>
            <div className="panelTitle">Marks Breakdown</div>
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Component Name</th>
                    <th style={{ width: 150 }}>Obtained</th>
                    <th style={{ width: 150 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPONENTS.map((c) => (
                    <tr key={c.key}>
                      <td style={{ fontWeight: 500 }}>{c.label}</td>
                      <td>
                        <input
                          className="input"
                          type="number"
                          style={{ width: "100%" }}
                          placeholder="0"
                          value={components[c.key]?.obtained}
                          onChange={(e) =>
                            setComponents((p) => ({ ...p, [c.key]: { ...p[c.key], obtained: e.target.value } }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          type="number"
                          style={{ width: "100%" }}
                          placeholder="0"
                          value={components[c.key]?.total}
                          onChange={(e) =>
                            setComponents((p) => ({ ...p, [c.key]: { ...p[c.key], total: e.target.value } }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="hint">
              Tip: Grades are finalized once all 5 components are submitted. You can update them anytime.
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button className="btn" type="submit" disabled={!semester || !course || !rollNo} style={{ minWidth: 160, maxWidth: "100%" }}>
              Save Evaluation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

