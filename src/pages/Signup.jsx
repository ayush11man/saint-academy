import { useState } from "react";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs, getDoc, limit } from "firebase/firestore";
import PaymentPortal from "./PaymentPortal";

const STEPS = ["About You", "Account", "Verify", "Choose Plan"];

export default function Signup({ setPage, setUser, setRole, setProfile }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [paidNudge, setPaidNudge] = useState(false);
  const [showPaymentPortal, setShowPaymentPortal] = useState(false);
  const [portalProfile, setPortalProfile] = useState(null);

  const [form, setForm] = useState({
    name: "", cls: "", school: "",
    phone: "", email: "", username: "",
    password: "", confirm: "",
  });

  const set = (k) => (e) => { setError(""); setForm(f => ({ ...f, [k]: e.target.value })); };

  const v0 = () => {
    if (!form.name.trim()) return "Enter your full name.";
    if (!form.cls.trim()) return "Enter your class (6 to 10).";
    if (!["6", "7", "8", "9", "10"].includes(form.cls.trim())) return "Class must be 6, 7, 8, 9 or 10.";
    if (!form.school.trim()) return "Enter your school name.";
    return null;
  };

  const v1 = async () => {
    const phoneRe = /^[6-9]\d{9}$/;
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!phoneRe.test(form.phone.replace(/\s|\+91/g, ""))) return "Enter a valid 10-digit Indian mobile number.";
    if (!emailRe.test(form.email)) return "Enter a valid email address.";
    if (!form.username.trim()) return "Choose a username.";
    if (/\s/.test(form.username)) return "Username cannot have spaces.";
    if (form.password.length < 6) return "Password must be at least 6 characters.";
    if (form.password !== form.confirm) return "Passwords do not match.";

    // Check username uniqueness in Firestore
    try {
      const uSnap = await getDocs(query(collection(db, "users"), where("username", "==", form.username.trim()), limit(1)));
      if (!uSnap.empty) return "Username already taken. Choose a different one.";
    } catch (e) {
      console.warn("Username uniqueness check bypassed due to Firestore permissions:", e);
      if (e?.code !== "permission-denied") {
        throw e;
      }
    }

    return null;
  };

  const next = async () => {
    setLoading(true);
    try {
      const err = step === 0 ? v0() : await v1();
      if (err) { setError(err); return; }
      setError("");
      setStep(s => s + 1);
    } catch (e) {
      console.error("Signup next() error:", e);
      if (e?.code === "permission-denied") {
        setError("Database permission error. Please contact support.");
      } else if (e?.code?.startsWith("auth/")) {
        setError(`Auth error: ${e.message}`);
      } else {
        setError("Something went wrong. Please check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user exists
      const snap = await getDoc(doc(db, "users", user.uid));
      let d;
      if (!snap.exists()) {
        d = {
          name: user.displayName || "Student",
          email: user.email,
          username: user.email.split("@")[0] + "_" + Math.floor(Math.random() * 1000),
          role: "student",
          cls: "",
          plan: "free",
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, "users", user.uid), d);
      } else {
        d = snap.data();
      }

      setUser(user);
      setRole(d.role);
      setProfile(d);
      setPage(d.role === "teacher" ? "teacher" : "dashboard");
    } catch (err) {
      console.error(err);
      if (err.code !== "auth/popup-closed-by-user") {
        setError(`Google Sign-In failed: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const back = () => { setError(""); setStep(s => s - 1); };

  const create = async () => {
    setError(""); setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      await sendEmailVerification(cred.user);
      const data = {
        name: form.name.trim(),
        cls: form.cls.trim(),
        school: form.school.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        username: form.username.trim().toLowerCase(),
        role: "student",
        plan: "free",
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "users", cred.user.uid), data);
      setSent(true);
    } catch (err) {
      const c = err.code;
      if (c === "auth/email-already-in-use") setError("This email is already registered. Try logging in.");
      else if (c === "auth/weak-password") setError("Password is too weak.");
      else setError("Signup failed. Please try again.");
    } finally { setLoading(false); }
  };

  const verify = async () => {
    setLoading(true);
    try {
      await auth.currentUser?.reload();
      if (auth.currentUser?.emailVerified) {
        setError("");
        setStep(3); // advance to plan selection
      } else {
        setError("Not verified yet. Check your inbox and click the link.");
      }
    } finally { setLoading(false); }
  };

  const choosePlan = async (chosen) => {
    // chosen: "free" | "paid" | "paid_success"
    if (chosen === "paid") {
      // Build a minimal profile object so PaymentPortal can display student info
      setPortalProfile({
        name: form.name.trim(),
        cls: form.cls.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      });
      setShowPaymentPortal(true);
      return;
    }
    // Free plan or successful Paid plan — load profile and go to dashboard
    setLoading(true);
    try {
      const { doc: fdoc, getDoc, updateDoc } = await import("firebase/firestore");
      const uid = auth.currentUser?.uid;
      
      if (chosen === "free") {
        // Update plan field in Firestore to "free" ONLY if they chose free
        await updateDoc(fdoc(db, "users", uid), { plan: "free" });
      }
      
      const snap = await getDoc(fdoc(db, "users", uid));
      const d = snap.exists() ? snap.data() : { role: "student", plan: chosen === "free" ? "free" : "paid" };
      setUser(auth.currentUser); setRole(d.role); setProfile(d);
      setPage("dashboard");
    } finally { setLoading(false); }
  };

  return (
    <>
      {showPaymentPortal && (
        <PaymentPortal
          profile={portalProfile}
          onClose={() => setShowPaymentPortal(false)}
          onSuccess={() => {
            // After successful payment, continue to dashboard on paid success plan
            choosePlan("paid_success");
          }}
        />
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        .su * { box-sizing:border-box; }
        .su-in { 
          width:100%;
          padding:12px 16px;
          background:rgba(255,255,255,0.02);
          border:1px solid rgba(255,255,255,0.06);
          border-radius:12px;
          color:var(--text);
          font-family:var(--font-body);
          font-size:14px;
          outline:none;
          transition:all 0.25s ease;
          backdrop-filter:blur(8px);
          -webkit-backdrop-filter:blur(8px);
          box-shadow:inset 0 1px 1px rgba(255,255,255,0.01);
        }
        .su-in::placeholder { color:var(--text3); }
        .su-in:focus { 
          border-color:rgba(0,229,255,0.5);
          background-color:rgba(255,255,255,0.05);
          box-shadow:0 0 15px rgba(0,229,255,0.15), inset 0 1px 1px rgba(255,255,255,0.05); 
        }
        .su-btn { 
          width:100%;
          padding:13px;
          background:var(--grad);
          border:none;
          border-radius:12px;
          color:#fff;
          font-weight:700;
          font-size:15px;
          font-family:var(--font-body);
          cursor:pointer;
          transition:all 0.25s ease; 
          box-shadow:0 4px 15px rgba(124,58,237,0.35);
        }
        .su-btn:hover:not(:disabled) { 
          opacity:0.95;
          transform:translateY(-1.5px); 
          box-shadow:0 6px 20px rgba(0,229,255,0.45);
        }
        .su-btn:disabled{
          opacity:0.4;
          cursor:not-allowed;
          box-shadow:none;
        }
        .g-btn{
          width:100%;
          padding:12px;
          background:rgba(255,255,255,0.03);
          border:1px solid rgba(255,255,255,0.07);
          border-radius:12px;
          color:var(--text);
          font-weight:600;
          font-size:14px;
          font-family:var(--font-body);
          cursor:pointer;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:10px;
          transition:all 0.25s ease;
          backdrop-filter:blur(8px);
          -webkit-backdrop-filter:blur(8px);
        }
        .g-btn:hover:not(:disabled){
          background:rgba(255,255,255,0.07);
          border-color:rgba(255,255,255,0.15);
          transform:translateY(-1.5px);
          box-shadow:0 6px 15px rgba(0,0,0,0.15);
        }
        .su-ghost { 
          padding:12px 20px;
          border-radius:12px;
          border:1px solid rgba(255,255,255,0.06);
          background:rgba(255,255,255,0.01);
          color:var(--text2);
          font-family:var(--font-body);
          font-size:14px;
          font-weight:600;
          cursor:pointer;
          transition:all 0.25s ease; 
          backdrop-filter:blur(8px);
          -webkit-backdrop-filter:blur(8px);
        }
        .su-ghost:hover { 
          background:rgba(255,255,255,0.05);
          color:var(--text); 
          border-color:rgba(255,255,255,0.15);
          transform:translateY(-1px);
        }
        @keyframes fadeUp{from{opacity:0;transform:translateY(15px)}to{opacity:1;transform:translateY(0)}}
        @keyframes floatBlob1 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(40px, -60px) scale(1.1); }
        }
        @keyframes floatBlob2 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-30px, 40px) scale(1.05); }
        }
        @keyframes floatBlob3 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(30px, 30px) scale(1.15); }
        }
      `}</style>

      <div className="su" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "40px 16px", fontFamily: "var(--font-body)", position: "relative", overflow: "hidden" }}>
        {/* Colorful Animated Background Blobs for Visual Glassmorphic Pop */}
        <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)", top: "-15%", right: "-10%", pointerEvents: "none", filter: "blur(50px)", animation: "floatBlob1 15s ease infinite alternate" }} />
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,229,255,0.12) 0%, transparent 70%)", bottom: "-10%", left: "-10%", pointerEvents: "none", filter: "blur(50px)", animation: "floatBlob2 18s ease infinite alternate" }} />
        <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)", top: "35%", left: "25%", pointerEvents: "none", filter: "blur(40px)", animation: "floatBlob3 20s ease infinite alternate" }} />

        <div style={{ width: "100%", maxWidth: 460, position: "relative", zIndex: 1, animation: "fadeUp 0.5s ease" }}>

          <button onClick={() => setPage("landing")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: 13, fontFamily: "var(--font-body)", marginBottom: 24, padding: 0, transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "var(--text)"} onMouseLeave={e => e.currentTarget.style.color = "var(--text2)"}>
            ← Back
          </button>

          {/* Stepper */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
            {STEPS.map((label, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "auto" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <div style={{ 
                    width: 28, 
                    height: 28, 
                    borderRadius: "50%", 
                    background: i <= step ? "var(--grad)" : "rgba(255, 255, 255, 0.02)", 
                    border: i <= step ? "none" : "1px solid rgba(255, 255, 255, 0.06)", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    fontSize: 11, 
                    fontWeight: 700, 
                    color: i <= step ? "#fff" : "var(--text3)", 
                    fontFamily: "var(--font-mono)", 
                    flexShrink: 0,
                    backdropFilter: "blur(4px)",
                    WebkitBackdropFilter: "blur(4px)",
                    boxShadow: i <= step ? "0 0 15px rgba(0, 229, 255, 0.35)" : "none",
                    transition: "all 0.3s ease"
                  }}>
                    {i < step ? "✓" : i + 1}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: i === step ? "var(--cyan)" : "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap", transition: "color 0.3s ease" }}>{label}</span>
                </div>
                {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: i < step ? "var(--cyan)" : "rgba(255, 255, 255, 0.06)", margin: "0 8px", marginBottom: 18, transition: "background 0.3s ease" }} />}
              </div>
            ))}
          </div>

          <div style={{ 
            background: "rgba(13, 15, 26, 0.55)", 
            border: "1px solid rgba(255, 255, 255, 0.08)", 
            borderRadius: 24, 
            overflow: "hidden", 
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            boxShadow: "0 30px 70px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)" 
          }}>
            <div style={{ height: 3, background: "var(--grad)", opacity: 0.85 }} />
            <div style={{ padding: "32px 30px 36px" }}>

              {step === 0 && (
                <>
                  <H title="About You" sub="Tell us who you are" />
                  <F label="Full Name" value={form.name} onChange={set("name")} placeholder="Manoj Sharma" />
                  <F label="Class" value={form.cls} onChange={set("cls")} placeholder="9" note="Enter just the number: 6, 7, 8, 9 or 10" />
                  <F label="School" value={form.school} onChange={set("school")} placeholder="DPS Bengaluru" />
                  {error && <Err>{error}</Err>}
                  <button className="su-btn" onClick={next} disabled={loading} style={{ marginBottom: 16 }}>{loading ? "Checking..." : "Continue"}</button>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ flex: 1, height: 1, background: "rgba(255, 255, 255, 0.06)" }} />
                    <span style={{ fontSize: 12, color: "var(--text3)" }}>or</span>
                    <div style={{ flex: 1, height: 1, background: "rgba(255, 255, 255, 0.06)" }} />
                  </div>

                  <button className="g-btn" onClick={handleGoogle} disabled={loading}>
                    <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285f4" /><path d="M9 18c2.43 0 4.467-.806 5.956-2.184L12.048 13.56c-.413.277-.942.441-1.548.441-1.187 0-2.192-.801-2.551-1.876H4.96v2.336A8.995 8.995 0 0 0 9 18z" fill="#34a853" /><path d="M6.449 12.125c-.183-.547-.288-1.129-.288-1.733s.105-1.186.288-1.733V6.323H4.96A8.995 8.995 0 0 0 4 10.392c0 1.452.348 2.827.96 4.049l1.489-2.316z" fill="#fbbc05" /><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.89 11.426 0 9 0 5.48 0 2.443 2.117 1.107 5.174L3.892 7.51c.359-1.075 1.364-1.876 2.551-1.876z" fill="#ea4335" /></svg>
                    Continue with Google
                  </button>
                </>
              )}

              {step === 1 && (
                <>
                  <H title="Your Account" sub="Set up your login details" />
                  <F label="Phone (+91)" value={form.phone} onChange={set("phone")} placeholder="987654321" type="tel" />
                  <F label="Email" value={form.email} onChange={set("email")} placeholder="you@gmail.com" type="email" />
                  <F label="Username" value={form.username} onChange={set("username")} placeholder="manoj_sharma" note="Unique — used to log in" />
                  <F label="Password" value={form.password} onChange={set("password")} placeholder="Min 6 characters" type="password" />
                  <F label="Confirm Password" value={form.confirm} onChange={set("confirm")} placeholder="Repeat password" type="password" />
                  {error && <Err>{error}</Err>}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="su-ghost" onClick={back}>Back</button>
                    <button className="su-btn" onClick={next} disabled={loading} style={{ flex: 1 }}>{loading ? "Checking..." : "Continue"}</button>
                  </div>
                </>
              )}

              {step === 2 && !sent && (
                <>
                  <H title="Verify Email" sub="Almost there" />
                  <div style={{ background: "rgba(124,58,237,0.03)", border: "1px solid rgba(124,58,237,0.18)", borderRadius: 14, padding: 18, marginBottom: 20, textAlign: "center", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}>
                    <p style={{ color: "var(--cyan)", fontWeight: 700, fontSize: 15, margin: "0 0 6px", fontFamily: "var(--font-mono)" }}>{form.email}</p>
                    <p style={{ color: "var(--text2)", fontSize: 13, margin: 0, lineHeight: 1.6 }}>We will send a verification link here. Click it to activate your account.</p>
                  </div>
                  {error && <Err>{error}</Err>}
                  <button className="su-btn" onClick={create} disabled={loading} style={{ marginBottom: 10 }}>{loading ? "Sending..." : "Send Verification Email"}</button>
                  <button className="su-ghost" onClick={back} style={{ width: "100%" }}>Back</button>
                </>
              )}

              {step === 2 && sent && (
                <>
                  <H title="Check Your Email" sub="One last step" />
                  <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(0,229,255,0.05)", border: "1px solid rgba(0,229,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 24, color: "var(--cyan)" }}>✓</div>
                    <p style={{ color: "var(--text)", fontWeight: 700, fontSize: 18, margin: "0 0 8px", fontFamily: "var(--font-head)" }}>Email sent!</p>
                    <p style={{ color: "var(--text2)", fontSize: 14, lineHeight: 1.7, margin: 0 }}>Check <strong style={{ color: "var(--cyan)" }}>{form.email}</strong> and click the verification link. Then come back.</p>
                  </div>
                  {error && <Err>{error}</Err>}
                  <button className="su-btn" onClick={verify} disabled={loading} style={{ marginBottom: 12 }}>{loading ? "Checking..." : "I've verified — Continue"}</button>
                  <p style={{ textAlign: "center", fontSize: 13, color: "var(--text3)", cursor: "pointer", margin: 0 }} onClick={create}>Resend email</p>
                </>
              )}

              {step === 3 && (
                <>
                  <H title="Choose Your Plan" sub="Pick what works best for you" />

                  <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>

                    {/* Free Plan */}
                    <div
                      onClick={() => { setPaidNudge(false); choosePlan("free"); }}
                      style={{ cursor: "pointer", border: "1px solid rgba(0, 229, 255, 0.18)", borderRadius: 16, padding: "18px 20px", background: "rgba(0, 229, 255, 0.02)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", transition: "all 0.25s", position: "relative", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.2)", inset: "0 1px 0 rgba(255,255,255,0.05)" }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(0, 229, 255, 0.06)";
                        e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.4)";
                        e.currentTarget.style.boxShadow = "0 8px 30px rgba(0, 229, 255, 0.15), inset 0 1px 0 rgba(255,255,255,0.1)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "rgba(0, 229, 255, 0.02)";
                        e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.18)";
                        e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)";
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-head)" }}>🎓 Free Plan</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--cyan)", fontFamily: "var(--font-mono)" }}>₹0 / mo</span>
                      </div>
                      <ul style={{ margin: 0, padding: "0 0 0 18px", color: "var(--text2)", fontSize: 13, lineHeight: 1.9 }}>
                        <li>Access to all NCERT study material</li>
                        <li>Basic schedule & timetable</li>
                        <li>Community support</li>
                      </ul>
                      <div style={{ marginTop: 14 }}>
                        <span style={{ display: "inline-block", background: "var(--grad)", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 8, padding: "5px 14px", fontFamily: "var(--font-mono)", boxShadow: "0 2px 10px rgba(0, 229, 255, 0.3)" }}>Get Started Free →</span>
                      </div>
                    </div>

                    {/* Paid Plan */}
                    <div
                      onClick={() => choosePlan("paid")}
                      style={{ cursor: "pointer", border: "1px solid rgba(124, 58, 237, 0.22)", borderRadius: 16, padding: "18px 20px", background: "rgba(124, 58, 237, 0.02)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", transition: "all 0.25s", position: "relative", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.2)", inset: "0 1px 0 rgba(255,255,255,0.05)" }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(124, 58, 237, 0.08)";
                        e.currentTarget.style.borderColor = "rgba(124, 58, 237, 0.45)";
                        e.currentTarget.style.boxShadow = "0 8px 30px rgba(124, 58, 237, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "rgba(124, 58, 237, 0.02)";
                        e.currentTarget.style.borderColor = "rgba(124, 58, 237, 0.22)";
                        e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)";
                      }}
                    >
                      <div style={{ position: "absolute", top: 12, right: 14, background: "rgba(0, 229, 255, 0.15)", border: "1px solid rgba(0, 229, 255, 0.35)", borderRadius: 20, padding: "2px 10px", fontSize: 10, fontWeight: 700, color: "var(--cyan)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>RECOMMENDED</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-head)" }}>⚡ Premium Plan</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#c4b5fd", fontFamily: "var(--font-mono)" }}>₹199 / mo</span>
                      </div>
                      <ul style={{ margin: 0, padding: "0 0 0 18px", color: "var(--text2)", fontSize: 13, lineHeight: 1.9 }}>
                        <li>Everything in Free</li>
                        <li>Live doubt sessions with teachers</li>
                        <li>AI-powered personalised quizzes</li>
                        <li>Priority support</li>
                      </ul>
                      <div style={{ marginTop: 14 }}>
                        <span style={{ display: "inline-block", background: "var(--grad)", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 8, padding: "5px 14px", fontFamily: "var(--font-mono)", boxShadow: "0 2px 10px rgba(124, 58, 237, 0.3)" }}>Upgrade to Premium →</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

            </div>
          </div>

          <p style={{ textAlign: "center", fontSize: 14, color: "var(--text2)", marginTop: 20 }}>
            Already have an account?{" "}
            <span style={{ color: "var(--cyan)", cursor: "pointer", fontWeight: 600 }} onClick={() => setPage("login")}>Sign in</span>
          </p>
        </div>
      </div>
    </>
  );
}

function H({ title, sub }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-head)", letterSpacing: "-0.02em", margin: "0 0 4px", color: "var(--text)" }}>{title}</h2>
      <p style={{ color: "var(--text2)", fontSize: 14, margin: 0 }}>{sub}</p>
    </div>
  );
}
function F({ label, value, onChange, placeholder, type = "text", note }) {
  const [show, setShow] = useState(false);
  const isPwd = type === "password";
  const actualType = isPwd && show ? "text" : type;

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input className="su-in" type={actualType} value={value} onChange={onChange} placeholder={placeholder} style={isPwd ? { paddingRight: 50 } : {}} />
        {isPwd && (
          <button type="button" onClick={() => setShow(!show)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--cyan)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
            {show ? "HIDE" : "SHOW"}
          </button>
        )}
      </div>
      {note && <p style={{ fontSize: 11, color: "var(--text3)", margin: "5px 0 0" }}>{note}</p>}
    </div>
  );
}
function Err({ children }) {
  return <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 10, padding: "10px 14px", color: "#fca5a5", fontSize: 13, marginBottom: 14 }}>{children}</div>;
}