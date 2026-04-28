import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function RequireAuth({ children }) {
  const { role, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="muted">Loading...</div>;
  if (!role) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

