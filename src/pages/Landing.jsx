import { useEffect, useState } from "react";
import { getWeeklySchedule, SUBJECT_META } from "../schedule";
import PaymentPortal from "./PaymentPortal";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export default function Landing({ setPage, user, profile }) {
  const [visible, setVisible] = useState(false);
  const [ttClass, setTtClass] = useState("9");
  const [showPayment, setShowPayment] = useState(false);
  const isPaid = profile?.plan === "paid";

  // ── HOOK: SPOTLIGHT MOUSE COORDINATES ──
  useEffect(() => {
    const handleMouseMove = (e) => {
      const cards = document.querySelectorAll(".spotlight-card");
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty("--mouse-x", `${x}px`);
        card.style.setProperty("--mouse-y", `${y}px`);
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // ── HOOK: SCROLL TRIGGERED INTERSECTION OBSERVER ──
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -50px 0px" }
    );
    const els = document.querySelectorAll(".scroll-reveal");
    els.forEach((el) => observer.observe(el));
    return () => {
      els.forEach((el) => observer.unobserve(el));
    };
  }, []);

  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  const weekSched = getWeeklySchedule(ttClass);

  // Helper function for staggered rolling text roll-in
  const renderRollingText = (text, delayOffset = 0, isGradient = false) => {
    return text.split(" ").map((word, idx) => (
      <span key={idx} className="reveal-word-wrap" style={{ marginRight: "0.22em" }}>
        <span 
          className="reveal-word" 
          style={{ 
            animationDelay: `${delayOffset + idx * 0.06}s`,
            background: isGradient ? "var(--grad)" : "none",
            WebkitBackgroundClip: isGradient ? "text" : "none",
            WebkitTextFillColor: isGradient ? "transparent" : "inherit"
          }}
        >
          {word}
        </span>
      </span>
    ));
  };

  return (
    <div style={{ fontFamily: "var(--font-body)", color: "var(--text)" }}>

      {/* ── HERO ── */}
      <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "120px 24px 80px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,rgba(139,92,246,0.12) 0%,transparent 70%)", top: -100, left: -100, pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,240,255,0.08) 0%,transparent 70%)", bottom: -100, right: -100, pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.007) 1px,transparent 1px)", backgroundSize: "48px 48px", pointerEvents: "none" }} />

        <div style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(30px)", transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)", maxWidth: 840, position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 20, border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.05)", marginBottom: 28 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--cyan)" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--cyan)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>CLASSES 6 – 10 · NCERT CURRICULUM · BENGALURU</span>
          </div>

          <h1 style={{ fontSize: "clamp(42px,7vw,76px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 24, fontFamily: "var(--font-head)" }}>
            {renderRollingText("Learn the way", 0.15)}<br />
            <span style={{ display: "inline-block" }}>
              {renderRollingText("your brain works", 0.4, true)}
            </span>
          </h1>

          <p style={{ fontSize: "clamp(15px,2vw,18px)", color: "var(--text2)", lineHeight: 1.8, maxWidth: 580, margin: "0 auto 16px", fontWeight: 400 }}>
            Saint Academy replaces rote memorization with real understanding. Live sessions, NCERT-aligned material, AI homework help, and teachers who actually explain.
          </p>
          <p style={{ fontSize: 13, color: "var(--purple3)", fontWeight: 700, margin: "0 auto 36px", fontFamily: "var(--font-mono)", letterSpacing: "0.02em" }}>
            ✦ Premium students get AI-powered homework assistance — upload a photo and get step-by-step solutions
          </p>

          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            {user ? (
              <button className="grad-btn magnetic-btn" style={{ padding: "14px 32px", fontSize: 16, borderRadius: 14 }} onClick={() => setPage(profile?.role === "teacher" ? "teacher" : "dashboard")}>
                Go to Dashboard
              </button>
            ) : (
              <>
                <button className="grad-btn magnetic-btn" style={{ padding: "14px 32px", fontSize: 16, borderRadius: 14 }} onClick={() => setPage("signup")}>Start Learning Free</button>
                <button className="magnetic-btn" onClick={() => setPage("login")} style={{ padding: "14px 32px", fontSize: 16, borderRadius: 14, border: "1px solid var(--border2)", background: "rgba(255,255,255,0.01)", color: "var(--text)", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 600 }}>Sign In</button>
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 56, flexWrap: "wrap" }}>
            {[["5 Classes", "6th to 10th"], ["4 Subjects", "NCERT Based"], ["4–8 PM", "Mon to Fri"], ["Rs.200", "Per Week"]].map(([val, label]) => (
              <div key={val} className="spotlight-card" style={{ padding: "12px 24px", borderRadius: 14 }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, fontFamily: "var(--font-head)", color: "var(--text)" }}>{val}</p>
                <p style={{ margin: 0, fontSize: 11, color: "var(--text3)", fontWeight: 600, marginTop: 2 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="scroll-reveal" style={{ padding: "100px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--purple3)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", marginBottom: 12 }}>WHY SAINT ACADEMY</p>
          <h2 style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, letterSpacing: "-0.02em", fontFamily: "var(--font-head)" }}>
            Built for students who want to<br />
            <span style={{ background: "var(--grad)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>actually understand</span>
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20 }}>
          {[
            { num: "01", title: "Class-specific material", desc: "Study material organised by class and subject. Maths, Science, Social, Hindi — all NCERT-aligned, chapter by chapter.", accent: "var(--purple2)" },
            { num: "02", title: "AI homework assistant", desc: "Premium students can upload a photo or PDF of their homework and get step-by-step help from our AI. Works for all 4 subjects.", accent: "var(--cyan)" },
            { num: "03", title: "Live Google Meet sessions", desc: "Each subject has its own teacher. Join the live class from your dashboard — the Join button glows exactly when your class is live.", accent: "var(--purple3)" },
            { num: "04", title: "Raise doubts to teachers", desc: "Submit a doubt directly to your subject teacher — on any homework or topic. They see it highlighted and respond personally.", accent: "var(--cyan2)" },
            { num: "05", title: "4 PM to 8 PM, Mon–Fri", desc: "After-school hours designed around your schedule. Different subjects on different days — check your class timetable inside.", accent: "var(--purple2)" },
            { num: "06", title: "Teacher-controlled content", desc: "Your teacher uploads notes and homework chapter-by-chapter. Paid students get full access. Free students get NCERT textbooks.", accent: "var(--cyan)" },
          ].map(f => (
            <div key={f.num} className="spotlight-card" style={{ padding: "28px 26px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: f.accent, fontFamily: "var(--font-mono)", marginBottom: 14, letterSpacing: "0.06em" }}>{f.num}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, fontFamily: "var(--font-head)", letterSpacing: "-0.01em" }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TIMETABLE ── */}
      <section id="schedule" className="scroll-reveal" style={{ padding: "80px 24px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--purple3)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", marginBottom: 12 }}>WEEKLY SCHEDULE</p>
          <h2 style={{ fontSize: "clamp(24px,3vw,36px)", fontWeight: 800, fontFamily: "var(--font-head)", letterSpacing: "-0.02em", marginBottom: 8 }}>Monday to Friday · 4 PM – 8 PM</h2>
          <p style={{ color: "var(--text2)", fontSize: 14, margin: "0 0 28px" }}>Saturday: Revision, doubt solving, weekly tests &nbsp;·&nbsp; Sunday: Mock tests, quiz, homework checking</p>

          {/* Class selector */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 28 }}>
            {["6", "7", "8", "9", "10"].map(c => (
              <button key={c} onClick={() => setTtClass(c)} style={{ padding: "7px 18px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, background: ttClass === c ? "var(--grad)" : "var(--surface)", color: ttClass === c ? "#fff" : "var(--text2)", border: ttClass === c ? "none" : "1px solid var(--border)", transition: "all 0.2s" }} className="magnetic-btn">
                Class {c}
              </button>
            ))}
          </div>
        </div>

        {/* Timetable grid */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)" }}>
            <thead>
              <tr>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid var(--border)", width: 130 }}>Time</th>
                {DAY_LABELS.map(d => (
                  <th key={d} style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid var(--border)" }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {["4:00 – 5:00 PM", "5:00 – 6:00 PM", "6:00 – 7:00 PM", "7:00 – 8:00 PM"].map((timeLabel, slotIdx) => (
                <tr key={slotIdx}>
                  <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: "var(--cyan)", fontFamily: "var(--font-mono)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{timeLabel}</td>
                  {weekSched.map((dayData, dayIdx) => {
                    const s = dayData.slots[slotIdx];
                    const isFree = !s?.session;
                    const meta = s?.session ? SUBJECT_META[s.session.subject] : null;
                    return (
                      <td key={dayIdx} style={{ padding: "12px 10px", textAlign: "center", borderBottom: "1px solid var(--border)" }}>
                        {isFree ? (
                          <span style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>Free</span>
                        ) : (
                          <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 12px", borderRadius: 10, background: `${meta.color}12`, border: `1px solid ${meta.color}25` }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: meta.color, fontFamily: "var(--font-head)" }}>{meta.label}</span>
                            <span style={{ fontSize: 10, color: "var(--text3)" }}>{s.session.teacher.charAt(0).toUpperCase() + s.session.teacher.slice(1)}</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="scroll-reveal" style={{ padding: "100px 24px", maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--purple3)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", marginBottom: 12 }}>PRICING</p>
        <h2 style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, fontFamily: "var(--font-head)", letterSpacing: "-0.02em", marginBottom: 40 }}>
          {profile?.role === "teacher" ? "Platform Access" : "Simple, affordable."}
        </h2>

        {profile?.role === "teacher" ? (
          /* TEACHER */
          <div className="spotlight-card" style={{ padding: "40px 36px" }}>
            <h3 style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-head)", margin: "0 0 8px" }}>Welcome, Teacher</h3>
            <p style={{ color: "var(--text2)", fontSize: 15, margin: 0 }}>You have full administrative access to your classes, materials, and student management features.</p>
          </div>
        ) : isPaid ? (
          /* PAID USER — show benefits */
          <div className="spotlight-card" style={{ padding: "40px 36px", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "var(--grad)" }} />
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,rgba(139,92,246,0.2),rgba(0,240,255,0.2))", border: "1px solid rgba(139,92,246,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22 }}>✦</div>
            <h3 style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-head)", margin: "0 0 8px" }}>You're a Premium Member</h3>
            <p style={{ color: "var(--text2)", fontSize: 15, margin: "0 0 28px" }}>You already enjoy all of these benefits:</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, textAlign: "left", maxWidth: 500, margin: "0 auto" }}>
              {["Full NCERT study material, chapter-wise", "Teacher's premium notes per subject", "Homework assigned chapter-by-chapter", "AI assistant — upload photos of homework", "Raise doubts directly to subject teacher", "Live Google Meet classes with Join button", "Class-specific weekly timetable", "Priority support from your teacher"].map(f => (
                <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(0,240,255,0.15)", border: "1px solid rgba(0,240,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--cyan)" }} />
                  </div>
                  <span style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ) : user ? (
          /* FREE STUDENT (Logged In) — show only Premium plan */
          <div style={{ maxWidth: 420, margin: "0 auto" }}>
            <div className="spotlight-card" style={{ padding: "32px 28px", textAlign: "left", position: "relative" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "var(--grad)" }} />
              <div style={{ display: "inline-block", padding: "3px 12px", borderRadius: 20, background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--purple3)", fontFamily: "var(--font-mono)" }}>UPGRADE TO PREMIUM</span>
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 700, fontFamily: "var(--font-head)", background: "var(--grad)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Rs.200</span>
                <span style={{ fontSize: 14, color: "var(--text3)", marginLeft: 6 }}>/week</span>
              </div>
              <p style={{ color: "var(--text2)", fontSize: 14, margin: "0 0 20px", lineHeight: 1.6 }}>Unlock full access to all premium features and accelerate your learning.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                {["NCERT Textbooks & Solutions", "Teacher's chapter-wise notes", "Homework & assignments", "AI assistant — upload homework photos", "Join live Google Meet classes", "Raise doubts to subject teacher", "Personal teacher remarks", "Weekly tests & mock tests"].map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(0,240,255,0.15)", border: "1px solid rgba(0,240,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--cyan)" }} />
                    </div>
                    <span style={{ fontSize: 13, color: "var(--text)" }}>{f}</span>
                  </div>
                ))}
              </div>
              <button className="grad-btn magnetic-btn" style={{ width: "100%", padding: "13px", fontSize: 15, borderRadius: 12 }} onClick={() => setShowPayment(true)}>
                Upgrade to Premium for Rs.200
              </button>
            </div>
          </div>
        ) : (
          /* LOGGED OUT — show both Free and Premium plans */
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 800, margin: "0 auto" }}>
            {/* Free plan */}
            <div className="spotlight-card" style={{ padding: "32px 28px", textAlign: "left" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text3)", fontFamily: "var(--font-mono)", margin: "0 0 16px", letterSpacing: "0.06em" }}>FREE</p>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 700, fontFamily: "var(--font-head)", color: "var(--text)" }}>Rs.0</span>
                <span style={{ fontSize: 14, color: "var(--text3)", marginLeft: 6 }}>/forever</span>
              </div>
              <p style={{ color: "var(--text2)", fontSize: 14, margin: "0 0 20px", lineHeight: 1.6 }}>Get started with official NCERT resources at no cost.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                {["NCERT Textbooks (all subjects)", "NCERT Solutions (chapter-wise)", "View live class schedule", "See when classes are happening"].map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--text3)" }} />
                    </div>
                    <span style={{ fontSize: 13, color: "var(--text2)" }}>{f}</span>
                  </div>
                ))}
                {["Teacher's notes", "Homework & assignments", "AI homework assistant", "Join live classes", "Raise doubts to teacher"].map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.4 }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 9, color: "var(--text3)" }}>✕</span>
                    </div>
                    <span style={{ fontSize: 13, color: "var(--text3)", textDecoration: "line-through" }}>{f}</span>
                  </div>
                ))}
              </div>
              <button className="magnetic-btn" onClick={() => setPage("signup")} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1px solid var(--border)", background: "transparent", color: "var(--text2)", fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                Start Free
              </button>
            </div>

            {/* Premium plan */}
            <div className="spotlight-card" style={{ padding: "32px 28px", textAlign: "left", position: "relative" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "var(--grad)" }} />
              <div style={{ display: "inline-block", padding: "3px 12px", borderRadius: 20, background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--purple3)", fontFamily: "var(--font-mono)" }}>MOST POPULAR</span>
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 700, fontFamily: "var(--font-head)", background: "var(--grad)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Rs.200</span>
                <span style={{ fontSize: 14, color: "var(--text3)", marginLeft: 6 }}>/week</span>
              </div>
              <p style={{ color: "var(--text2)", fontSize: 14, margin: "0 0 20px", lineHeight: 1.6 }}>Everything in Free, plus full access to all premium features.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                {["NCERT Textbooks & Solutions", "Teacher's chapter-wise notes", "Homework & assignments", "AI assistant — upload homework photos", "Join live Google Meet classes", "Raise doubts to subject teacher", "Personal teacher remarks", "Weekly tests & mock tests"].map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(0,240,255,0.15)", border: "1px solid rgba(0,240,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--cyan)" }} />
                    </div>
                    <span style={{ fontSize: 13, color: "var(--text)" }}>{f}</span>
                  </div>
                ))}
              </div>
              <button className="grad-btn magnetic-btn" style={{ width: "100%", padding: "13px", fontSize: 15, borderRadius: 12 }} onClick={() => setPage("signup")}>
                Get Started Now
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" className="scroll-reveal" style={{ padding: "80px 24px 120px", maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--purple3)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", marginBottom: 12 }}>CONTACT</p>
        <h2 style={{ fontSize: "clamp(24px,3vw,36px)", fontWeight: 800, fontFamily: "var(--font-head)", letterSpacing: "-0.02em", marginBottom: 20 }}>Got questions?</h2>
        <p style={{ color: "var(--text2)", fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>Reach out before joining. We're happy to answer anything about classes, schedule, or subjects.</p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="mailto:saintacademy@email.com" className="magnetic-btn" style={{ padding: "12px 24px", borderRadius: 12, border: "1px solid var(--border2)", background: "rgba(255,255,255,0.02)", color: "var(--cyan)", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>saintacademy@email.com</a>
          <a href="tel:+918318081890" className="magnetic-btn" style={{ padding: "12px 24px", borderRadius: 12, border: "1px solid var(--border2)", background: "rgba(255,255,255,0.02)", color: "var(--text)", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>+91 83180 81890</a>
        </div>
      </section>

      <div style={{ borderTop: "1px solid var(--border)", padding: "24px", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "var(--text3)", margin: 0 }}>Saint Academy · Bengaluru · 2025</p>
      </div>

      {/* PAYMENT PORTAL OVERLAY */}
      {showPayment && (
        <PaymentPortal
          profile={profile}
          onClose={() => setShowPayment(false)}
          onSuccess={() => setShowPayment(false)}
        />
      )}
    </div>
  );
}