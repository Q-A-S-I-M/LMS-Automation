import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null); // "student" | "teacher" | null
  const [student, setStudent] = useState(null);
  const [teacher, setTeacher] = useState(null);

  useEffect(() => {
    let alive = true;
    async function hydrate() {
      try {
        const res = await api.me();
        if (!alive) return;
        setRole(res.role);
        setStudent(res.student || null);
        setTeacher(res.teacher || null);
      } catch {
        if (!alive) return;
        setRole(null);
        setStudent(null);
        setTeacher(null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    hydrate();
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      loading,
      role,
      student,
      teacher,
      async login(payload) {
        const res = await api.login(payload);
        setRole("student");
        setStudent(res.student);
        setTeacher(null);
        return res;
      },
      async register(payload) {
        const res = await api.register(payload);
        setRole("student");
        setStudent(res.student);
        setTeacher(null);
        return res;
      },
      async teacherLogin(payload) {
        const res = await api.teacherLogin(payload);
        setRole("teacher");
        setTeacher(res.teacher);
        setStudent(null);
        return res;
      },
      async logout() {
        try {
          await api.logout();
        } catch {
          // ignore
        }
        setRole(null);
        setStudent(null);
        setTeacher(null);
      },
    }),
    [loading, role, student, teacher],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

