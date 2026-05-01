import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    roll_no: "",
    full_name: "",
    email: "",
    password: "",
    degree: "",
    section: "",
    batch: "",
    campus: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register({
        ...form,
        roll_no: form.roll_no.trim(),
        full_name: form.full_name.trim(),
        email: form.email.trim(),
      });
      navigate("/app");
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="authWrap">
      <div className="authCard" style={{ width: "min(640px, 100%)" }}>
        <div className="authHeader">
          <div className="brandMark" style={{ width: 60, height: 60, fontSize: 24 }}>UP</div>
          <div>
            <div className="authTitle">Create Account</div>
            <div className="authSub">Join the university student portal</div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="form">
          <div className="grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: 16, margin: 0 }}>
            <label className="field">
              <span>Roll Number</span>
              <input className="input" placeholder="22L-1234" value={form.roll_no} onChange={(e) => setField("roll_no", e.target.value)} required />
            </label>

            <label className="field">
              <span>Full Name</span>
              <input
                className="input"
                placeholder="John Doe"
                value={form.full_name}
                onChange={(e) => setField("full_name", e.target.value)}
                required
              />
            </label>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: 16, margin: 0 }}>
            <label className="field">
              <span>Email Address</span>
              <input className="input" placeholder="student@univ.edu" value={form.email} onChange={(e) => setField("email", e.target.value)} required />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                className="input"
                type="password"
                placeholder="min 6 characters"
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                required
              />
            </label>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, margin: 0 }}>
            <label className="field">
              <span>Degree Program</span>
              <input className="input" placeholder="BS Computer Science" value={form.degree} onChange={(e) => setField("degree", e.target.value)} />
            </label>
            <label className="field">
              <span>Section</span>
              <input className="input" placeholder="6A" value={form.section} onChange={(e) => setField("section", e.target.value)} />
            </label>
            <label className="field">
              <span>Batch</span>
              <input className="input" placeholder="2022" value={form.batch} onChange={(e) => setField("batch", e.target.value)} />
            </label>
            <label className="field">
              <span>Campus</span>
              <input className="input" placeholder="Main Campus" value={form.campus} onChange={(e) => setField("campus", e.target.value)} />
            </label>
          </div>

          {error ? <div className="error">{error}</div> : null}

          <button className="btn btnBlock" type="submit" disabled={loading} style={{ height: 48, marginTop: 10 }}>
            {loading ? "Creating account..." : "Complete Registration"}
          </button>
        </form>

        <div className="hint" style={{ textAlign: "center", marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          Already have an account?{" "}
          <a href="/login" style={{ color: "#a5b4fc", fontWeight: 600, textDecoration: "none" }}>
            Sign In
          </a>
        </div>
      </div>
    </div>
  );
}

