import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function TeacherAttendance() {
  const [semester, setSemester] = useState("Spring-2026");
  const [course, setCourse] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [lectureNo, setLectureNo] = useState(1);
  const [date, setDate] = useState("");
  const [durationHours, setDurationHours] = useState(1);
  const [presence, setPresence] = useState("P");
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

  async function submit(e) {
    e.preventDefault();
    setError("");
    setStatus("");
    try {
      const res = await api.teacherAttendanceUpsert({
        roll_no: rollNo,
        course_code: course,
        semester,
        lectures: [
          {
            lecture_no: Number(lectureNo),
            date,
            duration_hours: Number(durationHours),
            presence,
          },
        ],
      });
      setStatus(`Attendance upserted (${res.upserted}).`);
    } catch (e2) {
      setError(e2.message || "Failed to upload attendance");
    }
  }

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <div className="pageTitle">Attendance Upload</div>
          <div className="pageSub">Upsert lecture attendance for enrolled students.</div>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {status ? <div className="success">{status}</div> : null}

      <div className="panel">
        <div className="panelTitle">Attendance Form</div>
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
            <div className="panelTitle">Lecture Details</div>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1.5fr 1fr 1.5fr", margin: 0 }}>
              <label className="field">
                <span>Lecture #</span>
                <input className="input" type="number" min={1} value={lectureNo} onChange={(e) => setLectureNo(e.target.value)} />
              </label>
              <label className="field">
                <span>Date</span>
                <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="field">
                <span>Duration (Hrs)</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Status</span>
                <select className="select" value={presence} onChange={(e) => setPresence(e.target.value)}>
                  <option value="P">Present</option>
                  <option value="A">Absent</option>
                </select>
              </label>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button className="btn" type="submit" disabled={!semester || !course || !rollNo || !date} style={{ minWidth: 160, maxWidth: "100%" }}>
              Record Attendance
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

