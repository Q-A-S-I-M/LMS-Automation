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
      <div className="authCard">
        <div className="authHeader">
          <div className="brandMark">UP</div>
          <div>
            <div className="authTitle">Student Registration</div>
            <div className="authSub">Create your portal account</div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="form">
          <label className="field">
            <span>Roll no</span>
            <input value={form.roll_no} onChange={(e) => setField("roll_no", e.target.value)} required />
          </label>

          <label className="field">
            <span>Full name</span>
            <input
              value={form.full_name}
              onChange={(e) => setField("full_name", e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Email</span>
            <input value={form.email} onChange={(e) => setField("email", e.target.value)} required />
          </label>

          <label className="field">
            <span>Password (min 6 chars)</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              required
            />
          </label>

          <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <label className="field">
              <span>Degree</span>
              <input value={form.degree} onChange={(e) => setField("degree", e.target.value)} />
            </label>
            <label className="field">
              <span>Section</span>
              <input value={form.section} onChange={(e) => setField("section", e.target.value)} />
            </label>
            <label className="field">
              <span>Batch</span>
              <input value={form.batch} onChange={(e) => setField("batch", e.target.value)} />
            </label>
            <label className="field">
              <span>Campus</span>
              <input value={form.campus} onChange={(e) => setField("campus", e.target.value)} />
            </label>
          </div>

          {error ? <div className="error">{error}</div> : null}

          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>

        <div className="hint">
          Already have an account?{" "}
          <a href="/login" style={{ color: "#c7d2fe" }}>
            Login
          </a>
          <div style={{ marginTop: 8 }}>
            <a href="/chat" style={{ color: "#c7d2fe" }}>
              Open AI assistant (chatbot)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

