import { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import {
  collection, getDocs, doc, setDoc, deleteDoc,
  getDoc, updateDoc, onSnapshot, addDoc, serverTimestamp, query, orderBy
} from "firebase/firestore";
import { getTeacherLiveSession, SUBJECT_META, TEACHER_SUBJECTS, MEET_LINKS } from "../schedule";
import { uploadFile } from "../supabase";

const CLASSES = ["6", "7", "8", "9", "10"];
const HW_CATS = ["chapter", "special", "integrated"];

export default function TeacherDashboard({ user, profile, onLogout }) {
  const [tab, setTab] = useState("students");
  const [cls, setCls] = useState("9");
  const [students, setStudents] = useState([]);
  const [material, setMaterial] = useState([]);
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [live, setLive] = useState(null);
  const [selectedStu, setSelectedStu] = useState(null); // student detail panel
  const [stuMessages, setStuMessages] = useState([]);
  const [stuInput, setStuInput] = useState("");
  const [stuDoubts, setStuDoubts] = useState({}); // { uid: hasDoubt }
  const liveTimer = useRef(null);
  const chatBottom = useRef(null);
  const unsubChat = useRef(null);
  const unsubStudents = useRef(null);

  const [matForm, setMatForm] = useState({ title: "", chapter: "", description: "", link: "", tier: "free" });
  const [hwForm, setHwForm] = useState({ title: "", chapter: "", description: "", link: "", dueDate: "", category: "chapter" });
  const [remarkText, setRemarkText] = useState("");
  const [uploading, setUploading] = useState(false);

  const rawKey = Object.keys(TEACHER_SUBJECTS).find(k => profile?.name?.toLowerCase().includes(k)) || "ayush";
  const teacherKey = rawKey === "ayushman" ? "ayush" : rawKey;
  const mySubject = TEACHER_SUBJECTS[teacherKey];
  const myMeetLink = MEET_LINKS[teacherKey];
  const subjectMeta = SUBJECT_META[mySubject];
  const initials = profile?.name ? profile.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "TC";

  useEffect(() => { load(); }, [cls, tab]);

  // Real-time student list — syncs deletions immediately
  useEffect(() => {
    if (tab !== "students") return;
    if (unsubStudents.current) unsubStudents.current();
    setLoading(true);
    unsubStudents.current = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const all = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(u => u.role === "student" && String(u.cls) === String(cls));
        setStudents(all);
        // If the currently-viewed student was deleted, close the detail panel
        setSelectedStu(prev => {
          if (!prev) return null;
          const stillExists = snap.docs.some(d => d.id === prev.id);
          return stillExists ? prev : null;
        });
        setLoading(false);
      },
      (err) => { console.error("students snapshot error:", err); setLoading(false); }
    );
    return () => { if (unsubStudents.current) unsubStudents.current(); };
  }, [cls, tab]);
  useEffect(() => {
    const check = () => setLive(getTeacherLiveSession(teacherKey));
    check();
    liveTimer.current = setInterval(check, 60000);
    return () => clearInterval(liveTimer.current);
  }, [teacherKey]);

  // Subscribe to chat when student selected
  useEffect(() => {
    if (unsubChat.current) unsubChat.current();
    if (!selectedStu) return;
    const chatRef = collection(db, "doubts", selectedStu.id, mySubject);
    const q = query(chatRef, orderBy("createdAt", "asc"));
    unsubChat.current = onSnapshot(q, snap => {
      setStuMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => chatBottom.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return () => { if (unsubChat.current) unsubChat.current(); };
  }, [selectedStu, mySubject]);

  // Check which students have unread doubts
  useEffect(() => {
    if (students.length === 0) return;
    const checkDoubts = async () => {
      const map = {};
      for (const s of students) {
        const snap = await getDocs(collection(db, "doubts", s.id, mySubject));
        const hasUnread = snap.docs.some(d => d.data().sender === "student" && !d.data().readByTeacher);
        map[s.id] = hasUnread;
      }
      setStuDoubts(map);
    };
    checkDoubts();
  }, [students, mySubject]);

  const pop = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = async () => {
    setLoading(true);
    try {
      // Students are loaded via onSnapshot subscription above — skip here
      if (tab === "students") { setLoading(false); return; }
      if (tab === "material") {
        const snap = await getDocs(collection(db, "material", `class${cls}`, mySubject));
        setMaterial(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      if (tab === "homework") {
        const snap = await getDocs(collection(db, "homework", `class${cls}`, "assignments"));
        setHomework(snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(h => h.subject === mySubject));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleFileUpload = async (file, formType) => {
    if (!file) return;
    setUploading(true);
    try {
      const folder = formType === "material"
        ? `material/class${cls}/${mySubject}`
        : `homework/class${cls}/${mySubject}`;
      const url = await uploadFile(file, folder);
      if (formType === "material") setMatForm(f => ({ ...f, link: url }));
      else setHwForm(f => ({ ...f, link: url }));
      pop("File uploaded!");
    } catch (e) {
      pop("Upload failed. Use a Drive link instead.");
    } finally { setUploading(false); }
  };

  const uploadMat = async () => {
    if (!matForm.title) { pop("Enter a title."); return; }
    await setDoc(doc(db, "material", `class${cls}`, mySubject, `item_${Date.now()}`), {
      ...matForm, subject: mySubject, uploadedAt: new Date().toISOString()
    });
    pop("Material uploaded!");
    setMatForm({ title: "", chapter: "", description: "", link: "", tier: "free" });
    load();
  };

  const delMat = async (id) => {
    await deleteDoc(doc(db, "material", `class${cls}`, mySubject, id));
    pop("Deleted."); load();
  };

  const assignHw = async () => {
    if (!hwForm.title || !hwForm.dueDate) { pop("Fill title and due date."); return; }
    await setDoc(doc(db, "homework", `class${cls}`, "assignments", `hw_${Date.now()}`), {
      ...hwForm, subject: mySubject, assignedAt: new Date().toISOString()
    });
    pop("Homework assigned!");
    setHwForm({ title: "", chapter: "", description: "", link: "", dueDate: "", category: "chapter" });
    load();
  };

  const delHw = async (id) => {
    await deleteDoc(doc(db, "homework", `class${cls}`, "assignments", id));
    pop("Deleted."); load();
  };

  const sendTeacherMessage = async () => {
    if (!stuInput.trim() || !selectedStu) return;
    await addDoc(collection(db, "doubts", selectedStu.id, mySubject), {
      text: stuInput.trim(),
      sender: "teacher",
      teacherName: profile?.name || "Teacher",
      createdAt: serverTimestamp(),
      readByStudent: false,
    });
    setStuInput("");
  };

  const addRemark = async () => {
    if (!remarkText.trim() || !selectedStu) return;
    const snap = await getDoc(doc(db, "users", selectedStu.id));
    const existing = snap.data()?.remarks || [];
    await updateDoc(doc(db, "users", selectedStu.id), {
      remarks: [...existing, {
        text: remarkText.trim(),
        subject: mySubject,
        teacher: profile?.name || "Teacher",
        date: new Date().toISOString(),
      }]
    });
    setRemarkText("");
    pop("Remark added!");
  };

  // Mark doubts as read when teacher opens student
  const openStudent = async (s) => {
    setSelectedStu(s);
    setStuMessages([]);
    setRemarkText("");
    // Mark all student messages as read
    const snap = await getDocs(collection(db, "doubts", s.id, mySubject));
    for (const d of snap.docs) {
      if (d.data().sender === "student" && !d.data().readByTeacher) {
        await updateDoc(doc(db, "doubts", s.id, mySubject, d.id), { readByTeacher: true });
      }
    }
    setStuDoubts(prev => ({ ...prev, [s.id]: false }));
  };

  return (
    <>
      <style>{`
        .td-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:22px;transition:border-color 0.2s;}
        .td-card:hover{border-color:var(--border2);}
        .td-del{padding:6px 14px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:8px;color:#f87171;font-size:12px;font-family:var(--font-body);cursor:pointer;font-weight:600;}
        .td-del:hover{background:rgba(248,113,113,0.15);}
        .cls-pill{padding:7px 16px;border-radius:20px;border:none;cursor:pointer;font-family:var(--font-mono);font-size:12px;font-weight:700;transition:all 0.2s;}
        .nav-item{width:100%;padding:10px 14px;border-radius:10px;border:none;cursor:pointer;font-family:var(--font-body);font-size:13px;font-weight:600;text-align:left;margin-bottom:4px;transition:all 0.2s;}
        .toast-pop{position:fixed;bottom:28px;right:28px;background:var(--bg2);border:1px solid var(--border2);border-radius:14px;padding:13px 22px;color:var(--text);font-size:14px;font-weight:600;z-index:999;box-shadow:0 20px 60px rgba(0,0,0,0.4);animation:fadeUp 0.3s ease;}
        .live-pulse{width:8px;height:8px;border-radius:50%;background:#22c55e;animation:livepulse 1.5s ease infinite;flex-shrink:0;}
        @keyframes livepulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)}70%{box-shadow:0 0 0 8px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
        .start-class-btn{width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#22c55e,#16a34a);border:none;color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:var(--font-body);display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;transition:opacity 0.2s;}
        .start-class-btn:hover{opacity:0.88;}
        .stu-row{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 20px;background:var(--surface);border:1px solid var(--border);border-radius:14px;cursor:pointer;transition:all 0.2s;}
        .stu-row:hover{border-color:var(--border2);background:rgba(255,255,255,0.05);}
        .doubt-dot{width:8px;height:8px;border-radius:50%;background:#f472b6;flex-shrink:0;animation:livepulse 2s ease infinite;}
        .chat-bubble-t{background:var(--grad);color:#fff;border-radius:18px 18px 4px 18px;padding:10px 14px;font-size:13px;max-width:75%;margin-left:auto;line-height:1.5;}
        .chat-bubble-s{background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:18px 18px 18px 4px;padding:10px 14px;font-size:13px;max-width:80%;line-height:1.5;}
        .cat-pill{padding:5px 12px;border-radius:20px;border:none;cursor:pointer;font-family:var(--font-mono);font-size:11px;font-weight:700;transition:all 0.2s;}
        .upload-area{border:1.5px dashed var(--border2);border-radius:12px;padding:16px;text-align:center;cursor:pointer;transition:border-color 0.2s;}
        .upload-area:hover{border-color:var(--purple3);}
        .chapter-tag{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:6px;font-size:10px;font-weight:700;font-family:var(--font-mono);}
      `}</style>

      <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-body)", display: "flex" }}>

        {/* LEFT SIDEBAR */}
        <div style={{ width: 220, background: "var(--bg2)", borderRight: "1px solid var(--border)", padding: "24px 16px", display: "flex", flexDirection: "column", position: "fixed", top: 72, bottom: 0, overflowY: "auto" }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--grad)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "var(--font-mono)", marginBottom: 10 }}>{initials}</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: "0 0 2px", fontFamily: "var(--font-head)" }}>{profile?.name || "Teacher"}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: subjectMeta?.color }} />
              <p style={{ fontSize: 11, color: "var(--text3)", margin: 0, fontFamily: "var(--font-mono)" }}>{subjectMeta?.label?.toUpperCase()}</p>
            </div>
          </div>

          <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px", fontFamily: "var(--font-mono)" }}>Navigate</p>
          {["students", "material", "homework"].map(t => (
            <button key={t} className="nav-item" onClick={() => { setTab(t); setSelectedStu(null); }}
              style={{ background: tab === t ? "rgba(124,58,237,0.15)" : "transparent", color: tab === t ? "var(--purple3)" : "var(--text2)", borderLeft: tab === t ? "2px solid var(--purple2)" : "2px solid transparent" }}>
              {t === "students" ? "Students" : t === "material" ? "Study Material" : "Homework"}
            </button>
          ))}

          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            {live ? (
              <a 
                href={live.meetLink || myMeetLink} 
                target="_blank" 
                rel="noreferrer" 
                className="start-class-btn"
                style={{
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  boxShadow: "0 0 20px rgba(16, 185, 129, 0.4)",
                  padding: "16px 12px",
                  borderRadius: "14px",
                  flexDirection: "column",
                  gap: "6px",
                  height: "auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textDecoration: "none"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div className="live-pulse" style={{ background: "#fff", width: 8, height: 8 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#fff" }}>Live Class Now</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
                  Class {live.cls}th {SUBJECT_META[live.subject]?.label || "Class"}
                </span>
                <span style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-mono)" }}>
                  {live.label}
                </span>
              </a>
            ) : (
              <div style={{ padding: "14px 11px", borderRadius: 14, border: "1px solid var(--border)", textAlign: "center", background: "rgba(255,255,255,0.02)" }}>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text3)", fontWeight: 600 }}>No class right now</p>
                <p style={{ margin: "4px 0 0", fontSize: 10, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>Button activates at class time</p>
              </div>
            )}
            <button onClick={onLogout} style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text2)", fontFamily: "var(--font-body)", fontSize: 13, cursor: "pointer" }}>
              Sign Out
            </button>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div style={{ marginLeft: 220, flex: 1, padding: "28px 28px 60px", maxWidth: "calc(100% - 220px)" }}>

          {/* Header + class selector */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {selectedStu && (
                <button onClick={() => setSelectedStu(null)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 20, padding: 0 }}>←</button>
              )}
              <div>
                <p style={{ color: "var(--text3)", fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Teacher Portal</p>
                <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-head)", letterSpacing: "-0.02em", margin: 0 }}>
                  {selectedStu ? selectedStu.name : (tab === "students" ? "Students" : tab === "material" ? "Study Material" : tab === "homework" ? "Homework" : "Payments")}
                  {!selectedStu && (tab === "students" || tab === "material" || tab === "homework") && <span style={{ fontSize: 14, color: subjectMeta?.color, marginLeft: 10, fontFamily: "var(--font-mono)" }}>· {subjectMeta?.label} · Class {cls}</span>}
                </h1>
              </div>
            </div>
            {!selectedStu && (tab === "students" || tab === "material" || tab === "homework") && (
              <div style={{ display: "flex", gap: 8 }}>
                {CLASSES.map(c => (
                  <button key={c} className="cls-pill" onClick={() => setCls(c)}
                    style={{ background: cls === c ? "var(--grad)" : "var(--surface)", color: cls === c ? "#fff" : "var(--text2)", border: cls === c ? "none" : "1px solid var(--border)" }}>
                    C{c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading && !selectedStu && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2, 3].map(i => <div key={i} style={{ height: 72, borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" }} />)}
            </div>
          )}

          {/* ── STUDENT DETAIL PANEL ── */}
          {selectedStu && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

              {/* Left — info + remarks */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Profile card */}
                <div className="td-card">
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                    <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--grad)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                      {selectedStu.name?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 17, color: "var(--text)", fontFamily: "var(--font-head)" }}>{selectedStu.name}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>@{selectedStu.username} · Class {selectedStu.cls}</p>
                    </div>
                    <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: selectedStu.plan === "paid" ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.05)", color: selectedStu.plan === "paid" ? "var(--purple3)" : "var(--text3)", fontFamily: "var(--font-mono)" }}>
                      {selectedStu.plan === "paid" ? "PREMIUM" : "FREE"}
                    </span>
                  </div>
                  {[
                    { label: "Email", value: selectedStu.email },
                    { label: "Phone", value: selectedStu.phone },
                    { label: "School", value: selectedStu.school },
                  ].map(item => (
                    <div key={item.label} style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 2px", fontFamily: "var(--font-mono)" }}>{item.label}</p>
                      <p style={{ fontSize: 13, color: "var(--text)", margin: 0 }}>{item.value || "—"}</p>
                    </div>
                  ))}
                </div>

                {/* Remarks */}
                <div className="td-card">
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", margin: "0 0 12px", fontFamily: "var(--font-head)" }}>Teacher's Remarks — {subjectMeta?.label}</p>
                  {(selectedStu.remarks || []).filter(r => r.subject === mySubject).length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                      {(selectedStu.remarks || []).filter(r => r.subject === mySubject).map((r, i) => (
                        <div key={i} style={{ padding: "10px 14px", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: 10 }}>
                          <p style={{ margin: 0, fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{r.text}</p>
                          <p style={{ margin: "4px 0 0", fontSize: 10, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>{new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: "var(--text3)", margin: "0 0 12px" }}>No remarks yet for {subjectMeta?.label}.</p>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={remarkText} onChange={e => setRemarkText(e.target.value)} placeholder="Add a remark..." onKeyDown={e => e.key === "Enter" && addRemark()}
                      style={{ flex: 1, padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontFamily: "var(--font-body)", fontSize: 13, outline: "none" }} />
                    <button onClick={addRemark} style={{ padding: "10px 16px", borderRadius: 10, background: "var(--grad)", border: "none", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 13 }}>Add</button>
                  </div>
                </div>
              </div>

              {/* Right — doubt chat */}
              <div className="td-card" style={{ display: "flex", flexDirection: "column", height: 500 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: subjectMeta?.color }} />
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "var(--text)", fontFamily: "var(--font-head)" }}>{subjectMeta?.label} Doubts</p>
                </div>

                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingBottom: 10 }}>
                  {stuMessages.length === 0 ? (
                    <p style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", marginTop: 40 }}>No doubts raised yet for {subjectMeta?.label}.</p>
                  ) : stuMessages.map((m, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: m.sender === "teacher" ? "flex-end" : "flex-start" }}>
                      {m.sender !== "teacher" && <p style={{ fontSize: 10, color: "var(--text3)", margin: "0 6px 0 0", alignSelf: "flex-end", fontFamily: "var(--font-mono)" }}>{selectedStu.name?.split(" ")[0]}</p>}
                      <div className={m.sender === "teacher" ? "chat-bubble-t" : "chat-bubble-s"}>
                        {m.imageUrl && <img src={m.imageUrl} alt="doubt" style={{ maxWidth: "100%", borderRadius: 8, marginBottom: 6 }} />}
                        {m.fileUrl && <a href={m.fileUrl} target="_blank" rel="noreferrer" style={{ display: "block", color: "var(--cyan)", fontSize: 12, marginBottom: 6 }}>View uploaded file →</a>}
                        {m.text}
                      </div>
                    </div>
                  ))}
                  <div ref={chatBottom} />
                </div>

                <div style={{ display: "flex", gap: 8, paddingTop: 12, borderTop: "1px solid var(--border)", flexShrink: 0 }}>
                  <input value={stuInput} onChange={e => setStuInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendTeacherMessage()}
                    placeholder="Reply to doubt..." style={{ flex: 1, padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontFamily: "var(--font-body)", fontSize: 13, outline: "none" }} />
                  <button onClick={sendTeacherMessage} style={{ padding: "10px 16px", borderRadius: 10, background: "var(--grad)", border: "none", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 16 }}>→</button>
                </div>
              </div>
            </div>
          )}

          {/* ── STUDENTS LIST ── */}
          {tab === "students" && !loading && !selectedStu && (
            <div>
              <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 14, fontFamily: "var(--font-mono)" }}>
                {students.length} student{students.length !== 1 ? "s" : ""} in Class {cls} — click to view details or reply to doubts
              </p>
              {students.length === 0 ? <Mpty text="No students in this class yet." /> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {students.map(s => (
                    <div key={s.id} className="stu-row" onClick={() => openStudent(s)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ position: "relative" }}>
                          <div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--grad)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0, fontFamily: "var(--font-mono)" }}>
                            {s.name?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                          </div>
                          {stuDoubts[s.id] && (
                            <div className="doubt-dot" style={{ position: "absolute", top: -2, right: -2 }} />
                          )}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: "var(--text)", fontFamily: "var(--font-head)" }}>{s.name}</p>
                            {stuDoubts[s.id] && <span style={{ fontSize: 10, fontWeight: 700, color: "#f472b6", fontFamily: "var(--font-mono)", background: "rgba(244,114,182,0.1)", padding: "2px 8px", borderRadius: 6 }}>NEW DOUBT</span>}
                          </div>
                          <p style={{ margin: 0, fontSize: 12, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>{s.email} · {s.phone}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: s.plan === "paid" ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.05)", color: s.plan === "paid" ? "var(--purple3)" : "var(--text3)", fontFamily: "var(--font-mono)" }}>
                          {s.plan === "paid" ? "PREMIUM" : "FREE"}
                        </span>
                        <span style={{ color: "var(--text3)", fontSize: 18 }}>›</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── MATERIAL ── */}
          {tab === "material" && !loading && !selectedStu && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", margin: "0 0 14px", fontFamily: "var(--font-head)" }}>Upload for Class {cls} — {subjectMeta?.label}</p>
                <div className="td-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={lbl}>Title</label>
                    <input className="input-field" placeholder="e.g. Chapter 3 — Motion" value={matForm.title} onChange={e => setMatForm({ ...matForm, title: e.target.value })} />
                  </div>
                  <div>
                    <label style={lbl}>Chapter / Topic</label>
                    <input className="input-field" placeholder="e.g. Chapter 3" value={matForm.chapter} onChange={e => setMatForm({ ...matForm, chapter: e.target.value })} />
                  </div>
                  <div>
                    <label style={lbl}>Description (optional)</label>
                    <input className="input-field" placeholder="Brief description" value={matForm.description} onChange={e => setMatForm({ ...matForm, description: e.target.value })} />
                  </div>
                  <div>
                    <label style={lbl}>Link (Drive / YouTube) or Upload PDF</label>
                    <input className="input-field" placeholder="https://drive.google.com/..." value={matForm.link} onChange={e => setMatForm({ ...matForm, link: e.target.value })} style={{ marginBottom: 8 }} />
                    <div className="upload-area" onClick={() => document.getElementById("mat-file-input").click()}>
                      <input id="mat-file-input" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" style={{ display: "none" }} onChange={e => handleFileUpload(e.target.files[0], "material")} />
                      <p style={{ margin: 0, fontSize: 12, color: "var(--text3)" }}>{uploading ? "Uploading..." : "Click to upload PDF / Doc"}</p>
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Access</label>
                    <select className="select-field" value={matForm.tier} onChange={e => setMatForm({ ...matForm, tier: e.target.value })}>
                      <option value="free">Free — visible to all students</option>
                      <option value="paid">Premium — paid students only</option>
                    </select>
                  </div>
                  <button className="grad-btn" style={{ padding: "12px", fontSize: 14, borderRadius: 12, marginTop: 4 }} onClick={uploadMat} disabled={uploading}>Upload</button>
                </div>
              </div>

              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", margin: "0 0 14px", fontFamily: "var(--font-head)" }}>Uploaded ({material.length})</p>
                {material.length === 0 ? <Mpty text="Nothing uploaded yet." /> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {material.map(m => (
                      <div key={m.id} className="td-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: "var(--text)", fontFamily: "var(--font-head)" }}>{m.title}</p>
                            {m.chapter && <span className="chapter-tag" style={{ background: "rgba(124,58,237,0.1)", color: "var(--purple3)" }}>{m.chapter}</span>}
                            <span className="chapter-tag" style={{ background: m.tier === "paid" ? "rgba(124,58,237,0.15)" : "rgba(52,211,153,0.1)", color: m.tier === "paid" ? "var(--purple3)" : "#34d399" }}>
                              {m.tier === "paid" ? "PREMIUM" : "FREE"}
                            </span>
                          </div>
                          {m.link && <a href={m.link} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--cyan)", textDecoration: "none" }}>View →</a>}
                        </div>
                        <button className="td-del" onClick={() => delMat(m.id)}>Delete</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── HOMEWORK ── */}
          {tab === "homework" && !loading && !selectedStu && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", margin: "0 0 14px", fontFamily: "var(--font-head)" }}>Assign to Class {cls} — {subjectMeta?.label}</p>
                <div className="td-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={lbl}>Title</label>
                    <input className="input-field" placeholder="e.g. Exercise 3.2 Q1–Q5" value={hwForm.title} onChange={e => setHwForm({ ...hwForm, title: e.target.value })} />
                  </div>
                  <div>
                    <label style={lbl}>Chapter / Topic</label>
                    <input className="input-field" placeholder="e.g. Chapter 3" value={hwForm.chapter} onChange={e => setHwForm({ ...hwForm, chapter: e.target.value })} />
                  </div>
                  <div>
                    <label style={lbl}>Category</label>
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      {HW_CATS.map(cat => (
                        <button key={cat} onClick={() => setHwForm({ ...hwForm, category: cat })} style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, textTransform: "capitalize", background: hwForm.category === cat ? "var(--grad)" : "var(--surface)", color: hwForm.category === cat ? "#fff" : "var(--text2)", border: hwForm.category === cat ? "none" : "1px solid var(--border)" }}>
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Instructions (optional)</label>
                    <input className="input-field" placeholder="Any additional notes" value={hwForm.description} onChange={e => setHwForm({ ...hwForm, description: e.target.value })} />
                  </div>
                  <div>
                    <label style={lbl}>Questions PDF / Drive Link</label>
                    <input className="input-field" placeholder="https://..." value={hwForm.link} onChange={e => setHwForm({ ...hwForm, link: e.target.value })} style={{ marginBottom: 8 }} />
                    <div className="upload-area" onClick={() => document.getElementById("hw-file-input").click()}>
                      <input id="hw-file-input" type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }} onChange={e => handleFileUpload(e.target.files[0], "homework")} />
                      <p style={{ margin: 0, fontSize: 12, color: "var(--text3)" }}>{uploading ? "Uploading..." : "Click to upload PDF of questions"}</p>
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Due Date</label>
                    <input className="input-field" type="date" value={hwForm.dueDate} onChange={e => setHwForm({ ...hwForm, dueDate: e.target.value })} />
                  </div>
                  <button className="grad-btn" style={{ padding: "12px", fontSize: 14, borderRadius: 12, marginTop: 4 }} onClick={assignHw} disabled={uploading}>Assign</button>
                </div>
              </div>

              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", margin: "0 0 14px", fontFamily: "var(--font-head)" }}>Assigned ({homework.length})</p>
                {homework.length === 0 ? <Mpty text="No homework assigned yet." /> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {homework.map(h => (
                      <div key={h.id} className="td-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: "var(--text)", fontFamily: "var(--font-head)" }}>{h.title}</p>
                            {h.chapter && <span className="chapter-tag" style={{ background: "rgba(124,58,237,0.1)", color: "var(--purple3)" }}>{h.chapter}</span>}
                            <span className="chapter-tag" style={{ background: h.category === "integrated" ? "rgba(0,229,255,0.1)" : h.category === "special" ? "rgba(251,191,36,0.1)" : "rgba(124,58,237,0.1)", color: h.category === "integrated" ? "var(--cyan)" : h.category === "special" ? "#fbbf24" : "var(--purple3)", textTransform: "capitalize" }}>
                              {h.category || "chapter"}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: 12, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>Due: {new Date(h.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                          {h.link && <a href={h.link} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--cyan)", textDecoration: "none" }}>View PDF →</a>}
                        </div>
                        <button className="td-del" onClick={() => delHw(h.id)}>Delete</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {toast && <div className="toast-pop">{toast}</div>}
    </>
  );
}

const lbl = { display: "block", fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7, fontFamily: "var(--font-mono)" };

function Mpty({ text }) {
  return (
    <div style={{ border: "1px dashed var(--border)", borderRadius: 14, padding: "36px 24px", textAlign: "center" }}>
      <p style={{ color: "var(--text3)", fontSize: 14, margin: 0 }}>{text}</p>
    </div>
  );
}