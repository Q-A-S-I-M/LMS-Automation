import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function TeacherStudents() {
  const [students, setStudents] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      setError("");
      try {
        const res = await api.teacherStudents();
        if (!alive) return;
        setStudents(res.students || []);
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load students");
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
          <div className="pageTitle">Students</div>
          <div className="pageSub">All registered students</div>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="panel">
        <div className="panelTitle">Student list</div>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Roll No</th>
                <th>Name</th>
                <th>Email</th>
                <th>Degree</th>
                <th>Section</th>
                <th>Batch</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.roll_no}>
                  <td className="mono">{s.roll_no}</td>
                  <td>{s.full_name}</td>
                  <td className="mono">{s.email}</td>
                  <td>{s.degree}</td>
                  <td className="mono">{s.section}</td>
                  <td className="mono">{s.batch}</td>
                  <td className="mono">{s.status}</td>
                </tr>
              ))}
              {students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    No students found.
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

