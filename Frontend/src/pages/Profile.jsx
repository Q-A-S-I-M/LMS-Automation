import { useEffect, useState } from "react";
import { api } from "../api/client";

function Row({ label, value }) {
  return (
    <div className="kv">
      <div className="kvLabel">{label}</div>
      <div className="kvValue">{value || "-"}</div>
    </div>
  );
}

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await api.profile();
        if (!alive) return;
        setProfile(res.profile);
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load profile");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <div className="pageTitle">Profile</div>
          <div className="pageSub">Student bio-data and program info</div>
        </div>
      </div>

      {loading ? <div className="muted">Loading...</div> : null}
      {error ? <div className="error">{error}</div> : null}

      {!loading && !error && profile ? (
        <div className="panel">
          <div className="panelTitle">Personal details</div>
          <div className="kvGrid">
            <Row label="Roll No" value={profile.roll_no} />
            <Row label="Full name" value={profile.full_name} />
            <Row label="Email" value={profile.email} />
            <Row label="Degree" value={profile.degree} />
            <Row label="Batch" value={profile.batch} />
            <Row label="Section" value={profile.section} />
            <Row label="Campus" value={profile.campus} />
            <Row label="DOB" value={profile.dob?.slice?.(0, 10)} />
            <Row label="CNIC" value={profile.cnic} />
            <Row label="Blood group" value={profile.blood_group} />
            <Row label="Nationality" value={profile.nationality} />
            <Row label="Status" value={profile.status} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

