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
        <div className="authTitle">Teacher Login</div>
        <div className="authSub">Sign in as instructor to manage courses and evaluations.</div>

        {error ? <div className="error">{error}</div> : null}

        <form onSubmit={submit} className="form">
          <label className="field">
            <span>Username or Email</span>
            <input className="input" value={usernameOrEmail} onChange={(e) => setUsernameOrEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Password</span>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="btn" type="submit" disabled={loading || !usernameOrEmail || !password}>
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

