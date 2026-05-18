import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import Navbar     from "./components/Navbar";
import Landing    from "./pages/Landing";
import Login      from "./pages/Login";
import Signup     from "./pages/Signup";
import StudentDashboard from "./pages/StudentDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";

export default function App() {
  const [page, setPage]   = useState("landing");
  const [user, setUser]   = useState(null);
  const [role, setRole]   = useState(null);
  const [profile, setProfile] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          const d = snap.data();
          setRole(d.role);
          setProfile(d);
          // Auto-route only if currently on landing/login/signup
          setPage((prev) =>
            ["landing","login","signup"].includes(prev)
              ? (d.role === "teacher" ? "teacher" : "dashboard")
              : prev
          );
        }
      } else {
        setUser(null); setRole(null); setProfile(null);
        setPage("landing");
      }
      setBooting(false);
    });
    return unsub;
  }, []);

  const handleLogout = () => {
    auth.signOut();
    setUser(null); setRole(null); setProfile(null);
    setPage("landing");
  };

  if (booting) return <Loader />;

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)" }}>
      <Navbar
        page={page} setPage={setPage}
        user={user} role={role} profile={profile}
        onLogout={handleLogout}
      />

      <div style={{ paddingTop: ["landing"].includes(page) ? 0 : 72 }}>
        {page === "landing"   && <Landing  setPage={setPage} user={user} profile={profile} />}
        {page === "login"     && <Login    setPage={setPage} setUser={setUser} setRole={setRole} setProfile={setProfile} />}
        {page === "signup"    && <Signup   setPage={setPage} setUser={setUser} setRole={setRole} setProfile={setProfile} />}
        {page === "dashboard" && <StudentDashboard user={user} profile={profile} onLogout={handleLogout} />}
        {page === "teacher"   && <TeacherDashboard user={user} profile={profile} onLogout={handleLogout} />}
      </div>
    </div>
  );
}

function Loader() {
  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:36, height:36, border:"3px solid rgba(124,58,237,0.2)", borderTop:"3px solid #7c3aed", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
    </div>
  );
}