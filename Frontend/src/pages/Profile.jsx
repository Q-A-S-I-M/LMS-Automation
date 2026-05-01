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
          <div className="pageTitle">My Profile</div>
          <div className="pageSub">Academic records and personal information</div>
        </div>
      </div>

      {loading ? <div className="muted">Loading profile details...</div> : null}
      {error ? <div className="error">{error}</div> : null}

      {!loading && !error && profile ? (
        <div className="profile-grid">
          <div className="panel profile-sidebar">
            <div className="brandMark" style={{ width: 80, height: 80, fontSize: 32, margin: "0 auto" }}>
              {profile.full_name?.charAt(0)}
            </div>
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <div className="userName" style={{ fontSize: 20 }}>{profile.full_name}</div>
              <div className="userMeta" style={{ fontSize: 14 }}>{profile.roll_no}</div>
            </div>
            <div className="pill pillGreen" style={{ width: "fit-content", margin: "16px auto" }}>{profile.status}</div>
            
            <div style={{ width: "100%", marginTop: 10, textAlign: "left" }}>
              <div className="kvLabel">Program</div>
              <div className="kvValue" style={{ fontSize: 14, fontWeight: 600 }}>{profile.degree}</div>
              <div className="kvLabel" style={{ marginTop: 12 }}>Campus</div>
              <div className="kvValue" style={{ fontSize: 14 }}>{profile.campus}</div>
            </div>
          </div>

          <div className="profile-content">
            <div className="panel">
              <div className="panelTitle">Academic Information</div>
              <div className="kvGrid">
                <Row label="Batch" value={profile.batch} />
                <Row label="Section" value={profile.section} />
                <Row label="Degree Program" value={profile.degree} />
                <Row label="Email Address" value={profile.email} />
              </div>
            </div>

            <div className="panel">
              <div className="panelTitle">Personal Identification</div>
              <div className="kvGrid">
                <Row label="Date of Birth" value={profile.dob?.slice?.(0, 10)} />
                <Row label="CNIC / ID" value={profile.cnic} />
                <Row label="Blood Group" value={profile.blood_group} />
                <Row label="Nationality" value={profile.nationality} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

