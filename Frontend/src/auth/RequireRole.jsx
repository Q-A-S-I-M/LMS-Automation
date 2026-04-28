import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function RequireRole({ role: requiredRole, children }) {
  const { loading, role } = useAuth();
  const loc = useLocation();

  if (loading) return <div className="muted">Loading...</div>;

  if (!role) {
    const loginPath = requiredRole === "teacher" ? "/teacher/login" : "/login";
    return <Navigate to={loginPath} replace state={{ from: loc.pathname }} />;
  }

  if (role !== requiredRole) {
    const home = role === "teacher" ? "/teacher" : "/app";
    return <Navigate to={home} replace />;
  }

  return children;
}

