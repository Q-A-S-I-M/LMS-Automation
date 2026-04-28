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
          <div className="brandMark">UP</div>
          <div>
            <div className="authTitle">Student Login</div>
            <div className="authSub">Roll No / Email</div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="form">
          <label className="field">
            <span>Roll no or email</span>
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </label>

          {error ? <div className="error">{error}</div> : null}

          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

      <div className="hint">
        Don’t have an account?{" "}
        <a href="/register" style={{ color: "#c7d2fe" }}>
          Register
        </a>
        <div style={{ marginTop: 8 }}>
        </div>
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

