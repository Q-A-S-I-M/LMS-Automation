import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function TeacherLogin() {
  const nav = useNavigate();
  const loc = useLocation();
  const { teacherLogin } = useAuth();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const isEmail = usernameOrEmail.includes("@");
      await teacherLogin(isEmail ? { email: usernameOrEmail, password } : { username: usernameOrEmail, password });
      const to = loc.state?.from || "/teacher";
      nav(to, { replace: true });
    } catch (err) {
      setError(err.message || "Failed to login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="authWrap">
      <div className="authCard">
        <div className="authHeader">
          <div className="brandMark" style={{ width: 60, height: 60, fontSize: 24, background: "linear-gradient(135deg, #f87171, #fb923c)" }}>TM</div>
          <div>
            <div className="authTitle">Faculty Portal</div>
            <div className="authSub">Secure instructor access</div>
          </div>
        </div>

        {error ? <div className="error" style={{ marginBottom: 16 }}>{error}</div> : null}

        <form onSubmit={submit} className="form">
          <label className="field">
            <span>Username or Email</span>
            <input 
              className="input" 
              placeholder="faculty.id@univ.edu"
              value={usernameOrEmail} 
              onChange={(e) => setUsernameOrEmail(e.target.value)} 
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input 
              className="input" 
              type="password" 
              placeholder="••••••••"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </label>
          <button className="btn btnBlock" type="submit" disabled={loading || !usernameOrEmail || !password} style={{ height: 48, marginTop: 10 }}>
            {loading ? "Authenticating..." : "Instructor Login"}
          </button>
        </form>

        <div className="hint" style={{ textAlign: "center", marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <a href="/login" style={{ color: "rgba(229,231,235,0.5)", fontSize: 12, textDecoration: "none" }}>
            Not a faculty member? <span style={{ color: "#a5b4fc" }}>Student Portal</span>
          </a>
        </div>
      </div>
    </div>
  );
}

