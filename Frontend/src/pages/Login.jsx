import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload =
        identifier.includes("@")
          ? { email: identifier.trim(), password }
          : { roll_no: identifier.trim(), password };
      await login(payload);
      navigate("/app");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="authWrap">
      <div className="authCard">
        <div className="authHeader">
          <div className="brandMark" style={{ width: 60, height: 60, fontSize: 24 }}>UP</div>
          <div>
            <div className="authTitle">Welcome Back</div>
            <div className="authSub">Sign in to your student portal</div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="form">
          <label className="field">
            <span>Roll Number or Email</span>
            <input 
              className="input"
              placeholder="e.g. 22L-1234 or student@univ.edu"
              value={identifier} 
              onChange={(e) => setIdentifier(e.target.value)} 
              required 
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </label>

          {error ? <div className="error">{error}</div> : null}

          <button className="btn btnBlock" type="submit" disabled={loading} style={{ height: 48, marginTop: 10 }}>
            {loading ? "Verifying..." : "Sign In"}
          </button>
        </form>

        <div className="hint" style={{ textAlign: "center", marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          Don’t have an account?{" "}
          <a href="/register" style={{ color: "#a5b4fc", fontWeight: 600, textDecoration: "none" }}>
            Create Account
          </a>
          <div style={{ marginTop: 12 }}>
            <a href="/teacher/login" style={{ color: "rgba(229,231,235,0.5)", fontSize: 12, textDecoration: "none" }}>
              Are you a faculty member? <span style={{ color: "#a5b4fc" }}>Teacher Login</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

